// The party's skills in this slice (game/skills.js SKILL_FX): each one's cast
// and the rule a companion uses to decide it's worth it right now.
import Foundation

enum Skills {
    static let targeted: Set<String> = ["bash", "fireball", "step"]

    static func cast(_ id: String, _ h: Hero, _ target: Enemy?) -> Bool {
        let sc = h.scene
        switch id {
        case "bash": // slam the shield into a foe: damage, knockback and a stun
            let (nx, ny) = target.map { norm($0.x - h.x, $0.y - h.y) } ?? h.facingVec()
            h.face(nx, ny)
            Audio.shared.play("dash")
            h.act("bash", 0.3, "attack", hitAt: 0.16, tick: { a, dt in if a.t < 0.16 { h.moveBy(nx * 170 * dt, ny * 170 * dt) } }, resolve: {
                let fx = h.x + nx * 14, fy = h.y + ny * 14
                sc.shake(0.09, 0.006)
                var hit = false
                for e in sc.enemies where e.alive && hyp(e.x - fx, e.y - fy) <= 24 {
                    sc.dealDamage(h, e, h.atk * 1.4, knock: 160)
                    e.stunT = max(e.stunT, 1); e.clearZone(); e.state = "chase"
                    hit = true
                }
                if hit { Audio.shared.play("bash") }
            })
            return true
        case "taunt": // every foe nearby attacks Brann for 4s; he takes half damage meanwhile
            h.act("taunt", 0.4, "cast")
            h.taunting = 4
            for e in sc.enemies where e.alive && dist(e, h) < 110 { e.setTaunt(h, 4) }
            Audio.shared.play("aggro"); Audio.shared.play("bash")
            sc.fx.ring(h.x, h.y - 4, "ringRed", 6)
            sc.floatText(h.x, h.y - 30, "TAUNT!", font: "fontGold")
            return true
        case "fireball":
            guard let t = target else { return false }
            h.face(t.x - h.x, t.y - h.y)
            Audio.shared.play("fireCast")
            h.act("fireball", 0.4, "cast", hitAt: 0.2, resolve: {
                let (nx, ny) = norm(t.x - h.x, t.y - (h.y - 6))
                sc.spawnProjectile(Projectile(owner: h, x: h.x + nx * 10, y: h.y - 8, vx: nx * 160, vy: ny * 160, dmg: h.atk * 1.5, kind: .fireball, target: t, element: "fire", spell: true, aoe: 24))
            })
            return true
        case "mend": // heals the party nearby and revives the downed
            h.act("mend", 0.5, "cast")
            Audio.shared.play("heal")
            for p in sc.party where p.alive && dist(p, h) <= 140 {
                if p.downed { p.revive(0.35) }
                p.heal(p.maxHp * 0.35)
            }
            return true
        case "step": // melt into shadow, reappear behind a foe and backstab it
            guard let t = target, dist(h, t) <= 85, let spot = sc.landing(behind: t, from: h) else { return false }
            let ox = h.x, oy = h.y, (nx, ny) = norm(t.x - h.x, t.y - h.y)
            let VANISH: CGFloat = 0.12, ARRIVE: CGFloat = 0.26, SHOWN: CGFloat = 0.34, STAB: CGFloat = 0.34
            h.clearPath(); h.face(nx, ny)
            h.invuln = max(h.invuln, SHOWN)
            sc.fx.puff(ox, oy, curse: true)
            Audio.shared.play("dash", pitch: 0.7)
            var moved = false, puffed = false, stabbed = false
            h.act("step", 0.48, "cast", tick: { a, _ in
                if a.t < VANISH { h.alpha = 1 - a.t / VANISH }
                else if !moved {
                    moved = true
                    for k in 1...5 { sc.fx.ghost(h, x: ox + (spot.x - ox) * CGFloat(k) / 6, y: oy + (spot.y - oy) * CGFloat(k) / 6, tint: hex(0x2a1840), alpha: 0.3 + 0.1 * CGFloat(k), dur: 0.18 + 0.04 * CGFloat(k)) }
                    h.x = spot.x; h.y = spot.y
                    h.face(t.x - h.x, t.y - h.y)
                    h.alpha = 0
                }
                if a.t >= ARRIVE - 0.04 && !puffed { puffed = true; sc.fx.puff(spot.x, spot.y, curse: true); Audio.shared.play("dash", pitch: 1.3) }
                if a.t >= ARRIVE { h.alpha = min(1, (a.t - ARRIVE) / (SHOWN - ARRIVE)) }
                if a.t >= STAB && !stabbed {
                    stabbed = true
                    h.animKey = ""; h.play("attack")
                    if t.alive {
                        h.nextCrit = true; h.resolveAttack(t); h.nextCrit = false
                        sc.fx.ring(t.x, t.y - 4, "ringGold", 2.5)
                        sc.floatText(t.x, t.y - 34, "BACKSTAB!", font: "fontGold")
                        Audio.shared.play("stab", pitch: 0.8)
                    }
                    h.atkT = 0
                }
            })
            sc.after(0.8) { if h.action?.id != "step" { h.alpha = 1 } }
            if h.isLeader { h.command = .attack(t, auto: false) } else { h.target = t }
            return true
        case "fan": // a ring of thrown blades
            h.act("fan", 0.3, "cast")
            for k in 0..<8 {
                let a = CGFloat(k) / 8 * .pi * 2
                sc.spawnProjectile(Projectile(owner: h, x: h.x, y: h.y - 8, vx: cos(a) * 210, vy: sin(a) * 210, dmg: h.atk * 1.2, kind: .knife, life: 0.32))
            }
            Audio.shared.play("stab"); sc.after(0.04) { Audio.shared.play("stab", pitch: 1.1) }; sc.after(0.08) { Audio.shared.play("swing", pitch: 1.4) }
            return true
        default: return false
        }
    }

    // nil: not now. (true, _): on the companion's own target. (false, e): on e.
    static func ai(_ id: String, _ h: Hero, target t: Enemy?, engaged: [Enemy]) -> (Bool, Enemy?)? {
        let sc = h.scene
        func engagedNear(_ r: CGFloat) -> Int { sc.enemies.filter { $0.alive && $0.engaged && dist($0, h) < r + $0.r }.count }
        switch id {
        case "bash": if let t, dist(t, h) < 30 { return (false, t) }
        case "taunt": if engaged.filter({ $0.target != nil && $0.target !== h && dist($0, h) < 100 }).count >= 2 { return (true, nil) }
        case "fireball":
            if let t, dist(t, h) <= 115, engaged.filter({ dist($0, t) < 30 }).count >= 2 || t.maxHp >= 60 { return (false, t) }
        case "mend": if sc.party.contains(where: { $0.downed || ($0.alive && $0.hp / $0.maxHp < 0.5) }) { return (true, nil) }
        case "step":
            if let t, dist(t, h) > 36, dist(t, h) < 75, let L = sc.leader, dist(t, L) < 60, !sc.dangers.contains(where: { hyp($0.x - t.x, $0.y - t.y) < $0.r + 14 }) { return (false, t) }
        case "fan": if engagedNear(38) >= 2 { return (true, nil) }
        default: break
        }
        return nil
    }
}
