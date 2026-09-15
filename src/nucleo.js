/* ===========================================================================
   NUCLEO.JS — matemática, input, áudio procedural, partículas, câmera, save.
   Sem dependências e sem build: carregado como script clássico.
   =========================================================================== */

/* ----------------------------- Matemática ------------------------------- */
const Mat = {
  TAU: Math.PI * 2,
  aleatorio(min, max) { return min + Math.random() * (max - min); },
  inteiro(min, max) { return Math.floor(Mat.aleatorio(min, max + 1)); },
  escolher(lista) { return lista[Math.floor(Math.random() * lista.length)]; },
  chance(p) { return Math.random() < p; },
  limitar(v, min, max) { return v < min ? min : v > max ? max : v; },
  misturar(a, b, t) { return a + (b - a) * t; },
  // interpolação estável independente de framerate
  suave(a, b, taxa, dt) { return b + (a - b) * Math.exp(-taxa * dt); },
  distancia(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); },
  distanciaQ(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; },
  anguloEntre(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); },
  normalizarAngulo(a) {
    while (a > Math.PI) a -= Mat.TAU;
    while (a < -Math.PI) a += Mat.TAU;
    return a;
  },
  girarPara(atual, alvo, passo) {
    return atual + Mat.limitar(Mat.normalizarAngulo(alvo - atual), -passo, passo);
  },
  embaralhar(lista) {
    for (let i = lista.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = lista[i]; lista[i] = lista[j]; lista[j] = tmp;
    }
    return lista;
  }
};

/* ---------------------------- Configurações ----------------------------- */
const Config = {
  volumeMusica: 0.35,
  volumeEfeitos: 0.55,
  tremorAtivo: true,
  particulasAtivas: true,
  mostrarDano: true,
  controlesToque: 'auto',   // 'auto' | 'sempre' | 'nunca'
  // As chaves de localStorage seguem com o prefixo antigo 'sniper.' de propósito:
  // renomear apagaria os recordes já salvos de quem jogou antes do nome mudar.
  carregar() {
    try {
      const salvo = JSON.parse(localStorage.getItem('sniper.config') || '{}');
      Object.assign(Config, salvo);
    } catch (e) { /* primeira execução */ }
  },
  salvar() {
    try {
      localStorage.setItem('sniper.config', JSON.stringify({
        volumeMusica: Config.volumeMusica,
        volumeEfeitos: Config.volumeEfeitos,
        tremorAtivo: Config.tremorAtivo,
        particulasAtivas: Config.particulasAtivas,
        mostrarDano: Config.mostrarDano,
        controlesToque: Config.controlesToque
      }));
    } catch (e) { /* modo privado */ }
  }
};

/* ------------------------------- Câmera -------------------------------- */
const Camera = {
  x: 0, y: 0,
  centroX: 640, centroY: 360,
  tremor: 0,
  zoom: 1,
  zoomAlvo: 1,
  bater(forca) { Camera.tremor = Math.min(46, Camera.tremor + forca); },
  pulsar(z) { Camera.zoom = Math.max(Camera.zoom, z); },
  atualizar(dt) {
    Camera.tremor = Math.max(0, Camera.tremor - Camera.tremor * 9 * dt - 6 * dt);
    const t = Camera.tremor * (Config.tremorAtivo ? 1 : 0);
    Camera.x = Mat.aleatorio(-t, t);
    Camera.y = Mat.aleatorio(-t, t);
    Camera.zoom = Mat.suave(Camera.zoom, Camera.zoomAlvo, 8, dt);
    // Arena cabe inteira na tela: a câmera não persegue ninguém, só treme e dá zoom.
    Camera.centroX = Jogo.LARGURA / 2;
    Camera.centroY = Jogo.ALTURA / 2;
  },
  aplicar(ctx, largura, altura) {
    ctx.save();
    ctx.translate(largura / 2, altura / 2);
    ctx.scale(Camera.zoom, Camera.zoom);
    ctx.translate(-Camera.centroX + Camera.x, -Camera.centroY + Camera.y);
  },
  telaParaMundo(x, y) {
    return {
      x: Camera.centroX + (x - Jogo.LARGURA / 2) / Camera.zoom - Camera.x,
      y: Camera.centroY + (y - Jogo.ALTURA / 2) / Camera.zoom - Camera.y
    };
  },
  restaurar(ctx) { ctx.restore(); }
};

