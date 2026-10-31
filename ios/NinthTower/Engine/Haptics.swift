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

    static func hit() { Probe.time("haptic hit", over: 2) { if gate(0.07) { light.impactOccurred(intensity: 0.7) } } }
    static func crit() { Probe.time("haptic crit", over: 2) { if gate(0.05) { rigid.impactOccurred() } } }
    static func hurt() { Probe.time("haptic hurt", over: 2) { if gate(0.05) { medium.impactOccurred() } } }
    static func dodge() { Probe.time("haptic dodge", over: 2) { light.impactOccurred(intensity: 0.5) } }
    static func ult() { Probe.time("haptic ult", over: 2) { heavy.impactOccurred() } }
    static func down() { Probe.time("haptic down", over: 2) { notice.notificationOccurred(.error) } }
    static func win() { Probe.time("haptic win", over: 2) { notice.notificationOccurred(.success) } }
    static func tap() { Probe.time("haptic tap", over: 2) { light.impactOccurred(intensity: 0.4) } }
}
