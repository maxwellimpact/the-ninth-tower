// Bakes a hero's current gear into a sprite sheet + animations. Called at
// load and whenever equipment changes, so gameplay only ever draws one
// sprite per hero no matter how many gear layers it has.
import { heroDef } from '../gfx/heroes.js';
import { buildPuppetFrames } from '../gfx/puppet.js';
import { portraitFrom } from '../gfx/creatures.js';
import { makeCanvas } from '../gfx/pixel.js';

export const ANIM_RATES = { idle: 2.5, walk: 9, attack: 15, cast: 9, dodge: 16, hurt: 1, downed: 1, mine: 5, gather: 4 };
let seq = 0;

export function packFrames(scene, key, frames) {
  const w = frames[0].canvas.width, h = frames[0].canvas.height;
  const [c, ctx] = makeCanvas(w * frames.length, h);
  frames.forEach((f, i) => ctx.drawImage(f.canvas, i * w, 0));
  const tex = scene.textures.addCanvas(key, c);
  frames.forEach((f, i) => tex.add(f.name, 0, i * w, 0, w, h));
  return tex;
}

// recolor (optional): a pass over every frame canvas before packing, e.g. the
// Banshee's ghost palette
export function registerPuppet(scene, key, def, recolor = null) {
  const fr = buildPuppetFrames(def);
  if (recolor) for (const views of Object.values(fr)) for (const frames of Object.values(views)) frames.forEach(recolor);
  const list = [];
  for (const [anim, views] of Object.entries(fr)) for (const [v, frames] of Object.entries(views)) frames.forEach((canvas, i) => list.push({ name: `${anim}_${v}_${i}`, canvas }));
  packFrames(scene, key, list);
  for (const [anim, views] of Object.entries(fr)) for (const [v, frames] of Object.entries(views)) {
    scene.anims.create({
      key: `${key}_${anim}_${v}`,
      frames: frames.map((_, i) => ({ key, frame: `${anim}_${v}_${i}` })),
      frameRate: ANIM_RATES[anim],
      repeat: ['idle', 'walk', 'mine', 'gather'].includes(anim) ? -1 : 0,
    });
  }
  scene.textures.addCanvas(`${key}_portrait`, portraitFrom(fr.idle.down[0], 16, 10, 16));
  return fr;
}

// Is any live game object (in any scene) still drawing this texture?
function textureInUse(game, key) {
  for (const sc of game.scene.scenes) {
    if (!sc.sys.displayList) continue;
    for (const o of sc.sys.displayList.list) if (o.texture && (o.texture.key === key || o.texture.key === `${key}_portrait`)) return true;
  }
  return false;
}

// Retire an old baked sheet once nothing references it (afterimages, menu
// previews and HUD portraits can briefly hold the previous look).
export function retirePuppet(scene, key, tries = 0) {
  const game = scene.sys.game;
  if (textureInUse(game, key) && tries < 40) { setTimeout(() => retirePuppet(scene, key, tries + 1), 250); return; }
  if (!textureInUse(game, key)) unregisterPuppet(scene, key);
}

export function unregisterPuppet(scene, key) {
  for (const anim of Object.keys(ANIM_RATES)) for (const v of ['down', 'up', 'side']) scene.anims.remove(`${key}_${anim}_${v}`);
  if (scene.textures.exists(key)) scene.textures.remove(key);
  if (scene.textures.exists(`${key}_portrait`)) scene.textures.remove(`${key}_portrait`);
}

// Returns the new texture key for this hero's look.
export function bakeHero(scene, heroId, equip, oldKey) {
  const key = `${heroId}#${++seq}`;
  registerPuppet(scene, key, heroDef(heroId, equip));
  if (oldKey) setTimeout(() => retirePuppet(scene, oldKey), 400);
  return key;
}