/* ------------------------------- Recordes ------------------------------- */
const Recordes = {
  lista: [],
  carregar() {
    try { Recordes.lista = JSON.parse(localStorage.getItem('sniper.recordes') || '[]'); }
    catch (e) { Recordes.lista = []; }
  },
  registrar(entrada) {
    Recordes.lista.push(entrada);
    Recordes.lista.sort((a, b) => b.pontos - a.pontos);
    Recordes.lista = Recordes.lista.slice(0, 8);
    try { localStorage.setItem('sniper.recordes', JSON.stringify(Recordes.lista)); }
    catch (e) { /* ignora */ }
  },
  melhor() { return Recordes.lista.length ? Recordes.lista[0].pontos : 0; }
};

/* --------------------------------- Input -------------------------------- */
const Input = {
  teclas: {},
  pressionadasAgora: {},
  mouseX: 0, mouseY: 0,
  mouseTelaX: 0, mouseTelaY: 0,
  mouseBaixo: false,
  botaoDireito: false,
  canvas: null,

  // controles de toque (joystick esquerdo, joystick de mira/tiro à direita)
  modoToque: false,
  mover: { x: 0, y: 0, ativo: false },
  mira: { x: 0, y: 0, ativo: false },
  pulsos: {},          // toques de botão de habilidade, consumidos por apertou()

  iniciar(canvas) {
    Input.canvas = canvas;

    addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].indexOf(e.code) >= 0) e.preventDefault();
      if (!Input.teclas[e.code]) Input.pressionadasAgora[e.code] = true;
      Input.teclas[e.code] = true;
      Som.destravar();
    });
    addEventListener('keyup', (e) => { Input.teclas[e.code] = false; });
    addEventListener('blur', () => { Input.teclas = {}; Input.mouseBaixo = false; });

    const posicao = (clienteX, clienteY) => {
      const r = canvas.getBoundingClientRect();
      const x = (clienteX - r.left) * (Jogo.LARGURA / r.width);
      const y = (clienteY - r.top) * (Jogo.ALTURA / r.height);
      Input.mouseTelaX = x;
      Input.mouseTelaY = y;
      Input.atualizarMouse();
    };
    Input._posicao = posicao;

    canvas.addEventListener('mousemove', (e) => posicao(e.clientX, e.clientY));
    canvas.addEventListener('mousedown', (e) => {
      Som.destravar();
      if (e.button === 0) Input.mouseBaixo = true;
      if (e.button === 2) Input.botaoDireito = true;
      posicao(e.clientX, e.clientY);
    });
    addEventListener('mouseup', (e) => {
      if (e.button === 0) Input.mouseBaixo = false;
      if (e.button === 2) Input.botaoDireito = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // O toque NÃO é lido do canvas: quem alimenta Input.mover/Input.mira são os
    // controles em tela montados por Toque.iniciar() (ui.js).
    canvas.addEventListener('touchstart', (e) => { Som.destravar(); e.preventDefault(); }, { passive: false });
  },

  atualizarMouse() {
    const mundo = Camera.telaParaMundo(Input.mouseTelaX, Input.mouseTelaY);
    Input.mouseX = mundo.x;
    Input.mouseY = mundo.y;
  },

  apertou(codigo) { return !!Input.pressionadasAgora[codigo] || !!Input.pulsos[codigo]; },
  segura(codigo) { return !!Input.teclas[codigo]; },
  pulsar(codigo) { Input.pulsos[codigo] = true; },
  eixoX() {
    let v = 0;
    if (Input.segura('KeyA') || Input.segura('ArrowLeft')) v -= 1;
    if (Input.segura('KeyD') || Input.segura('ArrowRight')) v += 1;
    if (Input.mover.ativo) v += Input.mover.x;
    return Mat.limitar(v, -1, 1);
  },
  eixoY() {
    let v = 0;
    if (Input.segura('KeyW') || Input.segura('ArrowUp')) v -= 1;
    if (Input.segura('KeyS') || Input.segura('ArrowDown')) v += 1;
    if (Input.mover.ativo) v += Input.mover.y;
    return Mat.limitar(v, -1, 1);
  },
  // gatilho: mouse pressionado ou joystick de mira em uso
  atirando() { return Input.mouseBaixo || Input.mira.ativo; },
  limparQuadro() { Input.pressionadasAgora = {}; Input.pulsos = {}; }
};

