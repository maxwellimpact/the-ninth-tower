// Item icon textures, generated on first use (gear is generated too, so the
// set of icons isn't known up front). Icons are shared per look.
import items from '../data/items.json';
import { itemIcon } from '../gfx/gear.js';
import { registerItem } from './itemgen.js';

export function itemTex(scene, id) {
  const it = items[id] || registerItem(id);
  if (!it) return '__MISSING';
  const key = `icon_${it.hero || 'any'}_${it.slot}_${it.look}`;
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, itemIcon(it.hero, it.slot, it.look));
  return key;
}
