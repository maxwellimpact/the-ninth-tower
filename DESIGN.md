# The Ninth Tower — Design Doc

> Living document. Sections marked **[OPEN]** still need a decision. Sections marked **[DRAFT]** have a direction we're refining. **[LOCKED]** sections are agreed.
> Last updated: 2026-10-14. **Part II (full game content) starts after §15.**

---

## 1. Vision

An **open-world, real-time action RPG** in tile/pixel art. It takes:

- **Breath of the Wild's** free exploration and progressive discovery: relics open up new areas.
- **Battleheart Legacy's** deep skill system and gear you upgrade over time.
- **A party of three:** you command the leader, and smart AI controls the other two.

The story is classic: an **evil wizard** has cursed the realm, and a band of heroes sets out to bring them down.

Platform: **a real native iOS game** is the shipping target. The **web build is a prototyping tool only**: a fast, cheap way to settle design, feel, art and audio before paying iOS's cost and cycle time. It is **not** wrapped in a WebView. Once the design is settled, the game is rebuilt natively (see §13).

### How it differs from Tales of Lumen
| Tales of Lumen | This game |
|---|---|
| Screen-by-screen rooms (16×11) | One continuous scrolling world |
| Mostly linear unlock order | Non-linear: after the opening, players choose the order |
| Zelda-style item kit | Full RPG: party, classes, gear, magic, shops, loot |

---

## 2. Design Pillars

