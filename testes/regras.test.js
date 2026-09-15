const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const raiz = path.join(__dirname, '..');
const contexto = vm.createContext({ console, Math });
for (const arquivo of ['src/classes.js', 'src/entidades.js', 'src/jogo.js']) {
  vm.runInContext(fs.readFileSync(path.join(raiz, arquivo), 'utf8'), contexto, { filename: arquivo });
}

test('40 ondas terminam após o oitavo boss', () => {
  assert.equal(vm.runInContext('Jogo.TOTAL_ONDAS', contexto), 40);
  assert.equal(vm.runInContext('BOSSES.length', contexto), 8);
  assert.equal(vm.runInContext('Jogo.ehOndaDeBoss(40)', contexto), true);
  assert.equal(vm.runInContext('Jogo.ehOndaDeBoss(39)', contexto), false);
  assert.equal(vm.runInContext('BOSSES[Math.floor(40 / 5) - 1].id', contexto), 'nucleo');
});

test('arena cabe em uma tela e a câmera fica no centro', () => {
  const mundo = vm.createContext({ console, Math });
  for (const arquivo of ['src/nucleo.js', 'src/classes.js', 'src/entidades.js', 'src/jogo.js']) {
    vm.runInContext(fs.readFileSync(path.join(raiz, arquivo), 'utf8'), mundo, { filename: arquivo });
  }
  const dados = vm.runInContext(`(() => {
    Jogo.jogador = { x: 1000, y: 600 };
    Camera.zoom = 1;
    Camera.zoomAlvo = 1;
    Camera.atualizar(0);
    const centro = Camera.telaParaMundo(640, 360);
    const canto = Camera.telaParaMundo(0, 0);
    const boss = new Boss(BOSSES[0], 5);
    return { arena: [Jogo.LARGURA, Jogo.ALTURA], camera: [Camera.centroX, Camera.centroY],
      centro: [centro.x, centro.y], canto: [canto.x, canto.y], boss: [boss.x, boss.baseY] };
  })()`, mundo);
  assert.deepEqual(Array.from(dados.arena), [1280, 720]);
  assert.deepEqual(Array.from(dados.camera), [640, 360]);
  assert.deepEqual(Array.from(dados.centro), [640, 360]);
  assert.deepEqual(Array.from(dados.canto), [0, 0]);
  assert.deepEqual(Array.from(dados.boss), [640, 150]);
});

test('cada classe tem três skins cosméticas e menos vida inicial', () => {
  const dados = vm.runInContext('CLASSES.map(c => ({ id: c.id, vida: c.atributos.vidaMax, skins: SKINS[c.id].length }))', contexto);
  assert.deepEqual(Array.from(dados, (d) => [d.vida, d.skins]), [[2, 3], [4, 3], [2, 3], [2, 3]]);
  assert.equal(vm.runInContext("skinDaClasse('sniper', 'inexistente').id", contexto), 'original');
});

test('vida dos inimigos cresce mais devagar durante as novas ondas', () => {
  const inicio = vm.runInContext('Jogo.onda = 1; Jogo.multiplicadorVida()', contexto);
  const fim = vm.runInContext('Jogo.onda = 40; Jogo.multiplicadorVida()', contexto);
  assert.equal(inicio, 1);
  assert.ok(fim > inicio && fim < 3.2);
});

test('só tiros disparados pelo jogador usam a nova paleta', () => {
  const cores = vm.runInContext('CORES_TIRO', contexto);
  assert.notEqual(cores.jogador, cores.critico);
  vm.runInContext(`Jogo.projeteis = [];
    Jogo.tiroInimigo(10, 10, 0, 100, 1, '#c874ff', 7);
    Jogo.tiroInimigo(10, 10, 0, 100, 1, '#00e5ff', 9);`, contexto);
  const tiros = vm.runInContext('Jogo.projeteis.map(t => ({ dono: t.dono, cor: t.cor }))', contexto);
  assert.deepEqual(Array.from(tiros, (t) => [t.dono, t.cor]), [
    ['inimigo', '#c874ff'], ['inimigo', '#00e5ff']
  ]);
  assert.notEqual(tiros[0].cor, cores.jogador);
  assert.notEqual(tiros[1].cor, cores.jogador);
});

