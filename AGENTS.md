# Working on The Ninth Tower

Read this at the start of every session, then the design files below. It
is the short version of how this project is built, tested and shipped.

## 1. Refresh on the design first

The design in [design/](design/README.md) is the source of truth, split by topic
so each file can be read whole. [design/README.md](design/README.md) lists every
file. Before changing anything, read in full:

- **[design/rules.md](design/rules.md), the never-again rules.** Every rule there
  is a bug that shipped once and broke a playtest. Check new work against all
  of them.
- **The newest file in [design/decisions/](design/decisions/)**, the decision
  log. Its latest rows say what was decided recently and why. Don't undo a
  decision without asking.
- **The topic file for what you're touching:** heroes and skills
  (`heroes-skills.md`), gear and gems (`gear.md`), relics and gates
  (`dungeons-relics.md`), the region template (`regions.md`), and so on.

When a playtest turns up a new kind of bug, add a never-again rule for it (the bug,
the rule, the check) as well as fixing it.

## 2. Rules that are easy to forget

- **A tap lights up only what you tapped.** Every `addInteractable({...})` passes
  `vis: () => itsSprite`. Leave it out only for spots with no sprite of their own
  (warps, climb points), which get the ring alone. Never pick a sprite by position.
- **Moving a hero to a spot** (dash, step, leap, blink) goes through `landing()`
  in `src/game/skills.js`: reachable open ground, or the skill doesn't fire.
- **People stand on dry, open ground** you can walk to: no water, bog,
  shallows or lava on or beside them. Run `tools/people-check.js` after placing
  or moving anyone.
- **Placement fits the layout.** New buildings and NPCs go near related ones and
  on paths, never at random. Check every place a character can ever be, not just
  where they are now. View the result zoomed out before shipping.
- **World data comes from `src/world/content.js`.** Read `W` (world.json) and
  `Q` (quests.json) from there, never from the JSON files, and read them where
  they're used, not into a constant at load: a test map swaps them. Anything
  Aldermere has that's placed in code (not listed in those files) checks `MAP`
  and stays off test maps.
- **Saving goes by the map.** Each map's `save` (`none`, `own` or `shared`) decides
  where `autosave` writes; never write a save any other way. Progress that
  belongs to a place (flags, packs, lore, flies) lives in the world's fields,
  so a shared map keeps it apart from Aldermere's. See "Saves for separate
  maps" in [design/tech.md](design/tech.md).
- **Nothing costs more because the map is bigger** (never-again rule 14).
  - Per-frame and per-check work only touches what's near the camera or the party.
  - Anything shown in the world is built with its chunk (`lazy()`, `spawnChunk`) or near the screen.
  - Far-off objects are parked automatically by the cull. Don't hold a list of everything and walk it every frame.
  - Lookups keep a reference instead of searching a list by id, and scratch buffers are reused.
  - Big static drawings are baked into a texture (Graphics are never culled).
  - Prove it with `tools/perf.js` on the dense 40x Vast (`?map=vast40d`).
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
  - `tools/dungeon-walk.js`: full dungeon runs. Set `window.__reachLog = []`
    first to log whether each leg it teleports past could be walked.
  - `tools/region-check.js`: reachability of everything in a region.
  - `tools/people-check.js`: everyone on dry land and reachable.
  - `tools/map-test.js`: integration tests on small test maps
    (`src/data/maps`), away from the main map, and the saves: a map's own
    save, travelling to a shared map and back, an old save, the Colosseum. Use a test map to try a new enemy
    or system in isolation: open one with `?map=<id>`.
  - `tools/fight-bench.js` and `tools/evade-bench.js`: combat before and after.
    Launch with `evade-bench.js`'s `start()` from the title screen (it seeds
    the party's gear and freezes levels). It runs on its own test map, `bench`
    (the Undercroft's hall and vault, copied); `start(20, 2, 'lab')` runs it in
    the Dungeon Lab for comparing with numbers from before 2026-10-24.
  - `tools/gem-bench.js`: armour gems. `checks()` hits, burns, chills and
    heals a hero with and without gems for exact numbers; `start()` fights
    each element's foes with no gems, half, matching and wrong gems, and
    goblins with storm and sun. Read damage per hit: whole fights drift apart.
  - `tools/leader-test.js`: the idle leader keeps attacking (melee steps in,
    ranged stays put) and never uses a skill or chases far.
  - `tools/staged-test.js`: an errand's waiting ambush isn't set off early.
  - `tools/perf.js`: CPU time per frame (`profile()`, `engine()`, `tour()`).
    Use it on Aldermere and on the Vast (`?map=vast`, `vast40`, `vast40d`).
    The debug panel's LOAD line and `window.__loadTimes` give load timings.
  - `node tools/design-check.mjs`: every design file is in `design/README.md`
    and every link in the docs resolves. Run it after touching the design.
  - `tools/door-orbit.js`: how far companions swing round the leader after a door.
  - `tools/house-mix.js`: cottage art sheets.
- **Combat or AI changes:** benchmark old against new. Run the old code twice
  first, to see how much the numbers vary on their own.
- **Errors are silent to scripts:** a crash inside the game loop shows only as a
  `[loop]` console error. Read the console after every test run.
- **Don't monkey-patch the scene and then run a harness.** Overrides survive
  scene restarts and skew the results. Reload first.
- **Don't add or delete files under `src/` or `tools/` while a bench runs.**
  The dev server reloads the page and the run is lost.

## 4. Shipping

After every change that ships:

1. **Log it:** add a dated row to the current decision log file in
   `design/decisions/` (what changed and
   why, plus test results).
2. **Commit** in small stages, each with a clear message.
3. **Deploy to GitHub Pages:** run `sh tools/deploy-pages.sh`. The game is
   live at https://maxwellimpact.github.io/ninth-tower/.
4. **Report honestly:** say what you tested, what you didn't, and anything that
   failed.
