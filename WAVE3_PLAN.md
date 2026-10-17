# Wave 3 plan: Frosthelm, Mirelle, the Blight Basin and the Ninth Tower

Drafted 2026-10-17 from DESIGN.md (sections 12, C1, C3, C4, C7, C8, C9, C10, C11, C12). The design doc is the spec; this file is the build order. After Wave 3 the user does a broad consistency sweep (errands, lore and so on), so Wave 3 builds content end to end and doesn't polish older content.

**Every stage ends the same way:**
1. Test it: phone size 844x390, dungeon-walk for dungeons, fight-bench for any AI or combat change, a reachability check.
2. Add a decision-log entry to DESIGN.md.
3. Commit.
4. Publish the artifact and deploy GitHub Pages (`sh tools/deploy-pages.sh`, which the user wants after every change).

## Stage 0: Groundwork
- **Survey** what exists:
  - Freeze and Chill statuses;
  - the heat soft-gate, to copy for cold;
  - the kit-driven dungeon format;
  - the Ward Stone, vine and lieutenant template;
  - the Tower backdrop.
- **Map space:** the overworld stops at OW_H = 208 ("the highlands beyond wait for Wave 3"), and the interior strip (x 322–511) is full down to y 209.
  - Plan: grow MAP_H from 256 to about 320 rows.
  - Frosthelm then takes the southern highlands (y ≈ 208–300).
  - The Rimeglass Spire and the Tower go in the new interior rows.
  - Save safety to check first: explored-minimap serialisation (C12 §8 rule 4), terrain-chunk streaming and world-map scaling.
- **Load time:** the bigger map makes the known double world-build (main thread plus worker) about 25% slower. The user said to leave it for now. Note the new numbers, and fix it only if it becomes painful.
- **New region ids** `frost` and `basin` (the Tower is a set of interior areas). Add their level bands (C1) and region banners.

## Stage 1: Frosthelm overworld
- **Terrain:** snow, packed ice, a frozen lake, pines, rimeglass crystals. Cliffs to an upper plateau, with some faces marked climbable.
- **Cold soft-gate**, built from the heat gate's code:
  - a cold meter;
  - **Frost Tonic** (2 rimeglass + 1 herb, or 60g at the outpost);
  - a **Coldproof** trait on outpost gear.
- **Refugee camp / outpost:**
  - campfire, merchant and tonic seller;
  - the **Guardian discipline** trainer (Guard Up, Provoke, Stalwart);
  - it reopens as a village with an inn and bounty board once the stone falls.
- **Relic: Climbing Claws**, in the outpost cave. They scale the marked cliffs to the upper plateau.
- **Enemies:**
  - Frost Wolf (packs, bites that Chill);
  - Rimehorn (Freezing snowballs, then a charge);
  - Ice Wraith (flies through walls);
  - Hex Sentinel (reflects spells from the front);
  - Snow Goblin Raider (sled bombing runs);
  - mini-boss **Avalanche Troll** (falling icicles; regenerates unless Burning; drops the Troll-Hide Mantle).
- **Region kit (C12):**
  - Ward Stone and vine route (stone → spire);
  - a lookout tower;
  - region secrets;
  - errands, including the Frosthelm bounties;
  - townsfolk and lore pages;
  - Golden Flies and a shrine;
  - music variation: glassy bells, a slow waltz.

## Stage 2: The Rimeglass Spire, Mirelle and Isolde
- **Dungeon:** kit-built (dungeons.json) in the new interior rows.
  - **Relic: Gale Cloak:** glide off ledges, ride wind vents.
  - **Sealed Vault** that needs another region's relic.
  - The cursed vine runs to the astronomers' star-mirror.
- **Mirelle**, frozen in the spire (*Thaw*). Freeing her is part of the dungeon, and she joins before the boss.
  - **Puppet:** Frost Witch with a wand and hand mirror. Her art is compared side by side with the cast.
  - **Skills:** Ice Shard, Frost Prison, Glacial Wall, Shatter, Blizzard, Mirror Image.
  - **Passives:** Cold Heart, Frostbite, Penance.
  - **Ultimate:** Absolute Zero, with its L20 upgrade for the Trainers' Hall.
  - **Gear family:** wand, mirror, circlet and gown. Her uniques include the Penitent's Gown (parked since Wave 2) and the Glacier Wand.
- **Isolde the Rimeguard, in two stages:**
  - **Her Shadow** at the spire top, draining the star-mirror.
  - **The true Isolde** at the Ward Stone. Entrance: frost creeps over the ground and ice shards spiral up into her.
  - **Phase 1:** a frost-lance duel.
  - **Phase 2:** she floats on ice platforms; glide to her from the wind vents.
  - **Phase 3:** a blizzard. Mirelle's story line drops Isolde's guard.
  - **Drops:** the Glacier Wand.
- **Rule:** prove the region and dungeon can be finished with only the Grapple, the Lantern and Frosthelm's own relics (C8's order rule).

