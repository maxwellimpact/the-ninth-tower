// The party: a leader you steer and two AI companions. Ported from Hero in
// game/units.js (the slice this battle needs: movement, the leader's commands
// and idle attacks, the companions' targeting, formation, flanking, ranged
// spacing, dodging telegraphed blows and reviving, skills and ultimates).
import SpriteKit

final class Action {
    let type: String          // attack, dodge, skill
    var id = ""
    var t: CGFloat = 0
    let dur: CGFloat
    var hitAt: CGFloat?
    var done = false
    weak var target: Enemy?
    var nx: CGFloat = 0, ny: CGFloat = 0
    var ghostT: CGFloat = 0
    var tick: ((Action, CGFloat) -> Void)?
    var resolve: (() -> Void)?
    init(_ type: String, dur: CGFloat) { self.type = type; self.dur = dur }
}

struct SkillSlot {
    let id: String
    let cd: CGFloat
    let range: CGFloat
    var t: CGFloat = 0
    var def: JSON { GameData.skills.obj(id) }
}

enum Command { case move, attack(Enemy, auto: Bool) }

final class Hero: Unit {
    let id: String
    let name: String
    var stats: JSON
    var level: Int
    var skills: [SkillSlot]
    let ultId: String
    var ult: CGFloat = 0
    var isLeader = false
    var command: Command?
    var path: [P]?
    var pathGoal: P?
    var repathT: CGFloat = 0
    var atkT: CGFloat = 0
    var action: Action?
    var dodgeCd: CGFloat = 0
    var invuln: CGFloat = 0
    var downed = false
    weak var target: Enemy?
    var thinkT = rnd() * 0.2
    var taunting: CGFloat = 0
    var shield: CGFloat = 0, shieldT: CGFloat = 0
    var nextCrit = false
    var reviveT: CGFloat = 0
    weak var reviveTarget: Hero?
    var direct: (CGFloat, CGFloat)?
    var vel = P(x: 0, y: 0)
    var head: P?
    var lastX: CGFloat?, lastY: CGFloat = 0
    var counterT: CGFloat = 0
    var aiSkillT: CGFloat = 0
    var stepT: CGFloat = 0
    var zipping = false
    // companion state
    var runOff: CGFloat = 0
    var backing = false
    var settled = false
    var fspd: CGFloat = 0
    var slotOff: P?
    var fhead: P?
    weak var evading: Zone?
    var evadeDir: (CGFloat, CGFloat) = (0, 0)
    var evadeT: CGFloat = 0
    var reactMs = 0.2 + rnd() * 0.16
    var stuckT: CGFloat = 0, stuckCount = 0, blockedT: CGFloat = 0
    var poison: (dps: CGFloat, t: CGFloat, next: CGFloat)?
    var burn: (dps: CGFloat, t: CGFloat, next: CGFloat)?
    var slowT: CGFloat = 0, slowMul: CGFloat = 1

    init(scene: BattleScene, id: String, level: Int, x: CGFloat, y: CGFloat) {
        self.id = id
        let def = GameData.heroes[id]!
        name = def.str("name") ?? id
        self.level = level
        stats = GameData.heroStats(id, level: level)
        skills = def.strs("skills").map { sid in
            let s = GameData.skills.obj(sid)
            return SkillSlot(id: sid, cd: s.num("cd", 8), range: s.num("range"))
        }
        ultId = def.str("ultimate") ?? ""
        let cast = Assets.shared.cast.obj(id)
        super.init(scene: scene, x: x, y: y, sheet: cast.str("sheet") ?? id, maxHp: stats.num("maxHp"), team: "party", r: 5)
        play("idle")
    }

    var spd: CGFloat { stats.num("speed") * (slowT > 0 ? slowMul : 1) }
    var ranged: Bool { let r = stats.str("role"); return r == "caster" || r == "ranged" }
    var atk: CGFloat { stats.num("atk") }
    var range: CGFloat { stats.num("range") }
    var portrait: String { Assets.shared.cast.obj(id).str("portrait") ?? id }

    func play(_ anim: String) { playKey("\(anim)_\(view)") }

