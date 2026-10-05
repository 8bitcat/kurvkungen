// Tangentbord, handkontroll och pekskärm → körkommandon + menyhändelser.
const keys = new Set();
const actions = [];
const MAP_ACT = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  Enter: 'ok', Space: 'ok', NumpadEnter: 'ok', Escape: 'back', Backspace: 'back', KeyP: 'pause', KeyM: 'music', KeyR: 'reset', KeyT: 'horn', KeyH: 'horn',
};
export const input = { touch: false, autoGas: false, pointer: null, lastDevice: 'kb' };

addEventListener('keydown', (e) => {
  if (e.repeat) { if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault(); return; }
  keys.add(e.code); input.lastDevice = 'kb';
  const a = MAP_ACT[e.code];
  if (a) actions.push(a);
  if (/^Key[A-Z]$/.test(e.code)) actions.push({ ch: e.code.slice(3) });
  if (e.code === 'Escape') actions.push('pause');
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

// ---------- pek ----------
export const touchButtons = []; // {id, x, y, r} i spelpixlar, sätts av main
const touches = new Map();
let toLogical = (x, y) => [x, y];
export function setPointerMap(fn) { toLogical = fn; }
function hitButton(x, y) {
  let best = null, bd = 1e9;
  for (const b of touchButtons) { const d = Math.hypot(x - b.x, y - b.y); if (d < b.r + 6 && d < bd) { bd = d; best = b.id; } }
  return best;
}
function onTouch(e) {
  input.touch = true; input.lastDevice = 'touch';
  for (const t of e.changedTouches) {
    const [x, y] = toLogical(t.clientX, t.clientY);
    if (e.type === 'touchstart') {
      const b = hitButton(x, y);
      touches.set(t.identifier, { b, x, y, x0: x, y0: y });
      if (!b) actions.push({ tap: [x, y] });
      if (b === 'pause') actions.push('pause');
    } else if (e.type === 'touchmove') {
      const o = touches.get(t.identifier);
      if (o) { o.x = x; o.y = y; const b = hitButton(x, y); if (b && b !== 'pause' && o.b !== 'pause') o.b = b; }
    } else touches.delete(t.identifier);
  }
  e.preventDefault();
}
for (const ev of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) addEventListener(ev, onTouch, { passive: false });
addEventListener('mousedown', (e) => { if (input.touch) return; const [x, y] = toLogical(e.clientX, e.clientY); actions.push({ tap: [x, y] }); input.lastDevice = 'mouse'; });
addEventListener('mousemove', (e) => { if (input.touch) return; input.pointer = toLogical(e.clientX, e.clientY); });
addEventListener('wheel', (e) => actions.push(e.deltaY > 0 ? 'down' : 'up'), { passive: true });

// ---------- handkontroll ----------
let padPrev = [];
function pollPad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const p = pads && [...pads].find((g) => g && g.connected);
  if (!p) return null;
  const b = (i) => !!(p.buttons[i] && p.buttons[i].pressed);
  const v = (i) => (p.buttons[i] ? p.buttons[i].value : 0);
  const now = p.buttons.map((x) => x.pressed);
  const edge = (i) => now[i] && !padPrev[i];
  if (edge(12)) actions.push('up'); if (edge(13)) actions.push('down'); if (edge(14)) actions.push('left'); if (edge(15)) actions.push('right');
  if (edge(0)) actions.push('ok'); if (edge(1)) actions.push('back'); if (edge(9)) actions.push('pause');
  const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
  if (Math.abs(ay) > 0.6 && !(padPrev.ay > 0.6 && Math.sign(ay) === Math.sign(padPrev.ayv))) actions.push(ay < 0 ? 'up' : 'down');
  padPrev = now; padPrev.ay = Math.abs(ay); padPrev.ayv = ay;
  if (now.some(Boolean) || Math.abs(ax) > 0.3) input.lastDevice = 'pad';
  return {
    steer: Math.abs(ax) > 0.12 ? ax : (b(14) ? -1 : b(15) ? 1 : 0),
    gas: Math.max(v(7), b(0) ? 1 : 0), brake: Math.max(v(6), b(1) ? 1 : 0),
    fire: b(2) || b(5), rear: b(3) || b(4), nitro: b(10) || b(11) || (v(7) > 0.5 && b(5) && false),
  };
}

export function pollActions() { pollPadOnce(); return actions.splice(0); }
let padState = null, padT = -1;
function pollPadOnce() { const t = performance.now(); if (t - padT > 8) { padState = pollPad(); padT = t; } }

// Körkommandon för spelarens bil
export function driveInput(inp) {
  pollPadOnce();
  const k = (c) => keys.has(c);
  let steer = (k('ArrowLeft') || k('KeyA') ? -1 : 0) + (k('ArrowRight') || k('KeyD') ? 1 : 0);
  let gas = k('ArrowUp') || k('KeyW') ? 1 : 0, brake = k('ArrowDown') || k('KeyS') ? 1 : 0;
  let fire = k('Space') || k('KeyX') || k('KeyJ'), rear = k('KeyZ') || k('KeyK') || k('KeyE'), nitro = k('ShiftLeft') || k('ShiftRight') || k('KeyC') || k('KeyL');
  if (padState) {
    if (padState.steer) steer = padState.steer;
    gas = Math.max(gas, padState.gas); brake = Math.max(brake, padState.brake);
    fire ||= padState.fire; rear ||= padState.rear; nitro ||= padState.nitro;
  }
  if (input.touch) {
    let tl = false, tr = false, tb = false;
    for (const t of touches.values()) {
      if (t.b === 'left') tl = true; else if (t.b === 'right') tr = true; else if (t.b === 'brake') tb = true;
      else if (t.b === 'fire') fire = true; else if (t.b === 'rear') rear = true; else if (t.b === 'nitro') nitro = true; else if (t.b === 'gas') gas = 1;
    }
    steer = steer || (tl ? -1 : 0) + (tr ? 1 : 0);
    if (tb) brake = 1;
    if (input.autoGas && !tb) gas = 1;
  }
  inp.steer = Math.max(-1, Math.min(1, steer)); inp.gas = gas; inp.brake = brake;
  inp.fire = fire; inp.rear = rear; inp.nitro = nitro;
}
export function heldTouches() { return touches; }
