// Sound effects: the web synth's own sounds, rendered once by
// tools/native-export.js, played here through a pool of AVAudioEngine voices
// with varispeed for pitch (the web passes a pitch to most of them) and a
// touch of random detune so repeats don't grate, as the synth's own do.
import AVFoundation

final class Audio {
    static let shared = Audio()
    private let engine = AVAudioEngine()
    private var buffers: [String: AVAudioPCMBuffer] = [:]
    private var voices: [(AVAudioPlayerNode, AVAudioUnitVarispeed)] = []
    private var next = 0
    private var lastAt: [String: CFTimeInterval] = [:]
    var muted = false

    private init() {
        try? AVAudioSession.sharedInstance().setCategory(.ambient, options: [.mixWithOthers]) // the ring/silent switch mutes it, like any game
        try? AVAudioSession.sharedInstance().setActive(true)
        let A = Assets.shared
        var format: AVAudioFormat?
        for name in A.sounds {
            let url = A.root.appendingPathComponent("sfx/\(name).m4a")
            guard let f = try? AVAudioFile(forReading: url),
                  let b = AVAudioPCMBuffer(pcmFormat: f.processingFormat, frameCapacity: AVAudioFrameCount(f.length)) else { continue }
            try? f.read(into: b)
            buffers[name] = b
            format = format ?? f.processingFormat
        }
        guard let format else { return }
        for _ in 0..<14 {
            let p = AVAudioPlayerNode(), v = AVAudioUnitVarispeed()
            engine.attach(p); engine.attach(v)
            engine.connect(p, to: v, format: format)
            engine.connect(v, to: engine.mainMixerNode, format: format)
            voices.append((p, v))
        }
        engine.mainMixerNode.outputVolume = 0.9
        try? engine.start()
        NotificationCenter.default.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { [weak self] _ in
            try? self?.engine.start() // the phone took the sound (a call, another app): take it back
        }
    }

    func play(_ name: String, pitch: CGFloat = 1, vol: Float = 1) {
        guard !muted, let b = buffers[name], !voices.isEmpty else { return }
        let now = CACurrentMediaTime()
        if let t = lastAt[name], now - t < 0.03 { return } // the same sound twice in one beat is just louder
        lastAt[name] = now
        if !engine.isRunning { try? engine.start() }
        let (p, v) = voices[next]
        next = (next + 1) % voices.count
        p.stop()
        v.rate = Float(pitch) * Float.random(in: 0.96...1.04)
        p.volume = vol
        p.scheduleBuffer(b, at: nil)
        p.play()
    }
}