    func addUlt(_ n: CGFloat) { if !downed { ult = clamp(ult + n, 0, 100) } }

    func heal(_ amt: CGFloat) {
        guard !downed, amt > 0 else { return }
        let before = hp
        hp = min(maxHp, hp + amt.rounded())
        if hp > before { scene.floatText(x, y - 26, "+\(Int(hp - before))", tint: hex(0x8cff8c)); scene.fx.burst(.heal, x, y - 10, 10) }
    }

    // ---- movement
    func setGoal(_ gx: CGFloat, _ gy: CGFloat) {
        if let g = pathGoal, hyp(g.x - gx, g.y - gy) < 6, path != nil { return }
        pathGoal = P(x: gx, y: gy)
        path = scene.nav.find(x, y, gx, gy)
        repathT = 0.5
    }
    func clearPath() { path = nil; pathGoal = nil }

    @discardableResult func followPath(_ dt: CGFloat, _ mul: CGFloat = 1) -> Bool {
        guard var p = path, let wp = p.first else { return false }
        let dx = wp.x - x, dy = wp.y - y, d = hyp(dx, dy), sp = spd * mul * dt
        if d <= max(1.5, sp) {
            moveBy(dx, dy); p.removeFirst()
            path = p.isEmpty ? nil : p
            return !p.isEmpty
        }
        face(dx, dy)
        let ox = x, oy = y
        moveBy(dx / d * sp, dy / d * sp)
        if hyp(x - ox, y - oy) < sp * 0.2 { stuckT += dt } else { stuckT = 0; stuckCount = 0 }
        if stuckT > 0.4, let g = pathGoal {
            stuckT = 0; stuckCount += 1
            if stuckCount > 2 { stuckCount = 0; path = nil; blockedT = 0.6; return false } // blocked by a crowd: stop pushing rather than jitter
            path = scene.nav.find(x, y, g.x, g.y)
        }
        return true
    }

    func moveTowards(_ p: Positioned, _ dt: CGFloat, _ mul: CGFloat = 1) {
        let (nx, ny) = norm(p.x - x, p.y - y)
        moveBy(nx * spd * mul * dt, ny * spd * mul * dt)
    }

    // ---- combat
    func canAct() -> Bool { alive && !downed && action == nil }

    @discardableResult func startAttack(_ t: Enemy) -> Bool {
        guard atkT <= 0, canAct() else { return false }
        face(t.x - x, t.y - y)
        atkT = stats.num("atkCd", 1)
        let a = Action("attack", dur: ranged ? 0.3 : 0.24)
        a.hitAt = stats.num("hitAt", 0.1); a.target = t
        action = a
        animKey = ""; play("attack")
        switch id {
        case "brann": Audio.shared.play("swing", pitch: 0.8)
        case "sable": Audio.shared.play("stab")
        default: Audio.shared.play("fireCast")
        }
        return true
    }

    func resolveAttack(_ t: Enemy) {
        if id == "pip" { // a homing bolt
            let (nx, ny) = norm(t.x - x, t.y - (y - 6))
            scene.spawnProjectile(Projectile(owner: self, x: x + nx * 10, y: y - 8 + ny * 6, vx: nx * 190, vy: ny * 190, dmg: atk, kind: .bolt, target: t, spell: true, basic: true))
            return
        }
        guard t.alive, dist(self, t) <= range + t.r + 8 else { return }
        let crit = nextCrit || rnd() < stats.num("crit")
        nextCrit = false
        scene.dealDamage(self, t, atk * (crit ? GameData.critMult : 1) * (0.9 + rnd() * 0.2), crit: crit, knock: id == "brann" ? 70 : id == "sable" ? 12 : 40, basic: true)
    }

    func dodge(_ dx: CGFloat, _ dy: CGFloat) {
        guard alive, !downed, dodgeCd <= 0, action?.type != "dodge" else { return }
        if let a = action, a.type == "skill", a.tick != nil { return } // mid-leap or mid-step: it carries on
        let (nx, ny) = norm(dx, dy)
        face(nx, ny)
        let a = Action("dodge", dur: 0.32); a.nx = nx; a.ny = ny
        action = a
        invuln = 0.28; dodgeCd = 0.55
        animKey = ""; play("dodge")
        clearPath()
        Audio.shared.play("dodge")
        scene.fx.dust(x, y)
        if isLeader { Haptics.dodge() }
    }

