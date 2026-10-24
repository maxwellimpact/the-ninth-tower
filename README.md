# The Ninth Tower

An open-world action RPG in pixel art, played on a phone in landscape.

**Play it:** https://maxwellimpact.github.io/ninth-tower/

**How it works:** [Inside The Ninth Tower](https://maxwellimpact.github.io/the-ninth-tower/) walks through the game's systems (sprites, streaming, loading, pathfinding, combat, dungeons, music, data, performance and testing) with live demos built from the game's own code.

A wizard has cursed the realm of Aldermere from the Ninth Tower. Lead a party of
three heroes through eight regions, break the Ward Stones that hold the curse,
find the relics that open up the world, and climb the tower's nine floors.

Every sprite, tile, effect, sound and note of music is generated in code at
runtime. There are no image or audio files in the repo.

## What's in it

- **Eight heroes**, three in the party at once: Brann (Guardian), Pip (Arcanist), Sable (Duelist), Wren (Ranger),
  Kesh (Berserker), Oake (Cleric), Gizmo (Tinkerer) and Mirelle (Frost Witch). You
  steer the leader; the other two fight alongside you on their own. Each hero has
  skills, passives and an ultimate.
- **One continuous world:** Brightwater Vale, Highmeadow, Mistfen, Gloamwood,
  Cinderreach, Frosthelm, the Blight Basin and the Ninth Tower itself.
- **Seven relics that open the map:** the Grapple Hook, Tide Charm, Lantern of
  Embers, Seer's Lens, Stone Gauntlets, Climbing Claws and Gale Cloak.
- **Dungeons with puzzles and bosses:** the Brightwater Undercroft, the Sunken
  Abbey, Witchroot Hollow, the Forge of Ash, the Clawhold and the Rimeglass
  Spire, then the tower's nine floors.
- **Gear and crafting:** generated gear in tiers, rings, refining, gems and
  sockets, potions and salves.
- **Errands and townsfolk:** quests from the people of each region. You can also
  rescue the hexed townsfolk, and Brightwater's homes open as they come back.
- **Mini-games:** frog races, Hexling Whack, the Pit and the archery butts.
- **Travel:** the Ferryman opens portals between campfires you've rested at.

## Run it

You need Node.js (18 or later).

```bash
npm install
npm run dev
```

- **Game:** the address Vite prints (http://localhost:5173/ by default)
- **Sprite & Sound Lab:** `/lab.html` shows every animation at 4× and has a
  sound board for the music layers, sound effects and character voices.

`npm run build` writes a static build to `dist/` that any web host can serve.

The guide is its own small site in `guide/`: `npm run guide` runs it, and `npm run build:guide` builds it into `dist-guide/` (GitHub Actions publishes it on every push to `main`).

## Controls

The game is made for touch. Keyboard keys are there for playing on a computer.

| Action | Touch / mouse | Keyboard |
|---|---|---|
| Move | Tap the ground | WASD / arrows |
| Attack | Tap an enemy | — |
| Talk, open, rest, enter, push, climb | Tap the person or thing | — |
| Dodge roll | Swipe, or right-click | Space |
| Skills | Skill buttons | 1, 2, 3 |
| Ultimate (when its meter is full) | Ultimate button | Z |
| Switch hero | Tap their portrait (top left) | Tab, Q / E |
| Party, gear, skills, crafting, journal | Bag button | I |
| World map | Tap the minimap (top right) | N |
| Potion / Elixir / Antidote / Salve or Tonic | Flask buttons | H / J / K / L |
| Pause | Pause button | P |
| Mute | Speaker button | M |
| Debug overlay | Bug button | ` (backtick) |

## How it's organised

Content lives in data files, and the code reads them:

```
src/data/       heroes, skills, gear, items, enemies, the world, dungeons,
                errands and townsfolk (quests), relics, crafting, lore, tuning
```

The code:

```
src/gfx/        the art: palette, pixel helpers, the puppet renderer for
                people, creatures, props, terrain, dungeons, cottages, the font
src/audio/      the WebAudio synth and the music sequencer
src/world/      the world map layout and regions
src/game/       units and companion AI, skills, pathfinding, dungeons, errands,
                saving, chunk streaming
src/scenes/     Phaser scenes: Boot (generates all the art), Title, Game, UI,
                menus, shop, world map and the mini-games
src/workers/    the terrain painter (runs in a Web Worker)
src/lab/        the Sprite & Sound Lab
tools/          dev test tools (see below)
```

- **[design/](design/README.md):** the full design, split by topic. It covers the story, every system, each region's
  content and a dated log of every decision. Start with its README.
- **[AGENTS.md](AGENTS.md):** the working rules for building and testing the game.

## Dev tools

The `tools/` scripts run in the browser console of a dev build. Each file's
header says how to use it. Among them:

- `tools/goto.js`: jump anywhere in the world.
- `tools/errand-walk.js`: plays every errand start to finish.
- `tools/dungeon-walk.js`: plays each dungeon through to its boss.
- `tools/region-check.js` and `tools/people-check.js`: check that everything
  and everyone stands somewhere you can walk to.
- `tools/fight-bench.js`: fight benchmark for comparing combat changes before and after.
- `tools/map-test.js`: integration tests on small test maps, away from the main map.
- `tools/perf.js`: frame profiling (CPU time per frame, split into logic and drawing).
- `tools/leader-test.js` and `tools/staged-test.js`: the idle leader's attacks, and errand set pieces.

**Test maps** (`src/data/maps/`) are small maps for trying one thing in isolation, without the main world's packs, errands or load time: open one with `?map=<id>` (for example `?map=arena`). They never save. [design/tech.md](design/tech.md) (§13, "Test maps") has the format.

**The Vast** is a generated map ten times the size of the main world, for profiling load times and frame rates: open it with `?map=vast` (`?map=vast40` for forty times). The title screen's button opens `?map=vast40d`, the dense one, which adds the main game's people and collectibles at its density. Its load timings show in the debug panel and in a `[load]` console line. [design/tech.md](design/tech.md) (§13, "The Vast") has the details.

Deep links start the game in a sandbox that never reads or writes your save: `?demo=combat` (waves of foes on the `arena` test map), `?demo=boss` (the Gatewarden's Shadow) and `?demo=explore` (free roam from Brightwater). The guide embeds the combat one.

In a dev build, `window.__scene` is the live Game scene. The dev server also has
a `/__snap` endpoint that saves a POSTed PNG data URL into `snapshots/`.

## Contributing

Contributions are welcome: bug fixes, balance, new errands and townsfolk, lore,
and bigger ideas that grow the story or the world. Everything should fit the
game's spirit: warm and adventurous, with gentle humour, generous to the player,
and built around the Ward Stones and the Tower. Art and sound stay generated in
code, so no image or audio files. For anything beyond a small fix, open an issue
first.

[CONTRIBUTING.md](CONTRIBUTING.md) covers the story, how to write dialogue, how
the art and sound are made, and the testing and pull request process.

## Built with

[Phaser 3](https://phaser.io/) and [Vite](https://vitejs.dev/).

## License

[MIT](LICENSE) © 2026 Jonathan Cox
