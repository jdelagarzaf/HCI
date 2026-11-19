// Hero 3D di Relook: stanza + armadio guidati dallo scroll, capi interattivi.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
RectAreaLightUniformsLib.init();

const $ = s => document.querySelector(s);
const hero = $('#top'), pin = $('.hero-pin'), stage = $('#stage'), tip = $('#tip'), tagsEl = $('#tags'), wornEl = $('#worn'), choice = $('#choice'), choiceT = $('#choiceT');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const S = .14;                                  // scala del manichino/capi (unità OBJ -> metri)
const LOW = matchMedia('(max-width: 767px)').matches;

// ---------- renderer / scena ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, LOW ? 1.5 : 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
stage.appendChild(renderer.domElement);
renderer.domElement.style.cssText += ';opacity:0;transition:opacity .45s ease-out';   // dissolvenza gestita qui: se il browser tiene in cache un index.html diverso, la scena non resta mai nascosta
const aniso = renderer.capabilities.getMaxAnisotropy();
const scene = new THREE.Scene();
const BG = 0x4E1228;
scene.background = new THREE.Color(BG);
scene.fog = new THREE.FogExp2(BG, .01);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), .04).texture;
scene.environmentIntensity = .4;
const camera = new THREE.PerspectiveCamera(34, 1.8, .05, 40);

// ---------- texture procedurali ----------
const cv = (w, h, fn) => { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); return c; };
const tex = (c, rep = [1, 1], srgb = true) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); t.anisotropy = aniso; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
const woodC = (base, dark) => cv(512, 512, (x, w, h) => {
  x.fillStyle = base; x.fillRect(0, 0, w, h); x.strokeStyle = dark;
  for (let i = 0; i < 300; i++) { const px = Math.random() * w; x.globalAlpha = .04 + Math.random() * .14; x.lineWidth = .5 + Math.random() * 2.4; x.beginPath(); x.moveTo(px, 0); for (let y = 0; y <= h; y += 32) x.lineTo(px + Math.sin(y * .02 + i) * 7, y); x.stroke(); }
  x.globalAlpha = 1;
});
const planksC = () => cv(1024, 1024, (x, w, h) => {
  const cols = 8, cw = w / cols;
  for (let c = 0; c < cols; c++) { let y = -Math.random() * 300; while (y < h) {
    const len = 520 + Math.random() * 500; x.fillStyle = `hsl(${36 + Math.random() * 4} 30% ${74 + Math.random() * 6}%)`; x.fillRect(c * cw, y, cw, len);
    x.globalAlpha = .14; x.strokeStyle = '#8a7358';
    for (let i = 0; i < 14; i++) { const gx = c * cw + Math.random() * cw; x.lineWidth = .6 + Math.random() * 1.6; x.beginPath(); x.moveTo(gx, y); x.bezierCurveTo(gx + 6, y + len * .3, gx - 6, y + len * .6, gx + 3, y + len); x.stroke(); }
    x.globalAlpha = .45; x.fillStyle = '#6f5f4a'; x.fillRect(c * cw, y, cw, 2.5); x.fillRect(c * cw, y, 2.5, len); x.globalAlpha = 1; y += len; } }
});
const plasterC = (base, amp = 1) => cv(256, 256, (x, w, h) => {
  x.fillStyle = base; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 120; i++) { const px = Math.random() * w, py = Math.random() * h, r = 30 + Math.random() * 90, g = x.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, Math.random() < .5 ? `rgba(255,255,255,${.025 * amp})` : `rgba(0,0,0,${.035 * amp})`); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2); }
  const im = x.getImageData(0, 0, w, h); for (let i = 0; i < im.data.length; i += 4) { const n = (Math.random() - .5) * 7 * amp; im.data[i] += n; im.data[i + 1] += n; im.data[i + 2] += n; } x.putImageData(im, 0, 0);
});
const goboC = () => cv(512, 512, (x, w, h) => {
  x.fillStyle = '#000'; x.fillRect(0, 0, w, h); x.filter = 'blur(3px)'; x.fillStyle = '#FFF4E2';
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) x.fillRect(40 + i * 150, 40 + j * 150, 126, 126);
});

// ---------- tessuti (maglia / twill / tela / costine) ----------
const hexRGB = c => { const k = new THREE.Color(c); return [k.r, k.g, k.b].map(v => Math.pow(v, 1 / 2.2) * 255); };
const fabricCache = {};
const fabric = (kind, base, { alt, bands = 0, circ = 11, h = 4, cell = 1.6, strength = .9 } = {}) => {
  const key = [kind, base, alt, bands, circ, h, cell].join('|'); if (fabricCache[key]) return fabricCache[key];
  const N = LOW ? 128 : 256, H = new Float32Array(N * N), cc = document.createElement('canvas'), nc = document.createElement('canvas'); cc.width = cc.height = nc.width = nc.height = N;
  const cx = cc.getContext('2d'), nx = nc.getContext('2d'), ci = cx.createImageData(N, N), ni = nx.createImageData(N, N);
  const B = hexRGB(base), A = alt ? hexRGB(alt) : B, T = Math.PI * 2, f = kind === 'knit' ? 28 : 26;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = y / N, n = Math.random() - .5; let hh;
    if (kind === 'knit') { const fx = (u * f) % 1, fy = (v * f) % 1, d = Math.abs(fx - .5) * 2; hh = Math.max(0, 1 - Math.abs(fy - (.12 + .62 * d)) / .3); hh = hh * hh * (3 - 2 * hh); }
    else if (kind === 'twill') hh = .5 + .5 * Math.sin(T * f * (u + v)) * (.7 + .3 * Math.sin(T * f * 4 * u));
    else if (kind === 'weave') { const a1 = (Math.floor(u * f) + Math.floor(v * f)) % 2; hh = .35 + .65 * (a1 ? Math.abs(Math.sin(T * f * u * .5 + .5)) : Math.abs(Math.sin(T * f * v * .5 + .5))); }
    else if (kind === 'satin') hh = .5 + .5 * Math.sin(T * 6 * v + Math.sin(T * 3 * u) * .6);
    else hh = .5 + .5 * Math.sin(T * f * 1.5 * u);
    hh = clamp(hh * .7 + .15 + n * .3); H[y * N + x] = hh;
    const band = bands ? (Math.floor(v * bands * 2) % 2 ? 1 : 0) : 0, c = band ? A : B, sh = .93 + .07 * hh, i = (y * N + x) * 4;
    ci.data[i] = c[0] * sh; ci.data[i + 1] = c[1] * sh; ci.data[i + 2] = c[2] * sh; ci.data[i + 3] = 255;
  }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const g = (xx, yy) => H[((yy + N) % N) * N + ((xx + N) % N)], i = (y * N + x) * 4;
    const dx = (g(x - 1, y) - g(x + 1, y)) * strength, dy = (g(x, y - 1) - g(x, y + 1)) * strength, l = Math.hypot(dx, dy, 1);
    ni.data[i] = (dx / l * .5 + .5) * 255; ni.data[i + 1] = (dy / l * .5 + .5) * 255; ni.data[i + 2] = (1 / l * .5 + .5) * 255; ni.data[i + 3] = 255;
  }
  cx.putImageData(ci, 0, 0); nx.putImageData(ni, 0, 0);
  const rep = [Math.max(1, Math.round(circ / cell)), Math.max(1, Math.round(h / cell))];
  return fabricCache[key] = new THREE.MeshPhysicalMaterial({ map: tex(cc, rep, true), normalMap: tex(nc, rep, false), normalScale: new THREE.Vector2(.3, .3), roughness: kind === 'satin' ? .5 : .9, metalness: 0, sheen: kind === 'satin' ? .3 : .6, sheenRoughness: .7, sheenColor: new THREE.Color(base).lerp(new THREE.Color('#FFF1DE'), .25), side: THREE.DoubleSide, envMapIntensity: .45 });
};