    func cancelForInput() {
        guard let a = action else { return }
        let cancellable = a.type == "attack" || (a.type == "skill" && a.tick == nil && (a.hitAt == nil || a.done))
        guard cancellable else { return }
        var wants = direct != nil
        if case .move = command { wants = true }
        if case .attack(let t, _) = command, a.type == "attack", t !== a.target { wants = true }
        if wants { cancelAction() }
    }

    func cancelAction() {
        if let a = action, a.type == "attack", !a.done { atkT = 0 }
        action = nil; animKey = ""
    }

    func act(_ id: String, _ dur: CGFloat, _ anim: String?, hitAt: CGFloat? = nil, tick: ((Action, CGFloat) -> Void)? = nil, resolve: (() -> Void)? = nil) {
        let a = Action("skill", dur: dur)
        a.id = id; a.hitAt = hitAt; a.tick = tick; a.resolve = resolve
        action = a
        animKey = ""
        if let anim { play(anim) }
    }

    @discardableResult func useSkill(_ i: Int, _ target: Enemy? = nil) -> Bool {
        if isLeader, action?.type == "attack" { cancelAction() } // a skill press never waits on a swing
        guard i < skills.count, skills[i].t <= 0, canAct() else { return false }
        var t = target?.alive == true ? target : nil
        if t == nil, Skills.targeted.contains(skills[i].id) { t = scene.nearestEnemy(self, skills[i].range > 0 ? skills[i].range : 120) }
        guard Skills.cast(skills[i].id, self, t) else { return false }
        skills[i].t = skills[i].cd
        return true
    }

    func updateAction(_ dt: CGFloat) {
        guard let a = action else { return }
        a.t += dt
        if a.type == "dodge" {
            let sp = 210 * (1 - a.t / a.dur) + 40
            moveBy(a.nx * sp * dt, a.ny * sp * dt)
            a.ghostT -= dt
            if a.ghostT <= 0 { a.ghostT = 0.045; scene.fx.ghost(self) }
        }
        if a.type == "attack", !a.done, let h = a.hitAt, a.t >= h { a.done = true; if let t = a.target { resolveAttack(t) } }
        if a.type == "skill" {
            a.tick?(a, dt)
            if !a.done, let h = a.hitAt, a.t >= h { a.done = true; a.resolve?() }
        }
        if a.t >= a.dur, action === a { action = nil; animKey = "" }
    }

    // el: the blow's element (a foe's own)
    @discardableResult func damage(_ amount0: CGFloat, src: Enemy?, el: String? = nil) -> CGFloat {
        guard alive, !downed else { return 0 }
        if invuln > 0 || zipping { scene.floatText(x, y - 28, "DODGE", font: "fontPlain"); return 0 }
        var amount = amount0
        if taunting > 0 { amount *= 0.5 }
        amount = max(1, GameData.mitigate(amount, def: stats.num("def"), attackerLevel: src?.level ?? 1).rounded())
        addUlt(amount / maxHp * GameData.tuning.num("ultTakeFull", 25))
        if shield > 0 {
            let absorbed = min(shield, amount)
            shield -= absorbed; amount -= absorbed
            if amount <= 0 { scene.floatText(x, y - 28, "BLOCK", font: "fontPlain"); Audio.shared.play("block"); return 0 }
        }
        hp -= amount
        flash(90, hex(0xff5050))
        Audio.shared.play("hurt")
        scene.floatText(x, y - 26, "\(Int(amount))", tint: hex(0xff6a6a))
        if isLeader { scene.shake(0.07, 0.004); Haptics.hurt() }
        if let src { knock(x - src.x, y - src.y, 50) }
        if hp <= 0 { goDown() }
        return amount
    }