/* ------------------------- Áudio 100% procedural ------------------------- */
/* Nenhum arquivo de som: tudo sintetizado no WebAudio na hora.              */
const Som = {
  ctx: null,
  mestreEfeitos: null,
  mestreMusica: null,
  pronto: false,
  passoMusica: 0,
  proximaNota: 0,
  intensidade: 0, // 0 = calmo, 1 = boss

  destravar() {
    if (Som.pronto) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    Som.ctx = new AC();
    Som.mestreEfeitos = Som.ctx.createGain();
    Som.mestreMusica = Som.ctx.createGain();
    const compressor = Som.ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.ratio.value = 6;
    Som.mestreEfeitos.connect(compressor);
    Som.mestreMusica.connect(compressor);
    compressor.connect(Som.ctx.destination);
    Som.aplicarVolumes();
    Som.pronto = true;
    Som.proximaNota = Som.ctx.currentTime + 0.1;
  },

  aplicarVolumes() {
    if (!Som.pronto) return;
    Som.mestreEfeitos.gain.value = Config.volumeEfeitos;
    Som.mestreMusica.gain.value = Config.volumeMusica * 0.5;
  },

  _tom(cfg) {
    if (!Som.pronto) return;
    const freq = cfg.freq || 440;
    const tipo = cfg.tipo || 'square';
    const dur = cfg.dur || 0.12;
    const vol = cfg.vol || 0.3;
    const t = Som.ctx.currentTime;
    const osc = Som.ctx.createOscillator();
    const g = Som.ctx.createGain();
    osc.type = tipo;
    osc.frequency.setValueAtTime(freq, t);
    if (cfg.freqFinal) osc.frequency.exponentialRampToValueAtTime(Math.max(20, cfg.freqFinal), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(Som.mestreEfeitos);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  },

  _ruido(cfg) {
    if (!Som.pronto) return;
    const dur = cfg.dur || 0.2;
    const vol = cfg.vol || 0.3;
    const t = Som.ctx.currentTime;
    const amostras = Math.floor(Som.ctx.sampleRate * dur);
    const buffer = Som.ctx.createBuffer(1, amostras, Som.ctx.sampleRate);
    const dados = buffer.getChannelData(0);
    for (let i = 0; i < amostras; i++) dados[i] = (Math.random() * 2 - 1) * (1 - i / amostras);
    const fonte = Som.ctx.createBufferSource();
    fonte.buffer = buffer;
    const filtro = Som.ctx.createBiquadFilter();
    filtro.type = cfg.tipo || 'lowpass';
    filtro.frequency.value = cfg.corte || 1200;
    filtro.Q.value = cfg.q || 1;
    const g = Som.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    fonte.connect(filtro); filtro.connect(g); g.connect(Som.mestreEfeitos);
    fonte.start(t);
  },

  tiro(tipo) {
    if (tipo === 'sniper') {
      Som._tom({ freq: 900, freqFinal: 120, tipo: 'sawtooth', dur: 0.16, vol: 0.2 });
      Som._ruido({ dur: 0.12, vol: 0.14, corte: 2600, tipo: 'highpass' });
    } else if (tipo === 'shotgun') {
      Som._ruido({ dur: 0.18, vol: 0.2, corte: 1600 });
      Som._tom({ freq: 220, freqFinal: 60, tipo: 'square', dur: 0.12, vol: 0.12 });
    } else if (tipo === 'arcano') {
      Som._tom({ freq: 620, freqFinal: 1180, tipo: 'triangle', dur: 0.14, vol: 0.13 });
    } else if (tipo === 'pesado') {
      Som._tom({ freq: 160, freqFinal: 50, tipo: 'square', dur: 0.16, vol: 0.18 });
    } else {
      Som._tom({ freq: 720, freqFinal: 260, tipo: 'square', dur: 0.08, vol: 0.12 });
    }
  },
  acerto() { Som._tom({ freq: 340, freqFinal: 620, tipo: 'triangle', dur: 0.05, vol: 0.09 }); },
  critico() { Som._tom({ freq: 1200, freqFinal: 1800, tipo: 'square', dur: 0.07, vol: 0.13 }); },
  morteInimigo() {
    Som._ruido({ dur: 0.22, vol: 0.2, corte: 900 });
    Som._tom({ freq: 200, freqFinal: 40, tipo: 'sawtooth', dur: 0.2, vol: 0.12 });
  },
  dash() {
    Som._ruido({ dur: 0.22, vol: 0.15, corte: 900, tipo: 'bandpass', q: 2 });
    Som._tom({ freq: 300, freqFinal: 900, tipo: 'sine', dur: 0.18, vol: 0.1 });
  },
  escudo() {
    Som._tom({ freq: 300, freqFinal: 900, tipo: 'sine', dur: 0.4, vol: 0.15 });
    Som._tom({ freq: 450, freqFinal: 1350, tipo: 'triangle', dur: 0.4, vol: 0.07 });
  },
  ultimate() {
    Som._tom({ freq: 90, freqFinal: 900, tipo: 'sawtooth', dur: 0.6, vol: 0.2 });
    Som._ruido({ dur: 0.5, vol: 0.18, corte: 3000, tipo: 'bandpass', q: 0.7 });
  },
  dano() {
    Som._tom({ freq: 240, freqFinal: 60, tipo: 'sawtooth', dur: 0.35, vol: 0.26 });
    Som._ruido({ dur: 0.3, vol: 0.22, corte: 700 });
  },
  pegar() { Som._tom({ freq: 880, freqFinal: 1320, tipo: 'sine', dur: 0.12, vol: 0.13 }); },
  xp() { Som._tom({ freq: 1400 + Math.random() * 300, tipo: 'sine', dur: 0.05, vol: 0.04 }); },
  subirNivel() {
    [523, 659, 784, 1046].forEach((f, i) =>
      setTimeout(() => Som._tom({ freq: f, tipo: 'triangle', dur: 0.2, vol: 0.16 }), i * 80));
  },
  bossEntra() {
    [110, 104, 98, 87].forEach((f, i) =>
      setTimeout(() => Som._tom({ freq: f, freqFinal: f * 0.5, tipo: 'sawtooth', dur: 0.5, vol: 0.24 }), i * 190));
  },
  bossMorre() {
    Som._ruido({ dur: 1.4, vol: 0.3, corte: 500 });
    [220, 165, 110, 55].forEach((f, i) =>
      setTimeout(() => Som._tom({ freq: f, freqFinal: f * 0.4, tipo: 'sawtooth', dur: 0.6, vol: 0.22 }), i * 160));
  },
  clique() { Som._tom({ freq: 620, tipo: 'square', dur: 0.04, vol: 0.07 }); },
  gameOver() {
    [392, 330, 262, 196].forEach((f, i) =>
      setTimeout(() => Som._tom({ freq: f, freqFinal: f * 0.7, tipo: 'triangle', dur: 0.5, vol: 0.18 }), i * 240));
  },
  vitoria() {
    [523, 659, 784, 1046, 1318].forEach((f, i) =>
      setTimeout(() => Som._tom({ freq: f, tipo: 'triangle', dur: 0.32, vol: 0.18 }), i * 150));
  },

  // trilha: baixo + arpejo em escala menor; acelera e abre o filtro no boss
  // Cada boss derrubado troca a trilha: raiz, escala e timbre mudam juntos, e
  // a faixa 0 é a de sempre. É a mesma música procedural — o que muda é o modo.
  /* Clipes gravados. O resto do áudio do jogo é sintetizado no WebAudio; estes
     três são a exceção: são falas curtas que tocam quando o boss da onda 10
     cai. Ficam em `assets/`, carregam sob demanda e respeitam o volume de
     efeitos como qualquer outro som. */
  CLIPES: {
    encaixa: ['assets/encaixa-1.m4a', 'assets/encaixa-2.m4a', 'assets/encaixa-3.m4a']
  },
  _clipes: {},

  tocarClipe(nome) {
    if (Config.volumeSom <= 0) return;
    const lista = Som.CLIPES[nome];
    if (!lista || !lista.length) return;
    const caminho = lista[Math.floor(Math.random() * lista.length)];
    try {
      let audio = Som._clipes[caminho];
      if (!audio) { audio = new Audio(caminho); Som._clipes[caminho] = audio; }
      audio.currentTime = 0;
      audio.volume = Mat.limitar(Config.volumeSom, 0, 1);
      const p = audio.play();
      if (p && p.catch) p.catch(() => { /* navegador ainda sem gesto do usuário */ });
    } catch (e) { /* sem áudio: o jogo segue igual */ }
  },

  TRILHAS: [
    { raiz: 55, escala: [0, 3, 5, 7, 10, 12, 15], baixo: 'sawtooth', lead: 'triangle', bpm: 0 },
    { raiz: 49, escala: [0, 2, 3, 7, 8, 12, 14], baixo: 'square', lead: 'triangle', bpm: 6 },
    { raiz: 62, escala: [0, 4, 7, 11, 12, 16, 19], baixo: 'sawtooth', lead: 'square', bpm: 10 },
    { raiz: 46, escala: [0, 1, 5, 7, 8, 12, 13], baixo: 'square', lead: 'sawtooth', bpm: 12 },
    { raiz: 58, escala: [0, 3, 7, 10, 12, 15, 19], baixo: 'triangle', lead: 'square', bpm: 16 },
    { raiz: 41, escala: [0, 2, 5, 6, 9, 12, 14], baixo: 'sawtooth', lead: 'sawtooth', bpm: 20 },
    { raiz: 65, escala: [0, 3, 5, 6, 7, 10, 12], baixo: 'square', lead: 'triangle', bpm: 24 }
  ],
  trilha: 0,
  proximaTrilha() {
    Som.trilha = (Som.trilha + 1) % Som.TRILHAS.length;
    Som.passoMusica = 0;
  },

  tocarMusica() {
    if (!Som.pronto || Config.volumeMusica <= 0) return;
    const faixa = Som.TRILHAS[Som.trilha] || Som.TRILHAS[0];
    const t = Som.ctx.currentTime;
    const bpm = 96 + faixa.bpm + Som.intensidade * 44;
    const passoSeg = 60 / bpm / 2;
    if (Som.proximaNota < t) Som.proximaNota = t + 0.05;
    let guarda = 0;
    while (Som.proximaNota < t + 0.2 && guarda++ < 32) {
      const p = Som.passoMusica;
      const escala = faixa.escala;
      const raiz = faixa.raiz;
      if (p % 4 === 0) Som._agendar(raiz, faixa.baixo, Som.proximaNota, passoSeg * 2.2, 0.15);
      if (p % 2 === 0 || Som.intensidade > 0.5) {
        const grau = escala[(Math.floor(p / 2) + (p % 3)) % escala.length];
        Som._agendar(raiz * 4 * Math.pow(2, grau / 12), faixa.lead, Som.proximaNota, passoSeg * 1.2, 0.06);
      }
      if (p % 8 === 4) Som._agendarRuido(Som.proximaNota, 0.09, 0.09);
      Som.passoMusica = (p + 1) % 32;
      Som.proximaNota += passoSeg;
    }
  },
  _agendar(freq, tipo, quando, dur, vol) {
    const osc = Som.ctx.createOscillator();
    const g = Som.ctx.createGain();
    const filtro = Som.ctx.createBiquadFilter();
    filtro.type = 'lowpass';
    filtro.frequency.value = 900 + Som.intensidade * 2600;
    osc.type = tipo;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, quando);
    g.gain.exponentialRampToValueAtTime(vol, quando + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, quando + dur);
    osc.connect(filtro); filtro.connect(g); g.connect(Som.mestreMusica);
    osc.start(quando); osc.stop(quando + dur + 0.05);
  },
  _agendarRuido(quando, dur, vol) {
    const amostras = Math.floor(Som.ctx.sampleRate * dur);
    const buffer = Som.ctx.createBuffer(1, amostras, Som.ctx.sampleRate);
    const d = buffer.getChannelData(0);
    for (let i = 0; i < amostras; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / amostras);
    const fonte = Som.ctx.createBufferSource();
    fonte.buffer = buffer;
    const g = Som.ctx.createGain();
    g.gain.value = vol;
    fonte.connect(g); g.connect(Som.mestreMusica);
    fonte.start(quando);
  }
};

