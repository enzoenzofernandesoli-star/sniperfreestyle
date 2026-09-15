/* ===========================================================================
   COOP.JS — cooperativo online de 2 a 4 pessoas na mesma arena.

   Modelo: o ANFITRIÃO é a autoridade. Ele roda a simulação inteira no próprio
   navegador (ondas, inimigos, bosses, colisões, dano, drops) e manda snapshots
   ao servidor de salas, que só encaminha. O CONVIDADO não simula combate: ele
   manda comandos (movimento, mira, tiro, habilidades) e desenha o que recebe.

   Como o snapshot chega a 20 por segundo e a tela roda a 60, o convidado faz
   duas coisas para não ficar aos trancos:
     1. avança os alvos por conta própria entre snapshots (dead reckoning);
     2. puxa cada entidade suavemente até o alvo (interpolação).
   A própria nave do convidado ainda é prevista localmente com o input dele,
   para o movimento responder na hora, e depois corrigida na direção do que o
   anfitrião disse. Tiro, dano e progressão continuam decididos pelo anfitrião.
   =========================================================================== */

const Coop = {
  TAXA_ESTADO: 50,        // ms entre snapshots do anfitrião (20 por segundo)
  TAXA_CONTROLE: 33,      // ms entre comandos do convidado (30 por segundo)
  MAX_JOGADORES: 4,

  papel: null,            // 'anfitriao' | 'convidado' | null
  intencao: null,         // o que o menu pediu antes de escolher a classe
  fase: 'fora',           // 'fora' | 'sala' (painel aberto) | 'partida'
  codigo: '',
  minhaClasse: '',
  minhaSkin: '',
  partidaComecou: false,
  listaSala: [],
  id: '',
  classe: '',
  skin: '',
  conexao: null,
  equipe: new Map(),      // id -> { nome, classe, skin } — só para HUD

  controlesRemotos: new Map(),
  ultimoEstado: 0,
  ultimoControle: 0,
  recebidoEm: 0,
  intervaloPacote: 0.05,
  pulsosPendentes: {},

  // controle neutro: usado quando um convidado ainda não mandou nada
  controleParado: {
    mira: { x: 0, y: 0, ativo: false }, modoToque: false, mouseX: 0, mouseY: 0,
    botaoDireito: false, pulsos: {}, eixoX: () => 0, eixoY: () => 0,
    atirando: () => false, apertou: () => false
  },

  ativo() { return Coop.papel !== null; },
  anfitriao() { return Coop.papel === 'anfitriao'; },
  convidado() { return Coop.papel === 'convidado'; },

  /* ------------------------------ Avisos ----------------------------- */
  status(texto) {
    Coop.ultimoStatus = texto;
    for (const id of ['salaStatus', 'salaHud', 'salaStatusTela']) {
      const el = document.getElementById(id);
      if (el) el.textContent = texto;
    }
  },
  statusSala() {
    if (Coop.anfitriao()) {
      const total = 1 + Jogo.outros.size;
      Coop.status('SALA ' + Coop.codigo + ' · ' + total + '/' + Coop.MAX_JOGADORES + ' na arena');
    } else if (Coop.convidado()) {
      Coop.status('SALA ' + Coop.codigo + ' · conectado');
    }
  },

  /* ---------------------------- Transporte --------------------------- */
  // O site publicado na Vercel nao hospeda WebSocket: quem quiser jogar fora da
  // rede local aponta aqui para o endereco onde roda o `npm run salas`.
  servidorSalvo() {
    try { return localStorage.getItem('sniper.coopServidor') || ''; } catch { return ''; }
  },
  guardarServidor(valor) {
    try {
      if (valor) localStorage.setItem('sniper.coopServidor', valor);
      else localStorage.removeItem('sniper.coopServidor');
    } catch { /* navegador sem storage: vale so nesta sessao */ }
  },
  endereco() {
    const escolhido = Coop.servidorSalvo();
    if (escolhido) return escolhido;
    if (window.COOP_URL) return window.COOP_URL;
    return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/sala';
  },
  // Codigo sugerido para o anfitriao editar antes de abrir a sala. Sem I, O, 0
  // e 1, que viram engano quando alguem dita o convite em voz alta.
  codigoSugerido() {
    const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let valor = '';
    for (let i = 0; i < 6; i++) valor += letras[Math.floor(Math.random() * letras.length)];
    return valor;
  },
  conectar(aoAbrir) {
    if (Coop.conexao) { Coop.conexao.onclose = null; Coop.conexao.close(); }
    let socket;
    try { socket = new WebSocket(Coop.endereco()); }
    catch { Coop.status('Servidor de salas indisponível.'); Coop.papel = null; return; }
    Coop.conexao = socket;
    socket.onopen = aoAbrir;
    socket.onmessage = (evento) => {
      let dados;
      try { dados = JSON.parse(evento.data); } catch { return; }
      Coop.receber(dados);
    };
    socket.onerror = () => Coop.status('Não foi possível conectar ao servidor de salas.');
    socket.onclose = () => {
      if (Coop.conexao !== socket) return;
      Coop.conexao = null;
      const era = Coop.papel;
      Coop.encerrar(era === 'convidado'
        ? 'Conexão perdida. Você voltou ao menu.'
        : 'Sala encerrada — os convidados foram desconectados.');
    };
  },
  enviar(dados) {
    if (Coop.conexao && Coop.conexao.readyState === WebSocket.OPEN) Coop.conexao.send(JSON.stringify(dados));
  },
  encerrar(mensagem) {
    const era = Coop.papel;
    Coop.papel = null;
    Coop.intencao = null;
    Coop.fase = 'fora';
    Coop.partidaComecou = false;
    Coop.listaSala = [];
    Coop.equipe.clear();
    Coop.controlesRemotos.clear();
    Jogo.outros.clear();
    if (Coop.conexao) { const c = Coop.conexao; Coop.conexao = null; c.onclose = null; c.close(); }
    if (era === 'convidado' && Jogo.estado !== 'menu') {
      Jogo.estado = 'menu';
      UI.mostrarTela('menu');
    }
    UI.montarEquipe();
    if (mensagem) Coop.status(mensagem);
  },
  sair() { Coop.encerrar('Você saiu da sala.'); },

  /* ------------------------------ Entrada ---------------------------- */
  // O anfitriao abre a sala ANTES de escolher classe: o codigo aparece na hora
  // e ele ja tem o que mandar para os amigos enquanto decide com quem jogar.
  abrir(codigo) {
    if (Coop.papel) return;
    Coop.papel = 'anfitriao';
    Coop.codigo = codigo || '';
    Coop.partidaComecou = false;
    Coop.equipe.clear();
    Coop.equipe.set('anfitriao', { nome: Perfil.exibir(), classe: Coop.minhaClasse, skin: Coop.minhaSkin });
    Coop.status('Abrindo a sala...');
    Coop.conectar(() => Coop.enviar({ tipo: 'criar', codigo: Coop.codigo }));
  },
  entrar(codigo) {
    if (Coop.papel) return;
    Coop.papel = 'convidado';
    Coop.codigo = codigo;
    Coop.partidaComecou = false;
    Coop.status('Entrando na sala...');
    Coop.conectar(() => Coop.enviar({ tipo: 'entrar', codigo: Coop.codigo, nome: Perfil.exibir() }));
  },

  // Classe escolhida dentro da sala: o convidado avisa o anfitriao, o anfitriao
  // guarda para si. Ninguem entra na arena so por escolher.
  escolherClasse(classe, skin) {
    Coop.minhaClasse = classe;
    Coop.minhaSkin = skin;
    if (Coop.anfitriao()) {
      Coop.equipe.set('anfitriao', { nome: Perfil.exibir(), classe, skin });
      Coop.publicarLista();
    } else if (Coop.convidado()) {
      Coop.enviar({ tipo: 'pronto', classe, skin, nome: Perfil.exibir() });
    }
    UI.montarSala();
  },

  // Largada: o anfitriao monta a partida, cria a nave de quem ja escolheu
  // classe e so entao avisa a sala.
  comecar() {
    if (!Coop.anfitriao() || Coop.partidaComecou) return;
    if (!Coop.minhaClasse) { Coop.status('Escolha sua classe antes de comecar.'); return; }
    Coop.partidaComecou = true;
    Jogo.novoJogo(Coop.minhaClasse, Coop.minhaSkin);
    Jogo.jogador.nome = Perfil.exibir().slice(0, 12).toUpperCase();
    for (const [id, membro] of Coop.equipe) {
      if (id === 'anfitriao' || !membro.classe) continue;
      Coop.criarNave(id, membro);
    }
    Coop.fase = 'partida';
    Jogo.estado = 'jogando';
    UI.mostrarTela(null);
    Coop.enviar({ tipo: 'comecou' });
    Coop.statusSala();
    UI.montarEquipe();
    Coop.enviarEstado(performance.now(), true);
  },

  // Lista da sala: o anfitriao e a fonte, o convidado so recebe e desenha.
  publicarLista() {
    if (!Coop.anfitriao()) return;
    const lista = [];
    for (const [id, m] of Coop.equipe) {
      lista.push({ id, nome: (m.nome || 'COLEGA').toUpperCase(), classe: m.classe || '', anfitriao: id === 'anfitriao' });
    }
    Coop.listaSala = lista;
    Coop.enviar({ tipo: 'lobby', lista });
    UI.montarSala();
  },

  /* ----------------------------- Mensagens --------------------------- */
  receber(dados) {
    switch (dados.tipo) {
      case 'criada':
        Coop.codigo = dados.codigo;
        Coop.fase = 'sala';
        Coop.status('Sala aberta. Passe o codigo para quem for jogar com voce.');
        Coop.publicarLista();
        UI.montarSala();
        break;

      case 'entrou':
        if (Coop.anfitriao()) {
          Coop.equipe.set(dados.id, { nome: String(dados.nome || 'COLEGA').toUpperCase(), classe: '', skin: '' });
          if (Coop.partidaComecou) Jogo.aviso(String(dados.nome || 'COLEGA').toUpperCase() + ' ENTROU NA SALA');
          Coop.publicarLista();
          Coop.statusSala();
        } else {
          Coop.id = dados.id;
          Coop.codigo = dados.codigo || Coop.codigo;
          Coop.fase = 'sala';
          Coop.status('Na sala ' + Coop.codigo + '. Escolha sua classe e espere o anfitriao comecar.');
          UI.montarSala();
          if (Coop.minhaClasse) Coop.enviar({ tipo: 'pronto', classe: Coop.minhaClasse, skin: Coop.minhaSkin, nome: Perfil.exibir() });
        }
        break;

      case 'pronto':
        if (Coop.anfitriao()) Coop.registrarPronto(dados);
        break;

      case 'lobby':
        if (Coop.convidado()) { Coop.listaSala = Array.isArray(dados.lista) ? dados.lista : []; UI.montarSala(); }
        break;

      case 'comecou':
        if (Coop.convidado() && !Coop.partidaComecou && Coop.minhaClasse) Coop.entrarNaArena();
        break;

      case 'controle':
        if (Coop.anfitriao() && Jogo.outros.has(dados.id)) {
          Coop.controlesRemotos.set(dados.id, Coop.validarControle(dados.controle));
        }
        break;

      case 'estado':
        if (Coop.convidado()) Coop.aplicarEstado(dados.estado);
        break;

      case 'saiu':
        if (!Coop.anfitriao()) break;
        Jogo.outros.delete(dados.id);
        Coop.controlesRemotos.delete(dados.id);
        Coop.equipe.delete(dados.id);
        Coop.statusSala();
        UI.montarEquipe();
        Coop.publicarLista();
        if (Coop.partidaComecou) Jogo.aviso('UM COLEGA SAIU DA SALA');
        break;

      case 'erro':
        Coop.encerrar(dados.mensagem || 'Não foi possível entrar na sala.');
        break;

      case 'encerrada':
        Coop.encerrar('O anfitrião encerrou a sala.');
        break;

      case 'ping':
        Coop.enviar({ tipo: 'pong' });
        break;
    }
  },

  // Convidado avisou a classe: se a partida ja rola, entra na hora; se a sala
  // ainda esta no painel, fica guardado ate o anfitriao dar a largada.
  registrarPronto(dados) {
    const atual = Coop.equipe.get(dados.id) || {};
    const membro = { nome: String(dados.nome || atual.nome || 'COLEGA').toUpperCase(), classe: dados.classe, skin: dados.skin };
    Coop.equipe.set(dados.id, membro);
    if (Coop.partidaComecou && !Jogo.outros.has(dados.id)) {
      Coop.criarNave(dados.id, membro);
      Coop.enviar({ tipo: 'comecou' });
      Coop.enviarEstado(performance.now(), true);
    }
    Coop.publicarLista();
    Coop.statusSala();
  },

  criarNave(id, dados) {
    if (Jogo.outros.size + 1 >= Coop.MAX_JOGADORES) return;
    const classe = CLASSES.some((c) => c.id === dados.classe) ? dados.classe : 'sniper';
    const novo = new Jogador(classe, dados.skin);
    const base = Jogo.jogador || { x: Jogo.LARGURA / 2, y: Jogo.ALTURA / 2 };
    const volta = (Jogo.outros.size + 1) * (Mat.TAU / Coop.MAX_JOGADORES);
    novo.x = Mat.limitar(base.x + Math.cos(volta) * 90, 30, Jogo.LARGURA - 30);
    novo.y = Mat.limitar(base.y + Math.sin(volta) * 90, 30, Jogo.ALTURA - 30);
    novo.invulneravel = 3;
    novo.nome = String(dados.nome || 'COLEGA').slice(0, 12).toUpperCase();
    Jogo.outros.set(id, novo);
    Coop.equipe.set(id, { nome: novo.nome, classe, skin: novo.skin.id });
    Coop.statusSala();
    UI.montarEquipe();
    Jogo.aviso(novo.nome + ' ENTROU NA ARENA');
  },

  entrarNaArena() {
    Coop.partidaComecou = true;
    Coop.fase = 'partida';
    Jogo.novoJogo(Coop.minhaClasse, Coop.minhaSkin);
    Jogo.jogador.nome = Perfil.exibir().slice(0, 12).toUpperCase();
    Jogo.inimigos.length = 0;
    Jogo.estado = 'jogando';
    UI.mostrarTela(null);
    Coop.statusSala();
    UI.montarEquipe();
  },

  /* ----------------------- Comandos do convidado --------------------- */
  validarControle(bruto) {
    const c = bruto && typeof bruto === 'object' ? bruto : {};
    const eixo = (v) => Mat.limitar(Number(v) || 0, -1, 1);
    const coord = (v, max) => Mat.limitar(Number(v) || 0, -max, max * 2);
    const pulsos = { Space: c.dash === true, KeyQ: c.escudo === true, KeyE: c.ult === true };
    return {
      mira: { x: eixo(c.miraX), y: eixo(c.miraY), ativo: c.miraAtiva === true },
      modoToque: c.toque === true,
      mouseX: coord(c.mouseX, Jogo.LARGURA), mouseY: coord(c.mouseY, Jogo.ALTURA),
      botaoDireito: false, pulsos,
      eixoX: () => eixo(c.x), eixoY: () => eixo(c.y),
      atirando: () => c.tiro === true,
      apertou(codigo) { return !!this.pulsos[codigo]; }
    };
  },

  enviarControle() {
    if (!Coop.convidado() || Jogo.estado !== 'jogando') return;
    // pulsos só acontecem em um quadro: acumula até caber no próximo envio
    if (Input.apertou('Space')) Coop.pulsosPendentes.dash = true;
    if (Input.apertou('KeyQ') || Input.apertou('CapsLock')) Coop.pulsosPendentes.escudo = true;
    if (Input.apertou('KeyE') || Input.apertou('ShiftLeft') || Input.botaoDireito) Coop.pulsosPendentes.ult = true;

    const agora = performance.now();
    if (agora - Coop.ultimoControle < Coop.TAXA_CONTROLE) return;
    Coop.ultimoControle = agora;
    Coop.enviar({ tipo: 'controle', controle: {
      x: Input.eixoX(), y: Input.eixoY(),
      miraX: Input.mira.x, miraY: Input.mira.y, miraAtiva: Input.mira.ativo,
      toque: Input.modoToque, mouseX: Math.round(Input.mouseX), mouseY: Math.round(Input.mouseY),
      tiro: Input.atirando(),
      dash: !!Coop.pulsosPendentes.dash,
      escudo: !!Coop.pulsosPendentes.escudo,
      ult: !!Coop.pulsosPendentes.ult
    } });
    Coop.pulsosPendentes = {};
  },

  /* ------------------- Snapshot: empacotar (anfitrião) ---------------- */
  // Nada de mandar o objeto cru: `def`, `classe`, `skin` e os rastros são
  // tabelas e enfeites que o convidado já tem ou refaz sozinho.
  numero(v) { return Math.round(v * 10) / 10; },

  empacotarJogador(id, j) {
    return {
      id, classeId: j.classe.id, skinId: j.skin.id, nome: j.nome || '',
      x: Coop.numero(j.x), y: Coop.numero(j.y), vx: Coop.numero(j.vx), vy: Coop.numero(j.vy),
      a: Coop.numero(j.angulo), vida: Coop.numero(j.vida), nivel: j.nivel,
      xp: Math.round(j.xp), xpProximo: j.xpProximo, attr: j.attr,
      escudoRestante: Coop.numero(j.escudoRestante), escudoCarga: Coop.numero(j.escudoCarga),
      dashCarga: Coop.numero(j.dashCarga), dashRestante: Coop.numero(j.dashRestante),
      ultCarga: Coop.numero(j.ultCarga), ultAtiva: Coop.numero(j.ultAtiva),
      invulneravel: Coop.numero(j.invulneravel), frenesi: Coop.numero(j.frenesi),
      recuo: Coop.numero(j.recuo), melhorias: j.melhorias,
      orbes: j.orbes.map((o) => ({ angulo: Coop.numero(o.angulo), distancia: o.distancia, raio: o.raio, cooldown: 0 }))
    };
  },
  empacotarInimigo(e) {
    return {
      id: e.id, tipo: e.tipo, x: Coop.numero(e.x), y: Coop.numero(e.y),
      vx: Coop.numero(e.vx), vy: Coop.numero(e.vy), a: Coop.numero(e.angulo),
      vida: Coop.numero(e.vida), vidaMax: Coop.numero(e.vidaMax), raio: e.raio,
      escala: e.escala, flash: Coop.numero(e.flash), nascendo: Coop.numero(e.nascendo),
      estado: e.estado, fase: Coop.numero(e.fase), vivo: e.vivo
    };
  },
  empacotarProjetil(b) {
    return {
      id: b.id, x: Coop.numero(b.x), y: Coop.numero(b.y), a: Coop.numero(b.angulo),
      velocidade: b.velocidade, raio: b.raio, cor: b.cor, dono: b.dono,
      critico: b.critico, giro: Coop.numero(b.giro)
    };
  },
  empacotarColetavel(c) {
    return { id: c.id, tipo: c.tipo, x: Coop.numero(c.x), y: Coop.numero(c.y),
      vx: Coop.numero(c.vx), vy: Coop.numero(c.vy), valor: c.valor, fase: Coop.numero(c.fase) };
  },
  empacotarBoss(b) {
    return {
      id: b.id, defId: b.def.id, faseIndice: b.faseIndice,
      x: Coop.numero(b.x), y: Coop.numero(b.y), a: Coop.numero(b.angulo),
      vida: Coop.numero(b.vida), vidaMax: Coop.numero(b.vidaMax), raio: b.raio,
      flash: Coop.numero(b.flash), entrando: Coop.numero(b.entrando),
      telegrafo: Coop.numero(b.telegrafo), enraivecido: b.enraivecido,
      laser: b.laser, tempoVivo: Coop.numero(b.tempoVivo)
    };
  },

  enviarEstado(agora, forcar) {
    if (!Coop.anfitriao()) return;
    if (!forcar && agora - Coop.ultimoEstado < Coop.TAXA_ESTADO) return;
    Coop.ultimoEstado = agora;
    const estado = {
      t: Math.round(agora),
      onda: Jogo.onda, pontos: Math.round(Jogo.pontos), tempo: Coop.numero(Jogo.tempo),
      tempoJogo: Coop.numero(Jogo.tempoJogo), estat: Jogo.estat,
      multiplicador: Jogo.multiplicador, imaGlobal: Coop.numero(Jogo.imaGlobal),
      modo: Jogo.estado,
      aviso: Jogo.avisoTimer > 0 ? Jogo.avisoTexto : '', avisoTimer: Coop.numero(Jogo.avisoTimer),
      jogadores: [Coop.empacotarJogador('anfitriao', Jogo.jogador),
        ...Array.from(Jogo.outros, ([id, j]) => Coop.empacotarJogador(id, j))],
      inimigos: Jogo.inimigos.map(Coop.empacotarInimigo),
      projeteis: Jogo.projeteis.map(Coop.empacotarProjetil),
      coletaveis: Jogo.coletaveis.map(Coop.empacotarColetavel),
      boss: Jogo.boss ? Coop.empacotarBoss(Jogo.boss) : null,
      ondasChoque: Jogo.ondasChoque.map((o) => ({ x: o.x, y: o.y, raio: Coop.numero(o.raio), raioMax: o.raioMax, cor: o.cor })),
      singularidades: Jogo.singularidades.map((s) => ({ x: s.x, y: s.y, raio: s.raio, vida: Coop.numero(s.vida), vidaMax: s.vidaMax, cor: s.cor })),
      raios: Jogo.raios.map((r) => ({ x: r.x, y: r.y, angulo: r.angulo, vida: Coop.numero(r.vida), vidaMax: r.vidaMax, largura: r.largura, cor: r.cor }))
    };
    Coop.enviar({ tipo: 'estado', estado });
  },

  /* ------------------- Snapshot: aplicar (convidado) ------------------ */
  recriar(tipo, dados) {
    const e = Object.create(tipo.prototype);
    Object.assign(e, dados);
    return e;
  },
  marcarAlvo(e, d) {
    e.alvoX = d.x; e.alvoY = d.y;
    if (d.a !== undefined) e.alvoA = d.a;
  },

  // reaproveita a entidade que já existe (mesmo id) para a interpolação ter
  // continuidade; some quem o anfitrião não mandou mais.
  reconciliar(atuais, lista, criar, absorver) {
    const porId = new Map();
    for (const e of atuais) porId.set(e.id, e);
    const saida = [];
    for (const d of lista) {
      let e = porId.get(d.id);
      if (!e) { e = criar(d); e.x = d.x; e.y = d.y; }
      absorver(e, d);
      Coop.marcarAlvo(e, d);
      saida.push(e);
    }
    return saida;
  },

  aplicarEstado(estado) {
    if (!estado || !Array.isArray(estado.jogadores)) return;
    const agora = performance.now();
    if (Coop.recebidoEm) Coop.intervaloPacote = Mat.limitar((agora - Coop.recebidoEm) / 1000, 0.02, 0.5);
    Coop.recebidoEm = agora;

    // --- jogadores
    const anteriores = new Map(Jogo.outros);
    if (Jogo.jogador) anteriores.set(Coop.id, Jogo.jogador);
    let eu = null;
    const outros = new Map();
    for (const d of estado.jogadores) {
      let j = anteriores.get(d.id);
      if (!j) { j = new Jogador(d.classeId, d.skinId); j.x = d.x; j.y = d.y; }
      Coop.absorverJogador(j, d);
      Coop.marcarAlvo(j, d);
      if (d.id === Coop.id) eu = j; else outros.set(d.id, j);
    }
    if (eu) Jogo.jogador = eu;          // sem "eu" no pacote, mantém o anterior
    Jogo.outros = outros;

    // --- entidades
    Jogo.inimigos = Coop.reconciliar(Jogo.inimigos, estado.inimigos || [],
      (d) => {
        const e = Coop.recriar(Inimigo, { rastro: [] });
        e.def = TIPOS_INIMIGO[d.tipo] || TIPOS_INIMIGO.corredor;
        return e;
      },
      (e, d) => Coop.absorverSimples(e, d));
    Jogo.projeteis = Coop.reconciliar(Jogo.projeteis, estado.projeteis || [],
      () => Coop.recriar(Projetil, { rastro: [], atingidos: [], vivo: true, perfuracao: 0, ricochete: 0, homing: 0, percorrido: 0, alcance: 0, dano: 0 }),
      (b, d) => Coop.absorverSimples(b, d));
    Jogo.coletaveis = Coop.reconciliar(Jogo.coletaveis, estado.coletaveis || [],
      (d) => {
        const c = Coop.recriar(Coletavel, { vivo: true });
        c.def = TIPOS_COLETAVEL[d.tipo] || TIPOS_COLETAVEL.xp;
        return c;
      },
      (c, d) => Coop.absorverSimples(c, d));

    if (!estado.boss) Jogo.boss = null;
    else {
      if (!Jogo.boss || Jogo.boss.id !== estado.boss.id) {
        Jogo.boss = Coop.recriar(Boss, { vivo: true, direcao: 1, anguloEspiral: 0 });
        Jogo.boss.x = estado.boss.x; Jogo.boss.y = estado.boss.y;
      }
      const def = BOSSES.find((b) => b.id === estado.boss.defId) || BOSSES[0];
      Jogo.boss.def = def;
      Jogo.boss.fase = def.fases[Mat.limitar(estado.boss.faseIndice, 0, def.fases.length - 1)];
      Coop.absorverSimples(Jogo.boss, estado.boss);
      Coop.marcarAlvo(Jogo.boss, estado.boss);
    }

    // --- efeitos e placar (sem interpolação: são enfeites de vida curta)
    Jogo.ondasChoque = estado.ondasChoque || [];
    Jogo.singularidades = estado.singularidades || [];
    Jogo.raios = estado.raios || [];
    Jogo.onda = estado.onda;
    Jogo.pontos = estado.pontos;
    Jogo.tempo = estado.tempo;
    Jogo.tempoJogo = estado.tempoJogo;
    Jogo.estat = estado.estat || Jogo.estat;
    Jogo.multiplicador = estado.multiplicador || 1;
    Jogo.imaGlobal = estado.imaGlobal || 0;
    // o anúncio de onda/boss é do anfitrião: sem isso o convidado ficava com
    // o cartaz da ONDA 1 preso na tela pelo resto da partida.
    Jogo.avisoTexto = estado.aviso || '';
    Jogo.avisoTimer = estado.avisoTimer || 0;

    const antes = Jogo.estado;
    // 'melhoria' e 'pausado' do anfitrião viram espera aqui: o convidado não
    // escolhe carta nem pausa a partida dos outros.
    Jogo.estado = estado.modo === 'melhoria' || estado.modo === 'pausado' ? 'jogando' : estado.modo;
    Coop.esperando = estado.modo === 'melhoria' || estado.modo === 'pausado';
    if ((estado.modo === 'gameover' || estado.modo === 'vitoria') && antes !== estado.modo) {
      UI.mostrarFinal(estado.modo === 'vitoria');
    }
    UI.atualizarHUD();
    UI.montarEquipe();
  },

  absorverJogador(j, d) {
    j.nome = d.nome || j.nome;
    j.vx = d.vx; j.vy = d.vy;
    j.vida = d.vida; j.nivel = d.nivel; j.xp = d.xp; j.xpProximo = d.xpProximo;
    j.attr = d.attr; j.melhorias = d.melhorias || {};
    j.escudoRestante = d.escudoRestante; j.escudoCarga = d.escudoCarga;
    j.dashCarga = d.dashCarga; j.dashRestante = d.dashRestante;
    j.ultCarga = d.ultCarga; j.ultAtiva = d.ultAtiva;
    j.invulneravel = d.invulneravel; j.frenesi = d.frenesi; j.recuo = d.recuo;
    j.orbes = d.orbes || [];
    if (!j.rastro) j.rastro = [];
  },
  absorverSimples(e, d) {
    for (const chave in d) {
      if (chave === 'x' || chave === 'y' || chave === 'a' || chave === 'tipo' || chave === 'defId') continue;
      e[chave] = d[chave];
    }
    if (d.tipo !== undefined) e.tipo = d.tipo;
    if (e.angulo === undefined) e.angulo = d.a || 0;
    if (!e.rastro) e.rastro = [];
  },

  /* ------------- Entre snapshots: previsão e interpolação ------------- */
  cadaEntidade(fn) {
    if (Jogo.jogador) fn(Jogo.jogador, 'jogador');
    for (const j of Jogo.outros.values()) fn(j, 'jogador');
    for (const e of Jogo.inimigos) fn(e, 'inimigo');
    for (const b of Jogo.projeteis) fn(b, 'projetil');
    for (const c of Jogo.coletaveis) fn(c, 'coletavel');
    if (Jogo.boss) fn(Jogo.boss, 'boss');
  },

  // 1) empurra o ALVO pela velocidade conhecida, para ele não ficar parado
  //    esperando o próximo pacote.
  avancarAlvos(dt) {
    Coop.cadaEntidade((e, tipo) => {
      if (e.alvoX === undefined) return;
      if (tipo === 'projetil') {
        e.alvoX += Math.cos(e.angulo) * e.velocidade * dt;
        e.alvoY += Math.sin(e.angulo) * e.velocidade * dt;
      } else if (e.vx !== undefined) {
        e.alvoX += e.vx * dt;
        e.alvoY += e.vy * dt;
      }
      e.alvoX = Mat.limitar(e.alvoX, -200, Jogo.LARGURA + 200);
      e.alvoY = Mat.limitar(e.alvoY, -200, Jogo.ALTURA + 200);
    });
  },

  // 2) puxa a posição desenhada até o alvo. Salto grande (respawn, dash,
  //    teleporte de boss) corta direto para não virar deslize pela arena.
  suavizar(dt) {
    const eu = Jogo.jogador;
    Coop.cadaEntidade((e) => {
      if (e.alvoX === undefined) return;
      const forca = e === eu ? 7 : 16;
      if (Mat.distancia(e.x, e.y, e.alvoX, e.alvoY) > 260) { e.x = e.alvoX; e.y = e.alvoY; }
      else {
        e.x = Mat.suave(e.x, e.alvoX, forca, dt);
        e.y = Mat.suave(e.y, e.alvoY, forca, dt);
      }
      if (e.alvoA !== undefined && e !== eu) {
        e.angulo = e.angulo + Mat.normalizarAngulo(e.alvoA - e.angulo) * Math.min(1, 18 * dt);
      }
    });
    Coop.rastrear(dt);
  },

  // os rastros não viajam pela rede: o convidado refaz os dele localmente.
  rastrear(dt) {
    const guardar = (e, limite, vida) => {
      if (!e.rastro) e.rastro = [];
      e.rastro.push({ x: e.x, y: e.y, a: e.angulo, vida });
      if (e.rastro.length > limite) e.rastro.shift();
      for (let i = e.rastro.length - 1; i >= 0; i--) {
        e.rastro[i].vida -= dt;
        if (e.rastro[i].vida <= 0) e.rastro.splice(i, 1);
      }
    };
    if (Jogo.jogador) guardar(Jogo.jogador, 14, 0.22);
    for (const j of Jogo.outros.values()) guardar(j, 14, 0.22);
    for (const b of Jogo.projeteis) guardar(b, 6, 0.12);
  },

  // 3) a própria nave anda na hora com o input local; a correção acontece em
  //    suavizar(), puxando devagar para onde o anfitrião disse que ela está.
  preverLocal(dt) {
    const j = Jogo.jogador;
    if (!j || j.vida <= 0 || Coop.esperando) return;
    j.moverPrevisto(dt, Input);
  },

  entreQuadros(dt) {
    if (!Coop.convidado()) return;
    Jogo.avisoTimer = Math.max(0, Jogo.avisoTimer - dt);
    Coop.preverLocal(dt);
    Coop.avancarAlvos(dt);
    Coop.suavizar(dt);
  }
};
