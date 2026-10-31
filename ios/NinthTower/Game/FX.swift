// Visual effects (game/fx.js): particle bursts, hit stars, afterimages, puffs,
// rings, the "!" of a foe noticing you, and the red ground telegraph that
// fills as a blow winds up. Everything runs on the game clock, so the game
// speed and hit-stop slow it with the fight.
import SpriteKit

enum Burst { case spark, ember, curse, heal, gold, foam }

final class FX {
    unowned let scene: BattleScene
    private struct Particle { let node: SKSpriteNode; var x, y, vx, vy: CGFloat; let g: CGFloat; var life: CGFloat; let max: CGFloat; let fade: Bool }
    private var parts: [Particle] = []
    private var tweens: [(t: CGFloat, dur: CGFloat, step: (CGFloat) -> Void, done: (() -> Void)?)] = []

    init(scene: BattleScene) { self.scene = scene }

    func tween(_ dur: CGFloat, _ step: @escaping (CGFloat) -> Void, done: (() -> Void)? = nil) {
        step(0)
        tweens.append((0, max(0.001, dur), step, done))
    }

    func update(_ dt: CGFloat) {
        var i = 0
        while i < parts.count {
            parts[i].life -= dt
            if parts[i].life <= 0 { parts[i].node.removeFromParent(); parts.swapAt(i, parts.count - 1); parts.removeLast(); continue }
            parts[i].vy += parts[i].g * dt
            parts[i].x += parts[i].vx * dt; parts[i].y += parts[i].vy * dt
            parts[i].node.position = CGPoint(x: parts[i].x.rounded(), y: -parts[i].y.rounded())
            if parts[i].fade { parts[i].node.alpha = parts[i].life / parts[i].max }
            i += 1
        }
        let list = tweens
        tweens.removeAll()
        var keep: [(t: CGFloat, dur: CGFloat, step: (CGFloat) -> Void, done: (() -> Void)?)] = []
        for var tw in list {
            tw.t += dt
            let p = min(1, tw.t / tw.dur)
            tw.step(p)
            if p >= 1 { tw.done?() } else { keep.append(tw) }
        }
        tweens = keep + tweens // (tweens started during this pass)
    }

    func burst(_ kind: Burst, _ x: CGFloat, _ y: CGFloat, _ n: Int) {
        for _ in 0..<n {
            let a = rnd() * .pi * 2
            var tex = "px_white", sp: ClosedRange<CGFloat> = 40...110, life: ClosedRange<CGFloat> = 0.22...0.22, g: CGFloat = 120, fade = false
            var tints: [UInt32] = []
            var vx: CGFloat? = nil, vy: CGFloat? = nil, ox: CGFloat = 0
            switch kind {
            case .spark: break
            case .ember: tex = "px_fireL"; sp = 30...90; life = 0.2...0.45; g = -40; tints = [0xffd04a, 0xff7b2e, 0xffffff]
            case .curse: tex = "px_curseL"; sp = 20...70; life = 0.3...0.7; g = -30
            case .heal: tex = "px_grassXL"; life = 0.6...0.6; g = 0; fade = true; vy = -(20 + rnd() * 20); vx = rnd() * 20 - 10; ox = rnd() * 16 - 8
            case .gold: tex = "px_goldL"; sp = 30...100; life = 0.5...0.5; g = 80
            case .foam: tex = "px_foam"; sp = 10...30; life = 0.3...0.3; g = 0
            }
            let s = CGFloat.random(in: sp)
            let n = SKSpriteNode(texture: Assets.shared.tex(tex))
            n.zPosition = Z.top - 10
            if let c = tints.randomElement() { n.color = hex(c); n.colorBlendFactor = 1 }
            scene.world.addChild(n)
            let l = CGFloat.random(in: life)
            parts.append(Particle(node: n, x: x + ox, y: y, vx: vx ?? cos(a) * s, vy: vy ?? sin(a) * s, g: g, life: l, max: l, fade: fade))
        }
    }

    // a one-shot animation at a spot (hit star, dust)
    func oneShot(_ key: String, _ x: CGFloat, _ y: CGFloat, z: CGFloat, scale: CGFloat = 1) {
        let sh = Assets.shared.sheet(key)
        guard let a = sh.anims[key] else { return }
        let n = SKSpriteNode(texture: sh.frame(a.names[0]).0)
        n.position = CGPoint(x: x.rounded(), y: -y.rounded()); n.zPosition = z; n.setScale(scale)
        scene.world.addChild(n)
        tween(CGFloat(a.names.count) / a.fps, { p in
            let i = min(a.names.count - 1, Int(p * CGFloat(a.names.count)))
            let t = sh.frame(a.names[i]).0; n.texture = t; n.size = CGSize(width: t.size().width * scale, height: t.size().height * scale)
        }, done: { n.removeFromParent() })
    }