// ---------- materiali ambiente ----------
const wallBump = tex(plasterC('#808080', 1.2), [16, 3], false);
const paint = (c, rep) => new THREE.MeshStandardMaterial({ map: tex(plasterC(c), rep), bumpMap: wallBump, bumpScale: .06, roughness: .95, envMapIntensity: .3 });
const wallMat = paint('#6B1937', [16, 3]), creamWall = paint('#F8F1E7', [16, 3]);
const floorTex = tex(planksC(), [11, 5.6]);
const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, bumpMap: floorTex, bumpScale: .2, roughness: .92, envMapIntensity: .15 });
const peel = tex(cv(128, 128, x => { const im = x.createImageData(128, 128); for (let i = 0; i < im.data.length; i += 4) { const n = 128 + (Math.random() - .5) * 90; im.data[i] = im.data[i + 1] = im.data[i + 2] = n; im.data[i + 3] = 255; } x.putImageData(im, 0, 0); }), [10, 10], false);
const paintMatte = (c, r = .7) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 0, envMapIntensity: .5 });   // vernice opaca liscia: il rumore in rilievo sfarfallava sulle superfici grandi (frontali dei cassetti e ante)
const eden = paintMatte(0x6B1937), edenPanel = paintMatte(0x450D1D, .74);          // armadio Currant, pannelli Plum
const walnutGloss = paintMatte(0x450D1D, .78);                                      // base del manichino (ora opaca)
const oakT = tex(woodC('#EFE4D4', '#DDCFBB')), lacquer = new THREE.MeshStandardMaterial({ map: oakT, bumpMap: oakT, bumpScale: .08, roughness: .82, envMapIntensity: .4 });
const brass = new THREE.MeshStandardMaterial({ color: 0xC9A66B, metalness: 1, roughness: .45, envMapIntensity: .8 });
const dark = new THREE.MeshStandardMaterial({ color: 0x450D1D, roughness: .75 });
const white = new THREE.MeshStandardMaterial({ color: 0xF0E6D8, roughness: .85 });

const box = (w, h, d, m, x, y, z, parent = scene) => { const o = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, LOW ? 1 : 2, Math.min(.007, w / 2.2, h / 2.2, d / 2.2)), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; parent.add(o); return o; };
const cyl = (r, h, m, x, y, z, parent = scene, seg = 24) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m); o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o; };

// stanza
const floor = new THREE.Mesh(new THREE.PlaneGeometry(18, 9), floorMat); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, .5); floor.receiveShadow = true; scene.add(floor);
const back = new THREE.Mesh(new THREE.PlaneGeometry(18, 3.2), wallMat); back.position.set(.3, 1.6, -2); back.receiveShadow = true; scene.add(back);
const left = new THREE.Mesh(new THREE.PlaneGeometry(7, 3.2), creamWall); left.rotation.y = Math.PI / 2; left.position.set(-3.2, 1.6, .5); left.receiveShadow = true; scene.add(left);
box(18, .12, .03, white, .3, .06, -1.985); box(.03, .12, 7, white, -3.185, .06, .5);        // battiscopa
box(18, .06, .05, white, .3, 3.15, -1.975);                                                 // cornice
// finestra: il vetro è la sorgente della luce e proietta i riquadri sul pavimento
const gobo = new THREE.CanvasTexture(goboC()); gobo.colorSpace = THREE.SRGBColorSpace;
const win = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.7), new THREE.MeshBasicMaterial({ map: gobo, color: 0xd8c8ae, fog: false })); win.rotation.y = Math.PI / 2; win.position.set(-3.19, 1.75, .1); scene.add(win);
[-.88, .88].forEach(o => { box(.05, .05, 1.8, white, -3.17, 1.75 + o, .1); box(.05, 1.8, .05, white, -3.17, 1.75, .1 + o); });
const rug = new THREE.Mesh(new THREE.CircleGeometry(.95, LOW ? 40 : 64), new THREE.MeshStandardMaterial({ color: 0xF0E6D8, roughness: 1, envMapIntensity: .3 }));
rug.rotation.x = -Math.PI / 2; rug.position.set(.75, .006, -.1); rug.receiveShadow = true; scene.add(rug);

