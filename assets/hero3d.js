// Hero 3D di Relook: stanza + armadio guidati dallo scroll, capi interattivi.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
RectAreaLightUniformsLib.init();

const $ = s => document.querySelector(s);
const hero = $('#top'), pin = $('.hero-pin'), stage = $('#stage'), tip = $('#tip'), tagsEl = $('#tags'), rinfo = $('#rinfo'), loadEl = $('#hload');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const S = .14;                                  // scala del manichino/capi (unità OBJ -> metri)

// ---------- renderer / scena ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25;
renderer.outputColorSpace = THREE.SRGBColorSpace;
stage.appendChild(renderer.domElement);
const aniso = renderer.capabilities.getMaxAnisotropy();
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0D0129);
scene.fog = new THREE.FogExp2(0x1a1236, .016);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), .04).texture;
scene.environmentIntensity = .45;
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
  x.fillStyle = '#000'; x.fillRect(0, 0, w, h); x.filter = 'blur(3px)'; x.fillStyle = '#fff';
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) x.fillRect(40 + i * 150, 40 + j * 150, 126, 126);
});

// ---------- tessuti (maglia / twill / tela / costine) ----------
const hexRGB = c => { const k = new THREE.Color(c); return [k.r, k.g, k.b].map(v => Math.pow(v, 1 / 2.2) * 255); };
const fabricCache = {};
const fabric = (kind, base, { alt, bands = 0, circ = 11, h = 4, cell = 1.6, strength = 1.5 } = {}) => {
  const key = [kind, base, alt, bands, circ, h, cell].join('|'); if (fabricCache[key]) return fabricCache[key];
  const N = 256, H = new Float32Array(N * N), cc = document.createElement('canvas'), nc = document.createElement('canvas'); cc.width = cc.height = nc.width = nc.height = N;
  const cx = cc.getContext('2d'), nx = nc.getContext('2d'), ci = cx.createImageData(N, N), ni = nx.createImageData(N, N);
  const B = hexRGB(base), A = alt ? hexRGB(alt) : B, T = Math.PI * 2, f = kind === 'knit' ? 14 : 16;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = y / N, n = Math.random() - .5; let hh;
    if (kind === 'knit') { const fx = (u * f) % 1, fy = (v * f) % 1, d = Math.abs(fx - .5) * 2; hh = Math.max(0, 1 - Math.abs(fy - (.12 + .62 * d)) / .3); hh = hh * hh * (3 - 2 * hh); }
    else if (kind === 'twill') hh = .5 + .5 * Math.sin(T * f * (u + v)) * (.7 + .3 * Math.sin(T * f * 4 * u));
    else if (kind === 'weave') { const a1 = (Math.floor(u * f) + Math.floor(v * f)) % 2; hh = .35 + .65 * (a1 ? Math.abs(Math.sin(T * f * u * .5 + .5)) : Math.abs(Math.sin(T * f * v * .5 + .5))); }
    else if (kind === 'satin') hh = .5 + .5 * Math.sin(T * 6 * v + Math.sin(T * 3 * u) * .6);
    else hh = .5 + .5 * Math.sin(T * f * 1.5 * u);
    hh = clamp(hh + n * .22); H[y * N + x] = hh;
    const band = bands ? (Math.floor(v * bands * 2) % 2 ? 1 : 0) : 0, c = band ? A : B, sh = .8 + .2 * hh, i = (y * N + x) * 4;
    ci.data[i] = c[0] * sh; ci.data[i + 1] = c[1] * sh; ci.data[i + 2] = c[2] * sh; ci.data[i + 3] = 255;
  }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const g = (xx, yy) => H[((yy + N) % N) * N + ((xx + N) % N)], i = (y * N + x) * 4;
    const dx = (g(x - 1, y) - g(x + 1, y)) * strength, dy = (g(x, y - 1) - g(x, y + 1)) * strength, l = Math.hypot(dx, dy, 1);
    ni.data[i] = (dx / l * .5 + .5) * 255; ni.data[i + 1] = (dy / l * .5 + .5) * 255; ni.data[i + 2] = (1 / l * .5 + .5) * 255; ni.data[i + 3] = 255;
  }
  cx.putImageData(ci, 0, 0); nx.putImageData(ni, 0, 0);
  const rep = [Math.max(1, Math.round(circ / cell)), Math.max(1, Math.round(h / cell))];
  return fabricCache[key] = new THREE.MeshPhysicalMaterial({ map: tex(cc, rep, true), normalMap: tex(nc, rep, false), normalScale: new THREE.Vector2(.8, .8), roughness: kind === 'satin' ? .42 : .88, metalness: 0, sheen: kind === 'satin' ? .4 : 1, sheenRoughness: .5, sheenColor: new THREE.Color(base).lerp(new THREE.Color('#fff'), .55), side: THREE.DoubleSide, envMapIntensity: .6 });
};

