// Foes, ported from Enemy in game/units.js: level scaling, noticing the
// party, surrounding a hero with only two swinging at once (attack tokens),
// telegraphed blows that track then lock, archers and casters keeping their
// distance, elements (weak/resist, burn, poison, chill to freeze) and the
// special moves of this slice's cast (the imp's blink, the spider's web, the
// frost wolf's chilling bite).
import SpriteKit

// A telegraphed blow's ground marker. Companions read these to sidestep.
final class Zone: Positioned {
    var x: CGFloat, y: CGFloat
    let r: CGFloat
    weak var src: Enemy?
    var dmg: CGFloat = 0
    var big = false
    var lockAt: CGFloat?
    var locked = false
    var seenAt: CGFloat?, lockedAt: CGFloat?
    var dodgeRoll: [ObjectIdentifier: Bool] = [:]
    var node: SKShapeNode?
    init(x: CGFloat, y: CGFloat, r: CGFloat) { self.x = x; self.y = y; self.r = r }
}

struct Status { var t: CGFloat; var tick: CGFloat = 0; var next: CGFloat = 0; var dmg: CGFloat = 0; var n: CGFloat = 1 }

final class Enemy: Unit {
    let kind: String
    var s: JSON
    let level: CGFloat
    let atkEl: String?
    var state = "idle"
    var t: CGFloat = 0
    weak var target: Hero?
    weak var token: Hero?
    var stunT: CGFloat = 0
    var tauntT: CGFloat = 0
    var engaged = false
    var commitT: CGFloat = 0
    var threat: [ObjectIdentifier: CGFloat] = [:]
    var zone: Zone?
    var aim: P?
    var aimLine: SKShapeNode?
    var status: [String: Status] = [:]
    var repos: P?, reposT: CGFloat = 0
    var path: [P]?, repathT: CGFloat = 0
    var stuckT: CGFloat = 0, unstickT: CGFloat = 0, unstick: (CGFloat, CGFloat) = (0, 0)
    var strafeT: CGFloat = 0, strafeSide: CGFloat = 1
    var blinkT: CGFloat = 4, webCd: CGFloat = 0.3
    var skit = rnd() * 6
    var lunge: (dx: CGFloat, dy: CGFloat, p: CGFloat)?
    var weakShown = false
    var hunt = false // comes for the party from anywhere on the field (the Colosseum's foes)
    var lastElement: String?
    let puppet: Bool
    static let stepIn: [String: CGFloat] = ["goblin": 7]
    static let puppets: Set<String> = ["goblin", "archer"]

    init(scene: BattleScene, kind: String, x: CGFloat, y: CGFloat, level: Int) {
        self.kind = kind
        let base = GameData.enemies.obj(kind)
        let L1 = CGFloat(level - 1), T = GameData.tuning
        var s = base
        s["dmg"] = base.num("dmg") * (1 + L1 * T.num("enemyDmgGrowth"))
        self.s = s
        self.level = CGFloat(level)
        atkEl = base.str("element")
        puppet = Enemy.puppets.contains(kind)
        super.init(scene: scene, x: x, y: y, sheet: kind, maxHp: (base.num("maxHp") * (1 + L1 * T.num("enemyHpGrowth"))).rounded(), team: "enemy", r: base.num("r", 5))
        if s.flag("flying") { lift = 8 }
        play("idle")
    }

    var ranged: Bool { s.flag("ranged") }
    var reach: CGFloat { s.num("reach", 20) }
    var slow: CGFloat {
        if status["freeze"] != nil { return 0 }
        if let c = status["chill"] { return c.n >= 2 ? 0.5 : 0.7 }
        return 1
    }

    func animName(_ anim: String) -> String {
        let a = anim == "recover" ? "idle" : anim
        return puppet ? "\(a == "windup" ? "attack" : a)_\(view)" : "\(a)_\(view)"
    }

