# Never-again rules

See also: [regions.md](regions.md), [tech.md](tech.md).

### 8. Never-again rules (from playtest bugs) [LOCKED]
Each of these shipped once and broke a playtest. Every new region, dungeon, room and system is checked against them.

1. **Nothing important hides under the HUD.**
   - **The bug:** the crystal room sat on the edge of its area. The camera stops at an area's edge, so the room's switch and key chest ended up under the minimap and the puzzle couldn't be read.
   - **The rule:** every interior (dungeon, cave, building) keeps a margin of solid wall around its rooms wide enough for the camera to center any room. That's at least 16 tiles beside the outermost rooms and 8 above and below. Authored as data: a dungeon's `origin` sits inside its area with that margin.
   - **HUD zones to keep clear:** the minimap at top right, the hero portraits at top left, and the combat row along the bottom. No switch, chest, plate, door or enemy should spend time there while the camera is held at an edge.
   - **Check:** screenshot every room in iPhone landscape with the safe-area insets on.
2. **Dying never locks you out.**
   - **The bug:** the party died inside a sealed fight room. The fight stayed "in progress", so its doors stayed barred and the room could never be re-entered.
   - **The rule:** a wipe puts everything the fight touched back into a state you can retry:
     - Sealed fight rooms stand down (foes removed, doors open) and re-arm.
     - Boss arenas reopen and the boss resets.
     - Spawned helpers and ambushers reset.
     - Doors you already unlocked stay unlocked, so a spent key is never lost to a death.
   - **Respawn:** the party always respawns somewhere that can reach what killed it.
   - **Check:** any new kind of gate, seal or one-way trigger must say what a wipe does to it.
3. **Doors and gates never pin anyone.**
   - **The bug:** a shutter, and in the original Undercroft the boss gate, slammed on a hero still half in the doorway. Every move left part of their footprint over solid ground, so they froze.
   - **The rule:** movement always lets a unit already overlapping something solid step toward open floor. A closing door pushes anyone its footprint catches into the room. Seals only trigger once the leader is a full step inside.
4. **Changing the world's size never breaks saves.**
   - **The bug:** widening the map skewed the saved fog of war, which is stored as one bit per tile, row by row.
   - **The rule:** anything saved per tile records the map width it was written at (`exploredW`), and older saves are read at their own width. Any change to the map's size or layout gets a save-compatibility check against an existing save before it ships.

5. **The leader is never stuck in an action.**
   - **The bug:** in the boss fight, running away or tapping an attack felt stuck while a swing played out. Dodge and skills were refused mid-swing, and frequent freeze-frames on hits stalled input too.
   - **The rule:** moving, choosing a different target or pressing a skill cancels the leader's swing at once. A swing cut before it lands doesn't hit, and its cooldown is refunded, so you can step in and back out. Skill animations can be cut once their effect is out. Freeze-frames come only from the leader's own hits, are short and spaced out, and never fire while you're steering.

6. **New art matches the existing cast.**
   - **The bug:** the first Gloamwood enemies were drawn quickly as flat shapes with spindly lines (a triangle wraith, stick-legged hounds and spiders) and looked cheap beside the shaded, outlined Vale and Mistfen creatures and the gear-built heroes.
   - **The rule:** humanoid foes are puppets built from the heroes' parts (like the Drowned and Witchlings), recoloured if needed (`registerPuppet(..., recolor)`, e.g. the Banshee's ghost palette). Creatures use the same technique as the existing ones: chunky grids or shaded blobs with a lit top-left, a dark underside and the shared ink outline.
   - **Check:** render every new sprite side by side with existing ones at 3x (a sprite sheet snapshot) before moving on.

7. **A tap lights up only what you tapped.**
   - **The bug:** tapping an ore rock flashed the dead tree beside it. The tap flash picked whatever sprite was drawn topmost at that spot, and the tree's canopy hung over the rock.
   - **The rule:** every interactable names its own sprite with `vis: () => sprite` when it's created (`addInteractable({ ..., vis })`), and the tap flash only ever uses that (or a unit's own `sprite`). Nothing is ever picked by position. A thing with no sprite of its own (a warp spot, a climb point, a false wall) gets the tap ring and no flash.
   - **Check:** every new `addInteractable` call either passes `vis` or is a spot with no sprite on purpose. Tap it in the game and make sure the flash is on it and nothing else.
