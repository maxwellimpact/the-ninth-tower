// Jump around the world for checks (dev only):
//   const G = await import('/tools/goto.js'); await G.go(52, 191, { clear: true })
// Boots a fresh game first if none is running (level 8 party unless told
// otherwise), warps the party to the tile, closes any dialogue and optionally
// clears the enemies nearby.
export const step = async (n = 1) => { const g = window.__game; let t = g.loop.now || performance.now(); for (let i = 0; i < n; i++) { t += 16; g.step(t, 16); await new Promise((r) => setTimeout(r, 0)); } };

export function closeDialog() {
  const ui = window.__scene?.ui;
  if (ui?.dialogOpen) { ui.clearChoices(); ui.dialogOpen = false; ui.dlgCatch?.disableInteractive(); ui.dlg.setVisible(false); ui.onDone = null; }
  if (ui) ui.pendingDialog = null;
}

export async function go(x, y, { clear = false, level = 8, relics = ['grapple'], state = null } = {}) {
  if (!window.__scene) { const W = await import('/tools/dungeon-walk.js'); await W.boot({ level, relics, state }); }
  const sc = window.__scene;
  sc.warp({ to: { x, y } });
  for (let i = 0; i < 100 && (sc.busy || window.__game.scene.isActive('Loading')); i++) await step(10);
  await step(30);
  closeDialog();
  if (clear) { for (const e of sc.enemies) if (e.alive && !e.boss) { e.alive = false; e.destroy(); } sc.enemies = sc.enemies.filter((e) => e.alive); }
  await step(20);
  return sc;
}
