// The battle: the Training Grounds (exported from the web build), the party,
// waves of foes of each element, and the rules that join them: damage and
// elements (Game.dealDamage), evasion, projectiles, ultimates, hit-stop and
// shake. Touch: tap the ground to move, tap a foe to attack, flick to dodge,
// hold and drag to steer; tap a portrait to lead with that hero.
import SpriteKit

enum ShotKind { case bolt, fireball, knife, arrow, ember, web }

final class Projectile {
    let owner: Hero
    var x, y, vx, vy: CGFloat
    let dmg: CGFloat
    let kind: ShotKind
    weak var target: Enemy?
    let element: String?
    let spell: Bool, basic: Bool
    let aoe: CGFloat
    var life: CGFloat
    var trail: CGFloat = 0
    var node: SKSpriteNode?
    init(owner: Hero, x: CGFloat, y: CGFloat, vx: CGFloat, vy: CGFloat, dmg: CGFloat, kind: ShotKind, target: Enemy? = nil, element: String? = nil, spell: Bool = false, basic: Bool = false, aoe: CGFloat = 0, life: CGFloat = 1.2) {
        self.owner = owner; self.x = x; self.y = y; self.vx = vx; self.vy = vy; self.dmg = dmg; self.kind = kind
        self.target = target; self.element = element; self.spell = spell; self.basic = basic; self.aoe = aoe; self.life = life
    }
}

final class EnemyShot {
    weak var from: Enemy?
    let level: CGFloat
    var x, y, vx, vy: CGFloat
    let dmg: CGFloat
    let kind: ShotKind
    var life: CGFloat
    let node: SKSpriteNode
    init(from: Enemy, x: CGFloat, y: CGFloat, vx: CGFloat, vy: CGFloat, dmg: CGFloat, kind: ShotKind, life: CGFloat, node: SKSpriteNode) {
        self.from = from; level = from.level; self.x = x; self.y = y; self.vx = vx; self.vy = vy; self.dmg = dmg; self.kind = kind; self.life = life; self.node = node
    }
}

final class BattleScene: SKScene {
    let world = SKNode()
    let cam = SKCameraNode()
    let nav: Nav
    let mapW: CGFloat, mapH: CGFloat
    let zoom: CGFloat
    let safe: UIEdgeInsets
    var party: [Hero] = []
    var leader: Hero? { party.first { $0.isLeader } }
    var enemies: [Enemy] = []
    var dangers: [Zone] = []
    var projectiles: [Projectile] = []
    var shots: [EnemyShot] = []
    private(set) var fx: FX!
    private var hud: HUD!
    var clock: CGFloat = 0
    private var timers: [(at: CGFloat, fn: () -> Void)] = []
    private var lastTime: TimeInterval?
    private var hitStopT: CGFloat = 0
    private var lastHitStop: CGFloat = -1
    private var shakeT: CGFloat = 0, shakeAmt: CGFloat = 0
    private var camPos = CGPoint.zero
    private let flashNode = SKSpriteNode(color: .white, size: .zero)
    private let marker = SKSpriteNode()
    // waves
    private var wave = 0, round = 0
    private var between: CGFloat = 1.5
    private var fallen = false
    private let partyLevel = 6
    private static let waves: [(String, [(String, Int)])] = [
        ("GOBLIN RAIDERS", [("goblin", 3), ("archer", 1)]),
        ("THE FROST PACK", [("frostwolf", 3)]),
        ("EMBERS AND WEBS", [("imp", 2), ("spider", 2)]),
        ("ALL OF THEM", [("goblin", 2), ("archer", 1), ("frostwolf", 2), ("imp", 1), ("spider", 1)]),
    ]