// ---------- armadio ----------
const W = 1.9, H = 2.3, D = .8, t = .03, WG = new THREE.Group(); WG.position.set(1.9, 0, -1.6); scene.add(WG);
box(W - .04, .1, D - .04, dark, 0, .05, 0, WG);
box(W, H, t, lacquer, 0, H / 2, -D / 2 + t / 2, WG);
box(t, H, D, eden, -W / 2 + t / 2, H / 2, 0, WG); box(t, H, D, eden, W / 2 - t / 2, H / 2, 0, WG);
box(W, t, D, eden, 0, H - t / 2, 0, WG); box(W - 2 * t, t, D - .02, lacquer, 0, .12, 0, WG); box(W - 2 * t, t, D - .02, lacquer, 0, .62, 0, WG);
box(t, H - .64, D - .04, lacquer, .1, .63 + (H - .64) / 2, 0, WG);
[0, 1].forEach(i => { const y = .24 + i * .25; box(W - .12, .225, .034, eden, 0, y, D / 2 - .02, WG); box(W - .24, .13, .008, edenPanel, 0, y, D / 2 + .002, WG); cyl(.008, .34, brass, 0, y, D / 2 + .05, WG).rotation.z = Math.PI / 2; [-.15, .15].forEach(px => cyl(.005, .035, brass, px, y, D / 2 + .035, WG).rotation.x = Math.PI / 2); });
[1.0, 1.4, 1.8].forEach(y => box(.8, t, D - .04, lacquer, .1 + .45, y, 0, WG));
const detailM = (c, r = .8, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, envMapIntensity: m ? .8 : .4 });   // un materiale per dettaglio: l'evidenziazione al passaggio non si propaga
const darker = (c, k = .72) => new THREE.Color(c).multiplyScalar(k);
// pile di capi piegati sugli scaffali: ogni capo è un rettangolo morbido con il bordo piegato sul davanti,
// leggermente sfalsato e ruotato rispetto a quello sotto, come una pila vera
const foldTee = (c, kind, w, x, y, z, ry) => {
  const g = new THREE.Group(), m = fabric(kind, c, { circ: 1, h: .3, cell: .3 }), h = .046;
  const body = new THREE.Mesh(new RoundedBoxGeometry(w, h, .27, 3, .018), m); body.position.z = -.012; g.add(body);
  const fold = new THREE.Mesh(new THREE.CylinderGeometry(h / 2, h / 2, w - .012, 16), m); fold.rotation.z = Math.PI / 2; fold.position.z = .122; g.add(fold);   // piega arrotondata sul davanti
  const crease = new THREE.Mesh(new THREE.BoxGeometry(.004, .002, .2), detailM(darker(c, .8))); crease.position.set(-w * .18, h / 2 + .001, -.02); g.add(crease);   // segno della piega della manica
  g.children.forEach(o => { o.castShadow = o.receiveShadow = true; });
  g.position.set(x, y, z); g.rotation.y = ry; WG.add(g);
};
[[1.0, '#123463'], [1.4, '#19615C'], [1.8, '#D08C7C']].forEach(([y, c], i) => { const n = 3 + (i % 2); for (let k = 0; k < n; k++) foldTee(k % 2 ? '#F2E9DC' : c, k % 2 ? 'weave' : 'knit', .3 - (k % 3) * .012, .55 + Math.sin(k * 2.3 + i) * .012, y + t / 2 + .024 + k * .047, Math.cos(k * 1.7 + i) * .01, Math.sin(k * 3.1 + i) * .05); });
// scarpe: un paio di mocassini Currant nell'armadio
const shoe = (sole, upper, x, y, z, ry, parent = scene) => {
  const g = new THREE.Group();
  const s1 = new THREE.Mesh(new RoundedBoxGeometry(.095, .022, .27, 2, .009), sole); s1.position.y = .011; g.add(s1);
  const up = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), upper); up.scale.set(.046, .062, .128); up.position.set(0, .02, .005); g.add(up);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(1, 20), detailM(0x2A0C16)); hole.rotation.x = -Math.PI / 2 + .12; hole.scale.set(.03, .052, 1); hole.position.set(0, .079, -.045); g.add(hole);   // apertura
  g.children.forEach(o => { o.castShadow = true; o.receiveShadow = true; });
  g.position.set(x, y, z); g.rotation.y = ry; parent.add(g); return g;
};
const loaferUp = new THREE.MeshStandardMaterial({ color: 0x6B1937, roughness: .55, bumpMap: peel, bumpScale: .01, envMapIntensity: .6 }), loaferSole = detailM(0x3A1A1C, .7);
shoe(loaferSole, loaferUp, .47, .62 + t / 2, .02, .08, WG); shoe(loaferSole, loaferUp, .63, .62 + t / 2, -.02, -.06, WG);
// barra appendiabiti + led
const RAIL_Y = 1.98; cyl(.012, 1.0, brass, WG.position.x * 0 - .45, RAIL_Y, 0, WG).rotation.z = Math.PI / 2;
const LED_C = new THREE.Color(0xffcf96);
const led = new THREE.Mesh(new THREE.BoxGeometry(1.85, .012, .02), new THREE.MeshBasicMaterial({ color: LED_C })); led.position.set(0, H - .05, D / 2 - .06); WG.add(led);
// ante
const doors = [-1, 1].map(side => {
  const g = new THREE.Group(); g.position.set(side * W / 2, 0, D / 2); WG.add(g);
  const w = W / 2 - .003, Hd = H - .66, cy = .64 + Hd / 2, cx = -side * w / 2, fw = .075;
  box(w - .006, Hd - .006, .01, edenPanel, cx, cy, -.01, g);   // più piccolo e arretrato dentro la cornice: niente facce coincidenti che sfarfallano ad anta aperta                                                       // pannello incassato
  box(w, fw, .036, eden, cx, cy + Hd / 2 - fw / 2, 0, g); box(w, fw, .036, eden, cx, cy - Hd / 2 + fw / 2, 0, g);   // traverse
  box(fw, Hd - 2 * fw, .036, eden, cx + w / 2 - fw / 2, cy, 0, g); box(fw, Hd - 2 * fw, .036, eden, cx - w / 2 + fw / 2, cy, 0, g); // montanti
  box(w - 2 * fw + .01, Hd - 2 * fw + .01, .008, eden, cx, cy, .002, g);                               // cornice interna (profilo)
  const hx = -side * (w - fw / 2 - .005);
  cyl(.009, .26, brass, hx, cy, .062, g); cyl(.005, .035, brass, hx, cy + .11, .045, g).rotation.x = Math.PI / 2; cyl(.005, .035, brass, hx, cy - .11, .045, g).rotation.x = Math.PI / 2;
  box(.03, .07, .016, brass, 0, cy + Hd * .36, .006, g); box(.03, .07, .016, brass, 0, cy - Hd * .36, .006, g);       // cerniere
  return { g, side };
});
const wLight = new THREE.PointLight(0xffc98a, 0, 2.6, 2); wLight.position.set(WG.position.x - .3, 2.0, WG.position.z + .25); scene.add(wLight);
const wLight2 = new THREE.PointLight(0xffc98a, 0, 2.2, 2); wLight2.position.set(WG.position.x - .2, 1.0, WG.position.z + .3); scene.add(wLight2);


// scatola "Seconda vita"
const BOX = new THREE.Vector3(1.75, .28, .3); const cardboard = new THREE.MeshStandardMaterial({ color: 0xE6D6C0, roughness: .95, bumpMap: peel, bumpScale: .02, envMapIntensity: .4 });
const cb = new THREE.Group(); cb.position.set(BOX.x, 0, BOX.z); cb.rotation.y = -.25; scene.add(cb);
box(.56, .02, .42, cardboard, 0, .01, 0, cb); box(.56, .28, .02, cardboard, 0, .15, .2, cb); box(.56, .28, .02, cardboard, 0, .15, -.2, cb); box(.02, .28, .42, cardboard, .27, .15, 0, cb); box(.02, .28, .42, cardboard, -.27, .15, 0, cb);
const lab = new THREE.CanvasTexture(cv(512, 256, (x, w, h) => { x.fillStyle = '#F5ECDF'; x.fillRect(0, 0, w, h); x.strokeStyle = '#6B1937'; x.lineWidth = 3; x.strokeRect(14, 14, w - 28, h - 28); x.fillStyle = '#6B1937'; x.textAlign = 'center'; x.fillRect(w / 2 - 40, 162, 80, 2); x.font = '500 24px Helvetica, Arial, sans-serif'; x.fillText('S E C O N D A   V I T A', w / 2, 206); })); lab.colorSpace = THREE.SRGBColorSpace; lab.anisotropy = aniso;
{ const logo = new Image(); logo.onload = () => { const x = lab.image.getContext('2d'), lw = 420, lh = lw * logo.height / logo.width; x.drawImage(logo, (512 - lw) / 2, 146 - lh, lw, lh); lab.needsUpdate = true; }; logo.src = 'assets/logo-word-plum.png'; }   // logo Relook sull'etichetta
const lbl = new THREE.Mesh(new THREE.PlaneGeometry(.36, .18), new THREE.MeshStandardMaterial({ map: lab, roughness: .9, envMapIntensity: .3 })); lbl.position.set(0, .15, .212); cb.add(lbl);

