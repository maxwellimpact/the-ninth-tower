# Art, animation and audio

See also: [regions.md](regions.md), [tech.md](tech.md).

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
- **[LOCKED 2026-10-26] Detail scales with importance.** Small, repeated scenery (trees, bushes, rocks, tufts) stays simple: a few shaded blobs read well because they're small and there are many. **Key objects** (landmarks, entrances, buildings, bosses: the elder tree, the Colosseum, the Forge Gate, the Tower) get real design. The same treatment that works on a 44 px tree looks puffy and sloppy at 128 px; a big object needs detail at its own scale.
  - **Design like a painter: shape first, then detail.**
    1. **Shape and silhouette.** Block in the big forms and the outline, and get them reading right at a glance, zoomed out. Find a reference in the game's camera (a top-down 3/4 view, light from the upper left) before drawing: Keep Defense's keep showed how the Colosseum should be built.
    2. **Light and volume.** Shade each big form as a solid (a dome, a cylinder, a block) lit from the upper left, with shadow where one form sits behind or under another.
    3. **Mid-scale structure.** Break each form into the parts it's made of (a crown's lobes and clumps; bark's ridges and furrows; a wall's blocks and arcades).
    4. **Fine detail last.** Single leaves and edges catching the light, cracks, knots, moss, hanging roots, small accents. Detail supports the shape and never replaces it.
  - **Tell the story it has to tell.** An entrance has to read as a way in (a lit threshold, steps going down, depth inside); a landmark has to say what it is from across the screen.
  - **Check:** at 3-6x beside the cast and the scenery around it, then in place at phone size (844x390), zoomed in and out. Iterate in rounds and keep the comparison sheets (snapshots/). Watch the cost: anything drawn at boot stays in the tens of milliseconds.
  - **Creatures and bosses turn** (2026-10-27): a creature, like a puppet, has three views (down toward you, side facing right and mirrored for left, up away), built from the same masses at the same heights (feet row, hips, chest, shoulders, head) so it doesn't change size as it turns, far parts drawn first and darker. This is Keep Defense's method (its `ART_GUIDE.md`, `gfx/beasts3.js`). Register them with `creatureViews()` in game/assets.js; the creature's `play()` adds its view. No fractional scaling: a big boss is drawn with more pixels, not a small sprite scaled up.
  - **Big bosses are drawn the cast's way** (2026-10-28; the 3D-modelled pass before it was rejected as forced): `gfx/bigcast.js` builds each boss from hand-authored pixel grids per part per view, like the goblin and hero puppets only bigger, posed per frame. Flat clusters of two or three tones lit from the upper left, no dithering; ink round the silhouette only, and a part that crosses the body (an arm, a haunch) is edged in a dark tone of its own away from where it joins. Build a boss on its kind's own colours and features: Snagtooth on the goblin, Vulk on the Salamander Warriors, Queen Mab on the Gloom Spiders, Mother Murk on the Croaker and the Marsh Witchling. Size by what it is: humans only a bit bigger than the heroes, goblins at the goblin's proportions, the rest large. The upright bosses come out in the puppets' frame shape (`registerBigPuppet` in game/bake.js) and are driven exactly like puppets; the creatures (Mab, Murk, the Drake) register with `creatureViews()`. The bosses: Snagtooth, Gutcrusher, the Pale Huntsman, Vulk, Isolde, Malgrim, Queen Mab, Mother Murk, the Cinder Drake. The Hex Golem, the Avalanche Troll (Keep Defense's three views, in frost) and Old Snapjaw are drawn in creatures.js in three views by hand.
  - **Show the user before and after** (`tools/art-compare.js`) and wait for a yes before shipping new key-object art.
  - **Examples:** the Ninth Tower (2026-10-27: a stepped spire on a buttressed plinth, four tiers in round black masonry, Malgrim's chamber, a crown of horns round the hex, violet light from inside); the Hex Golem (hewn stone blocks bound by the curse's light, in all three views); the elder tree over Witchroot Hollow (2026-10-25/26: puffy blobs, then lit lobes textured by leaf clumps; ridged round bark; a stairway into the hollow) and the Colosseum (a drum, then flat facades, then a ring built the keep's way, with a seated crowd).

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
