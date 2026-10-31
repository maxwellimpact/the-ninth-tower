// The HUD, laid out as the web's landscape HUD (regions.md): the party's
// frames top left (tap one to lead with that hero), the leader's buttons in
// one row along the bottom right in a gold outline tagged with their name
// (skills, ULT, DODGE), and the wave banner. Built in game pixels, inside
// the safe area.
import SpriteKit

private func box(_ w: CGFloat, _ h: CGFloat, fill: UIColor = hex(0x16121f, 0.82), stroke: UIColor = hex(0x45405e)) -> SKShapeNode {
    let n = SKShapeNode(rect: CGRect(x: 0, y: 0, width: w, height: h))
    n.fillColor = fill; n.strokeColor = stroke; n.lineWidth = 1; n.isAntialiased = false
    return n
}

private final class Bar: SKNode {
    let w: CGFloat
    private let fg: SKSpriteNode
    init(w: CGFloat, h: CGFloat, color: UIColor) {
        self.w = w
        fg = SKSpriteNode(color: color, size: CGSize(width: w, height: h))
        super.init()
        let bg = SKSpriteNode(color: hex(0x2b2140), size: CGSize(width: w, height: h)); bg.anchorPoint = .zero
        fg.anchorPoint = .zero
        addChild(bg); addChild(fg)
    }
    required init?(coder: NSCoder) { fatalError() }
    func set(_ f: CGFloat, color: UIColor? = nil) {
        fg.size.width = (w * clamp(f, 0, 1)).rounded()
        if let color { fg.color = color }
    }
}

private final class Frame: SKNode {
    let hero: Hero
    let rect: CGRect
    let outline: SKShapeNode
    let portrait: SKSpriteNode
    let hp: Bar, ult: Bar, shield: Bar
    let label: PixelText
    init(hero: Hero, at p: CGPoint) {
        self.hero = hero
        rect = CGRect(x: p.x, y: p.y, width: 72, height: 20)
        outline = box(72, 20)
        portrait = SKSpriteNode(texture: Assets.shared.tex(hero.portrait))
        hp = Bar(w: 48, h: 3, color: hex(0x8cd36a)); ult = Bar(w: 48, h: 2, color: hex(0x6f93e0)); shield = Bar(w: 48, h: 1, color: hex(0x9fe8ff))
        label = PixelText(hero.name.uppercased(), font: "fontPlain")
        super.init()
        position = p
        addChild(outline)
        portrait.anchorPoint = .zero; portrait.position = CGPoint(x: 2, y: 2); addChild(portrait)
        label.position = CGPoint(x: 21 + PixelText.width(hero.name) / 2, y: 14); addChild(label)
        hp.position = CGPoint(x: 21, y: 6); addChild(hp)
        ult.position = CGPoint(x: 21, y: 3); addChild(ult)
        shield.position = CGPoint(x: 21, y: 9); addChild(shield)
    }
    required init?(coder: NSCoder) { fatalError() }
    func update(_ clock: CGFloat) {
        let h = hero
        let f = h.hp / h.maxHp
        hp.set(f, color: f < 0.3 ? hex(0xec6a5e) : f < 0.6 ? hex(0xf2c14e) : hex(0x8cd36a))
        shield.set(h.shield / h.maxHp); shield.isHidden = h.shield <= 0
        let full = h.ult >= 100
        ult.set(h.ult / 100, color: full ? (Int(clock * 6) % 2 == 0 ? hex(0xfff0a0) : hex(0xf2c14e)) : hex(0x6f93e0))
        outline.strokeColor = h.isLeader ? hex(0xf2c14e) : hex(0x45405e)
        outline.lineWidth = h.isLeader ? 1 : 1
        alpha = h.downed ? 0.5 : 1
    }
}

private final class Button: SKNode {
    let rect: CGRect
    let icon: SKSpriteNode
    let shade = SKSpriteNode(color: UIColor(white: 0, alpha: 0.62), size: CGSize(width: 22, height: 22))
    let frameBox: SKShapeNode
    let cdText = PixelText("")
    let action: () -> Void
    init(at p: CGPoint, icon: String, action: @escaping () -> Void) {
        rect = CGRect(x: p.x, y: p.y, width: 24, height: 24)
        self.icon = SKSpriteNode(texture: Assets.shared.tex(icon))
        frameBox = box(24, 24)
        self.action = action
        super.init()
        position = p
        addChild(frameBox)
        self.icon.position = CGPoint(x: 12, y: 12); addChild(self.icon)
        shade.anchorPoint = .zero; shade.position = CGPoint(x: 1, y: 1); addChild(shade)
        cdText.position = CGPoint(x: 12, y: 12); addChild(cdText)
    }
    required init?(coder: NSCoder) { fatalError() }
    func setIcon(_ key: String) { icon.texture = Assets.shared.tex(key) }
    // f: share of the cooldown left (0 = ready)
    func set(cooldown f: CGFloat, secs: CGFloat, ready: Bool = true) {
        shade.size.height = (22 * clamp(f, 0, 1)).rounded()
        shade.isHidden = f <= 0
        cdText.set(f > 0 && secs >= 1 ? "\(Int(secs.rounded(.up)))" : "", font: "font")
        icon.alpha = ready ? 1 : 0.45
    }
    func pressFlash() {
        frameBox.strokeColor = .white
        run(.sequence([.wait(forDuration: 0.1), .run { [weak self] in self?.frameBox.strokeColor = hex(0x45405e) }]))
    }
}