// ---------- materiali ambiente ----------
const wallBump = tex(plasterC('#808080', 1.6), [16, 3], false);
const paint = (c, rep) => new THREE.MeshStandardMaterial({ map: tex(plasterC(c), rep), bumpMap: wallBump, bumpScale: .12, roughness: .9 });
const wallMat = paint('#0D0129', [16, 3]), creamWall = paint('#FFFCF7', [16, 3]);       // Currant + Cream come il sito
const floorTex = tex(planksC(), [11, 5.6]);
const floorMat = new THREE.MeshPhysicalMaterial({ map: floorTex, bumpMap: floorTex, bumpScale: .6, roughness: .82, clearcoat: 0 });
const woodT = tex(woodC('#6E4224', '#2c160a')), walnut = new THREE.MeshStandardMaterial({ map: woodT, bumpMap: woodT, bumpScale: .5, roughness: .5 });
const peel = tex(cv(128, 128, x => { const im = x.createImageData(128, 128); for (let i = 0; i < im.data.length; i += 4) { const n = 128 + (Math.random() - .5) * 90; im.data[i] = im.data[i + 1] = im.data[i + 2] = n; im.data[i + 3] = 255; } x.putImageData(im, 0, 0); }), [10, 10], false);
const paintSatin = (c, r = .4) => new THREE.MeshPhysicalMaterial({ color: c, roughness: r, clearcoat: .55, clearcoatRoughness: .25, bumpMap: peel, bumpScale: .04 });
const eden = paintSatin(0x6B1937), edenPanel = paintSatin(0x450D1D, .46);          // armadio Currant, pannelli Plum
const walnutGloss = new THREE.MeshPhysicalMaterial({ color: 0x450D1D, roughness: .35, clearcoat: .7, clearcoatRoughness: .2 });
const oakT = tex(woodC('#FFFCF7', '#d8cdb8')), lacquer = new THREE.MeshStandardMaterial({ map: oakT, bumpMap: oakT, bumpScale: .25, roughness: .6 });
const brass = new THREE.MeshStandardMaterial({ color: 0xE6CB78, metalness: 1, roughness: .22, envMapIntensity: 1.6 });
const dark = new THREE.MeshStandardMaterial({ color: 0x450D1D, roughness: .55 });
const white = new THREE.MeshStandardMaterial({ color: 0xFFFCF7, roughness: .7 });

const box = (w, h, d, m, x, y, z, parent = scene) => { const o = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(.007, w / 2.2, h / 2.2, d / 2.2)), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; parent.add(o); return o; };
const cyl = (r, h, m, x, y, z, parent = scene, seg = 24) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m); o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o; };

// stanza
const floor = new THREE.Mesh(new THREE.PlaneGeometry(18, 9), floorMat); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, .5); floor.receiveShadow = true; scene.add(floor);
const back = new THREE.Mesh(new THREE.PlaneGeometry(18, 3.2), wallMat); back.position.set(.3, 1.6, -2); back.receiveShadow = true; scene.add(back);
const left = new THREE.Mesh(new THREE.PlaneGeometry(7, 3.2), creamWall); left.rotation.y = Math.PI / 2; left.position.set(-3.2, 1.6, .5); left.receiveShadow = true; scene.add(left);
box(18, .12, .03, white, .3, .06, -1.985); box(.03, .12, 7, white, -3.185, .06, .5);        // battiscopa
box(18, .06, .05, white, .3, 3.15, -1.975);                                                 // cornice
// finestra: il vetro è la sorgente della luce e proietta i riquadri sul pavimento
const gobo = new THREE.CanvasTexture(goboC()); gobo.colorSpace = THREE.SRGBColorSpace;
const win = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.7), new THREE.MeshBasicMaterial({ map: gobo, color: 0xfff0d0, toneMapped: false, fog: false })); win.rotation.y = Math.PI / 2; win.position.set(-3.19, 1.75, .1); scene.add(win);
[-.88, .88].forEach(o => { box(.05, .05, 1.8, white, -3.17, 1.75 + o, .1); box(.05, 1.8, .05, white, -3.17, 1.75, .1 + o); });
// tappeto
const rug = new THREE.Mesh(new THREE.CircleGeometry(.95, 64), new THREE.MeshStandardMaterial({ map: (() => { const t = new THREE.CanvasTexture(cv(512, 512, (x, w, h) => { x.fillStyle = '#FFFCF7'; x.fillRect(0, 0, w, h); for (let r = 250; r > 20; r -= 38) { x.strokeStyle = r % 76 ? '#D08C7C' : '#123463'; x.lineWidth = 8; x.beginPath(); x.arc(w / 2, h / 2, r, 0, 7); x.stroke(); } const im = x.getImageData(0, 0, w, h); for (let i = 0; i < im.data.length; i += 4) { const n = (Math.random() - .5) * 26; im.data[i] += n; im.data[i + 1] += n; im.data[i + 2] += n; } x.putImageData(im, 0, 0); })); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; return t; })(), roughness: 1 }));
rug.rotation.x = -Math.PI / 2; rug.position.set(.75, .006, -.1); rug.receiveShadow = true; scene.add(rug);