    init(viewSize: CGSize, safe: UIEdgeInsets) {
        // the web's pixel-perfect zoom: the integer that gets the view closest to ~216 px tall
        var z = max(1, (viewSize.height / 216).rounded())
        while z > 1 && viewSize.width / z < 190 { z -= 1 }
        zoom = z
        self.safe = UIEdgeInsets(top: safe.top / z, left: safe.left / z, bottom: safe.bottom / z, right: safe.right / z)
        let m = Assets.shared.map
        nav = Nav(rows: m.strs("nav"))
        mapW = CGFloat(nav.w) * Nav.tile; mapH = CGFloat(nav.h) * Nav.tile
        super.init(size: CGSize(width: (viewSize.width / z).rounded(), height: (viewSize.height / z).rounded()))
        scaleMode = .fill
        anchorPoint = CGPoint(x: 0.5, y: 0.5)
        backgroundColor = hex(0x16121f)
        fx = FX(scene: self)
        addChild(world)
        addChild(cam); camera = cam
        buildMap(m)
        let start = m["start"] as? [NSNumber] ?? [8, 12]
        let sx = CGFloat(truncating: start[0]) * 16 + 8, sy = CGFloat(truncating: start[1]) * 16 + 8
        for (i, id) in ["brann", "pip", "sable"].enumerated() {
            party.append(Hero(scene: self, id: id, level: partyLevel, x: sx - CGFloat(i) * 14, y: sy + (i == 0 ? 0 : i == 1 ? -10 : 10)))
        }
        party[0].isLeader = true
        camPos = CGPoint(x: sx, y: sy)
        hud = HUD(scene: self)
        cam.addChild(hud)
        flashNode.size = CGSize(width: size.width + 4, height: size.height + 4); flashNode.alpha = 0; flashNode.zPosition = 900
        cam.addChild(flashNode)
        marker.texture = Assets.shared.tex("ringGold"); marker.size = CGSize(width: 18, height: 18); marker.alpha = 0; marker.zPosition = Z.telegraph
        world.addChild(marker)
        _ = Audio.shared
        Haptics.prepare()
    }
    required init?(coder: NSCoder) { fatalError() }

    private func buildMap(_ m: JSON) {
        let g = SKSpriteNode(texture: SKTexture(image: Assets.shared.image(m.str("ground") ?? "ground.png")))
        g.texture?.filteringMode = .nearest
        g.anchorPoint = CGPoint(x: 0, y: 1); g.position = .zero; g.zPosition = Z.ground
        world.addChild(g)
        for case let p as JSON in m["props"] as? [Any] ?? [] {
            guard let tex = p.str("tex") else { continue }
            let sheet = Assets.shared.sheet(tex)
            let n = SKSpriteNode(texture: sheet.frame(p.str("frame")).0)
            n.anchorPoint = CGPoint(x: p.num("ox", 0.5), y: 1 - p.num("oy", 0.5))
            n.position = CGPoint(x: p.num("x").rounded(), y: -p.num("y").rounded())
            n.xScale = p.num("sx", 1) * (p.flag("flip") ? -1 : 1); n.yScale = p.num("sy", 1)
            n.alpha = p.num("alpha", 1)
            let d = p.num("depth")
            n.zPosition = d < -200 ? Z.decal + d : d // (ground decals were drawn below everything standing)
            if let t = p["tint"] as? NSNumber { n.color = hex(UInt32(truncating: t)); n.colorBlendFactor = 1 }
            if let a = p.str("anim").flatMap({ sheet.anims[$0] }) { // flickering campfires, swaying tufts
                let frames = a.names.map { sheet.frame($0).0 }
                n.run(.repeatForever(.animate(with: frames, timePerFrame: 1 / (a.fps * GameData.speed))))
            }
            world.addChild(n)
        }
    }

    func resetClock() { lastTime = nil }

    // ---- the clock (game time: scaled by the game speed, frozen by hit-stop)
    func after(_ s: CGFloat, _ fn: @escaping () -> Void) { timers.append((clock + s, fn)) }
    func hitStop(_ t: CGFloat) { hitStopT = max(hitStopT, t) }
    func shake(_ t: CGFloat, _ amt: CGFloat) { shakeT = max(shakeT, t); shakeAmt = max(shakeAmt, amt) }

    override func update(_ currentTime: TimeInterval) {
        let real = CGFloat(min(0.05, currentTime - (lastTime ?? currentTime)))
        lastTime = currentTime
        if hitStopT > 0 { hitStopT -= real; hud.update(); return }
        let dt = real * GameData.speed
        clock += dt
        if !timers.isEmpty {
            let due = timers.filter { $0.at <= clock }
            timers.removeAll { $0.at <= clock }
            due.forEach { $0.fn() }
        }
        for h in party { h.update(dt) }
        for e in enemies { e.update(dt) }
        enemies.removeAll { !$0.alive }
        updateProjectiles(dt)
        updateShots(dt)
        fx.update(dt)
        updateWaves(dt)
        updateCamera(real)
        hud.update()
    }