    func play(_ anim: String) {
        let key = animName(anim)
        if anim == "recover", animKey == animName("attack"), !animDone { return } // its attack plays through before it settles
        if key == animKey { return }
        if puppet && anim == "windup" { hold("attack_\(view)_0", key: key); return } // the first attack frame, held, is the telegraph
        playKey(key)
    }

    func restoreTint() {
        statusTint = status["freeze"] != nil ? hex(0x7fd0ff) : status["chill"] != nil ? hex(0x9fdcff) : status["burn"] != nil ? hex(0xffb08a) : status["poison"] != nil ? hex(0xb8ff9a) : nil // (units.js statusColor, in its order)
    }

    func elementMul(_ el: String?) -> CGFloat {
        guard let el else { return 1 }
        if s.str("resist") == el || (s.flag("hexed") && el == "shadow") { return 0.5 }
        if s.str("weak") == el || (s.flag("hexed") && el == "light") { return 1.5 }
        return 1
    }

    // elemental statuses (C2)
    func applyElement(_ el: String?, src: Hero) {
        guard let el, alive, elementMul(el) >= 1 else { return }
        let weak: CGFloat = elementMul(el) > 1 ? 1.5 : 1
        let base = src.atk
        switch el {
        case "fire": status["burn"] = Status(t: 3 * weak, tick: 0.5, next: 0.5, dmg: base * 0.12)
        case "venom":
            let n = min(5, (status["poison"]?.n ?? 0) + 1)
            status["poison"] = Status(t: 4 * weak, tick: 0.6, next: status["poison"]?.next ?? 0.6, dmg: base * 0.09, n: n)
        case "frost":
            let n = (status["chill"]?.n ?? 0) + 1
            status["chill"] = Status(t: 3 * weak, n: n)
            if n >= 3 {
                status["chill"] = nil
                status["freeze"] = Status(t: 1.5 * weak)
                stunT = max(stunT, 1.5 * weak)
                clearZone()
                scene.floatText(x, y - 30, "FROZEN", font: "fontPlain", tint: hex(0x9fe6ff))
            }
        default: break
        }
        if weak > 1 && !weakShown { weakShown = true; scene.floatText(x, y - 40, "WEAK!", font: "fontGold") }
        restoreTint()
    }

    func updateStatus(_ dt: CGFloat) {
        for k in Array(status.keys) {
            guard var st = status[k] else { continue }
            st.t -= dt
            if st.tick > 0 {
                st.next -= dt
                if st.next <= 0 && alive {
                    st.next += st.tick
                    let d = max(1, (st.dmg * st.n).rounded())
                    scene.floatText(x + rnd() * 8 - 4, y - 18, "\(Int(d))", tint: k == "burn" ? hex(0xffa060) : hex(0x9cff7a))
                    scene.fx.burst(k == "burn" ? .ember : .heal, x, y - 8, 3)
                    status[k] = st
                    damage(d, src: scene.leader, knock: 0, dot: true)
                    if !alive { return }
                }
            }
            if st.t <= 0 { status[k] = nil; restoreTint() } else { status[k] = st }
        }
    }

    func setTaunt(_ by: Hero, _ t: CGFloat) { tauntT = t; target = by; engaged = true; if state == "idle" { state = "chase" } }

    func aggroOn(_ h0: Hero, spread: Bool = true) {
        guard !h0.downed else { return }
        var h = h0
        if ranged && tauntT <= 0 { // archers and casters go for the most fragile hero in reach, spread across them
            func load(_ p: Hero) -> CGFloat { CGFloat(scene.enemies.filter { $0 !== self && $0.alive && $0.ranged && $0.target === p }.count) }
            if let soft = scene.party.filter({ $0.alive && !$0.downed && dist($0, self) < s.num("aggro", 110) * 1.4 }).min(by: { $0.maxHp + load($0) * 70 < $1.maxHp + load($1) * 70 }) { h = soft }
        }
        commitT = 2
        let was = engaged
        target = h; engaged = true
        if state == "idle" { state = "chase" }
        if !was {
            scene.fx.alert(self)
            if spread { for e in scene.enemies where e !== self && e.alive && !e.engaged && dist(e, self) < 70 { e.aggroOn(h, spread: false) } }
        }
    }

