// Unique-item perk checks (dev only). Reload first, then:
//   const P = await import('/tools/perk-test.js'); await P.run()
// Each check equips the unique, sets up the moment it's for, and reports
// whether the signature effect happened (true = pass).
import { go, step } from './goto.js';

async function fresh(hero, equip) {
  const sc = window.__scene;
  for (const e of sc.enemies) if (e.alive && !e.boss) { e.alive = false; e.destroy(); }
  sc.enemies = sc.enemies.filter((e) => e.alive);
  const h = sc.party.find((p) => p.def.id === hero);
  Object.assign(h.hs.equip, equip);
  h.refreshStats?.(); h.refreshGear?.();
  for (const p of sc.party) { p.downed = false; p.hp = p.maxHp; p.burn = null; p.poison = null; p.phoenixUsed = false; p.sprite.setAlpha(1); }
  await step(5);
  return { sc, h };
}

export async function run() {
  const { newState } = await import('/src/game/state.js');
  const st = newState('brann');
  st.recruited = ['brann', 'pip', 'sable', 'gizmo']; st.active = ['brann', 'pip', 'sable'];
  st.pos = { x: 24 * 16 + 8, y: 40 * 16 + 8 };
  await go(24, 40, { state: st, level: 14, clear: true });
  const out = {};
  const spawn = (sc, h, k, dx = 30, dy = 0) => sc.spawnEnemy(k, h.x + dx, h.y + dy, true);

  { // Lionheart: low HP -> DEF up and a roar that taunts
    const { sc, h } = await fresh('brann', { head: 'lionheart_helm' });
    const e = spawn(sc, h, 'goblin', 60); e.target = sc.party[1]; await step(2);
    h.hp = h.maxHp * 0.3; h.lionT = 0; await step(3);
    out.lionheart = e.taunter === h;
  }
  { // Aegis: five hits heal the party
    const { sc, h } = await fresh('brann', { body: 'aegis_of_dawn' });
    const p = sc.party[1]; p.hp = p.maxHp * 0.5; const before = p.hp;
    for (let i = 0; i < 5; i++) { h.invuln = 0; h.damage(5, null); }
    out.aegis = p.hp > before;
  }
  { // Emberbrand: bash leaves fire on the ground
    const { sc, h } = await fresh('brann', { weapon: 'emberbrand' });
    const e = spawn(sc, h, 'knight', 16); e.maxHp = e.hp = 9999; await step(2);
    h.skills[0] = { ...h.skills.find((k) => k.id === 'bash') || { id: 'bash', cd: 6 }, id: 'bash', t: 0, rank: 1 };
    h.useSkill(0, e); await step(30); const hp1 = e.hp; await step(90);
    out.emberbrand = e.hp < hp1;
  }
  { // Bulwark: blocks a shot from the front
    const { sc, h } = await fresh('brann', { offhand: 'bulwark_of_aldermere' });
    const a = spawn(sc, h, 'archer', 80); h.face(1, 0); h.action = null; await step(1);
    const hp0 = h.hp; sc.spawnEnemyArrow(a, h, 20); for (let i = 0; i < 40; i++) { h.face(1, 0); await step(1); }
    out.bulwark = h.hp === hp0;
  }
  { // Phoenix: rises once a fight
    const { sc, h } = await fresh('pip', { body: 'phoenix_robe' });
    spawn(sc, h, 'goblin', 60); await step(2); sc.enemies.forEach((e) => (e.engaged = true));
    h.invuln = 0; h.damage(h.maxHp * 5, null); await step(2);
    const rose = !h.downed && h.hp > 0;
    h.invuln = 0; h.damage(h.maxHp * 5, null); await step(2);
    out.phoenix = rose && h.downed;
    h.revive(1);
  }
  { // Sunspire: fireball splits on impact
    const { sc, h } = await fresh('pip', { weapon: 'sunspire_staff' });
    const e = spawn(sc, h, 'knight', 70); e.maxHp = e.hp = 9999; await step(2);
    let splits = 0; const orig = sc.spawnProjectile.bind(sc); sc.spawnProjectile = (o) => { if (o.split) splits++; return orig(o); };
    h.skills[0] = { id: 'fireball', cd: 5, t: 0, rank: 1 }; h.useSkill(0, e); await step(80);
    sc.spawnProjectile = orig;
    out.sunspire = splits === 3;
  }
  { // Ember Circlet: burn lasts longer
    const { sc, h } = await fresh('pip', { head: 'ember_circlet' });
    const e = spawn(sc, h, 'knight', 70); e.applyElement('fire', h);
    out.circlet = (e.status?.burn?.t || 0) > 3.5;
  }
  { // Raven Mask: a crit from behind resets Shadow Step
    const { sc, h } = await fresh('sable', { head: 'raven_mask' });
    const e = spawn(sc, h, 'knight', 20); e.maxHp = e.hp = 9999; await step(2);
    h.x = e.x + 14; h.y = e.y; e.view = 'side'; e.flip = true; // the knight faces left, Sable is behind it
    h.skills[0] = { id: 'step', cd: 10, t: 8, rank: 1 };
    sc.dealDamage(h, e, 10, { crit: true });
    out.raven = h.skills[0].t === 0;
  }
  { // Nightsilk: a dodge leaves a decoy that draws foes
    const { sc, h } = await fresh('sable', { body: 'nightsilk_coat' });
    const e = spawn(sc, h, 'goblin', 40); e.engaged = true; e.target = h; await step(1);
    h.dodgeCd = 0; h.dodge(-1, 0); await step(2);
    const dec = (sc.gadgets || []).find((g) => g.kind === 'decoy');
    out.nightsilk = !!dec && e.taunter === dec;
    await step(240);
    out.nightsilkGone = !(sc.gadgets || []).some((g) => g.kind === 'decoy');
  }
  { // Wyrmfang: poison stacks to 7; with the twin it spreads on death
    const { sc, h } = await fresh('sable', { weapon: 'wyrmfang', offhand: 'wyrmfang_twin' });
    const a = spawn(sc, h, 'knight', 40), b = spawn(sc, h, 'knight', 52);
    for (let i = 0; i < 9; i++) a.applyElement('venom', h);
    out.wyrmfang = a.status.poison.n === 7;
    a.hp = 1; sc.dealDamage(h, a, 50, {}); await step(2);
    out.twinfang = (b.status?.poison?.n || 0) >= 3;
  }
  { // Hero burn: ember shots burn; Flameproof Overalls don't
    const { sc, h } = await fresh('brann', { offhand: null, body: null }); // no Bulwark to block the shot
    const imp = spawn(sc, h, 'imp', 0, 34); imp.stunT = 9;
    sc.spawnEnemyArrow(imp, h, 10, 'ember'); await step(50);
    out.burn = !!h.burn;
    const was = h.hs.equip.body; h.hs.equip.body = 'flameproof_overalls'; h.burn = null; h.addBurn(10, 3);
    out.flameproof = !h.burn; h.hs.equip.body = was;
  }
  out.errs = (window.__errs || []).slice(0, 3);
  return out;
}