    private func updateCamera(_ dt: CGFloat) {
        guard let L = leader else { return }
        let a = min(1, dt * 8)
        camPos.x += (L.x - camPos.x) * a; camPos.y += (L.y - 8 - camPos.y) * a
        let hw = size.width / 2, hh = size.height / 2
        var cx = mapW > size.width ? clamp(camPos.x, hw, mapW - hw) : mapW / 2
        var cy = mapH > size.height ? clamp(camPos.y, hh, mapH - hh) : mapH / 2
        if shakeT > 0 {
            shakeT -= dt
            cx += (rnd() * 2 - 1) * shakeAmt * size.width; cy += (rnd() * 2 - 1) * shakeAmt * size.height
            if shakeT <= 0 { shakeAmt = 0 }
        }
        cam.position = CGPoint(x: cx.rounded(), y: -cy.rounded())
    }

    func screenFlash(_ color: UIColor, _ t: CGFloat) {
        flashNode.color = color
        fx.tween(t, { [weak self] p in self?.flashNode.alpha = 0.6 * (1 - p) })
    }

    // ---- lookups
    func nearestHero(_ from: Positioned, _ range: CGFloat) -> Hero? {
        var best: Hero?, bd = range
        for h in party where h.alive && !h.downed && !h.zipping { let d = dist(h, from); if d < bd { bd = d; best = h } }
        return best
    }
    func nearestEnemy(_ from: Positioned, _ range: CGFloat) -> Enemy? {
        var best: Enemy?, bd = range
        for e in enemies where e.alive { let d = dist(e, from); if d < bd { bd = d; best = e } }
        return best
    }

    // where Shadow Step lands: behind the foe if it can, else round its side, only on open, reachable ground
    func landing(behind t: Enemy, from h: Hero) -> P? {
        let base = atan2(t.y - h.y, t.x - h.x)
        for off: CGFloat in [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8] {
            let r = t.r + 8, px = t.x + cos(base + off) * r, py = t.y + sin(base + off) * r
            if nav.solidAt(px - 4, py - 3) || nav.solidAt(px + 4, py - 3) || nav.solidAt(px - 4, py + 3) || nav.solidAt(px + 4, py + 3) { continue }
            if nav.find(h.x, h.y, px, py, maxNodes: 800) != nil { return P(x: px, y: py) }
        }
        return nil
    }

    // ---- damage (Game.dealDamage): every hero hit goes through here
    func dealDamage(_ src: Hero, _ target: Enemy, _ amount0: CGFloat, crit: Bool = false, knock: CGFloat = 40, element: String? = nil, spell: Bool = false, basic: Bool = false) {
        var amount = amount0
        if basic && tryEvade(target, from: src) { return } // a foe sidesteps a plain hit (skills always land)
        if basic && src.counterT > clock { src.counterT = 0; amount *= 1 + GameData.tuning.obj("evade").num("counter", 0.5); floatText(src.x, src.y - 36, "COUNTER!", font: "fontPlain", tint: hex(0x9fe8ff)) }
        amount *= target.elementMul(element)
        target.lastElement = element
        let hpBefore = target.hp
        let dealt = target.damage(amount, src: src, crit: crit, knock: knock)
        if dealt <= 0 { return }
        if let element { target.applyElement(element, src: src) }
        // ultimate charge: by the share of the foe's health taken (overkill doesn't count)
        let T = GameData.tuning, share = min(dealt, max(0, hpBefore)) / target.maxHp
        src.addUlt(clamp(share * T.num("ultPerFoe", 6), T.num("ultHitMin", 0.25), T.num("ultHitMax", 2.5)))
        fx.hit(target.x, target.y - 8, crit: crit)
        floatText(target.x + rnd() * 8 - 4, target.y - 20, "\(Int(dealt))", font: crit ? "fontGold" : "font", big: crit)
        // a tiny freeze on the leader's own hits, spaced out so a busy fight doesn't stutter
        if src.isLeader && src.direct == nil && clock - lastHitStop > 0.45 * GameData.speed { lastHitStop = clock; hitStop(crit ? 0.05 : 0.025) }
        if src.isLeader { crit ? Haptics.crit() : Haptics.hit() }
        if crit { shake(0.08, 0.004); Audio.shared.play("crit") } else { Audio.shared.play("hit") }
    }