/* ------------------------------ Partículas ------------------------------ */
/* Pool fixo: zero alocação por quadro.                                      */
const Particulas = {
  pool: [],
  livres: [],          // índices prontos para uso: emitir vira O(1)
  limite: 900,
  indice: 0,

  iniciar() {
    Particulas.pool.length = 0;
    Particulas.livres.length = 0;
    for (let i = 0; i < Particulas.limite; i++) {
      Particulas.pool.push({
        ativa: false, x: 0, y: 0, vx: 0, vy: 0, vida: 0, vidaMax: 1,
        tam: 2, cor: '#fff', atrito: 0.92, brilho: 0, forma: 'circulo', angulo: 0, giro: 0
      });
      Particulas.livres.push(i);
    }
  },

  emitir(cfg) {
    if (!Config.particulasAtivas) return;
    // Sem slot livre a partícula simplesmente não nasce. Melhor perder um
    // brilho do que gastar quadro procurando lugar num pool cheio.
    const indice = Particulas.livres.pop();
    if (indice === undefined) return;
    {
      const p = Particulas.pool[indice];
      p.ativa = true;
      p.x = cfg.x; p.y = cfg.y;
      p.vx = cfg.vx || 0; p.vy = cfg.vy || 0;
      p.vida = p.vidaMax = cfg.vida || 0.5;
      p.tam = cfg.tam || 3;
      p.cor = cfg.cor || '#fff';
      p.atrito = cfg.atrito !== undefined ? cfg.atrito : 0.9;
      p.brilho = cfg.brilho || 0;
      p.forma = cfg.forma || 'circulo';
      p.angulo = cfg.angulo || 0;
      p.giro = cfg.giro || 0;
      return;
    }
  },

  explosao(x, y, cor, quantidade, forca, vida, tam) {
    quantidade = quantidade || 14; forca = forca || 260; vida = vida || 0.5; tam = tam || 3;
    for (let i = 0; i < quantidade; i++) {
      const a = Math.random() * Mat.TAU;
      const v = Mat.aleatorio(forca * 0.25, forca);
      Particulas.emitir({
        x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        vida: Mat.aleatorio(vida * 0.6, vida), tam: Mat.aleatorio(tam * 0.6, tam * 1.5),
        cor: cor, brilho: 12, atrito: 0.88
      });
    }
  },

  anel(x, y, cor, raio, quantidade) {
    quantidade = quantidade || 22;
    for (let i = 0; i < quantidade; i++) {
      const a = (Mat.TAU / quantidade) * i;
      Particulas.emitir({
        x: x + Math.cos(a) * raio * 0.3, y: y + Math.sin(a) * raio * 0.3,
        vx: Math.cos(a) * raio * 3.2, vy: Math.sin(a) * raio * 3.2,
        vida: 0.42, tam: 3, cor: cor, brilho: 14, atrito: 0.82
      });
    }
  },

  faisca(x, y, angulo, cor) {
    for (let i = 0; i < 5; i++) {
      const a = angulo + Mat.aleatorio(-0.6, 0.6);
      const v = Mat.aleatorio(120, 420);
      Particulas.emitir({
        x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        vida: 0.22, tam: 2, cor: cor, brilho: 10, atrito: 0.8, forma: 'risco', angulo: a
      });
    }
  },

  atualizar(dt) {
    const pool = Particulas.pool;
    for (let i = 0; i < pool.length; i++) {
      const p = pool[i];
      if (!p.ativa) continue;
      p.vida -= dt;
      if (p.vida <= 0) { p.ativa = false; Particulas.livres.push(i); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      const f = Math.pow(p.atrito, dt * 60);
      p.vx *= f; p.vy *= f;
      p.angulo += p.giro * dt;
    }
  },

  desenhar(ctx) {
    const pool = Particulas.pool;
    for (let i = 0; i < pool.length; i++) {
      const p = pool[i];
      if (!p.ativa) continue;
      const a = Mat.limitar(p.vida / p.vidaMax, 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.cor;
      if (p.brilho && !Jogo.modoLeve) { ctx.shadowBlur = p.brilho; ctx.shadowColor = p.cor; }
      if (p.forma === 'risco') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angulo);
        ctx.fillRect(0, -p.tam / 2, p.tam * 5 * a, p.tam);
        ctx.restore();
      } else if (p.forma === 'quadrado') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angulo);
        const s = p.tam * a;
        ctx.fillRect(-s, -s, s * 2, s * 2);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.4, p.tam * a), 0, Mat.TAU);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
  },

  limpar() {
    Particulas.livres.length = 0;
    for (let i = 0; i < Particulas.pool.length; i++) {
      Particulas.pool[i].ativa = false;
      Particulas.livres.push(i);
    }
  }
};

/* --------------------- Números de dano flutuantes ----------------------- */
const Textos = {
  lista: [],
  criar(x, y, texto, cor, tam, subida) {
    if (!Config.mostrarDano) return;
    Textos.lista.push({
      x: x, y: y, texto: texto, cor: cor || '#fff', tam: tam || 16,
      vida: 0.75, vidaMax: 0.75, vx: Mat.aleatorio(-24, 24), vy: -(subida || 46)
    });
  },
  atualizar(dt) {
    for (let i = Textos.lista.length - 1; i >= 0; i--) {
      const t = Textos.lista[i];
      t.vida -= dt;
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.vy += 46 * dt;
      if (t.vida <= 0) Textos.lista.splice(i, 1);
    }
  },
  desenhar(ctx) {
    ctx.textAlign = 'center';
    for (const t of Textos.lista) {
      const a = Mat.limitar(t.vida / t.vidaMax, 0, 1);
      ctx.globalAlpha = a;
      ctx.font = '900 ' + t.tam + 'px Rajdhani, Arial, sans-serif';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,.75)';
      ctx.strokeText(t.texto, t.x, t.y);
      ctx.fillStyle = t.cor;
      ctx.fillText(t.texto, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  },
  limpar() { Textos.lista.length = 0; }
};
