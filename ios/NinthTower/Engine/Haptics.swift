// Haptics (tech.md: "haptics on hits, dodges and Ward Stone shatter"): the
// leader's hits land a tap, crits and blows taken a firmer one, ultimates a thump.
import UIKit

enum Haptics {
    private static let light = UIImpactFeedbackGenerator(style: .light)
    private static let rigid = UIImpactFeedbackGenerator(style: .rigid)
    private static let medium = UIImpactFeedbackGenerator(style: .medium)
    private static let heavy = UIImpactFeedbackGenerator(style: .heavy)
    private static let notice = UINotificationFeedbackGenerator()
    private static var lastAt: CFTimeInterval = 0

    static func prepare() { [light, rigid, medium, heavy].forEach { $0.prepare() } }

    // spaced out, so a busy fight is a rhythm and not a buzz
    private static func gate(_ gap: CFTimeInterval) -> Bool {
        let now = CACurrentMediaTime()
        if now - lastAt < gap { return false }
        lastAt = now
        return true
    }

    static func hit() { if gate(0.07) { light.impactOccurred(intensity: 0.7) } }
    static func crit() { if gate(0.05) { rigid.impactOccurred() } }
    static func hurt() { if gate(0.05) { medium.impactOccurred() } }
    static func dodge() { light.impactOccurred(intensity: 0.5) }
    static func ult() { heavy.impactOccurred() }
    static func down() { notice.notificationOccurred(.error) }
    static func win() { notice.notificationOccurred(.success) }
    static func tap() { light.impactOccurred(intensity: 0.4) }
}
