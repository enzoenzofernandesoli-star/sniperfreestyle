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

test('a corrida termina na onda 100 e o boss final fica fora do rodízio', () => {
  assert.equal(vm.runInContext('Jogo.TOTAL_ONDAS', contexto), 100);
  assert.equal(vm.runInContext('Jogo.ehOndaDeBoss(40)', contexto), true);
  assert.equal(vm.runInContext('Jogo.ehOndaDeBoss(100)', contexto), true);
  const dados = vm.runInContext(`(() => {
    const rodizio = BOSSES.filter((b) => !b.final);
    const finais = BOSSES.filter((b) => b.final);
    const naOnda = (o) => (o >= Jogo.TOTAL_ONDAS)
      ? finais[0].id
      : rodizio[(Math.floor(o / 5) - 1) % rodizio.length].id;
    return { rodizio: rodizio.length, finais: finais.map((b) => b.id),
      onda40: naOnda(40), onda45: naOnda(45), onda100: naOnda(100),
      vidaFinal: finais[0].vida, tiroFinal: finais[0].velocidadeTiro };
  })()`, contexto);
  assert.equal(dados.rodizio, 8, 'os oito bosses de sempre seguem no rodízio');
  assert.deepEqual(Array.from(dados.finais), ['ceifador'], 'só um boss final');
  assert.equal(dados.onda40, 'nucleo');
  assert.equal(dados.onda45, 'sentinela', 'depois do oitavo o rodízio recomeça');
  assert.equal(dados.onda100, 'ceifador', 'a onda 100 é sempre o CEIFADOR');
  assert.ok(dados.vidaFinal >= 9000 && dados.tiroFinal > 2, 'o final tem mais vida e bala mais rápida');
});

test('coração tem teto de 6, venha de onde vier', () => {
  const mundo = vm.createContext({ console, Math, setTimeout });
  for (const arquivo of ['src/nucleo.js', 'src/classes.js', 'src/entidades.js', 'src/jogo.js']) {
    vm.runInContext(fs.readFileSync(path.join(raiz, arquivo), 'utf8'), mundo, { filename: arquivo });
  }
  const dados = vm.runInContext(`(() => {
    Jogo.onda = 1;
    const j = new Jogador('guardiao', 'original');
    const antes = j.attr.vidaMax;
    const coracao = MELHORIAS.find((m) => m.id === 'vida');
    for (let i = 0; i < 10; i++) j.aplicarMelhoria(coracao);
    return { antes, depois: j.attr.vidaMax, teto: Jogador.VIDA_MAXIMA };
  })()`, mundo);
  assert.equal(dados.teto, 6);
  assert.equal(dados.depois, 6, 'dez melhorias de vida param no teto');
  assert.ok(dados.antes <= 6);
});

test('a EXECUÇÃO do boss final mata com qualquer quantidade de coração', () => {
  const mundo = vm.createContext({ console, Math, setTimeout });
  for (const arquivo of ['src/nucleo.js', 'src/classes.js', 'src/entidades.js', 'src/jogo.js']) {
    vm.runInContext(fs.readFileSync(path.join(raiz, arquivo), 'utf8'), mundo, { filename: arquivo });
  }
  // a morte passa por registrarPartida, que fala com Coop e UI — aqui só o
  // resultado do dano interessa
  vm.runInContext(`var Coop = { ativo: () => false };
    var UI = { mostrarFinal() {}, atualizarHUD() {}, mostrarTela() {}, esconderBarraBoss() {} };
    var Perfil = { exibir: () => 'TESTE' };
    var Placar = { enviar() {}, configurado: () => false };`, mundo);
  const dados = vm.runInContext(`(() => {
    Jogo.onda = 100;
    const j = new Jogador('guardiao', 'original');
    Jogo.jogador = j;
    j.attr.vidaMax = Jogador.VIDA_MAXIMA; j.vida = Jogador.VIDA_MAXIMA;
    const ceifador = BOSSES.find((b) => b.final);
    const lamina = ceifador.fases.every((f) => f.ataques.includes('execucao'));
    j.receberDano(99, 0, 0);
    return { lamina, vidaDepois: j.vida };
  })()`, mundo);
  assert.equal(dados.lamina, true, 'a EXECUÇÃO está em todas as fases dele');
  assert.ok(dados.vidaDepois <= 0, 'seis corações não sobrevivem a uma lâmina');
});