// ---------- armadio ----------
const W = 1.9, H = 2.3, D = .8, t = .03, WG = new THREE.Group(); WG.position.set(1.9, 0, -1.6); scene.add(WG);
box(W - .04, .1, D - .04, dark, 0, .05, 0, WG);
box(W, H, t, lacquer, 0, H / 2, -D / 2 + t / 2, WG);
box(t, H, D, eden, -W / 2 + t / 2, H / 2, 0, WG); box(t, H, D, eden, W / 2 - t / 2, H / 2, 0, WG);
box(W, t, D, eden, 0, H - t / 2, 0, WG); box(W - 2 * t, t, D - .02, lacquer, 0, .12, 0, WG); box(W - 2 * t, t, D - .02, lacquer, 0, .62, 0, WG);
box(t, H - .64, D - .04, lacquer, .1, .63 + (H - .64) / 2, 0, WG);
[0, 1].forEach(i => { const y = .24 + i * .25; box(W - .12, .225, .034, eden, 0, y, D / 2 - .02, WG); box(W - .24, .13, .008, edenPanel, 0, y, D / 2 + .0, WG); cyl(.008, .34, brass, 0, y, D / 2 + .05, WG).rotation.z = Math.PI / 2; [-.15, .15].forEach(px => cyl(.005, .035, brass, px, y, D / 2 + .035, WG).rotation.x = Math.PI / 2); });
[1.0, 1.4, 1.8].forEach(y => box(.8, t, D - .04, lacquer, .1 + .45, y, 0, WG));
// pile di capi piegati sugli scaffali
[[1.0, '#123463'], [1.4, '#19615C'], [1.8, '#D08C7C'], [.62, '#6B1937']].forEach(([y, c], i) => { const n = 3 + (i % 2); for (let k = 0; k < n; k++) box(.3, .05, .32, fabric(k % 2 ? 'weave' : 'knit', k % 2 ? '#FFFCF7' : c, { circ: 1, h: .3, cell: .3 }), .55, y + .04 + k * .052, 0, WG); });
// barra appendiabiti + led
const RAIL_Y = 1.98; cyl(.012, 1.0, brass, WG.position.x * 0 - .45, RAIL_Y, 0, WG).rotation.z = Math.PI / 2;
const led = new THREE.Mesh(new THREE.BoxGeometry(1.85, .012, .02), new THREE.MeshBasicMaterial({ color: 0xffe2b0, toneMapped: false })); led.position.set(0, H - .05, D / 2 - .06); WG.add(led);
// ante
const doors = [-1, 1].map(side => {
  const g = new THREE.Group(); g.position.set(side * W / 2, 0, D / 2); WG.add(g);
  const w = W / 2 - .003, Hd = H - .66, cy = .64 + Hd / 2, cx = -side * w / 2, fw = .075;
  box(w, Hd, .012, edenPanel, cx, cy, -.012, g);                                                       // pannello incassato
  box(w, fw, .036, eden, cx, cy + Hd / 2 - fw / 2, 0, g); box(w, fw, .036, eden, cx, cy - Hd / 2 + fw / 2, 0, g);   // traverse
  box(fw, Hd - 2 * fw, .036, eden, cx + w / 2 - fw / 2, cy, 0, g); box(fw, Hd - 2 * fw, .036, eden, cx - w / 2 + fw / 2, cy, 0, g); // montanti
  box(w - 2 * fw + .01, Hd - 2 * fw + .01, .008, eden, cx, cy, .002, g);                               // cornice interna (profilo)
  const hx = -side * (w - fw / 2 - .005);
  cyl(.009, .26, brass, hx, cy, .062, g); cyl(.005, .035, brass, hx, cy + .11, .045, g).rotation.x = Math.PI / 2; cyl(.005, .035, brass, hx, cy - .11, .045, g).rotation.x = Math.PI / 2;
  box(.03, .07, .016, brass, 0, cy + Hd * .36, .006, g); box(.03, .07, .016, brass, 0, cy - Hd * .36, .006, g);       // cerniere
  return { g, side };
});
const wLight = new THREE.PointLight(0xffe0aa, 0, 2.6, 2); wLight.position.set(WG.position.x - .3, 2.0, WG.position.z + .25); scene.add(wLight);
const wLight2 = new THREE.PointLight(0xffe0aa, 0, 2.2, 2); wLight2.position.set(WG.position.x - .2, 1.0, WG.position.z + .3); scene.add(wLight2);

// specchio (riflesso reale)
const mirror = new Reflector(new THREE.PlaneGeometry(.85, 1.75), { clipBias: .003, textureWidth: 512, textureHeight: 512, color: 0xb8aeb4 }); mirror.position.set(.5, 1.15, -1.965); scene.add(mirror);
[[0, .9, .95, .05], [0, -.9, .95, .05], [-.45, 0, .05, 1.85], [.45, 0, .05, 1.85]].forEach(([x, y, w, h]) => box(w, h, .05, brass, .5 + x, 1.15 + y, -1.95));

// lampada, pianta
const lampBase = cyl(.12, .03, dark, -1.7, .015, -1.3); cyl(.012, 1.5, brass, -1.7, .78, -1.3);
const shade = new THREE.Mesh(new THREE.CylinderGeometry(.14, .22, .3, 32, 1, true), new THREE.MeshStandardMaterial({ color: 0xFAE59B, emissive: 0xFAE59B, emissiveIntensity: 1.3, side: THREE.DoubleSide, roughness: .9 })); shade.position.set(-1.7, 1.6, -1.3); shade.castShadow = false; scene.add(shade);
const lamp = new THREE.PointLight(0xffb866, 6, 5, 2); lamp.position.set(-1.7, 1.5, -1.3); scene.add(lamp);
const plant = new THREE.Group(); plant.position.set(-2.5, 0, -1.45); scene.add(plant);
cyl(.2, .34, new THREE.MeshStandardMaterial({ color: 0xD08C7C, roughness: .8 }), 0, .17, 0, plant);
const leafM = new THREE.MeshStandardMaterial({ color: 0x19615C, roughness: .6, side: THREE.DoubleSide });
for (let i = 0; i < 16; i++) { const l = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), leafM); l.scale.set(.05, .26, .012); const a = i / 16 * Math.PI * 2; l.position.set(Math.cos(a) * .1, .55 + (i % 3) * .08, Math.sin(a) * .1); l.rotation.set(Math.sin(a) * .7, 0, -Math.cos(a) * .7); l.castShadow = true; plant.add(l); }

// scatola "Seconda vita"
const BOX = new THREE.Vector3(1.75, .28, .3); const cardboard = new THREE.MeshStandardMaterial({ color: 0xD08C7C, roughness: .9 });
const cb = new THREE.Group(); cb.position.set(BOX.x, 0, BOX.z); cb.rotation.y = -.25; scene.add(cb);
box(.56, .02, .42, cardboard, 0, .01, 0, cb); box(.56, .28, .02, cardboard, 0, .15, .2, cb); box(.56, .28, .02, cardboard, 0, .15, -.2, cb); box(.02, .28, .42, cardboard, .27, .15, 0, cb); box(.02, .28, .42, cardboard, -.27, .15, 0, cb);
const lab = new THREE.CanvasTexture(cv(512, 256, (x, w, h) => { x.fillStyle = '#FFFCF7'; x.fillRect(0, 0, w, h); x.fillStyle = '#6B1937'; x.font = '700 72px Georgia, serif'; x.textAlign = 'center'; x.fillText('Relook', w / 2, 110); x.font = '500 40px Helvetica, Arial'; x.fillStyle = '#2a0a16'; x.fillText('Seconda vita', w / 2, 180); })); lab.colorSpace = THREE.SRGBColorSpace;
const lbl = new THREE.Mesh(new THREE.PlaneGeometry(.36, .18), new THREE.MeshStandardMaterial({ map: lab, roughness: .8 })); lbl.position.set(0, .15, .212); cb.add(lbl);

