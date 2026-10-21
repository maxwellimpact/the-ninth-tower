// The guide never runs Phaser: the one shared module that imports it
// (gfx/font.js) only needs it to register the font with a live game. This
// stand-in keeps the 1 MB engine out of the page.
const Phaser = { GameObjects: { RetroFont: { Parse: () => ({}) }, BitmapText: { prototype: {} } } };
export default Phaser;
