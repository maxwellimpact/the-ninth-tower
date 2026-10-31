// The web game's data files (heroes, enemies, skills, items, tuning), loaded
// unchanged (tech.md: "content is data, not code").
import Foundation

enum GameData {
    static let tuning: JSON = Assets.shared.data("tuning") as! JSON
    static let enemies: JSON = Assets.shared.data("enemies") as! JSON
    static let skills: JSON = Assets.shared.data("skills") as! JSON
    static let items: JSON = { let d = Assets.shared.data("items") as! JSON; return d["items"] as? JSON ?? d }()
    static let heroes: [String: JSON] = {
        var out: [String: JSON] = [:]
        for h in Assets.shared.data("heroes") as! [JSON] { if let id = h.str("id") { out[id] = h } }
        return out
    }()

    static var speed: CGFloat { tuning.num("gameSpeed", 0.72) }
    static var critMult: CGFloat { tuning.num("critMult", 1.75) }

    // state.js mitigate(): defence's share of a blow, steeper against higher-level foes
    static func mitigate(_ raw: CGFloat, def: CGFloat, attackerLevel: CGFloat = 1) -> CGFloat {
        let k = tuning.num("defK", 40) + 6 * (attackerLevel - 1)
        return raw * (k / (k + max(0, def)))
    }

    // state.js computeStats(), the parts this slice uses: level growth plus the starting gear's stats
    static func heroStats(_ id: String, level: Int) -> JSON {
        let h = heroes[id]!
        var s = h.obj("stats")
        let L = CGFloat(level - 1)
        s["maxHp"] = (s.num("maxHp") * (1 + L * tuning.num("hpGrowth"))).rounded()
        s["atk"] = s.num("atk") + L * tuning.num("atkGrowth")
        s["def"] = CGFloat(0)
        for (_, iid) in h.obj("equip") {
            guard let iid = iid as? String else { continue }
            for (k, v) in items.obj(iid).obj("stats") {
                let key = k == "hp" ? "maxHp" : k
                s[key] = s.num(key) + CGFloat(truncating: v as? NSNumber ?? 0)
            }
        }
        s["evade"] = tuning.obj("evade").obj("hero").num(id)
        return s
    }
}