test('arena cabe em uma tela e a câmera fica no centro', () => {
  const mundo = vm.createContext({ console, Math });
  for (const arquivo of ['src/nucleo.js', 'src/classes.js', 'src/entidades.js', 'src/jogo.js']) {
    vm.runInContext(fs.readFileSync(path.join(raiz, arquivo), 'utf8'), mundo, { filename: arquivo });
  }
  const dados = vm.runInContext(`(() => {
    Jogo.jogador = { x: 1400, y: 800 };
    Camera.zoom = 1;
    Camera.zoomAlvo = 1;
    Camera.atualizar(0);
    const centro = Camera.telaParaMundo(Jogo.LARGURA / 2, Jogo.ALTURA / 2);
    const canto = Camera.telaParaMundo(0, 0);
    const boss = new Boss(BOSSES[0], 5);
    return { arena: [Jogo.LARGURA, Jogo.ALTURA], camera: [Camera.centroX, Camera.centroY],
      centro: [centro.x, centro.y], canto: [canto.x, canto.y], boss: [boss.x, boss.baseY] };
  })()`, mundo);
  assert.deepEqual(Array.from(dados.arena), [1760, 990]);
  assert.deepEqual(Array.from(dados.camera), [880, 495]);
  assert.deepEqual(Array.from(dados.centro), [880, 495]);
  assert.deepEqual(Array.from(dados.canto), [0, 0]);
  assert.deepEqual(Array.from(dados.boss), [880, 150]);
});

test('as cinco classes têm três skins cosméticas cada', () => {
  const dados = vm.runInContext('CLASSES.map(c => ({ id: c.id, vida: c.atributos.vidaMax, skins: SKINS[c.id].length }))', contexto);
  assert.deepEqual(Array.from(dados, (d) => [d.vida, d.skins]), [[2, 3], [4, 3], [2, 3], [2, 3], [3, 3]]);
  assert.equal(vm.runInContext("skinDaClasse('sniper', 'inexistente').id", contexto), 'original');
});

test('dificuldade infinita cresce devagar e sem parar', () => {
  const dados = vm.runInContext(`(() => {
    Jogo.onda = 1;
    const inicio = { vida: Jogo.multiplicadorVida(), veloc: Jogo.aceleracaoOnda(), elite: Jogo.sorteiaElite() };
    Jogo.onda = 40;
    const fim = { vida: Jogo.multiplicadorVida(), veloc: Jogo.aceleracaoOnda(), ritmo: Jogo.ritmoInimigo() };
    Jogo.onda = 140;
    const infinito = { vida: Jogo.multiplicadorVida(), veloc: Jogo.aceleracaoOnda(), ritmo: Jogo.ritmoInimigo() };
    return { inicio, fim, infinito };
  })()`, contexto);
  assert.equal(dados.inicio.vida, 1);
  assert.equal(dados.inicio.elite, false, 'elite não aparece na onda 1');
  assert.ok(dados.fim.vida > 4 && dados.fim.vida < 5, 'onda 40 fica dura sem virar parede cedo');
  assert.ok(dados.infinito.vida > dados.fim.vida, 'vida continua crescendo depois da antiga onda final');
  assert.ok(dados.infinito.veloc >= dados.fim.veloc, 'velocidade não regride');
  assert.ok(dados.infinito.ritmo <= dados.fim.ritmo, 'cadência não regride');
});

test('elite é bem mais duro que o comum do mesmo tipo', () => {
  const mundo = vm.createContext({ console, Math });
  for (const arquivo of ['src/nucleo.js', 'src/classes.js', 'src/entidades.js', 'src/jogo.js']) {
    vm.runInContext(fs.readFileSync(path.join(raiz, arquivo), 'utf8'), mundo, { filename: arquivo });
  }
  const dados = vm.runInContext(`(() => {
    Jogo.onda = 20;
    const comum = new Inimigo('corredor', 100, 100, 1, false);
    const elite = new Inimigo('corredor', 100, 100, 1, true);
    return { comum: comum.vidaMax, elite: elite.vidaMax, raioComum: comum.raio, raioElite: elite.raio };
  })()`, mundo);
  assert.ok(dados.elite > dados.comum * 3, 'elite passa de três vezes a vida do comum');
  assert.ok(dados.raioElite > dados.raioComum, 'e é visivelmente maior');
});