    func noteAttacker(_ src: Hero, _ amount: CGFloat) {
        let k = ObjectIdentifier(src)
        threat[k, default: 0] += amount
        guard let t = target, !t.downed, t.alive, engaged else { aggroOn(src); return }
        if t === src || tauntT > 0 || state == "windup" || commitT > 0 { return }
        let outOfReach = dist(self, t) > reach + 10 + 50 && dist(self, src) < reach + 10 + src.r + 10
        let harder = threat[k, default: 0] > threat[ObjectIdentifier(t), default: 0] * 1.6
        if outOfReach || harder { target = src; commitT = 2 }
    }

    @discardableResult func damage(_ amount0: CGFloat, src: Hero?, crit: Bool = false, knock kn: CGFloat = 40, dot: Bool = false) -> CGFloat {
        guard alive else { return 0 }
        let amount = amount0.rounded()
        hp -= amount
        if !dot { flash(crit ? 90 : 60) }
        if let src, kn > 0 { knock(x - src.x, y - src.y, state == "windup" ? kn * 0.3 : kn) }
        if let src { noteAttacker(src, amount) }
        if hp <= 0 { die() }
        return amount
    }

    func die() {
        alive = false
        clearZone()
        scene.onEnemyKilled(self)
        destroy()
    }

    func clearZone() {
        if let z = zone { scene.dangers.removeAll { $0 === z }; z.node?.removeFromParent(); zone = nil }
        aimLine?.removeFromParent(); aimLine = nil
    }

    override func sync(_ dt: CGFloat) {
        if s.flag("flying") { lift = 8 + sin(scene.clock / 0.3 + CGFloat(ObjectIdentifier(self).hashValue % 7)) * 2 }
        super.sync(dt)
        if let l = lunge {
            sprite.position.x += (l.dx * l.p).rounded(); sprite.position.y -= (l.dy * l.p).rounded()
            shadow.position.x += (l.dx * l.p).rounded(); shadow.position.y -= (l.dy * l.p).rounded()
        }
        sprite.zRotation = stunT > 0 ? sin(stunT * 30) * 6 * .pi / 180 : 0
    }