// occlusione ambientale "finta": ombre di contatto e gradienti sugli spigoli (poco costosi, molto realistici)
const blobTex = new THREE.CanvasTexture(cv(128, 128, x => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(0,0,0,.6)'); g.addColorStop(.55, 'rgba(0,0,0,.22)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); }));
const decal = (map, w, h, o = 1) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, opacity: o, fog: false }));
const blob = (x, z, w, d, o = 1, y = .004) => { const m = decal(blobTex, w, d, o); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); scene.add(m); };
const aoTex = new THREE.CanvasTexture(cv(4, 128, x => { const g = x.createLinearGradient(0, 128, 0, 0); g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 4, 128); }));
const aoBack = decal(aoTex, 18, .8); aoBack.position.set(.3, .4, -1.99); scene.add(aoBack);
const aoLeft = decal(aoTex, 7, .8); aoLeft.rotation.y = Math.PI / 2; aoLeft.position.set(-3.19, .4, .5); scene.add(aoLeft);
blob(1.9, -1.45, 2.9, 1.5, .95); blob(.75, -.1, 1.3, 1.3, .9, .01); blob(1.75, .3, .9, .8, .8); blob(-1.7, -1.3, .8, .8, .8); blob(-2.5, -1.45, .9, .9, .8);
// tende (Mauve) con pieghe + bastone
const curtain = z => { const g = new THREE.PlaneGeometry(.55, 2.7, 32, 1), p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 24) * .035); g.computeVertexNormals(); const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xD08C7C, roughness: .92, side: THREE.DoubleSide })); m.rotation.y = Math.PI / 2; m.position.set(-3.13, 1.5, z); m.castShadow = true; scene.add(m); };
curtain(-1.0); curtain(1.2); const rod = cyl(.012, 3.2, brass, -3.1, 2.86, .1); rod.rotation.x = Math.PI / 2;
// quadri
const art = (x, y, w, h, c1, c2, c3) => { const tx = new THREE.CanvasTexture(cv(256, Math.round(256 * h / w), (g, W2, H2) => { g.fillStyle = c1; g.fillRect(0, 0, W2, H2); g.fillStyle = c2; g.beginPath(); g.arc(W2 * .38, H2 * .42, W2 * .22, 0, 7); g.fill(); g.strokeStyle = c3; g.lineWidth = W2 * .05; g.beginPath(); g.arc(W2 * .62, H2 * .62, W2 * .26, Math.PI, Math.PI * 2); g.stroke(); })); tx.colorSpace = THREE.SRGBColorSpace; const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tx, roughness: .8 })); m.position.set(x, y, -1.955); scene.add(m); box(w + .06, h + .06, .03, brass, x, y, -1.975); };
art(-.85, 1.85, .55, .7, '#FFFCF7', '#123463', '#D08C7C'); art(-1.65, 1.55, .38, .38, '#FAE59B', '#19615C', '#6B1937');

// luci
const ceil = new THREE.Mesh(new THREE.PlaneGeometry(18, 9), creamWall); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 3.2, .5); scene.add(ceil);
scene.add(new THREE.HemisphereLight(0xfff6ec, 0x2a2450, .5));
const sun = new THREE.SpotLight(0xfff0d8, 150, 16, .62, .85, 2); sun.position.set(-3.0, 2.4, .4); sun.target.position.set(1.4, .5, -.6); scene.add(sun, sun.target);
sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -.0003; sun.shadow.normalBias = .03; sun.shadow.radius = 4; sun.shadow.camera.near = .5; sun.shadow.camera.far = 14; sun.map = gobo;


// ---- riflessi e luce "da render" ----
const dotC = cv(64, 64, (x) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, '#fff'); g.addColorStop(.4, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); });
// pavimento lucido: riflessione a bassa risoluzione (morbida) mescolata al parquet
const FS = Reflector.ReflectorShader;
const floorRefl = new Reflector(new THREE.PlaneGeometry(18, 9), { clipBias: .003, textureWidth: 512, textureHeight: 512, color: 0xffffff,
  shader: { ...FS, fragmentShader: FS.fragmentShader.replace('gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );', 'gl_FragColor = vec4( base.rgb * color, .05 );') } });