    func addPoison(_ dps: CGFloat, _ t: CGFloat) {
        guard !downed else { return }
        poison = (max(dps, poison?.dps ?? 0), max(t, poison?.t ?? 0), poison?.next ?? 0.6)
    }
    func addBurn(_ dps: CGFloat, _ t: CGFloat = 3) {
        guard !downed else { return }
        burn = (max(dps, burn?.dps ?? 0), max(t, burn?.t ?? 0), burn?.next ?? 0.5)
    }
    func chill(_ t: CGFloat = 2) {
        guard !downed else { return }
        slowT = max(slowT, t); slowMul = 0.6
        scene.floatText(x, y - 34, "CHILLED", font: "fontPlain", tint: hex(0x9fe6ff))
    }

    func goDown() {
        hp = 0; downed = true; action = nil
        clearPath()
        animKey = ""; play("downed")
        alpha = 0.85
        scene.onHeroDowned(self)
    }

    func revive(_ frac: CGFloat = 0.4) {
        downed = false
        hp = max(1, (maxHp * frac).rounded())
        alpha = 1
        animKey = ""
        scene.fx.burst(.heal, x, y - 10, 10)
        scene.floatText(x, y - 28, "REVIVED", font: "fontGold")
    }

    // ---- per frame
    func update(_ dt: CGFloat) {
        guard alive else { return }
        atkT = max(0, atkT - dt)
        dodgeCd = max(0, dodgeCd - dt)
        invuln = max(0, invuln - dt)
        taunting = max(0, taunting - dt)
        slowT = max(0, slowT - dt)
        if shieldT > 0 { shieldT -= dt; if shieldT <= 0 { shield = 0 } }
        statusTint = nil
        if var p = poison, !downed {
            p.t -= dt; p.next -= dt
            if p.next <= 0 { p.next += 0.6; let d = max(1, (p.dps * 0.6).rounded()); hp -= d; scene.floatText(x + rnd() * 8 - 4, y - 22, "\(Int(d))", tint: hex(0x9cff7a)); if hp <= 0 { goDown() } }
            poison = p.t > 0 ? p : nil
            statusTint = hex(0xb8ff9a)
        }
        if var b = burn, !downed {
            b.t -= dt; b.next -= dt
            if b.next <= 0 { b.next += 0.5; let d = max(1, (b.dps * 0.5).rounded()); hp -= d; scene.floatText(x + rnd() * 8 - 4, y - 22, "\(Int(d))", tint: hex(0xffa060)); scene.fx.burst(.ember, x, y - 10, 2); if hp <= 0 { goDown() } }
            burn = b.t > 0 ? b : nil
            statusTint = hex(0xffb08a)
        }
        if slowT > 0 && statusTint == nil { statusTint = hex(0x9fe6ff) }
        if !downed { addUlt(dt * GameData.tuning.num("ultPassive", 2.2)) }
        for i in skills.indices { skills[i].t = max(0, skills[i].t - dt) }
        physics(dt)
        if downed { sync(dt); return }
        if zipping { sync(dt); return }

        if action != nil && isLeader { cancelForInput() }
        if action != nil { updateAction(dt) } else if isLeader { updateLeader(dt) } else { updateCompanion(dt) }

        // smoothed velocity: the leader's heading steers the formation, and walk/idle uses it
        if let lx = lastX, dt > 0 {
            let vx = (x - lx) / dt, vy = (y - lastY) / dt, a = min(1, dt * 10)
            vel = P(x: vel.x + (vx - vel.x) * a, y: vel.y + (vy - vel.y) * a)
            let sp = hyp(vel.x, vel.y)
            if sp > 12 {
                let ux = vel.x / sp, uy = vel.y / sp, h = head ?? P(x: ux, y: uy), b = min(1, dt * 6)
                let (hx, hy) = norm(h.x + (ux - h.x) * b, h.y + (uy - h.y) * b)
                head = P(x: hx, y: hy)
            }
        }
        if action == nil {
            let moving = lastX != nil && hyp(vel.x, vel.y) > 8
            play(moving ? "walk" : "idle")
            if moving && isLeader { stepT -= dt; if stepT <= 0 { stepT = 0.24; Audio.shared.play("step", vol: 0.5) } }
        }
        lastX = x; lastY = y
        separate()
        sync(dt)
    }