8. **A dash or teleport only lands somewhere the party can walk to.**
   - **The bug:** Sable's Shadow Step dropped her behind a foe into a pocket by the water that she couldn't walk out of.
   - **The rule:** any skill or effect that moves a hero to a spot (step, dash, leap, blink) picks it with `landing()` in skills.js: open ground with a walking path from the leader. If there's nowhere reachable, the skill doesn't fire (and isn't spent).
   - **Check:** try it on a target walled in, across water and against a wall.
9. **People stand on dry, open ground.**
   - **The bug:** a hexed townsperson stood in the fen lake, and two others at the water's edge.
   - **The rule:** NPCs, townsfolk, keepers and errand givers have no water within a tile of them, no solid tile under them, and a walking path from the region's road. This also covers anything that moves them later (homes, the Ferryman).
   - **Water means anything wet:** open water, bog and shallows (and lava). The first scan only looked at open water and only at townsfolk, so Ribbit Rosie stood on a bog tile and two townsfolk stood in the shallows.
   - **Check:** after placing or moving anyone, run `tools/people-check.js` (every errand giver, keeper and townsperson, plus the Ferryman's spot at every fire), then view the spot zoomed out.
10. **World data is read through `world/content.js`, and read when it's used.**
   - **The bug:** while test maps were being built, the journal's `ERRANDS` was a copy of quests.json's errands taken when the code first loaded, so a test map would still have listed Aldermere's errands.
   - **The rule:** code reads `W` (world.json) and `Q` (quests.json) from `src/world/content.js`, never from the JSON files, because a test map swaps in its own content there. Never copy them into a constant when a module loads: read `W.campfires`, `Q.errands`… where they're used.
   - **Name it so nothing hides it:** in screens where `W` already means the screen width (the menu, the shop), import it as `{ W as WORLD }`. The bag crashed because `W.townsfolk` read the width.
   - **Check:** `grep -rn "data/world.json\|data/quests.json" src` lists only content.js, map.js (it builds Aldermere) and state.js (shop prices, a setting test maps keep). Then run `tools/map-test.js`: `arena-isolated` fails if anything of Aldermere's shows up on a test map.
11. **Anything placed in code, not data, stays off test maps.**
   - **The bug:** the Frog King, the forty lore pages, the Tower's barrier and the dungeons are placed in code (or from their own data files), so they appeared on the first test map, and a lookup of the Vale's Ward Stone crashed it.
   - **The rule:** something Aldermere has that isn't listed in world.json or quests.json checks `MAP` (from content.js) and skips itself on a test map. Lookups of a particular thing (`this.wards[0]`) allow for it not being there.
   - **Check:** `arena-isolated` in `tools/map-test.js` lists anything tappable outside the test map.
12. **Nobody is ever shut in.**
   - **The bug:** a player ended up in the Forge's great hall with the shutter behind them barred and no way out. Its plate is on the entrance side, so from the hall there was nothing to press. A sealed fight with a foe left somewhere out of reach would also keep every door barred.
   - **The rule:** standing in the room beyond a plate-held shutter latches that shutter's plates for good (you got past, so the way back stays open; every plate room is an entrance or a dead end, so no puzzle is skipped). A sealed fight whose remaining foe can't be reached for about 6 s calls that foe out next to the party.
   - **Check:** any new gate says how you get back out from both sides, and what happens if its fight's last foe gets stuck.
13. **A zero-sized screen is never drawn to.**
   - **The bug:** mid-rotation or while its toolbars slid, iPhone Safari reported a screen of zero height. The game resized to it, and making a drawing surface of that size crashed with "Framebuffer status: Incomplete Attachment".
   - **The rule:** the game ignores sizes under 32 pixels and waits for a real one. The HUD's baked textures fall back to drawing live (and retry) if a texture can't be made.
   - **Check:** anything that sizes a texture or render target to the screen guards against zero and survives the texture failing.
14. **Nothing costs more because the map is bigger.**
   - **The bugs:** found by profiling the 40x Vast (2026-10-23).
     - Path searches allocated grid-sized arrays: 9 ms a search at 40x.
     - Packs and chests were found by searching the whole list for each one, which is quadratic: a 44 ms hitch.
     - Every node, chest, sign, campfire and cottage was built at load: 14,000 objects.
     - The minimap uploaded the whole map to the GPU on every reveal: 10 ms.
     - The Tower barrier was a 64,000-command Graphics drawn every frame anywhere in Aldermere: half of every frame.
   - **The rule:**
     - Per-frame and per-check work only touches what's near the camera or the party.
     - Anything shown in the world is built with its chunk (`lazy`, `spawnChunk`) or near the screen, and dropped when it's well away.
     - Lookups keep a reference instead of searching a list by id.
     - Scratch buffers are reused, not reallocated.
     - Big static drawings are baked into a texture: Graphics are never culled.
   - **Check:** profile the 40x Vast and the dense one (`?map=vast40d`) with `tools/perf.js` (`engine()`, and `profile({ walk: true })`). Both should load in a few seconds, cost about what Aldermere does per frame, and keep their worst walking frame under 8 ms.
15. **A test never writes over a real save.**
   - **The bug:** the Colosseum test boosted the party's HP 20x so a run couldn't fail, and put the browser's saves back when it finished. But the game it left running autosaved after the next wave, so the boosted party became the save. Played in the browser pane, every HP bar ran across the screen (2026-10-25).
   - **And again** (2026-10-27): the shared test boot (`boot()` in tools/dungeon-walk.js, which `goto.js` and most tests use) deleted the browser's main save to start a fresh party, and the test game then autosaved over it. Three other tests did the same.
   - **The rule:**
     - A test game never saves. The test boot marks every game it starts as a test (`demo: 'test'`) unless the test asks for saves (`saves: true`), which only the save tests do, inside `withSaves`. No test deletes a save.
     - A test that touches saves sets them aside first and puts them back after (`withSaves` in tools/map-test.js), and the game it leaves running can't save again (its state becomes a demo).
     - Anything loaded from a save is held to its limits (HP never above max), so a bad save can't break play.
     - Bars never draw past their frame.
   - **Check:** after a test run, the browser's save is the one from before it (same `savedAt`).
16. **A tell promises its own move, and the move shows itself.**
   - **The bug:** the Cinder Drake's bite borrowed its fire breath's wind-up, the glowing throat, so every bite promised fire. The breath itself drew no fire at all: circles filled on the ground, then embers popped. And when it flew it faded almost to nothing. A playtester waited for fire that never came (2026-10-29).
   - **The rule:**
     - Each move has its own tell. A pose that warns of one move is never reused for another.
     - What a move does is drawn as an effect in the world (a jet of fire, a thrown rock), not just as circles on the ground and a hit.
     - A foe in the air stays in sight: it's drawn up above its shadow, never faded out.
   - **Check:** on the Proving Field, watch each of a foe's moves through once. Every wind-up leads to the move it warned of, and you can see each move happen.

---
