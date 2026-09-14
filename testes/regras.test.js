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

test('arena ampliada mantém janela, câmera e mira em coordenadas do mundo', () => {
  const mundo = vm.createContext({ console, Math });
  for (const arquivo of ['src/nucleo.js', 'src/classes.js', 'src/entidades.js', 'src/jogo.js']) {
    vm.runInContext(fs.readFileSync(path.join(raiz, arquivo), 'utf8'), mundo, { filename: arquivo });
  }
  const dados = vm.runInContext(`(() => {
    Jogo.jogador = { x: 1900, y: 1000 };
    Camera.zoom = 1;
    Camera.zoomAlvo = 1;
    Camera.atualizar(0);
    const centro = Camera.telaParaMundo(640, 360);
    const canto = Camera.telaParaMundo(0, 0);
    const boss = new Boss(BOSSES[0], 5);
    return { arena: [Jogo.LARGURA, Jogo.ALTURA], janela: [Jogo.VISAO_LARGURA, Jogo.VISAO_ALTURA],
      centro: [centro.x, centro.y], canto: [canto.x, canto.y], boss: [boss.x, boss.baseY] };
  })()`, mundo);
  assert.deepEqual(Array.from(dados.arena), [2560, 1440]);
  assert.deepEqual(Array.from(dados.janela), [1280, 720]);
  assert.deepEqual(Array.from(dados.centro), [1900, 1000]);
  assert.deepEqual(Array.from(dados.canto), [1260, 640]);
  assert.deepEqual(Array.from(dados.boss), [2200, 760]);
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
