# Dungeons, lieutenants and relics

## C8. Dungeons, Lieutenants & Relics

### Relics (final placement)
**[REVISED from §10]** Seven relics. Each region dungeon holds one, and two are found outside dungeons.

| Relic | Found | Opens (mandatory use) | Optional uses |
|---|---|---|---|
| **Grapple Hook** (demo) | Vale: Brightwater Undercroft | Hook posts up cliffs. The broken bridges out of the Vale need it, so the world opens | Pulls enemies, strips shields, grabs distant chests |
| **Lantern of Embers** | Brightwater: the lamplighter's quest after the Vale stone (about 10 min) | Dark caves (Gloamwood's dungeon is dark) | Burns undead, lights braziers |
| **Tide Charm** | Mistfen: Sunken Abbey | Swimming and diving | Water dash in combat; drowned vaults |
| **Seer's Lens** | Gloamwood: Witchroot Hollow | Illusory walls, invisible paths | Reveals Shades and Malgrim's mirrors |
| **Stone Gauntlets** | Cinderreach: Forge of Ash | Lifting boulders, smashing cracked walls | Ground slam; cracks Basalt Brutes |
| **Gale Cloak** | Frosthelm: Rimeglass Spire | Gliding off cliffs, wind currents | Air dodge |
| **Climbing Claws** | Frosthelm outpost cave (inside the region) | Scaling marked cliffs (Frosthelm's upper plateau) | Shortcuts everywhere |

**The order rule** (checked by the reachability validator):
- **Every outer region and its dungeon can be finished with only the Grapple Hook, the Lantern and the region's own relics.** That keeps the four outer regions in any order.
- **Each dungeon also has a Sealed Vault** that needs a different region's relic. The vaults hold Uniques, which gives a reason to return. Overworld secrets use the same cross-relic idea.

### Dungeon kit and structure **[BUILT: Undercroft and Sunken Abbey rebuilt, Drowned Hollow upgraded]**
Playtest: the Undercroft was "a couple of monsters, a chest and a boss". Dungeons need Zelda-style mechanics, progression and puzzles. The redesign was dialled in off to the side in the **Dungeon Lab**, then moved into the real game (2026-10-16).
- **Live dungeons:**
  - **Brightwater Undercroft:** the lab design.
  - **Sunken Abbey:** rebuilt on the same pattern with water.
  - **Drowned Hollow:** a peg-and-crystal gate on its treasure, added in overlay mode.
- **Dungeon Lab:** still on the title screen (DUNGEON LAB, or `#dungeon`). It runs the real Undercroft with a level-5 test party, starts at the boss with a +2 boss level for fight tuning, respawns there with supplies restocked, and never saves.
- **Saving:** progress lives in `state.flags.dg_<id>`: keys, big key, map, compass, unlocked doors, pressed plates, cleared rooms, crystal and sluice states, and hints already shown. Chests use `chest_<id>_<n>`.
- **Old saves:** they migrate. A save standing in an old dungeon moves to its new entrance. The old relic chest opened means that room counts as done. The boss beaten means everything is open, except the Sealed Vault.
- **Placement:** each dungeon sits in its own area, with the camera margins of C12 rule 1 (Undercroft x 322-415, Abbey x 418-511).
- **Tests:** `tools/dungeon-walk.js` plays each dungeon start to finish, plus save/reload, old-save migration and the cave. Run it after any dungeon change.

- **Structure every dungeon follows:**
  1. An entry puzzle that teaches the dungeon's language.
  2. A hub room that shows the boss door early.
  3. Branches that pay out keys, the map and the compass.
  4. A locked miniboss room that awards the dungeon's relic.
  5. A second half that can only be solved with that relic.
  6. The big key, then the boss.
  - A fight about every 30 seconds between puzzle rooms (C5 density).
- **Kit pieces** (src/game/dungeon.js; layouts are text grids in src/data/dungeons.json, one character per tile):
  - Small keys and key doors.
  - The big key (Warden's Seal) and the boss door.
  - Push blocks and floor plates. Plates latch, so a solved room stays solved. Leaving a room with its puzzle unsolved resets its blocks.
  - Crystal switches that swap raised red and blue pegs. Any hit flips one (blade, arrow, spell, knife, hook). Shots fly over pegs. A switch only works the pegs in its own zone.
  - Sealed fight rooms: the doors slam until the room is clear, sometimes revealing a chest.
  - Hook posts across chasms, cracked walls, and the map and compass.
  - **Sluices** (new with the Abbey): a lever swaps the water between two basins (`w` and `v`), like red and blue pegs but with water. Drained floor is walkable; flooded floor needs the Tide Charm to swim. Shots fly over water. A plate can sit under a basin, so drain it first, then push the block on.
  - **Deep water:** `W` needs the Tide Charm. `Y` is deep water that also splits rooms, so a swim channel doesn't merge a sealed fight room with the room beyond.
  - **Overlay mode:** an existing noise-built cave keeps its tunnels, and the kit reads its walls from the world and adds pieces at listed tiles.
  - **Sealed Vault:** a vault door that only another region's relic opens. In the lab it's the Tide Charm, behind which is a flooded chamber you swim across to reach the Sunspire Staff. The lab party carries the Charm so the vault can be tried; in the real game it's a return visit. The final design names the Gale Cloak for the Undercroft vault; swap it in once the Cloak exists.
- **Music:** dungeons get their own theme. The Undercroft's is "The Undercroft", a stately minor march over a ticking clockwork ostinato. It plays in the lab only until the redesign is approved.
- **Vine life cycle:**
  1. Alive while the Shadow stands.
  2. When the Shadow breaks, a wave of decay crawls from the shrine back toward the stone while the vine greys out, slowly enough to watch (about 6–10 s).
  3. The dead vine stays until the region's Ward Stone is destroyed, then crumbles away entirely and is never rebuilt.
- **The cursed vine runs through it** (C12 §1): from the entrance, through the hub and under the great door to the sacred place where the Shadow stands. The lead hero's vine thoughts play along it, and it withers when the Shadow breaks. Authored as a `vine` waypoint list in the dungeon's data; the route is grown along walls automatically.
- **The Sunken Abbey** (Mistfen, the Tide Charm):
  1. **Narthex:** the flooded threshold and its sluice teach the levers.
  2. **Nave:** the hub, with a sealed fight. A deep channel, the drowned aisle, runs up to the boss door, so the boss needs both the Charm and the Sanctum Key.
  3. **East chapel:** three basins and levers to sequence, for the map and the first key.
  4. **West chapel:** locked. The Drowned Prior's sealed fight reveals the Tide Charm.
  5. **Flooded crypt:** reached by swimming out of the West Chapel. Drain it, push a block onto the plate that was underwater, and get the second key and the compass.
  6. **Bell tower:** behind deep water, so only after the Charm (this keeps the first key from being spent there). A four-crystal peg climb leads to the Sanctum Key and an ambush.
  7. **Boss:** Mother Murk's Shadow in her pool.
  - **Extras:** a Seer's Lens vault (Wave 2: the Dawnhammer), a cracked-wall secret with a lore page and a Golden Fly, and the abbey's own theme.
- **Key safety:** every key door must be checked against the order you can get keys in. The first Abbey layout let key 1 be spent on the tower door before the Charm, a softlock.
- **Must meet C12's never-again rules:** a camera margin around every room, wipes that reset fights, and doors that never pin anyone.
- **Rooms are inferred, not configured:** floor flood-filled between doors. A plate opens the shutters of its own room, and a fight seals the doors of its own room.
- **Party use:** some switches want a ranged hero (swap leader). After the relic, the hook hits switches nobody can walk to.
- **Variation per dungeon:** each region's dungeon leans on its own relic (Lantern braziers, Tide Charm water levels, Lens false walls, Gauntlet boulders, Gale Cloak wind) and recombines the kit, so no two feel the same.

### The five lieutenants (Ward Stone bosses)
Every lieutenant tests its region's relic. Phases trigger at HP thresholds.

**Every lieutenant is fought twice [LOCKED in playtest].** See C12 for the full pattern.
- **First, its Shadow, in the region's dungeon.** The Shadow is a cursed echo with 60% HP and its final phase removed. It sits at the sacred place the cursed vine is draining.
- **Then the true lieutenant, at the Ward Stone.** Killing the Shadow withers the vine. Walking up to the still-shielded stone then raises the true lieutenant from the ground around it. It has all its phases, +30% HP and +15% damage, and it carries the unique drop. Walk away and it sinks back down at full health. Once it falls, the stone can be broken.
- **Every boss gets a cinematic entrance** (C12).

**1. The Gatewarden — Hex Golem** (Vale, Brightwater Undercroft; demo boss expanded)
- **Phase 1:** slams and shockwaves (demo).
- **Phase 2:** armour plates close over its core. **Hook the plates off** to expose it.
- **Phase 3:** enrages and summons hexlings (demo).
- **Reward:** the Vale Ward Stone. The Blacksmith returns.
- **Shadow:** in the Undercroft, standing on the keep's old shrine. Dark purple and smoky, no enrage phase. Its plates phase teaches the hook. **[BUILT]**
- **True form:** rises out of the rubble around the Vale Ward Stone and carries the four unique drops. **[BUILT]**
- **Entrance:** stones rise out of the ground and fly together to form it. The Shadow's stones are dark purple and gather in curse smoke. **[BUILT]**

**2. Mother Murk** (Mistfen, Sunken Abbey) — a bog hag fused with a giant toad **[BUILT, reworked in playtest]**
- **Phase 1 (on land):**
  - slams;
  - belly-flop leaps onto a marked circle, landing with a shockwave;
  - bog-spit globs that leave poison puddles for about 4 s;
  - a tongue grab that only reaches heroes lingering 64–150 px away and pulls them to 58 px, outside her slam;
  - at most 2 mire slimes at once.
- **Phase 2 (from 65%):** she sinks into her pool. Shockwave rings pass harmlessly over swimmers.
  - Every few seconds, bubbles mark a spot on the pool's edge where she erupts. She stays up for about 3.5 s, and anyone can hit her then.
  - **Swimmers (Tide Charm)** can reach her at any time.
- **Phase 3 (from 35%):** curse fog closes in to a 150 px safe circle. Leaps, spits and grabs come faster.
- **Shadow:** in the Sunken Abbey nest, drinking from the abbey altar. It never reaches the fog phase.
- **True form:** heaves up out of a bog pool just north of the Mistfen Ward Stone.
- **Entrance:** her pool churns and foams, then she heaves up out of the water.
- **Drops:** Wyrmfang Twin (true form).

**3. The Pale Huntsman** (Gloamwood, Witchroot Hollow) — invisible stalker with spectral hounds
- **Phase 1:** hounds plus arrows from the dark.
- **Phase 2:** he turns invisible. **The Seer's Lens** shows him, and his footprints show in the leaves.
- **Phase 3:** six illusions of him; only one casts a shadow.
- **Drops:** Raven Mask.
- **Two-stage (planned):** the Shadow waits in Witchroot Hollow, draining the heartwood of the elder tree. The true Huntsman steps out of the fog beside the Gloamwood Ward Stone. **Entrance:** hounds howl, then he fades out of the mist.

**4. Forgemaster Vulk** (Cinderreach, Forge of Ash) — salamander smith with a giant hammer
- **Phase 1:** hammer combos and molten splashes.
- **Phase 2:** lava vents erupt. **Lift boulders with the Gauntlets** and drop them into the vents to plug them.
- **Phase 3:** he heats his armour. Frost or water bursts are the only way to cool and break it.
- **Drops:** Emberbrand.
- **Two-stage (planned):** the Shadow is in the Forge of Ash, draining the dwarves' ever-burning hearthstone. The true Vulk bursts out of a lava vent by the Cinderreach Ward Stone. **Entrance:** the ground cracks and glows, then he climbs out of the magma.

**5. Isolde the Rimeguard** (Frosthelm, Rimeglass Spire) — Malgrim's ice knight, once Mirelle's sister in his service
- **Phase 1:** sword duel with a frost lance.
- **Phase 2:** she takes to floating ice platforms. **Glide (Gale Cloak)** from the wind vents to reach her.
- **Phase 3:** blizzard. Mirelle (if recruited) says a story line, and Isolde's guard drops.
- **Drops:** Glacier Wand.
- **Mirelle is freed during this dungeon** (C10), so she's in the party for the fight.
- **Two-stage (planned):** the Shadow is in the Rimeglass Spire, draining the star-mirror the old astronomers kept. The true Isolde forms from ice shards that spiral together at the Frosthelm Ward Stone. **Entrance:** frost creeps over the ground and the shards spiral up into her.

### The Ninth Tower
- **9 floors.** Each outer Ward Stone you destroy **seals one floor** (and removes its elites), so the full run is between 5 and 9 floors.
- **A floor whose Ward Stone still stands** ends with a **Ward Echo**: an empowered copy of that region's lieutenant.
- **Campfires** on floors 3 and 6 for saving, with no fast travel inside.
- **Malgrim the Unkind:** 3 core phases, plus one elemental phase for each outer Ward Stone still standing.
  1. **The Unkind Duelist:** teleporting hex bolts, summons hexlings, reflects the first spell of each cast cycle.
  2. **The Nine Mirrors:** nine copies, and only the real one takes damage. The Seer's Lens or careful reading tells them apart.
  3. **The Tower Heart:** the arena breaks into platforms, and he casts a curse that can turn the leader into a frog for 6 seconds. The Frog King's blessing, if earned, makes you immune.
  - **Each extra elemental phase** (one per standing outer stone) borrows that region's hazard: flood, darkness, lava or ice.
- **Ending:**
  - The Tower falls and the curse lifts across Aldermere.
  - The king turns back from a frog (he misses it).
  - The post-game opens (C10).

---

## 10. Progressive Discovery — Relics & Gates — **[DRAFT → see C8]** *(final relic placement and the order rule)*

Relics are **party-wide story/exploration items**, separate from gear.

| Relic | In combat | In the world, it opens… |
|---|---|---|
| **Grapple Hook** | Pulls enemies, strips shields | Crosses gaps, pulls levers and items from afar |
| **Lantern of Embers** | Burns undead | Dark caves, lights braziers |
| **Tide Charm** | Water dash | Swimming and diving in deep water |
| **Gale Cloak** | Air-dodge | Gliding from cliffs, riding wind currents |
| **Stone Gauntlets** | Ground slam | Lifts boulders, smashes cracked walls |
| **Seer's Lens** | Reveals invisible enemies | Hidden paths and illusory walls |
| **Climbing Claws** | — | Scaling marked cliff faces |

- **Hard gates:** relic required.
- **Soft gates:** enemy level, hazard zones like cold or heat that drain HP without resistance gear.
- **Knowledge gates:** puzzles whose solution is learned elsewhere.
- **Lookout towers:** climbable watchtowers, one per region (C12). The first climb sketches the surrounding land onto your map.
- **Elevation:** 3 height levels with ledges you can only drop down, plus stairs.
- **Curse gates:** some areas stay sealed by Malgrim's curse until that region's Ward Stone falls.

---
