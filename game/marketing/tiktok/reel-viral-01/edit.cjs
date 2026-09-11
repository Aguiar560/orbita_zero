// Montagem vertical final. A fonte é somente gameplay-viral-01.webm, gravado
// do zero no build local atual. O frame inteiro é desenhado uma vez: não há
// fundo duplicado, faixa recortada ou screenshot ampliado por cima de si mesmo.
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { once } = require('events');
const { createCanvas, loadImage, GlobalFonts } = require('C:/Users/aguia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');

GlobalFonts.registerFromPath('C:/Windows/Fonts/arialbd.ttf', 'Title');
GlobalFonts.registerFromPath('C:/Windows/Fonts/arial.ttf', 'Body');

const dir = __dirname;
const ffmpeg = 'D:/bbb/.media-tools/package/ffmpeg.exe';
const source = path.join(dir, 'gameplay-viral-01.webm');
const voice = path.join(dir, 'narracao-ptbr.mp3');
const W = 1080;
const H = 1920;
const FPS = 30;

const shots = [
  { id: 'hook', source: 'falha-no-chefe', media: 0.18, dur: 1.30, accent: '#ffca64', title: 'ESSE JOGO JOGA SOZINHO.', sub: '' },
  { id: 'pressure', source: 'falha-no-chefe', media: 1.48, dur: 1.40, accent: '#ff6a72', title: 'MAS NÃO VENCE SOZINHO.', sub: '' },
  { id: 'failure', source: 'falha-no-chefe', media: 2.88, dur: 1.70, accent: '#ff6a72', title: 'A IA NÃO ERROU.', sub: 'MINHA BUILD ERROU.' },
  { id: 'build-read', source: 'ajuste-de-build', media: 0.25, dur: 2.80, accent: '#66e6ff', title: 'EU IGNOREI O ELEMENTO.', sub: 'A GALÁXIA AVISOU.' },
  { id: 'build-change', source: 'ajuste-de-build', media: 3.05, dur: 2.10, accent: '#79ff4b', title: 'MUDEI A ESTRATÉGIA.', sub: 'UMA PEÇA. OUTRA RESPOSTA.' },
  { id: 'drop', source: 'chave-caindo', media: 0.70, dur: 2.50, accent: '#ffb13b', title: 'UMA CHAVE CAIU', sub: 'DO INIMIGO.' },
  { id: 'access', source: 'confirmacao-da-chave', media: 0.10, dur: 2.40, accent: '#63ddff', title: '1 CHAVE. 1 TENTATIVA.', sub: 'A ENTRADA CONSUME A CHAVE.' },
  { id: 'entry', source: 'tentativa-vitoriosa', media: 0.05, dur: 3.00, accent: '#63ddff', title: 'AGORA EU TINHA UM PLANO.', sub: '' },
  { id: 'fight', source: 'tentativa-vitoriosa', media: 3.05, dur: 3.40, accent: '#ffca64', title: '', sub: '' },
  // O card real de vitória entra no fim do take, depois da explosão do chefe.
  { id: 'victory', source: 'tentativa-vitoriosa', media: 8.70, dur: 2.70, accent: '#79ff4b', title: 'CHEFE DERROTADO.', sub: '' },
  { id: 'map', source: 'mapa-galactico', media: 0.15, dur: 2.40, accent: '#63ddff', title: '30 GALÁXIAS · 300 SETORES', sub: '' },
  { id: 'cta', source: 'gameplay-cta', media: 0.25, dur: 4.30, accent: '#63ddff', title: 'SUA NAVE LUTA.', sub: 'AS DECISÕES SÃO SUAS.' },
];

const clipIndex = new Map(JSON.parse(fs.readFileSync(path.join(dir, 'clips.json'), 'utf8')).clips.map((clip) => [clip.name, clip]));
for (const shot of shots) {
  const clip = clipIndex.get(shot.source);
  if (!clip) throw new Error(`Clipe ${shot.source} não existe em clips.json`);
  shot.sourceStart = clip.start + shot.media;
}

let elapsed = 0;
for (const shot of shots) { shot.start = elapsed; elapsed += shot.dur; }
if (Math.abs(elapsed - 30) > 0.001) throw new Error(`Timeline deve somar 30s; somou ${elapsed}`);

const canvas = createCanvas(W, H);
const c = canvas.getContext('2d');
const previous = createCanvas(W, H);
const p = previous.getContext('2d');
const boardCanvas = createCanvas(1350, 1536);
const board = boardCanvas.getContext('2d');
const framesRoot = path.join(dir, 'tmp-frames');
const loaded = new Map();

