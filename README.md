# The Ninth Tower — Full Build (Wave 1)

An open-world action RPG prototype (see [DESIGN.md](DESIGN.md)). This build exists to answer one question:
**can code-drawn pixel art and code-generated "8-bit plus" audio carry the game?**

Every sprite, tile, effect, sound and note of music is generated at runtime. There are no image or audio files.

## Run it

```bash
npm install
npm run dev
```

- **Game:** http://localhost:5173/ (or the port Vite prints)
- **Sprite & Sound Lab:** http://localhost:5173/lab.html — every animation at 4×, plus a sound board for music layers, all SFX, and character voices

## Controls

| Action | Touch / mouse | Keyboard |
|---|---|---|
| Move | Tap the ground | WASD / arrows (web extra) |
| Attack | Tap an enemy | — |
| Talk / open / rest / grapple / enter | Tap the NPC, chest, sign, campfire, post or cave mouth | — |
| Dodge roll | Swipe, or right-click | Space |
| Skills | Skill buttons (3 slots) | 1, 2, 3 |
| **Ultimate** (when the meter is full) | Top-left button of the combat grid (bottom left); companions' ultimates sit beside it (they also auto-fire) | Z |
| Switch hero | Tap their portrait (top left) | Tab (or Q / E) |
| **Party & Gear menu** | Bag button | I |
| Debug overlay + game-speed slider | Bug button | ` (backtick) |
| **World map** | Tap the minimap (top right) | N |
| Health potion / Elixir | Flask buttons above the skills | H / J |
| Mute | Speaker button | M |

## What's in Wave 1

The full game grows out of the demo (frozen copy: `../untitled-rpg-demo`, git tag `demo-3`). Wave 1 covers the Vale and Mistfen; see DESIGN.md Part II.

- **Systems**
  - Skills: 6 per hero plus 3 passives, ranked 1-5 with skill points (1 per level, plus shrines and some errands). Equip 3 skills and 2 passives in the menu's SKILLS tab.
  - Level cap 35 with a new XP curve. The debug overlay shows a PACE line (minutes per level, kills per minute) for tuning.
  - Six elements: Fire, Frost, Storm, Venom, Light, Shadow.
  - Gear is generated in 6 tiers, Common / Fine / Rare, with small bonus rolls and Rare traits. Plus 2 ring slots, refining to +10 at the Blacksmith (rank-gated), salvage, and gems with sockets (Enchanter).
  - Errands: opt-in quests from townsfolk ("!" markers) and rumour boards, with a JOURNAL tab and a tracker under the minimap.
  - Party roster: up to 3 heroes travel; swap at campfires when you have more.
- **Brightwater Vale**
  - The Brightwater Undercroft dungeon: the Grapple Hook, Hollow Guards, and the Gatewarden, whose armour plates you hook off in phase 2.
  - The Southwash river gate south, with the broken bridge and hook posts.
  - New enemies: boars, crabs, wisps and warlocks. Snagtooth bounty, shrines, a lookout tower.
  - Greta the smith, Old Wick and the Lantern of Embers errand.
- **Mistfen**
  - The Sunken Abbey: the Tide Charm (swim through deep water) and Mother Murk (she floods her nest; swim in to reach her).
  - Fen enemies: drowned, witchlings, leeches, lurkers and croakers. Old Snapjaw bounty.
  - The refugee camp with five errands, and the Mistfen Ward Stone.
- **New heroes:** Kesh the Berserker (win The Pit in Mistfen) and Wren the Ranger (follow the hawk in the Vale's western woods).

## What was in Demo 2

**New since the first test build:**
- **Visible gear (paper-doll).**
  - 36 items: 3 heroes × 4 slots (head, body, weapon, off-hand) × 3 tiers (common, fine, unique).
  - Every piece changes the hero's look. Unique items have unique designs.
  - The look is re-drawn into one sprite sheet when you equip, so there's no per-frame cost.
- **Party & Gear menu.**
  - A tab per hero, with an animated preview you can rotate.
  - The four slots, and a per-slot item list showing stat changes before you equip.
  - Stats: level, XP, HP, attack, defence, crit.
- **Loot.**
  - Enemies sometimes drop "fine" gear.
  - Chests hold the unique items.
  - The boss drops four uniques.
- **Slower combat.** Global game speed now defaults to **0.72×**. Tune it live with the debug panel's SLOW/FAST buttons.
- **Loading screen.**
  - An HTML loader shows while the engine downloads.
  - Then a progress bar tracks the art generation.
- **About 4× bigger world, streamed** (192×128 tiles: Brightwater Vale, Highmeadow, Mistfen marsh and a cave):
  - Terrain is painted in **256px chunks in a Web Worker**, so walking never stutters.
  - Only chunks near the camera stay loaded; far ones are freed, with a hard cap.
  - Props, water sparkles and enemy groups spawn and despawn with their chunk.
  - **Biome art loads lazily:** the marsh and cave sprites generate only as you approach.
  - The debug overlay shows FPS, loaded/total chunks, worker paint times, terrain memory and loaded asset groups.
- **Start with one hero and recruit the others.** The second waits at the Brightwater gate. The third is trapped at the cave mouth in Mistfen; free them from the mire slimes first.
- **Portrait-tap ultimates.** Damage dealt and taken fills the meter.
  - Brann's **Bulwark** shields the party and taunts nearby enemies.
  - Pip's **Meteor** hits the biggest cluster of enemies.
  - Sable's **Thousand Cuts** blinks between up to six enemies, landing a critical hit on each.
- **Exploration unlock (the "find a tool, open new areas" loop).**
  - The **Grapple Hook** is in the chest at the end of the cave ("Drowned Hollow"), which is dark and lit by the party.
  - Use it on the hook post at the foot of the Mistfen bluff to haul the party up the cliff to the chest on top (and the post up top to drop back down).
- **Mini-boss: the Hex Golem** guards the Ward Stone, which is shielded until the golem falls.
  - Phase 1: slams.
  - Phase 2 (below 60%): summons Hexlings and throws boulders at marked spots.
  - Phase 3 (below 30%): enrages, gets faster, and its slams send out shockwave rings you have to dodge through.
- **Save and load.**
  - Autosaves at campfires, chests, loot pickups, recruits, warps, after the boss, and when you close the menu.
  - Continue from the title screen.
  - The save format (`src/game/state.js`) is plain JSON, intended to be shared with the iOS build.

**Still from the first build:** the curse zone and colour bloom when the Ward Stone breaks, adaptive music (major/minor + combat layer), the Frog King, voice blips, companion AI and the Sound Lab.

## Demo 3 additions
- **Interiors are separate maps:** the cave, the shop, the tavern and a hidden grotto live in their own areas. The camera, minimap and world map only ever show the area you're in.
- **Brightwater hamlet** (by the lake, north of the starting path):
  - **Marla's Goods:** buy potions, materials and fine gear; sell spare gear and materials.
  - **The Soggy Frog tavern:** Bruno runs **Hexling Whack**, a 30-second tap game (10G). Prizes at 16 / 28 / 40 points; the top prize includes a Golden Fly.
- **Tougher combat:**
  - Enemies have roughly 1.6× HP and 1.4× damage, and recover faster.
  - Each region has a level band (Vale 1–3, Highmeadow 3–5, Mistfen 3–6, cave 5–7), and enemies scale to the party's level within it.
  - ~30% of groups include a gold-tinted **elite** (2.2× HP, extra drops).
- **New enemies:**
  - **Goblin Archers** keep their distance and show an aim line before firing; the arrows are dodgeable.
  - **Hex Knights** are slow and heavy-hitting.
  - Roughly twice as many enemy groups overall.
- **Secrets:**
  - 10 **Golden Flies**: 9 hidden around the world, plus the Hexling Whack prize. Bring them to the Frog King for rewards at 3 / 6 / 10; the last is a permanent max-HP blessing.
  - Cracked boulders and walls you can attack: a **hidden grotto** behind the NE plateau cliff, and a sealed room in the watchtower.
- **Crafting:**
  - Gather Moonherb (marsh), Iron Ore (rocks with gold flecks) and Hollow Crystal (caves). Enemies drop Slime Gel and Goblin Scrap.
  - In the bag menu's **CRAFT** tab, brew Health Potions and Elixirs, and upgrade equipped gear from +1 to +3.
- **Gathering:** anything harvestable wears a bobbing bubble with its material icon. While regrowing it shows a filling ring and "REGROWS IN Ns". Harvesting is a timed action: the hero swings a pickaxe (ore, crystal) or sickle (herbs) with a progress bar. Herbs take 1.5s, ore 2.4s, crystal 3.2s; moving or getting hit interrupts.
- **Gear effects:** special items carry a live effect layer on top of the sprite (flames, embers, sun-glow, frost, arcane motes, venom, shadow wisps, radiant glints). It also shows in the gear-menu preview.

## Content is data

```
src/data/heroes.json    stats, skills, ultimate, voice, starting gear, recruit lines
src/data/items.json     36 items: hero, slot, rarity, stats, look id, description
src/data/skills.json    skills + ultimates
src/data/enemies.json   hexling, goblin, mire slime, hex golem
src/data/world.json     regions, enemy groups, chests, recruits, warps, grapple posts, campfires, signs
src/data/tuning.json    game speed, defence curve, XP curve, drop chance, ult charge, difficulty
```
These files, `state.js` (save schema + stat rules) and the art generators are the parts meant to carry over to the native iOS build. Only the Phaser rendering/glue code is prototype-only.

## Code map

```
src/gfx/palette.js    locked ~70-colour palette + curse colour transform
src/gfx/pixel.js      canvas helpers: grids, auto-outline, noise, Bayer dither
src/gfx/puppet.js     humanoid puppet renderer (parts + poses -> every anim frame)
src/gfx/heroes.js     hero/goblin part grids, weapons, attack/cast poses
src/gfx/creatures.js  hexling, frog king, shaded blobs
src/gfx/props.js      trees, rocks, campfire, ward stone, ruins, FX sprites
src/gfx/terrain.js    per-pixel terrain chunk painter + cursed variant
src/gfx/font.js       3x5 outlined pixel font (RetroFont)
src/audio/synth.js    WebAudio engine: pulse/triangle/noise + pad/sub/bell, reverb, echo, SFX
src/audio/music.js    tracker sequencer, adaptive layers, Vale theme
src/world/map.js      world layout: vale, meadow, marsh, cave (stand-in for Tiled)
src/gfx/gear.js       paper-doll looks (36 items) + composer + item icons
src/game/state.js     save schema + pure stat/loot rules (portable)
src/game/streamer.js  chunk streaming manager
src/game/assets.js    core + lazy biome asset groups
src/workers/          terrain painting worker
src/game/*.js         units + companion AI, pathfinding, FX
src/scenes/*.js       Boot (generates all art), Title, Game, UI
```

## Dev notes

- `vite.config.js` has a dev-only `/__snap` endpoint. It writes POSTed PNG data URLs to `snapshots/` (gitignored), so sprite sheets and screenshots can be reviewed without a visible browser window.
- `window.__scene` is the live Game scene, for debugging from the console.
- **FxLab** (dev scene): `__game.scene.getScene('Title').scene.start('FxLab', { scale: 2 })` lays out every item with a gear effect for tuning (`src/game/gearfx.js`).
