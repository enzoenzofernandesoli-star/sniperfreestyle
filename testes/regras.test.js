const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const raiz = path.join(__dirname, '..');
const contexto = vm.createContext({ console, Math });
for (const arquivo of ['src/loja.js', 'src/classes.js', 'src/entidades.js', 'src/jogo.js']) {
  vm.runInContext(fs.readFileSync(path.join(raiz, arquivo), 'utf8'), contexto, { filename: arquivo });
}

test('o Ato I termina na onda 100 e o boss final fica fora do rodízio', () => {
  assert.equal(vm.runInContext('Jogo.TOTAL_ONDAS', contexto), 100);
  assert.equal(vm.runInContext('Jogo.ondaFinalDaCampanha()', contexto), 200);
  assert.equal(vm.runInContext('Jogo.ehOndaDeBoss(40)', contexto), true);
  assert.equal(vm.runInContext('Jogo.ehOndaDeBoss(100)', contexto), true);
  const dados = vm.runInContext(`(() => {
    const rodizio = Jogo.rodizioDoAto1();
    const finais = BOSSES.filter((b) => b.final);
    const secretos = BOSSES.filter((b) => b.secreto);
    // mesma conta que Jogo.spawnarBoss faz
    const naOnda = (o) => (o >= Jogo.TOTAL_ONDAS)
      ? finais[0].id
      : rodizio[(Jogo.encontroDeBoss(o) - 1) % rodizio.length].id;
    return { rodizio: rodizio.length, finais: finais.map((b) => b.id),
      onda40: naOnda(40), onda50: naOnda(50), onda90: naOnda(90), onda100: naOnda(100),
      nomes: rodizio.map((b) => b.id),
      vidaFinal: finais[0].vida, tiroFinal: finais[0].velocidadeTiro,
      secretos: secretos.map((b) => b.id) };
  })()`, contexto);
  assert.equal(dados.rodizio, 13, 'um boss diferente para cada encontro até a onda 90');
  assert.deepEqual(Array.from(dados.finais), ['ceifador'], 'só um boss final');
  assert.equal(dados.onda40, 'nucleo');
  assert.equal(dados.onda50, 'tita', 'a segunda volta traz bosses novos, não repetição');
  assert.equal(dados.onda90, 'arauto', 'o último do rodízio fecha a onda 90');
  assert.equal(dados.onda100, 'ceifador', 'a onda 100 é sempre o CEIFADOR');
  assert.equal(new Set(Array.from(dados.nomes)).size, 13, 'nenhum boss repetido no rodízio');
  assert.ok(dados.vidaFinal >= 9000 && dados.tiroFinal > 2, 'o final tem mais vida e bala mais rápida');
  assert.deepEqual(Array.from(dados.secretos), ['espectador'], 'o segredo existe e é um só');
});

test('O ESPECTADOR abre o Interstício, conversa e atravessa a campanha para NÁDIR', () => {
  // Coop entra como esboço: a run desta simulação não vai para placar nenhum.
  const mundo = vm.createContext({ console, Math, setTimeout,
    Coop: { ativo: () => true },
    UI: {
      aviso() {}, mostrarBarraBoss() {}, esconderBarraBoss() {}, atualizarBarraBoss() {},
      mostrarFinal() {}, atualizarHUD() {}
    } });
  for (const arquivo of ['src/nucleo.js', 'src/loja.js', 'src/classes.js', 'src/entidades.js', 'src/jogo.js']) {
    vm.runInContext(fs.readFileSync(path.join(raiz, arquivo), 'utf8'), mundo, { filename: arquivo });
  }
  const dados = vm.runInContext(`(() => {
    Particulas.iniciar();
    Jogo.jogador = new Jogador('sniper', 'original');
    Jogo.onda = Jogo.TOTAL_ONDAS;

    // Nenhuma onda normal chama o secreto: ele não está no rodízio.
    const rodizio = [];
    for (let o = 5; o <= 90; o += 5) {
      if (!Jogo.ehOndaDeBoss(o)) continue;
      Jogo.onda = o; Jogo.boss = null; Jogo.spawnarBoss();
      rodizio.push(Jogo.boss.def.id);
    }
    const apareceuNoRodizio = rodizio.indexOf('espectador') !== -1;

    // O CEIFADOR cair abre o segredo em vez de encerrar a corrida.
    Jogo.onda = Jogo.TOTAL_ONDAS; Jogo.boss = null; Jogo.spawnarBoss();
    const final = Jogo.boss;
    Jogo.bossDerrotado(final);
    const abriu = Jogo.segredo.fase;
    const dimensao = Jogo.dimensao;

    // A cinemática traz ele para a tela, e o que começa é conversa, não luta.
    for (let i = 0; i < 300; i++) Jogo.atualizarSegredo(1 / 60);
    const faseDepoisDaCinematica = Jogo.segredo.fase;
    const boss = Jogo.boss;
    boss.entrando = 0;
    const paradoNaConversa = [boss.x, boss.y];

    // Dano nenhum passa: build máxima, crítico, ultimate, o que for.
    const vidaAntes = boss.vida;
    for (let i = 0; i < 400; i++) boss.receberDano(999999, true, boss.x, boss.y);
    const vidaDepois = boss.vida;

    // Fase avança por tempo, não por vida.
    boss.tempoVivo = 0; boss.atualizarFase();
    const fase0 = boss.faseIndice;
    boss.tempoVivo = boss.def.fasesPorTempo * 3; boss.atualizarFase();
    const faseTarde = boss.faseIndice;

    // A conversa acaba e a fenda abre: mesma partida, do outro lado.
    for (let i = 0; i < 3000; i++) Jogo.atualizarSegredo(1 / 60);
    const depoisDaConversa = {
      fase: Jogo.segredo.fase, dimensao: Jogo.dimensao, onda: Jogo.onda,
      atravessou: Jogo.atravessou, boss: Jogo.boss, rotulo: Jogo.rotuloDaOnda(),
      ato: Jogo.ato(), ondaDoAto: Jogo.ondaDoAto()
    };

    // Morrer para ele na onda 200 não é derrota: é o fim da história. E a morte
    // chega por vários caminhos no mesmo quadro: chamar de novo não pode virar
    // GAME OVER.
    Jogo.onda = Jogo.ondaFinalDaCampanha();
    Jogo.boss = null; Jogo.spawnarBoss();
    const bossDa200 = Jogo.boss.def.id;
    Jogo.jogador.vida = 0;
    Jogo.derrota();
    Jogo.derrota();
    Jogo.derrota();
    return { apareceuNoRodizio, abriu, faseDepoisDaCinematica, dimensao, id: boss.def.id,
      vidaAntes, vidaDepois, porcentagem: boss.porcentagem, fase0, faseTarde,
      paradoNaConversa, depoisDaConversa, bossDa200,
      estado: Jogo.estado };
  })()`, mundo);

  assert.equal(dados.apareceuNoRodizio, false, 'o secreto não pode cair em onda normal');
  assert.equal(dados.abriu, 'abertura', 'derrubar o CEIFADOR começa pela cinemática');
  assert.equal(dados.faseDepoisDaCinematica, 'conversa',
    'na onda 100 ele conversa; a luta dele é na 200');
  assert.equal(dados.dimensao, 'intersticio', 'o segredo leva para o Interstício Violeta');
  assert.equal(dados.id, 'espectador');
  assert.equal(dados.vidaDepois, dados.vidaAntes, 'nenhum dano entra: a barra não se move');
  assert.equal(dados.porcentagem, 1, 'a barra fica cheia por definição');
  assert.equal(dados.fase0, 0);
  assert.ok(dados.faseTarde > dados.fase0, 'a fase avança por tempo de luta');

  // A travessia: a partida continua, a contagem recomeça e o ato muda.
  assert.equal(dados.depoisDaConversa.fase, null, 'a conversa não fica presa no estado de segredo');
  assert.equal(dados.depoisDaConversa.dimensao, 'nadir', 'do outro lado da fenda é NÁDIR');
  assert.equal(dados.depoisDaConversa.onda, 101, 'a campanha continua na onda 101 por dentro');
  assert.equal(dados.depoisDaConversa.ondaDoAto, 1, 'e vira ONDA 1 na tela');
  assert.equal(dados.depoisDaConversa.rotulo, 'ATO 2 · ONDA 1');
  assert.equal(dados.depoisDaConversa.ato, 2);
  assert.equal(dados.depoisDaConversa.atravessou, true, 'atravessou fica gravado para o ranking');
  assert.equal(dados.depoisDaConversa.boss, null, 'ele desaparece: a luta dele é no fim de NÁDIR');
  assert.equal(dados.bossDa200, 'espectador', 'a onda 200 é ele');
  assert.equal(dados.estado, 'vitoria', 'cair para ele não apaga a corrida inteira');
});