const clamp = (n) => Math.max(0, Math.min(1, n));
const smooth = (n) => { const x = clamp(n); return x * x * (3 - 2 * x); };
const ease = (n) => 1 - Math.pow(1 - clamp(n), 3);

function framePath(shot, index) {
  return path.join(framesRoot, shot.id, `${String(index + 1).padStart(5, '0')}.jpg`);
}

function sourceFramePath(shot, index) {
  return framePath(shot, index);
}

function decodeFrames() {
  for (const shot of shots) {
    const folder = path.join(framesRoot, shot.id);
    const count = Math.ceil(shot.dur * FPS);
    fs.mkdirSync(folder, { recursive: true });
    const result = spawnSync(ffmpeg, [
      '-y', '-hide_banner', '-loglevel', 'error', '-ss', String(shot.sourceStart), '-i', source,
      '-t', String(shot.dur + 0.06), '-vf', `fps=${FPS}`, '-q:v', '2', path.join(folder, '%05d.jpg'),
    ], { windowsHide: true });
    if (result.status !== 0) throw new Error(result.stderr?.toString() || `Falha ao decodificar ${shot.id}`);
    const files = fs.readdirSync(folder).filter((file) => file.endsWith('.jpg')).sort();
    if (!files.length) throw new Error(`Nenhum frame para ${shot.id}`);
    for (let i = files.length; i < count; i++) fs.copyFileSync(path.join(folder, files.at(-1)), framePath(shot, i));
  }
}

async function imageFor(shot, index) {
  const key = `${shot.id}:${index}`;
  const cached = loaded.get(key);
  if (cached) return cached;
  const img = await loadImage(fs.readFileSync(sourceFramePath(shot, Math.min(index, Math.ceil(shot.dur * FPS) - 1))));
  loaded.set(key, img);
  return img;
}

function fitFull(img) {
  // 720×1280 e 1080×1920 têm exatamente a mesma proporção. O frame inteiro
  // entra sem cover(), sem zoom e sem cortar interface nas bordas.
  c.drawImage(img, 0, 0, W, H);
}

function font(size, family = 'Title') { c.font = `${size}px ${family}`; }

function text(str, x, y, size, color = '#f5fbff', align = 'left', family = 'Title') {
  font(size, family);
  c.textAlign = align;
  c.textBaseline = 'top';
  c.fillStyle = color;
  c.fillText(str, x, y);
}