final class HUD: SKNode {
    unowned let battle: BattleScene
    private var frames: [Frame] = []
    private var buttons: [Button] = []
    private let skill0: Button, skill1: Button, ultB: Button, dodgeB: Button
    private let group: SKShapeNode
    private let groupLabel = PixelText("", font: "fontGold")
    private let waveText = PixelText("", font: "fontPlain")
    private let bannerNode = SKNode()
    private var shownLeader = ""

    init(scene: BattleScene) {
        self.battle = scene
        let W = scene.size.width, H = scene.size.height, S = scene.safe
        let left = -W / 2 + S.left + 4, top = H / 2 - S.top - 4
        let right = W / 2 - S.right - 4, bottom = -H / 2 + max(S.bottom, 2) + 4
        skill0 = Button(at: CGPoint(x: right - 24 * 4 - 9, y: bottom), icon: "icon_bash") { [unowned scene] in scene.leaderSkill(0) }
        skill1 = Button(at: CGPoint(x: right - 24 * 3 - 6, y: bottom), icon: "icon_taunt") { [unowned scene] in scene.leaderSkill(1) }
        ultB = Button(at: CGPoint(x: right - 24 * 2 - 3, y: bottom), icon: "icon_bulwark") { [unowned scene] in scene.leaderUlt() }
        dodgeB = Button(at: CGPoint(x: right - 24, y: bottom), icon: "icon_dodge") { [unowned scene] in scene.leaderDodge() }
        group = box(24 * 4 + 9 + 6, 24 + 6, fill: .clear, stroke: hex(0xf2c14e))
        group.position = CGPoint(x: right - 24 * 4 - 12, y: bottom - 3)
        super.init()
        zPosition = 500
        for (i, h) in scene.party.enumerated() {
            let f = Frame(hero: h, at: CGPoint(x: left, y: top - 20 - CGFloat(i) * 23))
            frames.append(f); addChild(f)
        }
        addChild(group)
        groupLabel.position = CGPoint(x: right - 24 * 4 - 12 + 2, y: bottom + 24 + 8)
        addChild(groupLabel)
        buttons = [skill0, skill1, ultB, dodgeB]
        buttons.forEach { addChild($0) }
        waveText.position = CGPoint(x: 0, y: top - 4)
        addChild(waveText)
        addChild(bannerNode)
    }
    required init?(coder: NSCoder) { fatalError() }

    // a touch in camera space: true if the HUD took it
    func press(at p: CGPoint) -> Bool {
        for f in frames where f.rect.insetBy(dx: -2, dy: -2).contains(p) { battle.setLeader(f.hero); return true }
        for b in buttons where b.rect.insetBy(dx: -3, dy: -3).contains(p) { b.pressFlash(); b.action(); return true }
        return false
    }

    func banner(_ title: String, sub: String) {
        bannerNode.removeAllChildren()
        let t = PixelText(title, font: "fontGold"); t.setScale(2); t.position = CGPoint(x: 0, y: 26)
        let s = PixelText(sub, font: "fontPlain"); s.position = CGPoint(x: 0, y: 10)
        bannerNode.addChild(t); bannerNode.addChild(s)
        bannerNode.alpha = 1
        bannerNode.removeAllActions()
        bannerNode.run(.sequence([.wait(forDuration: 1.8), .fadeOut(withDuration: 0.5)]))
    }

    func update() {
        frames.forEach { $0.update(battle.clock) }
        guard let L = battle.leader else { return }
        if shownLeader != L.id {
            shownLeader = L.id
            groupLabel.set(L.name.uppercased(), font: "fontGold")
            groupLabel.position.x = group.position.x + 2 + PixelText.width(L.name) / 2
            skill0.setIcon(L.skills[0].def.str("icon") ?? "icon_bash")
            skill1.setIcon(L.skills[1].def.str("icon") ?? "icon_taunt")
            ultB.setIcon(GameData.skills.obj(L.ultId).str("icon") ?? "icon_bulwark")
        }
        for (i, b) in [skill0, skill1].enumerated() {
            let s = L.skills[i]
            b.set(cooldown: s.t / s.cd, secs: s.t, ready: !L.downed)
        }
        ultB.set(cooldown: 1 - L.ult / 100, secs: 0, ready: L.ult >= 100)
        ultB.frameBox.strokeColor = L.ult >= 100 ? (Int(battle.clock * 6) % 2 == 0 ? hex(0xfff0a0) : hex(0xf2c14e)) : hex(0x45405e)
        dodgeB.set(cooldown: L.dodgeCd / 0.55, secs: 0)
        let left = battle.enemies.filter { $0.alive }.count
        waveText.set(left > 0 ? "FOES \(left)" : "", font: "fontPlain")
    }
}
