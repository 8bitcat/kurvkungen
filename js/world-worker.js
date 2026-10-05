// Terrängarbetaren: genererar världen och målar rutor i den ordning huvudtråden ber om.
import { generateWorld } from './world-gen.js?v=1';
import { paintTile } from './world-paint.js?v=1';
import { TRACKS } from './tracks.js?v=1';

let Wd = null, gen = 0, queue = [], timer = 0;
self.onmessage = (e) => {
  const m = e.data;
  if (m.type === 'gen') {
    gen = m.gen; queue = [];
    Wd = generateWorld(TRACKS[m.id]);
    const Hm = Wd.Hm.slice(), mat = Wd.mat.slice();
    self.postMessage({
      type: 'gen', gen, W: Wd.W, H: Wd.H, Hm, mat, flags: Wd.T.flags.slice(), objects: Wd.objects,
      ZTOP: Wd.ZTOP, ZBOT: Wd.ZBOT, OX: Wd.OX, OY: Wd.OY, CW: Wd.CW, CH: Wd.CH,
    }, [Hm.buffer, mat.buffer]);
  } else if (m.type === 'queue') {
    if (m.gen !== gen) return;
    queue = m.list; kick();
  }
};
function kick() { if (!timer) timer = setTimeout(step, 0); }
function step() {
  timer = 0;
  if (!Wd || !queue.length) return;
  const [tx, ty] = queue.shift();
  const px = paintTile(Wd, tx, ty);
  self.postMessage({ type: 'tile', gen, tx, ty, px }, [px.buffer]);
  kick();
}
