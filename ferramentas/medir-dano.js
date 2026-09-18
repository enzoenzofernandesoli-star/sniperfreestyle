/* ===========================================================================
   MEDIR-DANO.JS — bancada de balanceamento.

   Põe cada classe na frente de um boss e mede o dano de verdade: tiro
   viajando, alcance curto contando, orbe, drone, onda de choque e corte de
   ultimate incluídos. É o número que vale numa discussão de nerf — a conta de
   papel `dano x projéteis / cadência` ignora alcance, orbe e drone.

       node ferramentas/medir-dano.js         # dano por segundo do tiro básico
       node ferramentas/medir-dano.js --ult   # dano TOTAL na janela da ultimate

   Duas decisões da bancada, senão o número mente:

   1. O jogador fica **ancorado** na distância medida. Sem isso o recuo do tiro
      e o dash tiram ele do alcance e a medição mede movimentação, não dano.
   2. Com `--ult` o que se mede é o **dano total nos 6 segundos seguintes à
      ativação**, não uma média de dez segundos: a ult do SNIPER é um tiro só e
      a do ESPECTRO dura cinco segundos. Média diluiria as duas de formas
      diferentes e ninguém seria comparável.

   O boss fica parado, porque aqui se mede o dano do jogador, não a habilidade
   de desviar.
   =========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAIZ = path.dirname(__dirname);
const COM_ULT = process.argv.includes('--ult');
const SEGUNDOS = COM_ULT ? 6 : 10;
const DISTANCIAS = [120, 700];   // colado e longe
const CLASSES = ['sniper', 'guardiao', 'espectro', 'arcano', 'invocador'];

// Relógio da bancada. O corte da CARNIFICINA usa setTimeout para liberar o
// mesmo alvo depois de alguns milissegundos; com setTimeout de mentira o alvo
// nunca é liberado e o corte conta uma vez só. Aqui as chamadas entram numa
// fila e são disparadas pelo tempo SIMULADO, não pelo relógio de parede.
const fila = [];
let agoraSim = 0;
function setTimeoutSim(fn, ms) { fila.push({ fn, quando: agoraSim + (ms || 0) / 1000 }); }
function avancarRelogio(dt) {
  agoraSim += dt;
  for (let i = fila.length - 1; i >= 0; i--) {
    if (fila[i].quando <= agoraSim) { const f = fila[i].fn; fila.splice(i, 1); f(); }
  }
}

function mundo() {
  const ctx = vm.createContext({
    console, Math, setTimeout: setTimeoutSim, clearTimeout: () => {},
    UI: { aviso() {}, mostrarBarraBoss() {}, esconderBarraBoss() {}, atualizarBarraBoss() {}, atualizarHUD() {} },
    Coop: { ativo: () => true, controlesRemotos: new Map(), controleParado: null }
  });
  for (const arq of ['src/nucleo.js', 'src/loja.js', 'src/classes.js', 'src/entidades.js', 'src/jogo.js']) {
    vm.runInContext(fs.readFileSync(path.join(RAIZ, arq), 'utf8'), ctx, { filename: arq });
  }
  return ctx;
}

function medir(classeId, distancia, comUlt) {
  fila.length = 0;
  agoraSim = 0;
  const ctx = mundo();
  ctx.avancarRelogio = avancarRelogio;
  return vm.runInContext(`(() => {
    Particulas.iniciar();
    Jogo.onda = 30;
    const j = Jogo.jogador = new Jogador('${classeId}', 'original');
    j.receberDano = () => false;          // boneco: mede dano dado, não recebido
    const b = Jogo.boss = new Boss(BOSSES.filter((x) => !x.final && !x.secreto)[5], 30);
    b.entrando = 0;
    b.x = Jogo.LARGURA / 2; b.y = Jogo.ALTURA / 2;
    b.atualizar = () => { b.imune = 0; };  // parado e sem escudo de fase
    b.vidaMax = 1e9; b.vida = 1e9;         // não morre no meio da medição

    let recebido = 0;
    const original = b.receberDano.bind(b);
    b.receberDano = (q, crit, fx, fy) => { recebido += q; return original(q, crit, fx, fy); };

    const ancoraX = b.x - ${distancia}, ancoraY = b.y;
    j.x = ancoraX; j.y = ancoraY;

    const controles = {
      eixoX: () => 0, eixoY: () => 0, mira: { x: 1, y: 0, ativo: true },
      mouseX: b.x, mouseY: b.y, modoToque: false, botaoDireito: false,
      atirando: () => true, apertou: () => false
    };

    if (${comUlt ? 'true' : 'false'}) {
      j.ultCarga = j.attr.ultRecarga;     // nasce com meia carga; sem encher não liga
      j.ativarUlt();
    }

    const passo = 1 / 60;
    for (let i = 0; i < ${SEGUNDOS} * 60; i++) {
      avancarRelogio(passo);               // libera os setTimeout do corte
      j.atualizar(passo, controles);
      j.x = ancoraX; j.y = ancoraY;        // âncora: mede dano, não deslocamento
      j.vx = 0; j.vy = 0;

      for (let k = Jogo.projeteis.length - 1; k >= 0; k--) {
        const p = Jogo.projeteis[k];
        p.atualizar(passo);
        if (!p.vivo) { Jogo.projeteis.splice(k, 1); continue; }
        if (p.dono !== 'jogador') continue;
        if (Mat.distancia(p.x, p.y, b.x, b.y) < p.raio + b.raio && p.atingidos.indexOf(b) < 0) {
          b.receberDano(p.dano, p.critico, p.x, p.y);
          p.atingidos.push(b);
          if (p.perfuracao <= 0) Jogo.projeteis.splice(k, 1); else p.perfuracao--;
        }
      }
      // ondas de choque: IMPACTO do GUARDIÃO, abertura e estouro da CARNIFICINA
      for (let k = Jogo.ondasChoque.length - 1; k >= 0; k--) {
        const o = Jogo.ondasChoque[k];
        o.raio += o.raioMax * 1.6 * passo;
        if (!o.atingidos.has(b) && Mat.distancia(o.x, o.y, b.x, b.y) < o.raio) {
          o.atingidos.add(b);
          b.receberDano(o.dano, false, b.x, b.y);
        }
        if (o.raio >= o.raioMax) Jogo.ondasChoque.splice(k, 1);
      }
      // singularidade do ARCANO estoura no fim e vira onda de choque
      for (let k = Jogo.singularidades.length - 1; k >= 0; k--) {
        const s = Jogo.singularidades[k];
        s.vida -= passo;
        if (s.vida <= 0 && !s.explodiu) {
          s.explodiu = true;
          Jogo.ondasChoque.push({ x: s.x, y: s.y, raio: 10, raioMax: 380, dano: s.dano,
            cor: s.cor, atingidos: new Set(), empurrao: 700 });
          Jogo.singularidades.splice(k, 1);
        }
      }
    }
    return Math.round(recebido / ${comUlt ? 1 : SEGUNDOS});
  })()`, ctx);
}

const rotulo = COM_ULT
  ? 'COM ULTIMATE — dano TOTAL nos ' + SEGUNDOS + ' s seguintes à ativação'
  : 'TIRO BÁSICO — dano por segundo';
console.log(rotulo + ' (boss da onda 30, parado)');
console.log('classe       colado (120px)  longe (700px)');
const linhas = CLASSES.map((c) => ({
  c, perto: medir(c, DISTANCIAS[0], COM_ULT), longe: medir(c, DISTANCIAS[1], COM_ULT)
})).sort((a, b) => b.perto - a.perto);
for (const l of linhas) console.log(l.c.padEnd(12), String(l.perto).padEnd(15), l.longe);

const topo = linhas[0], segundo = linhas[1];
console.log('\nmais forte colado: ' + topo.c + ' (' + topo.perto + '), ' +
  (topo.perto / Math.max(1, segundo.perto)).toFixed(2) + 'x o segundo (' +
  segundo.c + ' ' + segundo.perto + ')');