    func tryEvade(_ u: Unit, from src: Unit?) -> Bool {
        let E = GameData.tuning.obj("evade")
        var chance: CGFloat
        if let h = u as? Hero { chance = h.downed ? 0 : h.stats.num("evade") }
        else if let e = u as? Enemy {
            chance = e.stunT > 0 || E.strs("never").contains(e.kind) ? 0 : E.strs("slippery").contains(e.kind) ? E.num("slipperyRate") : E.strs("heavy").contains(e.kind) ? E.num("heavyRate") : E.num("enemy")
        } else { chance = 0 }
        guard rnd() < chance else { return false }
        let (nx, ny) = norm(u.x - (src?.x ?? u.x), u.y - (src?.y ?? u.y - 1)), side: CGFloat = rnd() < 0.5 ? 1 : -1
        u.knock(-ny * side, nx * side, 70)
        let isHero = u is Hero
        floatText(u.x, u.y - 30, isHero ? "DODGE" : "MISS", font: "fontPlain", tint: isHero ? hex(0x9fe8ff) : hex(0xd8d3e0))
        Audio.shared.play("dodge")
        if let h = u as? Hero { h.counterT = clock + E.num("counterWindow", 1.5) }
        return true
    }

    func floatText(_ x: CGFloat, _ y: CGFloat, _ text: String, font: String = "font", tint: UIColor? = nil, big: Bool = false) {
        let t = PixelText(text, font: font, tint: tint)
        t.zPosition = Z.top + 5
        if big { t.setScale(1.5) }
        world.addChild(t)
        fx.tween(0.78, { p in
            let rise = min(1, p / 0.54), e = 1 - pow(1 - rise, 3) // Cubic.easeOut over 420ms
            t.position = CGPoint(x: x.rounded(), y: -(y - 14 * e).rounded())
            t.alpha = p < 0.67 ? 1 : 1 - (p - 0.67) / 0.33
        }, done: { t.removeFromParent() })
    }

    // ---- projectiles
    func spawnProjectile(_ p: Projectile) {
        let n: SKSpriteNode
        switch p.kind {
        case .knife: n = SKSpriteNode(texture: Assets.shared.tex("px_white")); n.xScale = 4
        case .arrow: n = SKSpriteNode(texture: Assets.shared.tex("arrow"))
        default:
            let sh = Assets.shared.sheet("firebolt"), a = sh.anims["firebolt"]!
            n = SKSpriteNode(texture: sh.frame(a.names[0]).0)
            n.run(.repeatForever(.animate(with: a.names.map { sh.frame($0).0 }, timePerFrame: 1 / (a.fps * GameData.speed))))
            if p.kind == .fireball { n.setScale(1.6) }
        }
        n.zPosition = Z.top - 20
        n.zRotation = -atan2(p.vy, p.vx)
        world.addChild(n)
        p.node = n
        projectiles.append(p)
    }

    private func updateProjectiles(_ dt: CGFloat) {
        for p in projectiles {
            p.life -= dt
            if let t = p.target, t.alive, p.kind == .bolt { // homing bolts
                let (nx, ny) = norm(t.x - p.x, t.y - 8 - p.y), sp = hyp(p.vx, p.vy)
                p.vx += (nx * sp - p.vx) * min(1, dt * 6); p.vy += (ny * sp - p.vy) * min(1, dt * 6)
            }
            p.x += p.vx * dt; p.y += p.vy * dt
            p.node?.position = CGPoint(x: p.x.rounded(), y: -p.y.rounded())
            p.node?.zRotation = -atan2(p.vy, p.vx)
            if p.kind != .knife && p.kind != .arrow { p.trail -= dt; if p.trail <= 0 { p.trail = 0.03; fx.burst(.ember, p.x - p.vx * 0.02, p.y - p.vy * 0.02, 1) } }
            let hit = enemies.first { $0.alive && hyp($0.x - p.x, $0.y - 8 - p.y) < $0.r + 5 }
            let wall = nav.wallAt(p.x, p.y + 8)
            guard hit != nil || p.life <= 0 || wall else { continue }
            p.life = -1
            p.node?.removeFromParent()
            switch p.kind {
            case .knife: if let hit { dealDamage(p.owner, hit, p.dmg, knock: 30) }
            case .fireball:
                fx.burst(.ember, p.x, p.y, 16); Audio.shared.play("fireImpact")
                for e in enemies where e.alive && hyp(e.x - p.x, e.y - 8 - p.y) < p.aoe + e.r { dealDamage(p.owner, e, p.dmg, knock: 60, element: "fire", spell: true) }
            default:
                if let hit {
                    let crit = rnd() < p.owner.stats.num("crit")
                    dealDamage(p.owner, hit, p.dmg * (crit ? GameData.critMult : 1) * (0.9 + rnd() * 0.2), crit: crit, knock: 25, element: p.element, spell: p.spell, basic: p.basic)
                } else { fx.burst(.ember, p.x, p.y, 3) }
            }
        }
        projectiles.removeAll { $0.life < 0 }
    }

