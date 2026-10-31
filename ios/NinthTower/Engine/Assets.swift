// Loads what tools/native-export.js pulled out of the web build: sprite
// sheets with their named frames and animations, the map, the pixel font.
// Every sheet also gets a white silhouette copy, for the web's "tint fill"
// (a hit flash, a dodge's afterimage): drawn white and tinted any colour.
import SpriteKit
import UIKit

struct Anim {
    let names: [String]
    let fps: CGFloat
    let loop: Bool
}

final class Sheet {
    let tex: SKTexture
    let sil: SKTexture
    private let rects: [String: CGRect]
    private var cache: [String: (SKTexture, SKTexture)] = [:]
    let anims: [String: Anim]
    let size: CGSize

    init(image: UIImage, frames: [String: [CGFloat]], anims: [String: Anim]) {
        tex = SKTexture(image: image)
        let fmt = UIGraphicsImageRendererFormat(); fmt.scale = 1
        let white = UIGraphicsImageRenderer(size: image.size, format: fmt).image { ctx in
            image.draw(at: .zero)
            UIColor.white.setFill()
            ctx.fill(CGRect(origin: .zero, size: image.size), blendMode: .sourceIn)
        }
        sil = SKTexture(image: white)
        tex.filteringMode = .nearest; sil.filteringMode = .nearest
        size = image.size
        var r: [String: CGRect] = [:]
        for (k, f) in frames where f.count == 4 { r[k] = CGRect(x: f[0], y: f[1], width: f[2], height: f[3]) }
        rects = r
        self.anims = anims
    }

    // a frame (and its silhouette); nil name = the whole image
    func frame(_ name: String?) -> (SKTexture, SKTexture) {
        guard let name, let r = rects[name] else { return (tex, sil) }
        if let c = cache[name] { return c }
        // SpriteKit's texture space is bottom-up and normalised
        let u = CGRect(x: r.minX / size.width, y: 1 - r.maxY / size.height, width: r.width / size.width, height: r.height / size.height)
        let a = SKTexture(rect: u, in: tex), b = SKTexture(rect: u, in: sil)
        a.filteringMode = .nearest; b.filteringMode = .nearest
        cache[name] = (a, b)
        return (a, b)
    }
}

final class Assets {
    static let shared = Assets()
    let root: URL
    let manifest: JSON
    let fontChars: [Character]
    private var sheets: [String: Sheet] = [:]

    private init() {
        root = Bundle.main.url(forResource: "Export", withExtension: nil)!
        let d = try! Data(contentsOf: root.appendingPathComponent("manifest.json"))
        manifest = try! JSONSerialization.jsonObject(with: d) as! JSON
        fontChars = Array(manifest.str("fontChars") ?? "")
    }

    var map: JSON { manifest.obj("map") }
    var cast: JSON { manifest.obj("cast") }
    var sounds: [String] { manifest.strs("sounds") }

    func data(_ name: String) -> Any {
        let d = try! Data(contentsOf: root.appendingPathComponent("data/\(name).json"))
        return try! JSONSerialization.jsonObject(with: d)
    }

    func image(_ file: String) -> UIImage { UIImage(contentsOfFile: root.appendingPathComponent("img/\(file)").path)! }

    func sheet(_ key: String) -> Sheet {
        if let s = sheets[key] { return s }
        let m = manifest.obj("sheets").obj(key)
        var anims: [String: Anim] = [:]
        for (k, v) in m.obj("anims") {
            guard let a = v as? JSON else { continue }
            anims[k] = Anim(names: (a["frames"] as? [Any] ?? []).map { "\($0)" }, fps: a.num("fps", 8), loop: a.flag("loop"))
        }
        var frames: [String: [CGFloat]] = [:]
        for (k, v) in m.obj("frames") { frames[k] = (v as? [NSNumber] ?? []).map { CGFloat(truncating: $0) } }
        let s = Sheet(image: image(m.str("file") ?? "\(key).png"), frames: frames, anims: anims)
        sheets[key] = s
        return s
    }

    func tex(_ key: String, _ frame: String? = nil) -> SKTexture { sheet(key).frame(frame).0 }
}

// The game's 5x7 pixel font (gfx/font.js): one sprite per character.
final class PixelText: SKNode {
    static let cell: CGFloat = 5, height: CGFloat = 7

    init(_ text: String, font: String = "font", tint: UIColor? = nil) {
        super.init()
        set(text, font: font, tint: tint)
    }
    required init?(coder: NSCoder) { fatalError() }

    private var shown: (String, String, UIColor?)?

    func set(_ text: String, font: String = "font", tint: UIColor? = nil) {
        if let s = shown, s.0 == text, s.1 == font, s.2 == tint { return } // unchanged: the HUD sets its text every frame
        shown = (text, font, tint)
        removeAllChildren()
        let A = Assets.shared, sheet = A.sheet(font)
        let chars = Array(text.uppercased())
        let w = CGFloat(chars.count) * PixelText.cell
        for (i, ch) in chars.enumerated() {
            guard let idx = A.fontChars.firstIndex(of: ch), ch != " " else { continue }
            let u = CGRect(x: CGFloat(idx) * PixelText.cell / sheet.size.width, y: 0, width: PixelText.cell / sheet.size.width, height: 1)
            let t = SKTexture(rect: u, in: sheet.tex); t.filteringMode = .nearest
            let s = SKSpriteNode(texture: t)
            s.anchorPoint = .zero
            s.position = CGPoint(x: (CGFloat(i) * PixelText.cell - w / 2).rounded(), y: -(PixelText.height / 2).rounded())
            if let tint { s.color = tint; s.colorBlendFactor = 1 }
            addChild(s)
        }
    }

    static func width(_ text: String) -> CGFloat { CGFloat(text.count) * cell }
}