    // ---- per frame
    func update(_ dt: CGFloat) {
        guard alive else { return }
        physics(dt)
        tauntT = max(0, tauntT - dt)
        commitT = max(0, commitT - dt)
        if token != nil && state != "windup" { token = nil }
        for k in threat.keys { threat[k]! *= (1 - dt * 0.25) } // grudges fade
        if let l = lunge { lunge!.p = max(0, l.p - dt * 6); if lunge!.p <= 0 { lunge = nil } }
        updateStatus(dt)
        if !alive { return }
        if stunT > 0 { stunT -= dt; play("idle"); sync(dt); return }
        if s.str("ai") == "blink" && engaged { blinkT -= dt; if blinkT <= 0 && state == "chase" { blinkAway() } }
        if s.str("ai") == "web" { webCd = max(0, webCd - dt) }
        t += dt * max(0.3, slow)

        if let tg = target, tg.downed || !tg.alive {
            target = scene.nearestHero(self, .infinity) // the arena: whoever's left
            if target == nil { state = "idle"; engaged = false }
        }

        switch state {
        case "idle":
            if let h = scene.nearestHero(self, hunt ? .infinity : s.num("aggro", 110)) { aggroOn(h); break }
            play("idle")
        case "chase":
            guard let tg = target else { state = "idle"; break }
            let d = dist(self, tg)
            let rush: CGFloat = d > 140 ? 1.4 : 1 // they come for you across the field
            if ranged {
                if d < s.num("keepAway", 50) { backOff(tg, dt); break }
                if let r = repos, reposT > 0, hyp(r.x - x, r.y - y) > 3 { reposT -= dt; stepTo(r, dt, 0.8); break }
                repos = nil
                let clear = scene.nav.shotClear(x, y, tg.x, tg.y)
                if d <= reach && !clear { strafe(tg, dt); break }
                if d <= reach && clear {
                    if takeToken(tg) { beginWindup(tg) } else { face(tg.x - x, tg.y - y); play("idle"); keepApart(dt) }
                    break
                }
                stepTo(P(x: tg.x, y: tg.y), dt, rush)
                break
            }
            if s.str("ai") == "web" && webCd <= 0 && d > 30 && d < 110 && scene.nav.shotClear(x, y, tg.x, tg.y) && takeToken(tg) { spitWeb(tg); break }
            let free = tokenFree(tg)
            if free && d <= reach + tg.r && takeToken(tg) { beginWindup(tg); break }
            let slot = surroundSlot(tg, free ? reach + tg.r - 3 : reach + tg.r + 18)
            if hyp(slot.x - x, slot.y - y) > 3 { stepTo(slot, dt, (free ? 1 : 0.6) * rush) }
            else { face(tg.x - x, tg.y - y); play("idle"); keepApart(dt) }
        case "windup":
            play("windup")
            if let z = zone, !ranged, let la = z.lockAt, t < la, let tg = target, tg.alive, !tg.downed {
                // still tracking: shuffle after the target and drag the marker along
                if hyp(tg.x - z.x, tg.y - z.y) > z.r + tg.r - 4 { stepTo(P(x: tg.x, y: tg.y), dt, 0.8) }
                let (nx, ny) = norm(tg.x - x, tg.y - y)
                z.x = x + nx * 16; z.y = y + ny * 16
                face(nx, ny)
                z.node?.position = CGPoint(x: z.x, y: -z.y)
                play("windup")
            } else {
                if let z = zone, !z.locked { z.locked = true }
                keepApart(dt)
            }
            if let a = aim, let l = aimLine { l.path = linePath(x, y - 8, a.x, a.y); l.alpha = 0.25 + min(1, t / s.num("windup", 0.6)) * 0.6 }
            if t >= s.num("windup", 0.6) { strike() }
        case "recover":
            play("recover")
            keepApart(dt)
            if t >= s.num("recover", 0.6) {
                state = "chase"; t = 0
                if ranged, let tg = target, rnd() < 0.5 { // shift position a little after shooting
                    let want = (s.num("keepAway", 50) + reach) / 2, a = atan2(y - tg.y, x - tg.x) + (rnd() < 0.5 ? 0.45 : -0.45)
                    let p = P(x: tg.x + cos(a) * want, y: tg.y + sin(a) * want)
                    if !scene.nav.solidAt(p.x, p.y) && scene.nav.shotClear(p.x, p.y, tg.x, tg.y) { repos = p; reposT = 0.8 }
                }
            }
        default: break
        }
        sync(dt)
    }

    func tokenFree(_ tg: Hero) -> Bool {
        if token === tg { return true }
        let n = scene.enemies.filter { $0 !== self && $0.alive && $0.token === tg && $0.state == "windup" }.count
        return n < Int(GameData.tuning.num("attackTokens", 2))
    }
    func takeToken(_ tg: Hero) -> Bool { guard tokenFree(tg) else { return false }; token = tg; return true }

    // a spot on a ring round the target, pushed apart from the others on it
    func surroundSlot(_ tg: Hero, _ ring: CGFloat) -> P {
        let others = scene.enemies.filter { $0 !== self && $0.alive && !$0.ranged && $0.target === tg && hyp($0.x - tg.x, $0.y - tg.y) < ring + 40 }
        var a = atan2(y - tg.y, x - tg.x)
        let minSep = min(1.1, .pi * 2 / CGFloat(others.count + 1))
        for _ in 0..<3 { for o in others {
            let ao = atan2(o.y - tg.y, o.x - tg.x), da = atan2(sin(a - ao), cos(a - ao))
            if abs(da) < minSep { a += (da >= 0 ? 1 : -1) * (minSep - abs(da)) * 0.5 }
        } }
        let px = tg.x + cos(a) * ring, py = tg.y + sin(a) * ring * 0.8
        return scene.nav.solidAt(px, py) ? P(x: tg.x + (x - tg.x) * 0.5, y: tg.y + (y - tg.y) * 0.5) : P(x: px, y: py)
    }