    func hit(_ x: CGFloat, _ y: CGFloat, crit: Bool) {
        oneShot("hitstar", x, y, z: Z.top, scale: crit ? 1.4 : 1)
        burst(.spark, x, y, crit ? 10 : 5)
    }

    func dust(_ x: CGFloat, _ y: CGFloat) { oneShot("dust", x, y - 2, z: y - 1) }

    // an afterimage: the unit's silhouette, tinted, fading
    func ghost(_ u: Unit, x: CGFloat? = nil, y: CGFloat? = nil, tint: UIColor = hex(0x8fb6ff), alpha: CGFloat = 0.55, dur: CGFloat = 0.2) {
        guard let t = u.overlay.texture else { return }
        let g = SKSpriteNode(texture: t)
        g.anchorPoint = u.sprite.anchorPoint
        g.color = tint; g.colorBlendFactor = 1
        g.position = CGPoint(x: (x ?? u.x).rounded(), y: -((y ?? u.y) - u.lift).rounded())
        g.xScale = u.flip ? -1 : 1
        g.zPosition = (y ?? u.y) - 1
        scene.world.addChild(g)
        tween(dur, { p in g.alpha = alpha * (1 - p) }, done: { g.removeFromParent() })
    }

    func puff(_ x: CGFloat, _ y: CGFloat, curse: Bool = false) {
        let dot = curse ? "px2_curseL" : "px2_mist"
        for i in 0..<8 {
            let a = CGFloat(i) / 8 * .pi * 2
            let p = SKSpriteNode(texture: Assets.shared.tex(dot)); p.zPosition = Z.top - 5
            scene.world.addChild(p)
            tween(0.28, { k in
                p.position = CGPoint(x: (x + cos(a) * (5 + 9 * k)).rounded(), y: -(y - 8 + sin(a) * (4 + 5 * k)).rounded()); p.alpha = 1 - k
            }, done: { p.removeFromParent() })
        }
        let s = SKSpriteNode(texture: Assets.shared.tex(curse ? "sparkCurse" : "spark")); s.zPosition = Z.top - 5
        s.position = CGPoint(x: x, y: -(y - 8)); scene.world.addChild(s)
        tween(0.2, { k in s.setScale(2 * (1 - k)) }, done: { s.removeFromParent() })
    }

    func ring(_ x: CGFloat, _ y: CGFloat, _ tex: String, _ scale: CGFloat = 4) {
        let r = SKSpriteNode(texture: Assets.shared.tex(tex)); r.zPosition = Z.telegraph + 1
        r.position = CGPoint(x: x, y: -y); scene.world.addChild(r)
        tween(0.38, { k in r.setScale(0.5 + (scale - 0.5) * k); r.alpha = 1 - k }, done: { r.removeFromParent() })
    }

    func alert(_ u: Unit) {
        let t = PixelText("!", font: "fontGold"); t.zPosition = Z.top
        scene.world.addChild(t)
        tween(0.54, { k in
            let up = k < 0.3 ? k / 0.3 : k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3
            t.position = CGPoint(x: u.x.rounded(), y: -(u.y - 26 - 6 * up).rounded())
        }, done: { t.removeFromParent() })
    }

    // the ground telegraph: an outline at once, filling as the wind-up completes
    func telegraph(_ x: CGFloat, _ y: CGFloat, _ r: CGFloat, _ dur: CGFloat) -> SKShapeNode {
        let holder = SKShapeNode(ellipseOf: CGSize(width: r * 2, height: r * 1.3))
        holder.strokeColor = hex(0xec6a5e, 0.9); holder.lineWidth = 1; holder.fillColor = .clear
        holder.isAntialiased = false
        holder.position = CGPoint(x: x, y: -y); holder.zPosition = Z.telegraph
        let fill = SKShapeNode(ellipseOf: CGSize(width: r * 2, height: r * 1.3))
        fill.strokeColor = .clear; fill.fillColor = hex(0xc0394b); fill.isAntialiased = false
        holder.addChild(fill)
        scene.world.addChild(holder)
        tween(dur, { [weak fill] p in fill?.setScale(max(0.01, p)); fill?.alpha = 0.18 + p * 0.22 })
        return holder
    }

    func slam(_ x: CGFloat, _ y: CGFloat, _ r: CGFloat) {
        ring(x, y, "ringRed", r / 8 * 1.2)
        burst(.curse, x, y, 8)
        scene.shake(0.06, 0.003)
    }
}
