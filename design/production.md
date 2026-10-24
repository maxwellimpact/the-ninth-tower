# Milestones and what the full build needs

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