floorRefl.rotation.x = -Math.PI / 2; floorRefl.position.set(0, .003, .5); floorRefl.material.transparent = true; floorRefl.material.depthWrite = false; scene.add(floorRefl);
let fr = 0;
const alternate = (r, other, phase) => { const o = r.onBeforeRender; r.onBeforeRender = function (...a) { if ((fr + phase) % 2) return; other.visible = false; o.apply(this, a); other.visible = true; }; };
alternate(mirror, floorRefl, 0); alternate(floorRefl, mirror, 1);
// luce morbida dalla finestra (area light) + raggi di luce + aloni
const winLight = new THREE.RectAreaLight(0xfff0d8, 7, 1.7, 1.7); winLight.position.set(-3.05, 1.75, .1); winLight.lookAt(1.5, 1.1, -.3); scene.add(winLight);
const glowTex = new THREE.CanvasTexture(dotC);
const glow = (x, y, z, size, col, o) => { const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: col, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: o, fog: false })); g.position.set(x, y, z); g.scale.setScalar(size); scene.add(g); return g; };
glow(-1.7, 1.6, -1.3, 1.5, 0xffb866, .75); glow(-3.0, 1.75, .1, 3.2, 0xfff0d0, .5);
const shaftTex = new THREE.CanvasTexture(cv(64, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,235,200,0)'); g.addColorStop(.55, 'rgba(255,235,200,.35)'); g.addColorStop(.92, 'rgba(255,235,200,.95)'); g.addColorStop(1, 'rgba(255,235,200,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); const gx = x.createLinearGradient(0, 0, w, 0); gx.addColorStop(0, 'rgba(0,0,0,0)'); gx.addColorStop(.5, 'rgba(0,0,0,1)'); gx.addColorStop(1, 'rgba(0,0,0,0)'); x.globalCompositeOperation = 'destination-in'; x.fillStyle = gx; x.fillRect(0, 0, w, h); }));
const shaftM = new THREE.MeshBasicMaterial({ map: shaftTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: .16, color: 0xffe3b0, side: THREE.DoubleSide, fog: false });
[[.1, 1.9, .1, 1.1, .2, -.5, .9], [-.4, 2.1, .6, 1.4, .1, .3, .6], [.5, 1.5, -.5, .8, .3, -1, .5]].forEach(([oy, sy, sz, tx, ty, tz, w]) => {
  const src = new THREE.Vector3(-3.1, sy, sz), dst = new THREE.Vector3(tx + 1.2, ty, tz), dir = dst.clone().sub(src), L = dir.length(), g = new THREE.Group();
  g.position.copy(src.clone().add(dst).multiplyScalar(.5)); g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize().negate());
  [0, Math.PI / 2].forEach(r => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, L), shaftM); m.rotation.y = r; g.add(m); }); scene.add(g);
});

// polvere nell'aria
const NP = 110, pp = new Float32Array(NP * 3), pseed = []; for (let i = 0; i < NP; i++) { pp.set([lerp(-3, 2.5, Math.random()), lerp(.2, 2.6, Math.random()), lerp(-1.6, 2, Math.random())], i * 3); pseed.push(Math.random() * 6.28); }
const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
const dust = new THREE.Points(pg, new THREE.PointsMaterial({ size: .035, map: new THREE.CanvasTexture(dotC), transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffe3b0 })); scene.add(dust);

// ---------- geometrie capi (costruite sul profilo del manichino) ----------
const PROF = [[-3, 1.69], [-1, 1.69], [-.5, 1.63], [0, 1.5], [.5, 1.34], [1, 1.31], [1.5, 1.42], [2, 1.57], [2.5, 1.74], [3, 1.86], [3.5, 1.92], [4, 1.8], [4.5, .65]];
const R = y => { if (y <= PROF[0][0]) return PROF[0][1]; for (let i = 1; i < PROF.length; i++) if (y <= PROF[i][0]) { const [y0, r0] = PROF[i - 1], [y1, r1] = PROF[i]; return r0 + (r1 - r0) * (y - y0) / (y1 - y0); } return .6; };
const lathe = (y0, y1, f, m, arc = Math.PI * 2, n = 40) => { const pts = []; for (let i = 0; i <= n; i++) { const y = y0 + (y1 - y0) * i / n; pts.push(new THREE.Vector2(f(y, i / n), y)); } const o = new THREE.Mesh(new THREE.LatheGeometry(pts, 72, (Math.PI * 2 - arc) / 2, arc), m); o.castShadow = o.receiveShadow = true; return o; };
const circ = r => Math.PI * 2 * r;
const top = (m, y0 = .1) => lathe(y0, 4.12, y => R(y) + .07, m);
const skirt = (m, yTop = 1.0) => lathe(yTop, -4.05, (y, tt) => Math.max(R(Math.max(y, -3)), 1.3) + .14 + 1.1 * Math.pow(tt, 1.4), m);
const beltM = c => new THREE.MeshStandardMaterial({ color: c, roughness: .5, metalness: .05 });
const belt = (y, c) => { const o = new THREE.Mesh(new THREE.TorusGeometry(R(y) + .2, .09, 12, 64), beltM(c)); o.rotation.x = Math.PI / 2; o.position.y = y; o.castShadow = true; return o; };
const fk = (k, c, o) => fabric(k, c, { circ: circ(1.7), h: 4, ...o });

const ITEMS = [
  { id: 'maglia', name: 'Maglia corallo', slot: 'upper', days: 3, hang: 4.12, build: () => [top(fk('knit', '#D08C7C'))] },
  { id: 'mariniere', name: 'Marinière', slot: 'upper', days: 12, hang: 4.12, build: () => [top(fk('knit', '#FFFCF7', { alt: '#0D0129', bands: 4, cell: 4 }))] },
  { id: 'tee', name: 'T-shirt avorio', slot: 'upper', days: 5, hang: 4.12, build: () => [top(fk('knit', '#FFFCF7'))] },
  { id: 'top', name: 'Top rosa a coste', slot: 'upper', days: 95, hang: 4.12, build: () => [top(fk('rib', '#FAE59B', { h: 3.9 }), .2)] },
  { id: 'abito', name: 'Abito menta', slot: 'dress', days: 150, hang: 4.12, build: () => [top(fk('satin', '#19615C', { h: 4.5, cell: 3 }), -.4), skirt(fabric('satin', '#19615C', { circ: circ(2.2), h: 5, cell: 3 })), belt(1.05, '#FAE59B')] },
  { id: 'gonna', name: 'Gonna viola', slot: 'lower', days: 20, hang: 1.0, build: () => [skirt(fabric('weave', '#6B1937', { circ: circ(2.2), h: 5, cell: 1.8 })), belt(1.05, '#FAE59B')] },
  { id: 'cappotto', name: 'Cappotto cobalto', slot: 'coat', days: 8, hang: 4.55, build: () => [lathe(-3.4, 4.55, y => R(y) + .3, fabric('twill', '#123463', { circ: circ(2), h: 8, cell: 1.2 }), Math.PI * 2 - .9)] },
];
const GHOST = { id: 'ghost', name: 'Giacca leggera', hang: 4.1, build: () => [lathe(-1.2, 4.1, y => R(y) + .2, new THREE.MeshPhysicalMaterial({ color: 0xFAE59B, emissive: 0xFAE59B, emissiveIntensity: .55, transparent: true, opacity: .42, depthWrite: false, side: THREE.DoubleSide, roughness: .4 }), Math.PI * 2 - .9)] };

