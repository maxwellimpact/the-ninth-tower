// The performance readout (two-finger tap anywhere): frames a second against
// the screen's own rate, the average and worst time between frames, how many
// frames ran late (a hitch: half again the frame budget or more), the game's
// own CPU time a frame (update), and nodes on the field. +20 FOES adds a pack
// to push it, as tools/perf.js pushes the web build on the dense Vast.
// Launched with -perfLog (xcrun devicectl ... process launch --console), it
// also prints the numbers every two seconds and adds a pack every ten, up to
// three, so a run on the phone can be read from the Mac.
import SpriteKit

final class PerfOverlay: SKNode {
    unowned let battle: BattleScene
    private var lines: [PixelText] = []
    private let panel: SKShapeNode
    private let button: SKShapeNode
    private let buttonRect: CGRect
    private var intervals: [CGFloat] = [], cpus: [CGFloat] = []
    private var refreshT: CGFloat = 0
    private let target = CGFloat(UIScreen.main.maximumFramesPerSecond)
    private let log = ProcessInfo.processInfo.arguments.contains("-perfLog")
    private var logIntervals: [CGFloat] = [], logCpus: [CGFloat] = []
    private var logT: CGFloat = 0, runT: CGFloat = 0, packs = 0

    init(scene: BattleScene) {
        battle = scene
        let W: CGFloat = 132, H: CGFloat = 50
        let x = -W / 2, y = scene.size.height / 2 - scene.safe.top - 14 - H
        panel = SKShapeNode(rect: CGRect(x: x, y: y, width: W, height: H))
        panel.fillColor = UIColor(white: 0, alpha: 0.72); panel.strokeColor = hex(0x45405e); panel.isAntialiased = false
        buttonRect = CGRect(x: -26, y: y - 15, width: 52, height: 13)
        button = SKShapeNode(rect: buttonRect)
        button.fillColor = hex(0x2b2140); button.strokeColor = hex(0xf2c14e); button.isAntialiased = false
        super.init()
        zPosition = 800
        isHidden = true
        addChild(panel); addChild(button)
        for i in 0..<5 {
            let t = PixelText("", font: "fontPlain"); t.position = CGPoint(x: 0, y: y + H - 7 - CGFloat(i) * 9)
            lines.append(t); addChild(t)
        }
        let b = PixelText("+20 FOES", font: "fontGold"); b.position = CGPoint(x: 0, y: buttonRect.midY)
        addChild(b)
    }
    required init?(coder: NSCoder) { fatalError() }

    func toggle() { isHidden.toggle(); Haptics.tap() }

    func press(at p: CGPoint) -> Bool {
        guard !isHidden, buttonRect.insetBy(dx: -4, dy: -4).contains(p) else { return false }
        stress()
        Haptics.tap()
        return true
    }

    private func stress() { battle.spawnPack([("goblin", 6), ("archer", 3), ("frostwolf", 4), ("imp", 3), ("spider", 4)], level: 5) }

    func noteInterval(_ s: CGFloat) { intervals.append(s); if log { logIntervals.append(s) } }
    func noteFrame(cpu: CGFloat) { cpus.append(cpu); if log { logCpus.append(cpu) } }

    private func logTick(_ dt: CGFloat) {
        runT += dt; logT += dt
        if runT > CGFloat(10 * (packs + 1)) && packs < 3 { packs += 1; stress() }
        guard logT >= 2, !logIntervals.isEmpty else { return }
        logT = 0
        let sum = logIntervals.reduce(0, +), worst = logIntervals.max() ?? 0
        let late = logIntervals.filter { $0 > 1.5 / target }.count
        let cpu = logCpus.reduce(0, +) / CGFloat(max(1, logCpus.count)), cpuMax = logCpus.max() ?? 0
        print(String(format: "[perf] t=%.0fs fps=%.1f/%d avg=%.2fms worst=%.2fms late=%d/%d update=%.2fms max=%.2fms foes=%d",
                     runT, CGFloat(logIntervals.count) / sum, Int(target), sum / CGFloat(logIntervals.count) * 1000, worst * 1000, late, logIntervals.count, cpu * 1000, cpuMax * 1000, battle.enemies.count))
        logIntervals.removeAll(keepingCapacity: true); logCpus.removeAll(keepingCapacity: true)
    }

    func update(_ dt: CGFloat) {
        if log { logTick(dt) }
        refreshT -= dt
        guard refreshT <= 0 else { return }
        refreshT = 0.5
        defer { intervals.removeAll(keepingCapacity: true); cpus.removeAll(keepingCapacity: true) }
        guard !isHidden, !intervals.isEmpty else { return }
        let sum = intervals.reduce(0, +), avg = sum / CGFloat(intervals.count), worst = intervals.max() ?? 0
        let late = intervals.filter { $0 > 1.5 / target }.count
        let cpu = cpus.reduce(0, +) / CGFloat(max(1, cpus.count)), cpuMax = cpus.max() ?? 0
        var nodes = 0
        battle.world.enumerateChildNodes(withName: "//*") { _, _ in nodes += 1 }
        let ms = { (v: CGFloat) in String(format: "%.1f", v * 1000) }
        lines[0].set("FPS \(Int((CGFloat(intervals.count) / sum).rounded())) OF \(Int(target))", font: "fontGold")
        lines[1].set("FRAME \(ms(avg))MS  WORST \(ms(worst))", font: "fontPlain")
        lines[2].set("LATE FRAMES \(late) / \(intervals.count)", font: "fontPlain", tint: late > 0 ? hex(0xffb08a) : nil)
        lines[3].set("UPDATE \(ms(cpu))MS  MAX \(ms(cpuMax))", font: "fontPlain")
        lines[4].set("FOES \(battle.enemies.count)  NODES \(nodes)", font: "fontPlain")
    }
}
