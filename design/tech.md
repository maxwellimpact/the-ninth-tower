# Tech plan, test maps, saves and the Vast

See also: [rules.md](rules.md).

## 13. Tech Plan — **[DRAFT]**

### Two phases, two codebases
| | Web prototype (now) | iOS game (shipping) |
|---|---|---|
| Purpose | Find the fun fast: design, feel, art, audio, balance | The real product |
| Stack | Phaser 3 + Vite (JS) | Native: **Swift + SpriteKit** *(proposed, see open question)* |
| Lifespan | Throwaway-ish. Its *data and assets* carry over, its rendering code doesn't | Long-term |

### Rules that keep the native port cheap
The prototype is written so that everything except the rendering/engine glue transfers directly:
- **Content is data, not code.** Heroes, skills, enemies, items, loot tables, dialogue, quests, level bands and the world map live in **JSON** that the Swift game loads unchanged.
  - The world moves to **Tiled** maps, which SpriteKit can load via a small importer.
- **Art is exported, not re-drawn.** The code-drawn art generators (puppet renderer, props, terrain) get an **export step that writes PNG sprite atlases + frame metadata**. iOS loads the atlases like normal assets, so web and iOS are pixel-identical.
- **Music is data.** Songs are tracker patterns (notes + instruments). On iOS this becomes either a small **native synth on AVAudioEngine** that plays the same pattern data (keeps adaptive layers), or **pre-rendered stems** exported from the web synth and crossfaded natively. Decide at port time.
- **Game rules are written as plain logic**, kept apart from Phaser calls (damage formulas, AI decisions, XP curves, scaling bands). They can be translated line-for-line to Swift and covered by the same test cases.
- **Headless validators** (world reachability per relic set, loot sanity, AI scenario tests) run on the shared JSON, so they guard both versions.

