// The end: a slow scroll of credits over a starry night where the Ninth
// Tower used to stand. Tap (or wait) to return to the world, which stays open.
import Phaser from 'phaser';
import { audio } from '../audio/synth.js';

const LINES = [
  ['THE NINTH TOWER', 'fontGold', 3],
  ['', 'fontPlain'],
  ['THE TOWER HAS FALLEN.', 'font'],
  ['THE CURSE IS LIFTED FROM ALDERMERE.', 'font'],
  ['THE KING IS A KING AGAIN.', 'font'],
  ['(HE MISSES THE POND.)', 'fontPlain'],
  ['', 'fontPlain'],
  ['- THE COMPANY -', 'fontGold'],
  ['BRANN, THE GUARDIAN', 'fontPlain'],
  ['PIP, THE ARCANIST', 'fontPlain'],
  ['SABLE, THE DUELIST', 'fontPlain'],
  ['WREN, THE RANGER', 'fontPlain'],
  ['KESH, THE BERSERKER', 'fontPlain'],
  ['BROTHER OAKE, THE CLERIC', 'fontPlain'],
  ['GIZMO, THE TINKER', 'fontPlain'],
  ['MIRELLE, THE FROST WITCH', 'fontPlain'],
  ['', 'fontPlain'],
  ['- THE WARDENS WHO FELL -', 'fontGold'],
  ['THE GATEWARDEN', 'fontPlain'],
  ['MOTHER MURK', 'fontPlain'],
  ['THE PALE HUNTSMAN', 'fontPlain'],
  ['FORGEMASTER VULK', 'fontPlain'],
  ['ISOLDE THE RIMEGUARD', 'fontPlain'],
  ['AND MALGRIM THE UNKIND', 'fontPlain'],
  ['', 'fontPlain'],
  ['- WITH THANKS TO -', 'fontGold'],
  ['THE TOWNSFOLK OF BRIGHTWATER, FOR REBUILDING', 'fontPlain'],
  ['THE GOLDEN FLIES, FOR BEING DELICIOUS', 'fontPlain'],
  ['AND YOU, FOR PLAYING', 'fontPlain'],
  ['', 'fontPlain'],
  ['THE WORLD STAYS OPEN.', 'fontGold'],
  ['EVERY REGION NOW RISES TO LEVELS 26-35,', 'fontPlain'],
  ['AND HEXBORN REMNANTS ROAM THE LAND.', 'fontPlain'],
];

export class Credits extends Phaser.Scene {
  constructor() { super('Credits'); }

  create({ onDone } = {}) {
    this.onDone = onDone;
    const W = this.scale.width, H = this.scale.height;
    const g = this.add.graphics();
    g.fillStyle(0x0a0712).fillRect(-2, -2, W + 4, H + 4);
    for (let i = 0; i < 90; i++) g.fillStyle(i % 6 ? 0x6e6a87 : 0xd8d3e0).fillRect(Math.floor(Math.random() * W), Math.floor(Math.random() * H), 1, 1);
    // the hills, and a broken stump where the Tower stood
    g.fillStyle(0x1f4630);
    for (let x = 0; x < W; x++) { const h = 22 + Math.sin(x / 23) * 5 + Math.sin(x / 9) * 2; g.fillRect(x, H - h, 1, h); }
    const tx = Math.round(W * 0.78);
    g.fillStyle(0x110c18).fillRect(tx - 8, H - 44, 16, 20).fillRect(tx - 5, H - 50, 6, 6);
    this.c = this.add.container(0, H + 10);
    let y = 0;
    for (const [text, font, scale = 1] of LINES) {
      if (text) this.c.add(this.add.bitmapText(W / 2, y, font, text).setOrigin(0.5, 0).setScale(scale));
      y += text ? 12 * scale + 6 : 10;
    }
    this.endY = -y + H * 0.4;
    audio.sfx('levelUp');
    this.time.delayedCall(400, () => audio.sfx('curseLift'));
    this.input.on('pointerdown', () => this.finish());
    this.input.keyboard.on('keydown', () => this.finish());
  }

  update(time, delta) {
    if (this.c.y > this.endY) this.c.y -= delta * 0.022;
    else if (!this.doneT) this.doneT = time + 4000;
    else if (time > this.doneT) this.finish();
  }

  finish() {
    if (this.closing) return;
    this.closing = true;
    this.cameras.main.fadeOut(500, 10, 6, 20);
    this.time.delayedCall(520, () => { this.scene.stop(); this.onDone?.(); });
  }
}
