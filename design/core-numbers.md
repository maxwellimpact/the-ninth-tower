# Core numbers

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
- **Post-game:** every band rises to 26–35. Enemies match the party inside a band, so the post-game starts at about the party's level and climbs with it to the level 35 cap (it was 30–35, which put a typical L24 party 6–11 levels under everywhere).
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