// occlusione ambientale "finta": ombre di contatto e gradienti sugli spigoli (poco costosi, molto realistici)
const blobTex = new THREE.CanvasTexture(cv(128, 128, x => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(34,8,16,.55)'); g.addColorStop(.55, 'rgba(34,8,16,.2)'); g.addColorStop(1, 'rgba(34,8,16,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); }));
const decal = (map, w, h, o = 1) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, opacity: o, fog: false }));
const blob = (x, z, w, d, o = 1, y = .004) => { const m = decal(blobTex, w, d, o); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); scene.add(m); };
const aoTex = new THREE.CanvasTexture(cv(4, 128, x => { const g = x.createLinearGradient(0, 128, 0, 0); g.addColorStop(0, 'rgba(34,8,16,.45)'); g.addColorStop(1, 'rgba(34,8,16,0)'); x.fillStyle = g; x.fillRect(0, 0, 4, 128); }));
const aoBack = decal(aoTex, 18, .8); aoBack.position.set(.3, .4, -1.99); scene.add(aoBack);
const aoLeft = decal(aoTex, 7, .8); aoLeft.rotation.y = Math.PI / 2; aoLeft.position.set(-3.19, .4, .5); scene.add(aoLeft);
// alone menta (Eden) sulla parete dietro il manichino: un accento di colore, opaco e soffuso
const haloTex = new THREE.CanvasTexture(cv(256, 256, x => { const g = x.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, 'rgba(25,97,92,.75)'); g.addColorStop(.45, 'rgba(25,97,92,.32)'); g.addColorStop(1, 'rgba(25,97,92,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256); })); haloTex.colorSpace = THREE.SRGBColorSpace;
const halo = decal(haloTex, 2.8, 2.4, .5); halo.position.set(.66, 1.0, -1.988); scene.add(halo);
blob(1.9, -1.45, 2.9, 1.5, .9); blob(.75, -.1, 1.3, 1.3, .85, .01); blob(1.75, .3, .9, .8, .75);

// luci
const ceil = new THREE.Mesh(new THREE.PlaneGeometry(18, 9), creamWall); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 3.2, .5); scene.add(ceil);
scene.add(new THREE.HemisphereLight(0xfff3e6, 0x3a1822, .42));
const SUN_I = 95;
const sun = new THREE.SpotLight(0xfff0d8, SUN_I, 16, .62, .95, 2); sun.position.set(-3.0, 2.4, .4); sun.target.position.set(1.4, .5, -.6); scene.add(sun, sun.target);
sun.castShadow = true; sun.shadow.mapSize.setScalar(LOW ? 512 : 1024); sun.shadow.bias = -.0003; sun.shadow.normalBias = .03; sun.shadow.radius = LOW ? 4 : 7; sun.shadow.camera.near = .5; sun.shadow.camera.far = 14; sun.map = gobo;

const winLight = new THREE.RectAreaLight(0xfff0d8, 4.5, 1.7, 1.7); winLight.position.set(-3.05, 1.75, .1); winLight.lookAt(1.5, 1.1, -.3); scene.add(winLight);
const fill = new THREE.DirectionalLight(0xfff4ea, .32); fill.position.set(5, 2.2, 3.5); fill.target.position.set(1, 1, -.6); scene.add(fill, fill.target);
const rim = new THREE.SpotLight(0xffe6d2, 9, 6, .55, 1, 2); rim.position.set(.1, 2.9, -1.5); rim.target.position.set(.75, 1.05, -.1); scene.add(rim, rim.target);

// ---------- geometrie capi (costruite sul profilo del manichino) ----------
const PROF = [[-3, 1.69], [-1, 1.69], [-.5, 1.63], [0, 1.5], [.5, 1.34], [1, 1.31], [1.5, 1.42], [2, 1.57], [2.5, 1.74], [3, 1.86], [3.5, 1.92], [4, 1.8], [4.5, .65]];
const R = y => { if (y <= PROF[0][0]) return PROF[0][1]; for (let i = 1; i < PROF.length; i++) if (y <= PROF[i][0]) { const [y0, r0] = PROF[i - 1], [y1, r1] = PROF[i]; return r0 + (r1 - r0) * (y - y0) / (y1 - y0); } return .6; };
const lathe = (y0, y1, f, m, arc = Math.PI * 2, n = 40) => { const pts = []; for (let i = 0; i <= n; i++) { const y = y0 + (y1 - y0) * i / n; pts.push(new THREE.Vector2(f(y, i / n), y)); } const o = new THREE.Mesh(new THREE.LatheGeometry(pts, LOW ? 48 : 72, (Math.PI * 2 - arc) / 2, arc), m); o.castShadow = o.receiveShadow = true; return o; };
const circ = r => Math.PI * 2 * r;
const top = (m, y0 = .1) => lathe(y0, 4.12, y => R(y) + .07, m);
const skirt = (m, yTop = 1.0) => lathe(yTop, -4.05, (y, tt) => Math.max(R(Math.max(y, -3)), 1.3) + .14 + 1.1 * Math.pow(tt, 1.4), m);
const beltM = c => new THREE.MeshStandardMaterial({ color: c, roughness: .5, metalness: .05 });
// ---------- dettagli da sartoria (davanti = +z locale): rendono leggibile la rotazione ----------
const onSurf = (phi, y, r) => new THREE.Vector3(r * Math.sin(phi), y, r * Math.cos(phi));
// linea cucita (tubo sottile) che segue la superficie: pts = [[phi, y], ...], rad(y) = raggio della superficie
const seam = (pts, rad, c, th = .025, off = .015) => { const curve = new THREE.CatmullRomCurve3(pts.map(([phi, y]) => onSurf(phi, y, rad(y) + off))); const o = new THREE.Mesh(new THREE.TubeGeometry(curve, LOW ? 24 : 48, th, 5, false), detailM(c)); return o; };
// bottoni orientati verso l'esterno della superficie
const buttons = (phi, ys, rad, c, size = .08, m = 0) => { const g = new THREE.Group(); ys.forEach(y => { const b = new THREE.Mesh(new THREE.CylinderGeometry(size, size, .04, 16), detailM(c, m ? .45 : .6, m)); b.position.copy(onSurf(phi, y, rad(y) + .02)); b.rotation.set(Math.PI / 2, phi, 0, 'YXZ'); g.add(b); }); return g; };
const topR = y => R(y) + .07, coatR = y => R(y) + .3;
const skirtR = (yTop = 1.0) => y => Math.max(R(Math.max(y, -3)), 1.3) + .14 + 1.1 * Math.pow(clamp((yTop - y) / (yTop + 4.05)), 1.4);
const vneck = (c, rad = topR) => seam([[-.44, 4.1], [-.22, 3.6], [0, 3.1], [.22, 3.6], [.44, 4.1]], rad, darker(c), .035, .012);
const frontSeam = (c, yTop = 1.0) => seam([0, .25, .5, .75, 1].map(k => [0, lerp(yTop - .1, -3.95, k)]), skirtR(yTop), darker(c), .028, .01);
// gonna corta svasata con cinturino e abbottonatura frontale
const miniR = (y, tt) => R(Math.max(y, -3)) + .12 + .5 * Math.pow(tt, 1.3);
const miniSkirt = c => {
  const dk = darker(c), rad = y => miniR(y, clamp((1.0 - y) / 3.2));
  const band = new THREE.Mesh(new THREE.TorusGeometry(R(1.0) + .13, .06, 10, 64), detailM(dk)); band.rotation.x = Math.PI / 2; band.position.y = .95;
  return [lathe(1.0, -2.2, miniR, fabric('twill', c, { circ: circ(2), h: 3.2, cell: 1.4 })), band, buttons(0, [.55, -.05, -.65, -1.25, -1.85], rad, 0xC9A66B, .065, 1)];
};
// giacchetta di pelle corta, aperta davanti, con zip asimmetrica e cintura in vita
const leatherM = () => new THREE.MeshPhysicalMaterial({ color: 0x3A1A1C, roughness: .5, metalness: 0, clearcoat: .18, clearcoatRoughness: .55, bumpMap: peel, bumpScale: .02, side: THREE.DoubleSide, envMapIntensity: .6 });
const jacketR = y => R(y) + .2;
const jacket = () => {
  const zip = seam([[-.5, 1.25], [-.5, 2.4], [-.58, 3.4], [-.72, 4.0]], jacketR, 0xC9A66B, .022, .015);
  zip.material.metalness = 1; zip.material.roughness = .45;
  const hem = new THREE.Mesh(new THREE.TorusGeometry(R(1.2) + .22, .07, 10, 64), leatherM()); hem.rotation.x = Math.PI / 2; hem.position.y = 1.2;
  return [lathe(1.15, 4.5, jacketR, leatherM(), Math.PI * 2 - .9), zip, hem];
};
const belt = (y, c) => { const g = new THREE.Group(), o = new THREE.Mesh(new THREE.TorusGeometry(R(y) + .2, .09, 12, 64), beltM(c)); o.rotation.x = Math.PI / 2; o.position.y = y; o.castShadow = true; g.add(o);
  const bk = new THREE.Mesh(new THREE.BoxGeometry(.3, .24, .05), detailM(0xC9A66B, .45, 1)); bk.position.set(0, y, R(y) + .29); g.add(bk); return g; };   // fibbia sul davanti
const fk = (k, c, o) => fabric(k, c, { circ: circ(1.7), h: 4, ...o });

const ITEMS = [
  { id: 'maglia', name: 'Maglia corallo', slot: 'upper', days: 3, hang: 4.12, build: () => [top(fk('knit', '#D08C7C')), vneck('#D08C7C')] },
  { id: 'mariniere', name: 'Marinière', slot: 'upper', days: 12, hang: 4.12, build: () => [top(fk('knit', '#F2E9DC', { alt: '#0D0129', bands: 4, cell: 4 })), buttons(.72, [3.95, 3.68, 3.41], topR, 0x123463, .07)] },
  { id: 'top', name: 'Top giallo a coste', slot: 'upper', days: 95, hang: 4.12, build: () => [top(fk('rib', '#FAE59B', { h: 3.9 }), .2), buttons(0, [3.85, 3.4, 2.95, 2.5, 2.05], topR, 0x6B1937, .065)] },
  { id: 'abito', name: 'Abito menta', slot: 'dress', days: 150, hang: 4.12, build: () => [top(fk('satin', '#19615C', { h: 4.5, cell: 3 }), -.4), skirt(fabric('satin', '#19615C', { circ: circ(2.2), h: 5, cell: 3 })), belt(1.05, '#FAE59B'), vneck('#19615C'), frontSeam('#19615C')] },
  { id: 'gonna', name: 'Gonna viola', slot: 'lower', days: 20, hang: 1.0, build: () => [skirt(fabric('weave', '#6B1937', { circ: circ(2.2), h: 5, cell: 1.8 })), belt(1.05, '#FAE59B'), frontSeam('#6B1937')] },
  { id: 'cappotto', name: 'Cappotto cobalto', slot: 'coat', days: 8, hang: 4.55, build: () => [lathe(-3.4, 4.55, y => R(y) + .3, fabric('twill', '#123463', { circ: circ(2), h: 8, cell: 1.2 }), Math.PI * 2 - .9), buttons(-.6, [3.5, 2.6, 1.7, .8, -.1], coatR, 0xC9A66B, .11, 1)] },
  { id: 'minigonna', name: 'Gonna corta navy', slot: 'lower', days: 40, hang: 1.0, build: () => miniSkirt('#1B2C4E') },
  { id: 'giacca', name: 'Giacchetta di pelle', slot: 'coat', days: 25, hang: 4.5, build: jacket },
];

// appendiabiti
const hangerG = (() => { const pts = [[-.2, 0], [0, .075], [.2, 0], [-.2, 0]].map(([x, y]) => new THREE.Vector3(x, y, 0)), path = new THREE.CurvePath(); for (let i = 0; i < 3; i++) path.add(new THREE.LineCurve3(pts[i], pts[i + 1])); return new THREE.TubeGeometry(path, 24, .0045, 6, false); })();
const makeHanger = () => { const g = new THREE.Group(); const b = new THREE.Mesh(hangerG, dark); b.castShadow = true; g.add(b); const hk = new THREE.Mesh(new THREE.TorusGeometry(.018, .0035, 6, 16, Math.PI * 1.5), brass); hk.position.set(0, .093, 0); hk.rotation.z = Math.PI * .1; g.add(hk); return g; };

// ---------- posizionamento sulla barra ----------
const RSP = .1, RX0 = WG.position.x + (-W / 2 + t + .1) / 2 - (ITEMS.length - 1) * RSP / 2,   // grucce centrate nel vano tra fianco sinistro e divisorio
      RZ = WG.position.z, BAR_Y = RAIL_Y - .11;
const all = ITEMS;
all.forEach((it, i) => {
  it.holder = new THREE.Group(); it.build().forEach(m => it.holder.add(m)); it.holder.userData.item = it;
  it.hanger = makeHanger(); it.rx = RX0 + i * RSP; it.hangY = BAR_Y; it.ry = BAR_Y - it.hang * S + .015;
  it.hanger.position.set(it.rx, it.hangY, RZ); scene.add(it.hanger, it.holder);
  it.where = 'rail'; it.t = 1; it.h = 0; it.mats = []; it.holder.traverse(o => { if (o.isMesh && o.material.emissive) it.mats.push(o.material); });
  it.holder.position.set(it.rx, it.ry, RZ); it.holder.scale.set(S, S, S * .3); it.holder.rotation.y = -1.42;
});

// ---------- manichino ----------
const M = new THREE.Group(); M.position.set(.75, 5.07 * S, -.1); M.scale.setScalar(S); scene.add(M);
const mannMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85, metalness: 0, bumpMap: peel, bumpScale: .012, envMapIntensity: .5 });
const standG = new THREE.LatheGeometry([[0, 0], [.47, 0], [.48, .008], [.48, .03], [.465, .04], [0, .04]].map(([r, y]) => new THREE.Vector2(r, y)), 64);
const stand = new THREE.Mesh(standG, walnutGloss); stand.position.set(M.position.x, .002, M.position.z); stand.castShadow = stand.receiveShadow = true; scene.add(stand);
// volume invisibile attorno a manichino e capi indossati: è la zona da cui si può trascinare per girarlo
const mannHit = new THREE.Mesh(new THREE.CylinderGeometry(.34, .34, 1.5, 12), new THREE.MeshBasicMaterial()); mannHit.position.set(M.position.x, .75, M.position.z); mannHit.visible = false; scene.add(mannHit);
// profilo reale del manichino (raggio per altezza, misurato da mannequin.bin, passo .25 da y = -2.75)
const MPROF = [1.688, 1.688, 1.69, 1.693, 1.694, 1.694, 1.694, 1.688, 1.661, 1.606, 1.544, 1.455, 1.379, 1.32, 1.289, 1.294, 1.329, 1.389, 1.461, 1.535, 1.613, 1.702, 1.778, 1.832, 1.89, 1.924, 1.91, 1.514, .797, .549];
const MR = y => { const f = clamp((y + 2.75) / .25, 0, MPROF.length - 1), i = Math.min(MPROF.length - 2, Math.floor(f)); return lerp(MPROF[i], MPROF[i + 1], f - i); };
const addMannDetails = () => {
  const seamC = 0xD2C0A6;
  // cucitura centrale davanti e due princess seam
  M.add(seam([[0, -2.8], [0, -1], [0, 1], [0, 2.6], [0, 3.85]], MR, seamC, .018, .012));
  [-1, 1].forEach(sd => M.add(seam([[.46, -2.8], [.42, -1], [.38, 1], [.44, 2.2], [.5, 3], [.6, 3.7], [.66, 3.9]].map(([p, y]) => [p * sd, y]), MR, seamC, .018, .012)));
  // etichetta tessuta "Relook" sul petto
  const lt = new THREE.CanvasTexture(cv(256, 112, (x, w, h) => { x.fillStyle = '#6B1937'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(240,230,216,.55)'; x.setLineDash([5, 4]); x.lineWidth = 2; x.strokeRect(7, 7, w - 14, h - 14); x.fillStyle = '#F0E6D8'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = 'italic 500 52px Georgia, serif'; x.fillText('Relook', w / 2, h / 2 + 2); })); lt.colorSpace = THREE.SRGBColorSpace; lt.anisotropy = aniso;
  const label = new THREE.Mesh(new THREE.PlaneGeometry(.56, .245), new THREE.MeshStandardMaterial({ map: lt, roughness: .9, envMapIntensity: .3 }));
  label.position.set(0, 2.75, MR(2.75) + .045); label.rotation.x = .28; M.add(label);
  // tappo del collo in ottone spazzolato, pomolo spostato verso il retro
  const capM = detailM(0xC9A66B, .45, 1);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(.5, .52, .1, 32), capM); cap.position.y = 5.1; M.add(cap);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, .14, 12), capM); stem.position.set(0, 5.22, -.26); M.add(stem);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(.1, 16, 12), capM); knob.position.set(0, 5.32, -.26); M.add(knob);
};
let mannLoaded = false;
// la scena compare in dissolvenza subito, dal primo fotogramma disegnato
requestAnimationFrame(() => requestAnimationFrame(() => { renderer.domElement.style.opacity = 1; }));
fetch('assets/mannequin.bin').then(r => r.arrayBuffer()).then(buf => {      // mesh binario compatto (1 MB invece di 7,6 MB di OBJ)
  const [nv, ni] = new Uint32Array(buf, 0, 2), g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(buf, 8, nv * 3), 3));
  g.setIndex(new THREE.BufferAttribute(new Uint16Array(buf, 8 + nv * 12, ni), 1)); g.computeVertexNormals();
  const pa = g.attributes.position, col = new Float32Array(nv * 3), yel = new THREE.Color(0xEADCC8), wood = new THREE.Color(0x450D1D), c = new THREE.Color();
  for (let i = 0; i < nv; i++) { const y = pa.getY(i); c.copy(y < -3.15 || y > 4.85 ? wood : yel); col.set([c.r, c.g, c.b], i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(nv * 2).map((_, i) => i % 2 ? pa.getY(i >> 1) * .5 : Math.atan2(pa.getZ(i >> 1), pa.getX(i >> 1)) * .8), 2));
  const o = new THREE.Mesh(g, mannMat); o.castShadow = o.receiveShadow = true; M.add(o); addMannDetails(); mannLoaded = true;
});

