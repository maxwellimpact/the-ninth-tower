// A hero or a foe on the field: position, knockback, facing, its sprite and
// animation. Ported from Unit in game/units.js; positions are the web's
// (pixels, y down) and only sync() turns them into SpriteKit's space.
import SpriteKit

class Unit: Positioned {
    unowned let scene: BattleScene
    var x: CGFloat, y: CGFloat
    var r: CGFloat
    var maxHp: CGFloat, hp: CGFloat
    var alive = true
    var kx: CGFloat = 0, ky: CGFloat = 0
    var view = "down", flip = false
    let team: String

    let sheet: Sheet
    let sprite = SKSpriteNode()
    let overlay = SKSpriteNode()   // the white silhouette, for flashes
    let shadow: SKSpriteNode
    var animKey = ""
    private var anim: Anim?
    private var animT: CGFloat = 0
    var animRate: CGFloat = 1
    private var frameName = ""
    var flashT: CGFloat = 0
    var statusTint: UIColor?
    var alpha: CGFloat = 1
    var lift: CGFloat = 0 // drawn this much higher than it stands (a flier)
    var scaleMul: CGFloat = 1

    init(scene: BattleScene, x: CGFloat, y: CGFloat, sheet: String, maxHp: CGFloat, team: String, r: CGFloat, shadow: String = "shadow") {
        self.scene = scene
        self.x = x; self.y = y; self.r = r
        self.maxHp = maxHp; self.hp = maxHp
        self.team = team
        self.sheet = Assets.shared.sheet(sheet)
        self.shadow = SKSpriteNode(texture: Assets.shared.tex(shadow))
        self.shadow.alpha = 0.2
        self.shadow.zPosition = Z.shadow
        sprite.anchorPoint = CGPoint(x: 0.5, y: 0.25) // the web's origin (0.5, 0.75), y flipped
        overlay.anchorPoint = sprite.anchorPoint
        overlay.isHidden = true
        overlay.colorBlendFactor = 1
        sprite.addChild(overlay)
        overlay.zPosition = 0.01
        scene.world.addChild(self.shadow)
        scene.world.addChild(sprite)
    }

    func face(_ dx: CGFloat, _ dy: CGFloat) {
        if abs(dx) < 0.01 && abs(dy) < 0.01 { return }
        // hysteresis: near-diagonal headings keep the current view (flipping reads as twitching)
        let k: CGFloat = view == "side" ? 0.75 : 1.35
        if abs(dx) > abs(dy) * k { view = "side"; flip = dx < 0 } else { view = dy > 0 ? "down" : "up" }
    }

    func facingVec() -> (CGFloat, CGFloat) { view == "side" ? (flip ? -1 : 1, 0) : (0, view == "down" ? 1 : -1) }

    func flash(_ ms: CGFloat = 70, _ color: UIColor = .white) {
        flashT = ms / 1000
        overlay.color = color
        overlay.isHidden = false
    }

    func knock(_ dx: CGFloat, _ dy: CGFloat, _ power: CGFloat) {
        let (nx, ny) = norm(dx, dy)
        kx += nx * power; ky += ny * power
    }

    func physics(_ dt: CGFloat) {
        guard kx != 0 || ky != 0 else { return }
        moveBy(kx * dt, ky * dt)
        let decay = pow(0.0005, dt)
        kx *= decay; ky *= decay
        if abs(kx) < 2 { kx = 0 }
        if abs(ky) < 2 { ky = 0 }
    }

    func moveBy(_ dx: CGFloat, _ dy: CGFloat) {
        let nav = scene.nav, r = self.r
        func clear(_ x: CGFloat, _ y: CGFloat) -> Bool {
            !nav.solidAt(x - r, y - r * 0.6) && !nav.solidAt(x + r, y - r * 0.6) && !nav.solidAt(x - r, y + r * 0.6) && !nav.solidAt(x + r, y + r * 0.6)
        }
        func free(_ x: CGFloat, _ y: CGFloat) -> Bool { clear(x, y) || (!clear(self.x, self.y) && !nav.solidAt(x, y)) }
        if free(x + dx, y) { x += dx }
        if free(x, y + dy) { y += dy }
    }

    // ---- animation (the web plays `${anim}_${view}`; frames advance on the game clock)
    func playKey(_ key: String, restart: Bool = false) {
        if key == animKey && !restart { return }
        guard let a = sheet.anims[key] ?? sheet.anims[key.replacingOccurrences(of: "_up", with: "_down")] ?? sheet.anims[key.components(separatedBy: "_").first! + "_side"] else { return }
        animKey = key; anim = a; animT = 0
        setFrame(a.names.first ?? "")
    }

    func hold(_ frame: String, key: String) { animKey = key; anim = nil; setFrame(frame) }

    func setFrame(_ name: String) {
        guard name != frameName else { return }
        frameName = name
        let (t, s) = sheet.frame(name)
        sprite.texture = t; sprite.size = t.size()
        overlay.texture = s; overlay.size = t.size()
    }

    var animDone: Bool {
        guard let a = anim else { return true }
        return !a.loop && animT * a.fps >= CGFloat(a.names.count)
    }

    func tickAnim(_ dt: CGFloat) {
        guard let a = anim, !a.names.isEmpty else { return }
        animT += dt * animRate
        var i = Int(animT * a.fps)
        i = a.loop ? i % a.names.count : min(i, a.names.count - 1)
        setFrame(a.names[i])
    }

    func sync(_ dt: CGFloat) {
        tickAnim(dt)
        if flashT > 0 { flashT -= dt; if flashT <= 0 { overlay.isHidden = true } }
        sprite.position = CGPoint(x: x.rounded(), y: -(y - lift).rounded())
        sprite.xScale = (flip ? -1 : 1) * scaleMul
        sprite.yScale = scaleMul
        sprite.zPosition = y
        sprite.alpha = alpha
        if let t = statusTint { sprite.color = t; sprite.colorBlendFactor = 1 } else { sprite.colorBlendFactor = 0 }
        shadow.position = CGPoint(x: x.rounded() + 1, y: -y.rounded() - 1)
    }

    func destroy() {
        sprite.removeFromParent()
        shadow.removeFromParent()
    }
}

// Draw order. The world sorts by y (a unit's feet); these sit beneath or above it.
enum Z {
    static let ground: CGFloat = -100_000
    static let decal: CGFloat = -50_000
    static let telegraph: CGFloat = -40_000
    static let shadow: CGFloat = -30_000
    static let top: CGFloat = 100_000
}
