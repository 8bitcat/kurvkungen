// Sparad profil i localStorage (pengar, garage, mästerskap, rekord, inställningar).
const KEY = 'kurvkungen.save.v1';
export const DEFAULT = () => ({
  money: 1500,
  car: 'pirat',
  garage: { pirat: { upg: { motor: 0, dack: 0, pansar: 0, nitro: 0 }, color: 0xd8282c } },
  weapons: { front: 'kulspruta', rear: 'minor', owned: { kulspruta: 0, minor: 0 } },
  cups: {}, // cupId → { done: true, best: place }
  records: {}, // trackId → bästa varvtid
  settings: { music: true, sfx: true, autoGas: null },
  champ: null, // pågående mästerskap
});
export let save = load();
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.garage) return { ...DEFAULT(), ...s, settings: { ...DEFAULT().settings, ...(s.settings || {}) } };
  } catch { /* tom eller trasig */ }
  return DEFAULT();
}
export function persist() { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* privat läge */ } }
export function resetSave() { save = DEFAULT(); persist(); return save; }