// ---------- stato interattivo ----------
const state = { interactive: false, auto: false, donated: 0, last: null, choice: null };
const worn = () => ITEMS.filter(i => i.where === 'worn');
const poseOf = it => {
  const o = { pos: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3() };
  if (it.where === 'worn') { o.pos.copy(M.position); o.q.copy(M.quaternion); o.s.set(S, S, S); }
  else if (it.where === 'box') { o.pos.set(BOX.x, BOX.y + .1, BOX.z); o.q.setFromEuler(new THREE.Euler(.5, it.rot || 0, .3)); o.s.setScalar(S * .35); }
  else { o.pos.set(it.rx, it.ry, RZ + it.h * .45); o.q.setFromEuler(new THREE.Euler(0, lerp(lerp(-1.42, -.5, fan), -.1, it.h), 0)); o.s.set(S, S, S * lerp(.3, .62, it.h)); }
  return o;
};
const go = (it, where) => { if (it.where === where) return; it.from = { pos: it.holder.position.clone(), q: it.holder.quaternion.clone(), s: it.holder.scale.clone() }; it.where = where; it.t = 0; it.rot = Math.random() * 2; it.holder.visible = true; };
const ease = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const wear = (it, on = true) => {
  if (!on) return go(it, 'rail');
  ITEMS.filter(o => o.where === 'worn' && (o.slot === it.slot || (it.slot === 'dress' && (o.slot === 'upper' || o.slot === 'lower')) || (o.slot === 'dress' && (it.slot === 'upper' || it.slot === 'lower')))).forEach(o => go(o, 'rail'));
  go(it, 'worn');
};
const low = it => it.name.charAt(0).toLowerCase() + it.name.slice(1);
const months = it => Math.max(2, Math.round(it.days / 30));
const refresh = () => {
  if (state.last) { const n = state.donated; wornEl.textContent = `Messo via: ${low(state.last)}. ${n} ${n === 1 ? 'capo pronto' : 'capi pronti'} per una seconda vita.`; return; }
  const w = worn(); wornEl.textContent = w.length ? 'Indossi: ' + w.map(low).join(' + ') + '.' : 'Indossi: niente. Clicca un capo per provarlo.';
};
refresh();
// invito "Prova / Metti via" per i capi fermi da più di 60 giorni
const openChoice = it => { state.choice = it; choiceT.textContent = `${it.name} · fermo da ${months(it)} mesi`; choice.classList.add('on'); choice.removeAttribute('aria-hidden'); };
const closeChoice = () => { state.choice = null; choice.classList.remove('on'); choice.setAttribute('aria-hidden', 'true'); };
choice.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
  const it = state.choice; if (!it) return; closeChoice();
  if (b.dataset.act === 'away') { go(it, 'box'); state.donated++; state.last = it; } else { wear(it); state.last = null; }
  refresh();
}));
addEventListener('keydown', e => { if (e.key === 'Escape') closeChoice(); });
$('#reset').addEventListener('click', () => { closeChoice(); ITEMS.forEach(i => { i.holder.visible = true; go(i, 'rail'); }); state.donated = 0; state.last = null; refresh(); });
// etichette "fermo da N mesi" e contatore della scatola
// le etichette dei capi fermi sono pulsanti: cliccandole si apre l'invito per quel capo, passandoci sopra il capo si illumina
let tagHover = null;
ITEMS.filter(i => i.days > 60).forEach((i, n) => {
  const e = document.createElement('button'); e.type = 'button'; e.className = 'tag tag-btn'; e.textContent = `fermo da ${months(i)} mesi`; e.setAttribute('aria-label', `${i.name}, fermo da ${months(i)} mesi: provalo o mettilo via`); e.tabIndex = -1;
  e.addEventListener('click', () => { if (state.interactive && i.where === 'rail') openChoice(i); });
  e.addEventListener('pointerenter', () => tagHover = i); e.addEventListener('pointerleave', () => { if (tagHover === i) tagHover = null; });
  tagsEl.appendChild(e); i.el = e; i.tagUp = n % 2 * .13;
});
const boxTag = document.createElement('div'); boxTag.className = 'tag'; boxTag.setAttribute('aria-hidden', 'true'); tagsEl.appendChild(boxTag);

