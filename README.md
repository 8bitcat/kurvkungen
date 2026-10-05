# Kurvkungen

Isometriskt pixelracing med vapen i webbläsaren – inspirerat av *Racing Gears Advance* (GBA, 2004).
Vanilla JS + canvas, inga bibliotek, ingen byggprocess. All grafik är ritad med kod.

## Spela lokalt

```
node tools/serve.mjs        # http://localhost:8803/
```

Tangentbord: pilar/WASD kör, mellanslag skjuter, Z bakvapen, Shift nitro, T tuta, R tillbaka på banan, Esc paus, M musik.

Online: "Spela online" → skapa rum (värden kör simuleringen, PeerJS) eller gå med med rumskoden. Måste köras från en publicerad adress för att kompisar på andra datorer ska nå spelet.
Handkontroll: RT gas, LT broms, X skjut, Y bakvapen, RB/klick i spak nitro. Mobil: liggande, autogas, knappar på skärmen.

## Hur det är byggt

- **Terräng** (`js/world-gen.js`, `js/world-paint.js`, `js/world-worker.js`): höjdkarta 1 enhet/cell med sjöar, klippor,
  slänter, broar och skog som trädkronor i höjdkartan. Varje skärmpixel får en iso-stråle genom höjdkartan i en
  webbarbetare som målar rutor om 256×256 i den ordning kameran behöver dem. Regeln *vägen ska alltid synas*
  (ett "tak" som sprids diagonalt framåt) gör att ingenting skymmer vägen.
- **Bilar** (`js/carsprites.js`): små 3D-modeller av lådor och cylindrar som strålföljs till sprites i 64 vinklar,
  med samma ljus som terrängen, bläckkant och sel-out-kontur.
- **Spelet**: `car.js` (arkadfysik), `race.js` (lopp, vapen, krockar), `ai.js` (racinglinje + bromsprofil),
  `render.js`, `hud.js`, `main.js` (skärmar och loop).
- Pixelstilen följer Snabbfilens guide (ett pixelkorn, heltalsskala, ramper med varma högdagrar och blålila skuggor).

## Verktyg

| | |
|---|---|
| `node tools/play.mjs "race=sjoviken&auto=1" 12 3` | provkör med autopilot, skärmdumpar i tools/out |
| `node tools/racestats.mjs sjoviken 3 6` | helt lopp i 6× fart, varvtider och händelser |
| `node tools/ui.mjs` | går igenom menyerna |
| `node tools/mobile.mjs "race=sjoviken"` | mobilvy med pek |
| `tools/terrain.html?t=kanjonen&mode=overview` | hela banan ovanifrån |
| `tools/cars.html` | alla bilar i alla vinklar |
| `node tools/trackcheck.mjs` | banornas längd, kurvradier och avstånd |
| `node tools/mp.mjs 15` | multiplayer med två webbläsare via PeerJS |
| `node tools/djur.mjs sjoviken 5` | många djur framför bilen, skärmdumpar |
| `tools/djur.html` | alla djur i alla poser |