// appendiabiti
const hangerG = (() => { const pts = [[-.2, 0], [0, .075], [.2, 0], [-.2, 0]].map(([x, y]) => new THREE.Vector3(x, y, 0)), path = new THREE.CurvePath(); for (let i = 0; i < 3; i++) path.add(new THREE.LineCurve3(pts[i], pts[i + 1])); return new THREE.TubeGeometry(path, 24, .0045, 6, false); })();
const makeHanger = () => { const g = new THREE.Group(); const b = new THREE.Mesh(hangerG, dark); b.castShadow = true; g.add(b); const hk = new THREE.Mesh(new THREE.TorusGeometry(.018, .0035, 6, 16, Math.PI * 1.5), brass); hk.position.set(0, .093, 0); hk.rotation.z = Math.PI * .1; g.add(hk); return g; };

// ---------- posizionamento sulla barra ----------
const RX0 = WG.position.x - W / 2 + .1, RSP = .125, RZ = WG.position.z, BAR_Y = RAIL_Y - .11;
const all = [...ITEMS, GHOST];
all.forEach((it, i) => {
  it.holder = new THREE.Group(); it.build().forEach(m => it.holder.add(m)); it.holder.userData.item = it;
  it.hanger = makeHanger(); it.rx = RX0 + i * RSP; it.hangY = BAR_Y; it.ry = BAR_Y - it.hang * S + .015;
  it.hanger.position.set(it.rx, it.hangY, RZ); scene.add(it.hanger, it.holder);
  it.where = 'rail'; it.t = 1; it.h = 0; it.hv = 0; it.vis = it === GHOST ? 0 : 1; it.mats = []; it.holder.traverse(o => { if (o.isMesh && o.material.emissive && it !== GHOST) it.mats.push(o.material); });
  it.holder.position.set(it.rx, it.ry, RZ); it.holder.scale.set(S, S, S * .3); it.holder.rotation.y = -1.42;
});
GHOST.hanger.visible = GHOST.holder.visible = false;

// ---------- manichino ----------
const M = new THREE.Group(); M.position.set(.75, 5.07 * S, -.1); M.scale.setScalar(S); scene.add(M);
const mannMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: .42, metalness: 0, clearcoat: .45, clearcoatRoughness: .3, bumpMap: peel, bumpScale: .03 });
const standG = new THREE.LatheGeometry([[0, 0], [.47, 0], [.48, .008], [.48, .03], [.465, .04], [0, .04]].map(([r, y]) => new THREE.Vector2(r, y)), 64);
const stand = new THREE.Mesh(standG, walnutGloss); stand.position.set(M.position.x, .002, M.position.z); stand.castShadow = stand.receiveShadow = true; scene.add(stand);
let mannLoaded = false, mannScale = 0;
fetch('assets/mannequin.bin').then(r => r.arrayBuffer()).then(buf => {      // mesh binario compatto (1 MB invece di 7,6 MB di OBJ)
  const [nv, ni] = new Uint32Array(buf, 0, 2), g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(buf, 8, nv * 3), 3));
  g.setIndex(new THREE.BufferAttribute(new Uint16Array(buf, 8 + nv * 12, ni), 1)); g.computeVertexNormals();
  const pa = g.attributes.position, col = new Float32Array(nv * 3), yel = new THREE.Color(0xFAE59B), wood = new THREE.Color(0x450D1D), c = new THREE.Color();   // corpo giallo, piede e tappo in noce
  for (let i = 0; i < nv; i++) { const y = pa.getY(i); c.copy(y < -3.15 || y > 4.85 ? wood : yel); col.set([c.r, c.g, c.b], i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(nv * 2).map((_, i) => i % 2 ? pa.getY(i >> 1) * .5 : Math.atan2(pa.getZ(i >> 1), pa.getX(i >> 1)) * .8), 2));
  const o = new THREE.Mesh(g, mannMat); o.castShadow = o.receiveShadow = true; M.add(o); mannLoaded = true; loadEl?.classList.add('gone');
});