    // companions yield to the leader and to each other; the leader is never shoved
    func separate() {
        if isLeader { return }
        for o in scene.party where o !== self && o.alive {
            let dx = x - o.x, dy = y - o.y, d = hyp(dx, dy), m: CGFloat = o.isLeader ? 12 : 10
            if d > 0.01 && d < m { moveBy(dx / d * (m - d) * 0.35, dy / d * (m - d) * 0.35) }
        }
    }

    // ---- the leader
    func updateLeader(_ dt: CGFloat) {
        if let d = direct {
            command = nil; clearPath()
            let (nx, ny) = norm(d.0, d.1)
            face(nx, ny)
            moveBy(nx * spd * dt, ny * spd * dt)
            return
        }
        switch command {
        case .attack(let t, let auto):
            guard t.alive else { command = nil; clearPath(); return }
            let d = dist(self, t), reach = range + t.r
            if auto && d > reach + 40 + 12 { command = nil; clearPath(); return } // stepped in on his own: a foe that backs off is let go
            let slack: CGFloat = ranged ? 0 : 6
            if d <= reach + slack && (!ranged || scene.nav.shotClear(x, y, t.x, t.y)) {
                clearPath(); face(t.x - x, t.y - y); startAttack(t)
            } else if !ranged && d < reach + 36 && scene.nav.lineClear(x, y, t.x, t.y, 3) {
                clearPath(); face(t.x - x, t.y - y); moveTowards(t, dt)
            } else {
                blockedT = max(0, blockedT - dt)
                if blockedT > 0 { return }
                repathT -= dt
                let goal: Positioned = ranged ? firingSpot(t, min(range - 12, max(56 + t.r, range * 0.72))) as Positioned : t as Positioned
                if path == nil || repathT <= 0 { path = nil; setGoal(goal.x, goal.y) }
                followPath(dt)
            }
            return
        case .move:
            if !followPath(dt) && path == nil { command = nil }
            return
        case nil: break
        }
        // idle: keep up the basic attack on whatever's in the fight, nearest first;
        // a melee leader steps in at a foe a couple of tiles past reach
        var best: Enemy?, bd = CGFloat.infinity
        let far = range + (ranged ? 0 : 6 + 40)
        for e in scene.enemies where e.alive && e.engaged {
            let d = dist(self, e)
            if d >= bd || d > far + e.r { continue }
            if ranged ? !scene.nav.shotClear(x, y, e.x, e.y) : (d > range + e.r + 6 && !scene.nav.lineClear(x, y, e.x, e.y, 3)) { continue }
            best = e; bd = d
        }
        if let b = best, bd <= range + b.r + (ranged ? 0 : 6) { if atkT <= 0 { startAttack(b) }; return }
        if let b = best { command = .attack(b, auto: true); return }
        if !ranged, let threat = scene.enemies.first(where: { $0.alive && $0.target === self && dist($0, self) < range + 22 }) { command = .attack(threat, auto: false) }
    }

    // ---- companions
    func worthDodging(_ z: Zone) -> Bool {
        if z === evading { return true }
        let now = scene.clock
        if z.seenAt == nil { z.seenAt = now }
        if z.src != nil, let _ = z.lockAt, z.src?.alive == true { // a tracking blow: nothing to dodge until it locks, then a beat to notice
            guard z.locked else { return false }
            if z.lockedAt == nil { z.lockedAt = now }
            if now - z.lockedAt! < reactMs { return false }
        } else if now - z.seenAt! < reactMs { return false }
        if z.src == nil || z.big { return true }
        if hp < maxHp * 0.5 || z.dmg >= hp * 0.3 { return true }
        let key = ObjectIdentifier(self)
        if z.dodgeRoll[key] == nil { z.dodgeRoll[key] = rnd() < (z.src?.target === self ? 0.6 : 0.2) }
        return z.dodgeRoll[key]!
    }