function lineBreak(str, maxWidth, size, family = 'Title') {
  font(size, family);
  const words = str.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (c.measureText(next).width > maxWidth && line) { lines.push(line); line = word; }
    else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function topWash(alpha = 0.82) {
  const g = c.createLinearGradient(0, 0, 0, 530);
  g.addColorStop(0, `rgba(2,7,17,${alpha})`);
  g.addColorStop(0.74, 'rgba(2,7,17,0.26)');
  g.addColorStop(1, 'rgba(2,7,17,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, W, 530);
}

function lowerWash() {
  const g = c.createLinearGradient(0, 1490, 0, H);
  g.addColorStop(0, 'rgba(2,7,17,0)');
  g.addColorStop(1, 'rgba(2,7,17,0.84)');
  c.fillStyle = g;
  c.fillRect(0, 1490, W, H - 1490);
}

function drawOverlay(shot, t) {
  if (!shot.title && !shot.sub) return;
  topWash(shot.id === 'access' ? 0.72 : 0.82);
  const intro = ease((t + 0.02) / 0.26);
  c.save();
  c.globalAlpha = intro;
  c.translate((1 - intro) * 56, 0);
  if (shot.id === 'cta') {
    text('ÓRBITA ZERO · GAMEPLAY REAL', 62, 178, 22, '#b8d4df', 'left', 'Body');
    text(shot.title, 62, 226, 58, '#f4fbff');
    text(shot.sub, 62, 297, 58, shot.accent);
  } else if (shot.id === 'access') {
    text('GALÁXIA 01 · SETOR 10', 62, 164, 20, shot.accent, 'left', 'Body');
    text(shot.title, 62, 208, 54, '#f4fbff');
    text(shot.sub, 62, 278, 23, '#c0d7e1', 'left', 'Body');
  } else if (shot.id === 'map') {
    text('O CAMINHO É LONGO DE PROPÓSITO.', 62, 176, 21, shot.accent, 'left', 'Body');
    text(shot.title, 62, 222, 51, '#f4fbff');
  } else {
    const first = lineBreak(shot.title, 940, 58);
    first.forEach((l, i) => text(l, 62, 184 + i * 68, 58, i === first.length - 1 && shot.sub ? '#f4fbff' : shot.accent));
    if (shot.sub) text(shot.sub, 62, 184 + first.length * 68 + 10, 30, shot.accent, 'left', 'Body');
  }
  c.restore();

  if (shot.id === 'drop') {
    lowerWash();
    c.fillStyle = `${shot.accent}dd`;
    c.fillRect(62, 1518, 8, 100);
    text('DROP FÍSICO', 92, 1512, 21, shot.accent, 'left', 'Body');
    text('a chave vai para o Armazém', 92, 1546, 29, '#f4fbff', 'left', 'Body');
  }
  if (shot.id === 'victory') {
    c.fillStyle = `${shot.accent}dd`;
    c.fillRect(62, 1596, 8, 86);
    text('VITÓRIA REAL · PRIMEIRA TENTATIVA', 92, 1590, 20, shot.accent, 'left', 'Body');
  }
  if (shot.id === 'cta') {
    c.fillStyle = 'rgba(2,7,17,.72)';
    c.fillRect(52, 1494, 976, 132);
    c.strokeStyle = `${shot.accent}aa`;
    c.lineWidth = 2;
    c.strokeRect(52, 1494, 976, 132);
    text('JOGUE GRÁTIS NO NAVEGADOR', W / 2, 1517, 22, '#c0d7e1', 'center', 'Body');
    text('ORBITAZERO.COM.BR', W / 2, 1551, 44, shot.accent, 'center');
  }
}

function editorialTexture(shot, t) {
  c.fillStyle = `${shot.accent}0a`;
  for (let y = 0; y < H; y += 10) c.fillRect(0, y, W, 1);
  c.fillStyle = `${shot.accent}bb`;
  c.fillRect(62, 1749, 956 * clamp((shot.start + t) / 30), 3);
  c.fillStyle = '#ffffff3c';
  c.fillRect(62 + 956 * clamp((shot.start + t) / 30), 1749, 956 * (1 - clamp((shot.start + t) / 30)), 3);
}

function drawFrame(shot, img, t) {
  fitFull(img);
  drawOverlay(shot, t);
  editorialTexture(shot, t);
}

function transition(kind, q, frame) {
  const s = smooth(q);
  c.save();
  if (kind === 'portal') {
    const radius = Math.hypot(W, H) * (1 - s) * 0.58;
    c.beginPath(); c.arc(W / 2, H / 2, radius, 0, Math.PI * 2); c.clip();
    c.drawImage(previous, 0, 0);
    c.restore();
    c.strokeStyle = '#65dcffcc'; c.lineWidth = 18 * (1 - s) + 2;
    c.beginPath(); c.arc(W / 2, H / 2, radius, 0, Math.PI * 2); c.stroke();
  } else if (kind === 'shock') {
    const offset = 32 * (1 - s);
    c.globalAlpha = 1 - s;
    c.drawImage(previous, -offset, 0);
    c.globalCompositeOperation = 'screen';
    c.globalAlpha = 0.48 * (1 - s);
    c.drawImage(previous, offset, 0);
    c.restore();
    c.fillStyle = `rgba(255,255,255,${0.16 * (1 - s)})`;
    c.fillRect(0, 0, W, H);
  } else if (kind === 'ripple') {
    const count = 6;
    for (let i = 0; i < count; i++) {
      const radius = Math.hypot(W, H) * (1 - i / count) * 0.55;
      c.save(); c.beginPath(); c.arc(W / 2, H / 2, radius, 0, Math.PI * 2); c.clip();
      c.globalAlpha = 1 - s * 0.9;
      c.translate(W / 2, H / 2); c.rotate((i % 2 ? 1 : -1) * s * 0.12); c.translate(-W / 2, -H / 2);
      c.drawImage(previous, 0, 0); c.restore();
    }
    c.restore();
  } else {
    c.globalAlpha = 1 - s; c.drawImage(previous, 0, 0); c.restore();
  }
  if (frame < 4) { c.fillStyle = `rgba(255,255,255,${(4 - frame) * 0.08})`; c.fillRect(0, 0, W, H); }
}

function writeWav(file, seconds = 30) {
  const rate = 48000;
  const samples = rate * seconds;
  const wav = Buffer.alloc(44 + samples * 4);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22);
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 4, 28); wav.writeUInt16LE(4, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(samples * 4, 40);
  const bpm = 174; const beat = 60 / bpm;
  const roots = [55, 65.406, 73.416, 49];
  const notes = [1, 1.25, 1.5, 2, 1.5, 2, 2.5, 3];
  const cutTimes = shots.slice(1).map((s) => s.start);
  let seed = 0x4f5a3031;
  const delayL = new Float32Array(Math.floor(rate * 0.16));
  const delayR = new Float32Array(Math.floor(rate * 0.23));
  for (let i = 0; i < samples; i++) {
    const t = i / rate;
    const beatPhase = t % beat;
    const sixteenth = t % (beat / 4);
    const step = Math.floor(t / (beat / 4));
    const beatIndex = Math.floor(t / beat);
    const root = roots[Math.floor(beatIndex / 8) % roots.length];
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = (seed / 4294967296) * 2 - 1;
    const kick = Math.sin(2 * Math.PI * (48 + 135 * Math.exp(-beatPhase * 36)) * beatPhase) * Math.exp(-beatPhase * 19) * 0.54;
    const snareOn = beatIndex % 4 === 1 || beatIndex % 4 === 3;
    const snare = snareOn ? noise * Math.exp(-beatPhase * 30) * 0.22 : 0;
    const hat = noise * Math.exp(-sixteenth * 125) * 0.065;
    const phase = t * root;
    const saw = 2 * (phase - Math.floor(phase + 0.5));
    const bass = (saw * 0.64 + Math.sin(2 * Math.PI * phase) * 0.36) * Math.exp(-(t % (beat / 2)) * 4.5) * 0.17;
    const arpFreq = root * 4 * notes[step % notes.length];
    const arpEnv = Math.min(1, sixteenth / 0.002) * Math.exp(-sixteenth * 20);
    const arp = (Math.sin(2 * Math.PI * arpFreq * t) + 0.22 * Math.sin(6 * Math.PI * arpFreq * t)) * arpEnv * 0.075;
    const pulse = Math.sin(2 * Math.PI * (root * 7.25) * t + Math.sin(t * 10) * 1.5) * Math.exp(-(t % (beat * 2)) * 2.2) * 0.035;
    let transitionSfx = 0;
    for (const cut of cutTimes) {
      const d = t - cut;
      if (d >= 0 && d < 0.20) transitionSfx += Math.sin(2 * Math.PI * (360 - 1100 * d) * d) * Math.exp(-d * 25) * 0.16;
    }
    const sidechain = 0.68 + 0.32 * clamp(beatPhase / 0.11);
    const dry = kick + snare + hat + (bass + arp + pulse) * sidechain + transitionSfx;
    const ix = i % delayL.length;
    const iy = i % delayR.length;
    const l = delayL[ix]; const r = delayR[iy];
    delayL[ix] = arp * 0.28 + pulse * 0.42;
    delayR[iy] = arp * 0.24 + pulse * 0.34;
    const fade = clamp(t / 0.08) * clamp((30 - t) / 0.42);
    const left = Math.tanh((dry + l) * fade) * 0.83;
    const right = Math.tanh((dry + r + arp * 0.04) * fade) * 0.83;
    wav.writeInt16LE(Math.round(left * 30000), 44 + i * 4);
    wav.writeInt16LE(Math.round(right * 30000), 46 + i * 4);
  }
  fs.writeFileSync(file, wav);
}

function mixAudio() {
  const music = path.join(dir, 'trilha-original-viral.wav');
  const mixed = path.join(dir, 'audio-final-viral.m4a');
  writeWav(music);
  const result = spawnSync(ffmpeg, [
    '-y', '-hide_banner', '-loglevel', 'error', '-i', music, '-i', voice,
    '-filter_complex', '[0:a]volume=0.42[m];[1:a]adelay=180|180,volume=1.12[vo];[m][vo]amix=inputs=2:duration=first:dropout_transition=0,alimiter=limit=0.94[a]',
    '-map', '[a]', '-c:a', 'aac', '-b:a', '192k', '-t', '30', mixed,
  ], { windowsHide: true });
  if (result.status !== 0) throw new Error(result.stderr?.toString() || 'Falha ao mixar áudio');
  return mixed;
}

async function makeStoryboard() {
  board.fillStyle = '#02050b'; board.fillRect(0, 0, boardCanvas.width, boardCanvas.height);
  const cols = 4; const tileW = boardCanvas.width / cols; const tileH = 512;
  for (let i = 0; i < shots.length; i++) {
    const shot = shots[i];
    const sample = Math.min(Math.floor(shot.dur * FPS * 0.46), Math.ceil(shot.dur * FPS) - 1);
    const img = await imageFor(shot, sample);
    drawFrame(shot, img, sample / FPS);
    const col = i % cols; const row = Math.floor(i / cols); const x = col * tileW; const y = row * tileH;
    const thumbW = 216;
    board.drawImage(canvas, x + (tileW - thumbW) / 2, y, thumbW, 384);
    board.fillStyle = '#07111d'; board.fillRect(x, y + 384, tileW, 128);
    board.fillStyle = shot.accent; board.font = '18px Title'; board.textAlign = 'center'; board.textBaseline = 'middle';
    board.fillText(`${shot.start.toFixed(1)}s · ${shot.id.toUpperCase()}`, x + tileW / 2, y + 426);
    board.fillStyle = '#d5e8ef'; board.font = '15px Body'; board.fillText(`${shot.source} · frame inteiro`, x + tileW / 2, y + 458);
  }
  fs.writeFileSync(path.join(dir, 'storyboard.jpg'), boardCanvas.encodeSync('jpeg', 91));
}

async function render(output, audio) {
  const child = spawn(ffmpeg, [
    '-y', '-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-vcodec', 'mjpeg', '-framerate', String(FPS), '-i', 'pipe:0',
    '-i', audio, '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-t', '30', '-movflags', '+faststart', output,
  ], { windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] });
  let stderr = ''; child.stderr.on('data', (chunk) => { stderr += chunk; });
  const done = new Promise((resolve, reject) => { child.on('error', reject); child.on('close', (code) => code === 0 ? resolve() : reject(new Error(stderr))); });
  for (const shot of shots) {
    const count = Math.ceil(shot.dur * FPS);
    for (let frame = 0; frame < count; frame++) {
      const img = await imageFor(shot, frame);
      drawFrame(shot, img, frame / FPS);
      if (shot !== shots[0] && frame < 12) transition(shot.id === 'access' || shot.id === 'entry' ? 'portal' : shot.id === 'drop' ? 'shock' : 'ripple', (frame + 1) / 12, frame);
      if (shot === shots[0] && frame < 5) { c.fillStyle = `rgba(255,255,255,${(5 - frame) * 0.10})`; c.fillRect(0, 0, W, H); }
      if (shot === shots[0] && frame === 24) fs.writeFileSync(path.join(dir, 'capa.jpg'), canvas.encodeSync('jpeg', 95));
      if (frame === count - 1) { p.clearRect(0, 0, W, H); p.drawImage(canvas, 0, 0); }
      if (!child.stdin.write(canvas.encodeSync('jpeg', 92))) await once(child.stdin, 'drain');
    }
  }
  child.stdin.end(); await done;
}