### Web prototype specifics
- **Engine:** Phaser 3 + Vite.
- **Pathfinding:** grid A* with path smoothing, elevation-aware (mirrors GameplayKit's grid pathfinding on iOS).
- **Saves:** localStorage, using the same save schema the iOS version will use.

### Test maps **[BUILT]**
Small maps for trying one thing in isolation (an enemy, a system, a demo), and for integration tests, without the overworld's packs, errands, curse or load time.
- **Where:** `src/data/maps/<id>.json`. Open one with `?map=<id>`; `?demo=combat` uses `arena`. Most never save; a map can say otherwise (see Saves for separate maps, below).
- **The format:**
  - `rows`: the map as text, with a `legend` that can override the defaults. `.` grass, `=` path, `~` water, `#` cliff, `T` tree, `b` bush, `o` rock, `f` flowers, `F` campfire spot, `@` start.
  - `at`: where it's stamped in the world.
  - `start`: where the party appears.
  - `save` (optional): `none` (the default), `own` or `shared`. `party` (optional, for `own`): the fresh party it starts with. `band` (optional): a level band of its own, used everywhere on it.
  - `content`: the map's own things, in the same shape as world.json's lists (`campfires`, `groups`, `chests`, `npcs`…), in the map's own coordinates. `questNpcs` and `errands` are its own people and errands.
- **How it works:**
  - The map is stamped into an otherwise solid grid of the usual size, so everything sized to the world works unchanged: navigation, the minimap, streaming and save bits. Building it costs next to nothing. (In 2026-10-21 it was 2.7 s to playable against 13 s for Aldermere; since the 2026-10-23 load fixes Aldermere is about 2.2 s too, so test maps are no longer much quicker to open, just isolated.)
  - `world/content.js` serves world.json and quests.json, or the test map's content in their place. Every list of things is swapped, and the settings (regions' level bands, the shop, bosses' tuning) are kept.
- **Where it's stamped decides its rules:** grass colours, music, heat and cold, and the enemy level band all come from the region at `at`.
- **Left out:**
  - Aldermere's things placed in code: the Frog King, lore pages, the Tower barrier and the dungeons (never-again rule 11).
  - Saving, unless its `save` says otherwise.
- **Tests:** `tools/map-test.js` boots maps and checks them. `maps-valid` checks every map's file, `arena-isolated` that nothing leaks in and nothing saves, `pack-fight` that the party meets and beats an authored pack, and `vast-loads` that the Vast loads with every region, every pack on open ground, and no save. The save tests (`own-save`, `shared-world`, `old-save`, `colosseum`) set the page's saves aside and put them back after.

### Saves for separate maps **[BUILT 2026-10-24]**
Maps are going to diverge: most test maps want a save of their own that can be wiped, and a map that extends the game (a new region, an arena) should carry the party's progress. **Each map says how it saves**, with `save` in its definition:
- **`none`** (the default): never saves. Test and profiling maps (`arena`, `pack`, `bench`, the Vast), the lab and the demos.
- **`own`**: a save of its own under `ninthTower.save.v1.map.<id>`, mirrored to its own cloud document (`save_map_<id>`). The first visit starts a **fresh party of its own** (the map's `party`: leader, recruits, level), never a copy of the main save's. Nothing flows to or from the main save. The title's **SAVED MAPS** button (shown once any such map has a save) lists them, each with CONTINUE and CLEAR; CLEAR takes two taps and wipes that map's save, here and in the cloud, and nothing else. `?map=<id>` opens one. The example is `trial` (THE TRIAL ROAD).
- **`shared`**: part of the main game. **The party is one and the same everywhere** (heroes, levels, gear, bag, gold, materials, gems, relics, play time). **Each map keeps its own world** (flags, cleared and respawning packs, where the party stood, the explored map, lore, golden flies, errands). A few flags are the party's story, not a place's, and go where the party goes: the Frog King's blessing, `postgame`, `malgrimDefeated`.

**One world owns its collections.** Golden flies and lore pages belong to the world they're found in. Another world can read them, and Aldermere's flags, with `worldOf(state, 'aldermere')`, but never writes them.

**The shape on disk is unchanged.** The main save keeps Aldermere's world at the top level, as it always has, and each shared map's world under `worlds.<id>`. It's still version 1, so older builds still read it (they'd drop `worlds` on their next save). In play, the world the party is in sits at the top level and `state.world` names it, so game code reads `state.flags` and the rest as before; only saving and travelling know about worlds (`switchWorld` in `game/state.js`).
- **Nothing is migrated.** An existing save loads exactly as before. The first save this build makes also keeps a copy of the save it replaced, once, under `ninthTower.save.v1.bak`.
- **Travelling** (`Game.goToWorld`): save, swap the worlds over in a copy of the state (the old scene keeps running on its own until it's gone), and restart the scene in the other world. A warp with `toMap` travels (`null` is Aldermere). A first visit starts at the map's `start`; after that, where the party left it.
- **Foes on a shared map** level from the map's own `band` when it has one, not Aldermere's regions. The Colosseum sets each wave's level itself.

### The Colosseum (a shared map) **[BUILT 2026-10-24]**
An endless arena, and the example of a `shared` map (`src/data/maps/colosseum.json`, `game/colosseum.js`). The title's **THE COLOSSEUM** button takes the main save's party there; the stairs by the gate go back to Aldermere, to where the party left it. Later, a colosseum found in the main game could be a warp with `toMap: "colosseum"`.
- **Waves until the party falls.** Foes come through five gates round an oval of sand, with four pillars for cover. They're fought to the end (no leash).
- **Their own ladder, not the party's level:** wave N fights at level N (`levelStart`, `levelPerWave`), so how far a run gets says how strong the party is. Each wave has 2 + 0.6 x N foes, up to 10. New kinds join at waves 4, 8 and 12 (from the Vale's goblins to the Basin's gargoyles and chainwardens), and half of each wave comes from the newest.
- **Prizes:** kills give XP, gold and drops as anywhere. Every 5th wave brings elites, and the crowd throws 15 x N gold and a piece of gear at the wave's tier (Rare from wave 15).
- **Saved:** the party's gains go to the main save, which is written after every wave. The best run is the Colosseum's own (its world's `arenaBest`), shown on the HUD with the current wave.
- **Falling** ends the run: no gold lost, a banner with the waves lasted and the best, and a new run from wave 1 a few seconds later.

### The Vast (a generated map for profiling) **[BUILT]**
A world ten times Aldermere's overworld by area, for measuring load times and frame rates on a big map. Open it with `?map=vast`; the title screen's **THE VAST** button (where the Dungeon Lab button was) opens `vast40d`, the dense forty-times map; any `vastN` up to 100 works. A `d` on the end (`?map=vast40d`) is the **dense** version: Aldermere's people and collectibles added at Aldermere's density (golden flies, shrines, cursed townsfolk, errand-style people with lines but no errands) and the blight left down, to see how the main game's kind of content scales. Never saves.
- **Layout:** Aldermere's regions in Aldermere's places, scaled up (608 x 1008 tiles at 10x): Brightwater Vale and Highmeadow north, Mistfen across the middle, Gloamwood and Cinderreach either side of the ridge, Frosthelm and the Blight Basin south. The borders are Aldermere's own edge functions, scaled, frayed where regions meet.
- **In each region:** its own ground and water (lakes, marsh pools and bog, lava pools, lake ice, chasms), rivers running south (lava in Cinderreach, frozen in Frosthelm, with fords), Aldermere's scenery props at Aldermere's thresholds, and its own foes, gathering nodes and chest materials, taken from what Aldermere places in that region. Villages of cottages round a square with a campfire and a signpost, joined by roads (a spanning tree plus loops; bridges over water and lava). Lookouts, and wild campfires between villages.
- **Counts at 10x (Aldermere in brackets):** 927 packs (89), 247 chests (23), 776 nodes (73), 105 campfires (14), 46 lookouts (6), 67 villages with 243 cottages, 44,967 props (4,354).
- **Level bands:** its regions have fixed bands (Vale 1-8, Highmeadow 3-10, Mistfen 6-14, Gloamwood 10-18, Cinderreach 12-20, Frosthelm 16-24, Basin 22-30). The demo party is level 12, starts in the Vale, and its land starts freed (no Ward Stones), with salves and tonics for the heat and cold.
- **How it works:** `world/vast.js` builds it from noise and hashes of each tile, so the game and the terrain worker build the same world (about 0.2 s each at 10x). A generated map brings its own grid size and region rule: `setMapShape` in map.js makes `MAP_W`, `MAP_H`, `OW_W` and `biomeAt` follow it (they're live bindings; never copy them at import time). The whole grid is overworld, so the painter's interior rectangles are switched off.
- **Load timings:** the debug panel shows them (world build, navigation, minimap, landmarks, first chunks, the worker's build, and ready from the tap), and every load logs a `[load]` line; `window.__loadTimes` has the lot.
- **Frame profiling:** `tools/perf.js` (dev only). `profile()` times frames standing or walking (logic and drawing apart, and the Game scene's costliest methods), `engine()` splits a frame into animations and tweens, game logic, the cull, the HUD and drawing, and `tour()` profiles each of Aldermere's regions. The browser pane caps real frames at about 30 a second, so it steps the game by hand and measures CPU time per frame; GPU time isn't included.

### iOS specifics (port phase)
- **Rendering:** SpriteKit (pixel-perfect nearest-neighbor filtering, SKTileMapNode or custom chunked tile layers for the open world).
- **Pathfinding/AI:** GameplayKit (GKGridGraph, state machines) or a direct port of the prototype's A*.
- **Input:** native touch (tap-to-command, swipe dodge) with **haptics** on hits, dodges and Ward Stone shatter; MFi/PS/Xbox controller support.
- **Saves:** 3 slots + autosave on device, **iCloud sync**.
- **Platform features:** Game Center achievements, ProMotion 120Hz, safe-area-aware HUD.
- **Store:** premium, pay once (§12a); expansions as non-consumable in-app purchases.

---