    func updateCompanion(_ dt: CGFloat) {
        guard let L = scene.leader else { return }
        thinkT -= dt
        if thinkT <= 0 { thinkT = 0.15; think() }

        // 1) step out of telegraphed danger, and commit to it
        if let z = scene.dangers.first(where: { hyp(x - $0.x, y - $0.y) < $0.r + ($0 === evading ? 12 : 4) && worthDodging($0) }) {
            evadeT -= dt
            if evading !== z || evadeT <= 0 { evadeDir = exitDir(z); evadeT = 0.3 }
            evading = z
            face(evadeDir.0, evadeDir.1)
            moveBy(evadeDir.0 * spd * 1.3 * dt, evadeDir.1 * spd * 1.3 * dt)
            clearPath()
            return
        }
        evading = nil

        // 2) revive a downed ally
        if let r = reviveTarget {
            if !r.downed { reviveTarget = nil; reviveT = 0 }
            else if dist(self, r) < 14 {
                clearPath(); play("cast")
                reviveT += dt
                if reviveT > 1.4 { r.revive(0.4); Audio.shared.play("heal"); reviveTarget = nil; reviveT = 0 }
                return
            } else { setGoal(r.x, r.y); followPath(dt, 1.2); return }
        }

        // 3) stay with the leader: when the leader runs off, break off and follow
        let dl0 = dist(self, L)
        var leaderRunning = L.direct != nil
        if case .move = L.command { leaderRunning = true }
        if leaderRunning && dl0 > 56 { target = nil; runOff = 1.2 }
        runOff = max(0, runOff - dt)
        if runOff > 0 { target = nil }
        if target != nil && dl0 > (ranged ? 170 : 112) { target = nil }

        // 4) fight
        if let t = target, t.alive {
            let d = dist(self, t)
            if ranged {
                let keep = min(range - 12, max(56 + t.r, range * 0.72))
                if d < keep - 12 { backing = true } else if d >= keep { backing = false }
                if backing && dl0 < 170 {
                    var (nx, ny) = norm(x - t.x, y - t.y)
                    let nav = scene.nav
                    if nav.waterAt(x + nx * 10, y + ny * 10) { // don't back off into a pool: slide along the shore
                        let side: CGFloat = nav.waterAt(x - ny * 10, y + nx * 10) ? -1 : 1
                        (nx, ny) = (-ny * side, nx * side)
                        if nav.waterAt(x + nx * 10, y + ny * 10) { nx = 0; ny = 0 }
                    }
                    let ox = x, oy = y, s = stats.num("speed")
                    moveBy(nx * s * dt, ny * s * dt)
                    if hyp(x - ox, y - oy) < s * dt * 0.3 { moveBy(-ny * s * dt, nx * s * dt) } // backed into a wall: slide sideways
                    face(t.x - x, t.y - y); clearPath()
                    if d > keep - 24 { startAttack(t) }
                    return
                }
                if d <= range && scene.nav.shotClear(x, y, t.x, t.y) { clearPath(); face(t.x - x, t.y - y); startAttack(t); return }
                if dl0 > 110 { setGoal(L.x, L.y); followPath(dt, 1.2); return }
                let spot = firingSpot(t, keep)
                setGoal(spot.x, spot.y); followPath(dt)
                return
            }
            // melee: a flank slot, opposite the leader
            let slot = flankSlot(t), reach = range + t.r
            let (ax, ay) = norm(slot.x - x, slot.y - y)
            if scene.dangers.contains(where: { $0.src == nil || $0.big ? hyp(x + ax * 10 - $0.x, y + ay * 10 - $0.y) < $0.r + 6 : false }) {
                clearPath(); face(t.x - x, t.y - y)
                if d <= reach + 6 { startAttack(t) }
                return
            }
            if d <= reach + 6 {
                clearPath(); face(t.x - x, t.y - y)
                if hyp(x - slot.x, y - slot.y) > 5 && d > reach - 4 { moveTowards(slot, dt, 0.6) }
                startAttack(t)
                return
            }
            if d < reach + 40 && scene.nav.lineClear(x, y, t.x, t.y, 3) { clearPath(); face(t.x - x, t.y - y); moveTowards(scene.nav.solidAt(slot.x, slot.y) ? P(x: t.x, y: t.y) : slot, dt); return }
            blockedT = max(0, blockedT - dt)
            if blockedT > 0 { moveTowards(t, dt, 0.5); return }
            setGoal(slot.x, slot.y); followPath(dt)
            return
        }

        // 5) follow in formation behind the leader, on a loose lead
        let raw = formationSlot(), dl = dist(self, L)
        if dl > 230 { x = raw.x; y = raw.y; scene.fx.puff(x, y); fspd = 0; return }
        let ox = raw.x - L.x, oy = raw.y - L.y, sa = min(1, dt * 4)
        let so = slotOff.map { P(x: $0.x + (ox - $0.x) * sa, y: $0.y + (oy - $0.y) * sa) } ?? P(x: ox, y: oy)
        slotOff = so
        let sm = P(x: L.x + so.x, y: L.y + so.y)
        let slot = scene.nav.solidAt(sm.x, sm.y) ? raw : sm
        let ds = hyp(x - slot.x, y - slot.y), lsp = hyp(L.vel.x, L.vel.y)
        if ds < 4 && lsp < 12 { settled = true } else if ds > 16 || (lsp > 30 && ds > 8) { settled = false }
        if settled {
            fspd = 0; clearPath()
            face(L.x - x + (L.view == "side" ? (L.flip ? -40 : 40) : 0), L.y - y + (L.view == "down" ? 40 : L.view == "up" ? -40 : 0))
            return
        }
        if ds < 60 && scene.nav.lineClear(x, y, slot.x, slot.y, 3) {
            clearPath()
            let want = min(spd * 1.35, max(0, lsp * 0.95 + (ds - 5) * 2.2))
            fspd += (want - fspd) * min(1, dt * 5)
            let (nx, ny) = norm(slot.x - x, slot.y - y)
            let h = fhead ?? P(x: nx, y: ny), ha = min(1, dt * 8)
            let (hx, hy) = norm(h.x + (nx - h.x) * ha, h.y + (ny - h.y) * ha)
            fhead = P(x: hx, y: hy)
            let stp = min(ds, fspd * dt)
            if lsp > 12, let lh = L.head { face(lh.x, lh.y) } else if fspd > 10 { face(hx, hy) }
            moveBy(hx * stp, hy * stp)
        } else {
            fspd = spd
            repathT -= dt
            if path == nil || repathT <= 0 { path = nil; setGoal(slot.x, slot.y) }
            followPath(dt, dl > 40 ? 1.3 : 1)
        }
    }