// ---------- stato interattivo ----------
const state = { mode: 'wear', donated: 0, interactive: false, auto: false };
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
const outfitText = () => { const w = worn(); return w.length ? 'Indossi: ' + w.map(i => i.name).join(' + ') + '.' : 'Il manichino è libero: scegli un capo.'; };
const wear = (it, on = true) => {
  if (!on) return go(it, 'rail');
  ITEMS.filter(o => o.where === 'worn' && (o.slot === it.slot || (it.slot === 'dress' && (o.slot === 'upper' || o.slot === 'lower')) || (o.slot === 'dress' && (it.slot === 'upper' || it.slot === 'lower')))).forEach(o => go(o, 'rail'));
  go(it, 'worn');
};
const TXT = {
  wear: () => outfitText() + ' Passa sui capi e clicca per provarli: niente acquisti, solo ciò che hai già.',
  unused: () => `I bollini gialli indicano i capi fermi da oltre 60 giorni. Clicca per dare loro una seconda vita. Donati: ${state.donated}.`,
  missing: () => 'Il capo trasparente è quello che ti manca davvero: con una giacca leggera sblocchi 6 outfit in più. Compra solo questo.',
};
const refresh = () => { rinfo.textContent = TXT[state.mode](); tagsEl.classList.toggle('on', state.mode === 'unused'); GHOST.target = state.mode === 'missing' ? 1 : 0; document.querySelectorAll('.modes button').forEach(b => b.classList.toggle('on', b.dataset.mode === state.mode)); };
document.querySelectorAll('.modes button').forEach(b => b.addEventListener('click', () => { state.mode = b.dataset.mode; refresh(); }));
$('#shuffle').addEventListener('click', () => {
  worn().forEach(i => go(i, 'rail')); const pick = a => a[Math.floor(Math.random() * a.length)], av = k => ITEMS.filter(i => i.slot === k && i.where === 'rail');
  setTimeout(() => { if (Math.random() < .35 && av('dress').length) wear(pick(av('dress'))); else { const u = av('upper'); if (u.length) wear(pick(u)); if (Math.random() < .7 && av('lower').length) wear(av('lower')[0]); } if (Math.random() < .5 && av('coat').length) wear(av('coat')[0]); refresh(); }, 250);
});
$('#reset').addEventListener('click', () => { ITEMS.forEach(i => { i.holder.visible = true; go(i, 'rail'); if (i.where === 'rail' && i.t >= 1) { i.t = 1; } }); state.donated = 0; refresh(); });
ITEMS.forEach(i => { i.el = null; if (i.days > 60) { const e = document.createElement('div'); e.className = 'tag'; e.textContent = i.days + ' g'; tagsEl.appendChild(e); i.el = e; } });
refresh();

