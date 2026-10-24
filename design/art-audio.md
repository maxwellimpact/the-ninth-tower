# Art, animation and audio

## 11. Art & Animation — **[DRAFT]**

- **Tiles:** 16×16. **Characters:** about 16×24.
- **Internal resolution:** about 384×216 with pixel-perfect integer scaling. The width stretches to fit phone screen ratios.
- **Palette:** one locked palette of about 40 colors, with an accent sub-palette per region. Cursed regions are desaturated with a purple-grey tint.
- **Characters:** 4 directions with mirroring. About 6-frame walk, 4–6 frame attacks with smear frames, squash-and-stretch on rolls.
- **8 preset heroes:** each needs idle, walk, attack (×2–3), cast, dodge, hurt, downed and victory animations.
- **Living world:** swaying grass, animated water, particles, wildlife that reacts to you.
- **Lighting:** a light mask in caves.
- **[LOCKED] Day/night and weather are cosmetic only for v1.** They cover a palette tint cycle, rain and fog particles, and fireflies at night, with no effect on gameplay. They may become systemic later (night-only spawns or secrets).
- **Effects:** additive particles per element, dither-fade transitions, a big **colour-bloom when a Ward Stone falls** and the curse lifts.
- **Art source — [DRAFT: procedural/drawn-in-code first, gated by a POC]**
  - Heroes, tiles and effects are drawn in code (as in Lumen), but upgraded for animation: frames defined as layered pixel grids with a shared palette, plus tooling to preview animations.
  - **The art POC (Milestone 0) decides** whether we commit, go hybrid (code-drawn characters + asset-pack tiles, or the reverse) or switch to packs.

---

## 11a. Audio — **[LOCKED: code-generated, "8-bit plus"]**

Everything is generated at runtime with WebAudio, as in Lumen. There are **no audio files**, which keeps the build self-contained.

### Music: chiptune with a bit more richness
- **Core voices:** 2 pulse (variable duty cycle), triangle bass, noise percussion. This is the NES-style base.
- **"Plus" layer:**
  - a soft saw/detuned pad for warmth,
  - vibrato and pitch slides,
  - light echo/reverb (convolver or feedback delay),
  - gentle stereo spread,
  - a sub-bass under the triangle.
  - The target sound is *Shovel Knight* or the Famicom expansion chips: unmistakably pixel, but full.
- **Sequencer:** a small tracker-style pattern format (notes and instrument per step), so songs are data and easy to write and tweak.
- **Adaptive layers:**
  - **Exploration → combat:** drums and an extra lead fade in when enemies engage.
  - **Cursed vs. freed region:** the same theme in a minor key, detuned and sparse while cursed. It resolves to major with full instruments when the Ward Stone falls.
  - **Hub town grows musically:** each rescued service adds an instrument layer to the town theme.
- **Track list (v1):** title, hub town, 5 region themes, dungeon/cave, lieutenant boss, the Ninth Tower, Malgrim, victory jingle, level-up and item-get fanfares.
- **Region variations [BUILT]:** every region gets its own variation of the main theme, each in its own key and tempo with its own instrument colours.
  - **Brightwater Vale:** the home theme.
  - **Highmeadow:** brighter and quicker, with a flute-like lead.
  - **Mistfen:** slow and minor-leaning, with a murky pad.
  - **The Depths** (caves and dungeons): sparse and echoing.
  - **Hearth** (shops and the tavern): a cosy jig.
  - **Changing themes:** the music crossfades when you cross a region border, after you've been in the new region for about a second.
  - **Future regions** each add one more variation in the same pattern data: Gloamwood (hushed, music-box), Cinderreach (low drones and anvil hits), Frosthelm (glassy bells, a slow waltz).

### Sound effects
- Synthesized per event using envelope, pitch sweep, noise and filter.
- Each hero has a distinct attack sound per weapon family.
- Spells: one character per element. Fire crackles (noise + low sweep), frost is glassy (high sine pings), storm is a zap (square + random pitch).
- UI, footsteps by terrain, hit/crit/block, pickup, gold, level-up, Ward Stone shatter.
- **Small random pitch variation** on repeated sounds so they don't get tiring.
- **The art POC includes an audio test**: a short exploration loop, a combat layer, the cursed→freed transition, and the core sound effects.

---
