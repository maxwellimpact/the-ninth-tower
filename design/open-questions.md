# Open questions

See also: [vision.md](vision.md).

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

### Ideas from the first draft not taken up
- **Rune modifiers** socketed into spells: *Split*, *Pierce*, *Chain*, *Linger*, *Echo*. (From the first draft's Magic System, §9. Part II's elements (C2) and skills (C3) replaced the rest of that section; this idea was never adopted or dropped.)

### Known prototype shortcuts
- The world is built in code (`map.js`) rather than in Tiled.
- Difficulty is fixed at Normal; there's no selector in the UI yet.
- Text uses a 3×5 pixel font; a few glyphs (W/H) are hard to tell apart.

---
