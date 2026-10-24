# Vision, pillars and story

See also: [progression.md](progression.md), [regions.md](regions.md).

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
The wizard **Malgrim the Unkind** has woken an ancient black spire, **the Ninth Tower**, in the middle of the realm: older than the kingdom, sealed for a thousand years, and turned by him into a lens that draws on the realm's holy places. Its curse spread across the kingdom:

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

## 12a. Business Model — **[LOCKED]**

- **Premium, pay once.** No in-app purchases, energy timers or premium currency. Nothing in the game (upgrades, loot, revives, speed-ups) is ever sold for money; the user's rule is to earn money for effort, never to milk players.
  - The economy is tuned for **fun pacing, not grind**: drops and gold should feel generous.
- **Future expansion packs** (paid DLC) are possible. To make them cheap to add later:
  - All content is **data-driven**: regions, heroes, items, enemies and quests are defined in data files, not hard-coded.
  - The world map leaves **room at the edges** (sealed borders, an unexplored coast, a sky island) where expansion regions can attach.
  - There's a **post-game state**: after Malgrim falls, the world stays open so expansions and cleanup make sense.

---

## 15. Title & Names

**[LOCKED] Title: _The Ninth Tower_.** Expansions can use subtitles, for example *The Ninth Tower: The Sunken Crown*.
*Before shipping, check App Store and Steam name availability and trademarks.*

**[LOCKED]** Kingdom: **Aldermere**. Hub town: **Brightwater**.


---
