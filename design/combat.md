# Combat, elements and companion AI

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

## 8. Combat & Controls — **[DRAFT]**

### Leader control: tap-to-command, Battleheart Legacy style **[LOCKED]**
- **Tap/click the ground:** the leader moves there.
- **Tap/click an enemy:** the leader targets it and **auto-attacks** with their weapon combo, pathing into range.
- **Left alone in a fight:** the leader keeps up their basic attack on the nearest foe already in the fight.
  - A **ranged** leader only shoots what's in range, with a clear shot, and never moves for it.
  - A **melee** leader also steps in at a foe up to about two and a half tiles past their reach, along a clear line. They let it go if it backs off further.
  - They never use a skill or ultimate. Skills are always the player's.
  - They never pick a foe that's still asleep, an errand's set piece, the Ward Stone or a wall.
  - (Added 2026-10-23, after "he just sits like a bump on a log". The melee step-in was added the same day: "melee has to walk, archer doesn't".)
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

## 9. Magic System — **[DRAFT → see C2/C3]** *(Part II replaces Earth with Venom and drops the Focus/mana bar)*

- **Elements:** Fire, Frost, Storm, Earth, Light, Shadow, with elemental strengths and weaknesses on enemies.
- **Spells** are learned from trainers and tomes, and they **level up with use** and with skill points.
- **Rune modifiers** socket into spells: *Split*, *Pierce*, *Chain*, *Linger*, *Echo*.
- **World interactions** (Fire burns brambles, Frost freezes water, Storm powers machines, Earth cracks stone) are **optional shortcuts and secrets**. Mandatory gates always use relics.
- **Focus** (mana) bar per hero that regenerates in combat. Melee hits restore a little Focus.

---
