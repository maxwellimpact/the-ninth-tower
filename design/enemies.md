# Enemies

See also: [combat.md](combat.md), [dungeons-relics.md](dungeons-relics.md), [regions.md](regions.md).

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
| **Rootling** | 1.5 | 1.0 | Walks slowly at you on its roots and throws thorns; burns easily. A walking stump in three views: warm bark, ember eyes, a crown of leaves that sways, five roots shuffling forward in two alternating sets, a branch arm cocked back and flung | Fire / Venom | Heartwood (sells) |
| **Gloom Spider** | 1.1 | 1.1 | Webs that root you; climbs walls. Seen from above in three views (it turns to face where it crawls): a round purple abdomen with the pale hourglass, a red-eyed head with white fangs, eight jointed legs stepping in two alternating sets; it skitters, quick dashes and dead stops, its legs keeping pace; rears up with fangs bared before it bites. Its spiderlings are the same beast small | Fire / Venom | Silkthread |
| **Spectral Hound** | 0.8 | 0.9 | Packs of 3–4 that flank. A lean hunting hound made of ghost-light: pricked ears, a long muzzle, a thin whip tail fraying into mist, glowing eyes, lit from within along its back; three views, an 8-frame trot (gfx/beasts.js) | Light / Frost | — |
| **Wailing Banshee** | 1.2 | 0.8 | Scream interrupts your casts and staggers; break line of sight | Light / Shadow | Crystal |
| *Mini-boss:* **Queen Mab** (bounty) | 9 | 1.6 | Spider queen. Lays egg sacs that swell, split and let out spiderlings (small spiders at her level that run at the nearest hero) unless smashed first. Spits a silk line at a hero who keeps away: a silk ball swells at her fangs and a ring closes on the mark, then the ball flies, wraps them in a web and she reels them in for a bite; a dodge leaves it to splat as a web on the ground | Fire / Venom | Silk ×5 (makes Nightsilk Coat) |

### Cinderreach (volcanic badlands; heat soft-gate)
| Enemy | HP | DMG | Behaviour | Weak / Resist | Drops |
|---|---|---|---|---|---|
| **Ember Imp** | 0.7 | 1.1 | Blinks around throwing firebolts. A little fire-devil in three views: bat wings that never stop beating, thin tongues of flame for hair flickering on their own beat, horns, a fanged grin, a tail with a flicking spark; it conjures the fireball over its palm, growing, then hurls it | Frost / Fire | Brimstone |
| **Magma Slug** | 1.6 | 0.9 | Leaves a burning trail. A fat slug of cooling rock on a sole of fire, in three views: a bulge rolls from tail to head as it crawls, glowing cracks along its back pulse, two eye stalks, a glowing mouth from the front; it rears its front half to strike | Frost / Fire | Brimstone |
| **Salamander Warrior** | 2.0 | 1.4 | Shield and spear; lunges | Frost / Fire | Salamander scale |
| **Basalt Brute** | 3.0 | 1.6 | Rock armour (−80% damage) until Storm, a Bomb or the Gauntlets crack it. The Hex Golem's little cousin: the same hulk of hewn blocks at two-thirds the size, in black basalt with lava in its seams, glowing fire cracks across its stones and a molten fissure down its chest; cracked, the lava runs hotter and more cracks open. Three views; it smashes with both fists | Storm / Fire | Silver ore |
| **Fire Beetle** | 0.5 | 2.0 | Rushes in and explodes; kill it at range. Seen from above in three views: a dark crimson carapace split down the middle with lava glowing in the seam, gold eyes and feelers, six legs in a tripod gait; before it bursts its shell swells and the seams run white-hot | Frost / Fire | Brimstone |
| *Mini-boss:* **Cinder Drake** | 12 | 2.0 | Young dragon that walks heavily on four legs. Its moves come in turn: fire breath (its throat glows over a fan marked on the ground, then a jet of fire sweeps across it), then flight (it crouches with wings up, climbs in sight, hangs over a marked spot and dives). Bites between: it rears its head up and back with its jaws gaping (dark, fanged, no fire), then its neck whips out long and low at the mark, its body sliding after it until its jaws reach the hero (an ember-red trail; from the front, its head comes at you larger, jaws wide and wings flicked up), and its jaws snap shut ("CHOMP!" on a hit) before it pulls back | Frost / Fire | Gnasher |