// ---------- puntatore ----------
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), mouse = { x: 0, y: 0, px: 0, py: 0 };
let hover = null, drag = null, spinOff = 0, spinVel = 0;
const pick = () => { ray.setFromCamera(ndc, camera); const hs = all.filter(i => i.holder.visible && i.t >= 1 && (i !== GHOST || state.mode === 'missing')).map(i => i.holder); const h = ray.intersectObjects(hs, true)[0]; return h ? (h.object.parent?.userData.item || h.object.parent?.parent?.userData.item) : null; };
const pickMann = () => { ray.setFromCamera(ndc, camera); return ray.intersectObject(M, true).length > 0; };
stage.addEventListener('pointermove', e => {
  const r = stage.getBoundingClientRect(); mouse.px = e.clientX - r.left; mouse.py = e.clientY - r.top;
  ndc.set(mouse.px / r.width * 2 - 1, -(mouse.py / r.height) * 2 + 1); mouse.x = ndc.x; mouse.y = ndc.y;
  if (drag && drag.onM) { const dx = e.clientX - drag.x; drag.moved += Math.abs(dx); spinOff += dx * .01; spinVel = dx * .01 / .016 * .35; drag.x = e.clientX; }
});
stage.addEventListener('pointerenter', () => mouse.in = true);
stage.addEventListener('pointerleave', () => { mouse.in = false; hover = null; });
stage.addEventListener('pointerdown', e => { if (!state.interactive) return; drag = { x: e.clientX, moved: 0, onM: pickMann() }; stage.setPointerCapture(e.pointerId); });
stage.addEventListener('pointerup', e => {
  const d = drag; drag = null; if (!state.interactive || !d || d.moved > 6) return;
  const it = pick(); if (!it) return;
  if (it === GHOST) { rinfo.textContent = 'Giacca leggera · ti manca per 6 outfit. Compra solo questo, il resto lo hai già.'; return; }
  if (state.mode === 'unused') { if (it.days > 60 && it.where === 'rail') { go(it, 'box'); state.donated++; refresh(); } else if (it.where === 'worn') { go(it, 'rail'); } return; }
  wear(it, it.where !== 'worn'); refresh();
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
const progress = () => { const r = hero.getBoundingClientRect(), range = r.height - pin.clientHeight; return clamp((68 - r.top) / range); };
const caps = ['#c1', '#c2', '#c3', '#c4'].map(s => $(s)), rbar = $('#rbar'), cue = $('.cue'), pbar = $('.pbar');
const setCap = (el, o, y = 0) => { el.style.opacity = o.toFixed(3); el.style.translate = `0 ${((1 - o) * 26 + y).toFixed(1)}px`; el.style.visibility = o < .01 ? 'hidden' : 'visible'; };

// ---------- dimensioni ----------
const resize = () => { const w = stage.clientWidth, h = stage.clientHeight; if (!w) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w / h < 1.2 ? Math.min(62, 34 * Math.pow(1.2 / (w / h), .75)) : 34; camera.updateProjectionMatrix(); };
new ResizeObserver(resize).observe(stage); resize();
let vis = true; new IntersectionObserver(e => vis = e[0].isIntersecting, { rootMargin: '100px' }).observe(hero);

// ---------- loop ----------
const clock = new THREE.Clock(), v3 = new THREE.Vector3(), look = new THREE.Vector3();
renderer.setAnimationLoop(() => {
  if (!vis) return; fr++;
  const dt = Math.min(.05, clock.getDelta()), T = clock.elapsedTime, k = f => 1 - Math.exp(-dt * f);
  P = progress(); Ps += (P - Ps) * k(reduce ? 30 : 7);
  fan = ss(.4, .66, Ps);
  // camera
  const [cp, cl] = camAt(Ps), w = clamp((1.5 - camera.aspect) / .7);
  cp[0] += mouse.x * .25; cp[1] += mouse.y * .08; cl[0] = lerp(cl[0], cp[0] + .5, w * .6);
  camera.position.set(...cp); look.set(...cl); camera.lookAt(look);
  // ante + luci interne
  const d = ss(.1, .4, Ps); doors.forEach(({ g, side }) => g.rotation.y = side * d * 1.85);
  const lt = ss(.12, .42, Ps); wLight.intensity = 3.5 * lt; wLight2.intensity = 2.4 * lt; led.material.color.setScalar(lerp(.25, 1, lt));
  lamp.intensity = 6 + Math.sin(T * 7) * .12; sun.intensity = 150 * (.8 + .2 * ss(0, .2, Ps));
  // interattività
  state.interactive = Ps > .8; const ui = ss(.78, .88, Ps);
  rbar.style.opacity = ui; rbar.style.pointerEvents = ui > .6 ? 'auto' : 'none'; rbar.style.translate = `0 ${(1 - ui) * 24}px`;
  setCap(caps[0], 1 - ss(.03, .12, Ps)); setCap(caps[1], ss(.17, .24, Ps) * (1 - ss(.36, .43, Ps))); setCap(caps[2], ss(.47, .54, Ps) * (1 - ss(.66, .73, Ps))); setCap(caps[3], ss(.8, .88, Ps));
  cue.style.opacity = 1 - ss(.01, .06, Ps); pbar.style.setProperty('--p', Ps.toFixed(4)); hero.style.setProperty('--p', Ps);
  // auto: al termine dell'apertura il manichino si veste con un capo preso dalla barra
  if (Ps > .84 && !state.auto && mannLoaded) { state.auto = true; wear(ITEMS[0]); wear(ITEMS[5]); refresh(); }
  // manichino
  mannScale += ((mannLoaded ? 1 : 0) - mannScale) * k(4);
  if (!drag) { spinOff += spinVel * dt; spinVel *= Math.exp(-dt * 2.2); }
  M.rotation.y = (reduce ? 0 : Math.sin(T * .35) * .5) + spinOff;
  M.position.y = 5.07 * S + (mannLoaded ? 0 : -.3); M.scale.setScalar(S * (.6 + .4 * mannScale));
  // hover
  if (state.interactive && !drag && mouse.in) { hover = pick(); stage.style.cursor = hover ? 'pointer' : (pickMann() ? 'grab' : 'default'); } else if (drag) stage.style.cursor = 'grabbing'; else { if (!mouse.in) hover = null; stage.style.cursor = 'default'; }
  all.forEach(it => {
    const on = it === hover && it.where === 'rail' && it.t >= 1;
    it.h += ((on ? 1 : 0) - it.h) * k(9);
    if (it === GHOST) { const tg = GHOST.target || 0; it.vis += (tg - it.vis) * k(5); it.holder.visible = it.hanger.visible = it.vis > .02; it.holder.children.forEach(m => { m.material.opacity = (.3 + Math.sin(T * 3) * .1) * it.vis; }); }
    const hv = it === hover; it.mats.forEach(m => m.emissive.setScalar(hv ? .12 : 0));
    if (!it.holder.visible) return;
    const pose = poseOf(it);
    if (it.t < 1) { it.t = Math.min(1, it.t + dt / .95); const e = ease(it.t); it.holder.position.lerpVectors(it.from.pos, pose.pos, e); it.holder.position.y += Math.sin(e * Math.PI) * (it.where === 'box' ? .25 : .5); it.holder.quaternion.slerpQuaternions(it.from.q, pose.q, e); it.holder.scale.lerpVectors(it.from.s, pose.s, e); if (it.t >= 1 && it.where === 'box') it.holder.visible = false; }
    else { it.holder.position.copy(pose.pos); it.holder.quaternion.copy(pose.q); it.holder.scale.copy(pose.s); if (it.where === 'rail') it.holder.position.x += Math.sin(T * 1.2 + it.rx * 9) * .002; }
    const h = it.where === 'rail' && it.t >= 1 ? it.h : 0; it.hanger.position.z += (RZ + h * .45 - it.hanger.position.z) * k(14); it.hanger.rotation.y = it.where === 'rail' ? lerp(lerp(-1.42, -.5, fan), -.1, h) : it.hanger.rotation.y;
  });
  // bollini "non lo metti da…"
  const cw = stage.clientWidth, ch = stage.clientHeight;
  ITEMS.forEach(it => { if (!it.el) return; const show = state.mode === 'unused' && state.interactive && it.where === 'rail' && it.holder.visible; it.el.style.opacity = show ? 1 : 0; if (!show) return; v3.set(it.rx, it.hangY + .16, RZ + it.h * .45).project(camera); it.el.style.transform = `translate(${(v3.x * .5 + .5) * cw}px,${(-v3.y * .5 + .5) * ch}px) translate(-50%,-100%)`; });
  // tooltip
  if (hover && state.interactive) { tip.style.opacity = 1; tip.style.transform = `translate(${mouse.px + 18}px,${mouse.py + 14}px)`; const idle = hover.days; tip.innerHTML = hover === GHOST ? `<b>${hover.name}</b>Ti manca per 6 outfit` : `<b>${hover.name}</b>${idle > 60 ? `<i>Fermo da ${idle} giorni</i>` : `Ultima volta: ${idle} giorni fa`}<br>${hover.where === 'worn' ? 'Clicca per toglierlo' : state.mode === 'unused' ? (idle > 60 ? 'Clicca: seconda vita' : 'Lo usi spesso') : 'Clicca per provarlo'}`; } else tip.style.opacity = 0;
  // polvere
  const pa = pg.attributes.position; for (let i = 0; i < NP; i++) { pa.array[i * 3] += Math.sin(T * .2 + pseed[i]) * .0006; pa.array[i * 3 + 1] += Math.cos(T * .15 + pseed[i]) * .0004 + .00008; if (pa.array[i * 3 + 1] > 2.7) pa.array[i * 3 + 1] = .2; } pa.needsUpdate = true;
  renderer.render(scene, camera);
});