test('o verificador de atualização lê a versão de verdade, não um comentário', () => {
  const fonte = fs.readFileSync(path.join(raiz, 'src/versao.js'), 'utf8');

  // A MESMA expressão que JOGO.versaoDoServidor usa. Se ela mudar lá, muda aqui.
  const achou = fonte.match(/^ {4}versao: '([0-9]+(?:\.[0-9]+)*)'/m);
  assert.ok(achou, 'o arquivo tem que ter a linha de versão na forma esperada');

  const mundo = vm.createContext({ console, Math });
  vm.runInContext(fonte, mundo, { filename: 'src/versao.js' });
  const declarada = vm.runInContext('JOGO.versao', mundo);

  assert.equal(achou[1], declarada,
    'o que o verificador lê tem que ser a versão que o jogo roda — um comentário ' +
    'contendo a mesma forma seria lido no lugar e o aviso de atualização morreria calado');
});

test('cada atualização abre temporada nova e o recorde local segue a temporada', () => {
  const guardado = {};
  const mundo = vm.createContext({ console, Math, localStorage: {
    getItem: (k) => (k in guardado ? guardado[k] : null),
    setItem: (k, v) => { guardado[k] = String(v); },
    removeItem: (k) => { delete guardado[k]; }
  } });
  for (const arquivo of ['src/versao.js', 'src/nucleo.js']) {
    vm.runInContext(fs.readFileSync(path.join(raiz, arquivo), 'utf8'), mundo, { filename: arquivo });
  }
  const dados = vm.runInContext(`(() => {
    const temporadaAgora = JOGO.temporada;
    const versoes = ATUALIZACOES.map((a) => a.versao);

    Recordes.carregar();
    Recordes.registrar({ nome: 'EU', pontos: 500, classe: 'SNIPER', onda: 7 });
    const listaAgora = Recordes.lista.length;
    const marcada = Recordes.lista[0].temporada;

    // Publicar uma atualização é acrescentar uma entrada: temporada nova.
    ATUALIZACOES.unshift({ versao: '9.9.9', data: 'amanhã', titulo: 'Teste', itens: ['nada'] });
    const temporadaDepois = JOGO.temporada;
    Recordes.carregar();
    const listaDepois = Recordes.lista.length;
    const historico = Recordes.historico.length;
    const melhorDeTodas = Recordes.melhorDeTodas();
    return { temporadaAgora, temporadaDepois, versoes, listaAgora, marcada,
      listaDepois, historico, melhorDeTodas };
  })()`, mundo);

  assert.equal(dados.temporadaAgora, 'T' + dados.versoes.length);
  assert.notEqual(dados.temporadaDepois, dados.temporadaAgora, 'atualizar troca a temporada');
  assert.equal(dados.listaAgora, 1);
  assert.equal(dados.marcada, dados.temporadaAgora, 'a run nasce marcada com a temporada');
  assert.equal(dados.listaDepois, 0, 'temporada nova começa com o placar local vazio');
  assert.equal(dados.historico, 1, 'a run antiga não é apagada, só sai da tela');
  assert.equal(dados.melhorDeTodas, 500, 'o melhor de todas as temporadas continua acessível');
});

