// Cloud copy of the save. Inside the Claude app the page's localStorage can be
// wiped between visits, so the save is mirrored to the artifact's db, in the
// viewer's own private subtree (data/users/<id>/save). localStorage stays the
// working copy; this only restores it at boot and backs it up after saves.
// Anywhere without the artifact runtime (dev server, a saved copy) it's a no-op.
const DOC = 'save';
let ref = null; // the viewer's save document, once the runtime answers
let pending = null, timer = null;
let copy = null; // the newest save JSON we know of, for when localStorage refuses it entirely
export const cloudCopy = () => copy;

const withTimeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), ms))]);

async function connect() {
  const use = window.claude?.use;
  if (!use) return null;
  const [db, user] = await Promise.all([use('db'), use('user')]);
  if (!db || !user) return null;
  const id = await user.id();
  if (!id) return null; // signed out: no private subtree, stay local-only
  return db.doc(`data/users/${id}/${DOC}`);
}

// At boot: pull the cloud save into localStorage when it's newer than the
// local one (or the local one is gone). Never waits more than a few seconds.
export function cloudRestore(key) {
  let late = false; // gave up waiting: the title screen has already read the save
  setTimeout(() => { late = true; }, 4000);
  return withTimeout((async () => {
    try {
      ref = await connect();
      if (!ref) return;
      if (pending) { clearTimeout(timer); timer = setTimeout(flush, 1500); } // saves made while connecting
      if (late) return; // too late to restore, but backups still go through
      const snap = await ref.get();
      if (late) return;
      const cloud = snap.exists ? snap.data() : null;
      let local = null;
      try { local = JSON.parse(localStorage.getItem(key) || 'null'); } catch { /* unreadable -> treat as missing */ }
      if (cloud?.json && (!local || (cloud.savedAt || '') > (local.savedAt || ''))) {
        copy = cloud.json;
        try { localStorage.setItem(key, cloud.json); } catch { /* storage blocked: loadState falls back to the copy */ }
      } else if (local && (!cloud || (local.savedAt || '') > (cloud.savedAt || ''))) {
        cloudBackup(JSON.stringify(local), local.savedAt); // local is ahead (saved while offline)
      }
    } catch (e) { console.warn('[cloudsave] restore failed', e); }
  })(), 4000);
}

// After each save: back up the latest one, batched so a burst of autosaves
// (chest, warp, menu...) becomes a single write.
export function cloudBackup(json, savedAt) {
  copy = json;
  pending = { json, savedAt }; // held until the runtime answers, if it hasn't yet
  if (!ref) return;
  clearTimeout(timer);
  timer = setTimeout(flush, 1500);
}

function flush() {
  if (!ref || !pending) return;
  const body = pending; pending = null;
  ref.set(body).catch((e) => console.warn('[cloudsave] backup failed', e?.code || e));
}

export function cloudClear() {
  pending = null; copy = null; clearTimeout(timer);
  ref?.delete().catch(() => {});
}

// the app being backgrounded or closed: write the latest save straight away
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { clearTimeout(timer); flush(); } });
window.addEventListener('pagehide', () => { clearTimeout(timer); flush(); });