test('ricochete permite atingir de novo o mesmo alvo sem restaurar perfuração', () => {
  contexto.Mat = {
    limitar: (valor, minimo, maximo) => Math.min(maximo, Math.max(minimo, valor)),
    chance: () => false
  };
  contexto.Particulas = { faisca() {}, explosao() {}, emitir() {} };
  const resultado = vm.runInContext(`(() => {
    const alvo = {};
    const bala = new Projetil({
      x: Jogo.LARGURA - 8, y: 100, angulo: 0, velocidade: 100,
      raio: 7, dano: 10, dono: 'jogador', ricochete: 1, perfuracao: 0
    });
    bala.atingidos.push(alvo);
    bala.atualizar(0.1);
    return { angulo: bala.angulo, ricochete: bala.ricochete,
      podeAtingirDeNovo: bala.atingidos.indexOf(alvo) === -1,
      perfuracao: bala.perfuracao, vivo: bala.vivo };
  })()`, contexto);
  assert.equal(resultado.podeAtingirDeNovo, true);
  assert.equal(resultado.ricochete, 0);
  assert.equal(resultado.perfuracao, 0);
  assert.equal(resultado.vivo, true);
  assert.ok(Math.abs(resultado.angulo - Math.PI) < 1e-9);
});

test('sem ricochete, alvo já atingido continua protegido contra dano repetido por quadro', () => {
  const resultado = vm.runInContext(`(() => {
    const alvo = {};
    const bala = new Projetil({
      x: 100, y: 100, angulo: 0, velocidade: 100,
      raio: 7, dano: 10, dono: 'jogador', ricochete: 1, perfuracao: 1
    });
    bala.atingidos.push(alvo);
    bala.atualizar(0.1);
    return bala.atingidos.indexOf(alvo) !== -1;
  })()`, contexto);
  assert.equal(resultado, true);
});

test('ricochete vertical também libera novo acerto', () => {
  const resultado = vm.runInContext(`(() => {
    const alvo = {};
    const bala = new Projetil({
      x: 100, y: Jogo.ALTURA - 8, angulo: Math.PI / 2, velocidade: 100,
      raio: 7, dano: 10, dono: 'jogador', ricochete: 1, perfuracao: 0
    });
    bala.atingidos.push(alvo);
    bala.atualizar(0.1);
    return bala.atingidos.indexOf(alvo) === -1 && bala.vivo;
  })()`, contexto);
  assert.equal(resultado, true);
});

test('API grava onda 40 e rejeita onda 41', async () => {
  const Module = require('node:module');
  const carregar = Module._load;
  const consultas = [];
  Module._load = function (pedido, pai, principal) {
    if (pedido === '@neondatabase/serverless') {
      return { neon: () => (partes, ...valores) => {
        consultas.push({ texto: partes.join('?'), valores });
        return Promise.resolve([]);
      } };
    }
    return carregar.call(this, pedido, pai, principal);
  };
  let api;
  try { api = require(path.join(raiz, 'api/placar.js')); }
  finally { Module._load = carregar; }

  const responder = async (onda) => {
    const resposta = {
      codigo: 0,
      setHeader() {},
      status(codigo) { this.codigo = codigo; return this; },
      json(corpo) { this.corpo = corpo; return this; }
    };
    await api({ method: 'POST', body: {
      nome: 'TESTE', pontos: 1000, classe: 'SNIPER', onda,
      nivel: 1, tempo: 60, abates: 5, venceu: onda === 40
    } }, resposta);
    return resposta;
  };

  assert.equal((await responder(40)).codigo, 201);
  assert.equal((await responder(41)).codigo, 400);
  assert.ok(consultas.some((consulta) => consulta.texto.includes('insert into public.placar_sobrecarga')));
});

/* =========================== Cooperativo online ==========================
   O cooperativo é autoritativo no anfitrião: o convidado manda comando e
   desenha snapshot. Os testes abaixo cobrem os três pontos onde isso quebra
   calado — comando fora de faixa, snapshot que não descreve o próprio
   jogador, e round-trip das entidades — mais o serviço de salas de verdade.
   ======================================================================== */