// ---------- puntatore ----------
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), mouse = { x: 0, y: 0, px: 0, py: 0 };
let hover = null, drag = null, spinOff = 0, spinVel = 0, intro = -1;
const SPIN = .016;   // radianti per pixel trascinato
const pick = () => { ray.setFromCamera(ndc, camera); const hs = all.filter(i => i.holder.visible && i.t >= 1).map(i => i.holder); const h = ray.intersectObjects(hs, true)[0]; return h ? (h.object.parent?.userData.item || h.object.parent?.parent?.userData.item) : null; };
const pickMann = () => { ray.setFromCamera(ndc, camera); return ray.intersectObject(mannHit, false).length > 0; };
const setNdc = e => { const r = stage.getBoundingClientRect(); mouse.px = e.clientX - r.left; mouse.py = e.clientY - r.top; ndc.set(mouse.px / r.width * 2 - 1, -(mouse.py / r.height) * 2 + 1); mouse.x = ndc.x; mouse.y = ndc.y; };
stage.addEventListener('pointermove', e => {
  setNdc(e);
  if (drag && drag.onM) { const now = performance.now(), dx = e.clientX - drag.x, v = dx * SPIN / Math.max(.008, (now - drag.t) / 1000); drag.moved += Math.abs(dx); spinOff += dx * SPIN; spinVel = clamp(lerp(spinVel, v, .4), -9, 9); drag.x = e.clientX; drag.t = now; }
  else if (drag) drag.moved = Math.max(drag.moved, Math.hypot(e.clientX - drag.x, e.clientY - drag.y));
});
stage.addEventListener('pointerenter', () => mouse.in = true);
stage.addEventListener('pointerleave', () => { mouse.in = false; hover = null; });
stage.addEventListener('pointerdown', e => { if (!state.interactive) return; setNdc(e); mouse.in = true; spinVel = 0; drag = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0, onM: pickMann() }; stage.setPointerCapture(e.pointerId); });
stage.addEventListener('pointercancel', () => { drag = null; });
stage.addEventListener('pointerup', e => {
  const d = drag; drag = null; if (d?.onM) spinVel *= Math.exp(-(performance.now() - d.t) / 160);   // inerzia al rilascio, più debole se ci si era fermati
  if (!state.interactive || !d || d.moved > 6) return;
  if (e.pointerType !== 'mouse') mouse.in = false;
  const it = pick(); if (!it) return closeChoice();
  if (it.where === 'rail' && it.days > 60) return openChoice(it);
  closeChoice(); wear(it, it.where !== 'worn'); state.last = null; refresh();
});