test('a onda traz menos inimigos, e cada onda até a 12 estreia um tipo', () => {
  const dados = vm.runInContext(`(() => {
    const porOnda = {};
    for (const [id, t] of Object.entries(TIPOS_INIMIGO)) porOnda[t.desde] = id;
    const estreias = [];
    for (let o = 1; o <= 12; o++) estreias.push(porOnda[o] || null);
    Jogo.jogador = null;
    const tetos = [];
    for (const o of [1, 10, 20, 40]) {
      Jogo.onda = o;
      tetos.push(Math.min(14, Math.round(4 + o * 0.45)));
    }
    return { estreias, tetos };
  })()`, contexto);
  assert.equal(Array.from(dados.estreias).filter(Boolean).length, 12, 'uma estreia por onda até a 12');
  assert.deepEqual(Array.from(dados.tetos), [4, 9, 13, 14], 'teto de inimigos vivos ficou baixo');
});

test('melhoria repetida perde peso e o teto de cópias é no máximo 4', () => {
  const dados = vm.runInContext(`(() => {
    const jogador = { melhorias: {} };
    const dano = MELHORIAS.find((m) => m.id === 'dano');
    const limpo = pesoMelhoria(jogador, dano);
    jogador.melhorias.dano = 2;
    return { limpo, repetido: pesoMelhoria(jogador, dano), maiorTeto: Math.max(...MELHORIAS.map((m) => m.max)),
      tiros: MELHORIAS.find((m) => m.id === 'projetil').max };
  })()`, contexto);
  assert.ok(dados.repetido < dados.limpo * 0.25, 'terceira cópia vale bem menos que a primeira');
  assert.equal(dados.maiorTeto, 4);
  assert.equal(dados.tiros, 3, 'no máximo três projéteis extras por tiro');
});

test('INVOCADOR enfraquecido nasce com dois drones e só ele recebe a melhoria de drone', () => {
  const mundo = vm.createContext({ console, Math, setTimeout });
  for (const arquivo of ['src/nucleo.js', 'src/classes.js', 'src/entidades.js', 'src/jogo.js']) {
    vm.runInContext(fs.readFileSync(path.join(raiz, arquivo), 'utf8'), mundo, { filename: arquivo });
  }
  const dados = vm.runInContext(`(() => {
    Jogo.onda = 1;
    const inv = new Jogador('invocador', 'original');
    const sniper = new Jogador('sniper', 'original');
    const pool = MELHORIAS.filter((m) => !m.exige || m.exige(sniper)).map((m) => m.id);
    const poolInv = MELHORIAS.filter((m) => !m.exige || m.exige(inv)).map((m) => m.id);
    inv.aplicarMelhoria(MELHORIAS.find((m) => m.id === 'lacaio'));
    return { drones: inv.lacaios.length, dronesSniper: sniper.lacaios.length,
      sniperVeDrone: pool.includes('lacaio'), invVeDrone: poolInv.includes('lacaio'),
      temDilatacao: pool.includes('tempo'), temEstilhaco: pool.includes('explode') };
  })()`, mundo);
  assert.equal(dados.dronesSniper, 0, 'classe sem drone não ganha drone');
  assert.equal(dados.drones, 3, 'dois de base mais um da melhoria');
  assert.equal(dados.sniperVeDrone, false, 'melhoria de drone não polui o sorteio das outras classes');
  assert.equal(dados.invVeDrone, true);
  assert.equal(dados.temDilatacao, false, 'dilatação de tempo saiu do jogo');
  assert.equal(dados.temEstilhaco, false, 'estilhaço ao matar saiu do jogo');
});