// Mundo de teste com o mínimo de navegador que o coop.js encosta.
function mundoCoop() {
  const ctx = vm.createContext({
    console, Math, JSON,
    performance: { now: () => 0 },
    window: {},
    document: { getElementById: () => null },
    WebSocket: function () {},
    Perfil: { exibir: () => 'TESTE' },
    Input: {
      mira: { x: 0, y: 0, ativo: false }, modoToque: false, mouseX: 0, mouseY: 0,
      botaoDireito: false, eixoX: () => 0, eixoY: () => 0,
      atirando: () => false, apertou: () => false
    },
    UI: { mostrarTela() {}, atualizarHUD() {}, montarEquipe() {}, mostrarFinal() {}, atualizarEspera() {} }
  });
  for (const arquivo of ['src/nucleo.js', 'src/classes.js', 'src/entidades.js', 'src/jogo.js', 'src/coop.js']) {
    vm.runInContext(fs.readFileSync(path.join(raiz, arquivo), 'utf8'), ctx, { filename: arquivo });
  }
  return ctx;
}

test('controle recebido do convidado é limitado à faixa válida', () => {
  const ctx = mundoCoop();
  const r = vm.runInContext(`(() => {
    const c = Coop.validarControle({ x: 9, y: -9, miraX: 5, miraY: 5, miraAtiva: true,
      mouseX: 999999, mouseY: -999999, tiro: true, dash: true, escudo: false, ult: true });
    return { x: c.eixoX(), y: c.eixoY(), miraX: c.mira.x, mouseX: c.mouseX, mouseY: c.mouseY,
      tiro: c.atirando(), dash: c.apertou('Space'), escudo: c.apertou('KeyQ'), ult: c.apertou('KeyE') };
  })()`, ctx);
  assert.equal(r.x, 1);
  assert.equal(r.y, -1);
  assert.equal(r.miraX, 1);
  assert.ok(r.mouseX <= 2560 * 2, 'mira não pode apontar para fora da arena');
  assert.ok(r.mouseY >= -1440, 'mira não pode apontar para fora da arena');
  assert.equal(r.tiro, true);
  assert.equal(r.dash, true);
  assert.equal(r.escudo, false);
  assert.equal(r.ult, true);
});
test('lixo no lugar do controle não derruba o anfitrião', () => {
  const ctx = mundoCoop();
  const r = vm.runInContext(`(() => {
    const c = Coop.validarControle(null);
    return { x: c.eixoX(), tiro: c.atirando(), dash: c.apertou('Space') };
  })()`, ctx);
  assert.equal(r.x, 0);
  assert.equal(r.tiro, false);
  assert.equal(r.dash, false);
});

