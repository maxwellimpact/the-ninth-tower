# Plan: saves for separate maps

### Saves for separate maps **[PLAN 2026-10-24, not built]**
Today there's one save, and only Aldermere writes it: the lab, the demos and every test map never save. Maps are going to diverge. Most test maps want a save of their own that can be wiped. A future map that extends the game (a new region, an expansion) should carry the party's progress across.

**Each map says how it saves** (`save` in its definition):
- **`none`** (today's behaviour, and the default for test and profiling maps: `arena`, `pack`, `bench`, the Vast) never saves.
- **`own`** keeps a save of its own, separate from everything else, with a CLEAR button. The first visit starts either a fresh party (`start: "fresh"`, with the map's own level and gear, like the demos) or a copy of the main save's party (`start: "copy"`). Nothing flows back to the main save.
- **`shared`** extends the main game. The party itself is one and the same everywhere. Each map keeps its own world progress, and it can read (never write) Aldermere's.

**What's the party's, and what's the world's.** The save splits along this line. Aldermere becomes world `aldermere`.

| The party's (shared by `shared` maps) | The world's (one per map) |
|---|---|
| leader, recruited, active, heroes (levels, XP, skills, gear), inventory, fresh, gold, materials, potions, gems, sockets, refine, relics, difficulty, playTime, stats | flags, cleared, respawn, pos, explored + exploredW, lore, flies, flyRewards, errand state |

- **Flags are mostly the world's** (chests opened, wards broken, folk saved). A few are the story's: recruits joined, disciplines learned, Malgrim defeated, `postgame`. Those move to a small `progress` set in the party's half.
- **Reading another world's flags:** an extension reads Aldermere's with a prefix (`aldermere:ward_marsh`), and only reads.

**Shape:** `{ version: 2, party: {...}, progress: {...}, world: 'aldermere', worlds: { aldermere: {...}, <mapId>: {...} } }`.
- In play, the game keeps reading `state.flags`, `state.pos` and the rest as today. At load, the active world's fields are spread over the top level. On save, or when travelling to another map, they're folded back into `worlds[id]`.
- So almost no game code changes. Only the load, the save, and the step that switches worlds learn about worlds.

**Slots and storage:**
- `own` maps save under `ninthTower.save.v1.map.<id>`, each mirrored to its own cloud document.
- `shared` maps live inside the main save (one key, one cloud document).
- The title screen gets a MAPS list: every `own` map with a save, each with CONTINUE and CLEAR. CLEAR asks first, and wipes the local copy and the cloud copy.

**Migration:** a version 1 save loads as version 2.
- Its world fields move to `worlds.aldermere`, and its story flags move to `progress`.
- The old key is read once and rewritten. A backup of the version 1 JSON is kept under `...v1.bak` until the next successful save.

**Building it, in order:**
1. **The split.** Do the split and migration, and run every walkthrough on a migrated save. Nothing should change in play.
2. **`own` saves.** Add the slots, the clear, and the MAPS list.
3. **`shared` worlds.** Add world switching (a warp whose target is another map), and reading another world's flags.
4. **Tests.** Extend `tools/map-test.js`:
   - an `own` map saves only to its key, and CLEAR removes only it;
   - a `shared` map carries the party both ways but not the world's flags;
   - a migrated old save plays as before.

**Open questions:**
- Should an `own` map's first visit copy the main party, or start fresh?
- Should a `shared` map's foes level from the party (as now) or from their own bands?
- Do golden flies and lore count across worlds, as one collection, or per world?
