// Small helpers shared by the port. Game logic works in the web build's own
// space (pixels, y pointing down) so it reads line for line like units.js;
// only drawing flips y (see Unit.sync).
import CoreGraphics
import Foundation

func hyp(_ x: CGFloat, _ y: CGFloat) -> CGFloat { (x * x + y * y).squareRoot() }
func norm(_ x: CGFloat, _ y: CGFloat) -> (CGFloat, CGFloat) { let l = hyp(x, y); return l > 0 ? (x / l, y / l) : (1, 0) }
func rnd() -> CGFloat { CGFloat.random(in: 0..<1) }
func clamp<T: Comparable>(_ v: T, _ a: T, _ b: T) -> T { min(b, max(a, v)) }

protocol Positioned { var x: CGFloat { get }; var y: CGFloat { get } }
func dist(_ a: Positioned, _ b: Positioned) -> CGFloat { hyp(a.x - b.x, a.y - b.y) }

struct P: Positioned { var x: CGFloat; var y: CGFloat }

// JSON access without a schema: the data files are the web game's own, loaded as they are.
typealias JSON = [String: Any]
extension Dictionary where Key == String, Value == Any {
    func num(_ k: String, _ d: CGFloat = 0) -> CGFloat {
        if let v = self[k] as? NSNumber { return CGFloat(truncating: v) }
        return d
    }
    func str(_ k: String) -> String? { self[k] as? String }
    func obj(_ k: String) -> JSON { self[k] as? JSON ?? [:] }
    func flag(_ k: String) -> Bool { (self[k] as? Bool) ?? false }
    func strs(_ k: String) -> [String] { self[k] as? [String] ?? [] }
}

// Colours from the web's 0xRRGGBB
import UIKit
func hex(_ c: UInt32, _ a: CGFloat = 1) -> UIColor {
    UIColor(red: CGFloat((c >> 16) & 255) / 255, green: CGFloat((c >> 8) & 255) / 255, blue: CGFloat(c & 255) / 255, alpha: a)
}

// Frame-hitch probe (only with -perfLog): times a piece of work and prints it
// when it runs long, so a slow frame on the phone names its cause.
import QuartzCore
enum Probe {
    static let on = ProcessInfo.processInfo.arguments.contains("-perfLog")
    @inline(__always) static func time<T>(_ label: @autoclosure () -> String, over ms: Double = 4, _ work: () -> T) -> T {
        guard on else { return work() }
        let t0 = CACurrentMediaTime()
        let r = work()
        let dt = (CACurrentMediaTime() - t0) * 1000
        if dt > ms { print(String(format: "[slow] %.1fms %@", dt, label())) }
        return r
    }
}