### Frosthelm (frozen highlands; cold soft-gate; cliffs)
| Enemy | HP | DMG | Behaviour | Weak / Resist | Drops |
|---|---|---|---|---|---|
| **Frost Wolf** | 0.9 | 1.0 | Packs; bites that Chill. A grey-blue timber wolf (dark saddle, frost-pale belly and ruff, so it shows on snow), head carried low, bushy tail; built on a dog skeleton, the hind legs standing under the rump; three views, an 8-frame trot (gfx/beasts.js) | Fire / Frost | Wolf pelt |
| **Rimehorn** | 2.8 | 1.5 | Big beast; throws snowballs that Freeze, then charges | Fire / Frost | Pelt, rimeglass |
| **Ice Wraith** | 1.0 | 1.2 | Flying; flies through walls | Fire, Light / Frost | Rimeglass |
| **Hex Sentinel** | 1.8 | 1.2 | Crystal turret, rooted to the spot: a tall cursed ice crystal in iron bands on a carved frost-stone drum, lesser crystals grown off it, a hex eye in an iron mount on its face, two ice shards circling. In three views, it turns to watch its mark. Its tell: the rune on its drum lights, the curse climbs a vein through the ice into its eye, and the shards swing round before it; then the eye flares, the ice flashes and the shards fly. Reflects spells from the front (in the data; not built yet) | Storm / Frost | Crystal, silver ore |
| **Snow Goblin Raider** | 1.0 | 1.1 | Rides a sled and drops bombs in passes | Fire / Frost | Scrap |
| *Mini-boss:* **Avalanche Troll** | 14 | 2.1 | Pounds the ground to bring down icicles; regenerates unless Burning | Fire / Frost | Troll-Hide Mantle |

### Blight Basin & the Ninth Tower (levels 24+)
Here every Hex Legion enemy appears as a **Hexborn** version: elite stats and one affix. There are also four new enemies:

| Enemy | HP | DMG | Behaviour | Weak / Resist | Drops |
|---|---|---|---|---|---|
| **Voidling** | 1.0 | 1.3 | Teleports next to the weakest party member | Light / Shadow | Void shard |
| **Tower Gargoyle** | 2.5 | 1.6 | A statue while the leader faces it; moves when you turn away. A grotesque of tower stone on all fours (the beasts' skeleton, gfx/beasts.js), three views: bat wings (a bony arm to a clawed wrist, fingers, scalloped skin) folded at rest, half open as it lopes, spread to pounce; horns sweeping back off its brow, a fang over its lip, a spade-tipped tail, hairline cracks; at rest a statue with its eyes dark, they kindle curse-light when it moves | Storm / Venom | Starmetal |
| **Chain Warden** | 3.5 | 1.8 | Chains two party members together for 6 s (slowed, +20% damage taken, yanked back if they pull apart), drawn as iron links with shackles and a countdown; break it by tapping it with the hook | Light / Shadow | Starmetal |
| **Malgrim's Mirror** | = leader | = leader | Copies your current leader, including their gear look | Light / — | Void shard |

### Elemental attacks **[BUILT 2026-10-24]**
Most foes hit with plain force. A few attack with an element, and armour gems of that element resist them (see [gear.md](gear.md), "Armour gems"). The rule: a foe attacks with an element only where its attack already burns, chills, poisons or is plainly a spell of that kind. What a foe *resists* is a separate thing: plenty resist an element they don't attack with (crabs and trolls resist frost; hollows and rootlings resist venom).
- **Fire:** Ember Imps (their shots), Magma Slugs (burning trails), the Cinder Drake (breath and bite), Forgemaster Vulk.
- **Frost:** Frost Wolves (chilling bites), Ice Wraiths, Hex Sentinels (ice shards), Isolde the Rimeguard; and the Avalanche Troll's chilling stomp (not its fists).
- **Venom:** Gloom Spiders, Marsh Witchlings (their slowing orbs), Mother Murk.
- **Shadow:** Wailing Banshees, Malgrim the Unkind (his bolts; his fire and frost hazards are fire and frost).
- **Hex Warlocks cast the school of the region they're met in:** fire in Cinderreach, frost in Frosthelm, venom in Mistfen, shadow everywhere else (the hex). The bolt takes the school's colour and leaves its mark on a hit: a short burn (2 s), chill (1.2 s), poison (3 s) or hex-slow (1.5 s).
- In data: `element` in enemies.json (`"region"` for the warlock's school); in play, `Enemy.atkEl`.

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