test('coração tem teto de 6, venha de onde vier', () => {
  const mundo = vm.createContext({ console, Math, setTimeout });
  for (const arquivo of ['src/nucleo.js', 'src/loja.js', 'src/classes.js', 'src/entidades.js', 'src/jogo.js']) {
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
  for (const arquivo of ['src/nucleo.js', 'src/loja.js', 'src/classes.js', 'src/entidades.js', 'src/jogo.js']) {
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
  for (const arquivo of ['src/nucleo.js', 'src/loja.js', 'src/classes.js', 'src/entidades.js', 'src/jogo.js']) {
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

test('cosmético é da conta, não da classe, e não encosta em atributo', () => {
  const dados = vm.runInContext(`(() => {
    const ids = [...CASCOS, ...TIROS, ...ACESSORIOS, ...EMOJIS].map((i) => i.id);
    const gratis = [...CASCOS, ...TIROS, ...ACESSORIOS, ...EMOJIS].filter((i) => i.preco === 0).map((i) => i.id);
    const campos = new Set();
    for (const i of [...CASCOS, ...TIROS, ...ACESSORIOS, ...EMOJIS]) for (const k of Object.keys(i)) campos.add(k);
    return {
      total: ids.length, unicos: new Set(ids).size,
      gratisSaoOsIniciais: gratis.every((id) => Carteira.itens.includes(id)),
      gratisPorVitrine: gratis.length,
      campos: [...campos],
      vidas: CLASSES.map((c) => c.atributos.vidaMax),
      mesmoCascoParaTodas: CLASSES.every((c) => skinDaClasse(c.id, 'casco-ouro').id === 'casco-ouro'),
      idInvalidoCaiNoEquipado: skinDaClasse('sniper', 'nao-existe').id
    };
  })()`, contexto);
  assert.equal(dados.unicos, dados.total, 'nenhum id de cosmético repetido');
  assert.equal(dados.gratisPorVitrine, 4, 'uma opção grátis por vitrine');
  assert.ok(dados.gratisSaoOsIniciais, 'o que é grátis já vem desbloqueado');
  assert.deepEqual(Array.from(dados.vidas), [2, 4, 2, 2, 3], 'a vida das classes não mudou');
  assert.ok(dados.mesmoCascoParaTodas, 'a cor vale para as cinco classes');
  assert.equal(dados.idInvalidoCaiNoEquipado, 'casco-original');
  for (const campo of dados.campos) {
    assert.ok(!['dano', 'vidaMax', 'velocidade', 'cadencia', 'pontos'].includes(campo),
      'cosmético não pode carregar atributo: ' + campo);
  }
});

test('cada inimigo morto vale exatamente uma moeda', () => {
  const mundo = vm.createContext({ console, Math, setTimeout });
  for (const arquivo of ['src/nucleo.js', 'src/loja.js', 'src/classes.js', 'src/entidades.js', 'src/jogo.js']) {
    vm.runInContext(fs.readFileSync(path.join(raiz, arquivo), 'utf8'), mundo, { filename: arquivo });
  }
  const dados = vm.runInContext(`(() => {
    Jogo.onda = 1;
    const comum = Jogo.moedasDe(new Inimigo('corredor', 100, 100, 1, false));
    const elite = Jogo.moedasDe(new Inimigo('corredor', 100, 100, 1, true));
    Jogo.onda = 50;
    const tarde = Jogo.moedasDe(new Inimigo('torreta', 100, 100, 1, false));
    return {
      comum, elite, tarde,
      maisCaro: Math.max(...CASCOS.concat(TIROS, ACESSORIOS, EMOJIS).map((i) => i.preco))
    };
  })()`, mundo);
  assert.equal(dados.comum, 1, 'inimigo comum vale uma moeda');
  assert.equal(dados.elite, 1, 'elite também vale uma moeda');
  assert.equal(dados.tarde, 1, 'onda alta também vale uma moeda');
  assert.ok(dados.maisCaro >= 10000, 'o item topo de linha continua sendo meta de longo prazo');
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
  for (const arquivo of ['src/nucleo.js', 'src/loja.js', 'src/classes.js', 'src/entidades.js', 'src/jogo.js']) {
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
  for (const arquivo of ['src/nucleo.js', 'src/loja.js', 'src/classes.js', 'src/entidades.js', 'src/jogo.js']) {
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

test('inimigo mira o jogador mais perto e ignora quem já caiu', () => {
  const mundo = vm.createContext({ console, Math, setTimeout, UI: { aviso() {} } });
  for (const arquivo of ['src/nucleo.js', 'src/loja.js', 'src/classes.js', 'src/entidades.js', 'src/jogo.js']) {
    vm.runInContext(fs.readFileSync(path.join(raiz, arquivo), 'utf8'), mundo, { filename: arquivo });
  }
  const dados = vm.runInContext(`(() => {
    const perto = Jogo.jogador = new Jogador('sniper', 'original');
    perto.x = 100; perto.y = 100;
    const longe = new Jogador('guardiao', 'original');
    longe.x = 900; longe.y = 500;
    Jogo.outros.set('longe', longe);
    const escolheuPerto = Jogo.alvoJogador(110, 100) === perto;
    perto.vida = 0;                       // caiu: deixa de ser alvo
    const trocouParaLonge = Jogo.alvoJogador(110, 100) === longe;
    longe.vida = 0;                       // equipe inteira no chão
    const semAlvo = Jogo.alvoJogador(110, 100);
    return { escolheuPerto, trocouParaLonge, semAlvo: semAlvo === null };
  })()`, mundo);
  assert.equal(dados.escolheuPerto, true, 'inimigo vai no jogador mais próximo');
  assert.equal(dados.trocouParaLonge, true, 'jogador caído não segura a mira');
  assert.equal(dados.semAlvo, true, 'sem ninguém vivo não existe alvo');
});

test('busca de alvo não cria lista temporária por inimigo', () => {
  const mundo = vm.createContext({ console, Math });
  for (const arquivo of ['src/nucleo.js', 'src/loja.js', 'src/classes.js', 'src/entidades.js', 'src/jogo.js']) {
    vm.runInContext(fs.readFileSync(path.join(raiz, arquivo), 'utf8'), mundo, { filename: arquivo });
  }
  const dados = vm.runInContext(`(() => {
    Jogo.jogador = { x: 10, y: 10, vida: 0 };   // caído: não é alvo
    Jogo.outros = new Map([['livre', { x: 80, y: 20, vida: 1 }]]);
    Jogo.jogadores = () => { throw new Error('alocação no caminho quente'); };
    return Jogo.alvoJogador(0, 0) === Jogo.outros.get('livre');
  })()`, mundo);
  assert.equal(dados, true);
});

test('coletável vai até o jogador e boss sem ninguém vivo não atira', () => {
  const mundo = vm.createContext({ console, Math, setTimeout });
  for (const arquivo of ['src/nucleo.js', 'src/loja.js', 'src/classes.js', 'src/entidades.js', 'src/jogo.js']) {
    vm.runInContext(fs.readFileSync(path.join(raiz, arquivo), 'utf8'), mundo, { filename: arquivo });
  }
  const dados = vm.runInContext(`(() => {
    Jogo.onda = 5; Particulas.iniciar();
    const j = Jogo.jogador = new Jogador('sniper', 'original');
    const xpAntes = j.xp;
    const xp = new Coletavel('xp', j.x + 20, j.y, 2);
    xp.atualizar(1 / 60);
    const coletado = j.xp > xpAntes;
    const velocidadeXp = Math.hypot(xp.vx, xp.vy);

    // Sem jogador vivo o boss não tem para onde atirar: nada é criado.
    j.vida = 0;
    Jogo.projeteis.length = 0;
    const boss = new Boss(BOSSES[0], 5);
    boss.entrando = 0; boss.telegrafo = 0; boss.recarga = 0;
    boss.atualizar(1 / 60);
    boss.executarAtaque('anel');
    return { coletado, velocidadeXp, tiros: Jogo.projeteis.length };
  })()`, mundo);
  assert.equal(dados.coletado, true);
  assert.ok(Number.isFinite(dados.velocidadeXp));
  assert.equal(dados.tiros, 0, 'boss sem alvo hostil não gasta bala');
});

test('snapshot do cooperativo preserva aparência, nome e raio do colega', () => {
  const ctx = mundoCoop();
  const dados = vm.runInContext(`(() => {
    Particulas.iniciar(); Jogo.onda = 12;
    const j = Jogo.jogador = new Jogador('arcano', 'original');
    j.nome = 'COLEGA'; j.emoji = '🐐'; j.acessorio = 'acessorio-coroa';
    const pacote = Coop.empacotarJogador('eu', j);
    const copia = new Jogador('sniper', 'original');
    Coop.absorverJogador(copia, pacote);
    return { nome: copia.nome, emoji: copia.emoji, acessorio: copia.acessorio,
      raio: copia.raio };
  })()`, ctx);
  assert.equal(dados.nome, 'COLEGA');
  assert.equal(dados.emoji, '🐐', 'emoji viaja no pacote: é o corpo do jogador agora');
  assert.equal(dados.acessorio, 'acessorio-coroa');
  assert.equal(dados.raio, 16);
});

test('o tiro do ESPECTRO fica na faixa das outras classes', () => {
  const dados = vm.runInContext(`(() => {
    // Dano por segundo de papel: projéteis x dano x crítico médio / cadência.
    // Serve para comparar classes entre si; o número absoluto sai da bancada
    // em ferramentas/medir-dano.js.
    const dps = {};
    for (const c of CLASSES) {
      const a = c.atributos;
      const critMedio = 1 + a.critChance * (a.critMult - 1);
      dps[c.id] = a.projeteis * a.dano * critMedio / a.cadencia;
    }
    const ordem = Object.keys(dps).sort((x, y) => dps[y] - dps[x]);
    return { dps, topo: ordem[0], segundo: ordem[1],
      razao: dps[ordem[0]] / dps[ordem[1]],
      espectroSobreSniper: dps.espectro / dps.sniper };
  })()`, contexto);

  assert.ok(dados.razao <= 1.35,
    'nenhuma classe pode ser mais que 1,35x a segunda no tiro — era 2x com o ESPECTRO antigo');
  assert.ok(dados.espectroSobreSniper <= 1.6,
    'o ESPECTRO pode ser o maior dano colado, mas não o dobro do SNIPER');
  assert.ok(dados.dps.espectro > dados.dps.arcano,
    'ele continua sendo classe de dano: acima do ARCANO');
});

test('o eco da CARNIFICINA corta multidão e não fere boss', () => {
  const mundo = vm.createContext({ console, Math, setTimeout: () => {}, UI: { aviso() {} } });
  for (const arquivo of ['src/nucleo.js', 'src/loja.js', 'src/classes.js', 'src/entidades.js', 'src/jogo.js']) {
    vm.runInContext(fs.readFileSync(path.join(raiz, arquivo), 'utf8'), mundo, { filename: arquivo });
  }
  const dados = vm.runInContext(`(() => {
    Particulas.iniciar();
    Jogo.onda = 30;
    const j = Jogo.jogador = new Jogador('espectro', 'original');
    const b = Jogo.boss = new Boss(BOSSES.filter((x) => !x.final && !x.secreto)[5], 30);
    b.entrando = 0; b.imune = 0;
    b.x = j.x; b.y = j.y;                 // colado: pior caso para o boss
    const inimigo = new Inimigo('corredor', j.x + 30, j.y, 1, false);
    inimigo.nascendo = 0;
    Jogo.inimigos = [inimigo];

    // Só os ecos: o corte direto fica de fora marcando o alvo como já cortado.
    b._cortado = true;
    inimigo._cortado = true;

    const vidaBossAntes = b.vida;
    const vidaInimigoAntes = inimigo.vida;
    j.ultCarga = j.attr.ultRecarga;
    j.ativarUlt();
    b.vida = vidaBossAntes;               // desconta a onda de abertura da ult
    for (let i = 0; i < 120; i++) j.atualizarEcos(1 / 60);
    return { ecos: j.ecos.length, bossPerdeu: vidaBossAntes - b.vida,
      inimigoPerdeu: vidaInimigoAntes - inimigo.vida };
  })()`, mundo);

  assert.ok(dados.ecos > 0 && dados.ecos <= 8, 'o teto de ecos é 8');
  assert.equal(dados.bossPerdeu, 0, 'eco não é dano de boss: parado colado nele, a barra não desce');
  assert.ok(dados.inimigoPerdeu > 0, 'contra multidão o eco continua cortando');
});

test('vida de boss cresce em passo constante e nunca dá degrau', () => {
  // Boss precisa de Mat e do resto do núcleo: contexto próprio, não o compartilhado.
  const mundo = vm.createContext({ console, Math, setTimeout: () => {} });
  for (const arquivo of ['src/nucleo.js', 'src/loja.js', 'src/classes.js', 'src/entidades.js', 'src/jogo.js']) {
    vm.runInContext(fs.readFileSync(path.join(raiz, arquivo), 'utf8'), mundo, { filename: arquivo });
  }
  const dados = vm.runInContext(`(() => {
    const rodizio = Jogo.rodizioDoAto1();
    const vidas = rodizio.map((def, i) => {
      const onda = i < 8 ? (i + 1) * 5 : 40 + (i - 7) * 10;
      return Math.round(new Boss(def, onda).vidaMax);
    });
    const passos = vidas.slice(1).map((v, i) => v / vidas[i]);
    return { vidas, passos, crescente: vidas.every((v, i) => i === 0 || v > vidas[i - 1]) };
  })()`, mundo);

  assert.equal(dados.crescente, true, 'cada boss tem mais vida que o anterior');
  for (const passo of dados.passos) {
    assert.ok(passo >= 1.2 && passo <= 1.45,
      'o passo entre bosses fica entre 1,2x e 1,45x — sem parede no meio da campanha (achei ' + passo.toFixed(2) + 'x)');
  }
  // O sexto encontro é o que o Enzo reclamou: fica registrado o teto dele.
  assert.ok(dados.vidas[5] < 6500,
    'o boss da onda 30 não volta a ter 14 mil de vida: com 48 de dano por segundo isso era uma luta de 5 minutos');
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

test('API aceita as 200 ondas dos dois atos, recusa além, e conhece o INVOCADOR', async () => {
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
  assert.equal((await responder(100)).codigo, 201, 'a onda final do Ato I entra no placar');
  assert.equal((await responder(137)).codigo, 201, 'run de NÁDIR conta no ranking');
  assert.equal((await responder(200)).codigo, 201, 'a última onda da campanha entra');
  assert.equal((await responder(201)).codigo, 400, 'onda acima do teto é recusada');
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
  for (const arquivo of ['src/nucleo.js', 'src/loja.js', 'src/classes.js', 'src/entidades.js', 'src/jogo.js', 'src/coop.js']) {
    vm.runInContext(fs.readFileSync(path.join(raiz, arquivo), 'utf8'), ctx, { filename: arquivo });
  }
  return ctx;
}

test('placar por temporada: a API grava a que recebe e lê só a pedida', async () => {
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
  // Dois cuidados para este teste não depender de ordem nem de ambiente:
  // limpar o cache do require (senão vem o módulo que outro teste já carregou,
  // preso ao stub dele) e garantir DATABASE_URL (senão a API responde 503 em
  // máquina sem api/conexao-local.js).
  const urlAntes = process.env.DATABASE_URL;
  process.env.DATABASE_URL = 'postgresql://teste:teste@localhost/neondb';
  delete require.cache[require.resolve(path.join(raiz, 'api/placar.js'))];
  let api;
  try { api = require(path.join(raiz, 'api/placar.js')); }
  finally {
    Module._load = carregar;
    delete require.cache[require.resolve(path.join(raiz, 'api/placar.js'))];
    if (urlAntes === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = urlAntes;
  }

  const chamar = async (pedido) => {
    const resposta = {
      codigo: 0,
      setHeader() {},
      status(codigo) { this.codigo = codigo; return this; },
      json(corpo) { this.corpo = corpo; return this; }
    };
    await api(pedido, resposta);
    return resposta;
  };

  const run = (temporada) => ({ method: 'POST', body: {
    nome: 'TESTE', pontos: 1000, classe: 'SNIPER', onda: 10,
    nivel: 1, tempo: 60, abates: 5, venceu: false, temporada
  } });

  // GRAVAÇÃO: a temporada recebida vai para a coluna; lixo cai em T1.
  consultas.length = 0;
  assert.equal((await chamar(run('T7'))).codigo, 201);
  const gravou = consultas[consultas.length - 1];
  assert.ok(gravou.texto.includes('temporada'), 'a coluna entra no insert');
  assert.ok(gravou.valores.includes('T7'), 'grava a temporada que o jogo mandou');

  consultas.length = 0;
  await chamar(run('bagunça'));
  assert.ok(consultas[consultas.length - 1].valores.includes('T1'),
    'temporada fora do formato cai em T1, não derruba a gravação');

  consultas.length = 0;
  await chamar(run(undefined));
  assert.ok(consultas[consultas.length - 1].valores.includes('T1'),
    'cliente antigo, sem o campo, continua entrando como T1');

  // LEITURA: com temporada filtra; sem temporada devolve o ranking inteiro.
  consultas.length = 0;
  assert.equal((await chamar({ method: 'GET', query: { temporada: 'T4', limite: '10' } })).codigo, 200);
  const comFiltro = consultas[consultas.length - 1];
  assert.ok(comFiltro.texto.includes('where temporada ='), 'a consulta corta pela temporada');
  assert.ok(comFiltro.valores.includes('T4'));

  consultas.length = 0;
  await chamar({ method: 'GET', query: {} });
  assert.ok(!consultas[consultas.length - 1].texto.includes('where temporada ='),
    'sem temporada na URL o ranking vem inteiro: cliente antigo não quebra');
});

test('controle recebido do convidado é limitado à faixa válida', () => {
  const ctx = mundoCoop();
  const r = vm.runInContext(`(() => {
    const c = Coop.validarControle({ x: 9, y: -9, miraX: 5, miraY: 5, miraAtiva: true,
      mouseX: 999999, mouseY: -999999, tiro: true, dash: true, especial: false, ult: true });
    return { x: c.eixoX(), y: c.eixoY(), miraX: c.mira.x, mouseX: c.mouseX, mouseY: c.mouseY,
      tiro: c.atirando(), dash: c.apertou('Space'), especial: c.apertou('KeyQ'),
      ult: c.apertou('ShiftLeft') };
  })()`, ctx);
  assert.equal(r.x, 1);
  assert.equal(r.y, -1);
  assert.equal(r.miraX, 1);
  assert.ok(r.mouseX <= 2560 * 2, 'mira não pode apontar para fora da arena');
  assert.ok(r.mouseY >= -1440, 'mira não pode apontar para fora da arena');
  assert.equal(r.tiro, true);
  assert.equal(r.dash, true);
  assert.equal(r.especial, false);
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
  for (const arquivo of ['src/nucleo.js', 'src/loja.js', 'src/classes.js', 'src/entidades.js', 'src/jogo.js']) {
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

test('bala do drone herda crítico e melhorias, mas usa 65% do dano', () => {
  const mundo = vm.createContext({ console, Math, setTimeout });
  for (const arquivo of ['src/nucleo.js', 'src/loja.js', 'src/classes.js', 'src/entidades.js', 'src/jogo.js']) {
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
    return { dano: b.dano, esperado: j.attr.dano * 0.65 * j.attr.critMult, critico: b.critico,
      perfuracao: b.perfuracao, ricochete: b.ricochete, dono: b.dono,
      contou: Jogo.estat.tiros - tirosAntes };
  })()`, mundo);
  assert.equal(dados.dono, 'jogador');
  assert.equal(dados.dano, dados.esperado, 'dano automático reduzido, mantendo o crítico');
  assert.equal(dados.critico, true);
  assert.equal(dados.perfuracao, 3, 'herda a perfuração das melhorias');
  assert.equal(dados.ricochete, 2, 'e o ricochete também');
  assert.ok(dados.contou >= 1, 'conta como tiro na estatística');
});

test('placar cai no banco quando nenhum servidor responde, e lembra disso', async () => {
  const guardado = {};
  const mundo = vm.createContext({
    console, Math, URL,
    location: { href: 'https://site.exemplo/', host: 'site.exemplo' },
    localStorage: {
      getItem: (c) => (c in guardado ? guardado[c] : null),
      setItem: (c, v) => { guardado[c] = String(v); }
    }
  });
  vm.runInContext(fs.readFileSync(path.join(raiz, 'src/placar-config.js'), 'utf8'), mundo, { filename: 'placar-config.js' });
  vm.runInContext(fs.readFileSync(path.join(raiz, 'src/placar.js'), 'utf8'), mundo, { filename: 'placar.js' });

  const pedidos = [];
  mundo.fetch = async (endereco, opcoes) => {
    pedidos.push(endereco);
    if (endereco.indexOf('apirest') >= 0) {
      return { ok: true, json: async () => (opcoes && opcoes.method === 'POST' ? {} : [{ nome: 'ANA', pontos: 10 }]) };
    }
    if (endereco.indexOf('neonauth') >= 0) return { ok: true, json: async () => ({ token: 'abc' }) };
    if (endereco.indexOf('onrender') >= 0) throw new Error('servidor dormindo');
    return { ok: false, json: async () => ({ erro: 'placar sem banco configurado' }) };
  };

  const linhas = await vm.runInContext('Placar.top(true)', mundo);
  assert.equal(Array.isArray(linhas) && linhas.length, 1, 'o ranking veio do banco');
  assert.equal(vm.runInContext('Placar.usandoDataApi', mundo), true);
  assert.ok(pedidos.some((p) => p.indexOf('onrender') >= 0), 'tentou a reserva antes do banco');
  assert.ok(guardado['sniper.placarDireto'], 'lembrou que aqui o placar mora no banco');

  // segunda volta: com a lembrança salva, vai direto ao banco
  pedidos.length = 0;
  const denovo = await vm.runInContext('Placar.top(true)', mundo);
  assert.equal(Array.isArray(denovo) && denovo.length, 1);
  assert.ok(!pedidos.some((p) => p.indexOf('onrender') >= 0), 'não repete a tentativa condenada');

  const gravou = await vm.runInContext(`Placar.enviar({ nome: 'ANA', pontos: 1, classe: 'SNIPER',
    onda: 1, nivel: 1, tempo: 1, abates: 1, venceu: false })`, mundo);
  assert.equal(gravou, true, 'a run também é gravada direto no banco');
});

test('o CEIFADOR é invencível por regra: nem build máxima derruba a barra', () => {
  const mundo = vm.createContext({ console, Math, setTimeout });
  for (const arquivo of ['src/nucleo.js', 'src/loja.js', 'src/classes.js', 'src/entidades.js', 'src/jogo.js']) {
    vm.runInContext(fs.readFileSync(path.join(raiz, arquivo), 'utf8'), mundo, { filename: arquivo });
  }
  const dados = vm.runInContext(`(() => {
    Jogo.onda = 100;
    Jogo.tempoJogo = 0;
    Jogo.dtReal = 0.016;
    const ceifador = BOSSES.find((b) => b.final);
    const b = new Boss(ceifador, 100);
    b.entrando = 0;

    // um segundo inteiro de dano absurdo, acerto atrás de acerto
    const antes = b.vida;
    for (let i = 0; i < 400; i++) b.receberDano(999999, true, 0, 0);
    const depoisDoAtaque = b.vida;

    // e um segundo de regeneração
    for (let i = 0; i < 62; i++) { Jogo.tempoJogo += 0.016; b.atualizar(0.016); }
    return {
      vidaMax: b.vidaMax, tirado: antes - depoisDoAtaque,
      tetoSegundo: b.vidaMax * ceifador.tetoPorSegundo,
      regenSegundo: b.vidaMax * ceifador.regenera,
      voltouPara: b.vida, vivo: b.vivo
    };
  })()`, mundo);

  assert.ok(dados.tirado <= dados.tetoSegundo + 1, 'um segundo de dano não passa do teto');
  assert.ok(dados.regenSegundo > dados.tetoSegundo * 2,
    'a regeneração por segundo é maior que o dano máximo por segundo — a barra nunca cai');
  assert.equal(dados.vivo, true, 'ele não morre');
  assert.ok(dados.voltouPara >= dados.vidaMax * 0.99, 'a barra volta ao topo sozinha');
});

test('boss ergue escudo a cada fase nova e o 67 muda de estilo por boss', () => {
  const mundo = vm.createContext({ console, Math, setTimeout });
  for (const arquivo of ['src/nucleo.js', 'src/loja.js', 'src/classes.js', 'src/entidades.js', 'src/jogo.js']) {
    vm.runInContext(fs.readFileSync(path.join(raiz, arquivo), 'utf8'), mundo, { filename: arquivo });
  }
  vm.runInContext('var UI = { aviso() {}, mostrarBarraBoss() {}, atualizarBarraBoss() {}, montarEquipe() {} };', mundo);
  const dados = vm.runInContext(`(() => {
    Jogo.onda = 20;
    Jogo.dtReal = 0.016;
    const b = new Boss(BOSSES[3], 20);
    b.entrando = 0;

    b.vida = b.vidaMax * 0.5;
    b.atualizarFase();                       // entra na fase 2
    const imuneNaTroca = b.imune;
    const antes = b.vida;
    b.receberDano(9999, true, 0, 0);
    const levouImune = antes - b.vida;

    b.imune = 0;                             // escudo caiu
    const antes2 = b.vida;
    b.receberDano(300, true, 0, 0);
    const levouDepois = antes2 - b.vida;

    const estilos = BOSSES.map((def) => {
      Jogo.comemorar67(def);
      return Jogo.festa67.estilo.id;
    });
    const doFinal = (() => { Jogo.comemorar67(BOSSES.find((x) => x.final)); return Jogo.festa67.estilo.id; })();

    return { imuneNaTroca, levouImune, levouDepois, estilos, doFinal,
      trilhas: Som.TRILHAS.length };
  })()`, mundo);

  // o escudo cresce com a campanha: curto no boss da onda 20, longo no da 90
  assert.ok(dados.imuneNaTroca > 1, 'a fase nova começa com escudo');
  assert.equal(dados.levouImune, 0, 'nada passa pelo escudo de fase');
  assert.equal(dados.levouDepois, 300, 'passado o escudo, o dano volta a valer');
  assert.equal(new Set(Array.from(dados.estilos)).size >= 8, true, 'os 67 não são todos iguais');
  assert.equal(dados.doFinal, 'final', 'o boss final tem o 67 reservado dele');
  assert.ok(dados.trilhas >= 5, 'há trilha suficiente para rodar a cada boss');
});

test('a carta de melhoria espera o letreiro do boss terminar', () => {
  const mundo = vm.createContext({ console, Math, setTimeout });
  for (const arquivo of ['src/nucleo.js', 'src/loja.js', 'src/classes.js', 'src/entidades.js', 'src/jogo.js']) {
    vm.runInContext(fs.readFileSync(path.join(raiz, arquivo), 'utf8'), mundo, { filename: arquivo });
  }
  vm.runInContext(`var UI = { el: { classeNome: {}, onda: {}, buffs: {} }, aviso() {}, mostrarBarraBoss() {},
    atualizarBarraBoss() {}, montarEquipe() {}, mostrarTela() {}, atualizarHUD() {}, montarMelhorias() {},
    esconderBarraBoss() {}, mostrarMelhorias() {} };
    var Coop = { ativo: () => false, convidado: () => false, anfitriao: () => false };
    var document = { documentElement: { style: { setProperty() {} } } };
    var window = {};`, mundo);

  const dados = vm.runInContext(`(() => {
    Jogo.jogador = new Jogador('sniper', 'original');
    Jogo.estado = 'jogando';
    Jogo.onda = 5;
    Jogo.inimigos.length = 0;
    Jogo.projeteis.length = 0;
    Jogo.ondaLimpa = true;
    Jogo.intervaloOnda = 99;
    Jogo.comemorar67(BOSSES[0]);          // letreiro do primeiro boss
    Jogo.filaDeMelhorias = 1;             // uma carta esperando

    const duracao = Jogo.festa67.vidaMax;
    // metade do letreiro: a carta não pode ter aberto
    for (let i = 0; i < Math.round((duracao / 2) / 0.016); i++) Jogo.atualizar(0.016);
    const noMeio = { festa: !!Jogo.festa67, estado: Jogo.estado, fila: Jogo.filaDeMelhorias };

    // passa do fim
    for (let i = 0; i < Math.round((duracao / 2 + 0.4) / 0.016); i++) Jogo.atualizar(0.016);
    const depois = { festa: !!Jogo.festa67, estado: Jogo.estado, fila: Jogo.filaDeMelhorias };

    return { duracao, texto: 'SIX SEVEN', noMeio, depois };
  })()`, mundo);

  assert.ok(dados.duracao >= 4, 'o letreiro do primeiro boss dura o tempo da fala');
  assert.equal(dados.noMeio.festa, true, 'no meio do letreiro ele ainda está no ar');
  assert.equal(dados.noMeio.estado, 'jogando', 'e a carta de melhoria não abriu por cima');
  assert.equal(dados.noMeio.fila, 1, 'a carta continua esperando na fila');
  assert.equal(dados.depois.festa, false, 'terminado o letreiro');
  assert.equal(dados.depois.estado, 'melhoria', 'aí sim a carta entra');
});

test('boss morto leva junto a barra e os tiros dele', () => {
  const mundo = vm.createContext({ console, Math, setTimeout });
  for (const arquivo of ['src/nucleo.js', 'src/loja.js', 'src/classes.js', 'src/entidades.js', 'src/jogo.js']) {
    vm.runInContext(fs.readFileSync(path.join(raiz, arquivo), 'utf8'), mundo, { filename: arquivo });
  }
  vm.runInContext(`var escondeu = 0;
    var UI = { el: { classeNome: {}, onda: {}, buffs: {} }, aviso() {}, mostrarBarraBoss() {},
      atualizarBarraBoss() {}, montarEquipe() {}, mostrarTela() {}, atualizarHUD() {},
      montarMelhorias() {}, mostrarMelhorias() {}, esconderBarraBoss() { escondeu++; } };
    var Coop = { ativo: () => false, convidado: () => false, anfitriao: () => false };
    var document = { documentElement: { style: { setProperty() {} } } };
    var window = {};`, mundo);

  const dados = vm.runInContext(`(() => {
    Jogo.jogador = new Jogador('sniper', 'original');
    Jogo.estado = 'jogando';
    Jogo.onda = 20;
    Jogo.inimigos.length = 0;
    Jogo.projeteis.length = 0;
    Jogo.spawnarBoss();
    const b = Jogo.boss;
    b.entrando = 0;

    // bala do boss e um tiro do jogador na arena
    b.executarAtaque('anel');
    Jogo.projeteis.push(new Projetil({ x: 10, y: 10, angulo: 0, velocidade: 100, raio: 4, dano: 1, dono: 'jogador' }));
    const antes = {
      inimigos: Jogo.projeteis.filter((p) => p.dono !== 'jogador').length,
      meus: Jogo.projeteis.filter((p) => p.dono === 'jogador').length
    };

    escondeu = 0;
    b.vida = 1;
    b.receberDano(99999, true, b.x, b.y);

    return {
      antes,
      depois: {
        boss: Jogo.boss,
        inimigos: Jogo.projeteis.filter((p) => p.dono !== 'jogador').length,
        meus: Jogo.projeteis.filter((p) => p.dono === 'jogador').length
      },
      escondeu
    };
  })()`, mundo);

  assert.ok(dados.antes.inimigos > 0, 'o boss tinha bala na tela antes de morrer');
  assert.equal(dados.depois.boss, null, 'o boss sai da arena');
  assert.equal(dados.depois.inimigos, 0, 'e as balas dele vão junto');
  assert.equal(dados.depois.meus, dados.antes.meus, 'o tiro do jogador continua lá');
  assert.ok(dados.escondeu >= 1, 'a barra do boss é escondida na morte');
});

/* Ato II — NÁDIR. A regra da história: a Arena ficou para trás e nenhum bicho
   dela atravessa a fenda. O contrário também — ruína de NÁDIR nunca vaza para
   uma onda do Ato I, nem por sorteio nem por estreia. */
test('nenhum inimigo do Ato I aparece no Ato II, e nenhuma ruína vaza para a Arena', () => {
  const dados = vm.runInContext(`(() => {
    const ato1 = Object.keys(TIPOS_INIMIGO).filter((k) => (TIPOS_INIMIGO[k].ato || 1) === 1);
    const ato2 = Object.keys(TIPOS_INIMIGO).filter((k) => TIPOS_INIMIGO[k].ato === 2);
    const vazaram = [];
    const intrusos = [];
    // Toda onda dos dois atos, conferindo o que o sorteio pode devolver.
    for (let o = 1; o <= Jogo.ondaFinalDaCampanha(); o++) {
      const tipos = Jogo.tiposDaOnda(o);
      if (!tipos.length) { intrusos.push('onda ' + o + ' sem inimigo'); continue; }
      for (const t of tipos) {
        const ato = TIPOS_INIMIGO[t].ato || 1;
        if (o <= Jogo.TOTAL_ONDAS && ato !== 1) vazaram.push(t + ' na onda ' + o);
        if (o > Jogo.TOTAL_ONDAS && ato !== 2) intrusos.push(t + ' na onda ' + o);
      }
    }
    // Todo tipo do Ato II tem de ser alcançável: def sem onda de estreia é def
    // morta, e ninguém descobre isso jogando.
    const inalcancaveis = ato2.filter((k) =>
      Jogo.tiposDaOnda(Jogo.ondaFinalDaCampanha()).indexOf(k) < 0);
    const ruinas = ato2.filter((k) => TIPOS_INIMIGO[k].podre);
    const invocadora = TIPOS_INIMIGO.ruinaInvocador;
    return { ato1: ato1.length, ato2: ato2.length, vazaram, intrusos, inalcancaveis,
      ruinas: ruinas.length, ato101: Jogo.ato(101), ato100: Jogo.ato(100),
      final: Jogo.ondaFinalDaCampanha(),
      invoca: invocadora.invoca, tetoNinhada: invocadora.teto,
      criaEhAto2: (TIPOS_INIMIGO[invocadora.invoca] || {}).ato };
  })()`, contexto);

  assert.deepEqual(Array.from(dados.vazaram), [], 'ruína de NÁDIR na Arena Neon');
  assert.deepEqual(Array.from(dados.intrusos), [], 'bicho do Ato I dentro de NÁDIR');
  assert.deepEqual(Array.from(dados.inalcancaveis), [], 'tipo do Ato II que nenhuma onda sorteia');
  assert.equal(dados.ato100, 1, 'a onda 100 ainda é a Arena');
  assert.equal(dados.ato101, 2, 'da 101 em diante é NÁDIR');
  assert.equal(dados.final, 200, 'a campanha inteira vai até a onda 200');
  assert.equal(dados.ato1, 12, 'os doze inimigos da Arena continuam só dela');
  assert.equal(dados.ato2, 10);
  assert.equal(dados.ruinas, 5, 'cinco ruínas, uma por classe jogável');
  assert.equal(dados.invoca, 'larvaNadir');
  assert.equal(dados.criaEhAto2, 2, 'a ruína não pode invocar bicho do Ato I');
  assert.ok(dados.tetoNinhada > 0, 'ninhada sem teto é onda que nunca termina');
});

/* A ninhada tem teto por ruína, e o teto conta só as larvas daquela ruína. */
test('a ruína do invocador respeita o teto da própria ninhada', () => {
  const mundo = vm.createContext({ console, Math });
  for (const arquivo of ['src/nucleo.js', 'src/loja.js', 'src/classes.js', 'src/entidades.js', 'src/jogo.js']) {
    vm.runInContext(fs.readFileSync(path.join(raiz, arquivo), 'utf8'), mundo, { filename: arquivo });
  }
  const dados = vm.runInContext(`(() => {
    Jogo.LARGURA = 1280; Jogo.ALTURA = 720; Jogo.onda = 105; Jogo.tempo = 0;
    Jogo.inimigos = [];
    Particulas.iniciar();
    const ruina = new Inimigo('ruinaInvocador', 300, 300, 1, false);
    const outra = new Inimigo('ruinaInvocador', 900, 300, 1, false);
    Jogo.inimigos.push(ruina, outra);
    for (let i = 0; i < 40; i++) ruina.invocar();
    const daRuina = () => Jogo.inimigos.filter((e) => e.criadaPor === ruina.id).length;
    const antes = daRuina();
    // Mata metade da ninhada: a conta tem de cair, senão o teto nunca libera.
    let mortas = 0;
    for (const e of Jogo.inimigos) {
      if (e.criadaPor === ruina.id && mortas < 5) { e.vivo = false; mortas++; }
    }
    return { antes, vivasDepois: ruina.ninhadaViva(), daOutra: outra.ninhadaViva(),
      tipoDaCria: Jogo.inimigos.find((e) => e.criadaPor === ruina.id).tipo,
      mordidas: ruina.mordidas ? ruina.mordidas.length : 0,
      larvaPodre: !!TIPOS_INIMIGO.larvaNadir.podre };
  })()`, mundo);

  assert.equal(dados.antes, 40, 'invocar() não é quem segura o teto — quem segura é o comportamento');
  assert.equal(dados.vivasDepois, 35, 'larva morta libera vaga na ninhada');
  assert.equal(dados.daOutra, 0, 'a ninhada de uma ruína não conta para a outra');
  assert.equal(dados.tipoDaCria, 'larvaNadir');
  assert.equal(dados.mordidas, 7, 'ruína tem um recuo sorteado por vértice, e só uma vez');
  assert.equal(dados.larvaPodre, false, 'bicho nascido em NÁDIR não é ruína de ninguém');
});

/* Os dez encontros de NÁDIR: de dez em dez, na ordem, com as cinco ruínas das
   classes jogáveis e O ESPECTADOR fechando na 200. E a rampa de vida: sobe
   sempre, começa no pé do CEIFADOR e nunca dá degrau. */
test('NÁDIR tem boss de dez em dez, as cinco ruínas, e a vida sobe sem degrau', () => {
  const mundo = vm.createContext({ console, Math, setTimeout: () => {},
    UI: {
      aviso() {}, mostrarBarraBoss() {}, esconderBarraBoss() {}, atualizarBarraBoss() {},
      mostrarFinal() {}, atualizarHUD() {}
    } });
  for (const arquivo of ['src/nucleo.js', 'src/loja.js', 'src/classes.js', 'src/entidades.js', 'src/jogo.js']) {
    vm.runInContext(fs.readFileSync(path.join(raiz, arquivo), 'utf8'), mundo, { filename: arquivo });
  }
  const dados = vm.runInContext(`(() => {
    Jogo.LARGURA = 1280; Jogo.ALTURA = 720;
    Particulas.iniciar();

    // Quais ondas do Ato II chamam boss, e qual boss cada uma chama.
    const ondasComBoss = [];
    const escolhidos = [];
    for (let o = 101; o <= 210; o++) {
      if (!Jogo.ehOndaDeBoss(o)) continue;
      ondasComBoss.push(o);
      Jogo.onda = o; Jogo.boss = null; Jogo.spawnarBoss();
      escolhidos.push(Jogo.boss.def.id);
    }

    const deNadir = Jogo.bossesDeNadir();
    const vidas = deNadir.map((def, i) => Math.round(new Boss(def, 110 + i * 10).vidaMax));
    const passos = vidas.slice(1).map((v, i) => v / vidas[i]);
    const ceifador = Math.round(new Boss(BOSSES.find((b) => b.final), 100).vidaMax);

    // Pressao: o que cresce em NADIR e a frequencia de ataque, nao o volume.
    const pressoes = [110, 150, 190, 200].map((o) => +Boss.pressao(o).toFixed(2));
    const durezas = [110, 190, 200].map((o) => Boss.dureza(o));

    // Titulo de ruina aponta a classe: e assim que o jogador reconhece de quem e.
    const ruinas = deNadir.filter((b) => (b.titulo || '').indexOf('Ru\u00edna do') === 0)
      .map((b) => b.titulo.replace('Ru\u00edna do ', ''));

    // Nenhum boss do Ato I pode cair em NADIR, e vice-versa.
    const vazou = escolhidos.filter((id) => {
      const def = BOSSES.find((b) => b.id === id);
      return (def.ato || 1) !== 2;
    });

    return { ondasComBoss, escolhidos, vidas, passos, ceifador, pressoes, durezas, ruinas, vazou,
      quantos: deNadir.length };
  })()`, mundo);

  assert.deepEqual(Array.from(dados.ondasComBoss), [110, 120, 130, 140, 150, 160, 170, 180, 190, 200],
    'boss de dez em dez, e nada depois da 200');
  assert.equal(dados.quantos, 9, 'nove bosses de NÁDIR mais O ESPECTADOR na 200');
  assert.equal(dados.escolhidos[9], 'espectador', 'a onda 200 é O ESPECTADOR');
  assert.equal(new Set(Array.from(dados.escolhidos)).size, 10, 'nenhum boss repetido em NÁDIR');
  assert.deepEqual(Array.from(dados.vazou), [], 'boss do Ato I caindo em NÁDIR');

  // As cinco classes jogáveis, cada uma com a sua ruína.
  assert.deepEqual(Array.from(dados.ruinas).sort(),
    ['ARCANO', 'ESPECTRO', 'GUARDIÃO', 'INVOCADOR', 'SNIPER'],
    'uma ruína por classe jogável, e o título diz de quem é');

  // Rampa de vida.
  assert.ok(dados.vidas[0] >= dados.ceifador,
    'o primeiro boss de NÁDIR não pode ser mais fraco que o CEIFADOR — seria degrau para baixo');
  for (const passo of dados.passos) {
    assert.ok(passo >= 1.08 && passo <= 1.2,
      'a vida sobe entre 1,08x e 1,2x por encontro (achei ' + passo.toFixed(3) + 'x)');
  }
  assert.ok(dados.vidas[8] / dados.ceifador > 2 && dados.vidas[8] / dados.ceifador < 3,
    'o último antes da 200 fica entre 2x e 3x o CEIFADOR');

  // Pressão sobe; dureza fica no teto, porque dureza manda em volume de tiro.
  assert.deepEqual(Array.from(dados.pressoes), [1, 1.2, 1.4, 1.4], 'a pressão sobe até 1,4 e para');
  for (const d of dados.durezas) {
    assert.equal(d, 1, 'dureza no teto: esticar ela viraria anel de 89 projéteis');
  }
});

/* Ranking. Quem atravessou a fenda venceu as 100 ondas, e isso não se perde se
   a partida acabar em NÁDIR — era a primeira coisa que o Enzo perguntou. */
test('run de NÁDIR conta no ranking, e morrer lá não apaga a vitória da Arena', () => {
  const mundo = vm.createContext({ console, Math, setTimeout: () => {},
    Coop: { ativo: () => false },
    Placar: { enviar() {} },
    Perfil: { exibir: () => 'TESTE' },
    UI: {
      aviso() {}, mostrarBarraBoss() {}, esconderBarraBoss() {}, atualizarBarraBoss() {},
      mostrarFinal(venceu, segredo, emNadir) { this.ultimoFinal = { venceu, segredo, emNadir }; },
      atualizarHUD() {}, mostrarTela() {}, el: {}
    } });
  for (const arquivo of ['src/nucleo.js', 'src/loja.js', 'src/classes.js', 'src/entidades.js', 'src/jogo.js']) {
    vm.runInContext(fs.readFileSync(path.join(raiz, arquivo), 'utf8'), mundo, { filename: arquivo });
  }
  const dados = vm.runInContext(`(() => {
    Jogo.LARGURA = 1280; Jogo.ALTURA = 720;
    Particulas.iniciar();
    // Os dublês entram DEPOIS de carregar: nucleo.js declara Recordes e Perfil
    // com const, e const no arquivo sombreia o que veio no contexto.
    const registradas = [];
    Recordes.registrar = (e) => registradas.push(['local', e]);
    Placar.enviar = (e) => registradas.push(['mundial', e]);
    Jogo.jogador = new Jogador('sniper', 'original');
    Jogo.estat = { abates: 7, tiros: 0, danoFeito: 0, danoRecebido: 0, melhorMulti: 1, bosses: 10 };

    // Morte no Ato I: derrota comum.
    Jogo.onda = 37; Jogo.pontos = 1000; Jogo.estado = 'jogando'; Jogo.atravessou = false;
    Jogo.derrota();
    const noAto1 = UI.ultimoFinal;

    // Agora a mesma coisa, mas depois da travessia.
    Jogo.estado = 'jogando'; Jogo.atravessou = true;
    Jogo.onda = 137; Jogo.pontos = 90000;
    Jogo.derrota();
    const noAto2 = UI.ultimoFinal;
    return { noAto1, noAto2, registradas };
  })()`, mundo);

  const registradas = dados.registradas;
  const entradas = registradas.filter((r) => r[0] === 'local').map((r) => r[1]);
  assert.equal(entradas.length, 2);
  assert.equal(entradas[0].venceu, false, 'morrer no Ato I é derrota');
  assert.equal(entradas[0].ato, 1);
  assert.equal(entradas[1].venceu, true, 'quem atravessou já tinha vencido as 100 ondas');
  assert.equal(entradas[1].ato, 2, 'a linha guarda o ato: onda 137 não é onda 37');
  assert.equal(entradas[1].onda, 137, 'a onda vai por dentro, com o número corrido');
  assert.ok(entradas[1].pontos > entradas[0].pontos);
  assert.equal(registradas.filter((r) => r[0] === 'mundial').length, 2,
    'as duas também vão para o placar mundial');
  assert.equal(dados.noAto2.emNadir, true, 'a tela de fim sabe que a queda foi em NÁDIR');
  assert.equal(dados.noAto2.venceu, true);
});

/* Duas classes se compram com NUCLEUS. O que este teste guarda é a separação:
   moeda normal nunca libera classe, comprar sem NUCLEUS não libera nada e
   classe já comprada não cobra de novo. */
test('ESPECTRO e INVOCADOR só abrem com NUCLEUS, e a tranca não tem atalho', () => {
  const guardado = {};
  const mundo = vm.createContext({ console, Math,
    localStorage: {
      getItem: (k) => (k in guardado ? guardado[k] : null),
      setItem: (k, v) => { guardado[k] = String(v); }
    } });
  vm.runInContext(fs.readFileSync(path.join(raiz, 'src/loja.js'), 'utf8'), mundo, { filename: 'src/loja.js' });

  const dados = vm.runInContext(`(() => {
    const precos = Object.keys(CLASSES_TRANCADAS).map((id) => [id, Classes.preco(id)]);
    const livresDeGraca = ['sniper', 'guardiao', 'arcano'].every((id) => !Classes.trancada(id));

    // Milhões de moedas comuns não compram personagem.
    Carteira.moedas = 9999999;
    Carteira.nucleus = 699;
    const pobre = Classes.destrancar('espectro');
    const aindaTrancada = Classes.trancada('espectro');
    const naoGastou = Carteira.nucleus;

    // Com NUCLEUS: compra, debita exatamente o preço e libera para sempre.
    Carteira.nucleus = 800;
    const comprou = Classes.destrancar('espectro');
    const sobrou = Carteira.nucleus;
    const liberada = !Classes.trancada('espectro');
    const deNovo = Classes.destrancar('espectro');
    const sobrouDepois = Carteira.nucleus;

    const item = Carteira.itens.filter((i) => i.indexOf('classe-') === 0);
    return { precos, livresDeGraca, pobre, aindaTrancada, naoGastou, comprou, sobrou,
      liberada, deNovo, sobrouDepois, item, invocadorTrancado: Classes.trancada('invocador') };
  })()`, mundo);

  assert.deepEqual(Array.from(dados.precos).map((p) => p[0]).sort(), ['espectro', 'invocador']);
  assert.equal(dados.livresDeGraca, true, 'três classes continuam de graça');
  assert.deepEqual(Array.from(dados.precos).map((p) => p[1]), [700, 1500]);
  assert.equal(dados.pobre, 'sem-nucleus');
  assert.equal(dados.aindaTrancada, true, 'sem pagar, continua trancada');
  assert.equal(dados.naoGastou, 699, 'compra recusada não tira NUCLEUS');
  assert.equal(dados.comprou, 'comprada');
  assert.equal(dados.sobrou, 100, 'debita exatamente o preço');
  assert.equal(dados.liberada, true);
  assert.equal(dados.deNovo, 'livre');
  assert.equal(dados.sobrouDepois, 100, 'classe já comprada não cobra de novo');
  assert.deepEqual(Array.from(dados.item), ['classe-espectro']);
  assert.equal(dados.invocadorTrancado, true, 'comprar uma não libera a outra');
});

test('pacote de NUCLEUS preserva pelo menos R$ 30 depois da taxa de 15%', () => {
  const mundo = vm.createContext({ console, Math, localStorage: { getItem: () => null, setItem() {} } });
  vm.runInContext(fs.readFileSync(path.join(raiz, 'src/loja.js'), 'utf8'), mundo, { filename: 'src/loja.js' });
  const dados = vm.runInContext(`PACOTES_NUCLEUS.map((p) => ({
    id: p.id, nucleus: p.nucleus, liquidoCentavos: Math.round(p.precoCentavos * 0.85)
  }))`, mundo);
  assert.deepEqual(Array.from(dados).map((p) => p.nucleus), [700, 1600, 3500]);
  assert.ok(Array.from(dados).every((p) => p.liquidoCentavos >= 3000),
    'nenhum pacote pode render menos de R$ 30 antes de impostos e estornos');
});

/* A guarda que não depende da tela estar certa. */
test('partida nunca começa com classe trancada, venha o pedido de onde vier', () => {
  const guardado = {};
  const mundo = vm.createContext({ console, Math, setTimeout: () => {},
    localStorage: {
      getItem: (k) => (k in guardado ? guardado[k] : null),
      setItem: (k, v) => { guardado[k] = String(v); }
    },
    Coop: { ativo: () => false, intencao: null, jogadores: () => [] },
    UI: { aviso() {}, atualizarHUD() {}, mostrarTela() {}, esconderBarraBoss() {},
      atualizarMoedas() {}, el: { classeNome: {} } } });
  for (const arquivo of ['src/nucleo.js', 'src/loja.js', 'src/classes.js', 'src/entidades.js', 'src/jogo.js']) {
    vm.runInContext(fs.readFileSync(path.join(raiz, arquivo), 'utf8'), mundo, { filename: arquivo });
  }
  const dados = vm.runInContext(`(() => {
    Jogo.LARGURA = 1280; Jogo.ALTURA = 720;
    Particulas.iniciar();
    document = { documentElement: { style: { setProperty() {} } } };
    Jogo.novoJogo('invocador', 'casco-original');
    const trocada = Jogo.jogador.classe.id;
    Carteira.nucleus = 2000;
    Classes.destrancar('invocador');
    Jogo.novoJogo('invocador', 'casco-original');
    return { trocada, depoisDeComprar: Jogo.jogador.classe.id };
  })()`, mundo);

  assert.equal(dados.trocada, 'sniper', 'classe trancada não entra: cai na primeira');
  assert.equal(dados.depoisDeComprar, 'invocador', 'comprada, entra normal');
});

test('dificuldade altera inimigos e bosses sem mexer no modo normal', () => {
  const mundo = vm.createContext({ console, Math, setTimeout: () => {} });
  for (const arquivo of ['src/nucleo.js', 'src/loja.js', 'src/classes.js', 'src/entidades.js', 'src/jogo.js']) {
    vm.runInContext(fs.readFileSync(path.join(raiz, arquivo), 'utf8'), mundo, { filename: arquivo });
  }
  const dados = vm.runInContext(`(() => {
    UI = { atualizarHUD() {}, aviso() {}, mostrarBarraBoss() {} };
    Jogo.jogador = new Jogador('sniper', 'original');
    Jogo.onda = 21;
    const quantidades = {};
    for (const modo of ['facil', 'normal', 'dificil']) {
      Jogo.definirDificuldade(modo);
      Jogo.prepararOnda();
      quantidades[modo] = Jogo.spawnRestante;
    }
    const def = BOSSES.find((b) => !b.final && !b.secreto && (b.ato || 1) === 1);
    const vidas = {};
    for (const modo of ['facil', 'normal', 'dificil']) {
      Jogo.definirDificuldade(modo);
      vidas[modo] = new Boss(def, 20).vidaMax;
    }
    Jogo.definirDificuldade('qualquer-lixo');
    return { quantidades, vidas, invalida: Jogo.dificuldade,
      ajustes: Jogo.DIFICULDADES };
  })()`, mundo);

  assert.ok(dados.quantidades.facil < dados.quantidades.normal);
  assert.ok(dados.quantidades.dificil > dados.quantidades.normal);
  assert.equal(dados.vidas.facil / dados.vidas.normal, 0.75);
  assert.equal(dados.vidas.dificil / dados.vidas.normal, 1.4);
  assert.ok(dados.ajustes.facil.ritmoBoss > 1, 'fácil aumenta intervalo entre ataques');
  assert.ok(dados.ajustes.dificil.ritmoBoss < 1, 'difícil reduz intervalo entre ataques');
  assert.equal(dados.invalida, 'normal', 'entrada inválida volta ao padrão seguro');
});

/* Qualidade adaptativa do celular: desce quando o FPS cai, sobe quando sobra, e
   nunca fica piscando entre duas escalas. */
test('a escala de render desce com FPS baixo e sobe com folga, sem oscilar', () => {
  const mundo = vm.createContext({ console, Math, setTimeout: () => {} });
  for (const arquivo of ['src/nucleo.js', 'src/loja.js', 'src/classes.js', 'src/entidades.js', 'src/jogo.js']) {
    vm.runInContext(fs.readFileSync(path.join(raiz, arquivo), 'utf8'), mundo, { filename: arquivo });
  }
  const dados = vm.runInContext(`(() => {
    Jogo.canvas = { width: 0, height: 0 };
    Jogo.LARGURA = 1760; Jogo.ALTURA = 990;
    Jogo.modoLeve = true; Jogo.estado = 'jogando';
    Jogo.escalaRender = 0.62;

    Jogo.fps = 30; Jogo.ajustarQualidade();
    const depoisDeUma = Jogo.escalaRender;
    Jogo.fps = 30; Jogo.ajustarQualidade();
    const depoisDeDuas = Jogo.escalaRender;

    for (let i = 0; i < 20; i++) { Jogo.fps = 20; Jogo.ajustarQualidade(); }
    const piso = Jogo.escalaRender;

    Jogo.fps = 60; Jogo.ajustarQualidade();
    const umaBoa = Jogo.escalaRender;
    for (let i = 0; i < 40; i++) { Jogo.fps = 60; Jogo.ajustarQualidade(); }
    const teto = Jogo.escalaRender;

    const antes = Jogo.escalaRender;
    for (let i = 0; i < 30; i++) { Jogo.fps = 52; Jogo.ajustarQualidade(); }
    const estavel = Jogo.escalaRender === antes;

    Jogo.modoLeve = false; Jogo.escalaRender = 1;
    for (let i = 0; i < 10; i++) { Jogo.fps = 20; Jogo.ajustarQualidade(); }
    const noPc = Jogo.escalaRender;

    return { depoisDeUma, depoisDeDuas, piso, umaBoa, teto, estavel, noPc,
      largura: Jogo.canvas.width };
  })()`, mundo);

  assert.equal(dados.depoisDeUma, 0.62, 'uma queda sozinha não muda a qualidade');
  assert.equal(dados.depoisDeDuas, 0.55, 'duas quedas seguidas descem um passo');
  assert.equal(dados.piso, 0.45, 'desce até o piso e para');
  assert.equal(dados.umaBoa, 0.45, 'uma medida boa não sobe nada');
  assert.equal(dados.teto, 0.75, 'com folga sobrando, chega ao teto do celular');
  assert.equal(dados.estavel, true, 'FPS no meio da faixa deixa a escala quieta');
  assert.equal(dados.noPc, 1, 'no PC a escala é 1 e fica 1');
  assert.equal(dados.largura, Math.round(1760 * 0.75), 'o canvas acompanha a escala');
});