    // of 16 headings, the one that clears the zone in the fewest steps over open ground
    func exitDir(_ z: Zone) -> (CGFloat, CGFloat) {
        let nav = scene.nav
        var best = norm(x - z.x, y - z.y), bs = -CGFloat.infinity
        for k in 0..<16 {
            let a = CGFloat(k) / 16 * .pi * 2, ux = cos(a), uy = sin(a)
            var d: CGFloat = 0, ok = true
            while d <= 48 {
                let px = x + ux * d, py = y + uy * d
                if nav.solidAt(px, py) { ok = false; break }
                if hyp(px - z.x, py - z.y) >= z.r + 14 { break }
                d += 4
            }
            if !ok || d > 48 { continue }
            let ex = x + ux * (d + 6), ey = y + uy * (d + 6)
            let other = scene.dangers.contains { $0 !== z && hyp(ex - $0.x, ey - $0.y) < $0.r + 4 }
            let away = (x - z.x) * ux + (y - z.y) * uy
            let score = -d - (other ? 40 : 0) + away * 0.05
            if score > bs { bs = score; best = (ux, uy) }
        }
        return best
    }

    private var fireSpot: (P, ObjectIdentifier, P, CGFloat)?
    func firingSpot(_ t: Enemy, _ keep: CGFloat) -> P {
        if let fs = fireSpot, fs.1 == ObjectIdentifier(t), hyp(fs.2.x - t.x, fs.2.y - t.y) < 24, scene.clock < fs.3 { return fs.0 }
        var best: P?, bd = CGFloat.infinity
        for rad in [keep, (keep + range) / 2, range - 10] { for k in 0..<16 {
            let a = CGFloat(k) / 16 * .pi * 2, px = t.x + cos(a) * rad, py = t.y + sin(a) * rad
            if scene.nav.solidAt(px, py) || !scene.nav.shotClear(px, py, t.x, t.y) { continue }
            let dd = hyp(px - x, py - y)
            if dd < bd { bd = dd; best = P(x: px, y: py) }
        } }
        let p = best ?? P(x: t.x, y: t.y)
        fireSpot = (p, ObjectIdentifier(t), P(x: t.x, y: t.y), scene.clock + 1.5)
        return p
    }