    func keepApart(_ dt: CGFloat) {
        for e in scene.enemies where e !== self && e.alive {
            let dx = x - e.x, dy = y - e.y, d = hyp(dx, dy)
            if d > 0.01 && d < 12 { moveBy(dx / d * 20 * dt, dy / d * 20 * dt) }
        }
    }

    func backOff(_ tg: Hero, _ dt: CGFloat) {
        let base = atan2(y - tg.y, x - tg.x)
        for off: CGFloat in [0, 0.6, -0.6, 1.2, -1.2, 1.6, -1.6] {
            let px = x + cos(base + off) * 24, py = y + sin(base + off) * 24
            if !scene.nav.solidAt(px, py) && scene.nav.lineClear(x, y, px, py, 3) { stepTo(P(x: px, y: py), dt, 0.9); return }
        }
        stepTo(P(x: x * 2 - tg.x, y: y * 2 - tg.y), dt, 0.9)
    }

    func strafe(_ tg: Hero, _ dt: CGFloat) {
        strafeT -= dt
        if strafeT <= 0 { strafeT = 1.2; strafeSide = rnd() < 0.5 ? 1 : -1 }
        let (nx, ny) = norm(tg.x - x, tg.y - y)
        for side in [strafeSide, -strafeSide] {
            let px = x - ny * side * 20, py = y + nx * side * 20
            if !scene.nav.solidAt(px, py) && scene.nav.lineClear(x, y, px, py, 3) { strafeSide = side; stepTo(P(x: px, y: py), dt, 0.85); return }
        }
        stepTo(P(x: tg.x, y: tg.y), dt, 1)
    }

    func stepTo(_ p: P, _ dt: CGFloat, _ mul: CGFloat) {
        var (nx, ny) = norm(p.x - x, p.y - y)
        if unstickT > 0 { unstickT -= dt; moveBy(unstick.0 * s.num("speed") * dt, unstick.1 * s.num("speed") * dt); play("walk"); return }
        if !scene.nav.lineClear(x, y, p.x, p.y, max(3, r)) {
            repathT -= dt
            if path == nil || repathT <= 0 { path = scene.nav.find(x, y, p.x, p.y, maxNodes: 1500); repathT = 0.6 }
            if var pp = path, let wp = pp.first {
                if hyp(wp.x - x, wp.y - y) < 3 { pp.removeFirst(); path = pp }
                if let w2 = pp.first { (nx, ny) = norm(w2.x - x, w2.y - y) }
            }
        } else { path = nil }
        var sp = s.num("speed") * mul * slow
        if kind == "spider" { skit += dt * 8; sp *= sin(skit) > -0.35 ? 1.5 : 0.1 } // it skitters: quick dashes and dead stops
        for e in scene.enemies where e !== self && e.alive { // spread out
            let dx = x - e.x, dy = y - e.y, d = hyp(dx, dy)
            if d > 0.01 && d < 14 { nx += dx / d * 0.6; ny += dy / d * 0.6 }
        }
        (nx, ny) = norm(nx, ny)
        face(nx, ny)
        let ox = x, oy = y
        moveBy(nx * sp * dt, ny * sp * dt)
        animRate = s.num("paced") > 0 ? sp / s.num("paced") : 1 // its legs keep pace with how fast it goes
        play("walk")
        let want = sp * dt, got = hyp(x - ox, y - oy)
        stuckT = want > 0.2 && got < want * 0.25 ? stuckT + dt : max(0, stuckT - dt * 2)
        if stuckT > 0.4 {
            stuckT = 0
            let side: CGFloat = rnd() < 0.5 ? 1 : -1
            unstick = (-ny * side, nx * side); unstickT = 0.3
            path = scene.nav.find(x, y, p.x, p.y, maxNodes: 3000); repathT = 0.6
        }
    }

