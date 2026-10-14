// Animation poses for the puppet renderer (hand positions, weapon angles,
// motion smears) per view. Shared by heroes, gear compositions and enemies.

const PI = Math.PI;

// ------------------------------------------------------------ attack poses

export const swordAttack = (v) => ({
  down: [
    { handR: { x: 16, y: 21 }, angR: -2.3 },
    { handR: { x: 23, y: 31 }, angR: 1.2, smear: { cx: 24, cy: 28, a0: PI * 0.95, a1: 0.55, r0: 7, r1: 13 } },
    { handR: { x: 27, y: 30 }, angR: 0.5, bob: 1 },
  ],
  up: [
    { handR: { x: 31, y: 24 }, angR: -0.2 },
    { handR: { x: 24, y: 18 }, angR: -1.9, smear: { cx: 24, cy: 22, a0: -0.15, a1: -2.9, r0: 8, r1: 14 } },
    { handR: { x: 19, y: 24 }, angR: -2.9, bob: 1 },
  ],
  side: [
    { handR: { x: 19, y: 21 }, angR: -2.4 },
    { handR: { x: 29, y: 27 }, angR: 0.3, smear: { cx: 24, cy: 25, a0: -1.7, a1: 1.1, r0: 8, r1: 14 } },
    { handR: { x: 28, y: 30 }, angR: 1.2, bob: 1 },
  ],
})[v];

export const daggerAttack = (v) => ({
  down: [
    { handR: { x: 18, y: 24 }, angR: 1.3, crouch: 1 },
    { handR: { x: 22, y: 33 }, angR: 1.57, smear: { cx: 22, cy: 28, a0: 2.6, a1: 1.3, r0: 5, r1: 9 } },
    { handR: { x: 19, y: 27 }, angR: 1.6, handL: { x: 26, y: 33 }, angL: 1.5, smear: { cx: 26, cy: 28, a0: 0.4, a1: 1.7, r0: 5, r1: 9 } },
  ],
  up: [
    { handR: { x: 29, y: 26 }, angR: -1.2, crouch: 1 },
    { handR: { x: 26, y: 17 }, angR: -1.57, smear: { cx: 26, cy: 22, a0: -0.5, a1: -1.8, r0: 5, r1: 9 } },
    { handR: { x: 28, y: 25 }, angR: -1.4, handL: { x: 21, y: 17 }, angL: -1.6, smear: { cx: 21, cy: 22, a0: -2.6, a1: -1.4, r0: 5, r1: 9 } },
  ],
  side: [
    { handR: { x: 20, y: 26 }, angR: 0.2, crouch: 1 },
    { handR: { x: 31, y: 27 }, angR: 0.05, smear: { cx: 25, cy: 27, a0: -0.7, a1: 0.4, r0: 6, r1: 10 } },
    { handR: { x: 26, y: 28 }, angR: 0.4, handL: { x: 31, y: 25 }, angL: -0.1, smear: { cx: 25, cy: 26, a0: 0.6, a1: -0.4, r0: 6, r1: 10 } },
  ],
})[v];

export const staffAttack = (v) => ({
  down: [
    { handR: { x: 19, y: 25 }, angR: -1.57, glow: 1 },
    { handR: { x: 21, y: 27 }, angR: -1.95, glow: 2, bob: 1 },
    { handR: { x: 19, y: 27 }, angR: -1.5, glow: 0 },
  ],
  up: [
    { handR: { x: 28, y: 26 }, angR: -1.57, glow: 1 },
    { handR: { x: 27, y: 20 }, angR: -1.5, glow: 2 },
    { handR: { x: 28, y: 27 }, angR: -1.6, glow: 0 },
  ],
  side: [
    { handR: { x: 21, y: 25 }, angR: -1.9, glow: 1 },
    { handR: { x: 28, y: 25 }, angR: -0.1, glow: 2 },
    { handR: { x: 24, y: 27 }, angR: -1.4, glow: 0 },
  ],
})[v];

export const spearAttack = (v) => ({
  down: [
    { handR: { x: 19, y: 24 }, angR: 1.57, crouch: 1 },
    { handR: { x: 21, y: 32 }, angR: 1.57 },
    { handR: { x: 20, y: 28 }, angR: 1.57 },
  ],
  up: [
    { handR: { x: 28, y: 30 }, angR: -1.57, crouch: 1 },
    { handR: { x: 27, y: 21 }, angR: -1.57 },
    { handR: { x: 28, y: 26 }, angR: -1.57 },
  ],
  side: [
    { handR: { x: 19, y: 27 }, angR: 0, crouch: 1 },
    { handR: { x: 30, y: 27 }, angR: 0 },
    { handR: { x: 25, y: 28 }, angR: 0 },
  ],
})[v];

// Generic cast: both hands raised, magic glow at the peak.
export const castRaise = (v, extra = {}) => {
  const L = v === 'up' ? 1 : 0;
  const r = (x, y) => ({ x: L ? 48 - x : x, y });
  return [
    { handR: r(18, 23), handL: r(29, 23), glow: 1, ...extra },
    { handR: r(17, 19), handL: r(30, 19), glow: 2, bob: -1, ...extra },
    { handR: r(18, 21), handL: r(29, 21), glow: 1, ...extra },
  ];
};


export const bowAttack = (v) => ({
  down: [
    { handR: { x: 22, y: 31 }, angR: 1.57, handL: { x: 24, y: 27 } },
    { handR: { x: 22, y: 32 }, angR: 1.57 },
    { handR: { x: 20, y: 29 }, angR: 1.3 },
  ],
  up: [
    { handR: { x: 26, y: 20 }, angR: -1.57, handL: { x: 25, y: 24 } },
    { handR: { x: 26, y: 19 }, angR: -1.57 },
    { handR: { x: 28, y: 24 }, angR: -1.3 },
  ],
  side: [
    { handR: { x: 29, y: 27 }, angR: 0, handL: { x: 25, y: 27 } },
    { handR: { x: 30, y: 27 }, angR: 0 },
    { handR: { x: 27, y: 28 }, angR: 0.4 },
  ],
})[v];
