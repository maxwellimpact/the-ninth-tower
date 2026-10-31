# The native iOS game: the plan to finish it

See also: [tech.md](../tech.md) (§13, the two-codebase plan and the prototype), [production.md](../production.md) (milestones 7 and 8).

**Where it stands (2026-10-31):** the prototype (now in the private repository `ninth-tower-ios`) plays one battle map with Brann, Pip and Sable against five kinds of foe, holds 120 fps on an iPhone 15 Pro Max with 60 foes on the field, and the user finds it "working really well". It proved the three things the plan rests on: art exported from the web build is pixel-identical, the data files load unchanged, and the combat code ports line for line.

**What's left, by size.** The web game is about 39,000 lines (not counting data). In the prototype, about 1,600 lines of it were ported, in the parts that matter most. The rest splits three ways:

| Kind | Web code | How it reaches iOS |
|---|---|---|
| Art (creatures, bosses, props, terrain, icons, buildings, dungeon kits) | gfx/, about 9,900 lines | **Exported**, not ported: the export step grows to cover it all |
| Rules and systems (combat, AI, skills, bosses, quests, dungeons, saves, items) | game/, world/, about 11,000 lines | **Ported** to Swift, checked against the web |
| Scenes and screens (the world, the HUD, the menu, the shop, the minigames, the title) | scenes/, about 8,200 lines | **Rebuilt** in SpriteKit to look and work the same |

One piece of art has to be ported, not exported: **the heroes in their gear.** The web composes each hero from gear looks at run time (`gfx/puppet.js`, `gfx/gear.js`), and every combination can't be exported ahead (8 heroes, about 106 items). The looks are already grids of pixels (data), so the composer is ported and checked pixel for pixel against the web's.

---

## How the work runs

- **The web stays the design lab.** Design changes land on the web first, as now, and are proven there.
- **A port ledger** (`PORT.md` in the native repository) lists every web module with its state: not started, ported, or out of date. A web change to a ported module marks it out of date, and the decision log row says so. Nothing is designed only in Swift.
- **Freeze as you go.** A system's design is frozen once it's ported. Changing it after that is fine; it just means porting it again.
- **Every phase ends playable on the phone,** then goes to TestFlight once the TestFlight pipeline is set up (Phase 0).
- **Checks against the web, not by eye:**
  - **Rules:** XCTest loads the web's own pure functions (`state.js`: stats, mitigation, XP; `itemgen.js`) in JavaScriptCore and compares them with the Swift versions over thousands of random inputs.
  - **Art:** the hero composer's frames are diffed against the web's, pixel for pixel.
  - **Combat:** the fight bench is ported. The same fights on both sides should land within the web's own run-to-run spread (run each side twice first, as `tools/fight-bench.js` asks).
- **The phone test tools** grow from the `-perfLog` pattern: launch flags that run a check on the phone and print its result to the Mac (`-test pack-fight`, `-perfTour`). Nobody has to hold the phone.
- **The never-again rules apply to the native build too,** especially rule 14 (nothing costs more because the map is bigger). That's proven with a native perf tour of every region.

---

## The phases

### Phase 0: groundwork *(small)*
- **Split the code by job:**
  - Engine: assets, audio, input, navigation, effects, a pixel UI kit.
  - Rules: pure logic, no SpriteKit.
  - Content: data and exports.
  - Scenes.
