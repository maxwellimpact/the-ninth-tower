# Heroes, skills and ultimates

See also: [combat.md](combat.md), [gear.md](gear.md), [progression.md](progression.md).

## C3. Heroes, Skills & Ultimates

### Loadout **[REVISED from the first draft, §6]**
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
- **Cooldowns only, no mana bar.** **[REVISED from the first draft, §9]** Focus is dropped: a phone HUD already shows cooldown arcs, and a second resource is one more thing to read mid-fight.
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
| Ultimate | **Thousand Cuts** (demo) | Streaks between up to 5 foes, critting each (paced: a shadow streak to each foe, a beat, then the slash). *L20:* up to 8 foes, and recasts free if the last one dies |

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

## 4. Heroes & Party

Who the heroes are and how the party works. Each hero's skills, passives and ultimate are in C3 above.

### Preset heroes (no character creator)
All heroes are **hand-designed presets**. That keeps the art budget manageable: one sprite set per hero, drawn well.

- **You start with a single hero** and recruit others through the story, exploration and side quests.
- **The active party holds at most 3.**
- **[LOCKED] Choose 1 of 3 starting heroes:** **Brann** (Guardian), **Pip** (Arcanist) or **Sable** (Duelist).
  - **The two you didn't pick become your first recruits.** One joins in the opening and one in the first region, so all three are available early and the party mechanics are in play quickly.
  - **The story is shared.** Each starter gets a short personal intro scene and some dialogue variants. Other heroes react to who your leader is, so their banter changes with your choice.
  - The remaining 5 heroes are recruited through regions and side quests.

**The roster (8):**

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
- **You control only the leader** using tap-to-command (see [combat.md](combat.md), §8). **Companions are fully AI-driven.**
- **[LOCKED] Swap leader at any time, including mid-fight,** with one button (there's a short cooldown so it can't be spammed). You take over that hero, and the previous leader becomes AI-controlled.
- **Ultimates:** each companion has an ultimate that charges in combat. Tap their portrait to fire it. This is the only direct command you give a companion.
- **Downed, not dead:** fallen members can be revived mid-fight, and companions revive each other. A full party wipe sends you to the last campfire with a small gold penalty.