1. **Curiosity is rewarded.** Every horizon has something: a chest, a trainer, a vista, a locked door to come back to.
2. **Always getting stronger.** Gear, spells and party members improve all the time through drops, shops, upgrades and finds. Every session should end with the player a bit more powerful.
3. **Relics are verbs.** Traversal relics change how you move and fight, and they open the world.
4. **Systems interact.** Fire burns brambles, frost freezes water, storm powers machines, earth breaks stone.
5. **Companions are never a chore.** AI allies should feel smart. If the player is ever annoyed by them, that's a bug.
6. **Pocket-sized sessions.** You can make meaningful progress in 5–10 minutes (it's a phone game too).

---

## 3. Story — **[LOCKED: Concept A + B hybrid]** *(hub services by Ward Stone count: see C9)*

### Premise
The wizard **Malgrim the Unkind** has raised a black spire, **the Ninth Tower**, in the middle of the realm. Its curse spread across the kingdom:

- Townsfolk were turned into creatures and scattered.
- The castle became glass, and **the king is a frog**. He's still issuing royal decrees, which nobody can take seriously.

The Tower is **visible from almost everywhere** in the world. It's a permanent goal on the horizon.

### Structure
- **Five Ward Stones** spread across the regions power the Tower's barrier. One of Malgrim's **lieutenants** guards each.
- **Destroying a Ward Stone:**
  - lifts the curse on that region (colors return, villages reopen),
  - **rescues townsfolk**, who return to the hub town and reopen a service (blacksmith, enchanter, trainers, alchemist, stables…),
  - **weakens the Tower**: fewer floors, weaker final-boss phases, fewer elite guards.
- **Non-linear:** after the opening, the player chooses which Ward Stones to go after and in what order. A skilled player can attempt the Tower early, but it's brutally hard.
- **Endgame:** storm the Ninth Tower and defeat Malgrim.

### Tone
Adventurous and warm, with Battleheart-style humor in the dialogue: the frog king, bickering party members, cursed townsfolk with odd side effects. The threat from Malgrim is still played straight.

### Hub town — **[OPEN: name]**
Begins as a nearly deserted ruin near the starting area. Each rescue visibly rebuilds it: new buildings, NPCs, shop stock and music layers. It's the clearest way to see your progress.

| Rescued from | Restores |
|---|---|
| Opening area | Inn/campfire, general store |
| Ward Stone 1 | Blacksmith (refinement) |
| Ward Stone 2 | Enchanter (gems, runes) |
| Ward Stone 3 | Trainers' hall (advanced skills) |
| Ward Stone 4 | Alchemist (potions, elixirs) |
| Ward Stone 5 | Royal armory (legendary gear) |
| Side quests | Stables, cartographer, bard, etc. |

*Ward Stone order is player-chosen, so the order in this table is only illustrative. We'll decide in the world-design phase whether services are tied to particular regions or to how many stones are cleared.*

### Considered and set aside
- **C. Court Mage's Betrayal:** could come back as Malgrim's backstory or a twist (for example, Malgrim was once Pip's master).
- **D. Lich-King:** the "region regains color when freed" visual is kept as part of lifting the curse.

---

## 4. Heroes & Party — **[DRAFT]**

### Preset heroes (no character creator)
All heroes are **hand-designed presets**. That keeps the art budget manageable: one sprite set per hero, drawn well.

- **You start with a single hero** and recruit others through the story, exploration and side quests.
- **The active party holds at most 3.**
- **[LOCKED] Choose 1 of 3 starting heroes:** **Brann** (Guardian), **Pip** (Arcanist) or **Sable** (Duelist).
  - **The two you didn't pick become your first recruits.** One joins in the opening and one in the first region, so all three are available early and the party mechanics are in play quickly.
  - **The story is shared.** Each starter gets a short personal intro scene and some dialogue variants. Other heroes react to who your leader is, so their banter changes with your choice.
  - The remaining 5 heroes are recruited through regions and side quests.

**Draft roster (8):**

| Hero | Class | Role | Personality |
|---|---|---|---|
| **Brann** | Guardian | Tank | Gruff ex-castle-guard, protective, bad at jokes |
| **Pip** | Arcanist | Ranged caster | Runaway wizard's apprentice who knows Malgrim's tricks |
| **Sable** | Duelist | Melee damage | Thief with a heart of mostly gold |
| **Wren** | Ranger | Ranged damage | Quiet scout; hawk companion spots hidden items |
| **Brother Oake** | Cleric | Healer/support | Monk exiled for "excessive optimism" |
| **Kesh** | Berserker | Melee bruiser | Cursed townsperson who kept some beast traits |
| **Mirelle** | Frost Witch | Control caster | Former servant of Malgrim, seeking redemption |
| **Gizmo** | Tinkerer | Summoner/traps | Gnome inventor; turrets, mines, gadgets |

### Party structure
- **Up to 3 active members:** a leader plus up to 2 companions. Swap who's in the party at campfires and the inn.
- **Only active heroes earn XP.** Benched heroes don't level. This makes your party choice meaningful.
  - **Catch-up valve [LOCKED]:** a newly recruited hero joins at about the party's average level. Trainers in the hub town sell "Veteran's Tomes" (expensive) to raise a benched hero's level, so experimenting is never a dead end.
- **You control only the leader** using tap-to-command (see section 8). **Companions are fully AI-driven.**
- **[LOCKED] Swap leader at any time, including mid-fight,** with one button (there's a short cooldown so it can't be spammed). You take over that hero, and the previous leader becomes AI-controlled.
- **Ultimates:** each companion has an ultimate that charges in combat. Tap their portrait to fire it. This is the only direct command you give a companion.
- **Downed, not dead:** fallen members can be revived mid-fight, and companions revive each other. A full party wipe sends you to the last campfire with a small gold penalty.

---

## 5. Companion AI — **[DRAFT]**

**Goal:** companions should feel like competent co-op partners. They must never be something the player has to babysit.

### Movement & positioning
- **Skills at the right moment, never spam:** each companion skill has a "worth it now" rule, and a companion uses at most one skill about every 1.5 s on top of cooldowns. Every skill needs a sensible single-boss trigger as well as a crowd one. For example, Fan of Knives fires point-blank on a boss or elite, not only in a crowd. Gap-closers never blink into a telegraphed attack. Measured in the lab boss fight: Pip 2 Fireballs, Sable 2 Fans and 3 Steps per 30 s.
- **Commit to dodges [LOCKED from playtest]:** a companion escaping a telegraphed zone keeps going until well clear, then waits just outside it (facing the foe, attacking if in reach) until the attack resolves. It never steps back in early. Before this, Sable flickered on a zone's edge about 12 times a second.
- **Pick dodges like a person [from playtest, 2026-10-16]:** companions used to sidestep every wind-up marker the instant it appeared. In a crowd they hopped about all fight and ended up out of range. Now:
  - **Reaction:** they react after a short delay (0.2-0.36s).
  - **Lock:** they wait for the blow to lock in before moving.
  - **What they always dodge:** bosses, elites, big blasts, hazards (rocks, puddles, bombs), a hit worth 30%+ of their health, or anything once they're below half health.
  - **Ordinary swings:** they dodge only sometimes: 60% when aimed at them, 20% when aimed at someone else.
- **Shots cross water [from playtest, 2026-10-17]:** line of fire follows the projectile rule. Walls, rock and trees stop a shot; water, bog, chasms and low pegs don't (`Game.shotClear`). This applies to heroes, enemy archers and web-spitters.
- **Ranged companions hold the shore [from playtest]:**
  - Out of range, they walk over dry land to a firing spot: in range, with a shot, nearest to where they stand.
  - They don't follow a swimming leader out.
  - Knocked or dragged into water, they wade back out before shooting.
  - They never back off into a pool.
- **Lingering ground hazards [from playtest]:** puddles, burning trails and molten pools are tagged `linger`.
  - Companions steer round them rather than walking in and hopping out.
  - They step fully clear (the poison spreads a little past its marker).
  - Blocked for over a second, they give up and walk through for 1.5s.
  - A dodge leaves by the quickest open way: not into walls, not into water unless already swimming, and not into another danger.
- **Measured against Mother Murk (tools/murk-test.js, seeds 5/9), old -> new:**
  - Pip in the water 67/59% -> 1/6%;
  - has a shot 1/18% -> 87/90%;
  - dodges started 44/37 -> 13/21 a minute;
  - companions doubling back 102/82 -> 11/15 a minute;
  - time in poison 4/1.3% -> 0.2/2.2%.
- **Dodging, refined [2026-10-17]:**
  - Companions leave a danger by the quickest open way, which also stops them freezing on a marker's centre.
  - For a tracking blow, their reaction counts from the moment it locks.
  - The Gatewarden's leap locks at 0.5s and lands at 0.78s (r 30). golemTest: slams landed 93%, 17 hits a minute against a player who dodges every marker after 0.3s.
- **Tongues are visible:** Murk's and the Croaker's tongue whips out, latches ("GRABBED!") and reels the hero in, then snaps back. The aim line plus a closing mark tells you it's coming.
- **Wind-ups track [from playtest]:** for the first half of a melee wind-up, the foe shuffles after its target and the marker follows, then locks. Stepping away early no longer dodges everything; timing does.
- **Measured (fight-bench, 7 fights x 2 seeds), old -> new:**
  - companions dodging 9.5-43% -> 1-15% of the time;
  - in reach of their target 44-70% -> 67-80%;
  - party damage dealt +29%, taken +53%. Fights end sooner, so damage taken per fight is about +19%. Bench heroes have 50x health, so the "dodge when hurt" rule never fires there.
- **The Gatewarden [from playtest]:**
  - It is a little faster (speed 24 -> 32).
  - It throws rocks in every phase on its own clock, aimed at whoever stays out of slam reach. Before, rocks only came in phase 2, and only while it was walking: about 0 a minute.
  - A whiffed slam is followed by a leaping slam whose marker tracks the target, then locks.
  - Against a player who dodges every marker after 0.3s, it now lands 67-78% of its slams (13-15 hits a minute). Before: 7-50% (1-5 hits a minute).

- **Ranged allies keep their distance [LOCKED from playtest]:** they hold about ¾ of their range from their target. They back off when it comes inside that, with slack so they don't jitter, sliding sideways off walls. They shoot while backing off unless the foe is right on top of them, when they just run. They only close in until the target is in range, and they can hang back further from a melee leader before regrouping.
- **Never block the leader.** Companions have *soft* collision with the leader and step aside in narrow corridors.
- **Formation follow:** loose trailing positions with a leash. If a companion falls too far behind or gets stuck, it catches up off-screen or with a quick "dash" effect, never a visible pop-in.
- **A loose lead, not a tight tow [LOCKED from playtest]:**
  - **Slack:** a companion stands still inside a slack radius and only moves again once the gap has really opened.
  - **Eased speed:** speed ramps with the gap, at the leader's pace plus a catch-up term, so starts and stops are never instant.
  - **Smoothed offset:** the slot's offset from the leader is smoothed, so the stair-steps of a tap-to-walk path and quick turns don't yank it. The slot itself never trails behind.
  - **Paths:** once a companion has had to path round something, it keeps the path for half a second and skips waypoints it can already see past.
  - **Measured** with `tools/follow-test.js` (9 walking patterns, including tap-to-walk): twitches 0.17 → 0.03 a second, stop-start 0.31 → 0.09, jerk 2.6 → 2.1, trailing gap 17 → 23 px.
- **Terrain-aware:** companions automatically follow through ledge drops, swimming, gliding and grapple points the leader uses. Relics are party-wide, so a companion never strands the party.
- **No puzzle interference:** companions don't step on pressure plates, push blocks, pull levers or trigger traps unless asked.

### Combat behavior
- **Role-based logic:**
  - **Tanks** grab aggro and stand between enemies and squishier allies.
  - **Healers** prioritize the lowest HP%, pre-shield before telegraphed big hits, and keep their distance.
  - **Ranged** characters kite and stay at their optimal range.
  - **Melee** characters flank instead of stacking on the leader.
- **Respect the leader's intent:** companions engage what the leader engages. They don't run off and pull extra enemies packs.
- **Fights start on screen [LOCKED from playtest]:** the phone's landscape view is only about 195 px tall, so a foe used to notice the party from off screen.
  - **Noticing:** a foe now notices the party only while on screen. That covers aggro, packmates joining, a fleeing foe's call for help, lurkers surfacing and set pieces waking.
  - **Strays:** shots and splash that miss pass through idle foes off screen.
  - **Self-picked targets:** skills, ultimates and auto-aim pick only foes that are already fighting or in view (`fairTarget`).
  - **Already fighting:** a fight that is already going may run past the screen edge, such as a chase or an archer at range.
  - **Measured** with `tools/engage-test.js` at iPhone landscape size: off-screen fight starts 16 of 28 → 0 of 25.
- **Dodge telegraphs:** companions step out of boss area-attack warning zones. They're deliberately a bit less perfect than an ideal player, but never stand in fire.
- **Smart resources:** companions don't waste big cooldowns on trash mobs, and they save heals for when they matter.
- **Out of combat:** companions return to formation quickly and stop attacking objects in the world.

### Light player control (no micromanagement)
- **Per-companion behavior preset** chosen at campfires: *Balanced* / *Aggressive* / *Cautious* / *Support*.
- **Optional, unlockable "tactics" slots** (light version of FF12's gambits) for players who want to tune behavior: for example, "Heal anyone below 40%" or "Prioritise casters".

### Testing
- An **AI behavior test arena** in dev builds with scripted scenarios: corridor, boss telegraph, healer triage, ledge-follow. Run headlessly where possible, as with Lumen's validators.

---

## 6. Class & Skill System — **[DRAFT → see C3]** *(Part II proposes 3 active skills, automatic stat growth instead of stat points, and full skill lists)*

- **Each hero has a home class** with its own skill tree, which defines their identity.
- **Trainers around the world** teach additional disciplines (Blade, Guardian, Arcane, Shadow, Ranger, Cleric). Some trainers are behind relic gates.
- Learning and ranking up skills costs gold plus skill points.
- **Loadout:** 4 active skill slots + 2 passive slots per hero.
- **Level-ups:** stat points go into **Might / Guard / Focus / Agility**.
- **[LOCKED] Home class + one secondary discipline:** each hero keeps their home tree and can learn **one** secondary discipline from a trainer. Respec costs gold at the trainers' hall. A Brann tank with Cleric secondary self-heals; a Pip caster with Shadow secondary blinks and poisons.

---

## 7. Equipment System — **[DRAFT → see C4/C5]** *(Part II proposes 4 visible slots + 2 trinkets, no Feet, fixed stats, generated tier gear + authored uniques)*

- **Slots:** Weapon, Off-hand, Head, Body, Feet, 2× Trinket.
- **Rarity:** Common → Fine → Rare → Epic → Legendary. Higher tiers roll more bonus properties.
- **Ways to get gear:**
  - **Shops:** stock grows as the hub town is rebuilt and more Ward Stones fall.
  - **Drops:** enemies, elites and bosses.
  - **Chests and secrets:** hand-placed **unique named items** in hard-to-reach places (the reward for exploring).
  - **Crafting:** blacksmith recipes from gathered materials.
- **Upgrading:**
  - **Blacksmith refinement:** +1 to +10 using gold + materials, so a favorite item stays useful.
  - **Enchanting:** socket **gems** for elemental damage or resistances.
  - **Salvage** unwanted gear into materials.
- **Weapon families per class:** for example, Brann uses sword/mace + shield, Wren uses bows, Pip uses staves and wands. This limits how many weapon sprites we need.
- **[REVISED 2026-10-14] Equipped gear shows on the character (paper-doll).** Weapons, armor and headgear each change the hero's look. Unique items have unique looks.
  - Implementation: gear is drawn as layers by the puppet renderer and **baked into the hero's sprite sheet when equipment changes**. This keeps runtime cost at one sprite per hero, and the same approach works natively on iOS.

---

## 8. Combat & Controls — **[DRAFT]**

### Leader control: tap-to-command, Battleheart Legacy style **[LOCKED]**
- **Tap/click the ground:** the leader moves there.
- **Tap/click an enemy:** the leader targets it and **auto-attacks** with their weapon combo, pathing into range.
- **Swipe (touch) or Space/right-click (web):** dodge roll with brief invincibility, in the swipe direction or away from the cursor.
- **Skill buttons (4):** cast at the current target or direction. Some skills support drag-to-aim.
- **Portrait taps:** fire a companion's ultimate. **Swap leader** button.
- **Web extras:** optional WASD movement and number keys for skills.

### Feel
Hit-stop (2–4 frames), white hit-flash, knockback, light screen shake, damage numbers, crit sparks.

### Enemies & bosses
- Readable windups, elemental weaknesses, and some that need a specific approach (shielded, flying, burrowing).
- **Lieutenant bosses** at each Ward Stone are multi-phase. They test that region's relic and reward party synergy.
### Level scaling **[LOCKED: per-region bands]**
- **Each region has a level band** (for example, 4–9). Enemies scale to the party's level **but are clamped to that band**.
- **Under-leveled:** a region above your band is noticeably dangerous, which steers you elsewhere without a hard wall.
- **Over-leveled:** going back to an early region is easy and quick, but still worth it for secrets.
- **The band floor rises as Ward Stones fall**, so the world gets harder as Malgrim gets desperate and nothing becomes trivial.
- **The Tower** has its own band, which drops as Ward Stones are destroyed.
- **Elite and named enemies** sit 2–3 levels above their region's band.

### Difficulty modes **[LOCKED: Easy / Normal / Hard]**
| | Easy | Normal | Hard |
|---|---|---|---|
| Damage taken | ×0.6 | ×1.0 | ×1.4 |
| Enemy windups | Longer, clearer | Standard | Shorter; more combo attacks |
| Enemy aggression | Fewer attack at once | Standard | Packs coordinate and flank |
| Elites per area | Fewer | Standard | More, with extra affixes |
| Wipe penalty | None | Small gold loss | Larger gold loss |
| Loot | Standard | Standard | Slightly better rarity odds |

- **Companion AI is equally smart on every difficulty.** Hard makes enemies harder, not allies dumber.
- You can change difficulty anytime in Settings.

### Side content **[LOCKED: all three types]**
- **Quest log:** NPC quests with story and character moments. Most hero recruitments are quests.
- **Bounty boards** in the hub town and outposts: hunt named elites for gold, materials and gear.
- **Collectibles:** lore pages (Malgrim's backstory, possibly the court-mage twist), hidden shrines (+stat or skill-point rewards), and **cursed townsfolk** to find and rescue (feeds the hub town).

---

## 9. Magic System — **[DRAFT → see C2/C3]** *(Part II replaces Earth with Venom and drops the Focus/mana bar)*

- **Elements:** Fire, Frost, Storm, Earth, Light, Shadow, with elemental strengths and weaknesses on enemies.
- **Spells** are learned from trainers and tomes, and they **level up with use** and with skill points.
- **Rune modifiers** socket into spells: *Split*, *Pierce*, *Chain*, *Linger*, *Echo*.
- **World interactions** (Fire burns brambles, Frost freezes water, Storm powers machines, Earth cracks stone) are **optional shortcuts and secrets**. Mandatory gates always use relics.
- **Focus** (mana) bar per hero that regenerates in combat. Melee hits restore a little Focus.

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

## 11. Art & Animation — **[DRAFT]**

- **Tiles:** 16×16. **Characters:** about 16×24.
- **Internal resolution:** about 384×216 with pixel-perfect integer scaling. The width stretches to fit phone screen ratios.
- **Palette:** one locked palette of about 40 colors, with an accent sub-palette per region. Cursed regions are desaturated with a purple-grey tint.
- **Characters:** 4 directions with mirroring. About 6-frame walk, 4–6 frame attacks with smear frames, squash-and-stretch on rolls.
- **8 preset heroes:** each needs idle, walk, attack (×2–3), cast, dodge, hurt, downed and victory animations.
- **Living world:** swaying grass, animated water, particles, wildlife that reacts to you.
- **Lighting:** a light mask in caves.
- **[LOCKED] Day/night and weather are cosmetic only for v1.** They cover a palette tint cycle, rain and fog particles, and fireflies at night, with no effect on gameplay. They may become systemic later (night-only spawns or secrets).
- **Effects:** additive particles per element, dither-fade transitions, a big **colour-bloom when a Ward Stone falls** and the curse lifts.
- **Art source — [DRAFT: procedural/drawn-in-code first, gated by a POC]**
  - Heroes, tiles and effects are drawn in code (as in Lumen), but upgraded for animation: frames defined as layered pixel grids with a shared palette, plus tooling to preview animations.
  - **The art POC (Milestone 0) decides** whether we commit, go hybrid (code-drawn characters + asset-pack tiles, or the reverse) or switch to packs.

---

## 11a. Audio — **[LOCKED: code-generated, "8-bit plus"]**

Everything is generated at runtime with WebAudio, as in Lumen. There are **no audio files**, which keeps the build self-contained.

### Music: chiptune with a bit more richness
- **Core voices:** 2 pulse (variable duty cycle), triangle bass, noise percussion. This is the NES-style base.
- **"Plus" layer:**
  - a soft saw/detuned pad for warmth,
  - vibrato and pitch slides,
  - light echo/reverb (convolver or feedback delay),
  - gentle stereo spread,
  - a sub-bass under the triangle.
  - The target sound is *Shovel Knight* or the Famicom expansion chips: unmistakably pixel, but full.
- **Sequencer:** a small tracker-style pattern format (notes and instrument per step), so songs are data and easy to write and tweak.
- **Adaptive layers:**
  - **Exploration → combat:** drums and an extra lead fade in when enemies engage.
  - **Cursed vs. freed region:** the same theme in a minor key, detuned and sparse while cursed. It resolves to major with full instruments when the Ward Stone falls.
  - **Hub town grows musically:** each rescued service adds an instrument layer to the town theme.
- **Track list (v1):** title, hub town, 5 region themes, dungeon/cave, lieutenant boss, the Ninth Tower, Malgrim, victory jingle, level-up and item-get fanfares.
- **Region variations [BUILT]:** every region gets its own variation of the main theme, each in its own key and tempo with its own instrument colours.
  - **Brightwater Vale:** the home theme.
  - **Highmeadow:** brighter and quicker, with a flute-like lead.
  - **Mistfen:** slow and minor-leaning, with a murky pad.
  - **The Depths** (caves and dungeons): sparse and echoing.
  - **Hearth** (shops and the tavern): a cosy jig.
  - **Changing themes:** the music crossfades when you cross a region border, after you've been in the new region for about a second.
  - **Future regions** each add one more variation in the same pattern data: Gloamwood (hushed, music-box), Cinderreach (low drones and anvil hits), Frosthelm (glassy bells, a slow waltz).

### Sound effects
- Synthesized per event using envelope, pitch sweep, noise and filter.
- Each hero has a distinct attack sound per weapon family.
- Spells: one character per element. Fire crackles (noise + low sweep), frost is glassy (high sine pings), storm is a zap (square + random pitch).
- UI, footsteps by terrain, hit/crit/block, pickup, gold, level-up, Ward Stone shatter.
- **Small random pitch variation** on repeated sounds so they don't get tiring.
- **The art POC includes an audio test**: a short exploration loop, a combat layer, the cursed→freed transition, and the core sound effects.

---

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

## 12a. Business Model — **[LOCKED]**

- **Premium, pay once.** No in-app purchases, energy timers or premium currency. Nothing in the game (upgrades, loot, revives, speed-ups) is ever sold for money; the user's rule is to earn money for effort, never to milk players.
  - The economy is tuned for **fun pacing, not grind**: drops and gold should feel generous.
- **Future expansion packs** (paid DLC) are possible. To make them cheap to add later:
  - All content is **data-driven**: regions, heroes, items, enemies and quests are defined in data files, not hard-coded.
  - The world map leaves **room at the edges** (sealed borders, an unexplored coast, a sky island) where expansion regions can attach.
  - There's a **post-game state**: after Malgrim falls, the world stays open so expansions and cleanup make sense.

---

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

### iOS specifics (port phase)
- **Rendering:** SpriteKit (pixel-perfect nearest-neighbor filtering, SKTileMapNode or custom chunked tile layers for the open world).
- **Pathfinding/AI:** GameplayKit (GKGridGraph, state machines) or a direct port of the prototype's A*.
- **Input:** native touch (tap-to-command, swipe dodge) with **haptics** on hits, dodges and Ward Stone shatter; MFi/PS/Xbox controller support.
- **Saves:** 3 slots + autosave on device, **iCloud sync**.
- **Platform features:** Game Center achievements, ProMotion 120Hz, safe-area-aware HUD.
- **Store:** premium, pay once (§12a); expansions as non-consumable in-app purchases.

---

## 14. Milestones

0. **Art proof of concept: decides the art pipeline.**
   - **Scope:**
     - A small slice of world (about 3×3 screens' worth, scrolling): meadow edge, a bit of forest, water with a ledge, and the ruined hub-town gate.
     - **3 heroes** (Brann, Pip, Sable) with idle, walk, attack, cast and dodge.
     - **2 enemies** (a cursed critter and a goblin-type).
     - Effects: hit-flash, fire bolt, the curse-lift color bloom.
     - **Audio:** an exploration music loop, a combat layer fading in, the cursed→freed music transition, and core sound effects (swing, hit, crit, fire bolt, dodge, pickup, level-up).
   - **Tooling:** a palette file, a pixel-grid sprite format with layers, and an in-browser **sprite/animation previewer**.
   - **Pass criteria:** heroes read clearly at phone size; animation feels fluid (not stiff); tiles join without visible seams; effects feel punchy; drawing one new hero's full set takes a reasonable amount of time.
   - **Outcome:** commit to code-drawn art / go hybrid / switch to packs.
1. **Tech spike:** scrolling chunked world, collision, elevation and ledges, camera, tap-to-move pathfinding.
2. **Combat + AI slice:** leader + 2 AI companions (tank + healer), 2 enemy types, hit feel, AI test arena.
3. **RPG systems:** stats, gear, shop, blacksmith, skills + secondary discipline, leader swap, XP for active heroes only.
4. **World design:** full map, progression graph, level bands, validator.
5. **Content:** regions, lieutenants, heroes, quests, hub-town rebuild.
6. Polish the web prototype until the design is settled (**design freeze**).
7. **Native iOS build:** SpriteKit project, asset/data import pipeline, port of game logic, native audio, touch + haptics + controllers, iCloud saves.
8. iOS polish, TestFlight, launch.

*Milestones 0 and 1 can overlap: the POC slice is a good first test for the chunked-world tech.*

---

## 15. Title & Names

**[LOCKED] Title: _The Ninth Tower_.** Expansions can use subtitles, for example *The Ninth Tower: The Sunken Crown*.
*Before shipping, check App Store and Steam name availability and trademarks.*

**[LOCKED]** Kingdom: **Aldermere**. Hub town: **Brightwater**.


---

# Part II — Full Game Content **[DRAFT for review, 2026-10-14]**

This part turns the systems above into the actual content list for the full build: every hero's skills, every piece of gear, upgrades, enemies, bosses, and the order the game unfolds in. Numbers are starting values. They all live in the JSON data files and `tuning.json`, so balance changes never need code changes.

Where this part changes an earlier **[DRAFT]** section, it says so, and the earlier section points here. Items marked **(demo)** already exist in the prototype.

---

## C1. Core Numbers

### Levels
- **Level cap: 35** (§16 Q8). The main story is balanced to finish around **level 28**. Levels 29–35 are for the post-game and Hard mode.
- **XP per level:** `90 + 85·L + 4·L²`. This replaces the demo's `50 + 50·L + 8·L²`, whose late levels would take 40–55 minutes each.
- **Enemy XP:** base XP × (1 + 0.15 × (enemy level − 1)), as in the demo.
  - Elites give ×2.5.
  - Every living party member gets the full amount.
  - **Over-level damping:** enemies more than 3 levels below a hero give that hero 25% less XP per extra level (minimum 10%). Farming easy areas is slow, so nobody accidentally over-levels.
- **Skill points:** 1 per level, plus bonus points from shrines and some quests (§16 Q2). That's about 27 from levels plus about 15 bonus points by the end of the story.

### Pacing math
**Encounter density (what the levels are tuned against):**
- **Overworld:** one enemy group every **45–75 seconds** of exploring.
  - 3–4 enemies per group; 1 group in 5 has an elite.
  - Fights last about 15–25 seconds, so roughly a third of field time is combat and the rest is travel, secrets and gathering.
  - Each region also has deliberate quiet pockets: villages, shrines, vistas and puzzle spots with no enemies.
- **Dungeons:** denser, with a fight about every 30 seconds between puzzle rooms.
- **Per outer region:** about 25–35 enemy groups in the overworld (the demo's Vale + Mistfen slice has 24) and 12–15 in the dungeon.
- **Respawns:** cleared overworld groups come back after a few minutes away, never in sight.

**Averaged over all play time** (towns, menus and dialogue included), that's about **2 kills per minute**, plus about 20% extra XP from quests, bounties and bosses. Resulting pace:

| Level-up | XP needed | Minutes for that level | Total play time |
|---|---|---|---|
| 1 → 2 | 179 | ~5 | 5 min |
| 3 → 4 | 381 | ~9 | 25 min |
| 5 → 6 | 615 | ~12 | 45 min (end of Vale) |
| 10 → 11 | 1,340 | ~17 | 2 h |
| 15 → 16 | 2,265 | ~22 | 3.7 h |
| 20 → 21 | 3,390 | ~27 | 5.7 h |
| 24 → 25 | 4,434 | ~30 | 7.6 h |
| 27 → 28 | 5,301 | ~33 | 9.2 h (Malgrim, around 9.8 h) |
| 34 → 35 | 7,604 | ~38 | 13.4 h (post-game cap) |

- **No level comes faster than about 5 minutes** (only the very first).
- **No story level takes longer than about 33 minutes.**
- **These are model numbers:** the Wave 1 playtest adds a debug readout of minutes per level and kills per minute, and the curve and encounter density get adjusted against real play.

### Hero stat growth
**[REVISED]** This replaces the old Might/Guard/Focus/Agility point allocation in §6. Each hero grows automatically along their own curve. Your choices come from skills, gear and loadout instead.
**Why:** with 8 heroes and an AI party, stat-point builds are easy to get wrong and hard to balance, and a phone game benefits from fewer menus.

| Stat | Growth per level | Notes |
|---|---|---|
| Max HP | +9% of base (linear) | Replaces the demo's ×1.1 per level, which grows too steeply past level 15 |
| ATK | +2 per level | Drives both damage and healing (Oake, Pip's Mend, repair bots) |
| DEF | Gear only | Damage taken = raw × K / (K + DEF), where K = 40 + 6 × (attacker level − 1) |
| Crit | Gear and skills only | A crit does ×1.75 damage |
| Speed | Fixed per hero | Gear can add up to +15% |

### Enemy scaling (per level above 1)
| | HP | Damage | XP | Gold |
|---|---|---|---|---|
| Per level | +25% | +13% | +15% | +10% |

### Region level bands
**[REVISED]** This is a concrete version of the §8 band rule.
- **Brightwater Vale:** fixed at levels 1–6.
- **The four outer regions** take their band from **how many outer Ward Stones you've already destroyed** (k = 0–3):
  - floor = 6 + 4k; ceiling = floor + 8.
  - Whichever region you do first is levels 6–14, the second 10–18, the third 14–22, the fourth 18–26.
  - This means any order works and the difficulty still ramps up.
- **Freed regions** stay at the band they had when freed, but their floor never drops more than 6 below the current one. They stay easy without going stale.
- **The Blight Basin and the Tower:** floor = 24 + 2 × (outer Ward Stones still standing).
  - With all stones down that's 24–30.
  - Going in early with all four outer stones still up starts at level 32.
- **Post-game:** every band rises to 30–35.
- **Elites** are +2 levels and **named bounties** +3, both still clamped to their band.

### Expected party level
| After | Party level |
|---|---|
| Vale Ward Stone | ~6 |
| 1st outer stone | ~12 |
| 2nd outer stone | ~16 |
| 3rd outer stone | ~20 |
| 4th outer stone | ~24 |
| Malgrim | ~28 |
| Post-game | up to 35 |

---

## C2. Elements & Status Effects

**[REVISED]** §9 listed Fire, Frost, Storm, Earth, Light and Shadow. **Earth is replaced by Venom**, which the demo already uses. The Stone Gauntlets relic covers the "break stone" job Earth was meant to do.

| Element | Status | Effect | World use (optional shortcuts) |
|---|---|---|---|
| **Fire** | Burn | 3s damage over time (4% of the hit per second). Spreads to brambles and webs | Burns brambles, webs and ice walls; lights braziers |
| **Frost** | Chill → Freeze | Chill: −30% move and attack speed. 3 Chill stacks Freeze for 1.5s (bosses take a heavy 2s Chill instead) | Freezes shallow water into walkable ice; puts out fire vents |
| **Storm** | Shock | The next hit on the target arcs to 2 nearby enemies for 40%. Interrupts caster windups | Powers dormant machines and lifts; overloads Hex turrets |
| **Venom** | Poison | Stacks up to 5. Each stack does 1.5%/s and cuts enemy healing by 10% | Dissolves rotten barricades in Mistfen |
| **Light** | Radiant | +50% damage to Hexed and undead foes. Strips enemy buffs. 2% of the damage heals the lowest ally | Reveals curse-runes; opens Light seals |
| **Shadow** | Weaken | For 4s the target deals −15% damage and takes +10% from everything | Passes through shadow veils in Gloamwood |

- **Proc rates:** an elemental weapon applies its status on **25% of basic hits**. Elemental skills apply it **every time**.
- **Weak:** ×1.5 damage, and statuses last 50% longer.
- **Resist:** ×0.5 damage, and no status.
- **Hexed** enemies (Malgrim's creations) all resist Shadow and are weak to Light, on top of their own weakness.
- **Sources of elemental damage:** weapon element, gems (C6), and skills.

---

## C3. Heroes, Skills & Ultimates

### Loadout **[REVISED from §6]**
- **3 active skills** (the demo has 2), **2 passives** and **1 ultimate** per hero.
- **Skill ranks 1–5.** Each rank costs skill points (1 / 1 / 2 / 2 / 3) and adds **20%** to the skill's effect, so rank 5 is +80%. **[REVISED in playtest: was 15%]**
- **Skill power budget [LOCKED in playtest]:** skills start modest and grow, so the player grows into them rather than being overpowered from the start.
  - At rank 1, a damage skill adds roughly **25–35% of the hero's basic-attack damage per second** on a single target. Area skills deal less per target.
  - **Cooldowns are 8–18 game seconds** (about 11–25 s real time at 0.72× speed). Big area skills sit at the long end.
  - **Splash damage** (Fireball, Blast Arrow) hits the target in full and everything else for 45%. Only the direct hit applies the element.
  - **Burn** ticks for 0.12× ATK. Chain Lightning loses 30% per jump.
  - **Gear cooldown reduction is capped at 30%.** Crit-based cooldown refunds (Studious, Quick Hands) can trigger at most once per second.
- **Ultimate charge [REVISED in playtest]:**
  - **Dealing damage:** charge depends on the share of the foe's health a hit actually removes (overkill doesn't count). Taking down a whole regular foe is worth about 6 of the meter's 100 points.
  - **Per hit:** at least 0.25 (so long boss fights still charge), at most 2.5.
  - **Taking damage:** losing a whole health bar is worth 25.
  - **Over time:** the meter also fills by itself, about 45 s from empty.
- **Cooldowns only, no mana bar.** **[REVISED from §9]** Focus is dropped: a phone HUD already shows cooldown arcs, and a second resource is one more thing to read mid-fight.
- **New skills unlock** at levels 1 (2 skills), 4, 8, 12 and 16. The ultimate upgrades at level 20 with an **Ultimate Tome** from the Trainers' Hall.
- **Combat grid with 3 skills:** the top row stays ULT, ALLY 1, ALLY 2. The bottom row becomes DODGE, S1, S2, S3. That's 4 columns, about 158 px, which still fits portrait. *(See question 2.)*

### Brann — Guardian (tank) · sword or mace + shield
| Unlock | Skill | Effect |
|---|---|---|
| L1 | **Shield Bash** (demo) | Stuns for 1s and knocks back |
| L1 | **Taunt** (demo) | Pulls the attention of every enemy within 5 tiles for 4s |
| L4 | **Charge** | Dashes to the target and knocks aside enemies on the way |
| L8 | **Shield Wall** | Blocks 80% of frontal damage for 3s and reflects arrows |
| L12 | **Rallying Cry** | Party +25% DEF for 6s and heals 10% |
| L16 | **Earthsplitter** | Slam in a line ahead that staggers |
| Passive | **Iron Skin** | +12% DEF |
| Passive | **Retribution** | Blocking a hit cuts 1s off Bash |
| Passive | **Last Stand** | Once per fight, a lethal hit leaves him at 1 HP with 3s of invulnerability |
| Ultimate | **Bulwark** (demo) | Shields the party and taunts everything nearby. *L20 upgrade:* the shield bursts when it ends and heals 15% |

### Pip — Arcanist (ranged caster) · staff + tome or orb
| Unlock | Skill | Effect |
|---|---|---|
| L1 | **Fireball** (demo) | Bolt that bursts in a small area and Burns |
| L1 | **Frost Nova** | Ring around Pip that applies 2 Chill stacks. *(The demo's Mend moves to the Cleric discipline)* |
| L4 | **Chain Lightning** | Hits 4 targets with Storm |
| L8 | **Blink** | Teleports 5 tiles and leaves a 2s decoy |
| L12 | **Arcane Barrage** | 6 homing missiles |
| L16 | **Elemental Surge** | For 6s, every spell applies all three of Pip's statuses |
| Passive | **Attunement** | Statuses Pip applies last 50% longer |
| Passive | **Studious** | Spell crits cut 1s off the lowest cooldown |
| Passive | **Wardweave** | −20% damage taken from ranged attacks |
| Ultimate | **Meteor** (demo) | Huge strike on a cluster of foes. *L20:* leaves burning ground for 5s |

### Sable — Duelist (melee damage) · dagger + off-hand dagger
| Unlock | Skill | Effect |
|---|---|---|
| L1 | **Shadow Step** (demo) | Blinks behind the target; the next hit crits |
| L1 | **Fan of Knives** (demo) | Ring of blades around her |
| L4 | **Envenom** | Her next 6 hits Poison |
| L8 | **Smoke Bomb** | Enemies in the cloud miss 50% of the time; Sable is hidden for 2s |
| L12 | **Riposte** | 0.5s parry window, then a counterattack that always crits |
| L16 | **Death Mark** | The marked target takes +25% from the whole party; if it dies, the cooldown resets |
| Passive | **Backstab** | +50% damage from behind |
| Passive | **Quick Hands** | Crits take 0.3s off all cooldowns |
| Passive | **Light Fingers** | 15% chance of bonus gold the first time she hits an enemy |
| Ultimate | **Thousand Cuts** (demo) | Blinks between up to 6 foes, critting each. *L20:* up to 10 foes, and recasts free if the last one dies |

### Wren — Ranger (ranged damage) · bow + quiver · has a hawk companion
| Unlock | Skill | Effect |
|---|---|---|
| L1 | **Power Shot** | Arrow that pierces everything in a line |
| L1 | **Hawk Strike** | The hawk dives on the target and marks it (+10% damage taken); also reveals hidden enemies |
| L4 | **Volley** | Rains arrows on an area |
| L8 | **Snare Trap** | Roots the first enemy to step on it for 3s |
| L12 | **Disengage** | Backflips away and fires a shot that slows |
| L16 | **Blast Arrow** | Fire arrow that explodes |
| Passive | **Eagle Eye** | +20% range; +15% crit on far targets |
| Passive | **Hawk Sight** | Out of combat, the hawk pings nearby hidden chests and flies on the minimap |
| Passive | **Steady Aim** | After standing still for 1s, +20% damage |
| Ultimate | **Storm of Talons** | For 4s the hawk and a rain of arrows hit every enemy on screen. *L20:* 8s, and hits stun |

### Brother Oake — Cleric (healer and support) · hammer + holy relic
| Unlock | Skill | Effect |
|---|---|---|
| L1 | **Heal** | Large heal on one ally (the AI picks the lowest HP%) |
| L1 | **Smite** | Light damage; Radiant |
| L4 | **Sanctuary** | Healing circle for 6s |
| L8 | **Purify** | Removes debuffs and blocks new ones for 3s |
| L12 | **Halo** | Shields the lowest ally for 20% of max HP |
| L16 | **Judgment** | Pillar of light; stuns undead and Hexed enemies |
| Passive | **Optimism** | Overhealing turns into a shield (up to 15% max HP) |
| Passive | **Steady Hands** | Revives allies twice as fast |
| Passive | **Faith** | 10% of the Light damage he deals heals the party |
| Ultimate | **Dawnbreak** | Revives every downed ally and heals the party to full over 3s. *L20:* also blasts nearby enemies with Light |

### Kesh — Berserker (melee bruiser) · hand axe + hatchet
| Unlock | Skill | Effect |
|---|---|---|
| L1 | **Cleave** | Wide frontal arc |
| L1 | **Leap** | Jumps to the target and slams the area |
| L4 | **Howl** | Fears nearby non-boss enemies for 2s |
| L8 | **Frenzy** | +40% attack speed for 6s, costs 10% HP |
| L12 | **Rend** | Bleed (physical damage over time) that stacks |
| L16 | **Whirlwind** | Spins while moving for 3s |
| Passive | **Rage** | Deals more damage as HP drops, up to +40% |
| Passive | **Thick Hide** | Regenerates 1% HP/s out of combat and 0.3%/s in combat |
| Passive | **Beast Sense** | Ambushes are revealed, and he can't be surprised |
| Ultimate | **Primal Form** | Transforms for 8s: +50% damage, 20% lifesteal, immune to crowd control. *L20:* 12s, and every hit slams |

### Mirelle — Frost Witch (control caster) · wand + hand mirror
| Unlock | Skill | Effect |
|---|---|---|
| L1 | **Ice Shard** | Piercing shard; Chill |
| L1 | **Frost Prison** | Encases one enemy for 3s. Cast on an ally, it makes them invulnerable instead |
| L4 | **Glacial Wall** | Wall of ice that blocks enemies and projectiles for 5s |
| L8 | **Shatter** | Big burst on a Chilled or Frozen target that consumes the status |
| L12 | **Blizzard** | Stacks Chill in an area for 4s |
| L16 | **Mirror Image** | 2 clones that cast Ice Shard for 6s |
| Passive | **Cold Heart** | Enemies she Chills also deal −15% damage |
| Passive | **Frostbite** | Crits against Frozen enemies do +25% |
| Passive | **Penance** | When an ally goes down, she gains a shield and her cooldowns reset |
| Ultimate | **Absolute Zero** | Freezes every non-boss enemy on screen for 3s; bosses get max Chill. *L20:* bosses Freeze for 2s |

### Gizmo — Tinkerer (summoner and traps) · spanner + gadget
| Unlock | Skill | Effect |
|---|---|---|
| L1 | **Deploy Turret** | Turret that lasts 12s (1 at a time) |
| L1 | **Spark Mine** | Storm mine that stuns for 1.5s |
| L4 | **Repair Bot** | Heals allies near it for 8s |
| L8 | **Gravity Gadget** | Pulls enemies into a cluster |
| L12 | **Rocket Boots** | Dash that leaves a fire trail |
| L16 | **Overcharge** | His gadgets get +100% speed and Shock for 5s |
| Passive | **Engineering** | +1 turret allowed at once |
| Passive | **Scrap Collector** | +50% Goblin Scrap from enemies and salvage |
| Passive | **Tinker's Luck** | 20% chance to make double when crafting |
| Ultimate | **Clank** | Summons a mech for 12s that taunts and slams. *L20:* 24s, and fires rockets |

### Secondary disciplines (one per hero, from trainers) **[LOCKED rule, content new]**
Each discipline has **2 actives and 1 passive**. They're ranked with skill points just like home skills.

| Discipline | Actives | Passive | Trainer location |
|---|---|---|---|
| **Blade** | Sweeping Strike, Parry | Keen Edge (+25% crit damage) | Brightwater, once the Vale Ward Stone falls |
| **Guardian** | Guard Up (self shield), Provoke | Stalwart (+10% DEF, knockback immunity) | Frosthelm outpost |
| **Arcane** | Magic Missile, Blink | Clarity (−10% cooldowns) | Gloamwood hermit's tower (behind a Seer's Lens wall) |
| **Shadow** | Shade Dash, Poison Cloud | Ambush (+20% damage from behind) | Mistfen smugglers' den (needs the Tide Charm) |
| **Ranger** | Quick Shot, Snare | Fleet (+8% move speed) | Gloamwood edge camp |
| **Cleric** | Mend, Ward | Blessed (+20% healing received) | Cinderreach monastery |

- **Built (Wave 1):**
  - **Rules:** one discipline per hero. Its 2 actives and 1 passive join the hero's own lists (shown in lavender), share the 3 active and 2 passive slots, and are ranked with skill points.
  - **Cost:** learning costs gold (Blade 120, Shadow 160). The first active comes free at rank 1. Switching to another discipline costs extra (+15 gold per level) and refunds every skill point spent on the old one.
  - **Blade:** taught by Master Iren in the Brightwater hamlet once the Vale stone falls. Sweeping Strike, Parry, Keen Edge.
  - **Shadow:** taught by Sly Margo on the smugglers' isle in a Mistfen pool, reachable only by swimming. Sister Cora mentions it. Shade Dash, Poison Cloud, Ambush.
  - **Cleric's Mend** exists in data for the Cinderreach trainer.
- **The Trainers' Hall** in Brightwater (C9) teaches every discipline you've already unlocked. It also handles respec (gold cost, which rises with level) and sells Veteran's Tomes and Ultimate Tomes.

---

## C4. Equipment

### Slots **[REVISED from §7]**
- **4 visible slots:** Weapon, Off-hand, Head, Body. These are the demo's slots, all baked into the sprite.
- **2 Trinket slots:** rings and charms, not drawn on the sprite.
- **Feet is dropped.** Boots are 2–3 pixels at 16×24 and wouldn't read on screen; speed bonuses move onto trinkets and Rare traits.

### Rarity **[REVISED]**
**Light rolls, not Diablo-style randomness** (see §16 Q6). Base stats are fixed per item; Fine and Rare drops add one small bonus stat that fits the item (Rares also roll one trait), shown as a name prefix. Uniques are fixed until the post-game. A duplicate sells or salvages.

| Rarity | Colour | Where it comes from | What it adds |
|---|---|---|---|
| **Common** | White | Shops, early drops | Base stats for its tier |
| **Fine** | Green | Random drops, chests | ×1.2 stats plus a secondary stat |
| **Rare** | Blue | Elites, bounties, dungeon chests, outpost shops | ×1.35 stats, one **trait**, one gem socket |
| **Unique** | Gold | Hand-placed: secrets, vaults, bosses, Frog King | Named, its own look, a signature effect, one socket |
| **Legendary** | Orange | Royal Armory, endgame (one per hero) | Changes that hero's ultimate; two sockets |

### Tiered gear is generated, uniques are authored
- **Common, Fine and Rare items** come from a template: `tier × slot × hero family × rarity`. Names follow the pattern "Steel Longsword", "Runesilk Robe".
  - The tier sets the palette of the look; the family sets the shape.
  - This gives about **570 items from about 60 lines of data**. The paper-doll renderer already turns them into sprites.
- **Uniques and Legendaries** (40 total, below) are written by hand.

**Tier ladder.** Tiers follow the level band, not the region, so the four outer regions can be played in any order.

| Tier | Metal / cloth / leather name | Level | Stat budget | Shop price (Common) |
|---|---|---|---|---|
| T1 | Iron / Linen / Hide | 1–6 | 4 | 30g |
| T2 | Steel / Wool / Leather | 5–10 | 10 | 120g |
| T3 | Silversteel / Silk / Studded | 9–14 | 18 | 270g |
| T4 | Runesteel / Runesilk / Wyvernhide | 13–18 | 28 | 480g |
| T5 | Starsteel / Starweave / Shadowhide | 17–22 | 40 | 750g |
| T6 | Kingsteel / Moonweave / Dragonhide | 22–28 | 54 | 1,080g |

- **Slot weights:** weapon 1.0, body 0.9, off-hand 0.7, head 0.6.
- **Budget to stats:** 1 point = 1 ATK = 1 DEF = 5 HP = 1% crit. Each family spends its budget its own way:
  - shields go to DEF,
  - tomes to ATK,
  - off-hand daggers to ATK + crit,
  - quivers to crit, and so on.
- **Fine and Rare** items appear from T2 up.

**Hero families (shape of the template):**
| Hero | Weapon | Off-hand | Head | Body |
|---|---|---|---|---|
| Brann | Longsword / Mace | Shield (DEF) | Helm | Plate |
| Pip | Staff | Tome or Orb (ATK) | Hat | Robe |
| Sable | Dagger | Off-hand dagger (ATK + crit) | Hood | Leathers |
| Wren | Bow | Quiver (crit) | Cap | Ranger leathers |
| Oake | Warhammer | Holy relic (healing ATK + HP) | Cowl | Vestments |
| Kesh | Hand axe | Hatchet (ATK) | Warhelm | Furs |
| Mirelle | Wand | Hand mirror (ATK + DEF) | Circlet | Gown |
| Gizmo | Spanner | Gadget (ATK, plus turret HP) | Goggles | Overalls |

**Rare traits** (each Rare template picks one):
- Lifesteal 3%
- −10% cooldowns
- +15% damage vs elites
- Thorns (10% reflected)
- +8% move speed
- +20% potion healing
- Elemental edge (its tier's element: 25% proc)
- +15% ultimate charge
- Heatproof (Cinderreach)
- Coldproof (Frosthelm)
- +10% gold
- First hit in a fight crits

### Unique gear (32) — four per hero, one per slot
Locations use the region codes **V** Vale, **M** Mistfen, **G** Gloamwood, **C** Cinderreach, **F** Frosthelm, **B** Blight Basin and Tower. "Vault" means a dungeon's Sealed Vault (C8), which needs another region's relic.

**Brann**
| Item | Slot | Signature effect | Found |
|---|---|---|---|
| **Lionheart Helm** (demo) | Head | Below 40% HP: +25% DEF, and a taunt pulse every 3s | V: King's tomb under the ruins (Stone Gauntlets) |
| **Aegis of Dawn** (demo) | Body | Every 5 hits he takes heals the party 8% | C: monastery vault |
| **Emberbrand** (demo) | Weapon | Fire. Shield Bash sets the ground alight | C: Forgemaster Vulk |
| **Bulwark of Aldermere** (demo) | Off-hand | Blocks all projectiles from the front while not attacking | Frog King, 30 flies |

**Pip**
| Item | Slot | Signature effect | Found |
|---|---|---|---|
| **Ember Circlet** (demo) | Head | Fire statuses last +50%; +8% crit | C: bounty "Flicker" |
| **Phoenix Robe** (demo) | Body | Once per fight, rises at 40% HP when downed | C: Forge of Ash vault (Tide Charm) |
| **Sunspire Staff** (demo) | Weapon | Fire. Fireball splits into 3 at the end of its flight | V: Undercroft vault (Gale Cloak) |
| **Orb of Echoes** (demo) | Off-hand | Every 3rd spell casts twice | G: Arcane hermit's puzzle |

**Sable**
| Item | Slot | Signature effect | Found |
|---|---|---|---|
| **Raven Mask** (demo) | Head | Crits from behind reset Shadow Step | G: the Pale Huntsman |
| **Nightsilk Coat** (demo) | Body | Dodging leaves a decoy that draws enemies for 2s | G: bounty "Queen Mab" |
| **Wyrmfang** (demo) | Weapon | Venom. Poison stacks to 7 | M: chest on top of the Hook Bluff |
| **Wyrmfang Twin** (demo) | Off-hand | Venom. With Wyrmfang: poison spreads when the target dies | M: Mother Murk |

**Wren**
| Item | Slot | Signature effect | Found |
|---|---|---|---|
| **Hawkeye Hood** | Head | Hawk Strike's mark becomes +20% | F: lookout summit (Climbing Claws) |
| **Windrunner Leathers** | Body | +10% move speed; after a dodge, the next shot crits | F: Frosthelm sky ledge (Gale Cloak) |
| **Galeheart Longbow** | Weapon | Storm. Power Shot chains | F: Rimeglass Spire chest |
| **Quiver of Embers** | Off-hand | Fire. Every 4th arrow explodes | C: bounty "Old Smokestack" |

**Brother Oake**
| Item | Slot | Signature effect | Found |
|---|---|---|---|
| **Mitre of Good Cheer** | Head | Optimism shields can reach 30% | Frog King, 20 flies |
| **Vestments of the Undimmed** | Body | Party regenerates 2% HP every 5s | G: forest chapel (Lantern) |
| **Dawnhammer** | Weapon | Light. Smite chains to 2 more | M: Sunken Abbey vault (Seer's Lens) |
| **Lantern of the Faithful** | Off-hand | Light. Sanctuary follows Oake | M: bounty "The Lamplighter" |

**Kesh**
| Item | Slot | Signature effect | Found |
|---|---|---|---|
| **Wolfskull Helm** | Head | Howl also gives the party +15% ATK for 6s | F: bounty "Greymaw" |
| **Troll-Hide Mantle** | Body | Below 50% HP: regenerates 1% HP/s | F: Avalanche Troll |
| **Bloodfang Axe** | Weapon | 5% lifesteal; Rend stacks twice as fast | M: goblin fighting-pit champion **[BUILT: Grub's follow-up errand "The Champion's Bout" vs Gutcrusher]** |
| **Gnasher** | Off-hand | Fire. Leap leaves a burning crater | C: Cinder Drake |

**Mirelle**
| Item | Slot | Signature effect | Found |
|---|---|---|---|
| **Crown of Rime** | Head | Frozen enemies explode when they die, Chilling nearby enemies | F: Rimeglass Spire vault (Stone Gauntlets) |
| **Penitent's Gown** | Body | When an ally goes down, the whole party gets a frost shield | G: illusory shrine (Seer's Lens) |
| **Glacier Wand** | Weapon | Frost. Ice Shard splits into 3 when it hits | F: Isolde the Rimeguard |
| **Mirror of Truths** | Off-hand | Shadow. Reflects one projectile every 5s | B: Shattered Mirror quest |

**Gizmo**
| Item | Slot | Signature effect | Found |
|---|---|---|---|
| **Clockwork Goggles** | Head | Shows hidden traps and chests within 6 tiles; +6% crit | V: Gizmo's recruitment quest |
| **Flameproof Overalls** | Body | Immune to heat and Burn; +DEF | C: abandoned mine |
| **Thunderwrench** | Weapon | Storm. Every hit Shocks | M: drowned mill (dive, Tide Charm) |
| **Turret Mk. II** | Off-hand | Turrets fire Storm bolts and last twice as long | G: forgotten workshop (Lantern) |

### Legendary weapons (8) — Royal Armory, after all five Ward Stones
Each is forged from **Starmetal** (C6) plus a **personal relic** won from that hero's last character quest. Every legendary changes its hero's ultimate.

| Hero | Legendary | Ultimate change |
|---|---|---|
| Brann | **Oathkeeper** | Bulwark lasts twice as long and heals 30% |
| Pip | **Staff of the Ninth Apprentice** | Meteor drops 3 meteors. *(Found in Malgrim's study, the payoff to Pip's backstory)* |
| Sable | **Whisper & Wane** | Thousand Cuts hits up to 12 foes and recasts on a kill |
| Wren | **Skyfall** | Storm of Talons stuns and lasts 8s |
| Oake | **Hammer of First Light** | Dawnbreak also deals heavy Light damage |
| Kesh | **Worldsplitter** | Primal Form +4s; every hit makes a shockwave |
| Mirelle | **Heart of Winter** | Absolute Zero Freezes bosses for 3s |
| Gizmo | **Omniwrench** | Clank lasts 24s and fires rockets |

### Trinkets (rings and charms; any hero can wear them)
- **Tiered rings** (generated, T1–T6):
  - Ring of Vigor (HP)
  - Ring of Might (ATK)
  - Ring of Warding (DEF)
  - Ring of Precision (crit)
- **Unique charms:**

| Charm | Effect | Found |
|---|---|---|
| **Frog King's Signet** | +15% gold | Frog King, 10 flies |
| **Lucky Coin** | +10% drop chance | Hexling Whack champion (demo prize upgraded) |
| **Gold Fly in Amber** | Uncollected Golden Flies show on the minimap | Frog King, 50 flies |
| **Traveler's Compass** | Unopened chests show on the minimap | Cartographer (C9) |
| **Echo Bell** | +20% ultimate charge | G: bell tower puzzle |
| **Ember Heart** | Immune to heat; Fire resist | C: outpost quest |
| **Frostfur Tassel** | Immune to cold; Frost resist | F: outpost quest |
| **Pearl of the Deep** | Breathe underwater twice as long; +10% speed while swimming | M: giant clam dive |
| **Hunter's Tooth** | +15% damage vs elites and bounties | Bounty Board, 10 bounties |
| **Phial of Second Wind** | Potions heal +30% | Alchemist quest |
| **Ward Shard** | +10% damage to Hexed foes | From any Ward Stone (stacks to 3 as Shard → Prism → Crown) |
| **Thornring** | Reflects 10% of melee damage | V: Snagtooth bounty |
| **Vampire's Kiss** | 2% lifesteal | G: crypt |
| **Wanderer's Charm** | +8% move speed | Cartographer, all 6 lookouts climbed |
| **Hourglass Charm** | −12% skill cooldowns | C: Forgemaster's apprentice quest |
| **Malgrim's Cufflink** | +25% damage, −25% max HP (cursed: it can't be sold) | B: Tower floor 7 |

---

## C5. Upgrades

### Blacksmith refinement **[REVISED: +1 to +10 in three ranks]**
- **Each +1** adds 6% of the item's base stats (at least +1 to its main stat).
- **No failure chance.** Upgrades never fail and never cost you the item.

| Smith rank | Unlocks when | Max refine | Cost per +1 |
|---|---|---|---|
| Rank 1 | Vale Ward Stone | +3 | 20g × level × tier, plus ore × level |
| Rank 2 | 3 Ward Stones | +6 | Same, plus 1 region material at +4 and +6 |
| Rank 3 | 5 Ward Stones | +10 | Same, plus Starmetal at +8, +9 and +10 |

- **Ore types:**
  - Iron Ore for T1–2,
  - Silver Ore for T3–4,
  - Starmetal for T5–6 and for +8 and above.
- **Where ore comes from:**
  - Iron is everywhere.
  - Silver is in any outer region's mines.
  - Starmetal comes from elites, bosses and the Basin.
- **The demo's +1 to +3 crafting refine becomes Rank 1.**
- **Salvage:** breaking an item down returns about 40% of the materials it took to make and refine. Uniques can't be salvaged, so they can't be lost by accident.
- **Re-forge (late game):** re-rolls a Rare's trait or its bonus stat, for gold and Starmetal.

### Enchanter: gems & sockets
- **Sockets:** Rare and Unique items have 1, Legendaries have 2.
- **Removing a gem is free** and gives the gem back.
- **Gem grades:** Chipped → Clear → Flawless → Royal. Combining 3 of one grade makes the next.

| Gem | Effect (Chipped → Royal) |
|---|---|
| **Ember** | Fire damage on hit 3 → 12%, plus Burn chance |
| **Rime** | Frost damage 3 → 12%, plus Chill chance |
| **Storm** | Storm damage 3 → 12%, plus Shock chance |
| **Venom** | Venom damage 3 → 12%, plus Poison chance |
| **Sun** | Light damage 3 → 12%, plus Radiant |
| **Gloam** | Shadow damage 3 → 12%, plus Weaken |
| **Ruby** | +4 → +16% max HP |
| **Onyx** | +4 → +16% DEF |
| **Topaz** | +2 → +8% crit |
| **Emerald** | Regenerate 0.2 → 0.8% HP/s |

- **An elemental gem in a weapon** with no element gives the weapon that element.
- **A gem on armor** gives resistance to that element instead of damage.

### Wardrobe (cosmetic)
- **Any look you've ever owned** can be shown over your current gear, slot by slot. This is cheap to do with the paper-doll baker, and it lets players keep a favourite look.

---

## C6. Materials, Crafting & Consumables

### Materials
| Material | Region | Source | Used for |
|---|---|---|---|
| Moonherb (demo) | Everywhere | Gather (sickle) | Potions |
| Slime Gel (demo) | V, M | Hexlings, slimes | Potions, gem setting |
| Iron Ore (demo) | Everywhere | Mine (pickaxe) | Refine T1–2 |
| Goblin Scrap (demo) | Everywhere | Goblins | Refine, Gizmo's gadgets |
| Hollow Crystal (demo) | V, caves | Mine | Elixirs, gem combining |
| Bogmoss | M | Gather | Antidotes, Shadow den items |
| River Pearl | M | Dive, clams | Pearl of the Deep, Enchanter |
| Silkthread | G | Gloom spiders | Cloth refine, Nightsilk |
| Ghostcap | G | Gather (night-glow mushrooms) | Spirit Tonic |
| Brimstone | C | Mine | Ember Salve, bombs |
| Salamander Scale | C | Salamanders | Refine at +4 and +6, heat gear |
| Rimeglass Shard | F | Mine | Frost Tonic, refine at +4 and +6 |
| Wolf Pelt | F | Frost wolves | Coldproof gear |
| Silver Ore | Outer regions | Mine | Refine T3–4 |
| Starmetal | B, elites, bosses | Drops, Basin veins | Refine T5–6 and +8 and above, Legendaries |
| Void Shard | B | Tower enemies | Re-forge, Royal gems |

- **Gathering stays timed with tool animations** (demo):
  - herbs 1.5s,
  - ore 2.4s,
  - crystal and rare materials 3.2s.
- **Gathering nodes regrow** after about 4 minutes of play.

### Consumables
- **The HUD keeps two quick slots**, Potion and Elixir, as in the demo.
- **Everything else** is used from the bag, and the effect lasts until the next campfire or for the time shown.

| Item | Effect | Recipe | Shop price |
|---|---|---|---|
| Health Potion (demo) | Leader +50% HP | 2 herb + 1 gel | 30g |
| Greater Potion | Leader +100% HP, regen 5s | 2 herb + 1 gel + 1 crystal | 90g (Alchemist) |
| Elixir (demo) | Revives and heals the party 60% | 2 herb + 2 gel + 1 crystal | 200g (Alchemist) |
| Antidote | Removes Poison and Bleed; immune for 30s **[BUILT: crafted, HUD flask K, Frog King reward]** | 1 bogmoss + 1 herb | 25g |
| Ember Salve | Heat immunity for 5 min | 2 brimstone + 1 gel | 60g (Cinderreach outpost) |
| Frost Tonic | Cold immunity for 5 min | 2 rimeglass + 1 herb | 60g (Frosthelm outpost) |
| Spirit Tonic | Party +20% ATK for 60s | 2 ghostcap + 1 crystal | 120g |
| Stoneskin Draught | Party +25% DEF for 60s | 2 ore + 1 scale | 120g |
| Bomb | Thrown; 60 damage in an area; breaks cracked walls without the Gauntlets | 2 brimstone + 1 scrap | 40g |

- **Carry limit:** 9 of each consumable (5 Elixirs). This stops potion-spamming from replacing play.

---

## C7. Enemies

### Enemy AI rules **[BUILT, measured]**
Each rule was added one at a time and checked before and after with the fight benchmark (`tools/fight-bench.js`). It runs seven fixed fights, from 3 goblins to 10 mixed foes, in an open hall and a tight pillared room, plus leash, area-attack and doorway tests. Results are in `tools/bench-results/`. Rerun it before shipping any enemy change.
1. **Attack turns (tokens):** at most 2 foes wind up on one hero at the same moment (`tuning.attackTokens`, the main crowd-difficulty dial). The rest wait just outside reach. Bosses don't queue.
2. **Surround, don't stack:** melee foes take spread-out spots on a ring around their target. Foes waiting, winding up or recovering keep a little room between them.
3. **Sticky targets:** commit about 2 s and never switch mid-swing. After that, switch only for a reason: much more damage from someone else, or the target out of reach while another hero is right here. Remembered damage fades. A taunt always wins.
4. **Ranged foes:** prefer the most fragile hero, spread across heroes so a line of archers doesn't queue on one. They back off along open floor, sidestep for a clear shot, and shift a little after shooting.
5. **Leash:** none in sealed rooms. About 22 tiles in dungeons and caves, about 12 in the overworld. Foes only give up when they're also out of sight for 2.5 s, so backing off a step no longer resets and heals them.
6. **Group roles:** in packs of four or more melee, about one in three flanks to the back line. Support roles (healers, buffers) come with the region enemies that need them.
   - **Morale is rare [LOCKED from playtest]:** most foes stand and fight. About one small fry in six (goblins, rats, hexlings) has the nerve to break at a quarter health. It is never the last of its group, and never breaks while an ally nearby is already running. It shouts HELP (idle allies in view join in) and comes back. Measured with `tools/flee-test.js`: small fry fleeing 87.5% → 13.9%, and last survivors fleeing 7 → 0.
7. **Elites read the party's telegraphs:** they step out of Meteor and Volley zones, abandoning a swing if they must. Regular foes don't, so area attacks stay strong against crowds.
8. **Unsticking:** straight-line checks are as wide as the body, and a foe that barely moves for 0.4 s sidesteps and re-routes.


**How to read the tables:**
- **HP and DMG are multipliers of the Hex Goblin's** demo values at level 1 (100 HP, 20 damage). Level scaling (C1) is applied on top.
- **Behaviour** describes what the player has to read or react to.
- Every enemy has a telegraphed windup; Hard shortens it (§8).

### Hex Legion (Malgrim's troops — appear everywhere, scaled to the band; all Hexed)
| Enemy | HP | DMG | Behaviour | Weak / Resist | Drops |
|---|---|---|---|---|---|
| **Hexling** (demo) | 0.7 | 0.8 | Slow blob; slams the ground around itself | Fire / — | Gel |
| **Hex Goblin** (demo) | 1.0 | 1.0 | Melee rusher; swings in a frontal arc | Venom / — | Scrap |
| **Goblin Archer** (demo) | 0.6 | 0.75 | Keeps away; aim line, then a dodgeable arrow | Venom / — | Scrap |
| **Hex Knight** (demo) | 2.6 | 1.7 | Heavy; frontal shield blocks 70% until you flank it, hook it or break the guard | Fire / Frost | Ore, scrap |
| **Hex Wisp** | 0.5 | 0.6 | Flying; drops curse orbs that slow | Light / Shadow | Crystal |
| **Hex Warlock** | 0.8 | 1.2 | Shields allies and summons hexlings; priority target | Storm / Shadow | Crystal, gem (rare) |

### Brightwater Vale (levels 1–6)
| Enemy | HP | DMG | Behaviour | Weak / Resist | Drops |
|---|---|---|---|---|---|
| **Thornback Boar** | 1.4 | 1.2 | Paws the ground, then charges in a straight line; stunned if it hits a wall | Fire / — | Hide (sells) |
| **Pond Crab** | 0.9 | 0.8 | Armoured from the front; flips over on a Bash or hook | Storm / Frost | Pearl (rare) |
| *Undercroft:* **Hollow Guard** | 1.8 | 1.3 | Animated armour; reassembles after 5s unless finished with Light or Fire | Light / Venom | Ore |
| *Undercroft:* **Rat Swarm** | 0.4 ×6 | 0.3 | Floods out of holes; area attacks clear them | Fire / — | — |
| *Mini-boss:* **Snagtooth the Goblin Chief** (bounty) | 8 | 1.5 | Spins, calls archers, throws bombs | Venom / — | Thornring |

### Mistfen (marsh, sunken coast)
| Enemy | HP | DMG | Behaviour | Weak / Resist | Drops |
|---|---|---|---|---|---|
| **Mire Slime** (demo) | 0.95 | 0.95 | Splits into 2 small slimes when it dies | Frost / Venom | Gel, herb |
| **Bog Lurker** | 1.6 | 1.4 | Hides underwater (bubbles give it away), then lunges | Storm / Venom | Pearl |
| **Marsh Witchling** | 0.8 | 1.1 | Caster; slowing curse, teleports between pools | Light / Shadow | Bogmoss, gem (rare) |
| **Leech Swarm** | 0.6 | 0.5 | Latches on and drains; dodge or burn it off | Fire / Venom | — |
| **Drowned** | 1.3 | 1.1 | Undead; rises from the mud in groups | Light, Fire / Frost | Pearl, scrap |
| **Croaker** | 2.2 | 1.3 | Giant toad; its tongue pulls you in for a bite | Frost / — | Toad oil (sells) |
| *Mini-boss:* **Old Snapjaw** | 10 | 1.8 | Giant turtle; spins its shell, only its belly can be hurt | Storm / Frost | Silver ore, Unique (bounty) |

### Gloamwood (haunted forest; darkness and illusions)
| Enemy | HP | DMG | Behaviour | Weak / Resist | Drops |
|---|---|---|---|---|---|
| **Shade** | 1.0 | 1.3 | Invisible until close; the Seer's Lens shows it | Light / Shadow | Ghostcap |
| **Rootling** | 1.5 | 1.0 | Stays rooted and throws thorns; burns easily | Fire / Venom | Heartwood (sells) |
| **Gloom Spider** | 1.1 | 1.1 | Webs that root you; climbs walls | Fire / Venom | Silkthread |
| **Spectral Hound** | 0.8 | 0.9 | Packs of 3–4 that flank | Light / Frost | — |
| **Wailing Banshee** | 1.2 | 0.8 | Scream interrupts your casts and staggers; break line of sight | Light / Shadow | Crystal |
| *Mini-boss:* **Queen Mab** (bounty) | 9 | 1.6 | Spider queen; lays egg sacs and pulls with webs | Fire / Venom | Silk ×5 (makes Nightsilk Coat) |

### Cinderreach (volcanic badlands; heat soft-gate)
| Enemy | HP | DMG | Behaviour | Weak / Resist | Drops |
|---|---|---|---|---|---|
| **Ember Imp** | 0.7 | 1.1 | Blinks around throwing firebolts | Frost / Fire | Brimstone |
| **Magma Slug** | 1.6 | 0.9 | Leaves a burning trail | Frost / Fire | Brimstone |
| **Salamander Warrior** | 2.0 | 1.4 | Shield and spear; lunges | Frost / Fire | Salamander scale |
| **Basalt Brute** | 3.0 | 1.6 | Rock armour (−80% damage) until Storm, a Bomb or the Gauntlets crack it | Storm / Fire | Silver ore |
| **Fire Beetle** | 0.5 | 2.0 | Rushes in and explodes; kill it at range | Frost / Fire | Brimstone |
| *Mini-boss:* **Cinder Drake** | 12 | 2.0 | Young dragon; fire breath sweeps, takes off and dives | Frost / Fire | Gnasher |

### Frosthelm (frozen highlands; cold soft-gate; cliffs)
| Enemy | HP | DMG | Behaviour | Weak / Resist | Drops |
|---|---|---|---|---|---|
| **Frost Wolf** | 0.9 | 1.0 | Packs; bites that Chill | Fire / Frost | Wolf pelt |
| **Rimehorn** | 2.8 | 1.5 | Big beast; throws snowballs that Freeze, then charges | Fire / Frost | Pelt, rimeglass |
| **Ice Wraith** | 1.0 | 1.2 | Flying; flies through walls | Fire, Light / Frost | Rimeglass |
| **Hex Sentinel** | 1.8 | 1.2 | Crystal turret; reflects spells from the front | Storm / Frost | Crystal, silver ore |
| **Snow Goblin Raider** | 1.0 | 1.1 | Rides a sled and drops bombs in passes | Fire / Frost | Scrap |
| *Mini-boss:* **Avalanche Troll** | 14 | 2.1 | Pounds the ground to bring down icicles; regenerates unless Burning | Fire / Frost | Troll-Hide Mantle |

### Blight Basin & the Ninth Tower (levels 24+)
Here every Hex Legion enemy appears as a **Hexborn** version: elite stats and one affix. There are also four new enemies:

| Enemy | HP | DMG | Behaviour | Weak / Resist | Drops |
|---|---|---|---|---|---|
| **Voidling** | 1.0 | 1.3 | Teleports next to the weakest party member | Light / Shadow | Void shard |
| **Tower Gargoyle** | 2.5 | 1.6 | A statue while the leader faces it; moves when you turn away | Storm / Venom | Starmetal |
| **Chain Warden** | 3.5 | 1.8 | Chains party members together; break the chain with the hook | Light / Shadow | Starmetal |
| **Malgrim's Mirror** | = leader | = leader | Copies your current leader, including their gear look | Light / — | Void shard |

### Elite affixes
- **Elites** are gold-named, +2 levels, have one affix and always drop something (Fine or better, or materials).
  - **Built:** about 1 group in 3 has one. Elites have 1.8× health and 1.15× damage on top of the +2 levels. A pulsing gold ring under their feet marks them before you engage, and **their affix name** (VAMPIRIC, ARMORED…) stays over their health bar during the fight. **[REVISED in playtest: was 2.2× / 1.3× with only a gold tint]**
  - **All 8 affixes are built**, each with a visible cue:
    - **Vampiric:** a red drain line and a heal number on every hit.
    - **Armored:** a steel arc on its guarded side, and "GUARDED - FLANK IT".
    - **Frenzied:** turns red with "FRENZY!".
    - **Volatile:** pulses when nearly dead and leaves a blast circle.
    - **Splitting:** "SPLIT!" and two smaller copies.
    - **Shielder:** blue ward rings on its allies.
    - **Swift** and **Warded** are named on the tag.
    - Ranged elites never roll Splitting or Armored.
- **Hard mode** gives elites two affixes.

| Affix | Effect |
|---|---|
| **Swift** | +40% speed, shorter windups |
| **Armored** | Frontal guard; flank it, hook it or Shock it |
| **Vampiric** | Heals 30% of the damage it deals |
| **Volatile** | Explodes 2s after death |
| **Warded** | Resists every element except Light |
| **Splitting** | Splits into 2 at 50% HP |
| **Shielder** | Shields nearby allies |
| **Frenzied** | +50% damage below half HP |

### Bounties (18)
- **Three named bounties per region** on the Brightwater board and at outposts, plus three in the Basin.
- Each is a unique-looking elite with a short tell-tale line on the board, and pays gold, materials and often a Unique (see C4).
  - Examples: Snagtooth, Flicker, Old Smokestack, The Lamplighter, Queen Mab, Greymaw.

---

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

## C9. Brightwater Rebuild & Services

**[REVISED from §3]** Services are tied to **how many Ward Stones are down**, not to which region, so the free order never locks a service away.

| Trigger | Service returns | What it offers |
|---|---|---|
| Start | Campfire, Marla's general store (demo) | Potions, basic materials, T1 gear |
| Start | Bruno's tavern (demo) | Hexling Whack, rumours (hints toward secrets) |
| Vale stone (1) | **Blacksmith** (Rank 1) | Refine to +3, salvage, T2–3 gear |
| Vale stone (1) | **Lamplighter** | Lantern of Embers quest |
| 2 stones | **Enchanter** | Sockets, gem combining |
| 2 stones | **Gizmo's workshop** | Gizmo joins (quest); gadgets, Traveler's Compass |
| 3 stones | **Trainers' Hall** | All unlocked disciplines, respec, Veteran's and Ultimate Tomes; Blacksmith Rank 2 |
| 4 stones | **Alchemist** | Greater Potions, Elixirs, tonics; Phial of Second Wind quest |
| 5 stones | **Royal Armory** | Legendaries; Blacksmith Rank 3 |
| Townsfolk 10 / 20 / 30 | **Bard**, **Cartographer**, **Ferryman** | Bard: music layers and lore. Cartographer: lookout map pins, Wanderer's Charm. Ferryman: boat fast travel across the lake |

- **Gear stock rises with the band:**
  - Marla sells the current tier as Common.
  - The Blacksmith sells it as Fine.
  - Outposts sell their region's Rare traits (Heatproof, Coldproof, ...).
- **Each outer region has a refugee camp** at its entrance (campfire, merchant, salve or tonic seller). It becomes a proper village with an inn and a bounty board when that region is freed.

---

## C10. Progression: The Whole Game in Order

### Main path
| Step | Beat | Time | Party level |
|---|---|---|---|
| 1 | **Opening:** pick a starter, wake in the ruined Brightwater, meet the Frog King. The second hero joins in the ruins | 15 min | 1–2 |
| 2 | **Brightwater Vale:** the third hero joins on the road. Explore the lake, hamlet and ruins; first Golden Flies and shrine | 30 min | 2–5 |
| 3 | **Brightwater Undercroft** (tutorial dungeon): follow the cursed vine down; get the **Grapple Hook**; break the **Shadow of the Gatewarden** at the shrine; back up top, the true Gatewarden rises at the stone; **Vale Ward Stone** falls (first colour bloom) | 30 min | 5–6 |
| 4 | **Lantern quest** in Brightwater; the hook bridges out of the Vale open. The map shows four regions | 10 min | 6 |
| 5–8 | **Four outer regions, in any order.** Each one: refugee camp → overworld (lookout, relic hints, bounties, recruit quest; the vine leads from the stone to the dungeon) → dungeon → the lieutenant's Shadow → the true lieutenant at the **Ward Stone** → village reopens and a Brightwater service returns | ~1.5 h each | see C1 |
| 9 | **Blight Basin:** the barrier is down to its last layer; Hexborn enemies; final shrines | 30 min | 24–26 |
| 10 | **The Ninth Tower → Malgrim** | 45–75 min | 26–28 |
| 11 | **Post-game** | — | up to 35 |

**Early Tower attempt:** the Tower door opens once the Vale stone is down. Malgrim warns you off at the door ("Come back when you are less... small"). Going in is allowed, but at band 32 with 9 floors.

### Recruiting the other five heroes (each joins at the party's average level)
| Hero | Where | Quest |
|---|---|---|
| Starter's two partners | Vale | The opening and the road (demo flow) |
| **Kesh** | Mistfen | *The Pit:* a cursed townsperson forced to fight in a goblin arena. Win three bouts, then free him |
| **Wren** | Gloamwood | *The Hawk's Trail:* follow her hawk through the forest's illusions to where she's trapped |
| **Brother Oake** | Cinderreach | *Excessive Optimism:* help him heal a camp of burned miners the monastery gave up on |
| **Mirelle** | Frosthelm | *Thaw:* found frozen in Isolde's spire. Freeing her is part of the dungeon, and she joins for the boss |
| **Gizmo** | Brightwater (2 stones) | *The Water Wheel:* gather parts from any two regions to fix the town's mill |

### Errands (opt-in mini quests) **[LOCKED 2026-10-14]**
Small, self-contained jobs from ordinary people. They're never required, but they're the main reason to talk to everyone and to poke into corners of the map.

**Where you get them:**
- **Townsfolk and travellers** marked with a small "!" speech bubble.
- **The tavern rumour board** in Brightwater (Bruno) and in each region's village once it's freed.
- **Chance meetings** on the road: a stranded merchant, a lost child.

**How they work:**
- **Accepted, never forced:** you can turn one down and come back later.
- **The journal** keeps an Errands tab, with an optional map pin for the current step.
- **One errand can be tracked on the HUD at a time** (a single line under the minimap).
- **Short:** most take 3–10 minutes, so one fits in a phone session.

**Errand types** (each region gets 6–8, about 35 in total):

| Type | Example |
|---|---|
| **Find** | "My dog Biscuit ran into the woods." Follow barks and paw prints, then fight off the wolves that cornered him |
| **Deliver / escort** | Take Marla's goods to the Mistfen camp. Thieves ambush the cart on the road; protect it |
| **Hunt** | Cull the giant rats in the mill cellar; bring back a named pest |
| **Gather** | The Alchemist needs 5 Ghostcaps that glow only near shadow veils |
| **Rescue** | A merchant is cornered by goblins on the road (timed) |
| **Riddle / puzzle** | A ghost asks you to ring the old bells in the right order |
| **Chain** | 2–3 small errands for one character that end in a better reward or a small story beat |

**Rewards:**
- gold, materials and XP (counted in the C1 pacing as part of the "quests" share);
- often a Fine or Rare item;
- some give a **bonus skill point** (§16 Q2), a recipe or a charm;
- some rescue **cursed townsfolk**, which feeds the Brightwater rebuild.

**Errands vs. the other side content:**
- **Hero quests** (recruits and personal quests) are longer and story-driven.
- **Bounties** are just combat.
- **Errands** are the everyday small stories that make the world feel lived in.

### Collectibles
| Collectible | Count | Reward |
|---|---|---|
| **Golden Flies** (demo) | 60 (Wave 1: 20 — 19 in the world + Hexling Whack; Frog King rewards at 3/6/10/15/20, blessing at 20 for now, moving to 60 when all regions exist) | Frog King gifts every 10: Signet, Mitre, Bulwark of Aldermere, Lucky Coin upgrade, Gold Fly in Amber, and at 60 the **Royal Blessing** (+15% max HP and immunity to the frog curse) |
| **Shrines** | 12 | +1 skill point each |
| **Cursed townsfolk** | 30 | Rebuild Brightwater: Bard, Cartographer, Ferryman, plus gold and recipes. **Built (Wave 1): 10** (Vale 3, Highmeadow 2, Mistfen 5). Each is hexed with a comic side effect (hiccups bubbles, speaks backwards, turns things to porridge...). Breaking the hex gives 25 gold and 30 XP; 4 are guarded and the hex lashes out with enemies. Rescued folk move into homes around the hamlet with a new line each. **At 10 the Bard (Tilly) returns and adds a harp layer to every theme** |
| **Lore pages** | 40 | Malgrim's past, and the court-mage twist (he was Pip's master's master). **Built (Wave 1): 12** (Vale 2, Highmeadow 2, Undercroft 3, Mistfen 2, Abbey 3), telling the decree, the night of the curse, the Tower as a lens, Malgrim's letter, and the drained shrine and altar. Reading one pauses on a parchment card; the Journal keeps them to reread |
| **Lookout towers** | 6 | Climbable watchtowers (C12). The first climb reveals the area on the map and gives 60 XP; all six give the Wanderer's Charm. Built: Highmeadow and Fenwatch (Mistfen) |
| **Sealed Vaults** | 5 | Uniques (need relics from other regions) |

### Side quests
- **About 25 hero and town quests** (plus about 35 errands, above):
  - the 5 recruit quests,
  - a 2-step personal quest per hero (8 × 2; the last step gives the relic for that hero's Legendary),
  - and about 4 town quests (Lamplighter, Alchemist, Shattered Mirror, Hexling Whack championship).
- **18 bounties.**
- **Minigames:** Hexling Whack (demo), plus one per village:
  - Mistfen frog races **[BUILT: Ribbit Rosie at the fen camp. Bet 15g, win pays 45; tap when the swinging needle is in the gold for a long hop, mistimed taps stumble. Precise timing wins nearly every time, decent about half, mashing never. First win gives a Golden Fly]**,
  - Cinderreach forge rhythm,
  - Frosthelm ice fishing,
  - Gloamwood lantern-lighting puzzle run.

### Economy targets
- **Gold per hour:** about 300 × the party's band tier (300 in the Vale, about 1,800 by the Tower).
  - Enough to buy the next tier's Common set about once per region.
  - Refining and gems are the main gold sinks.
- **Random gear drops:** 16.5% from regular enemies (demo), 100% from elites, and bosses always drop their Unique.
  - Drops pick gear for recruited heroes at the current tier.
- **Wipe penalty** (§8): Normal loses 10% of carried gold, Hard 20%, Easy none.

### Post-game
- **The world stays open** after Malgrim. Bands rise to 30–35 everywhere, and Hexborn remnants spread out.
- **Unlocks:**
  - the **Tower of Echoes**, a boss rush against all lieutenants at level 35,
  - the last bounty tier,
  - Royal gems,
  - Re-forging.
- **Room left for expansion packs** (§12a) at the sealed edges of the map: the coast, the sky island and the northern border.

---

## C11. What the Full Build Needs (art and data counts)

| Asset | Count | Notes |
|---|---|---|
| Heroes (puppet sets) | 8 | 5 new: Wren, Oake, Kesh, Mirelle, Gizmo |
| Hero families (weapon, off-hand, head, body) | 8 × 4 | Tier palettes reused; 6 tiers |
| Unique looks | 32 + 8 legendaries | 12 already exist |
| Enemies | 35 regular + 5 mini-bosses + 5 lieutenants + Malgrim | Hexborn and elite versions are palette swaps with an aura |
| Relics | 7 | Grapple exists |
| Skills (icons + FX) | 48 home + 12 discipline + 8 ultimates | 9 exist |
| Tilesets | Vale (exists), Mistfen (partly), Gloamwood, Cinderreach, Frosthelm, Basin, Tower, 5 dungeon sets | Terrain is painted per pixel in code |
| Music | Title, hub (layered), 5 regions × cursed/freed, dungeon, boss, Tower, Malgrim, jingles | Pattern data. Built: Vale, Highmeadow, Mistfen, Depths, Hearth |
| Lookout towers | 6 placements | One shared tower sprite. Built: 2 |
| Ward Stone vines | 2 per region (overworld + dungeon), 5 sacred sigils | Grown and painted in code from a few waypoints. Built: Vale, Mistfen |
| Boss entrances | 1 style per lieutenant + Shadow variant | Built: stone assembly, shadow gathering, pool eruption |
| Data files | heroes, skills, items (templates + uniques), enemies, world/regions, quests, dialogue, tuning | All JSON, shared with iOS |

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

---

## 16. Open Questions

### Answered in Demo 2–3 (kept for history)
Game speed 0.72 locked; gear looks approved; Golem fair; ultimates distinct; combat difficulty on Normal approved. See the decision log.

### Part II review — resolved 2026-10-14 (each question discussed and decided one by one)
1. 4 visible gear slots + 2 trinkets; Feet dropped. **[LOCKED 2026-10-14]**
2. 3 active skills; the combat grid's bottom row becomes DODGE + 3 skills. **[LOCKED 2026-10-14]** Skills rank up by **spending skill points**: 1 per hero level, plus bonus points from shrines and other special rewards where it fits (e.g. some quests). No automatic skill levelling.
3. Automatic stat growth per hero; no stat points. **[LOCKED 2026-10-14]**
4. Cooldowns only; no mana. Gear and charms can speed up cooldowns (Rare trait −10%, Arcane discipline passive, and an **Hourglass Charm**: −12% cooldowns). A few skills may cost HP where it fits the hero (Kesh's Frenzy). **[LOCKED 2026-10-14]**
5. Venom replaces Earth (Fire, Frost, Storm, Venom, Light, Shadow). **[LOCKED 2026-10-14]**
6. Generated Common/Fine/Rare tiers + 40 authored Uniques and Legendaries, with **light rolls**. **[LOCKED 2026-10-14]**
   - **Common** (shops): fixed stats.
   - **Fine** drops roll **1 bonus stat**. **Rare** drops roll **1 bonus stat + 1 random trait** from the Rare trait pool.
   - **The bonus fits the item family:** frost weapon → +Frost damage or Chill chance; kite shield → +DEF or +HP; daggers → +crit or +ATK; staves → +ATK or faster cooldowns; robes → +HP or +DEF.
   - **Size:** 5–15% of the item's stat budget, scaled by tier.
   - **Naming:** the roll shows as a name prefix (Frosted, Sturdy, Keen, ...).
   - **Rolls never carry a downside.**
   - **Uniques and Legendaries** drop with fixed designed stats. In the **post-game**, re-earned boss and bounty Uniques can roll one small bonus stat.
7. Refine to +10 over three Blacksmith ranks; never fails. Re-forge (late game) can re-roll a Rare's trait or its bonus stat. **[LOCKED 2026-10-14]**
8. **Level cap 35**; the story ends around level 28, and the post-game takes you to 35. **[LOCKED 2026-10-14]**
   - XP curve and encounter density are set together so levels arrive every 5–13 minutes early and 20–33 minutes mid-to-late. Details in C1, "Pacing math"; it gets checked with a live minutes-per-level readout in the Wave 1 playtest.
9. Recruits: Kesh in Mistfen, Wren in Gloamwood, Oake in Cinderreach, Mirelle in Frosthelm, Gizmo in Brightwater. **[LOCKED 2026-10-14]** Also added: opt-in **errands** (small side quests from townsfolk and tavern rumours; see C10).
10. Tower loses a floor per Ward Stone; Malgrim gains a phase per standing stone. **[LOCKED 2026-10-14]**
11. No cuts; build in three waves, each playtested:
    - **Wave 1:** full Vale and Mistfen, Kesh and Wren. **[COMPLETE 2026-10-15]** Beyond the original list it also has: elite affixes, the Blade and Shadow disciplines, 10 cursed townsfolk + the Bard, 12 lore pages, 20 Golden Flies, antidotes, the frog races, the Bloodfang Axe, two lookouts, shadow/true lieutenants with vines. Deferred by design to the regions that hold them: the other Kesh and Wren uniques (Frosthelm / Cinderreach), Sealed Vaults (need Wave 2 relics), the Trainers' Hall (3 stones) and Ultimate Tomes (level 20).
    - **Wave 2:** Gloamwood and Cinderreach, Oake and Gizmo. **[COMPLETE 2026-10-16, in playtest]**
      - **Regions:** both built to the C12 template, with Witchroot Hollow (Seer's Lens, the Pale Huntsman), the Forge of Ash (Stone Gauntlets, Forgemaster Vulk), and the heat soft-gate with Ember Salve.
      - **Heroes:** Oake (Cinderreach errand) and Gizmo (*The Water Wheel*, Brightwater, after two stones).
      - **Region borders meander:** no straight rows or columns. Landmarks keep the region they were built for, and the region banner waits a second before changing.
      - **Every unique has its signature effect,** in its table home. Wave 1's parked uniques moved home; the Gatewarden now drops two generated Rares.
      - **Heroes can Burn:** imp shots, drake breath and molten ground. Purify, Flameproof Overalls and the Ember Heart stop it.
      - **Secrets:**
        - the hermit's tower (Lens false wall): Arcane trainer, rune riddle, Orb of Echoes;
        - the belfry hymn: Echo Bell;
        - the King's tomb (Gauntlets): Lionheart Helm;
        - St. Cinder's flooded vault (Tide): Aegis of Dawn;
        - the drowned Fenmill (swim): Thunderwrench;
        - *The Signal Fires*: Ember Heart;
        - *The Master's Hourglass*: Hourglass Charm;
        - Frog King tiers: Signet at 10 flies, Bulwark at 30;
        - the Ward Shard grows to Prism and Crown with each stone.
      - **Brightwater services:**
        - **Trainers' Hall** (3 stones): disciplines whose trainer you've met, respec, Veteran's and Ultimate Tomes. All seven L20 ultimate upgrades are built.
        - **Alchemist** (4 stones): shop, plus *A Second Wind* for the Phial.
        - **Gizmo's workbench:** Traveler's Compass.
        - **Cartographer** (20 townsfolk): lookout pins, plus the Wanderer's Charm once every lookout is climbed. It counts the lookouts that exist (4 now); Wave 3 adds more.
      - **World map** fits a landscape phone.
      - **Wren** now joins at the Gloamwood edge camp.
      - **Left for Wave 3 by design:**
        - Penitent's Gown (Mirelle).
        - Hunter's Tooth: it needs 10 bounties, and 7 exist.
        - The Ferryman (30 townsfolk).
        - The Gold Fly in Amber (50 flies).
    - **Wave 3:** Frosthelm, Mirelle, the Blight Basin and the Tower. **[LOCKED 2026-10-14]**

### Build approach **[LOCKED]**
- **The demo is the foundation, not a throwaway.** Its music, code-drawn art, puppet and gear renderer, systems and data are close to final.
  - The full build extends them in place and only replaces something when Part II requires it.
- **The demo is preserved:**
  - a frozen copy lives in `untitled-rpg-demo/` and keeps serving on LAN port 5180 and at the original private Artifact link;
  - this repo is under git with the snapshot tagged `demo-3`.
- **The full build** gets its own private link and LAN port 5182.

### Known prototype shortcuts
- The world is built in code (`map.js`) rather than in Tiled.
- Difficulty is fixed at Normal; there's no selector in the UI yet.
- Text uses a 3×5 pixel font; a few glyphs (W/H) are hard to tell apart.

---

## Decision Log

| Date | Decision |
|---|---|
| 2026-10-13 | Open world + progressive discovery, real-time action RPG, web first then iOS |
| 2026-10-13 | Dropped "Inkwild" cartographer concept; classic evil-wizard villain |
| 2026-10-13 | Battleheart Legacy-style gear/magic/skill progression; shops, drops, upgrades |
| 2026-10-13 | Story = A + B hybrid: always-visible Ninth Tower, 5 Ward Stones, hub town rebuilt by rescued townsfolk |
| 2026-10-13 | Party: player commands only the leader; companions fully AI, must be smart and never annoying |
| 2026-10-13 | Preset heroes only (no character creator) to keep the art budget manageable |
| 2026-10-13 | Controls: tap-to-command leader, Battleheart Legacy style |
| 2026-10-13 | Start with one hero, recruit more; active party max 3 |
| 2026-10-13 | Classes: home class + one secondary discipline |
| 2026-10-13 | Visible gear: weapons only in v1; armor tiers / paper-doll later (layered renderer from day one) |
| 2026-10-13 | Level scaling: per-region level bands, enemies scale within band |
| 2026-10-13 | XP: only active party members earn XP |
| 2026-10-13 | Art: code-drawn first, validated by a small art POC before committing |
| 2026-10-13 | Length: about 10 hours main game |
| 2026-10-13 | Business: premium pay-once; possible paid expansion packs later (data-driven content, room on map edges) |
| 2026-10-13 | "Malgrim the Unkind" is the villain/story, not the game title |
| 2026-10-13 | Starting hero: choose Brann, Pip or Sable; the other two are the first recruits |
| 2026-10-13 | Leader swap allowed anytime, including mid-fight (short cooldown) |
| 2026-10-13 | Catch-up: recruits join at party average level; Veteran's Tomes for benched heroes |
| 2026-10-13 | Side content: quest log + bounty boards + collectibles |
| 2026-10-13 | Day/night and weather cosmetic only for v1 |
| 2026-10-13 | Audio: code-generated "8-bit plus" music and sound effects with adaptive layers; demoed in the POC |
| 2026-10-13 | Difficulty: Easy / Normal / Hard; companion AI equally smart on all |
| 2026-10-13 | Art POC heroes: Brann, Pip, Sable |
| 2026-10-13 | Title: The Ninth Tower |
| 2026-10-13 | Kingdom: Aldermere. Hub town: Brightwater. More towns long-term (outposts per region now) |
| 2026-10-13 | One hand-built dungeon per region; proposed biomes accepted |
| 2026-10-13 | About 4 min edge-to-edge, campfire fast-travel, no mounts v1; 2D top-down pixel style |
| 2026-10-13 | Dialogue: portraits + per-character voice blips. Saves: 3 slots + autosave |
| 2026-10-13 | Go: build Milestone 0 art + audio POC |
| 2026-10-13 | Milestone 0 POC built: code-drawn art (puppet renderer, per-pixel terrain), synthesized adaptive music/SFX, playable slice with party AI + Ward Stone curse bloom |
| 2026-10-13 | Ship target is a real native iOS game, not a WebView wrapper. The web build is a prototyping tool; data, art atlases and music patterns carry over to the native build |
| 2026-10-14 | Reversed "weapons only": all equipped gear is visible on the character (paper-doll, baked on equip) |
| 2026-10-14 | Demo 2 built: visible gear (36 items), gear menu, 0.72× game speed, loading screens, 4× world with worker-painted streaming chunks + lazy biome assets, recruiting, ultimates, Grapple Hook + cave + chasm, Hex Golem, save/load. Content moved to JSON data files |
| 2026-10-14 | Playtest feedback on Demo 2: game speed 0.72 locked as default; gear looks approved; Golem fair; ultimates distinct. Changes: ult charge ~2.5x slower, XP curve slower (40 + 45/level), gear menu responsive (portrait / short landscape / wide), visible + walk-on cave exit, minimap with fog of war + full world map |
| 2026-10-14 | Demo 3: interiors as separate areas (cave, shop, tavern, grotto); lakeside hamlet with shop + Hexling Whack minigame; tougher enemies + region level bands + elites + archers + hex knights, ~2x enemy groups; secrets (10 Golden Flies + Frog King rewards, breakable walls, hidden grotto); crafting (materials, potions, +1..+3 gear upgrades); live gear FX layer; houses redrawn in top-down 3/4 style and moved out of the castle ruins |
| 2026-10-14 | Combat difficulty on Normal approved. Gear FX toned down (sparse 1px particles, halos behind the sprite, weapon/orb only); FxLab dev scene for tuning effects. Harvestables get a consistent bubble marker + regrow ring + proximity label. Game loop now survives errors (was the likely "freeze") |
| 2026-10-14 | Harvesting is a timed tool action (pickaxe / sickle animations baked per hero; 1.5s herb, 2.4s ore, 3.2s crystal; interruptible) |
| 2026-10-14 | Building doors: door opens, party steps through, fade, door closes behind (exterior overlay + interior door). Portrait craft layout compacted. Automated tests run muted |
| 2026-10-14 | Elemental weapons apply statuses (fire burn, frost chill/slow, venom poison) with enemy weaknesses; Orb of Echoes passive (every 3rd spell echoes) + live floating orb; gear FX depth-sorted per hero so trees/walls occlude them |
| 2026-10-14 | Combat HUD: one bottom-left cluster (dodge, 2 skills, leader ultimate with icon + slow recharge arc); utility (bag, potions) bottom right; portraits now switch hero; ultimates passively recharge (~45s) and AI companions fire their own |
| 2026-10-14 | HUD respects iPhone safe areas (corners / home bar); DODGE + ultimate labels; tapping your own portrait opens the gear menu; ready-state glows are slow and subtle (no blinking). XP curve steepened (50 + 50L + 8L^2); random gear drops cut 25% (16.5%) |
| 2026-10-14 | Combat grid: 6 uniform labelled buttons (leader ULT + both companions' ULTs / DODGE + 2 skills). Companion ultimates fire automatically via AI or manually from their buttons |
| 2026-10-14 | Grapple target changed from a chasm island to a raised rock bluff in Mistfen: hook post at the foot of the cliff hauls the party up, a post on top drops them back down (posts carry a `land` tile). The chasm looked out of place. Prototype is also published as a private claude.ai Artifact for off-network playtests (`npm run build && node tools/make-artifact.mjs`, then republish `dist/artifact.html` with the hashed `assets/*.js`) |
| 2026-10-14 | Part II drafted for review: core numbers, elements, all 8 heroes' skills, gear system (tiers, 32 uniques, 8 legendaries, trinkets), upgrades, materials, enemies by region, lieutenants, relic placement, Brightwater rebuild, full progression |
| 2026-10-14 | Loading curtain: entering the world (Continue / New Game) and slow teleports hold the game behind a full-screen loading screen until the area's art, terrain chunks and enemy groups are in place and the frame time settles; enemies ignore the party for ~1.5s after arrival |
| 2026-10-14 | Demo frozen (`untitled-rpg-demo/`, git tag `demo-3`); the full build extends the demo in waves rather than rebuilding |
| 2026-10-14 | Part II review done, one question at a time: 4+2 gear slots; 3 skills ranked with skill points (levels + shrine/quest bonuses); automatic stats; cooldowns only (+ cooldown gear); Venom replaces Earth; generated gear with light bonus-stat rolls (no downsides; Uniques roll only post-game); refine +10 never fails; level cap 35 with a new XP curve and encounter-density targets; recruit placements kept; errands added; Tower scaling kept; three build waves |
| 2026-10-14 | Wave 1 built (systems + Vale + Mistfen + Kesh/Wren). Balance retune from simulation: enemy HP +25%/level and damage +13%/level (instead of +16% / +10%), so kill times stay roughly flat as gear improves. Vale gate south is the Southwash river with a collapsed bridge (hook posts); Mistfen's lieutenant Mother Murk floods her arena (swim to reach her). Wren's recruit sits in the Vale's western woods for now (Gloamwood itself is Wave 2) |
| 2026-10-14 | Wave 1 playtest fixes: enemy HP bars while engaged; text fitting everywhere; dialogue waits for combat to end; out-of-combat regen; calmer companions; ranged enemies only fire on screen |
| 2026-10-15 | Region music variations (Highmeadow, Mistfen, Depths, Hearth); Mother Murk reworked; key items pause with a card; menus scroll, long names slide, NEW gear tracking |
| 2026-10-15 | Every lieutenant is fought twice: a Shadow in the dungeon at a sacred place, then the true form rising at the Ward Stone. A cursed vine ties stone to sacred place and withers when the Shadow dies. Cinematic boss entrances. The lead hero thinks out loud at each beat of the arc (C12) |
| 2026-10-15 | Skill power budget: modest rank-1 skills (25–35% of basic DPS per target), +20% per rank, longer cooldowns (8–18 s), weaker splash, crit refunds rate-limited, CDR cap 30% |
| 2026-10-15 | Lookout towers are climbable watchtowers that zoom the camera out to ⅓×; one per region (C12). Built: Highmeadow and Fenwatch |
| 2026-10-15 | Health and ultimate values are guarded against invalid numbers (keep the last good value and report the cause) after errand fights rebuilt on load produced NaN levels |
| 2026-10-15 | Elite affixes built (all 8, each with a visible cue); disciplines built with Blade (Master Iren, Brightwater) and Shadow (Sly Margo, Mistfen smugglers' isle) trainers; switching refunds skill points |
| 2026-10-15 | Brightwater rebuild started: 10 cursed townsfolk (Bard at 10, harp music layer); 12 lore pages with a reading card and Journal list; Golden Flies to 20; antidotes |
| 2026-10-15 | Wave 1 complete: frog races (Mistfen), The Champion's Bout errand and Bloodfang Axe. Artifact publishing now ships the hashed scripts with the page (the page alone left the phone stuck on LOADING ENGINE) |
| 2026-10-16 | Never-again rules added to C12 after playtest bugs: rooms keep camera margins so nothing important sits under the HUD; a wipe returns fights, seals and arenas to a retryable state; doors never pin a unit; saves record map width so resizing the world never breaks them |
| 2026-10-16 | The leader can always cancel a swing (never-again rule 5). Vines wither slowly when the Shadow breaks and vanish when the stone falls. Lab boss tuned between the two tested strengths (normal level, 92% health and damage) |
| 2026-10-16 | Enemy AI rules (C7): attack tokens, surround slots, sticky targets, smarter ranged foes, dungeon leash, group roles, elites reading telegraphs, unsticking. Each measured with the new fight benchmark, old vs new over 7 fights × 2 seeds |
| 2026-10-16 | Redesigned dungeons moved into the real game: the Undercroft (from the lab), the Sunken Abbey rebuilt with sluices and the Tide Charm, the Drowned Hollow given a crystal/peg gate. Progress saved per dungeon; old saves migrate. The Sunspire Staff moves from the Gatewarden's drops to the Undercroft vault (Tide Charm) per the uniques table |
| 2026-10-16 | Playtest fixes, each measured old vs new: errand set pieces (`setpiece.js`: fixed posts, turn-taking swings, never facing the party, only a deliberate hit wakes them, a quiet stage clear of world groups) with Quill moved down the east road; companions follow on a loose lead (slack, eased speed, smoothed slot); foes notice the party only on screen, and heroes pick only foes in view or already fighting; morale is rare (1 in 6 small fry, never the last). The title screen shows cloud-save status; saves mirror to the artifact's private storage |
| 2026-10-16 | Wave 2 built: Gloamwood + Witchroot Hollow, Cinderreach + Forge of Ash, Oake and Gizmo, Wave 2 uniques. Recruit NPCs hide once their hero is in the party; a third Vale recruit spot (only used when the starter isn't Brann/Pip/Sable) keeps all three core heroes reachable. Title cards drop the skill list when seven heroes make them narrow |
| 2026-10-16 | Wave 2 finished: unique signatures, hero Burn, hermit's tower + Arcane, belfry, region secrets, Trainers' Hall with L20 ultimate upgrades, Alchemist, workbench, Cartographer, Ward Shard. Region borders made organic (noise-warped, landmarks pinned, region banner has hysteresis) after playtest feedback that the map looked cut into straight bands |
| 2026-10-16 | Playtest: companions over-dodged and the Gatewarden never landed a blow. Companions now react with a delay, wait for the wind-up to lock and skip most ordinary swings; melee wind-ups track their target for half the wind-up; the Gatewarden throws in every phase and follows a whiffed slam with a tracking leap. Measured with fight-bench + the new golemTest |
| 2026-10-17 | Performance pass (battery/frame drops on iPhone): off-screen objects are culled from the camera, the HUD's Graphics are baked into textures and repainted only on change, no live Graphics for static shapes. ms/frame on the Mac: overworld 3.76 -> 1.70, fight 4.22 -> 2.13, dungeon 3.97 -> 1.55 (tools/perf-scenes.js). Rule: never leave a static shape as a live Graphics, and check new per-frame drawing with perf-scenes. Also: open doors show the floor through the arch, vines cross doorways square-on and show faintly under water, and hero-built foes get their own heads and outfits |
| 2026-10-17 | Playtest (Mother Murk): shots cross water; ranged companions hold the shore (dry firing spots, wade out if knocked in); lingering puddles are steered round; dodges take the quickest open way; reactions to tracking blows count from the lock; tongues visibly lash and reel. Measured with tools/murk-test.js, fight-bench and golemTest |
| 2026-10-17 | Full-screen overlays (menu, shop, map, minigames) fill 2px past every edge: a rect drawn exactly at y=0 rasterized one row short and the paused world peeked through the top. Heroes with skill points they can spend show a green "+" badge (same green as the rank-up button) on their HUD portrait, their menu portrait and the SKILLS tab |
| 2026-10-17 | HUD portraits: gold means the leader and nothing else (double gold frame, a gold pointer, gold name). A companion's ready ultimate no longer tints its frame a dimmer gold, which read as a second leader. Portraits carry no ultimate at all (no meter, no ULT! label): the ULT buttons along the bottom already show it |
| 2026-10-17 | Phones play in landscape. iOS Safari can't lock orientation (no lock API, manifest ignored), so a phone held upright (portrait, touch, ≤520px wide) shows a "turn your phone sideways" card and the frame loop sleeps (`game.loop.sleep`; `game.pause` only shifts the clock) with audio suspended; turning back wakes it with no time jump. Android takes a real lock where allowed. A small "play upright anyway" link keeps the portrait layouts reachable for viewers that can't rotate |
| 2026-10-17 | Respawns now match the design ("after a few minutes away, never in sight"): a cleared overworld group waits 3 minutes (was 45 s), and its clock only runs while the party is over 480px away (it used to run only while the area was loaded, i.e. while you were nearby). It reappears only when the party is over 300px off. Tested: 10 minutes lingering nearby never brings a group back; 3 minutes away does |
| 2026-10-17 | Respawn clocks are saved (`state.respawn`: group id -> seconds left, 0 = due but waiting out of sight). Only cleared, not-yet-returned groups are stored; reloading keeps them gone and still never brings one back in view. The clock counts play time, not time with the game closed |
| 2026-10-17 | Root cause of the strip along the top of every overlay: with an odd game height (195 on an 844x390 phone) and roundPixels, WebGL draws everything one pixel low, so row 0 is never covered. `fit()` now keeps the height even (the spare row crops off the bottom); measured row 0 covered in the menu and the lore card. Rule: never let the canvas height go odd |
| 2026-10-17 | Shadow Step reads now: Sable fades into shadow, a dark trail of silhouettes runs to the foe, she rises behind it in a puff and backstabs (sure crit, BACKSTAB! text), ~0.5 s of game time and untouchable while unseen. Same damage as before (one crit hit). Measured: tools/step-test.js (Sable alone hopping between dummies) 87.0 -> 84.8 DPS (-2.5%, the cost of the readable animation); fight-bench mean party DPS 139.6 -> 131.7, within its run-to-run spread (fights moved -21% to +15%) |
| 2026-10-17 | Breaking a townsperson's hex takes a crafted **Hexbane Draught** (BREW: 2 Slime Gel, 1 River Pearl, 1 Hollow Crystal; makes 2). Every part is reachable early (Vale slimes and crabs, Highmeadow wisps) since the first townsfolk are in the Vale; a batch of 2 keeps 20 cures to ~10 pearls and ~10 crystals. Without one, the leader names the recipe; with one, the choice reads USE HEXBANE DRAUGHT (n). Recipes can now make a batch (`count`) |
| 2026-10-17 | HUD: minimap 72x48 -> 56x36 (it sat in the way); a pause button between the bug and volume buttons (or P) freezes the world and music under a PAUSED card, tap anywhere to carry on. Areas smaller than the screen (the Hidden Grotto) are centred in the camera; Phaser pinned short bounds to the top-left, which put the cave under the portraits where nothing could be tapped |
| 2026-10-17 | Playtest: Sable hung back despite her knives. Cause: melee companions waited outside any incoming swing marker, and a foe's ordinary swing marker covers exactly where a melee fighter stands, so she hovered ~9px out of reach. Now only big blows (boss/elite, unsourced AoE) make them wait; ordinary swings are left to the dodge logic. Measured: tools/reach-probe.js Sable in reach 40% -> 86% (Brann 78-84%); fight-bench party DPS 131.7 -> 159.9 (+21%), damage taken 36.2 -> 44.2/s (+22%, she's in the fight now), companions in reach 69.7 -> 77.1% |
| 2026-10-17 | Out of combat the fight buttons (ULT, dodge, skills, allies) fold into one crossed-blades button at the bottom left, 6 s after the last engaged foe (2.5 s felt abrupt in playtest); tapping it opens them for 8 s (kept open while they're used); any fight opens them at once. Keyboard keys work either way |
| 2026-10-17 | XP shows where the portrait ult meter was (lavender bar under health) and on the hero page (a full-width bar with "718/1036 TO LV9" in the phone layout, inline in the wide one). The Skills page lists the ultimate with its level-20 upgrade status, alongside the existing "UNLOCKS AT LV" on locked skills (gear has no level requirements) |
| 2026-10-17 | Gear rows lead with a verdict players can read: "+10% DMG" / "-3% TOUGH" (green/red, `compareGear`: damage = ATK x average crit bonus x a little CDR; toughness = HP x DEF's cut of a same-level hit), a green up / red down arrow for the net, then the raw stat changes in grey. Raw deltas mixed units (ATK, %CRIT, HP, DEF) and were hard to weigh against each other |
| 2026-10-17 | HUD party portraits slimmed to a column down the left edge (chosen from mock-ups: slim stack / mini stack / row; plain vs bordered bars; six level treatments): name above each 22px portrait, health over XP in one strip exactly the frame's width (3px + 2px), leader marked only by the gold frame and gold name (no arrow). Level: bare 3x5 digits (the font without its outline) on a dark patch cut into the frame's top-left corner, the same for every hero, a red X while down. 24 x 130px where the old block was 70 x 90 and blocked a wide corner; each portrait's tap area covers name, art and bars |
| 2026-10-17 | Public hosting on tiiny.host, the same host as Tales of Lumen (manual upload in its dashboard; no CLI). `sh tools/make-tiiny.sh` builds and zips index.html + lab.html + assets/ (index.html at the zip root) to dist/ninth-tower-tiiny.zip, keeping dist/full.html for the phone server and artifact. Saves there live in that site's browser storage (cloud save is artifact-only) |
| 2026-10-17 | Public build on GitHub Pages: https://maxwellimpact.github.io/ninth-tower/ from the public repo maxwellimpact/ninth-tower, which holds only the built files (source stays private). `sh tools/deploy-pages.sh` builds, mirrors dist/tiiny into site/ (that repo's local copy, ignored here) and pushes; Pages updates about a minute later. The tiiny.host zip stays available as a fallback |
| 2026-10-17 | Starting heroes are Brann, Pip, Sable and Wren; Kesh, Oake and Gizmo are only met in the world (The Pit, Excessive Optimism, The Water Wheel). With four cards the picker shows each hero's starting skills; the testing-only lab hint is left off the picker so the cards fit at phone height. Chance-meeting recruit errands no longer fire for a hero already in the party (starting as Wren, the hawk never leads you to rescue Wren) |
| 2026-10-17 | Every tap answers visibly: a ring where it lands (white to walk, including taps on somewhere unreachable; gold under people, levers, chests and other things you use; red on foes), and the tapped thing flashes white for ~0.2 s (a fading white copy laid over its current frame, so its own tint and animation are untouched; TAP_FLASH turns the flash off). Before, taps on interactables only clicked |
