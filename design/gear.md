# Gear, upgrades and gems

See also: [crafting.md](crafting.md), [heroes-skills.md](heroes-skills.md), [plans/armour-gems.md](plans/armour-gems.md).

## C4. Equipment

### Slots **[REVISED from the first draft, §7]**
- **4 visible slots:** Weapon, Off-hand, Head, Body. These are the demo's slots, all baked into the sprite.
  - **How it's drawn:** gear is drawn as layers by the puppet renderer and **baked into the hero's sprite sheet when equipment changes**. This keeps runtime cost at one sprite per hero, and the same approach works natively on iOS. Unique items have unique looks.
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
| Sable | **Whisper & Wane** | Thousand Cuts hits up to 10 foes and recasts on a kill |
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
- **A gem on armor** gives resistance to that element instead of damage. (**Not built yet:** today the gems tab says element gems do nothing in armour. See the plan below.)

### Wardrobe (cosmetic)
- **Any look you've ever owned** can be shown over your current gear, slot by slot. This is cheap to do with the paper-doll baker, and it lets players keep a favourite look.
