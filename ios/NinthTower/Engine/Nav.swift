// The walkable grid and pathfinding: a line-for-line port of game/path.js
// (8-way A*, no corner cutting, string-pulled). The grid comes from the map's
// export: '#' solid, '~' water (shots fly over it), '.' open.
import CoreGraphics

final class Nav {
    let w: Int, h: Int
    static let tile: CGFloat = 16
    private var cells: [UInt8] // 0 open, 1 solid, 2 water

    init(rows: [String]) {
        h = rows.count
        w = rows.first?.count ?? 0
        cells = []
        for r in rows { for ch in r { cells.append(ch == "#" ? 1 : ch == "~" ? 2 : 0) } }
    }

    func inb(_ tx: Int, _ ty: Int) -> Bool { tx >= 0 && ty >= 0 && tx < w && ty < h }
    func isSolid(_ tx: Int, _ ty: Int) -> Bool { !inb(tx, ty) || cells[ty * w + tx] != 0 }
    func isWater(_ tx: Int, _ ty: Int) -> Bool { inb(tx, ty) && cells[ty * w + tx] == 2 }
    func isWall(_ tx: Int, _ ty: Int) -> Bool { !inb(tx, ty) || cells[ty * w + tx] == 1 }
    func solidAt(_ x: CGFloat, _ y: CGFloat) -> Bool { isSolid(Int((x / Nav.tile).rounded(.down)), Int((y / Nav.tile).rounded(.down))) }
    func wallAt(_ x: CGFloat, _ y: CGFloat) -> Bool { isWall(Int((x / Nav.tile).rounded(.down)), Int((y / Nav.tile).rounded(.down))) }
    func waterAt(_ x: CGFloat, _ y: CGFloat) -> Bool { isWater(Int((x / Nav.tile).rounded(.down)), Int((y / Nav.tile).rounded(.down))) }

    // Is the straight line between two points clear for a body of radius r?
    func lineClear(_ x0: CGFloat, _ y0: CGFloat, _ x1: CGFloat, _ y1: CGFloat, _ r: CGFloat = 4) -> Bool {
        let d = hyp(x1 - x0, y1 - y0)
        let n = Int((d / 4).rounded(.up))
        for i in 0...max(0, n) {
            let t = CGFloat(i) / CGFloat(max(1, n))
            let x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t
            if solidAt(x - r, y - r) || solidAt(x + r, y - r) || solidAt(x - r, y + r) || solidAt(x + r, y + r) { return false }
        }
        return true
    }

    // shots fly over water, not through walls
    func shotClear(_ x0: CGFloat, _ y0: CGFloat, _ x1: CGFloat, _ y1: CGFloat) -> Bool {
        let d = hyp(x1 - x0, y1 - y0), n = Int((d / 6).rounded(.up))
        for i in 0...max(0, n) {
            let t = CGFloat(i) / CGFloat(max(1, n))
            if wallAt(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t) { return false }
        }
        return true
    }

    func nearestOpen(_ tx: Int, _ ty: Int, _ maxR: Int = 6) -> (Int, Int)? {
        if !isSolid(tx, ty) { return (tx, ty) }
        for r in 1...maxR {
            var best: (Int, Int)?, bd = Int.max
            for dy in -r...r { for dx in -r...r where max(abs(dx), abs(dy)) == r && !isSolid(tx + dx, ty + dy) {
                let d = dx * dx + dy * dy
                if d < bd { bd = d; best = (tx + dx, ty + dy) }
            } }
            if let best { return best }
        }
        return nil
    }

    // world waypoints (excluding the start), or nil
    func find(_ sx: CGFloat, _ sy: CGFloat, _ gx: CGFloat, _ gy: CGFloat, maxNodes: Int = 5000) -> [P]? {
        if lineClear(sx, sy, gx, gy) { return [P(x: gx, y: gy)] }
        let T = Nav.tile
        var s = (Int((sx / T).rounded(.down)), Int((sy / T).rounded(.down)))
        let g0 = (Int((gx / T).rounded(.down)), Int((gy / T).rounded(.down)))
        s = nearestOpen(s.0, s.1) ?? s
        guard let g = nearestOpen(g0.0, g0.1) else { return nil }
        let adjusted = g != g0
        let start = s.1 * w + s.0, goal = g.1 * w + g.0
        var gs = [CGFloat](repeating: .infinity, count: w * h), parent = [Int](repeating: -1, count: w * h), shut = [Bool](repeating: false, count: w * h)
        var heap: [(CGFloat, Int)] = []
        func hcost(_ i: Int) -> CGFloat { let dx = CGFloat(abs(i % w - g.0)), dy = CGFloat(abs(i / w - g.1)); return max(dx, dy) + 0.414 * min(dx, dy) }
        func push(_ i: Int, _ f: CGFloat) {
            heap.append((f, i)); var k = heap.count - 1
            while k > 0 { let p = (k - 1) >> 1; if heap[p].0 <= heap[k].0 { break }; heap.swapAt(p, k); k = p }
        }
        func pop() -> Int {
            let top = heap[0], last = heap.removeLast()
            if !heap.isEmpty {
                heap[0] = last; var k = 0
                while true {
                    let l = 2 * k + 1, r = l + 1; var m = k
                    if l < heap.count && heap[l].0 < heap[m].0 { m = l }
                    if r < heap.count && heap[r].0 < heap[m].0 { m = r }
                    if m == k { break }; heap.swapAt(m, k); k = m
                }
            }
            return top.1
        }
        gs[start] = 0; push(start, hcost(start))
        var expanded = 0
        while !heap.isEmpty {
            let cur = pop()
            if cur == goal { break }
            if shut[cur] { continue }
            shut[cur] = true
            expanded += 1; if expanded > maxNodes { return nil }
            let cx = cur % w, cy = cur / w
            for dy in -1...1 { for dx in -1...1 where dx != 0 || dy != 0 {
                let nx = cx + dx, ny = cy + dy
                if isSolid(nx, ny) { continue }
                if dx != 0 && dy != 0 && (isSolid(cx + dx, cy) || isSolid(cx, cy + dy)) { continue }
                let ni = ny * w + nx, ng = gs[cur] + (dx != 0 && dy != 0 ? 1.414 : 1)
                if ng < gs[ni] { gs[ni] = ng; parent[ni] = cur; push(ni, ng + hcost(ni)) }
            } }
        }
        if parent[goal] == -1 && goal != start { return nil }
        var pts: [P] = []
        var i = goal
        while i != -1 && i != start { pts.append(P(x: CGFloat(i % w) * T + T / 2, y: CGFloat(i / w) * T + T / 2)); i = parent[i] }
        pts.reverse()
        if !adjusted { pts.append(P(x: gx, y: gy)) }
        var out: [P] = [], ax = sx, ay = sy, k = 0
        while k < pts.count {
            var j = pts.count - 1
            while j > k && !lineClear(ax, ay, pts[j].x, pts[j].y) { j -= 1 }
            out.append(pts[j]); ax = pts[j].x; ay = pts[j].y; k = j + 1
        }
        return out
    }
}