- **One export command for every art set:** cast, props, icons, terrain, dungeon kits, world. It gets a manifest version, so the app knows when its art is stale.
- **The checks:** the JavaScriptCore rules test and the port ledger.
- **TestFlight:** the pipeline (from Keep Defense's `ios/testflight.sh`). The user creates the App Store record once, on the website; the API can't.

### Phase 1: every fight *(large)*
- The hero composer ported, so heroes show in any gear.
- **All 8 heroes:**
  - All 98 skills: home skills, disciplines, passives and ultimates.
  - Leader swap, revives, ultimates by AI.
- **All 51 foes with their AIs:**
  - Elites and affixes.
  - Statuses, elements and gems in the damage.
- **Every boss and its phases:** the Golem, Mother Murk, the Drake, the Troll, Queen Mab, Snagtooth, Snapjaw, the Pit Champion, the Ward Echoes and Malgrim.
- **The Proving Field, native:** its muster board fights any foe or boss in isolation.
- **Done when:** every foe and boss fights on the phone, and the fight bench matches the web.

### Phase 2: the world *(large)*
- **The world exported from a booted web game** (as the arena was):
  - Aldermere's tile grid and walkable grid.
  - Every prop, building and landmark as placed.
  - The terrain painted twice, cursed and freed, as 256 px chunks.
- **Streamed in by chunk near the camera,** as the web does.
- **The curse lifts** where a Ward Stone falls: a bloom from the cursed terrain to the freed one.
- **Getting around:**
  - Tap-to-move over the whole map.
  - Swimming and the relics: the grapple, climbs, glides and lookouts.
  - Warps and campfires.
  - Heat and cold zones.
- **What's out in it:**
  - Packs that respawn, chests, gathering nodes, golden flies, lore pages, shrines, signs.
  - The townsfolk and their lines.
  - Region banners.
- **Done when:** you can walk all of Aldermere and fight its packs, and the perf tour holds 120 fps in every region.

### Phase 3: the RPG *(large)*
- **A native pixel UI kit** in the game's style: panels, lists, buttons and fitted text (`textfit.js`).
- **The menu:**
  - Party, gear, inventory.
  - Skills, passives and disciplines.
  - Crafting, the blacksmith and gems.
  - The map, lore and settings.
- **The economy:** the shop, XP and levels, loot and item generation, gold.
- **Saves:**
  - The same save schema as the web, on the phone, with three slots and an autosave.
  - iCloud sync. The saves are a few KB, so iCloud's key-value store fits.
- **Done when:** a fresh game can be played from the title screen to the first Ward Stone and saved, on the phone.

### Phase 4: quests, dungeons and the ending *(large)*
- **Quests:** the 47 errands and 57 quest NPCs (`quests.js`), including set pieces and staged ambushes.
- **Dungeons:** the 7 dungeons and the Tower's 9 floors:
  - Kits and puzzles: blocks, plates, doors, false walls.
  - The boss arenas.
  - Malgrim's five phases, the ending and the credits.
- **Side content:**
  - The Colosseum (waves, prizes, its board of champions).
  - Hexling Whack, the Archery Butts and the Frog Races.
  - The Trial Road and saved maps.
- **Done when:** the whole game can be finished on the phone.

### Phase 5: music and sound *(medium)*
- **Music as stems,** rendered from the web synth the way the sound effects are:
  - Each song's adaptive layers rendered separately.
  - Cursed and freed versions where a region has them.
  - Looped and crossfaded natively: the combat layer fading in, a region's music changing as its curse lifts.
- **The dialogue voices** (each hero's pitched blips) synthesized natively. A square or triangle tone is a few lines of code.
- A synth port stays an option if stems prove too big or too fixed. 15 songs at a minute each is about 15-30 MB.

### Phase 6: the platform *(medium)*
- **Game controllers:** the stick steers, the buttons are skills, dodge and ultimate.
- **Feel:** a haptics pass over everything new.
- **iPad:** a layout for the larger screen.
- **Game Center:** achievements.
- **Settings:** game speed, difficulty, and a 60 fps option to save battery.
- **Background handling:** pause on background and on a call, and reclaim the sound afterwards.
- **App basics:** the icon and launch screen.
- **Speed on older phones:** pick the oldest iPhone supported, and prove 60 fps on it and 120 on ProMotion phones.

### Phase 7: shipping *(small)*
- TestFlight with a few outside testers.
- **The App Store listing:** screenshots, description, the privacy form, the price (premium, pay once: vision.md §12a).
- Review and launch.

---

## Decisions (made 2026-10-31)

1. **The native code is private:** it moved to its own private repository, `ninth-tower-ios` (it's still in this repository's history up to then). The export tools stay here and write into it.
2. **iPhone and iPad.** iOS 17 or later; the iPad gets a layout pass.
3. **No save import from the web** for now: native saves only, in the same format.
4. **The design is frozen while the port runs:** the web game as it stands is what gets ported.
5. Still open: the web build after launch.