// ---------- timeline di scroll ----------
const KEYS = [
  [0, [.7, 1.6, 6.3], [.7, 1.15, -.6]],
  [.14, [1.0, 1.5, 4.7], [1.2, 1.2, -1]],
  [.42, [1.55, 1.55, 1.55], [1.85, 1.35, -1.6]],
  [.62, [1.45, 1.5, .5], [1.5, 1.3, -1.6]],
  [.86, [1.0, 1.5, 4.9], [1.0, 1.1, -.8]],
  [1, [1.0, 1.5, 4.9], [1.0, 1.1, -.8]],
];
const camAt = p => { let i = 0; while (i < KEYS.length - 2 && p > KEYS[i + 1][0]) i++; const [a, pa, la] = KEYS[i], [b, pb, lb] = KEYS[i + 1], k = ss(a, b, p); return [pa.map((v, j) => lerp(v, pb[j], k)), la.map((v, j) => lerp(v, lb[j], k))]; };
let P = 0, Ps = 0, fan = 0;
const TL_END = .9;   // punto della timeline in cui finisce lo scroll della hero (Prova pieno a .88)
const progress = () => { const r = hero.getBoundingClientRect(), range = r.height - pin.clientHeight; return range > 0 ? clamp((68 - r.top) / range) * TL_END : TL_END; };   // nessuna pausa: la hero si sblocca appena il passo Prova è completo
const caps = ['#c1', '#c2', '#c3', '#c4'].map(s => $(s)), cue = $('.cue'), pbar = $('.pbar');
const setCap = (el, o, y = 0) => { el.style.opacity = o.toFixed(3); el.style.translate = `0 ${((1 - o) * 26 + y).toFixed(1)}px`; el.style.visibility = o < .01 ? 'hidden' : 'visible'; };

// ---------- dimensioni ----------
const resize = () => { const w = stage.clientWidth, h = stage.clientHeight; if (!w) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w / h < 1.2 ? Math.min(62, 34 * Math.pow(1.2 / (w / h), .75)) : 34;
  const off = w > 820 ? .12 * clamp((w / h - 1.2) / .4) : 0; if (off) camera.setViewOffset(w, h, -off * w, 0, w, h); else camera.clearViewOffset(); camera.updateProjectionMatrix(); };
new ResizeObserver(resize).observe(stage); resize();
let vis = true; new IntersectionObserver(e => vis = e[0].isIntersecting, { rootMargin: '100px' }).observe(hero);

