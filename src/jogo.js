/* ===========================================================================
   JOGO.JS — estado global, loop, ondas, colisões, efeitos de tela, render.
   =========================================================================== */

const Jogo = {
  // Arena maior que a tela de origem, mas ainda inteira visível: o canvas é
  // desenhado em 1760x990 e o CSS encolhe para caber. Ninguém fica fora do
  // enquadramento e sobra espaço para fugir de boss.
  LARGURA: 1760,
  ALTURA: 990,
  TOTAL_ONDAS: 100,
  modoLeve: false,
  escalaRender: 1,
  intervaloHUD: 0,
  ultimoDesenho: 0,

  canvas: null,
  ctx: null,

  estado: 'menu',          // menu | classe | jogando | pausado | melhoria | gameover | vitoria
  tempo: 0,
  tempoJogo: 0,
  ultimoQuadro: 0,
  hitstop: 0,
  lentidao: 0,
  fps: 60,
  acumFps: 0,
  contFps: 0,

  jogador: null,
  outros: new Map(),
  seq: 0,
  proximoId() { return ++Jogo.seq; },   // identidade estável para o cooperativo
  jogadores() { return [Jogo.jogador, ...Jogo.outros.values()].filter((j) => j && j.vida > 0); },
  jogadorMaisProximo(x, y) {
    let alvo = null, distancia = Infinity;
    const local = Jogo.jogador;
    if (local && local.vida > 0) {
      alvo = local;
      distancia = Mat.distanciaQ(x, y, local.x, local.y);
    }
    // Caminho quente: chamado por cada inimigo. Iterar o Map diretamente evita
    // criar dois arrays temporários por inimigo e por quadro.
    for (const j of Jogo.outros.values()) {
      if (!j || j.vida <= 0) continue;
      const d = Mat.distanciaQ(x, y, j.x, j.y);
      if (d < distancia) { alvo = j; distancia = d; }
    }
    return alvo;
  },
  alvoJogador(x, y) { return Jogo.jogadorMaisProximo(x, y); },
  inimigos: [],
  projeteis: [],
  coletaveis: [],
  ondasChoque: [],
  raios: [],
  singularidades: [],
  boss: null,

  onda: 1,
  spawnRestante: 0,
  timerSpawn: 0,
  composicao: [],
  intervaloOnda: 0,
  ondaLimpa: false,

  pontos: 0,
  combo: 0,
  comboTimer: 0,
  multiplicador: 1,
  filaDeMelhorias: 0,
  imaGlobal: 0,

  // Dimensão da arena: 'normal' é o neon do Ato I; 'intersticio' é o
  // Interstício Violeta, onde O ESPECTADOR espera depois da onda 100.
  // Quem leva o jogador para lá é só ele. Ver HISTORIA.md.
  dimensao: 'normal',
  segredo: { fase: null, tempo: 0, marco: 0 },
  // Atravessou a fenda para NÁDIR? Quem atravessou já venceu as 100 ondas, e o
  // ranking tem de saber disso mesmo que a partida acabe em morte no Ato II.
  atravessou: false,

  flash: { alpha: 0, cor: '#fff' },
  festa67: null,        // o 67 gigante que aparece a cada boss derrubado
  avisoTexto: '',
  avisoTimer: 0,

  estat: { abates: 0, tiros: 0, danoFeito: 0, danoRecebido: 0, melhorMulti: 1, bosses: 0 },
  dificuldade: 'normal',
  historiaAtiva: false,
  MARCOS_HISTORIA: {
    1: { texto: 'ACORDE, CONDUTOR.' },
    10: { texto: 'MOVIMENTO REGISTRADO.' },
    20: { texto: 'VOCÊ APRENDE MAIS RÁPIDO QUE OS OUTROS.' },
    25: { texto: 'NÃO PROCURE A SAÍDA.' },
    50: { origem: 'TRANSMISSÃO DESCONHECIDA', texto: 'CONTINUE. QUERO VER ATÉ ONDE CHEGA QUANDO ACREDITA QUE EXISTE UM FIM.', duracao: 5200 },
    60: { texto: 'ESTES INIMIGOS TAMBÉM ACORDARAM AQUI.' },
    70: { texto: 'A ARENA NÃO CRIA. ELA RECORDA.' },
    75: { texto: 'VOCÊ JÁ MORREU AQUI. MAIS DE UMA VEZ.' },
    120: { origem: 'INTERFERÊNCIA DE NÁDIR', texto: 'VOCÊ NÃO ESCAPOU DA ARENA. TROUXE A ARENA COM VOCÊ.' },
    150: { origem: 'INTERFERÊNCIA DE NÁDIR', texto: 'CADA MELHORIA FOI FEITA COM UMA MEMÓRIA ROUBADA.' },
    180: { origem: 'INTERFERÊNCIA DE NÁDIR', texto: 'O ESPECTADOR NÃO É UM DEUS. É O ÚLTIMO PRISIONEIRO.' },
    199: { origem: 'SINAL DO TRONO AUSENTE', texto: 'VOCÊ NÃO ENCONTROU O TRONO. ENTROU DENTRO DELE.', duracao: 5200 }
  },
  DIFICULDADES: {
    'muito-facil': { inimigos: 0.5, vidaBoss: 0.5, ritmoBoss: 2 },
    facil: { inimigos: 0.75, vidaBoss: 0.75, ritmoBoss: 1.25 },
    normal: { inimigos: 1, vidaBoss: 1, ritmoBoss: 1 },
    dificil: { inimigos: 1.35, vidaBoss: 1.4, ritmoBoss: 0.72 },
    hard: { inimigos: 1.5, vidaBoss: 1.5, ritmoBoss: 2 / 3 }
  },

  definirDificuldade(valor) {
    Jogo.dificuldade = Jogo.DIFICULDADES[valor] ? valor : 'normal';
  },
  ajusteDificuldade() { return Jogo.DIFICULDADES[Jogo.dificuldade] || Jogo.DIFICULDADES.normal; },
  iniciarHistoriaDaOnda(onda) {
    const marco = Jogo.MARCOS_HISTORIA[onda];
    if (!marco || typeof UI === 'undefined' || !UI.mostrarHistoria) return false;
    Jogo.historiaAtiva = true;
    UI.mostrarHistoria(marco);
    return true;
  },

  /* ------------------------------ Boot ------------------------------- */
  iniciar() {
    Jogo.canvas = document.getElementById('telaJogo');
    Jogo.ctx = Jogo.canvas.getContext('2d');
    Jogo.modoLeve = !!((window.matchMedia && matchMedia('(pointer: coarse)').matches) || navigator.maxTouchPoints > 0);
    // No celular o custo por pixel é o que trava. 0,62 dá um quadro 2,6 vezes
    // mais barato que o tamanho cheio e a diferença mal aparece na tela pequena.
    // Daqui em diante quem manda é `Jogo.ajustarQualidade`, que sobe e desce
    // este número conforme o aparelho aguenta.
    Jogo.escalaRender = Jogo.modoLeve ? 0.62 : 1;
    Jogo.canvas.width = Math.round(Jogo.LARGURA * Jogo.escalaRender);
    Jogo.canvas.height = Math.round(Jogo.ALTURA * Jogo.escalaRender);
    if (Jogo.modoLeve) Particulas.limite = 260;

    Config.carregar();
    Recordes.carregar();
    Particulas.iniciar();
    Input.iniciar(Jogo.canvas);
    UI.iniciar();

    Jogo.ultimoQuadro = performance.now();
    requestAnimationFrame(Jogo.loop);
  },

  novoJogo(classeId, skinId) {
    // Classe trancada nunca entra em partida, venha o pedido de onde vier
    // (atalho, sala, recarregar a página com estado velho). A tela já barra;
    // isto é a trava que não depende da tela estar certa.
    if (typeof Classes !== 'undefined' && Classes.trancada(classeId)) classeId = CLASSES[0].id;
    Jogo.jogador = new Jogador(classeId, skinId);
    Jogo.outros.clear();
    Jogo.inimigos.length = 0;
    Jogo.projeteis.length = 0;
    Jogo.coletaveis.length = 0;
    Jogo.ondasChoque.length = 0;
    Jogo.raios.length = 0;
    Jogo.singularidades.length = 0;
    Particulas.limpar();
    Textos.limpar();
    Jogo.boss = null;
    Jogo.festa67 = null;
    Jogo.onda = 1;
    Jogo.pontos = 0;
    Jogo.combo = 0;
    Jogo.comboTimer = 0;
    Jogo.multiplicador = 1;
    Jogo.filaDeMelhorias = 0;
    Jogo.imaGlobal = 0;
    Jogo.tempoJogo = 0;
    Jogo.intervaloHUD = 0;
    Jogo.estat = { abates: 0, tiros: 0, danoFeito: 0, danoRecebido: 0, melhorMulti: 1, bosses: 0 };
    Jogo.dimensao = 'normal';
    Jogo.segredo = { fase: null, tempo: 0, marco: 0 };
    Jogo.atravessou = false;
    Jogo.historiaAtiva = false;
    Jogo.estado = 'jogando';
    Som.intensidade = 0;
    Som.desativarTenebroso();
    Jogo.prepararOnda();
    UI.el.classeNome.textContent = Jogo.jogador.classe.nome;
    document.documentElement.style.setProperty('--cor-classe', Jogo.jogador.skin.cor);
    UI._maxCoracoes = -1;
    UI.mostrarTela(null);
    UI.atualizarHUD();
  },

  /* ------------------------------ Ondas ------------------------------ */
  // Boss a cada 5 ondas até a 40. Depois disso as ondas ficam longas demais
  // para um boss a cada cinco: passa a ser de 10 em 10 — e a 100, o final.
  ehOndaDeBoss(onda) {
    if (onda > Jogo.ondaFinalDaCampanha()) return false;
    // NÁDIR mantém o ritmo de dez em dez: dez encontros, o último na onda 200.
    if (onda > Jogo.TOTAL_ONDAS) return onda % 10 === 0;
    return onda <= 40 ? onda % 5 === 0 : onda % 10 === 0;
  },

  // Qual encontro de NÁDIR é esta onda, de 1 a 10. A 200 é o décimo.
  encontroDeNadir(onda) {
    return Math.round(((onda === undefined ? Jogo.onda : onda) - Jogo.TOTAL_ONDAS) / 10);
  },

  // Quantos bosses já apareceram até esta onda (usado para escolher qual vem
  // e para escalar a vida dele).
  encontroDeBoss(onda) {
    const ate40 = Math.floor(Math.min(onda, 40) / 5);
    const depois = onda > 40 ? Math.floor((onda - 40) / 10) : 0;
    return ate40 + depois;
  },

  /* ---------------------------- Ato da campanha ------------------------- */
  /* Ato I é a Arena Neon, ondas 1 a 100. Ato II é NÁDIR, da 101 em diante.
     Isto não é enfeite: é o que decide quais inimigos a onda pode sortear.
     Nenhum bicho do Ato I aparece em NÁDIR, e nenhuma ruína de NÁDIR vaza
     para a Arena. Ver HISTORIA.md. */
  ONDAS_ATO2: 100,                       // 101 a 200
  ato(onda) { return (onda === undefined ? Jogo.onda : onda) > Jogo.TOTAL_ONDAS ? 2 : 1; },
  ondaFinalDaCampanha() { return Jogo.TOTAL_ONDAS + Jogo.ONDAS_ATO2; },

  /* A onda que o JOGADOR vê. Em NÁDIR a contagem recomeça: a onda 137 por
     dentro é "ATO 2 · ONDA 37" na tela. Por dentro ela continua sendo 137,
     porque é disso que a escala de vida, o elite e o boss vivem. */
  ondaDoAto(onda) {
    const o = onda === undefined ? Jogo.onda : onda;
    return o > Jogo.TOTAL_ONDAS ? o - Jogo.TOTAL_ONDAS : o;
  },
  rotuloDaOnda(onda) {
    const o = onda === undefined ? Jogo.onda : onda;
    return Jogo.ato(o) === 2
      ? 'ATO 2 · ONDA ' + Jogo.ondaDoAto(o)
      : 'ONDA ' + o;
  },

  // Tipos que a onda de agora pode sortear: do ato certo e já estreados.
  tiposDaOnda(onda) {
    const o = onda === undefined ? Jogo.onda : onda;
    const ato = Jogo.ato(o);
    return Object.keys(TIPOS_INIMIGO).filter((k) =>
      (TIPOS_INIMIGO[k].ato || 1) === ato && TIPOS_INIMIGO[k].desde <= o);
  },

  multiplicadorVida() {
    const depoisDe40 = Math.max(0, Jogo.onda - 40);
    return 1 + Math.min(Jogo.onda - 1, 39) * 0.085 + Math.pow(depoisDe40, 0.82) * 0.032;
  },

  // Inimigo também fica mais rápido e atira mais miúdo conforme a onda sobe:
  // a mesma jogada que salvava na onda 5 não salva na 30.
  aceleracaoOnda() { return 1 + Math.min(0.48, Math.log2(1 + (Jogo.onda - 1) / 10) * 0.12); },
  ritmoInimigo() { return Math.max(0.52, 1 - Math.log2(1 + (Jogo.onda - 1) / 12) * 0.11); },

  // Chance de um inimigo nascer elite. Começa na onda 8 e satura em 30%.
  // Elite é assunto da segunda metade: tímido na onda 25, comum depois da 60.
  sorteiaElite() {
    if (Jogo.onda < 25) return false;
    return Mat.chance(Math.min(0.32, (Jogo.onda - 24) * 0.008));
  },

  prepararOnda() {
    Jogo.ondaLimpa = false;
    Jogo.intervaloOnda = 1.8;
    // fôlego no início da onda: ninguém morre no primeiro segundo
    if (Jogo.jogador) Jogo.jogador.invulneravel = Math.max(Jogo.jogador.invulneravel, 1.2);
    Jogo.composicao = [];
    Jogo.timerSpawn = 0.8;
    Jogo.iniciarHistoriaDaOnda(Jogo.onda);

    if (Jogo.ehOndaDeBoss(Jogo.onda)) {
      Jogo.spawnRestante = 0;
      Som.intensidade = 1;
      Jogo.aviso('⚠ ' + Jogo.rotuloDaOnda() + ' — BOSS');
    } else {
      // Metade tranquila: até a onda 50 a arena enche devagar e dá para ler o
      // que está acontecendo. Da 50 em diante o orçamento acelera e a tela vira
      // o caos que o fim da campanha pede.
      const ate50 = Math.min(Jogo.onda, 50);
      /* O segundo termo tem teto, e em NÁDIR ele recomeça do começo do ato.
         Dois motivos: sem teto a onda 200 pediria 363 inimigos, e com o limite
         de 30 vivos na tela isso é uma onda de dez minutos; e herdar o
         orçamento da onda 100 faria a PRIMEIRA onda de NÁDIR chegar com 153
         bichos — isso não é dificuldade, é fila. Em NÁDIR a onda volta a
         crescer; o que mantém o ato duro é a vida (multiplicadorVida conta a
         onda corrida, 101 a 200) e os dez bosses. */
      const depois50 = Jogo.ato() === 2
        ? Mat.limitar(Jogo.ondaDoAto(), 0, 50)
        : Mat.limitar(Jogo.onda - 50, 0, 50);
      const baseOrcamento = 3 + ate50 * 0.9 + depois50 * 2.1;
      const orcamento = Math.max(2, Math.round(baseOrcamento * Jogo.ajusteDificuldade().inimigos));
      const disponiveis = Jogo.tiposDaOnda(Jogo.onda);
      // O tipo que estreia nesta onda entra garantido, e em dobro: é ele que a
      // onda quer ensinar.
      const estreante = disponiveis.find((k) => TIPOS_INIMIGO[k].desde === Jogo.onda);
      let restante = orcamento;
      if (estreante) {
        Jogo.composicao.push(estreante, estreante);
        restante -= 2;
      }
      while (restante > 0) {
        const tipo = Mat.escolher(disponiveis);
        Jogo.composicao.push(tipo);
        restante -= 1;
      }
      Mat.embaralhar(Jogo.composicao);
      Jogo.spawnRestante = Jogo.composicao.length;
      Som.intensidade = Mat.limitar(Jogo.onda / 42, 0, 0.8);
      const novo = disponiveis.find((k) => TIPOS_INIMIGO[k].desde === Jogo.onda);
      const rotulo = Jogo.rotuloDaOnda();
      Jogo.aviso(novo ? rotulo + ' — ' + TIPOS_INIMIGO[novo].nome : rotulo);
    }
    UI.atualizarHUD();
  },

  spawnarInimigo() {
    const tipo = Jogo.composicao.pop();
    if (!tipo) return;
    const j = Jogo.jogador;
    let x, y, tent = 0;
    do {
      const borda = Mat.inteiro(0, 3);
      const margem = 60;
      if (borda === 0) { x = Mat.aleatorio(margem, Jogo.LARGURA - margem); y = margem; }
      else if (borda === 1) { x = Jogo.LARGURA - margem; y = Mat.aleatorio(margem, Jogo.ALTURA - margem); }
      else if (borda === 2) { x = Mat.aleatorio(margem, Jogo.LARGURA - margem); y = Jogo.ALTURA - margem; }
      else { x = margem; y = Mat.aleatorio(margem, Jogo.ALTURA - margem); }
      tent++;
    } while (Mat.distancia(x, y, j.x, j.y) < 220 && tent < 40);

    Jogo.inimigos.push(new Inimigo(tipo, x, y));
    Particulas.anel(x, y, TIPOS_INIMIGO[tipo].cor, 30, 12);
    Jogo.spawnRestante--;
  },

  // Rodízio do Ato I: os treze da Arena. O CEIFADOR (final) e O ESPECTADOR
  // (secreto) ficam fora, e os bosses de NÁDIR também — aquele rodízio é só da
  // Arena, e misturar os atos é o único jeito de quebrar a regra da história.
  rodizioDoAto1() { return BOSSES.filter((b) => !b.final && !b.secreto && (b.ato || 1) === 1); },
  bossesDeNadir() { return BOSSES.filter((b) => b.ato === 2 && !b.secreto); },

  spawnarBoss() {
    // O último da lista é o boss final: ele só aparece na onda 100 e fica de
    // fora do rodízio das ondas múltiplas de 5.
    const rodizio = Jogo.rodizioDoAto1();
    const noAto2 = Jogo.ato() === 2;
    // Onda 200: O ESPECTADOR, e ele é invencível por regra. Não é um boss duro,
    // é o limite da história — ninguém vence, e a tela de fim diz isso.
    const final = !noAto2 && Jogo.onda >= Jogo.TOTAL_ONDAS;
    const encontro = Jogo.encontroDeBoss(Jogo.onda) - 1;
    let def;
    if (noAto2) {
      const deNadir = Jogo.bossesDeNadir();
      const i = Jogo.encontroDeNadir(Jogo.onda) - 1;
      def = i >= deNadir.length ? BOSSES.find((b) => b.secreto) : deNadir[i];
    } else {
      def = final ? BOSSES.find((b) => b.final) : rodizio[encontro % rodizio.length];
    }
    Jogo.boss = new Boss(def, Jogo.onda);
    Som.ativarTenebroso();
    Jogo.flashTela(final ? 0.9 : 0.5, def.cor);
    Camera.bater(final ? 40 : 20);
    Som.bossEntra();
    if (final) {
      Jogo.aviso(def.nome);
      Jogo.pararTempo(0.6);
    } else {
      // ASCENSÃO é o rodízio dando a volta: o mesmo boss de novo, pior. Em
      // NÁDIR nenhum boss repete, então lá o letreiro nunca leva número.
      const ciclo = noAto2 ? 1 : Math.floor(encontro / rodizio.length) + 1;
      Jogo.aviso(def.nome + (ciclo > 1 ? ' · ASCENSÃO ' + ciclo : ''));
    }
    UI.mostrarBarraBoss(Jogo.boss);
  },

  bossDerrotado(boss) {
    const eraFinal = !!(boss && boss.def && boss.def.final);
    Jogo.estat.bosses++;
    Jogo.pontos += 1500 * Jogo.onda;
    UI.esconderBarraBoss();
    // Bala e mina do boss morrem com ele. Ficavam voando pela arena depois da
    // onda virar, matando o jogador por um inimigo que já não existe.
    for (let i = Jogo.projeteis.length - 1; i >= 0; i--) {
      const b = Jogo.projeteis[i];
      if (b.dono === 'jogador') continue;
      Particulas.explosao(b.x, b.y, b.cor, 3, 110, 0.22, 2);
      Jogo.projeteis.splice(i, 1);
    }
    Jogo.raios.length = 0;
    // chuva de recompensa
    for (let i = 0; i < 26; i++) {
      Jogo.coletaveis.push(new Coletavel('xp', Jogo.boss.x + Mat.aleatorio(-70, 70), Jogo.boss.y + Mat.aleatorio(-70, 70), 12));
    }
    Jogo.coletaveis.push(new Coletavel('vida', Jogo.boss.x, Jogo.boss.y + 40));
    // Toda morte vale exatamente uma moeda, inclusive boss. A economia é de
    // longo prazo; boss já paga em XP, melhoria garantida e pontuação.
    Jogo.coletaveis.push(new Coletavel('moeda', Jogo.boss.x, Jogo.boss.y, 1));
    Jogo.boss = null;
    Som.desativarTenebroso();
    // Cair o CEIFADOR não acaba o jogo: acaba a parte que estava no jogo.
    if (eraFinal && !Jogo.segredo.fase) { Jogo.abrirSegredo(); return; }
    Jogo.filaDeMelhorias += 1;
    Jogo.terminarOnda();
  },

  /* --------------------------- O SEGREDO ----------------------------- */
  /* A vitória da onda 100 é registrada AQUI, antes de qualquer coisa: o
     jogador ganhou a corrida e o placar tem que guardar isso. O que vem depois
     é epílogo, e o epílogo não pode ser vencido. */
  abrirSegredo() {
    Jogo.registrarPartida(true);
    Jogo.segredo = { fase: 'abertura', tempo: 0, marco: 0 };
    Jogo.filaDeMelhorias = 0;
    Jogo.ondaLimpa = false;
    Jogo.intervaloOnda = 0;
    Jogo.dimensao = 'intersticio';
    // A arena é esvaziada: nada da corrida antiga atravessa para o outro lado.
    Jogo.inimigos.length = 0;
    Jogo.projeteis.length = 0;
    Jogo.coletaveis.length = 0;
    Jogo.ondasChoque.length = 0;
    Jogo.raios.length = 0;
    Jogo.singularidades.length = 0;
    UI.esconderBarraBoss();
    Camera.bater(44);
    Camera.pulsar(1.14);
    Jogo.flashTela(1, '#ffffff');
    Jogo.pararTempo(0.9);
    Som.intensidade = 1;
    Som.segredo();
    Jogo.aviso('');
  },

  /* O encontro da onda 100 não é luta: é conversa. Ele aparece, fala, abre a
     fenda e desaparece — a luta dele é na onda 200, no fim de NÁDIR. As falas
     são as de HISTORIA.md, encurtadas para caber num letreiro. */
  FALAS_DO_INTERSTICIO: [
    [1.1, 'ISSO NÃO ESTAVA NO JOGO'],
    [2.6, 'ELE ASSISTIU TUDO'],
    [4.2, null],                                      // ele materializa
    [6.4, '“CEM SALAS. QUATORZE GUARDIÕES.”'],
    [9.0, '“JÁ VI VOCÊ MORRER COM TODOS ESSES ROSTOS.”'],
    [11.6, '“GUARDEI TUDO. MEDO. RAIVA. INSTINTO.”'],
    [14.2, '— ENTÃO DEVOLVA TODAS.'],
    [16.4, '“VENHA BUSCÁ-LAS.”'],
    [18.8, 'ATRAVESSE, CONDUTOR']
  ],

  // Cinemática: silêncio, aviso, nome, ele aparece, e a conversa corre.
  atualizarSegredo(dtReal) {
    const seg = Jogo.segredo;
    seg.tempo += dtReal;
    if (seg.fase !== 'abertura' && seg.fase !== 'conversa') return;

    const falas = Jogo.FALAS_DO_INTERSTICIO;
    while (seg.marco < falas.length && seg.tempo > falas[seg.marco][0]) {
      const texto = falas[seg.marco][1];
      seg.marco++;
      if (texto === null) {
        // Ele materializa no meio da arena — que é de onde o fundo desta
        // dimensão está olhando — e fica imóvel. Sem barra, porque não é luta:
        // durante a conversa o laço de entidades nem chama o atualizar dele.
        seg.fase = 'conversa';
        const def = BOSSES.find((b) => b.secreto);
        Jogo.boss = new Boss(def, Jogo.ondaFinalDaCampanha());
        Jogo.boss.x = Jogo.LARGURA / 2;
        Jogo.boss.y = Jogo.ALTURA / 2;
        Jogo.boss.baseY = Jogo.ALTURA / 2;
        Jogo.boss.entrando = 0;
        Jogo.flashTela(0.9, '#c04dff');
        Camera.bater(30);
        Som.bossEntra();
        Jogo.aviso(def.nome);
      } else {
        Jogo.aviso(texto);
        Camera.bater(8);
        Som.segredo();
      }
      return;
    }

    if (seg.marco >= falas.length && seg.tempo > falas[falas.length - 1][0] + 2.2) {
      Jogo.atravessarFenda();
    }
  },

  /* A fenda. Do outro lado a campanha CONTINUA: mesma partida, mesma build,
     mesmo placar — a contagem de onda é que recomeça do 1, com ATO 2 na frente.
     A vitória das 100 ondas já está registrada desde `abrirSegredo`; `atravessou`
     garante que, se a partida acabar em NÁDIR, ela ainda conte como vencida. */
  atravessarFenda() {
    Jogo.atravessou = true;
    // O aplicativo inteiro muda de cara daqui em diante, e continua mudado na
    // próxima vez que abrir: atravessar a fenda é conquista, não estado de
    // partida. Quem nunca chegou aqui nunca vê NÁDIR no menu.
    const primeiraVez = typeof Progresso !== 'undefined' && Progresso.liberarAto2();
    if (primeiraVez && typeof UI !== 'undefined' && UI.anunciarAto2) UI.anunciarAto2();
    Jogo.segredo = { fase: null, tempo: 0, marco: 0 };
    Jogo.boss = null;
    Som.desativarTenebroso();
    UI.esconderBarraBoss();
    Jogo.dimensao = 'nadir';
    Jogo.onda = Jogo.TOTAL_ONDAS + 1;
    Jogo.ondaLimpa = false;
    Jogo.filaDeMelhorias = 0;
    Jogo.flashTela(1, '#c04dff');
    Camera.bater(40);
    Camera.pulsar(1.12);
    Jogo.pararTempo(0.8);
    Som.intensidade = 1;
    Jogo.prepararOnda();
    Jogo.aviso('ATO 2 — NÁDIR');
  },

  /* Morrer para O ESPECTADOR não é derrota: a corrida já foi ganha antes dele
     aparecer. É só o fim da história — e a pontuação não é registrada de novo. */
  fimDoSegredo() {
    if (Jogo.estado === 'gameover' || Jogo.estado === 'vitoria') return;
    Jogo.estado = 'vitoria';
    Jogo.segredo.fase = 'fim';
    Som.gameOver();
    Camera.bater(30);
    Jogo.flashTela(0.9, '#c04dff');
    if (Jogo.jogador) Particulas.explosao(Jogo.jogador.x, Jogo.jogador.y, '#c04dff', 60, 620, 1.2, 6);
    // Chegar até ele é a maior corrida que existe: entra no placar com a
    // pontuação das 200 ondas, não com a das 100.
    Jogo.registrarPartida(true);
    UI.mostrarFinal(true, true);
  },

  terminarOnda() {
    if (Jogo.ondaLimpa) return;
    Jogo.ondaLimpa = true;
    Jogo.pontos += 300 * Jogo.onda;
    Jogo.aviso('ONDA ' + Jogo.onda + ' LIMPA');
    Jogo.intervaloOnda = 1.6;
  },

  /* --------------------------- Efeitos de tela ------------------------ */
  flashTela(alpha, cor) {
    Jogo.flash.alpha = Math.max(Jogo.flash.alpha, alpha);
    Jogo.flash.cor = cor || '#fff';
  },
  pararTempo(t) { Jogo.hitstop = Math.max(Jogo.hitstop, t); },
  congelarTempo(t) { Jogo.lentidao = Math.max(Jogo.lentidao, t); },
  aviso(texto) {
    Jogo.avisoTexto = texto;
    Jogo.avisoTimer = 2.2;
    UI.aviso(texto);
  },

  /* ------------------------------ Combate ---------------------------- */
  inimigoMaisProximo(x, y, alcance) {
    let melhor = null, melhorD = alcance * alcance;
    for (const e of Jogo.inimigos) {
      if (!e.vivo || e.nascendo > 0) continue;
      const d = Mat.distanciaQ(x, y, e.x, e.y);
      if (d < melhorD) { melhorD = d; melhor = e; }
    }
    if (Jogo.boss && Jogo.boss.vivo && Jogo.boss.entrando <= 0) {
      const d = Mat.distanciaQ(x, y, Jogo.boss.x, Jogo.boss.y);
      if (d < melhorD) melhor = Jogo.boss;
    }
    return melhor;
  },

  tiroInimigo(x, y, angulo, velocidade, dano, cor, raio, extra) {
    const cfg = {
      x: x, y: y, angulo: angulo, velocidade: velocidade,
      raio: raio || 7, dano: dano, dono: 'inimigo', cor: cor || '#ff4d6d'
    };
    if (extra) Object.assign(cfg, extra);
    Jogo.projeteis.push(new Projetil(cfg));
  },

  danificarInimigo(e, dano, critico, fx, fy) {
    if (!e.vivo) return;
    e.vida -= dano;
    e.flash = 0.2;
    Jogo.estat.danoFeito += dano;
    if (fx !== undefined) Particulas.faisca(fx, fy, Mat.anguloEntre(fx, fy, e.x, e.y), e.def ? e.def.cor : '#fff');
    Textos.criar(e.x, e.y - e.raio, Math.round(dano) + (critico ? '!' : ''), critico ? '#fff27a' : '#ffffff', critico ? 21 : 14);
    if (critico) Som.critico(); else Som.acerto();
    if (e.vida <= 0) e.morrer(true);
  },

  // Uma morte, uma moeda. Tipo, elite e onda não alteram a economia.
  moedasDe() { return 1; },

  marcarMorte(e, porTiro) {
    const j = Jogo.jogador;
    Jogo.estat.abates++;
    Jogo.combo++;
    Jogo.comboTimer = 3;
    Jogo.multiplicador = Mat.limitar(1 + Math.floor(Jogo.combo / 5), 1, 8);
    Jogo.estat.melhorMulti = Math.max(Jogo.estat.melhorMulti, Jogo.multiplicador);
    const bonusElite = e.elite ? 2.5 : 1;
    Jogo.pontos += e.def.pontos * Jogo.multiplicador * bonusElite;

    // XP
    const pedacos = Mat.inteiro(1, 2);   // menos caco no chão, mesmo XP total
    for (let i = 0; i < pedacos; i++) {
      Jogo.coletaveis.push(new Coletavel('xp', e.x + Mat.aleatorio(-14, 14), e.y + Mat.aleatorio(-14, 14), (e.def.xp * bonusElite) / pedacos));
    }
    // Moeda da loja. Todo inimigo larga a sua — é a única fonte de moeda que o
    // jogo tem, então ela não depende de sorte.
    Jogo.coletaveis.push(new Coletavel('moeda', e.x + Mat.aleatorio(-10, 10), e.y + Mat.aleatorio(-10, 10), Jogo.moedasDe(e)));

    // Item raro ficou mais raro, e cura é o mais difícil de cair: vida perdida
    // tem que doer até o fim da partida.
    if (Mat.chance(e.elite ? 0.1 : 0.035)) {
      const sorteio = Mat.chance(0.25) ? 'vida' : Mat.escolher(['bomba', 'ima', 'frenesi']);
      Jogo.coletaveis.push(new Coletavel(sorteio, e.x, e.y));
    }
    if (j.classe.curaPorMorte) j.curar(j.attr.vidaMax * j.classe.curaPorMorte);
    // CARNIFICINA se alimenta: cada abate durante a ult empurra o cronômetro
    // dela para frente, até um teto. Quem mergulha na multidão é premiado.
    if (j.ultAtiva > 0 && j.classe.id === 'espectro') {
      j.ultAtiva = Math.min(9, j.ultAtiva + 0.35);
      j.invulneravel = Math.max(j.invulneravel, j.ultAtiva);
      j.abatesNaUlt = (j.abatesNaUlt || 0) + 1;
      // Reação em cadeia: cada morte estoura uma onda pequena que pode matar o
      // vizinho, que estoura outra. É o que faz a multidão desabar junto.
      Jogo.ondasChoque.push({
        x: e.x, y: e.y, raio: 6, raioMax: 190, dano: j.attr.dano * 2.5,
        cor: j.classe.cor, atingidos: new Set(), empurrao: 420
      });
    }
    if (j.vampirismo > 0 && Mat.chance(j.vampirismo)) j.curar(0.5);
    // a remoção do array acontece no laço principal (flag .vivo), nunca aqui:
    // splicar em dois lugares embaralha os índices do laço.
  },

  bombaDeTela() {
    Jogo.ondasChoque.push({
      x: Jogo.jogador.x, y: Jogo.jogador.y, raio: 10, raioMax: 900,
      dano: 260, cor: '#ffd34d', atingidos: new Set(), empurrao: 600
    });
    Jogo.flashTela(0.6, '#ffd34d');
    Camera.bater(20);
    Som.ultimate();
    // limpa projéteis inimigos
    for (let i = Jogo.projeteis.length - 1; i >= 0; i--) {
      if (Jogo.projeteis[i].dono !== 'jogador') {
        Particulas.explosao(Jogo.projeteis[i].x, Jogo.projeteis[i].y, '#ffd34d', 5, 120, 0.3, 2);
        Jogo.projeteis.splice(i, 1);
      }
    }
  },

  aplicarRaio(x, y, angulo, dano, largura) {
    // dano em tudo que estiver na linha do raio
    const dx = Math.cos(angulo), dy = Math.sin(angulo);
    const alvos = Jogo.inimigos.slice();
    if (Jogo.boss && Jogo.boss.vivo) alvos.push(Jogo.boss);
    for (const e of alvos) {
      const t = (e.x - x) * dx + (e.y - y) * dy;
      if (t < 0) continue;
      const px = x + dx * t, py = y + dy * t;
      if (Mat.distancia(px, py, e.x, e.y) < e.raio + (largura || 22)) {
        if (e === Jogo.boss) e.receberDano(dano, true, px, py);
        else Jogo.danificarInimigo(e, dano, true, px, py);
      }
    }
    for (let i = 0; i < 40; i++) {
      Particulas.emitir({
        x: x + dx * i * 40, y: y + dy * i * 40,
        vx: Mat.aleatorio(-60, 60), vy: Mat.aleatorio(-60, 60),
        vida: 0.4, tam: 5, cor: '#8fe3ff', brilho: 18, atrito: 0.88
      });
    }
  },

  // Cada boss derrubado cospe um 67 gigante na tela, e o estilo muda de um
  // para o outro: o índice vem da posição do boss na tabela, então o mesmo
  // boss sempre traz o mesmo 67.
  ESTILOS_67: [
    { id: 'neon',    cor: '#31e0ff', cor2: '#093a4d', fonte: '900 300px Orbitron, Arial Black, sans-serif' },
    { id: 'lava',    cor: '#ff8e45', cor2: '#5c1a00', fonte: '900 320px Impact, Arial Black, sans-serif' },
    { id: 'vidro',   cor: '#eaf6ff', cor2: '#33556b', fonte: '900 300px Orbitron, Arial Black, sans-serif' },
    { id: 'ouro',    cor: '#ffd34d', cor2: '#6b4a00', fonte: '900 330px Impact, Arial Black, sans-serif' },
    { id: 'toxico',  cor: '#c6ff4d', cor2: '#2f5c00', fonte: '900 300px Orbitron, Arial Black, sans-serif' },
    { id: 'jade',    cor: '#56f0b0', cor2: '#0d4d38', fonte: '900 310px Impact, Arial Black, sans-serif' },
    { id: 'fantasma',cor: '#b9b2ff', cor2: '#2d2160', fonte: '900 300px Orbitron, Arial Black, sans-serif' },
    { id: 'rosa',    cor: '#ff5cae', cor2: '#5c0d38', fonte: '900 330px Impact, Arial Black, sans-serif' },
    { id: 'ferro',   cor: '#cfdbe8', cor2: '#3a4756', fonte: '900 320px Impact, Arial Black, sans-serif' },
    { id: 'gelo',    cor: '#7ef9ff', cor2: '#0e4a57', fonte: '900 300px Orbitron, Arial Black, sans-serif' },
    { id: 'raio',    cor: '#ffe14d', cor2: '#5c4c00', fonte: '900 330px Impact, Arial Black, sans-serif' },
    { id: 'abismo',  cor: '#ff2e6e', cor2: '#3d001a', fonte: '900 320px Orbitron, Arial Black, sans-serif' },
    { id: 'arauto',  cor: '#ff5252', cor2: '#4d0000', fonte: '900 340px Impact, Arial Black, sans-serif' },
    { id: 'final',   cor: '#ffffff', cor2: '#7a0010', fonte: '900 360px Impact, Arial Black, sans-serif' }
  ],

  // A queda do segundo boss (onda 10) tem festa própria: texto no lugar do 67 e
  // uma das falas gravadas.
  ESTILO_ENCAIXA: { id: 'encaixa', cor: '#7cff9b', cor2: '#0b4d22', fonte: '900 220px Impact, Arial Black, sans-serif' },

  comemorar67(def) {
    // O final tem o 67 branco reservado; os outros seguem a posição na tabela.
    const indice = def && def.final
      ? Jogo.ESTILOS_67.length - 1
      : Math.max(0, BOSSES.indexOf(def)) % (Jogo.ESTILOS_67.length - 1);
    // Os dois primeiros encontros têm festa com nome e som próprios: o da onda 5
    // grita SIX SEVEN, o da onda 10 grita ENCAIXA!. Do terceiro em diante é o 67.
    const encontro = def.final ? 0 : Jogo.encontroDeBoss(Jogo.onda);
    const estilo = encontro === 2 ? Jogo.ESTILO_ENCAIXA : Jogo.ESTILOS_67[indice];
    const texto = encontro === 1 ? 'SIX SEVEN' : encontro === 2 ? 'ENCAIXA!' : '67';
    // Tempo de tela casado com a fala: a do 67 tem 1,9 s, as da onda 10 têm
    // 3,6 s. O letreiro fica no ar até o áudio terminar, com folga.
    const duracao = encontro === 1 ? 4.2 : encontro === 2 ? 5.4 : 3.0;
    Jogo.festa67 = { estilo, texto, vida: duracao, vidaMax: duracao, semente: Math.random() * 10 };
    Jogo.flashTela(0.55, estilo.cor);
    if (encontro === 1) Som.tocarClipe('sixseven');
    else if (encontro === 2) Som.tocarClipe('encaixa');
  },

  desenhar67(ctx) {
    const f = Jogo.festa67;
    if (!f) return;
    const p = 1 - f.vida / f.vidaMax;              // 0 no começo, 1 no fim
    const entrada = Mat.limitar(p / 0.18, 0, 1);   // estufa na chegada
    const saida = Mat.limitar((p - 0.75) / 0.25, 0, 1);
    const escala = (0.4 + entrada * 0.75 - saida * 0.25) * (1 + Math.sin(Jogo.tempo * 9) * 0.02);
    const e = f.estilo;

    ctx.save();
    ctx.globalAlpha = 1 - saida;
    ctx.translate(Jogo.LARGURA / 2, Jogo.ALTURA / 2);
    ctx.scale(escala, escala);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = e.fonte;

    // Texto comprido não pode vazar da arena: encolhe a fonte até caber. O
    // limite desconta a escala da animação, senão "SIX SEVEN" mede certo aqui
    // e sai pelas beiradas depois do ctx.scale.
    const texto = f.texto || '67';
    const largura = ctx.measureText(texto).width;
    const limite = (Jogo.LARGURA * 0.82) / Math.max(0.2, escala);
    if (largura > limite) {
      // o número que importa é o do "px", não o peso da fonte
      const tamanho = parseInt((e.fonte.match(/(\d+)px/) || [])[1], 10) || 300;
      ctx.font = e.fonte.replace(/\d+px/, Math.max(60, Math.round(tamanho * (limite / largura))) + 'px');
    }

    // tremor curto na entrada, para o número "bater" na tela
    if (p < 0.2) {
      const t = (0.2 - p) * 26;
      ctx.translate(Mat.aleatorio(-t, t), Mat.aleatorio(-t, t));
    }
    ctx.rotate(Math.sin(Jogo.tempo * 2 + f.semente) * 0.03);

    // sombra chapada atrás
    ctx.fillStyle = e.cor2;
    ctx.fillText(texto, 14, 16);

    // corpo com brilho
    ctx.shadowBlur = Jogo.modoLeve ? 0 : 60;
    ctx.shadowColor = e.cor;
    ctx.fillStyle = e.cor;
    ctx.fillText(texto, 0, 0);

    // contorno e faixa de leitura, cada estilo com o seu acabamento
    ctx.shadowBlur = 0;
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#ffffff';
    ctx.globalAlpha = (1 - saida) * 0.85;
    ctx.strokeText(texto, 0, 0);

    ctx.globalAlpha = (1 - saida) * 0.28;
    ctx.fillStyle = '#000000';
    const meia = Math.max(320, ctx.measureText(texto).width / 2 + 30);
    for (let y = -170; y < 170; y += 12) ctx.fillRect(-meia, y, meia * 2, 4);
    ctx.restore();
  },

  aplicarRaioBoss(x, y, angulo, cor) {
    const dx = Math.cos(angulo), dy = Math.sin(angulo);
    for (const j of Jogo.jogadores()) {
      const t = (j.x - x) * dx + (j.y - y) * dy;
      if (t < 0) continue;
      const px = x + dx * t, py = y + dy * t;
      if (Mat.distancia(px, py, j.x, j.y) < j.raio + 16) j.receberDano(1, px, py);
    }
  },

  /* ------------------------------- Loop ------------------------------ */
  loop(agora) {
    requestAnimationFrame(Jogo.loop);
    if (document.hidden) { Jogo.ultimoQuadro = agora; return; }
    let dt = (agora - Jogo.ultimoQuadro) / 1000;
    Jogo.ultimoQuadro = agora;
    if (dt > 0.05) dt = 0.05;   // evita salto após aba inativa

    Jogo.acumFps += dt; Jogo.contFps++;
    if (Jogo.acumFps > 0.5) {
      Jogo.fps = Math.round(Jogo.contFps / Jogo.acumFps);
      Jogo.acumFps = 0; Jogo.contFps = 0;
      Jogo.ajustarQualidade();
    }

    Som.tocarMusica();
    if (Coop.convidado()) Coop.entreQuadros(dt);   // prevê e interpola antes de mirar a câmera
    Camera.atualizar(dt);
    Input.atualizarMouse();

    if (Jogo.estado === 'jogando' && !Coop.convidado()) Jogo.atualizar(dt);
    else { Particulas.atualizar(dt); Jogo.tempo += dt; }
    if (Coop.convidado()) Coop.enviarControle();
    else if (Coop.anfitriao()) Coop.enviarEstado(agora);

    if (!Jogo.modoLeve || Jogo.estado === 'jogando' || agora - Jogo.ultimoDesenho >= 1000 / 15) {
      Jogo.desenhar();
      Jogo.ultimoDesenho = agora;
    }
    Input.limparQuadro();
  },

  /* ------------------- Qualidade que se ajusta sozinha ----------------- */
  /* Celular não é um aparelho, são mil. Um número fixo de escala de render ou
     fica pesado no aparelho fraco ou desperdiça nítido no forte. Então o jogo
     mede o próprio FPS e mexe na escala: caiu de 46 por dois meio-segundos
     seguidos, desce um passo; passou de 57 por seis, sobe um passo.

     Duas proteções contra o pior defeito possível aqui, que é o jogo ficar
     piscando entre duas qualidades:
       - precisa de várias medidas no mesmo sentido para mexer (não é na
         primeira queda, que pode ser o navegador carregando algo);
       - a faixa de subir (57) está longe da de descer (46).

     Fora do celular não mexe em nada: no PC a escala é 1 e fica 1. */
  QUALIDADES: [0.45, 0.55, 0.62, 0.75],
  _quedas: 0,
  _folgas: 0,

  ajustarQualidade() {
    if (!Jogo.modoLeve || Jogo.estado !== 'jogando') return;
    const passo = Jogo.QUALIDADES.indexOf(Jogo.escalaRender);
    const atual = passo < 0 ? 2 : passo;          // 0,62 é o ponto de partida

    if (Jogo.fps < 46) { Jogo._quedas++; Jogo._folgas = 0; }
    else if (Jogo.fps > 57) { Jogo._folgas++; Jogo._quedas = 0; }
    else { Jogo._quedas = 0; Jogo._folgas = 0; }

    let novo = atual;
    if (Jogo._quedas >= 2 && atual > 0) { novo = atual - 1; Jogo._quedas = 0; }
    else if (Jogo._folgas >= 6 && atual < Jogo.QUALIDADES.length - 1) { novo = atual + 1; Jogo._folgas = 0; }
    if (novo === atual) return;

    Jogo.escalaRender = Jogo.QUALIDADES[novo];
    Jogo.canvas.width = Math.round(Jogo.LARGURA * Jogo.escalaRender);
    Jogo.canvas.height = Math.round(Jogo.ALTURA * Jogo.escalaRender);
  },

  atualizar(dtReal) {
    // hitstop e slow-motion
    let escala = 1;
    if (Jogo.hitstop > 0) { Jogo.hitstop -= dtReal; escala = 0.02; }
    else if (Jogo.lentidao > 0) { Jogo.lentidao -= dtReal; escala = 0.28; }

    const dt = dtReal * escala;
    Jogo.dtReal = dtReal;   // quem precisa de tempo de relógio, e não de jogo

    // CARNIFICINA: o mundo anda em câmera lenta e só o ESPECTRO corre no tempo
    // normal. É o que transforma a ult num corredor de abate em vez de um
    // buff de dano — e é por isso que `dtMundo` existe separado de `dt`.
    const dono = Jogo.jogador;
    Jogo.emCarnificina = !!(dono && dono.ultAtiva > 0 && dono.classe.id === 'espectro');
    const dtMundo = Jogo.emCarnificina ? dt * 0.45 : dt;
    Jogo.tempo += dt;
    Jogo.tempoJogo += dtReal;
    Jogo.imaGlobal = Math.max(0, Jogo.imaGlobal - dtReal);
    Jogo.avisoTimer = Math.max(0, Jogo.avisoTimer - dtReal);

    // pausa
    if (Input.apertou('KeyP') || Input.apertou('Escape')) { Jogo.pausar(); return; }
    if (Jogo.historiaAtiva) return;

    // A festa do boss manda na tela: enquanto o letreiro estiver no ar, nada
    // aparece por cima dele. A carta de melhoria espera na fila e abre assim
    // que o SIX SEVEN, o ENCAIXA! ou o 67 terminarem — junto com a fala.
    if (Jogo.filaDeMelhorias > 0 && !Jogo.festa67) { Jogo.abrirMelhoria(); return; }

    if (Jogo.jogador.vida > 0) Jogo.jogador.atualizar(dt);
    for (const [id, outro] of Jogo.outros) {
      if (outro.vida <= 0) continue;
      outro.atualizar(dt, Coop.controlesRemotos.get(id) || Coop.controleParado);
      const controle = Coop.controlesRemotos.get(id);
      if (controle) controle.pulsos = {};
    }

    // combo decai
    if (Jogo.comboTimer > 0) {
      Jogo.comboTimer -= dtReal;
      if (Jogo.comboTimer <= 0) { Jogo.combo = 0; Jogo.multiplicador = 1; }
    }

    // Durante o segredo a campanha para: sem onda, sem spawn, sem contagem.
    // Quem atualiza o boss continua sendo o laço de entidades, logo abaixo.
    if (Jogo.segredo.fase) {
      Jogo.atualizarSegredo(dtReal);
    } else if (Jogo.intervaloOnda > 0) {
      Jogo.intervaloOnda -= dtReal;
      if (Jogo.festa67) Jogo.intervaloOnda = Math.max(Jogo.intervaloOnda, 0.4);
      if (Jogo.intervaloOnda <= 0 && Jogo.ondaLimpa) {
        // A 100 não encerra mais nada: derrubar o CEIFADOR abre o Interstício, e
        // de lá a campanha atravessa para NÁDIR. Este ramo existe para a onda
        // 200 — e ela só termina se O ESPECTADOR cair, o que não acontece.
        if (Jogo.onda >= Jogo.ondaFinalDaCampanha()) { Jogo.vitoria(); return; }
        Jogo.onda++;
        Jogo.prepararOnda();
      } else if (Jogo.intervaloOnda <= 0 && Jogo.ehOndaDeBoss(Jogo.onda) && !Jogo.boss) {
        Jogo.spawnarBoss();
      }
    } else if (!Jogo.ondaLimpa) {
      if (Jogo.spawnRestante > 0) {
        Jogo.timerSpawn -= dtReal;
        const ritmo = Math.max(0.24, 1.05 - Jogo.onda * 0.016);
        // Teto de inimigos vivos: 7 na onda 5, 13 na 30, 18 na 50 — e daí sobe
        // rápido até 30 na onda 90. A tela só fica cheia quando tem que ficar.
        const base = Jogo.onda <= 50 ? 6 + Jogo.onda * 0.24 : 18 + (Jogo.onda - 50) * 0.3;
        const tetoSimultaneo = Math.min(Jogo.modoLeve ? 20 : 30, Math.round(base));
        if (Jogo.timerSpawn <= 0 && Jogo.inimigos.length < tetoSimultaneo) {
          Jogo.spawnarInimigo();
          Jogo.timerSpawn = ritmo;
        }
      } else if (Jogo.inimigos.length === 0 && !Jogo.boss) {
        Jogo.terminarOnda();
      }
    }

    // entidades
    for (let i = Jogo.inimigos.length - 1; i >= 0; i--) {
      const e = Jogo.inimigos[i];
      e.atualizar(dtMundo);
      if (!e.vivo) Jogo.inimigos.splice(i, 1);
    }
    // Na conversa do Interstício ele está na tela e não faz nada: não anda, não
    // atira, não cobra nada do jogador. É o único momento do jogo assim.
    if (Jogo.boss && Jogo.segredo.fase !== 'conversa') {
      Jogo.boss.atualizar(dtMundo);
    }

    // projéteis + colisões
    for (let i = Jogo.projeteis.length - 1; i >= 0; i--) {
      const b = Jogo.projeteis[i];
      b.atualizar(dtMundo);
      if (!b.vivo) { Jogo.projeteis.splice(i, 1); continue; }

      if (b.dono === 'jogador') {
        let acabou = false;
        for (const e of Jogo.inimigos) {
          if (!e.vivo || b.atingidos.indexOf(e) >= 0) continue;
          if (Mat.distancia(b.x, b.y, e.x, e.y) < b.raio + e.raio) {
            // Couraça bloqueia tiro de frente — mas o escudo tem vida: cada
            // tiro absorvido gasta uma parte dele, e quando quebra o bicho
            // fica exposto pelo resto da onda.
            if (e.def.escudoFrontal && e.escudoVida > 0) {
              const angDoTiro = Mat.anguloEntre(e.x, e.y, b.x, b.y);
              const angJog = Mat.anguloEntre(e.x, e.y, Jogo.jogador.x, Jogo.jogador.y);
              if (Math.abs(Mat.normalizarAngulo(angDoTiro - angJog)) < 0.9) {
                e.escudoVida -= b.dano;
                e.escudoFlash = 0.25;
                Particulas.faisca(b.x, b.y, b.angulo + Math.PI, '#dfe9f5');
                Som.acerto();
                Textos.criar(b.x, b.y, Math.round(Math.min(b.dano, e.escudoVida + b.dano)), '#7fd4ff', 13);
                if (e.escudoVida <= 0) {
                  // o que sobrou do tiro atravessa: escudo quebrando no meio do
                  // pente não devolve dano de graça para o inimigo
                  const sobra = -e.escudoVida;
                  e.quebrarEscudo();
                  if (sobra > 0) Jogo.danificarInimigo(e, sobra, b.critico, b.x, b.y);
                }
                acabou = true;
                break;
              }
            }
            let dano = b.dano;
            if (e.def.resiste) dano *= e.def.resiste;
            Jogo.danificarInimigo(e, dano, b.critico, b.x, b.y);
            b.atingidos.push(e);
            if (b.perfuracao <= 0) { acabou = true; break; }
            b.perfuracao--;
          }
        }
        if (!acabou && Jogo.boss && Jogo.boss.vivo && b.atingidos.indexOf(Jogo.boss) < 0) {
          if (Mat.distancia(b.x, b.y, Jogo.boss.x, Jogo.boss.y) < b.raio + Jogo.boss.raio) {
            Jogo.boss.receberDano(b.dano, b.critico, b.x, b.y);
            Jogo.estat.danoFeito += b.dano;
            b.atingidos.push(Jogo.boss);
            if (b.perfuracao <= 0) acabou = true; else b.perfuracao--;
          }
        }
        if (acabou) { Jogo.projeteis.splice(i, 1); continue; }
      } else {
        let consumido = false;
        for (const j of Jogo.jogadores()) {
        const d = Mat.distancia(b.x, b.y, j.x, j.y);
        // escudo do guardião reflete
        if (j.escudoAtivo && d < j.raio * 2.1 + b.raio) {
          if (j.classe.escudoReflete) {
            b.dono = 'jogador';
            b.angulo += Math.PI + Mat.aleatorio(-0.2, 0.2);
            b.dano = j.attr.dano * 1.6;
            b.cor = '#ffd34d';
            b.atingidos = [];
            Particulas.faisca(b.x, b.y, b.angulo, '#ffd34d');
            Som.acerto();
          } else {
            Particulas.explosao(b.x, b.y, '#ffd34d', 6, 150, 0.3, 3);
            Jogo.projeteis.splice(i, 1);
          }
          consumido = true; break;
        }
        if (d < j.raio + b.raio) {
          if (j.receberDano(b.dano, b.x, b.y)) Jogo.estat.danoRecebido += b.dano;
          Particulas.explosao(b.x, b.y, b.cor, 8, 200, 0.35, 3);
          Jogo.projeteis.splice(i, 1);
          consumido = true; break;
        }
        }
        if (consumido) continue;
      }
    }

    // coletáveis
    for (let i = Jogo.coletaveis.length - 1; i >= 0; i--) {
      const c = Jogo.coletaveis[i];
      c.atualizar(dt);
      if (!c.vivo) Jogo.coletaveis.splice(i, 1);
    }

    // ondas de choque
    for (let i = Jogo.ondasChoque.length - 1; i >= 0; i--) {
      const o = Jogo.ondasChoque[i];
      o.raio += (o.raioMax * 1.6) * dt;
      const alvos = Jogo.inimigos.slice();
      if (Jogo.boss && Jogo.boss.vivo) alvos.push(Jogo.boss);
      for (const e of alvos) {
        if (o.atingidos.has(e)) continue;
        const d = Mat.distancia(o.x, o.y, e.x, e.y);
        if (d < o.raio) {
          o.atingidos.add(e);
          if (e === Jogo.boss) e.receberDano(o.dano, false, e.x, e.y);
          else {
            Jogo.danificarInimigo(e, o.dano, false, e.x, e.y);
            const a = Mat.anguloEntre(o.x, o.y, e.x, e.y);
            e.vx += Math.cos(a) * o.empurrao;
            e.vy += Math.sin(a) * o.empurrao;
          }
        }
      }
      if (o.limpaTiros) {
        for (let k = Jogo.projeteis.length - 1; k >= 0; k--) {
          const b = Jogo.projeteis[k];
          if (b.dono === 'jogador') continue;
          if (Mat.distancia(o.x, o.y, b.x, b.y) < o.raio) {
            Particulas.explosao(b.x, b.y, o.cor, 4, 120, 0.25, 2);
            Jogo.projeteis.splice(k, 1);
          }
        }
      }
      if (o.raio >= o.raioMax) Jogo.ondasChoque.splice(i, 1);
    }

    // singularidades (ult do arcano)
    for (let i = Jogo.singularidades.length - 1; i >= 0; i--) {
      const s = Jogo.singularidades[i];
      s.vida -= dt;
      for (const e of Jogo.inimigos) {
        const d = Mat.distancia(s.x, s.y, e.x, e.y);
        if (d < s.raio) {
          const a = Mat.anguloEntre(e.x, e.y, s.x, s.y);
          const forca = Mat.misturar(700, 200, d / s.raio);
          e.x += Math.cos(a) * forca * dt;
          e.y += Math.sin(a) * forca * dt;
        }
      }
      if (Mat.chance(0.9)) {
        const a = Math.random() * Mat.TAU;
        Particulas.emitir({
          x: s.x + Math.cos(a) * s.raio, y: s.y + Math.sin(a) * s.raio,
          vx: -Math.cos(a) * 420, vy: -Math.sin(a) * 420,
          vida: 0.5, tam: 4, cor: s.cor, brilho: 16, atrito: 0.94
        });
      }
      if (s.vida <= 0 && !s.explodiu) {
        s.explodiu = true;
        Jogo.ondasChoque.push({ x: s.x, y: s.y, raio: 10, raioMax: 700, dano: s.dano, cor: s.cor, atingidos: new Set(), empurrao: 1000, limpaTiros: true });
        Camera.bater(22);
        Jogo.flashTela(0.5, s.cor);
        Jogo.singularidades.splice(i, 1);
      }
    }

    // raios visuais
    for (let i = Jogo.raios.length - 1; i >= 0; i--) {
      Jogo.raios[i].vida -= dtReal;
      if (Jogo.raios[i].vida <= 0) Jogo.raios.splice(i, 1);
    }

    Particulas.atualizar(dt);
    Textos.atualizar(dtReal);
    Jogo.flash.alpha = Math.max(0, Jogo.flash.alpha - dtReal * 2.6);
    if (Jogo.festa67) {
      Jogo.festa67.vida -= dtReal;
      if (Jogo.festa67.vida <= 0) {
        Jogo.festa67 = null;
        // acabou o letreiro: a carta que estava esperando entra agora
        if (Jogo.filaDeMelhorias > 0 && Jogo.estado === 'jogando') Jogo.abrirMelhoria();
      }
    }
    Jogo.intervaloHUD -= dtReal;
    if (Jogo.intervaloHUD <= 0) {
      UI.atualizarHUD();
      // Sem boss vivo, sem barra. Antes ela só sumia pelo caminho da morte do
      // boss, então qualquer outra saída (reiniciar, virar onda, convidado
      // perdendo o snapshot) deixava a barra pendurada na tela.
      if (Jogo.boss && Jogo.boss.vivo) UI.atualizarBarraBoss(Jogo.boss);
      else UI.esconderBarraBoss();
      Jogo.intervaloHUD = Jogo.modoLeve ? 0.1 : 0.05;
    }
  },

  /* ---------------------------- Transições --------------------------- */
  pausar() {
    if (Jogo.estado !== 'jogando') return;
    if (Coop.convidado()) { Coop.status('Só o anfitrião pausa a partida cooperativa.'); return; }
    Jogo.estado = 'pausado';
    UI.mostrarTela('pausa');
  },
  retomar() {
    if (Jogo.estado !== 'pausado') return;
    Jogo.estado = 'jogando';
    UI.mostrarTela(null);
  },
  abrirMelhoria() {
    Jogo.filaDeMelhorias--;
    Jogo.estado = 'melhoria';
    UI.mostrarMelhorias(sortearMelhorias(Jogo.jogador, 3));
  },
  escolherMelhoria(m) {
    Jogo.jogador.aplicarMelhoria(m);
    if (Jogo.filaDeMelhorias > 0) { Jogo.abrirMelhoria(); return; }
    Jogo.estado = 'jogando';
    UI.mostrarTela(null);
  },
  derrota() {
    // Cair para O ESPECTADOR não é derrota: é o fim da história, e tem tela
    // própria. Quem decide isso é a invencibilidade dele, não a onda.
    if (Jogo.boss && Jogo.boss.def.invencivel) { Jogo.fimDoSegredo(); return; }
    // A morte chega por mais de um caminho no mesmo quadro (dano, laço de
    // jogadores, colisão). Partida já encerrada não pode ser reescrita — era
    // isso que trocava o final do segredo por um GAME OVER comum.
    if (Jogo.estado === 'gameover' || Jogo.estado === 'vitoria') return;
    Jogo.estado = 'gameover';
    Som.gameOver();
    Camera.bater(30);
    Jogo.flashTela(0.8, '#ff2b4d');
    if (Jogo.jogador) Particulas.explosao(Jogo.jogador.x, Jogo.jogador.y, Jogo.jogador.classe.cor, 60, 620, 1.2, 6);
    // Morrer em NÁDIR não apaga as 100 ondas: quem atravessou a fenda venceu a
    // Arena, e a pontuação de agora é maior que a de lá.
    Jogo.registrarPartida(Jogo.atravessou);
    UI.mostrarFinal(Jogo.atravessou, false, true);
  },
  vitoria() {
    if (Jogo.estado === 'vitoria') return;
    Jogo.estado = 'vitoria';
    Som.vitoria();
    Jogo.pontos += 10000;
    Jogo.registrarPartida(true);
    UI.mostrarFinal(true);
  },
  registrarPartida(venceu) {
    if (Coop.ativo()) return; // ranking solo não aceita pontuação cooperativa
    const entrada = {
      nome: Perfil.exibir(),
      pontos: Math.round(Jogo.pontos),
      classe: Jogo.jogador.classe.nome,
      onda: Jogo.onda,
      // O ato fica gravado: onda 137 no Ato II é outra coisa que onda 37.
      ato: Jogo.ato(),
      nivel: Jogo.jogador.nivel,
      abates: Jogo.estat.abates,
      tempo: Math.round(Jogo.tempoJogo),
      venceu: venceu,
      data: new Date().toISOString().slice(0, 10)
    };
    Recordes.registrar(entrada);
    // placar mundial é o melhor esforço: falhar aqui não afeta a partida
    Placar.enviar(entrada);
  },

  /* ------------------------------ Render ----------------------------- */
  visivel(x, y, margem) {
    const metadeX = Jogo.LARGURA / (2 * Camera.zoom) + margem;
    const metadeY = Jogo.ALTURA / (2 * Camera.zoom) + margem;
    return Math.abs(x - Camera.centroX) <= metadeX && Math.abs(y - Camera.centroY) <= metadeY;
  },

  // Etiqueta de apelido e vida em cima de cada colega — sem ela o cooperativo
  // vira um monte de naves iguais.
  desenharEtiquetas(ctx) {
    ctx.save();
    ctx.textAlign = 'center';
    for (const outro of Jogo.outros.values()) {
      if (!Jogo.visivel(outro.x, outro.y, 120)) continue;
      const y = outro.y - outro.raio - 26;
      const vivo = outro.vida > 0;
      ctx.globalAlpha = vivo ? 0.92 : 0.4;
      ctx.font = '700 13px Rajdhani, sans-serif';
      ctx.fillStyle = vivo ? outro.skin.cor : '#7a8ba0';
      ctx.fillText(outro.nome || 'COLEGA', outro.x, y);
      if (!vivo) { ctx.fillStyle = '#7a8ba0'; ctx.fillText('CAÍDO', outro.x, y + 14); continue; }
      const largura = 44, p = Mat.limitar(outro.vida / outro.attr.vidaMax, 0, 1);
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#0d1526';
      ctx.fillRect(outro.x - largura / 2, y + 5, largura, 4);
      ctx.fillStyle = p > 0.5 ? '#3ce06a' : p > 0.25 ? '#ffd34d' : '#ff4d6d';
      ctx.fillRect(outro.x - largura / 2, y + 5, largura * p, 4);
    }
    ctx.restore();
  },

  desenhar() {
    const ctx = Jogo.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, Jogo.canvas.width, Jogo.canvas.height);
    ctx.setTransform(Jogo.escalaRender, 0, 0, Jogo.escalaRender, 0, 0);

    Camera.aplicar(ctx, Jogo.LARGURA, Jogo.ALTURA);
    Jogo.desenharFundo(ctx);

    if (Jogo.jogador) {
      // singularidades atrás de tudo
      for (const s of Jogo.singularidades) {
        const p = 1 - s.vida / s.vidaMax;
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(Jogo.tempo * 3);
        const g = ctx.createRadialGradient(0, 0, 4, 0, 0, s.raio);
        g.addColorStop(0, '#000');
        g.addColorStop(0.4, s.cor);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, s.raio * (0.7 + p * 0.3), 0, Mat.TAU);
        ctx.fill();
        ctx.restore();
      }

      // ondas de choque
      for (const o of Jogo.ondasChoque) {
        const p = o.raio / o.raioMax;
        ctx.save();
        ctx.globalAlpha = 1 - p;
        ctx.strokeStyle = o.cor;
        ctx.lineWidth = 14 * (1 - p) + 2;
        ctx.shadowBlur = Jogo.modoLeve ? 0 : 30; ctx.shadowColor = o.cor;
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.raio, 0, Mat.TAU);
        ctx.stroke();
        ctx.restore();
      }

      for (const c of Jogo.coletaveis) if (Jogo.visivel(c.x, c.y, 40)) c.desenhar(ctx);
      for (const e of Jogo.inimigos) if (Jogo.visivel(e.x, e.y, e.raio + 80)) e.desenhar(ctx);
      if (Jogo.boss) Jogo.boss.desenhar(ctx);
      for (const b of Jogo.projeteis) if (Jogo.visivel(b.x, b.y, b.raio + 40)) b.desenhar(ctx);
      for (const outro of Jogo.outros.values()) if (outro.vida > 0) outro.desenhar(ctx);
      if (Coop.ativo()) Jogo.desenharEtiquetas(ctx);
      if (Jogo.jogador.vida > 0) Jogo.jogador.desenhar(ctx);

      // raios da ult
      for (const r of Jogo.raios) {
        const p = r.vida / r.vidaMax;
        ctx.save();
        ctx.translate(r.x, r.y);
        ctx.rotate(r.angulo);
        ctx.globalAlpha = p;
        const g = ctx.createLinearGradient(0, 0, 2200, 0);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.15, r.cor);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.shadowBlur = Jogo.modoLeve ? 0 : 50; ctx.shadowColor = r.cor;
        ctx.fillRect(0, -r.largura * p / 2, 2200, r.largura * p);
        ctx.restore();
      }

      Particulas.desenhar(ctx);
      Textos.desenhar(ctx);
      Jogo.desenharMira(ctx);
    }

    Camera.restaurar(ctx);

    // flash de tela
    if (Jogo.flash.alpha > 0) {
      ctx.globalAlpha = Mat.limitar(Jogo.flash.alpha, 0, 1);
      ctx.fillStyle = Jogo.flash.cor;
      ctx.fillRect(0, 0, Jogo.LARGURA, Jogo.ALTURA);
      ctx.globalAlpha = 1;
    }

    // vinheta
    const vin = ctx.createRadialGradient(Jogo.LARGURA / 2, Jogo.ALTURA / 2, Jogo.ALTURA * 0.35, Jogo.LARGURA / 2, Jogo.ALTURA / 2, Jogo.ALTURA * 0.85);
    vin.addColorStop(0, 'rgba(0,0,0,0)');
    vin.addColorStop(1, 'rgba(0,0,0,.72)');
    ctx.fillStyle = vin;
    ctx.fillRect(0, 0, Jogo.LARGURA, Jogo.ALTURA);

    // aviso central
    if (Jogo.avisoTimer > 0 && Jogo.estado === 'jogando') {
      const p = Jogo.avisoTimer / 2.2;
      ctx.save();
      ctx.globalAlpha = Math.min(1, p * 1.6);
      ctx.textAlign = 'center';
      ctx.font = '900 46px Orbitron, Rajdhani, Arial';
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(0,0,0,.7)';
      ctx.strokeText(Jogo.avisoTexto, Jogo.LARGURA / 2, 130);
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 26; ctx.shadowColor = '#7ee8ff';
      ctx.fillText(Jogo.avisoTexto, Jogo.LARGURA / 2, 130);
      ctx.restore();
    }

    // Por último, por cima de tudo: o letreiro do boss derrubado.
    Jogo.desenhar67(ctx);
  },

  desenharFundo(ctx) {
    if (Jogo.dimensao === 'intersticio') { Jogo.desenharIntersticio(ctx); return; }
    if (Jogo.dimensao === 'nadir') { Jogo.desenharNadir(ctx); return; }
    // gradiente de base
    const g = ctx.createLinearGradient(0, 0, 0, Jogo.ALTURA);
    g.addColorStop(0, '#0a0d18');
    g.addColorStop(0.6, '#0c1020');
    g.addColorStop(1, '#07080f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, Jogo.LARGURA, Jogo.ALTURA);

    // grade com deriva
    const passo = 64;
    const desl = (Jogo.tempo * 12) % passo;
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(120,190,255,.07)';
    ctx.beginPath();
    for (let x = -passo + desl; x < Jogo.LARGURA + passo; x += passo) {
      ctx.moveTo(x, 0); ctx.lineTo(x, Jogo.ALTURA);
    }
    for (let y = -passo + desl; y < Jogo.ALTURA + passo; y += passo) {
      ctx.moveTo(0, y); ctx.lineTo(Jogo.LARGURA, y);
    }
    ctx.stroke();

    // brilho pulsante no centro na cor da onda
    const corOnda = Jogo.boss ? Jogo.boss.def.cor : (Jogo.jogador ? Jogo.jogador.classe.cor : '#31e0ff');
    const pulso = 0.05 + Math.sin(Jogo.tempo * 1.5) * 0.02;
    const rg = ctx.createRadialGradient(Jogo.LARGURA / 2, Jogo.ALTURA / 2, 20, Jogo.LARGURA / 2, Jogo.ALTURA / 2, Jogo.LARGURA * 0.6);
    rg.addColorStop(0, Jogo.corComAlpha(corOnda, pulso));
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, Jogo.LARGURA, Jogo.ALTURA);

    // moldura da arena
    ctx.save();
    ctx.strokeStyle = Jogo.corComAlpha(corOnda, 0.55);
    ctx.shadowBlur = Jogo.modoLeve ? 0 : 26; ctx.shadowColor = corOnda;
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, Jogo.LARGURA - 4, Jogo.ALTURA - 4);
    // cantos
    ctx.lineWidth = 6;
    const c = 46;
    const cantos = [[2, 2, 1, 1], [Jogo.LARGURA - 2, 2, -1, 1], [2, Jogo.ALTURA - 2, 1, -1], [Jogo.LARGURA - 2, Jogo.ALTURA - 2, -1, -1]];
    for (const [cx, cy, sx, sy] of cantos) {
      ctx.beginPath();
      ctx.moveTo(cx + c * sx, cy);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx, cy + c * sy);
      ctx.stroke();
    }
    ctx.restore();
  },

  /* A dimensão do ESPECTADOR. Nada de grade neon: aqui o chão é um olho. Anéis
     que nascem no centro e crescem, raios girando devagar, e uma moldura branca
     sem os cantos de mira — este lugar não é uma arena, é um lugar onde se
     assiste. Custa três gradientes e ~20 linhas por quadro. */
  /* ---------------------------- NÁDIR -------------------------------- */
  /* Fundo do Ato II. Não é a Arena com outra cor: a grade neon dá lugar a chão
     rachado, névoa violeta e duas luas partidas. Mesma regra do Interstício —
     nada de lista guardada, tudo sai de seno, porque fundo não aloca por
     quadro (ver HISTORIA.md, "Ato II"). */
  desenharNadir(ctx) {
    const t = Jogo.tempo;

    const g = ctx.createLinearGradient(0, 0, 0, Jogo.ALTURA);
    g.addColorStop(0, '#0a0318');
    g.addColorStop(0.55, '#12062a');
    g.addColorStop(1, '#05010d');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, Jogo.LARGURA, Jogo.ALTURA);

    // Duas luas partidas, paradas no céu do lugar.
    ctx.save();
    for (let i = 0; i < 2; i++) {
      const cx = i ? Jogo.LARGURA * 0.78 : Jogo.LARGURA * 0.19;
      const cy = i ? Jogo.ALTURA * 0.2 : Jogo.ALTURA * 0.13;
      const r = i ? 54 : 88;
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = '#d9a0ff';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Mat.TAU);
      ctx.fill();
      // A racha: um pedaço da lua está fora de lugar.
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = '#05010d';
      ctx.beginPath();
      ctx.moveTo(cx - r, cy + r * 0.1);
      ctx.lineTo(cx + r, cy - r * 0.25);
      ctx.lineTo(cx + r, cy + r);
      ctx.lineTo(cx - r, cy + r);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Chão fragmentado: placas irregulares em vez da grade quadrada da Arena.
    ctx.save();
    ctx.strokeStyle = 'rgba(150,70,255,.13)';
    ctx.lineWidth = 1;
    const passo = 150;
    ctx.beginPath();
    for (let x = 0; x <= Jogo.LARGURA; x += passo) {
      for (let y = 0; y <= Jogo.ALTURA; y += passo) {
        const d = Math.sin((x + y) * 0.013) * 26;
        ctx.moveTo(x + d, y);
        ctx.lineTo(x + passo * 0.62 + d, y + passo * 0.38);
        ctx.lineTo(x + passo, y + d * 0.4);
      }
    }
    ctx.stroke();
    ctx.restore();

    // Névoa: três faixas largas passando devagar, sem piscar.
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const y = ((t * 7 + i * 340) % (Jogo.ALTURA + 300)) - 150;
      const faixa = ctx.createLinearGradient(0, y - 90, 0, y + 90);
      faixa.addColorStop(0, 'rgba(120,40,200,0)');
      faixa.addColorStop(0.5, 'rgba(120,40,200,.07)');
      faixa.addColorStop(1, 'rgba(120,40,200,0)');
      ctx.fillStyle = faixa;
      ctx.fillRect(0, y - 90, Jogo.LARGURA, 180);
    }
    ctx.restore();

    /* Brasa: pontos subindo devagar, como cinza de algo que queimou antes de
       a gente chegar. Vem de seno, como o resto do fundo — nada guardado,
       nada alocado por quadro. Sai no modo leve. */
    if (!Jogo.modoLeve) {
      ctx.save();
      ctx.fillStyle = '#ff6cc4';
      for (let i = 0; i < 18; i++) {
        const base = ((Math.sin(i * 57.31) * 1000) % 1 + 1) % 1;
        const x = base * Jogo.LARGURA + Math.sin(t * 0.4 + i) * 14;
        const y = Jogo.ALTURA - ((t * 26 + i * 137) % (Jogo.ALTURA + 120));
        ctx.globalAlpha = 0.22 * (y / Jogo.ALTURA);
        ctx.beginPath();
        ctx.arc(x, y, 1.6, 0, Mat.TAU);
        ctx.fill();
      }
      ctx.restore();
    }

    // Moldura: violeta, e não o ciano da Arena — o lugar não é o mesmo.
    ctx.save();
    ctx.strokeStyle = 'rgba(170,80,255,.34)';
    ctx.shadowBlur = Jogo.modoLeve ? 0 : 24;
    ctx.shadowColor = '#a850ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, Jogo.LARGURA - 4, Jogo.ALTURA - 4);
    ctx.restore();
  },

  /* ------------------- O INTERSTÍCIO VIOLETA ------------------------- */
  /* Fundo do encontro com O ESPECTADOR, e a primeira coisa que o jogador vê
     quando a Arena racha. Não é claro nem branco: preto-violeta sem horizonte,
     ruínas suspensas, estrelas mortas e linhas magenta que parecem nervos.
     Nada pisca rápido aqui — tudo se move devagar, como se o lugar respirasse
     (ver HISTORIA.md, "Interlúdio"). */
  desenharIntersticio(ctx) {
    const t = Jogo.tempo;
    const cx = Jogo.LARGURA / 2, cy = Jogo.ALTURA / 2;

    ctx.fillStyle = '#05020c';
    ctx.fillRect(0, 0, Jogo.LARGURA, Jogo.ALTURA);

    // O que respira no centro é ele: clarão violeta, lento, quase parado.
    const respiro = 0.13 + Math.sin(t * 0.55) * 0.04;
    const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, Jogo.LARGURA * 0.66);
    g.addColorStop(0, 'rgba(150, 60, 255,' + respiro.toFixed(3) + ')');
    g.addColorStop(0.45, 'rgba(90, 20, 150,.06)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, Jogo.LARGURA, Jogo.ALTURA);

    // Estrelas mortas: não brilham, só estão lá. Posição vem de seno para
    // não precisar guardar lista nenhuma — fundo não aloca por quadro.
    ctx.save();
    ctx.fillStyle = 'rgba(200,170,255,.30)';
    for (let i = 0; i < 46; i++) {
      const x = ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1 * Jogo.LARGURA;
      const y = ((Math.sin(i * 78.233) * 43758.5453) % 1 + 1) % 1 * Jogo.ALTURA;
      const r = 0.8 + ((i % 5) * 0.22);
      ctx.globalAlpha = 0.18 + Math.sin(t * 0.3 + i) * 0.06;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Mat.TAU);
      ctx.fill();
    }
    ctx.restore();

    // Anéis nascendo do centro, magenta queimado e muito devagar.
    ctx.save();
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const p = ((t * 0.08) + i / 5) % 1;
      const raio = p * Jogo.LARGURA * 0.8;
      ctx.globalAlpha = (1 - p) * 0.16;
      ctx.strokeStyle = '#c04dff';
      ctx.beginPath();
      ctx.arc(cx, cy, raio, 0, Mat.TAU);
      ctx.stroke();
    }
    ctx.restore();

    // Nervos: linhas magenta que saem do centro e tremem de leve, como se o
    // lugar fosse por dentro de alguma coisa. Porque é.
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t * 0.03);
    ctx.globalAlpha = 0.10;
    ctx.strokeStyle = '#ff2ea8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 9; i++) {
      const a = (Mat.TAU / 9) * i;
      const curva = Math.sin(t * 0.4 + i) * 0.18;
      ctx.moveTo(Math.cos(a) * 110, Math.sin(a) * 110);
      ctx.lineTo(Math.cos(a + curva) * Jogo.LARGURA, Math.sin(a + curva) * Jogo.LARGURA);
    }
    ctx.stroke();
    ctx.restore();

    // Ruínas suspensas: blocos escuros flutuando, sem brilho, só silhueta.
    ctx.save();
    for (let i = 0; i < 7; i++) {
      const fx = ((Math.sin(i * 33.7) * 1000) % 1 + 1) % 1 * Jogo.LARGURA;
      const fy = ((Math.sin(i * 91.3) * 1000) % 1 + 1) % 1 * Jogo.ALTURA;
      const l = 34 + (i % 4) * 22;
      const sobe = Math.sin(t * 0.22 + i) * 9;
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#0c0618';
      ctx.strokeStyle = 'rgba(180,90,255,.22)';
      ctx.lineWidth = 1.5;
      ctx.save();
      ctx.translate(fx, fy + sobe);
      ctx.rotate(Math.sin(t * 0.12 + i) * 0.25);
      ctx.fillRect(-l / 2, -l / 5, l, l / 2.5);
      ctx.strokeRect(-l / 2, -l / 5, l, l / 2.5);
      ctx.restore();
    }
    ctx.restore();

    // Moldura violeta: o lugar tem borda, e a borda não é saída.
    ctx.save();
    ctx.strokeStyle = 'rgba(170,80,255,.45)';
    ctx.shadowBlur = Jogo.modoLeve ? 0 : 30;
    ctx.shadowColor = '#a850ff';
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, Jogo.LARGURA - 4, Jogo.ALTURA - 4);
    ctx.restore();
  },

  desenharMira(ctx) {
    // no toque não existe cursor: a mira vai à frente do jogador
    const j = Jogo.jogador;
    const x = Input.modoToque ? j.x + Math.cos(j.angulo) * 150 : Input.mouseX;
    const y = Input.modoToque ? j.y + Math.sin(j.angulo) * 150 : Input.mouseY;
    const cor = Jogo.jogador.classe.cor;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Jogo.tempo * 1.2);
    ctx.strokeStyle = cor;
    ctx.shadowBlur = 14; ctx.shadowColor = cor;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = (Mat.TAU / 4) * i + Math.PI / 4;
      ctx.moveTo(Math.cos(a) * 9, Math.sin(a) * 9);
      ctx.lineTo(Math.cos(a) * 17, Math.sin(a) * 17);
    }
    ctx.stroke();
    ctx.rotate(-Jogo.tempo * 1.2);
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Mat.TAU);
    ctx.fillStyle = cor;
    ctx.fill();
    ctx.restore();
  },

  corComAlpha(hex, alpha) {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }
};
