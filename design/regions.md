# Regions and the world

See also: [dungeons-relics.md](dungeons-relics.md), [progression.md](progression.md), [rules.md](rules.md).

## 12. World — **[DRAFT: structure locked, layout next]**

- **Kingdom:** **Aldermere**.
- **Hub town:** **Brightwater**, a ruined lakeside town near the start that gets rebuilt as townsfolk are rescued.
- **More towns long-term:** each region gets a small **outpost or village** (inn, merchant, bounty board, campfire) that reopens when the region is freed. Expansions can add full towns.
- **Center:** the Ninth Tower, in a blighted central basin.
- **5 regions**, each with a **hand-built interior dungeon** containing the region's relic, puzzles, keys and the lieutenant boss guarding the Ward Stone:

| Region (working names) | Biome | Notes |
|---|---|---|
| Brightwater Vale | Green vale, lake, farmland | Start + hub; tutorial dungeon |
| Mistfen | Misty marsh / sunken coast | Water-heavy, Tide Charm territory |
| Cinderreach | Volcanic badlands | Heat soft-gate, lava and brimstone |
| Frosthelm | Frozen highlands | Cold soft-gate, cliffs (Climbing Claws / Gale Cloak) |
| Gloamwood | Haunted forest | Darkness (Lantern), illusions (Seer's Lens) |
| The Blight Basin | Cursed basin around the Tower | Final area; shrinks as wards fall |

- **Scale:** about **4 minutes to walk edge to edge**. Fast-travel between campfires. **No mounts in v1.**
- **Visual style:** 2D top-down pixel art throughout (16×16 tiles, flat top-down projection, no 3D). Dungeons are the same 2D tile style with their own tilesets.
- **Target length: about 10 hours** for the main path plus a reasonable share of side content.
  - Rough budget: opening + hub ≈ 45 min, 5 regions × ≈ 1.5 h (overworld + dungeon), Tower ≈ 1 h, side content making up the rest.
  - Completionists: about 14–16 h.
- Progression graph + **staged reachability validator** (carried over from Lumen) to prove there are no softlocks. **[TODO: next phase]**

### Dialogue & saves **[LOCKED]**
- **Dialogue:** text boxes with character portraits, plus a code-generated **voice blip** per character (each has its own pitch and timbre, Animal Crossing/Undertale style).
- **Saves:** 3 manual slots + autosave (campfires, region transitions, after bosses).

---

## C12. Region Template & Recurring Features **[LOCKED from Wave 1 playtests]**
Every region is built from the same kit. When a new region is added (Wave 2+), it gets each of these. Items marked [BUILT] exist in code and only need data for new regions.

### 1. The Ward Stone story arc
The curse feeds each Ward Stone by **draining a sacred place** through a cursed vine. That's the region's mystery, and the vine is the trail that solves it.

| Region | Sacred place (the vine's source) | Where the Shadow waits | Where the true lieutenant rises |
|---|---|---|---|
| Brightwater Vale **[BUILT]** | The keep's old shrine (Undercroft) | Gatewarden arena | Rubble around the Vale stone |
| Mistfen **[BUILT]** | The abbey altar (Sunken Abbey) | Murk's nest | The bog pool beside the stone |
| Gloamwood | Elder-tree heartwood (Witchroot Hollow) | Hollow's heart | Out of the fog by the stone |
| Cinderreach | The ever-burning hearthstone (Forge of Ash) | The forge floor | A lava vent by the stone |
| Frosthelm | The astronomers' star-mirror (Rimeglass Spire) | The spire top | Ice shards spiralling up at the stone |

- **The vine [BUILT]:**
  - **Route:** two segments: overworld, stone → dungeon entrance; and dungeon, entrance → sacred place. Each is set by a handful of waypoints, and the game grows the route between them so it hugs walls, ruins and trees and climbs over low obstacles.
  - **Look:** three braided strands with leaves, thorns, side shoots, curse blooms and pulsing pods. Roots splay out and coils clutch the stone. Stolen light flows along the vine from the sigil (gold) to the stone (curse purple).
  - **When the Shadow dies:** the vine crumbles back toward the stone and stays as a grey husk, and the sigil shines gold again.
  - **Performance:** each vine is painted once into a texture. Only the pods and light specks are drawn live, and only on screen.
- **The stone's shield** stays up until the Shadow is dead *and* the true lieutenant has fallen. Hitting it while shielded gives a hint about the vine.
- **Shadow → true lieutenant:** see C8. The true lieutenant starts its fight when the party comes within about 5–6 tiles of where it will rise, so it always appears on screen.

### 2. The lead hero thinks out loud [BUILT]
The leader speaks a one-line thought the first time the player reaches each beat of the arc, as a light nudge toward what to do next.
- **Beats:**
  1. sees the stone;
  2. finds the vine;
  3. follows it underground;
  4. finds the sacred place;
  5. the vine withers;
  6. the ground stirs by the stone;
  7. the guardian falls ("break it!").
- **When they play:** each line plays once per save, never during combat, and waits until the fight is over.
- **Writing:** every new region writes its own seven lines. The same system should also cover other first-time discoveries: relic gates, a region's first lookout, and the Tower door.

### 3. Lookout tower [BUILT]
One climbable watchtower per region (6 total) that overlooks the region's key landmarks. Fenwatch, for example, sees the Abbey, the vine and the bog.
- **Climbing:** the party climbs the ladder one by one and lines up on the platform. The camera pulls back to ⅓× zoom, showing nine times the area. Tap (or Esc/Space) to climb down. Spells in flight fizzle when the climb starts.
- **First climb:** reveals the area on the map and gives 60 XP. Not usable mid-combat.
- **Performance rule:** only terrain and scenery stream in for the wider view (plus a 25% margin). Loading starts as soon as the party heads for the ladder, and the camera zooms out the moment the last hero is up, without waiting for the edges. Enemy groups outside the normal view aren't spawned, and the world's AI is frozen while you're up. The extra chunk budget (40 → 220; about 45 chunks are used) is released on the way down.
- **Placement rule:** on open ground with nothing within 4 tiles, outside any curse circle, and within about 12 tiles of the dungeon entrance or the stone.

### 4. Boss rules [BUILT]
- **Entrance:**
  1. the world freezes;
  2. the camera pans to the boss as the ground rumbles with growing shakes;
  3. the boss assembles in its own style;
  4. it roars, and the title banner shows;
  5. the camera returns to the party and the fight starts.
  - The whole sequence takes about 4.5 s.
- **Dungeon arenas:**
  - The fight starts only once the leader is about 1–3 tiles inside the arena. Stragglers are pulled in.
  - **The bars drop across the corridor outside, never on arena floor**, so nobody can be trapped inside a blocked tile.
  - Arenas are wide enough to move around the boss.
- **Overworld bosses** (true lieutenants) have no bars. Leaving about 20 tiles away resets them.
- **Party wipe:** you return to the **nearest campfire you've found** (seen within 7 tiles, or rested at) behind the loading curtain, and lose 10% of your gold. The boss resets. Inside an interior, distance is measured from its entrance.

### 5. Music
Each region adds a theme variation (§11a). Its dungeon uses the Depths variation unless it gets its own.

### 6. Key items, errands and enemies [BUILT]
- **Key items (relics):** picking one up pauses the game with a card (icon, name, what it does) until it's tapped away. Anything on the game clock, like a chest's ambush, waits. Key items are listed in the Bag.
- **Chance-meeting errands** (an NPC calling for help) always ask first ("Hold on!" / "Not now").
  - **Set pieces [BUILT, reusable]:** foes staged for an errand act out a scene until the party steps in. It is driven by `src/game/setpiece.js`, and the step's `"stage": {"mode": "harass", ...}` sets the options.
    - **How they act:** each foe holds a fixed post around the victim and walks only when clearly off it. The group swings one at a time with a visible wind-up, the victim flinches, and the foes never face the party.
    - **What wakes them:** accepting, a deliberate hit (the leader's, or a companion's aimed at them), or the party walking up after a reload. Stray shots and splash pass through them. A tap that is nearer the NPC than a foe talks to the NPC.
    - **A quiet stage:** while the errand is unfinished, world groups based within `stage.clear` tiles (default 10) don't spawn, so nobody wanders in or gets mistaken for an actor.
    - **Placement:** place set pieces about 10+ tiles from world groups, as Quill now sits on the east road.
    - **Measured** with `tools/staged-test.js`: facing flips 40 → 0.3 a second, early wake-ups 42–72% → 0, and 10/10 taps on Quill talk to him.
  - **Failing:** a failed errand clears its spawned enemies, and you can retry by talking to the NPC.
  - **Loading a save mid-errand:** errand fights rebuilt during loading use the saved party levels.
- **Ranged enemies** only aim and fire while on screen (portrait phones have a narrow view). Base reach is 75–80 px.

### 7. Interface conventions [BUILT]
- **Scrolling:** every list or page that can overflow scrolls by dragging, with a thin scrollbar. Menu buttons act when your finger lifts, so a drag never triggers one.
- **Long names:** shortened names slide sideways to show in full when tapped. The selected item's name keeps sliding.
- **New gear:** gear you haven't looked at yet gets a NEW tag and sorts to the top. Dots on the HUD bag button, the GEAR tab, the hero and the slot lead to it.
- **In-combat pickups:** shown as a small white outlined line, off to the right.
- **Outlined text:** any text drawn over the game world (tracker, toasts, button labels, names) uses the outlined font.
- **Landscape is the primary orientation** (portrait still works). In landscape, all combat controls sit in one compact row hugging the bottom edge, icons only. The leader's own buttons (ULT, DODGE, skills) are in a thin gold outline tagged with the leader's name; the companions' ULTs sit apart in a grey "ALLIES" outline. Only visible buttons are packed and framed. The native iOS build can lock to landscape.
- **Cooldowns read at a glance:** a charging button dims its icon, darkens a sweep over it and fills a green arc back in. Cooldowns of a second or more show the seconds left, and a ready button has a bright rim. The moment a button comes back it flashes a ring and pops, which also marks the half-second dodge.
- **Smart dodge:** the dodge goes where you steer. Without steering, it picks the short hop (about 3 tiles) that best clears telegraphed attacks and the reach of whoever is fighting you, into open floor. A boss always counts as a threat. It never goes further than it needs to.
- **Saves never put the party somewhere it can't stand.** Positions up a lookout or inside a blocked tile snap to the nearest open ground, both when saving and when loading.