test('possessão exige 35% de vida e 100 px, preserva progresso e expulsa a alma no fim', () => {
  const mundo = vm.createContext({ console, Math, setTimeout, UI: { aviso() {} } });
  for (const arquivo of ['src/nucleo.js', 'src/classes.js', 'src/entidades.js', 'src/jogo.js']) {
    vm.runInContext(fs.readFileSync(path.join(raiz, arquivo), 'utf8'), mundo, { filename: arquivo });
  }
  const dados = vm.runInContext(`(() => {
    Particulas.iniciar();
    Jogo.onda = 12; Jogo.pontos = 777; Jogo.multiplicador = 4;
    const j = Jogo.jogador = new Jogador('sniper', 'original');
    j.x = 500; j.y = 500; j.vida = 1.5; j.nivel = 6; j.melhorias.dano = 2;
    const longe = new Inimigo('bruto', 601, 500, 1, false);
    longe.vida = longe.vidaMax * 0.34;
    const cheio = new Inimigo('atirador', 580, 500, 1, false);
    cheio.vida = cheio.vidaMax * 0.36;
    Jogo.inimigos = [longe, cheio];
    const bloqueado = j.alternarPossessao();
    longe.x = 600;
    const entrou = j.alternarPossessao();
    const durante = { tipo: j.corpoPossuido.tipo, vida: j.vida, raio: j.raio,
      pontos: Jogo.pontos, nivel: j.nivel, melhoria: j.melhorias.dano, alvoConsumido: !longe.vivo };
    j.atualizarPossessao(12.6);
    return { bloqueado, entrou, durante, depois: { possuido: !!j.corpoPossuido, vida: j.vida,
      raio: j.raio, pontos: Jogo.pontos, onda: Jogo.onda, multi: Jogo.multiplicador } };
  })()`, mundo);
  assert.equal(dados.bloqueado, false, '101 px não alcança e inimigo com 36% não serve');
  assert.equal(dados.entrou, true);
  assert.equal(dados.durante.tipo, 'bruto');
  assert.equal(dados.durante.alvoConsumido, true, 'corpo sai da lista sem virar abate');
  assert.ok(dados.durante.raio > 16);
  assert.deepEqual([dados.durante.pontos, dados.durante.nivel, dados.durante.melhoria], [777, 6, 2]);
  assert.deepEqual([dados.depois.possuido, dados.depois.vida, dados.depois.raio], [false, 1.5, 16]);
  assert.deepEqual([dados.depois.pontos, dados.depois.onda, dados.depois.multi], [777, 12, 4]);
});

test('inimigos tratam corpo possuído como aliado e miram outro jogador no cooperativo', () => {
  const mundo = vm.createContext({ console, Math, setTimeout, UI: { aviso() {} } });
  for (const arquivo of ['src/nucleo.js', 'src/classes.js', 'src/entidades.js', 'src/jogo.js']) {
    vm.runInContext(fs.readFileSync(path.join(raiz, arquivo), 'utf8'), mundo, { filename: arquivo });
  }
  const dados = vm.runInContext(`(() => {
    const disfarcado = Jogo.jogador = new Jogador('sniper', 'original');
    disfarcado.x = 100; disfarcado.y = 100;
    disfarcado.corpoPossuido = { tipo: 'corredor', tempo: 10, vidaMax: 10, velocidade: 100 };
    const sozinho = Jogo.alvoJogador(110, 100);
    const colega = new Jogador('guardiao', 'original');
    colega.x = 900; colega.y = 500;
    Jogo.outros.set('colega', colega);
    const emEquipe = Jogo.alvoJogador(110, 100);
    return { sozinho: sozinho === null, mirouColega: emEquipe === colega };
  })()`, mundo);
  assert.equal(dados.sozinho, true, 'sozinho possuído não recebe alvo');
  assert.equal(dados.mirouColega, true, 'inimigo troca a mira para jogador não possuído');
});

test('busca de alvo não cria lista temporária por inimigo', () => {
  const mundo = vm.createContext({ console, Math });
  for (const arquivo of ['src/nucleo.js', 'src/classes.js', 'src/entidades.js', 'src/jogo.js']) {
    vm.runInContext(fs.readFileSync(path.join(raiz, arquivo), 'utf8'), mundo, { filename: arquivo });
  }
  const dados = vm.runInContext(`(() => {
    Jogo.jogador = { x: 10, y: 10, vida: 1, corpoPossuido: {} };
    Jogo.outros = new Map([['livre', { x: 80, y: 20, vida: 1, corpoPossuido: null }]]);
    Jogo.jogadores = () => { throw new Error('alocação no caminho quente'); };
    return Jogo.alvoJogador(0, 0) === Jogo.outros.get('livre');
  })()`, mundo);
  assert.equal(dados, true);
});