// ---------- loop ----------
const clock = new THREE.Clock(), v3 = new THREE.Vector3(), look = new THREE.Vector3();
renderer.setAnimationLoop(() => {
  if (!vis) return;
  const dt = Math.min(.05, clock.getDelta()), T = clock.elapsedTime, k = f => 1 - Math.exp(-dt * f);
  P = progress(); if (reduce) Ps = P < .14 ? 0 : P < .45 ? .3 : P < .76 ? .6 : 1; else Ps += (P - Ps) * k(7);
  fan = ss(.4, .66, Ps);
  // camera
  const [cp, cl] = camAt(Ps), w = clamp((1.5 - camera.aspect) / .7);
  if (!reduce) { cp[0] += mouse.x * .25; cp[1] += mouse.y * .08; }
  cl[0] = lerp(cl[0], cp[0] + .5, w * .6);
  camera.position.set(...cp); look.set(...cl); camera.lookAt(look);
  // ante + luci interne
  const d = ss(.1, .4, Ps); doors.forEach(({ g, side }) => g.rotation.y = side * d * 1.85);
  const lt = ss(.12, .42, Ps); wLight.intensity = 2.2 * lt; wLight2.intensity = 1.4 * lt; led.material.color.copy(LED_C).multiplyScalar(lerp(.2, .85, lt));
  sun.intensity = SUN_I * (.85 + .15 * ss(0, .2, Ps));
  // interattività
  if (Ps > .8 && intro < 0) intro = reduce ? 1 : 0;   // giro d'invito una sola volta all'ingresso in Prova
  state.interactive = Ps > .8; if (!state.interactive && state.choice) closeChoice();
  setCap(caps[0], 1 - ss(.03, .12, Ps)); setCap(caps[1], ss(.17, .24, Ps) * (1 - ss(.36, .43, Ps))); setCap(caps[2], ss(.47, .54, Ps) * (1 - ss(.66, .73, Ps))); setCap(caps[3], ss(.8, .88, Ps));
  cue.style.opacity = 1 - ss(.01, .06, Ps); pbar.style.setProperty('--p', (Ps / TL_END).toFixed(4)); hero.style.setProperty('--p', Ps);
  // auto: al termine dell'apertura il manichino si veste con un capo preso dalla barra
  // tornando indietro, già durante "Apri" (ante ancora aperte) i capi rientrano nell'armadio e il manichino resta nudo; al prossimo ingresso in Prova si rivestirà
  if (Ps < .42 && (state.auto || worn().length)) { state.auto = false; closeChoice(); worn().forEach(i => go(i, 'rail')); state.last = null; refresh(); }
  if (Ps > .84 && !state.auto && mannLoaded) { state.auto = true; wear(ITEMS.find(i => i.id === 'maglia')); wear(ITEMS.find(i => i.id === 'gonna')); state.last = null; refresh(); }
  // manichino
  if (!drag) { spinOff += spinVel * dt; spinVel *= Math.exp(-dt * 1.6); }
  if (intro >= 0 && intro < 1) intro = Math.min(1, intro + dt / 2.6);
  M.rotation.y = spinOff + (intro > 0 && intro < 1 ? Math.sin(Math.PI * ease(intro)) * .44 : 0);   // ~25° e ritorno
  // hover
  if (state.interactive && !drag && mouse.in) { hover = pick(); stage.style.cursor = hover ? 'pointer' : (pickMann() ? 'grab' : 'default'); } else if (drag) stage.style.cursor = 'grabbing'; else { if (!mouse.in) hover = null; stage.style.cursor = 'default'; }
  all.forEach(it => {
    const on = (it === hover || it === tagHover || it === state.choice) && it.where === 'rail' && it.t >= 1;   // il capo selezionato (o indicato dalla sua etichetta) esce dalla barra
    it.h += ((on ? 1 : 0) - it.h) * k(9);
    const hv = it === hover || it === tagHover || it === state.choice; it.mats.forEach(m => m.emissive.setRGB(...(hv ? [.12, .1, .08] : [0, 0, 0])));
    if (!it.holder.visible) return;
    const pose = poseOf(it);
    if (it.t < 1) { it.t = reduce ? 1 : Math.min(1, it.t + dt / .95);
 const e = ease(it.t); it.holder.position.lerpVectors(it.from.pos, pose.pos, e); it.holder.position.y += Math.sin(e * Math.PI) * (it.where === 'box' ? .25 : .5); it.holder.quaternion.slerpQuaternions(it.from.q, pose.q, e); it.holder.scale.lerpVectors(it.from.s, pose.s, e); if (it.t >= 1 && it.where === 'box') it.holder.visible = false; }
    else { it.holder.position.copy(pose.pos); it.holder.quaternion.copy(pose.q); it.holder.scale.copy(pose.s); if (it.where === 'rail' && !reduce) it.holder.position.x += Math.sin(T * 1.2 + it.rx * 9) * .002; }
    const h = it.where === 'rail' && it.t >= 1 ? it.h : 0; it.hanger.position.z += (RZ + h * .45 - it.hanger.position.z) * k(14); it.hanger.rotation.y = it.where === 'rail' ? lerp(lerp(-1.42, -.5, fan), -.1, h) : it.hanger.rotation.y;
  });
  // etichette "fermo da N mesi", contatore della scatola, invito Prova / Metti via
  const cw = stage.clientWidth, ch = stage.clientHeight, place = (el, x, y, z, tf) => { v3.set(x, y, z).project(camera); el.style.transform = `translate(${(v3.x * .5 + .5) * cw}px,${(-v3.y * .5 + .5) * ch}px) ${tf}`; };
  ITEMS.forEach(it => { if (!it.el) return; const show = state.interactive && it.where === 'rail' && it !== state.choice; it.el.style.opacity = show ? 1 : 0; it.el.style.pointerEvents = show ? 'auto' : 'none'; it.el.tabIndex = show ? 0 : -1; if (!show && tagHover === it) tagHover = null; if (show) place(it.el, it.rx, it.hangY + .14 + it.tagUp, RZ + it.h * .45, 'translate(-50%,-100%)'); });
  boxTag.style.opacity = state.interactive && state.donated ? 1 : 0; boxTag.textContent = state.donated === 1 ? '1 capo messo via' : `${state.donated} capi messi via`; place(boxTag, BOX.x, .5, BOX.z, 'translate(-50%,-100%)');
  if (state.choice) { const c = state.choice; v3.set(c.rx, c.ry + c.hang * S * .55, RZ + c.h * .45).project(camera); const x = (v3.x * .5 + .5) * cw, y = (-v3.y * .5 + .5) * ch, w = choice.offsetWidth; choice.style.transform = `translate(${clamp(x - w - 16, 8, cw - w - 8)}px,${clamp(y - 20, 8, ch - 56)}px)`; }
  // tooltip
  if (hover && state.interactive && !state.choice) { tip.style.opacity = 1; tip.style.transform = `translate(${mouse.px + 18}px,${mouse.py + 14}px)`; tip.innerHTML = `<b>${hover.name}</b>${hover.where === 'worn' ? 'Clicca per toglierlo' : hover.days > 60 ? 'Clicca: provalo o mettilo via' : 'Clicca per provarlo'}`; } else tip.style.opacity = 0;
  renderer.render(scene, camera);
});