    func think() {
        guard let L = scene.leader else { return }
        if let down = scene.party.first(where: { $0.downed }), reviveTarget == nil, !scene.party.contains(where: { $0 !== self && $0.reviveTarget === down }) {
            let pressure = scene.enemies.contains { $0.alive && $0.target === self && dist($0, self) < 30 }
            if !pressure { reviveTarget = down }
        }
        // ultimates: companions fire their own when it's worth it
        if ult >= 100 {
            let near = scene.enemies.filter { $0.alive && $0.engaged && dist($0, self) < 150 }
            let hurt = scene.party.contains { !$0.downed && $0.hp / $0.maxHp < 0.45 }
            let want = (ultId == "bulwark" && (hurt || near.count >= 3)) || (ultId == "meteor" && near.count >= 2) || (ultId == "thousand_cuts" && near.count >= 2)
            if want && scene.useUltimate(self) { return }
        }
        // a target: what the leader engages, else what's attacking us
        let engaged = scene.enemies.filter { $0.alive && $0.engaged && dist($0, L) < 96 }
        var leaderT: Enemy?
        if case .attack(let t, _) = L.command, t.alive { leaderT = t }
        func byDist(_ l: [Enemy]) -> [Enemy] { l.sorted { dist($0, self) < dist($1, self) } }
        var t: Enemy?
        if stats.str("role") == "tank" { t = byDist(engaged.filter { $0.target != nil && $0.target !== self }).first ?? leaderT ?? byDist(engaged).first } // protect the squishies first
        else if ranged { t = leaderT ?? byDist(engaged).first }
        else { t = leaderT ?? engaged.min { $0.hp < $1.hp } }
        // skills: the first ready one whose rule says it's worth it; one per ~1.5s
        aiSkillT = max(0, aiSkillT - 0.15)
        if aiSkillT <= 0 {
            for i in skills.indices where skills[i].t <= 0 {
                if let want = Skills.ai(skills[i].id, self, target: t, engaged: engaged), useSkill(i, want.0 ? t : want.1) { aiSkillT = 1.5; return }
            }
        }
        target = t
    }

    func flankSlot(_ t: Enemy) -> P {
        guard let L = scene.leader else { return P(x: t.x, y: t.y) }
        var (nx, ny) = norm(t.x - L.x, t.y - L.y)
        if L === self { (nx, ny) = norm(t.x - x, t.y - y) }
        let side: CGFloat = id == "sable" ? 1 : -1
        let a = atan2(ny, nx) + side * 2.1, r = range + t.r - 2
        return P(x: t.x - cos(a) * r, y: t.y - sin(a) * r)
    }

    func formationSlot() -> P {
        guard let L = scene.leader else { return P(x: x, y: y) }
        let (fx, fy) = L.head.map { ($0.x, $0.y) } ?? L.facingVec()
        let idx = scene.party.filter { !$0.isLeader }.firstIndex { $0 === self } ?? 0
        let side: CGFloat = idx == 0 ? -1 : 1
        let bx = L.x - fx * 17 + -fy * side * 12, by = L.y - fy * 14 + fx * side * 9
        return scene.nav.solidAt(bx, by) ? P(x: L.x - fx * 10, y: L.y - fy * 10) : P(x: bx, y: by)
    }
}