test('coletável continua seguindo jogador possuído e boss não ataca sem alvo hostil', () => {
  const mundo = vm.createContext({ console, Math, setTimeout });
  for (const arquivo of ['src/nucleo.js', 'src/classes.js', 'src/entidades.js', 'src/jogo.js']) {
    vm.runInContext(fs.readFileSync(path.join(raiz, arquivo), 'utf8'), mundo, { filename: arquivo });
  }
  const dados = vm.runInContext(`(() => {
    Jogo.onda = 5; Particulas.iniciar();
    const j = Jogo.jogador = new Jogador('sniper', 'original');
    j.corpoPossuido = { tipo: 'corredor', tempo: 10, vidaMax: 10, velocidade: 100 };
    const xpAntes = j.xp;
    const xp = new Coletavel('xp', j.x + 20, j.y, 2);
    xp.atualizar(1 / 60);
    const boss = new Boss(BOSSES[0], 5);
    boss.entrando = 0; boss.telegrafo = 0; boss.recarga = 0;
    boss.atualizar(1 / 60);
    boss.executarAtaque('anel');
    return { xpColetado: j.xp > xpAntes, velocidadeXp: Math.hypot(xp.vx, xp.vy), tiros: Jogo.projeteis.length };
  })()`, mundo);
  assert.equal(dados.xpColetado, true);
  assert.ok(Number.isFinite(dados.velocidadeXp));
  assert.equal(dados.tiros, 0);
});

test('corpo destruído absorve a morte e devolve a alma viva no mesmo lugar', () => {
  const mundo = vm.createContext({ console, Math, setTimeout, UI: { aviso() {} } });
  for (const arquivo of ['src/nucleo.js', 'src/classes.js', 'src/entidades.js', 'src/jogo.js']) {
    vm.runInContext(fs.readFileSync(path.join(raiz, arquivo), 'utf8'), mundo, { filename: arquivo });
  }
  const dados = vm.runInContext(`(() => {
    Particulas.iniciar(); Jogo.onda = 8;
    const j = Jogo.jogador = new Jogador('guardiao', 'original');
    j.x = 400; j.y = 300; j.vida = 2.5;
    const e = new Inimigo('corredor', 450, 300, 1, false); e.vida = 0.2; Jogo.inimigos = [e];
    j.alternarPossessao(); const x = j.x, y = j.y;
    j.invulneravel = 0; j.receberDano(2, 0, 0);
    return { possuido: !!j.corpoPossuido, vida: j.vida, x: j.x, y: j.y, origem: [x, y], inv: j.invulneravel };
  })()`, mundo);
  assert.equal(dados.possuido, false);
  assert.equal(dados.vida, 2.5);
  assert.deepEqual([dados.x, dados.y], Array.from(dados.origem));
  assert.ok(dados.inv >= 1.4, 'alma volta com janela curta para escapar');
});

test('corpo possuído usa ataque, especial e atravessa snapshot do cooperativo', () => {
  const ctx = mundoCoop();
  const dados = vm.runInContext(`(() => {
    Particulas.iniciar(); Jogo.onda = 12;
    const j = Jogo.jogador = new Jogador('arcano', 'original');
    const e = new Inimigo('torreta', j.x + 60, j.y, 1, false);
    e.vida = e.vidaMax * 0.2; Jogo.inimigos = [e];
    j.alternarPossessao();
    const antes = Jogo.projeteis.length;
    j.atirarPossuido();
    j.usarEspecialPossuido({ eixoX: () => 0, eixoY: () => 0 });
    const pacote = Coop.empacotarJogador('eu', j);
    const copia = new Jogador('arcano', 'original');
    Coop.absorverJogador(copia, pacote);
    return { tiros: Jogo.projeteis.length - antes, tipo: copia.corpoPossuido.tipo,
      tempo: copia.corpoPossuido.tempo, raio: copia.raio, especial: copia.corpoPossuido.especial };
  })()`, ctx);
  assert.ok(dados.tiros >= 6, 'torreta herda rajada básica e especial radial');
  assert.equal(dados.tipo, 'torreta');
  assert.ok(dados.tempo > 12 && dados.tempo <= 12.5);
  assert.ok(dados.raio > 16);
  assert.ok(dados.especial > 3);
});

