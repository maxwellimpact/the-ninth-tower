// The app shell: one landscape SpriteKit view running the battle.
import UIKit
import SpriteKit

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        let w = UIWindow(frame: UIScreen.main.bounds)
        w.rootViewController = GameViewController()
        w.makeKeyAndVisible()
        window = w
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) { GameViewController.current?.pause(true) }
    func applicationDidBecomeActive(_ application: UIApplication) { GameViewController.current?.pause(false) }
}

final class GameViewController: UIViewController {
    static weak var current: GameViewController?
    private var skView: SKView { view as! SKView }
    private var battle: BattleScene?

    override func loadView() { view = SKView(frame: UIScreen.main.bounds) }

    override func viewDidLoad() {
        super.viewDidLoad()
        GameViewController.current = self
        skView.ignoresSiblingOrder = true
        skView.preferredFramesPerSecond = UIScreen.main.maximumFramesPerSecond // 120 on ProMotion
        skView.isMultipleTouchEnabled = true
        view.backgroundColor = UIColor(red: 0.086, green: 0.071, blue: 0.122, alpha: 1)
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        if battle == nil, view.bounds.width > view.bounds.height {
            let s = BattleScene(viewSize: view.bounds.size, safe: view.safeAreaInsets)
            battle = s
            skView.presentScene(s)
        }
    }

    func pause(_ on: Bool) { skView.isPaused = on; battle?.resetClock() }

    override var prefersStatusBarHidden: Bool { true }
    override var prefersHomeIndicatorAutoHidden: Bool { true }
    override var preferredScreenEdgesDeferringSystemGestures: UIRectEdge { .all } // swipes near the edge are dodges, not the app switcher
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask { .landscape }
}
