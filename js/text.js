// Pixeltext: typsnitten i pix.js renderade till cachade dukar med kontur, skugga och färgtoning per rad.
import { BIG, SMALL, textW, eachTextPixel, css, mix } from './pix.js?v=1';

const cache = new Map();
export const GRAD = {
  white: [0xffffff, 0xffffff, 0xf2f0ec, 0xe4e0dc, 0xd2ccc8, 0xc0b8b4, 0xaca4a0],
  gold: [0xfff6c0, 0xffe680, 0xffd040, 0xf8b828, 0xe89a18, 0xd07a10, 0xb05c0c],
  fire: [0xfff6d0, 0xffe070, 0xffb030, 0xff7a20, 0xe8441c, 0xc02418, 0x8a1414],
  chrome: [0xffffff, 0xd8e4f4, 0xa8bcd8, 0x6a7c9c, 0xf0e8d8, 0xd8b890, 0xa87850],
  green: [0xe0ffd0, 0xa8f080, 0x70d850, 0x48b83a, 0x34962e, 0x267424, 0x1a5418],
  red: [0xffd0c8, 0xff9080, 0xff5a48, 0xe83a30, 0xc42424, 0x9a1818, 0x701010],
  blue: [0xe0f0ff, 0xa8d0ff, 0x70a8ff, 0x4a80f0, 0x3460d0, 0x2444a8, 0x183080],
  gray: [0xc8c4d0, 0xb8b4c0, 0xa8a4b0, 0x9894a0, 0x8a8692, 0x7c7884, 0x6e6a76],
};
export function textCanvas(str, opt = {}) {
  const F = opt.big ? BIG : SMALL, sc = opt.scale || 1;
  const grad = opt.grad || (opt.color != null ? null : GRAD.white);
  const ol = opt.outline ?? 0x1a1426, sh = opt.shadow ?? true;
  const key = [str, opt.big ? 1 : 0, sc, grad ? grad[2] : opt.color, ol, sh].join('|');
  let c = cache.get(key);
  if (c) return c;
  const pad = 1 + (sh ? 1 : 0) + (F.h === 7 ? 2 : 1) * sc;
  const w = textW(F, str, sc) + pad * 2 + 1, h = (F.h + 3) * sc + pad * 2;
  c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = h;
  const ctx = c.getContext('2d');
  const oy = pad + 2 * sc;
  const pix = [];
  eachTextPixel(F, str, pad, oy, sc, (x, y, row) => pix.push([x, y, row]));
  const plot = (col, dx, dy) => { ctx.fillStyle = css(col); for (const [x, y] of pix) ctx.fillRect(x + dx, y + dy, sc, sc); };
  if (ol !== null && ol !== false) {
    if (sh) plot(ol, 1, 1 + (sc > 1 ? 1 : 0));
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) plot(ol, dx, dy);
  }
  for (const [x, y, row] of pix) {
    const r = Math.max(0, Math.min(F.h - 1, row));
    const col = grad ? grad[Math.min(grad.length - 1, Math.floor(r * grad.length / F.h))] : opt.color;
    ctx.fillStyle = css(col); ctx.fillRect(x, y, sc, sc);
  }
  c.oy = oy; c.pad = pad;
  if (cache.size > 600) cache.clear();
  cache.set(key, c);
  return c;
}
// Ritar text med versalhöjdens överkant i y. align: 'l' | 'c' | 'r'
export function drawText(ctx, str, x, y, opt = {}) {
  const c = textCanvas(String(str), opt);
  const w = c.width - c.pad * 2;
  const ax = opt.align === 'c' ? Math.round(x - w / 2) : opt.align === 'r' ? Math.round(x - w) : Math.round(x);
  ctx.drawImage(c, ax - c.pad, Math.round(y) - c.oy);
  return w;
}
export const tw = (str, opt = {}) => textW(opt.big ? BIG : SMALL, String(str), opt.scale || 1);
export function panel(ctx, x, y, w, h, fill = 'rgba(20,16,40,0.78)', border = '#f2c21c') {
  ctx.fillStyle = 'rgba(10,8,20,0.6)'; ctx.fillRect(x + 2, y + 2, w, h);
  ctx.fillStyle = fill; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = border;
  ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h);
  ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(x + 1, y + 1, w - 2, 1);
}
export { mix };