test('pool de partículas devolve o índice e não varre tudo quando enche', () => {
  const mundo = vm.createContext({ console, Math });
  vm.runInContext(fs.readFileSync(path.join(raiz, 'src/nucleo.js'), 'utf8'), mundo, { filename: 'src/nucleo.js' });
  const dados = vm.runInContext(`(() => {
    Config.particulasAtivas = true;
    Particulas.limite = 10;
    Particulas.iniciar();
    for (let i = 0; i < 25; i++) Particulas.emitir({ x: 0, y: 0, vida: 1 });
    const cheio = { ativas: Particulas.pool.filter((p) => p.ativa).length, livres: Particulas.livres.length };
    Particulas.atualizar(2);
    const vazio = { ativas: Particulas.pool.filter((p) => p.ativa).length, livres: Particulas.livres.length };
    return { cheio, vazio };
  })()`, mundo);
  assert.deepEqual([dados.cheio.ativas, dados.cheio.livres], [10, 0], 'enche até o limite e não estoura');
  assert.deepEqual([dados.vazio.ativas, dados.vazio.livres], [0, 10], 'partícula morta devolve o slot');
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

test('API aceita até a onda 100, recusa além, e conhece o INVOCADOR', async () => {
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

  const responder = async (onda, classe) => {
    const resposta = {
      codigo: 0,
      setHeader() {},
      status(codigo) { this.codigo = codigo; return this; },
      json(corpo) { this.corpo = corpo; return this; }
    };
    await api({ method: 'POST', body: {
      nome: 'TESTE', pontos: 1000, classe: classe || 'SNIPER', onda,
      nivel: 1, tempo: 60, abates: 5, venceu: false
    } }, resposta);
    return resposta;
  };

  assert.equal((await responder(40)).codigo, 201);
  assert.equal((await responder(100)).codigo, 201, 'a onda final entra no placar');
  assert.equal((await responder(101)).codigo, 400, 'onda acima do teto é recusada');
  assert.equal((await responder(40, 'INVOCADOR')).codigo, 201, 'a classe nova é aceita');
  assert.equal((await responder(40, 'MAGO')).codigo, 400, 'classe inventada é recusada');
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
    UI: { mostrarTela() {}, atualizarHUD() {}, montarEquipe() {}, mostrarFinal() {}, atualizarEspera() {}, aviso() {} }
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
      mouseX: 999999, mouseY: -999999, tiro: true, dash: true, especial: false, possessao: true, ult: true });
    return { x: c.eixoX(), y: c.eixoY(), miraX: c.mira.x, mouseX: c.mouseX, mouseY: c.mouseY,
      tiro: c.atirando(), dash: c.apertou('Space'), especial: c.apertou('KeyQ'),
      possessao: c.apertou('KeyE'), ult: c.apertou('ShiftLeft') };
  })()`, ctx);
  assert.equal(r.x, 1);
  assert.equal(r.y, -1);
  assert.equal(r.miraX, 1);
  assert.ok(r.mouseX <= 2560 * 2, 'mira não pode apontar para fora da arena');
  assert.ok(r.mouseY >= -1440, 'mira não pode apontar para fora da arena');
  assert.equal(r.tiro, true);
  assert.equal(r.dash, true);
  assert.equal(r.especial, false);
  assert.equal(r.possessao, true);
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

  // código escolhido pelo anfitrião: aceito uma vez, recusado em duplicata
  const dono = await abrir();
  dono.send(JSON.stringify({ tipo: 'criar', codigo: 'enzo01' }));
  assert.equal((await dono.esperar('criada')).codigo, 'ENZO01');

  const clone = await abrir();
  clone.send(JSON.stringify({ tipo: 'criar', codigo: 'ENZO01' }));
  assert.match((await clone.esperar('erro')).mensagem, /já está em uso/);
  clone.send(JSON.stringify({ tipo: 'criar', codigo: 'A!' }));
  assert.match((await clone.esperar('erro')).mensagem, /inválido/);
  clone.close();

  // painel da sala: convidado entra sem classe, avisa a classe depois e só
  // entra na arena quando o anfitrião manda começar
  const cedo = await abrir();
  cedo.send(JSON.stringify({ tipo: 'entrar', codigo: 'ENZO01', nome: 'ANA' }));
  assert.equal((await cedo.esperar('entrou')).codigo, 'ENZO01');
  assert.equal((await dono.esperar('entrou')).nome, 'ANA');

  cedo.send(JSON.stringify({ tipo: 'pronto', classe: 'guardiao', skin: 'padrao', nome: 'ANA' }));
  assert.equal((await dono.esperar('pronto')).classe, 'guardiao');

  dono.send(JSON.stringify({ tipo: 'lobby', lista: [{ id: 'anfitriao', nome: 'EU' }, { id: 'x', nome: 'ANA' }] }));
  assert.equal((await cedo.esperar('lobby')).lista.length, 2);
  dono.send(JSON.stringify({ tipo: 'comecou' }));
  assert.equal((await cedo.esperar('comecou')).tipo, 'comecou');

  // convidado não dá largada nem publica painel: só o anfitrião
  cedo.send(JSON.stringify({ tipo: 'comecou' }));
  cedo.send(JSON.stringify({ tipo: 'lobby', lista: [] }));
  dono.send(JSON.stringify({ tipo: 'estado', estado: { onda: 1 } }));
  assert.equal((await cedo.esperar('estado')).estado.onda, 1, 'nada do convidado voltou como comando de sala');

  cedo.close();
  dono.close();

  const anfitriao = await abrir();
  anfitriao.send(JSON.stringify({ tipo: 'criar' }));
  const criada = await anfitriao.esperar('criada');
  assert.match(criada.codigo, /^[A-F0-9]{8}$/);

  const convidados = [];
  for (let i = 0; i < 3; i++) {
    const c = await abrir();
    c.send(JSON.stringify({ tipo: 'entrar', codigo: criada.codigo, nome: 'P' + i }));
    const entrou = await c.esperar('entrou');
    assert.ok(entrou.id, 'convidado recebe um id');
    await anfitriao.esperar('entrou');
    convidados.push(c);
  }
  assert.equal(salas.get(criada.codigo).convidados.size, 3);

  const quinto = await abrir();
  quinto.send(JSON.stringify({ tipo: 'entrar', codigo: criada.codigo, nome: 'X' }));
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

test('placar cai para o servidor de reserva quando o site está sem banco', async () => {
  const mundo = vm.createContext({ console, Math, URL, location: { href: 'https://site.exemplo/', host: 'site.exemplo' } });
  vm.runInContext(fs.readFileSync(path.join(raiz, 'src/placar-config.js'), 'utf8'), mundo, { filename: 'placar-config.js' });
  vm.runInContext(fs.readFileSync(path.join(raiz, 'src/placar.js'), 'utf8'), mundo, { filename: 'placar.js' });

  const pedidos = [];
  mundo.localStorage = { getItem: () => null, setItem() {} };
  mundo.fetch = async (endereco) => {
    pedidos.push(endereco);
    if (endereco.indexOf('http') !== 0) {
      return { ok: false, json: async () => ({ erro: 'placar sem banco configurado: defina DATABASE_URL' }) };
    }
    return { ok: true, json: async () => [{ nome: 'ANA', pontos: 10 }] };
  };

  const linhas = await vm.runInContext('Placar.top(true)', mundo);
  assert.equal(Array.isArray(linhas) && linhas.length, 1, 'o top veio do servidor de reserva');
  assert.equal(pedidos.length, 2, 'tentou o próprio site e só então a reserva');
  assert.ok(pedidos[1].startsWith('https://'), 'a segunda tentativa foi no endereço de reserva');
  assert.equal(vm.runInContext('Placar.usandoReserva', mundo), true);
});

test('boss é de 5 em 5 até a 40 e de 10 em 10 depois', () => {
  const dados = vm.runInContext(`(() => {
    const ondas = [];
    for (let o = 1; o <= 100; o++) if (Jogo.ehOndaDeBoss(o)) ondas.push(o);
    return { ondas, encontro40: Jogo.encontroDeBoss(40), encontro100: Jogo.encontroDeBoss(100),
      passouDoFim: Jogo.ehOndaDeBoss(105) };
  })()`, contexto);
  const ondas = Array.from(dados.ondas);
  assert.deepEqual(ondas.slice(0, 8), [5, 10, 15, 20, 25, 30, 35, 40], 'de 5 em 5 até a 40');
  assert.deepEqual(ondas.slice(8), [50, 60, 70, 80, 90, 100], 'de 10 em 10 daí em diante');
  assert.equal(dados.encontro40, 8, 'oito bosses até a onda 40');
  assert.equal(dados.encontro100, 14, 'catorze encontros até o final');
  assert.equal(dados.passouDoFim, false, 'não existe boss depois da onda 100');
});

test('escudo da couraça tem vida própria e quebra', () => {
  const mundo = vm.createContext({ console, Math, setTimeout });
  for (const arquivo of ['src/nucleo.js', 'src/classes.js', 'src/entidades.js', 'src/jogo.js']) {
    vm.runInContext(fs.readFileSync(path.join(raiz, arquivo), 'utf8'), mundo, { filename: arquivo });
  }
  const dados = vm.runInContext(`(() => {
    Jogo.onda = 10;
    const couraca = new Inimigo('couraca', 300, 300, 1, false);
    const elite = new Inimigo('couraca', 300, 300, 1, true);
    const corredor = new Inimigo('corredor', 300, 300, 1, false);
    const antes = { escudo: couraca.escudoVida, veloc: couraca.velocidade };
    couraca.escudoVida = 0;
    couraca.quebrarEscudo();
    return { escudoComum: antes.escudo, escudoElite: elite.escudoVida, semEscudo: corredor.escudoVidaMax,
      acelerou: couraca.velocidade > antes.veloc, depois: couraca.escudoVida };
  })()`, mundo);
  assert.ok(dados.escudoComum > 0, 'a couraça nasce com escudo');
  assert.ok(dados.escudoElite > dados.escudoComum, 'elite carrega escudo reforçado');
  assert.equal(dados.semEscudo, 0, 'quem não tem escudo continua sem');
  assert.equal(dados.depois, 0);
  assert.equal(dados.acelerou, true, 'ao perder o escudo o bicho fica mais rápido');
});

test('bala do drone é um tiro do jogador: mesmo dano, crítico e melhorias', () => {
  const mundo = vm.createContext({ console, Math, setTimeout });
  for (const arquivo of ['src/nucleo.js', 'src/classes.js', 'src/entidades.js', 'src/jogo.js']) {
    vm.runInContext(fs.readFileSync(path.join(raiz, arquivo), 'utf8'), mundo, { filename: arquivo });
  }
  const dados = vm.runInContext(`(() => {
    Jogo.onda = 1;
    const j = new Jogador('invocador', 'original');
    Jogo.jogador = j;
    j.attr.critChance = 1;          // força o crítico para comparar o pior caso
    j.attr.perfuracao = 3;
    j.attr.ricochete = 2;
    Jogo.inimigos.length = 0;
    Jogo.projeteis.length = 0;
    const alvo = new Inimigo('corredor', j.x + 200, j.y, 1, false);
    alvo.nascendo = 0;
    Jogo.inimigos.push(alvo);
    for (const l of j.lacaios) l.recarga = 0;
    const tirosAntes = Jogo.estat.tiros;
    j.atualizarLacaios(0.016);
    const b = Jogo.projeteis[0];
    return { dano: b.dano, esperado: j.attr.dano * j.attr.critMult, critico: b.critico,
      perfuracao: b.perfuracao, ricochete: b.ricochete, dono: b.dono,
      contou: Jogo.estat.tiros - tirosAntes };
  })()`, mundo);
  assert.equal(dados.dono, 'jogador');
  assert.equal(dados.dano, dados.esperado, 'dano cheio, com o mesmo multiplicador de crítico');
  assert.equal(dados.critico, true);
  assert.equal(dados.perfuracao, 3, 'herda a perfuração das melhorias');
  assert.equal(dados.ricochete, 2, 'e o ricochete também');
  assert.ok(dados.contou >= 1, 'conta como tiro na estatística');
});