test('snapshot leva inimigos, projéteis e coletáveis de volta ao convidado', () => {
  const ctx = mundoCoop();
  const r = vm.runInContext(`(() => {
    // --- lado anfitrião
    Coop.papel = 'anfitriao';
    Jogo.jogador = new Jogador('sniper', null);
    Jogo.jogador.nome = 'HOST';
    Jogo.jogador.x = 700; Jogo.jogador.y = 400;
    Jogo.inimigos = [new Inimigo('corredor', 900, 500, 1)];
    Jogo.projeteis = [new Projetil({ x: 120, y: 240, angulo: 0, velocidade: 900, dano: 7, dono: 'jogador', cor: '#dcff46' })];
    Jogo.coletaveis = [new Coletavel('xp', 310, 420, 3)];
    Jogo.onda = 6; Jogo.pontos = 1234;
    let pacote = null;
    Coop.enviar = (d) => { pacote = d; };
    Coop.enviarEstado(0, true);

    // --- lado convidado, zerado
    Coop.papel = 'convidado';
    Coop.id = 'anfitriao';
    Jogo.jogador = null; Jogo.outros = new Map();
    Jogo.inimigos = []; Jogo.projeteis = []; Jogo.coletaveis = [];
    Coop.aplicarEstado(pacote.estado);
    const e = Jogo.inimigos[0];
    return {
      bytes: JSON.stringify(pacote.estado).length,
      eu: Jogo.jogador ? { nome: Jogo.jogador.nome, x: Math.round(Jogo.jogador.x) } : null,
      inimigo: { tipo: e.tipo, temDef: !!e.def && e.def === TIPOS_INIMIGO[e.tipo], x: Math.round(e.alvoX), instancia: e instanceof Inimigo },
      projetil: { n: Jogo.projeteis.length, instancia: Jogo.projeteis[0] instanceof Projetil, temRastro: Array.isArray(Jogo.projeteis[0].rastro) },
      coletavel: { n: Jogo.coletaveis.length, valor: Jogo.coletaveis[0].valor, temDef: !!Jogo.coletaveis[0].def },
      onda: Jogo.onda, pontos: Jogo.pontos
    };
  })()`, ctx);

  assert.equal(r.eu.nome, 'HOST');
  assert.equal(r.eu.x, 700);
  assert.equal(r.inimigo.tipo, 'corredor');
  assert.equal(r.inimigo.temDef, true, 'a tabela do inimigo é remontada no convidado, não trafega');
  assert.equal(r.inimigo.x, 900);
  assert.equal(r.inimigo.instancia, true);
  assert.equal(r.projetil.n, 1);
  assert.equal(r.projetil.instancia, true);
  assert.equal(r.projetil.temRastro, true);
  assert.equal(r.coletavel.n, 1);
  assert.equal(r.coletavel.valor, 3);
  assert.equal(r.coletavel.temDef, true);
  assert.equal(r.onda, 6);
  assert.equal(r.pontos, 1234);
  assert.ok(r.bytes < 8000, 'snapshot de partida pequena não pode passar de alguns KB');
});

test('snapshot sem o próprio jogador não apaga a nave do convidado', () => {
  const ctx = mundoCoop();
  const r = vm.runInContext(`(() => {
    Coop.papel = 'convidado';
    Coop.id = 'eu';
    Jogo.jogador = new Jogador('sniper', null);
    Jogo.outros = new Map();
    Coop.aplicarEstado({ jogadores: [], inimigos: [], projeteis: [], coletaveis: [],
      onda: 1, pontos: 0, tempo: 0, tempoJogo: 0, modo: 'jogando' });
    return Jogo.jogador !== null;
  })()`, ctx);
  assert.equal(r, true);
});

test('entidade com o mesmo id é reaproveitada para a interpolação ter continuidade', () => {
  const ctx = mundoCoop();
  const r = vm.runInContext(`(() => {
    Coop.papel = 'convidado';
    Coop.id = 'eu';
    Jogo.jogador = new Jogador('sniper', null);
    const base = { jogadores: [], projeteis: [], coletaveis: [], onda: 1, pontos: 0, tempo: 0, tempoJogo: 0, modo: 'jogando' };
    Coop.aplicarEstado({ ...base, inimigos: [{ id: 7, tipo: 'corredor', x: 100, y: 100, vx: 60, vy: 0, a: 0, vida: 9, vidaMax: 9, raio: 14, escala: 1, flash: 0, nascendo: 0, estado: 'normal', fase: 0, vivo: true }] });
    const primeiro = Jogo.inimigos[0];
    Coop.aplicarEstado({ ...base, inimigos: [{ id: 7, tipo: 'corredor', x: 160, y: 100, vx: 60, vy: 0, a: 0, vida: 5, vidaMax: 9, raio: 14, escala: 1, flash: 0, nascendo: 0, estado: 'normal', fase: 0, vivo: true }] });
    const mesmo = Jogo.inimigos[0] === primeiro;
    const antesDeSuavizar = Math.round(Jogo.inimigos[0].x);
    Coop.avancarAlvos(0.05);
    Coop.suavizar(0.05);
    return { mesmo, antesDeSuavizar, vida: Jogo.inimigos[0].vida, depois: Jogo.inimigos[0].x > antesDeSuavizar };
  })()`, ctx);
  assert.equal(r.mesmo, true, 'o mesmo id tem que devolver o mesmo objeto');
  assert.equal(r.antesDeSuavizar, 100, 'a posição desenhada não salta para o snapshot novo');
  assert.equal(r.vida, 5, 'os demais campos vêm do snapshot na hora');
  assert.equal(r.depois, true, 'a interpolação caminha na direção do alvo');
});