    func blinkAway() {
        blinkT = 5 + rnd() * 3
        for _ in 0..<10 {
            let a = rnd() * .pi * 2, rr = 50 + rnd() * 40, px = x + cos(a) * rr, py = y + sin(a) * rr
            if !scene.nav.solidAt(px, py) { scene.fx.puff(x, y, curse: true); x = px; y = py; scene.fx.puff(px, py, curse: true); Audio.shared.play("zip", pitch: 0.8); return }
        }
    }

    func spitWeb(_ tg: Hero) {
        webCd = 6
        state = "recover"; t = -0.2
        face(tg.x - x, tg.y - y)
        animKey = ""; play("windup")
        token = nil
        scene.spawnEnemyShot(from: self, to: P(x: tg.x, y: tg.y), dmg: s.num("dmg") * 0.4, kind: .web)
    }

    func beginWindup(_ tg: Hero) {
        clearZone()
        state = "windup"; t = 0
        face(tg.x - x, tg.y - y)
        let wind = s.num("windup", 0.6)
        if ranged { // telegraph: a thin aim line to where the shot will fly
            aim = P(x: tg.x, y: tg.y - 6)
            let z = Zone(x: tg.x, y: tg.y, r: 12)
            zone = z; scene.dangers.append(z)
            let l = SKShapeNode(path: linePath(x, y - 8, tg.x, tg.y - 6))
            l.strokeColor = hex(0xec6a5e); l.lineWidth = 1; l.alpha = 0.25; l.zPosition = Z.telegraph; l.isAntialiased = false
            scene.world.addChild(l); aimLine = l
            return
        }
        var zx = x, zy = y
        if s.str("zone") == "front" { let (nx, ny) = norm(tg.x - x, tg.y - y); zx += nx * 16; zy += ny * 16 }
        let z = Zone(x: zx, y: zy, r: s.num("zr", 15))
        z.src = self; z.dmg = s.num("dmg"); z.big = z.r >= 30; z.lockAt = wind * 0.5
        zone = z; scene.dangers.append(z)
        z.node = scene.fx.telegraph(zx, zy, z.r, wind)
    }

    func strike() {
        let z = zone
        clearZone()
        state = "recover"; t = 0
        if ranged {
            animKey = ""; playKey(animName("attack"), restart: true)
            if let a = aim { scene.spawnEnemyShot(from: self, to: a, dmg: s.num("dmg"), kind: s.str("shot") == "ember" ? .ember : .arrow) }
            return
        }
        guard let z else { return }
        animKey = ""; playKey(animName("attack"), restart: true)
        Audio.shared.play("swing", pitch: 0.7)
        if puppet, let m = Enemy.stepIn[kind], let tg = target { // it steps into its swing
            let d = max(0, min(m, dist(self, tg) - tg.r - r))
            let (nx, ny) = norm(tg.x - x, tg.y - y)
            lunge = (nx * d, ny * d, 1)
        }
        let dmg = s.num("dmg")
        for h in scene.party where h.alive && !h.downed {
            if hyp(h.x - z.x, h.y - z.y) > z.r + h.r { continue }
            if scene.tryEvade(h, from: self) { continue }
            h.damage(dmg, src: self, el: atkEl)
            if s.flag("chill") { h.chill() }
        }
    }
}

func linePath(_ x0: CGFloat, _ y0: CGFloat, _ x1: CGFloat, _ y1: CGFloat) -> CGPath {
    let p = CGMutablePath(); p.move(to: CGPoint(x: x0, y: -y0)); p.addLine(to: CGPoint(x: x1, y: -y1)); return p
}