(async () => {
  if (!fs.existsSync(source)) throw new Error('Gameplay vertical inédita não encontrada. Rode capture.cjs primeiro.');
  if (!fs.existsSync(voice)) throw new Error('Narração pt-BR não encontrada. Rode voiceover.ps1 primeiro.');
  decodeFrames();
  const audio = mixAudio();
  await makeStoryboard();
  if (!process.argv.includes('--preview')) {
    const output = path.join(dir, 'orbita-zero-tiktok-viral-30s.mp4');
    await render(output, audio);
    fs.writeFileSync(path.join(dir, 'render-info.json'), JSON.stringify({
      duration: 30, width: W, height: H, fps: FPS, codec: 'H.264/AAC',
      bytes: fs.statSync(output).size, capture: 'gameplay-viral-01.webm — vertical, recorded from current local build',
      reusedFootage: false, repeatedScreens: false, croppedScreens: false,
      narration: 'pt-BR-AntonioNeural, roteiro original do jogo', music: 'trilha original procedural sci-fi, 174 BPM',
      destination: 'orbitazero.com.br', checks: 'capture.cjs checks: defeat, build, physical key, quantity, consumption and boss victory',
    }, null, 2));
  }
  console.log(process.argv.includes('--preview') ? 'PREVIEW COMPLETE' : 'FINAL VIDEO COMPLETE');
})().catch((error) => { console.error(error); process.exit(1); });