    func spawnEnemyShot(from e: Enemy, to: P, dmg: CGFloat, kind: ShotKind) {
        let (nx, ny) = norm(to.x - e.x, to.y - (e.y - 8))
        var sp: CGFloat = 210
        let n: SKSpriteNode
        switch kind {
        case .ember:
            let sh = Assets.shared.sheet("firebolt"), a = sh.anims["firebolt"]!
            n = SKSpriteNode(texture: sh.frame(a.names[0]).0)
            n.run(.repeatForever(.animate(with: a.names.map { sh.frame($0).0 }, timePerFrame: 1 / (a.fps * GameData.speed))))
            sp = 150; Audio.shared.play("fireCast", pitch: 1.4)
        case .web: n = SKSpriteNode(texture: Assets.shared.tex("web0")); n.setScale(0.45); sp = 130; Audio.shared.play("squish", pitch: 1.6)
        default: n = SKSpriteNode(texture: Assets.shared.tex("arrow")); Audio.shared.play("swing", pitch: 1.6)
        }
        n.zPosition = Z.top - 21
        if kind != .web { n.zRotation = -atan2(ny, nx) }
        world.addChild(n)
        shots.append(EnemyShot(from: e, x: e.x, y: e.y - 8, vx: nx * sp, vy: ny * sp, dmg: dmg, kind: kind, life: kind == .web ? 1.8 : 1.1, node: n))
    }

    private func updateShots(_ dt: CGFloat) {
        for p in shots {
            p.life -= dt
            p.x += p.vx * dt; p.y += p.vy * dt
            p.node.position = CGPoint(x: p.x.rounded(), y: -p.y.rounded())
            let hit = party.first { $0.alive && !$0.downed && !$0.zipping && hyp($0.x - p.x, $0.y - 8 - p.y) < $0.r + 4 }
            guard hit != nil || p.life <= 0 || nav.wallAt(p.x, p.y + 8) else { continue }
            p.life = -1
            p.node.removeFromParent()
            guard let h = hit else { continue }
            if p.kind == .arrow, tryEvade(h, from: p.from) { continue } // a hero sidesteps a plain arrow
            h.damage(p.dmg, src: p.from, el: p.from?.atkEl)
            fx.burst(p.kind == .arrow ? .spark : .curse, p.x, p.y, 4)
            if p.kind == .ember { h.addBurn(p.dmg * 0.12, 3) }
            if p.kind == .web { h.slowT = 1.4; h.slowMul = 0.05; floatText(h.x, h.y - 34, "WEBBED", font: "fontPlain", tint: hex(0xc9cfe0)) }
        }
        shots.removeAll { $0.life < 0 }
    }

