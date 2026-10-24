// Cloud copy of the save. Inside the Claude app the page's localStorage can be
// wiped between visits, so the save is mirrored to the artifact's db, in the
// viewer's own private subtree (data/users/<id>/save). localStorage stays the
// working copy; this only restores it at boot and backs it up after saves.
// Anywhere without the artifact runtime (dev server, a saved copy) it's a no-op.
// Each save key has a document of its own: the main save is `save`, a map's
// own save (`ninthTower.save.v1.map.<id>`) is `save_map_<id>`.
const docName = (key) => key.replace(/^ninthTower\.save\.v1/, 'save').replace(/\W/g, '_');
let user = null; // the viewer's private subtree, once the runtime answers
const pending = new Map(); // key -> { json, savedAt } waiting to be written
let timer = null;
const copies = new Map(); // key -> the newest save JSON we know of, for when localStorage refuses it entirely
export const cloudCopy = (key) => copies.get(key) || null;
const docFor = (key) => user && user.db.doc(`data/users/${user.id}/${docName(key)}`);
// for the title screen: is the cloud copy working on this device?
let status = 'connecting';
export const cloudStatus = () => status;

const withTimeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), ms))]);

async function connect() {
  const use = window.claude?.use;
  if (!use) { status = 'off (no runtime)'; return null; }
  const [db, u] = await Promise.all([use('db'), use('user')]);
  if (!db || !u) { status = `off (${!db ? 'no db' : 'no user'})`; return null; }
  const id = await u.id();
  if (!id) { status = 'off (signed out)'; return null; } // no private subtree, stay local-only
  return { db, id };
}

// At boot: pull each cloud save into localStorage when it's newer than the
// local one (or the local one is gone). Never waits more than a few seconds.
export function cloudRestore(keys) {
  let late = false; // gave up waiting: the title screen has already read the save
  setTimeout(() => { late = true; }, 4000);
  return withTimeout((async () => {
    try {
      user = await connect();
      if (!user) return;
      if (pending.size) { clearTimeout(timer); timer = setTimeout(flush, 1500); } // saves made while connecting
      if (late) return; // too late to restore, but backups still go through
      const snaps = await Promise.all(keys.map((k) => docFor(k).get()));
      const main = snaps[0]?.exists ? snaps[0].data() : null;
      status = main?.json ? 'on' : 'on (empty)';
      if (late) return;
      keys.forEach((key, i) => {
        const cloud = snaps[i].exists ? snaps[i].data() : null;
        let local = null;
        try { local = JSON.parse(localStorage.getItem(key) || 'null'); } catch { /* unreadable -> treat as missing */ }
        if (cloud?.json && (!local || (cloud.savedAt || '') > (local.savedAt || ''))) {
          copies.set(key, cloud.json);
          try { localStorage.setItem(key, cloud.json); } catch { /* storage blocked: loadState falls back to the copy */ }
        } else if (local && (!cloud || (local.savedAt || '') > (cloud.savedAt || ''))) {
          cloudBackup(key, JSON.stringify(local), local.savedAt); // local is ahead (saved while offline)
        }
      });
    } catch (e) { status = `error ${e?.code || e}`; console.warn('[cloudsave] restore failed', e); }
  })(), 4000).then(() => { if (status === 'connecting') status = 'slow (gave up waiting)'; });
}

// After each save: back up the latest one, batched so a burst of autosaves
// (chest, warp, menu...) becomes a single write.
export function cloudBackup(key, json, savedAt) {
  copies.set(key, json);
  pending.set(key, { json, savedAt }); // held until the runtime answers, if it hasn't yet
  if (!user) return;
  clearTimeout(timer);
  timer = setTimeout(flush, 1500);
}

function flush() {
  if (!user || !pending.size) return;
  for (const [key, body] of pending) {
    docFor(key).set(body).then(() => { status = 'on'; }, (e) => { status = `backup failed ${e?.code || e}`; console.warn('[cloudsave] backup failed', e?.code || e); });
  }
  pending.clear();
}

export function cloudClear(key) {
  pending.delete(key); copies.delete(key);
  docFor(key)?.delete().catch(() => {});
}

// the app being backgrounded or closed: write the latest save straight away
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { clearTimeout(timer); flush(); } });
window.addEventListener('pagehide', () => { clearTimeout(timer); flush(); });
