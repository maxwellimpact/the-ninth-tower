# Contributing to The Ninth Tower

Contributions are welcome. You could fix a bug, tune a fight, or write a new errand or townsperson. You could take the
story further, or bring a whole new idea. This guide covers what fits the game,
how its art and sound are made, and how to get a change in.

## The spirit of the game

Read [DESIGN.md](DESIGN.md) §1–3 before anything bigger than a bug fix. In short:

- **What it is:** an open-world action RPG for phones, played in landscape. You
  lead a party of three; the other two are smart AI companions.
- **The pillars (§2):**
  1. **Curiosity is rewarded:** every horizon has something.
  2. **Always getting stronger:** gear, skills and allies keep improving.
  3. **Relics are verbs:** each relic changes how you move and opens the world.
  4. **Systems interact:** fire burns brambles, frost freezes water.
  5. **Companions are never a chore:** if they annoy you, that's a bug.
  6. **Pocket-sized sessions:** real progress in 5–10 minutes.
- **The tone:** adventurous and warm, with gentle humour in the dialogue. The
  frog king still issues royal decrees, the party bickers, and cursed townsfolk
  have odd side effects ("I SNEEZE SPARKS"). Malgrim's threat is played
  straight.
- **Fair to the player:** generous drops and gold, no grind, no punishing
  timers. The game is pay-once in spirit: nothing is ever sold, nagged for or
  gated behind money. Don't add anything that works like a monetisation
  mechanic.

## The story

The **core story is fixed**:

- **The threat:** the wizard Malgrim the Unkind has woken the Ninth Tower, and
  its curse has scattered the townsfolk and turned the king into a frog.
- **The goal:** five Ward Stones, each guarded by a lieutenant, power the
  Tower's barrier. Breaking a stone lifts its region's curse, and the colour
  comes back.
- **The structure:** the player picks the order, and the game ends at the top
  of the Tower.
- **Each region's mystery:** a cursed vine drains a sacred place. The vine is
  the trail that solves it (DESIGN.md C12 §1).

**Within that, there's plenty of room:**

- **Welcome:**
  - new errands and townsfolk;
  - lore pages and backstory for the heroes and lieutenants;
  - side stories that deepen a region;
  - new secrets;
  - improvements to existing dialogue.
- **Bigger ideas** (a new region, hero, relic or system) are welcome too.
  DESIGN.md §12a leaves room at the world's edges for new regions: sealed
  borders, an unexplored coast, a sky island. A good proposal says how the idea
  fits the pillars and the Ward Stone story.
- **Doesn't fit:**
  - grimdark or gore;
  - modern or real-world references (brands, memes);
  - mean-spirited humour;
  - anything that contradicts the core story without being agreed first.

**Writing dialogue:**

- All in-game text is **uppercase**: the pixel font has no lowercase.
- The font draws `A–Z 0–9 . , ! ? ' " - + : ; / ( ) \ > < * % # & ~`.
  Nothing else shows up, so no dashes other than `-`, no curly quotes and no
  emoji. A character the game needs can be added: each one is a 3×5 pattern in
  `src/gfx/font.js` (`&` is the one exception, drawn wider across two cells).
- Keep lines short; they have to read on a phone.
- Each speaker has a voice (pitch and wave) in the data. Give new characters
  their own.

## Art and sound are generated in code

There are **no image or audio files** in this project, and contributions must
keep it that way. Every sprite, tile, effect, sound and note of music is drawn or
synthesised at runtime:

- **Art:** `src/gfx/`. Sprites are pixel grids and drawing code on a locked
  palette (`src/gfx/palette.js`). People are built from shared parts by the
  puppet renderer (`src/gfx/puppet.js`), and creatures use shaded blobs and
  chunky grids with a lit top-left and the shared ink outline.
- **Sound:** `src/audio/`. Sound effects are WebAudio synth patches in
  `synth.js`, and music is tracker patterns in `music.js`.
- **New art must match the cast** (never-again rule 6 in DESIGN.md C12 §8).
  Render it beside existing sprites at 3× with `tools/sheet.js`, and include
  that sheet in your pull request. Use palette colours, not new ones, unless the
  change is about the palette.
- **Don't paste in someone else's work:** no art traced from other games, no
  melodies from existing songs, and nothing you don't have the right to release
  under MIT.

This rule keeps the game self-contained. The art generators can also export
sprite atlases for a future native build.

## How to contribute

1. **Open an issue first** for anything beyond a small fix: new content, story
   changes, new systems, balance changes. Say what you want to do and how it
   fits the game. That way nobody spends a weekend on something that won't be
   merged.
2. **Read the design for the part you're touching.** The never-again rules
   (DESIGN.md C12 §8) are bugs that shipped once; check your work against all
   of them. The latest decision log rows at the end of DESIGN.md explain recent
   choices. Don't undo one without discussing it first.
3. **Content is data.** Heroes, skills, gear, enemies, the world, dungeons and
   errands live in `src/data/*.json`. Prefer adding data over adding code. Keep
   game rules (damage, XP, AI decisions) separate from Phaser calls, so they can
   be carried to the native build.
4. **Test on a phone-sized screen:** landscape, 844×390. Then use the tools in
   `tools/` (see the [README](README.md#dev-tools)):
   - `tools/errand-walk.js` for errands and `tools/dungeon-walk.js` for dungeons;
   - `tools/region-check.js` and `tools/people-check.js` after placing anything
     or anyone;
   - `tools/fight-bench.js` before and after any combat or AI change. Run the
     old code twice to see how much the numbers vary on their own;
   - `tools/perf.js` for anything that could cost frames or load time. The
     rule is that nothing costs more because the map is bigger (never-again
     rule 14). Measure on the dense 40× Vast (`?map=vast40d`) as well as the
     main map;
   - `tools/map-test.js` for the integration tests. To try a new enemy, boss
     or system on its own, make a small test map in `src/data/maps/` and open
     it with `?map=<id>` (DESIGN.md §13 has the format);
   - after every run, check the browser console for `[loop]` errors. A crash
     inside the game loop shows up nowhere else.
5. **Log the decision:** add a dated row to the decision log at the end of
   DESIGN.md: what changed, why, and how you tested it. Update the design
   section too if you changed how something works.
6. **Open a pull request:**
   - Keep commits small, each with a clear message.
   - Describe what you tested and what you didn't.
   - Add screenshots at phone size for anything visual.

## Working with an AI coding agent

If you use an AI agent (Claude Code, Codex, Cursor or similar), point it at
[AGENTS.md](AGENTS.md). It holds the project's working rules in short form
(CLAUDE.md just includes it). You're still responsible for the result: review
what it wrote, play the change yourself, and say in the pull request that an
agent helped.

## License

By contributing, you agree that your contribution is released under the
project's [MIT License](LICENSE).