    // ---- ultimates (Game.useUltimate)
    @discardableResult func useUltimate(_ h: Hero) -> Bool {
        guard !h.downed, h.alive, h.ult >= 100 else { return false }
        let pool = enemies.filter { $0.alive && dist($0, h) < 190 }
        if h.ultId != "bulwark" && pool.isEmpty { floatText(h.x, h.y - 30, "NO TARGETS", font: "fontPlain"); return false }
        h.ult = 0
        Audio.shared.play("ult")
        Haptics.ult()
        hitStop(0.12)
        switch h.ultId {
        case "bulwark":
            shake(0.2, 0.008)
            fx.ring(h.x, h.y, "ringGold", 9)
            for p in party where !p.downed { p.shield = (p.maxHp * 0.35).rounded(); p.shieldT = 6; fx.ring(p.x, p.y - 8, "ringBlue", 2.5) }
            for e in enemies where e.alive && dist(e, h) < 150 { e.setTaunt(h, 5) }
            for e in enemies where e.alive && dist(e, h) < 56 { dealDamage(h, e, h.atk * 1.2, knock: 150) }
            floatText(h.x, h.y - 36, "BULWARK!", font: "fontGold", big: true)
        case "meteor":
            let ranked = pool.map { e in (e, pool.filter { dist($0, e) < 44 }.count) }.sorted { $0.1 > $1.1 }
            let t = ranked[0].0, tx = t.x, ty = t.y
            h.face(tx - h.x, ty - h.y)
            h.act("meteor", 0.6, "cast")
            let g = fx.telegraph(tx, ty, 46, 0.8)
            let sh = Assets.shared.sheet("firebolt"), a = sh.anims["firebolt"]!
            let m = SKSpriteNode(texture: sh.frame(a.names[0]).0)
            m.run(.repeatForever(.animate(with: a.names.map { sh.frame($0).0 }, timePerFrame: 1 / (a.fps * GameData.speed))))
            m.setScale(3.2); m.zPosition = Z.top - 15; m.zRotation = -atan2(180, 60)
            world.addChild(m)
            Audio.shared.play("fireCast")
            fx.tween(0.8, { [weak self] p in
                let e = p * p, mx = tx - 60 + 60 * e, my = ty - 180 + 172 * e
                m.position = CGPoint(x: mx.rounded(), y: -my.rounded())
                self?.fx.burst(.ember, mx, my, 2)
            }, done: { [weak self] in
                guard let self else { return }
                m.removeFromParent(); g.removeFromParent()
                self.shake(0.35, 0.014); self.screenFlash(hex(0xffc878), 0.12)
                Audio.shared.play("fireImpact"); Audio.shared.play("bash"); Haptics.ult()
                self.fx.burst(.ember, tx, ty, 50); self.fx.ring(tx, ty, "ringGold", 7)
                for e in self.enemies where e.alive && hyp(e.x - tx, e.y - ty) < 46 + e.r { self.dealDamage(h, e, h.atk * 6, crit: true, knock: 200) }
            })
            floatText(h.x, h.y - 36, "METEOR!", font: "fontGold", big: true)
        case "thousand_cuts":
            // paced so each cut reads on a phone: a dark streak to the next foe, a beat, the slash
            let targets = Array(pool.filter { dist($0, h) < 170 }.sorted { dist($0, h) < dist($1, h) }.prefix(5))
            let home = P(x: h.x, y: h.y), STEP: CGFloat = 0.32, SLASH: CGFloat = 0.11
            h.invuln = STEP * CGFloat(targets.count) + 0.5
            h.zipping = true
            h.action = nil
            floatText(h.x, h.y - 36, "THOUSAND CUTS!", font: "fontGold", big: true)
            func streak(_ fx0: CGFloat, _ fy0: CGFloat, _ tx: CGFloat, _ ty: CGFloat) {
                for k in 1...6 { fx.ghost(h, x: fx0 + (tx - fx0) * CGFloat(k) / 7, y: fy0 + (ty - fy0) * CGFloat(k) / 7, tint: hex(0x2a1840), alpha: 0.25 + 0.1 * CGFloat(k), dur: 0.2 + 0.045 * CGFloat(k)) }
            }
            var from = home
            for (i, e) in targets.enumerated() {
                after(STEP * CGFloat(i)) { [weak self] in
                    guard let self, e.alive else { return }
                    let side: CGFloat = from.x <= e.x ? -1 : 1, bx = e.x + side * 12, by = e.y + 2
                    streak(from.x, from.y, bx, by)
                    self.fx.puff(from.x, from.y, curse: true)
                    h.x = bx; h.y = by; h.face(-side, 0); h.animKey = ""; h.play("idle")
                    self.fx.puff(h.x, h.y, curse: true)
                    Audio.shared.play("dash", pitch: 1.1 + CGFloat(i) * 0.05)
                    from = P(x: bx, y: by)
                    self.after(SLASH) {
                        guard e.alive, h.zipping else { return }
                        h.animKey = ""; h.play("attack")
                        self.slash(e, -side)
                        Audio.shared.play("stab")
                        self.dealDamage(h, e, h.atk * 2.5, crit: true, knock: 40)
                    }
                }
            }
            after(STEP * CGFloat(targets.count) + 0.12) { [weak self] in
                streak(h.x, h.y, home.x, home.y)
                h.x = home.x; h.y = home.y; h.zipping = false; h.animKey = ""
                self?.fx.puff(h.x, h.y, curse: true)
            }
        default: break
        }
        return true
    }

