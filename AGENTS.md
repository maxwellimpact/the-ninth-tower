# Working on The Ninth Tower

Read this at the start of every session, then the parts of DESIGN.md below. It
is the short version of how this project is built, tested and shipped.

## 1. Refresh on the design first

[DESIGN.md](DESIGN.md) is the source of truth. Before changing anything, re-read:

- **C12 §8 "Never-again rules"** (search `### 8. Never-again rules`). Every rule
  there is a bug that shipped once and broke a playtest. Check new work against
  all of them.
- **The decision log** at the end of the file (the dated table rows). The latest
  rows say what was decided recently and why. Don't undo a decision without
  asking.
- **The section for what you're touching:** heroes and skills (C3), gear (C4/C5),
  relics and gates (C8), the region template (C12), and so on.

When the user reports a new kind of bug, add a never-again rule for it (the bug,
the rule, the check) as well as fixing it.

## 2. Rules that are easy to forget

- **A tap lights up only what you tapped.** Every `addInteractable({...})` passes
  `vis: () => itsSprite`. Leave it out only for spots with no sprite of their own
  (warps, climb points), which get the ring alone. Never pick a sprite by position.
- **Moving a hero to a spot** (dash, step, leap, blink) goes through `landing()`
  in `src/game/skills.js`: reachable open ground, or the skill doesn't fire.
- **People stand on dry, open ground** you can walk to. Scan for water and
  reachability after placing or moving anyone.
- **Placement fits the layout.** New buildings and NPCs go near related ones and
  on paths, never at random. Check every place a character can ever be, not just
  where they are now. View the result zoomed out before shipping.
- **New art matches the cast.** Render new sprites beside existing ones at 3x.
- **Only change what was asked.** Mention other problems you notice instead of
  quietly changing them.

## 3. Testing

- **Phone first:** check visuals at iPhone landscape, 844x390 (`resize_window`),
  then reset the viewport when done.
- **Dev server:** the `ninth-tower-test` launch config (port 5184). If the
  browser pane is hidden, the game gets no frames: step it by hand with
  `tools/goto.js` (`step`), which the test tools already do.
- **Screenshots:** POST a data URL to `/__snap?name=X.png` to save it into
  `snapshots/`. This works even when the pane is hidden.
- **Test tools** (each file's header says how to run it):
  - `tools/goto.js`: jump anywhere.
  - `tools/errand-walk.js`: plays every errand.
  - `tools/dungeon-walk.js`: full Undercroft, Abbey and Forge runs.
  - `tools/region-check.js`: reachability of everything in a region.
  - `tools/fight-bench.js` and `tools/evade-bench.js`: combat before and after.
  - `tools/door-orbit.js`: how far companions swing round the leader after a door.
  - `tools/house-mix.js`: cottage art sheets.
- **Combat or AI changes:** benchmark old against new. Run the old code twice
  first, to see how much the numbers vary on their own.
- **Errors are silent to scripts:** a crash inside the game loop shows only as a
  `[loop]` console error. Read the console after every test run.
- **Don't monkey-patch the scene and then run a harness.** Overrides survive
  scene restarts and skew the results. Reload first.

## 4. Shipping

After every change that ships:

1. **Log it:** add a dated row to the DESIGN.md decision log (what changed and
   why, plus test results).
2. **Commit** in small stages, each with a clear message.
3. **Deploy to GitHub Pages:** run `sh tools/deploy-pages.sh`. The user plays
   at maxwellimpact.github.io/ninth-tower.
4. **Publish the artifact:** republish
   https://claude.ai/artifact/SKkL8Uz5CgQFJDxuNWfCx5 from `dist/full.html`.
   - Map each new hashed script in `dist/assets` (main, music, terrainWorker),
     and set the old ones to `null`.
   - Don't pass `capabilities`; the stored ones (db, user) carry over.
5. **Report honestly:** say what you tested, what you didn't, and anything that
   failed.