test('previsão local move a nave sem simular tiro nem dano', () => {
  const ctx = mundoCoop();
  const r = vm.runInContext(`(() => {
    Jogo.jogador = new Jogador('sniper', null);
    const antes = { x: Jogo.jogador.x, tiros: Jogo.projeteis.length, recarga: Jogo.jogador.recargaTiro };
    const controles = { mira: { x: 0, y: 0, ativo: false }, modoToque: false, mouseX: 5000, mouseY: 0,
      botaoDireito: true, eixoX: () => 1, eixoY: () => 0, atirando: () => true, apertou: () => true };
    for (let i = 0; i < 30; i++) Jogo.jogador.moverPrevisto(1 / 60, controles);
    return { andou: Jogo.jogador.x - antes.x, projeteis: Jogo.projeteis.length,
      recargaIgual: Jogo.jogador.recargaTiro === antes.recarga };
  })()`, ctx);
  assert.ok(r.andou > 50, 'meio segundo de input tem que deslocar a nave');
  assert.equal(r.projeteis, 0, 'previsão local nunca cria projétil — quem atira é o anfitrião');
  assert.equal(r.recargaIgual, true, 'previsão local não mexe em temporizador de combate');
});

test('serviço de salas encaminha comandos, lota em 4 e recusa o quinto', async () => {
  process.env.PORT = '8791';
  const WebSocket = require('ws');
  const { servidor, salas } = require(path.join(raiz, 'servidor/salas.js'));
  if (!servidor.listening) await new Promise((ok) => servidor.once('listening', ok));

  const abrir = () => new Promise((ok) => {
    const s = new WebSocket('ws://127.0.0.1:8791/sala');
    s.fila = [];
    s.esperar = (tipo) => new Promise((pronto) => {
      const achado = s.fila.find((m) => m.tipo === tipo);
      if (achado) { s.fila.splice(s.fila.indexOf(achado), 1); pronto(achado); return; }
      s.aguardando = { tipo, pronto };
    });
    s.on('message', (bruto) => {
      const m = JSON.parse(bruto);
      if (s.aguardando && s.aguardando.tipo === m.tipo) { const a = s.aguardando; s.aguardando = null; a.pronto(m); }
      else s.fila.push(m);
    });
    s.on('open', () => ok(s));
  });

  const anfitriao = await abrir();
  anfitriao.send(JSON.stringify({ tipo: 'criar' }));
  const criada = await anfitriao.esperar('criada');
  assert.match(criada.codigo, /^[A-F0-9]{8}$/);

  const convidados = [];
  for (let i = 0; i < 3; i++) {
    const c = await abrir();
    c.send(JSON.stringify({ tipo: 'entrar', codigo: criada.codigo, classe: 'sniper', skin: 'padrao', nome: 'P' + i }));
    const entrou = await c.esperar('entrou');
    assert.ok(entrou.id, 'convidado recebe um id');
    await anfitriao.esperar('entrou');
    convidados.push(c);
  }
  assert.equal(salas.get(criada.codigo).convidados.size, 3);

  const quinto = await abrir();
  quinto.send(JSON.stringify({ tipo: 'entrar', codigo: criada.codigo, classe: 'sniper', skin: 'padrao', nome: 'X' }));
  const erro = await quinto.esperar('erro');
  assert.match(erro.mensagem, /cheia/);

  // comando sobe para o anfitrião; snapshot desce para todos os convidados
  convidados[0].send(JSON.stringify({ tipo: 'controle', controle: { x: 1 } }));
  const comando = await anfitriao.esperar('controle');
  assert.equal(comando.controle.x, 1);

  anfitriao.send(JSON.stringify({ tipo: 'estado', estado: { onda: 3 } }));
  for (const c of convidados) assert.equal((await c.esperar('estado')).estado.onda, 3);

  // anfitrião cai: a sala some e os convidados são avisados
  anfitriao.close();
  for (const c of convidados) assert.equal((await c.esperar('encerrada')).tipo, 'encerrada');
  assert.equal(salas.has(criada.codigo), false);

  for (const c of convidados) c.close();
  quinto.close();
  await new Promise((ok) => servidor.close(ok));
});