    private func slash(_ e: Enemy, _ dir: CGFloat) {
        let a: CGFloat = dir > 0 ? -0.7 : 0.7, cx = e.x, cy = e.y - 10, L: CGFloat = 14
        let g = SKNode(); g.zPosition = e.y + 40
        for (w, c, l) in [(CGFloat(3), hex(0xd9b8ff, 0.9), L), (CGFloat(1), UIColor.white, L - 2)] {
            let s = SKShapeNode(path: linePath(cx - cos(a) * l, cy - sin(a) * l, cx + cos(a) * l, cy + sin(a) * l))
            s.strokeColor = c; s.lineWidth = w; s.isAntialiased = false
            g.addChild(s)
        }
        world.addChild(g)
        fx.tween(0.22, { p in g.alpha = 1 - p }, done: { g.removeFromParent() })
    }

    // ---- the party
    func setLeader(_ h: Hero) {
        guard !h.downed, !h.isLeader, !h.zipping else { return }
        for p in party { p.isLeader = false; p.command = nil; p.direct = nil }
        h.isLeader = true
        h.target = nil; h.clearPath()
        Audio.shared.play("swap")
        Haptics.tap()
        fx.ring(h.x, h.y - 4, "ringGold", 2.5)
    }

    func onHeroDowned(_ h: Hero) {
        Haptics.down()
        floatText(h.x, h.y - 34, "\(h.name) IS DOWN", font: "fontPlain", tint: hex(0xff6a6a))
        if h.isLeader, let next = party.first(where: { !$0.downed }) { h.isLeader = false; next.isLeader = true; h.command = nil; h.direct = nil }
    }

    func onEnemyKilled(_ e: Enemy) {
        Audio.shared.play("enemyDie")
        fx.burst(.curse, e.x, e.y - 8, 10)
        fx.burst(.gold, e.x, e.y - 6, 6)
    }

    // ---- waves
    private var waveActive = false

    private func updateWaves(_ dt: CGFloat) {
        if fallen { return }
        if party.allSatisfy({ $0.downed }) {
            fallen = true
            hud.banner("THE PARTY FELL", sub: "TRY THE WAVE AGAIN")
            after(3) { [weak self] in
                guard let self else { return }
                for e in self.enemies { e.alive = false; e.clearZone(); e.destroy() }
                self.enemies.removeAll()
                for p in self.party { p.revive(1); p.poison = nil; p.burn = nil }
                if self.leader == nil { self.party[0].isLeader = true }
                self.wave -= 1; self.waveActive = false; self.between = 1; self.fallen = false
            }
            return
        }
        if waveActive {
            guard enemies.isEmpty else { return }
            waveActive = false
            between = 3
            hud.banner("WAVE \(wave) CLEARED", sub: "")
            Haptics.win()
            Audio.shared.play("levelUp")
            for p in party where p.downed { p.revive(0.4) }
            return
        }
        between -= dt
        if between <= 0 { startWave() }
    }

    private func startWave() {
        let def = BattleScene.waves[wave % BattleScene.waves.count]
        if wave > 0 && wave % BattleScene.waves.count == 0 { round += 1 }
        wave += 1
        let level = partyLevel - 1 + round * 2
        hud.banner("WAVE \(wave)", sub: def.0)
        // they come through the far side of the field from the party, and come for you
        let L = leader ?? party[0]
        let farLeft = L.x > mapW / 2
        var spots: [P] = []
        for ty in 2..<(nav.h - 2) { for tx in 2..<(nav.w - 2) where !nav.isSolid(tx, ty) {
            let px = CGFloat(tx) * 16 + 8, py = CGFloat(ty) * 16 + 8
            if (farLeft ? px < 120 : px > mapW - 120) && !nav.isSolid(tx + 1, ty) && !nav.isSolid(tx, ty + 1) { spots.append(P(x: px, y: py)) }
        } }
        spots.shuffle()
        var i = 0
        for (kind, n) in def.1 { for _ in 0..<n {
            let p = spots[i % max(1, spots.count)]; i += 1
            let e = Enemy(scene: self, kind: kind, x: p.x, y: p.y, level: level)
            e.hunt = true
            enemies.append(e)
            fx.puff(p.x, p.y, curse: true)
        } }
        Audio.shared.play("aggro")
        waveActive = true
    }