## Stage 3: The fifth stone
- **5 stones down:** the **Royal Armory** opens (Legendaries) and the Blacksmith reaches Rank 3.
- **Frosthelm village** reopens. Ice-fishing minigame only if time allows (see Out of scope).
- **The Tower's barrier** reacts: the Basin band and floor count follow the destroyed stones.

## Stage 4: The Blight Basin
- **The cursed central basin** around the Tower, shrinking as Ward Stones fall (curse gate).
- **Band:** floor = 24 + 2 × outer stones still standing.
- **Enemies:**
  - Hexborn versions of the Hex Legion (elite stats plus one affix);
  - Voidling (teleports to the weakest hero);
  - Tower Gargoyle (moves only while the leader looks away);
  - Chain Warden (chains heroes together; break it with the hook);
  - Malgrim's Mirror (copies your leader, including gear).
- **Also:** the final shrines, three Basin bounties, lore pages, and the Basin lookout (making 6).

## Stage 5: The Ninth Tower and Malgrim
- **Nine floors.** Each destroyed outer stone seals one floor, so a run is 5 to 9 floors.
  - A floor whose stone still stands ends with a **Ward Echo**: an empowered copy of that lieutenant.
  - Campfires on floors 3 and 6, with no fast travel inside.
- **Early attempt:** the door opens after the Vale stone. Malgrim warns "Come back when you are less... small". Going in is allowed, at band 32.
- **Loot:** Malgrim's Cufflink on floor 7. The Staff of the Ninth Apprentice in Malgrim's study (Pip's payoff).
- **Malgrim the Unkind:**
  - **Phase 1, the Unkind Duelist:** teleporting hex bolts, hexlings, and he reflects the first spell of each cast cycle.
  - **Phase 2, the Nine Mirrors:** nine copies, and only the real one takes damage. The Seer's Lens or careful reading tells them apart.
  - **Phase 3, the Tower Heart:** the arena breaks into platforms, and a curse can turn the leader into a frog for 6 seconds. The Frog King's blessing makes you immune.
  - **One extra elemental phase per standing outer stone:** flood, darkness, lava or ice.
- **Music:** Tower and Malgrim themes.

## Stage 6: Ending and post-game
- The Tower falls, the curse lifts, and the king turns back from a frog (he misses it). Victory jingle and credits.
- **Post-game:** the world stays open, bands rise to 30–35, and Hexborn remnants spread out.

## Stage 7: Collections to target and parked items
- **Townsfolk 20 → 30**, which brings the **Ferryman** (boat fast travel across the lake).
- **Lore pages 19 → 40,** finishing Malgrim's story and the court-mage twist.
- **Golden Flies 33 → the full count:** the **Gold Fly in Amber**, then the **Royal Blessing** (+15% max HP, frog-curse immunity).
  - The doc says both 50 and 60; settle it.
- **Lookouts → 6** (the Wanderer's Charm).
- **Bounties → at least 10** (the Hunter's Tooth); the target is 18.
- **Shrines → 12.**
- **Sealed Vaults → 5.**
- **Also:** the remaining Kesh and Wren uniques in Frosthelm, and the Windrunner Leathers (Frosthelm sky ledge, Gale Cloak).

## Out of scope for Wave 3 unless the user asks
- The Tower of Echoes (post-game boss rush).
- The minigames for the other villages: forge rhythm, ice fishing, lantern run.
- The 8 personal hero quests, and the Legendaries tied to them.
- Re-forging and Royal gems.
- The broad consistency sweep of existing errands and lore (the user's next pass).

## Handoff (2026-10-17, before compaction)
Stages 0-6 are committed, deployed and published (last: 0973f6b). **Stage 7 is in progress and uncommitted.** The data is written (see `git diff`): 5 townsfolk (now 30), 15 lore pages (now 40), 19 flies (now 58 + 2 minigames = 60), 4 shrines (now 12), new flyRewards tiers (40, 50 Gold Fly in Amber, 60 Royal Blessing), items gold_fly_amber / hunters_tooth / mirror_truths, the mirrorshard material, the Shattered Mirror errand (Marek), and Ferryman + 4 landing NPCs (folk: 30, ferry: true).
Still to do for Stage 7:
- folk look `ferryman` in heroes.js FOLK
- quests.js: route `npc.ferry` to a new `sc.ferryTalk(npc)` (30g, choose another landing, warp)
- perks: `amber` (uncollected flies as map markers), `huntertooth` (+15% vs elite/named in dealDamage), `truths` (Mirelle's offhand reflects one enemy shot every 5s, in updateEnemyShots)
- Hunter's Tooth: on completing the 10th BOUNTY errand, give the item
- talkFrog: blessing text for the 60-fly Royal Blessing (frog-curse immunity); `ring_luck` look falls back to the default gem colour
- region-check every new position (frost, basin, meadow, marsh, gloam, cinder, vale); fix any on solid tiles
- test, DESIGN log, commit, deploy, artifact publish