    // ---- touch
    private var steer: (touch: UITouch, start: CGPoint, t0: TimeInterval, steering: Bool)?

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        for t in touches {
            let p = t.location(in: cam)
            if hud.press(at: p) { continue }
            if steer == nil { steer = (t, t.location(in: view), t.timestamp, false) }
        }
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let s = steer, touches.contains(s.touch), let L = leader else { return }
        let p = s.touch.location(in: view), dx = p.x - s.start.x, dy = p.y - s.start.y, d = hyp(dx, dy)
        if s.steering || (d > 18 && s.touch.timestamp - s.t0 > 0.2) {
            steer?.steering = true
            L.command = nil
            L.direct = d > 6 ? (dx, dy) : nil
        }
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let s = steer, touches.contains(s.touch) else { return }
        steer = nil
        guard let L = leader else { return }
        if s.steering { L.direct = nil; return }
        let p = s.touch.location(in: view), dx = p.x - s.start.x, dy = p.y - s.start.y
        if hyp(dx, dy) > 22 { L.dodge(dx, dy); return } // a flick: dodge that way
        let w = s.touch.location(in: self)
        tapWorld(w.x, -w.y)
    }

    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) {
        if let s = steer, touches.contains(s.touch) { leader?.direct = nil; steer = nil }
    }

    private func tapWorld(_ x: CGFloat, _ y: CGFloat) {
        guard let L = leader, !L.downed else { return }
        // a foe under the finger (fingers are big: generous, nearest to its body)
        if let e = enemies.filter({ $0.alive && hyp($0.x - x, $0.y - 8 - y) < 18 + $0.r }).min(by: { hyp($0.x - x, $0.y - 8 - y) < hyp($1.x - x, $1.y - 8 - y) }) {
            L.command = .attack(e, auto: false)
            L.clearPath()
            fx.ring(e.x, e.y, "ringRed", 2)
            return
        }
        guard !nav.solidAt(x, y) || nav.nearestOpen(Int(x / 16), Int(y / 16), 2) != nil else { return }
        L.command = .move
        L.pathGoal = nil
        L.setGoal(x, y)
        if L.path == nil { L.command = nil; return }
        marker.position = CGPoint(x: x.rounded(), y: -y.rounded())
        fx.tween(0.35, { [weak self] p in self?.marker.setScale(1.4 - 0.9 * p); self?.marker.alpha = 1 - p })
    }

    func leaderSkill(_ i: Int) {
        guard let L = leader, !L.downed else { return }
        var t: Enemy?
        if case .attack(let e, _) = L.command, e.alive { t = e }
        if L.useSkill(i, t) { Haptics.tap() } else { Audio.shared.play("block", pitch: 1.6, vol: 0.4) }
    }
    func leaderUlt() { if let L = leader { useUltimate(L) } }
    // the DODGE button: the way you're steering, else out of what's coming at you, else back from what you face
    func leaderDodge() {
        guard let L = leader else { return }
        if let d = L.direct { L.dodge(d.0, d.1); return }
        var ax: CGFloat = 0, ay: CGFloat = 0
        for z in dangers where hyp(L.x - z.x, L.y - z.y) < z.r + 30 { let (nx, ny) = norm(L.x - z.x, L.y - z.y); ax += nx * 2; ay += ny * 2 }
        for e in enemies where e.alive && (e.target === L || e.engaged) && dist(e, L) < 60 { let (nx, ny) = norm(L.x - e.x, L.y - e.y); ax += nx; ay += ny }
        if hyp(ax, ay) > 0.1 { L.dodge(ax, ay); return }
        let f = L.facingVec()
        L.dodge(-f.0, -f.1)
    }
}
