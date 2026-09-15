/* ===========================================================================
   JOGO.JS — estado global, loop, ondas, colisões, efeitos de tela, render.
   =========================================================================== */

const Jogo = {
  // Arena maior que a tela de origem, mas ainda inteira visível: o canvas é
  // desenhado em 1760x990 e o CSS encolhe para caber. Ninguém fica fora do
  // enquadramento e sobra espaço para fugir de boss.
  LARGURA: 1760,
  ALTURA: 990,
  TOTAL_ONDAS: Infinity,
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
  jogadorMaisProximo(x, y, ignorarPossuidos) {
    let alvo = null, distancia = Infinity;
    const local = Jogo.jogador;
    if (local && local.vida > 0 && (!ignorarPossuidos || !local.corpoPossuido)) {
      alvo = local;
      distancia = Mat.distanciaQ(x, y, local.x, local.y);
    }
    // Caminho quente: chamado por cada inimigo. Iterar o Map diretamente evita
    // criar dois arrays temporários por inimigo e por quadro durante possessão.
    for (const j of Jogo.outros.values()) {
      if (!j || j.vida <= 0 || ignorarPossuidos && j.corpoPossuido) continue;
      const d = Mat.distanciaQ(x, y, j.x, j.y);
      if (d < distancia) { alvo = j; distancia = d; }
    }
    return alvo;
  },
  alvoJogador(x, y) { return Jogo.jogadorMaisProximo(x, y, true); },
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

  flash: { alpha: 0, cor: '#fff' },
  avisoTexto: '',
  avisoTimer: 0,

  estat: { abates: 0, tiros: 0, danoFeito: 0, danoRecebido: 0, melhorMulti: 1, bosses: 0 },

  /* ------------------------------ Boot ------------------------------- */
  iniciar() {
    Jogo.canvas = document.getElementById('telaJogo');
    Jogo.ctx = Jogo.canvas.getContext('2d');
    Jogo.modoLeve = !!((window.matchMedia && matchMedia('(pointer: coarse)').matches) || navigator.maxTouchPoints > 0);
    Jogo.escalaRender = Jogo.modoLeve ? 0.75 : 1;
    Jogo.canvas.width = Math.round(Jogo.LARGURA * Jogo.escalaRender);
    Jogo.canvas.height = Math.round(Jogo.ALTURA * Jogo.escalaRender);
    if (Jogo.modoLeve) Particulas.limite = 400;

    Config.carregar();
    Recordes.carregar();
    Particulas.iniciar();
    Input.iniciar(Jogo.canvas);
    UI.iniciar();

    Jogo.ultimoQuadro = performance.now();
    requestAnimationFrame(Jogo.loop);
  },

  novoJogo(classeId, skinId) {
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
    Jogo.estado = 'jogando';
    Som.intensidade = 0;
    Jogo.prepararOnda();
    UI.el.classeNome.textContent = Jogo.jogador.classe.nome;
    document.documentElement.style.setProperty('--cor-classe', Jogo.jogador.skin.cor);
    UI._maxCoracoes = -1;
    UI.mostrarTela(null);
    UI.atualizarHUD();
  },

  /* ------------------------------ Ondas ------------------------------ */
  ehOndaDeBoss(onda) { return onda % 5 === 0; },

  multiplicadorVida() {
    const depoisDe40 = Math.max(0, Jogo.onda - 40);
    return 1 + Math.min(Jogo.onda - 1, 39) * 0.085 + Math.pow(depoisDe40, 0.82) * 0.032;
  },

  // Inimigo também fica mais rápido e atira mais miúdo conforme a onda sobe:
  // a mesma jogada que salvava na onda 5 não salva na 30.
  aceleracaoOnda() { return 1 + Math.min(0.48, Math.log2(1 + (Jogo.onda - 1) / 10) * 0.12); },
  ritmoInimigo() { return Math.max(0.52, 1 - Math.log2(1 + (Jogo.onda - 1) / 12) * 0.11); },

  // Chance de um inimigo nascer elite. Começa na onda 8 e satura em 30%.
  sorteiaElite() {
    if (Jogo.onda < 10) return false;
    return Mat.chance(Math.min(0.42, (Jogo.onda - 9) * 0.009));
  },

  prepararOnda() {
    Jogo.ondaLimpa = false;
    Jogo.intervaloOnda = 1.8;
    // fôlego no início da onda: ninguém morre no primeiro segundo
    if (Jogo.jogador) Jogo.jogador.invulneravel = Math.max(Jogo.jogador.invulneravel, 1.2);
    Jogo.composicao = [];
    Jogo.timerSpawn = 0.8;

    if (Jogo.ehOndaDeBoss(Jogo.onda)) {
      Jogo.spawnRestante = 0;
      Som.intensidade = 1;
      Jogo.aviso('⚠ ONDA ' + Jogo.onda + ' — BOSS');
    } else {
      // Menos inimigos na tela do que antes, e cada um valendo mais: a onda
      // deixou de ser enxurrada e virou briga. O orçamento cresce devagar.
      const orcamento = Math.round(4 + Math.min(Jogo.onda, 20) * 1.65
        + Math.min(35, Math.max(0, Jogo.onda - 20) * 0.7)
        + Math.log2(1 + Math.max(0, Jogo.onda - 70)) * 3);
      const disponiveis = Object.keys(TIPOS_INIMIGO).filter((k) => TIPOS_INIMIGO[k].desde <= Jogo.onda);
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
      const novo = Object.keys(TIPOS_INIMIGO).find((k) => TIPOS_INIMIGO[k].desde === Jogo.onda);
      Jogo.aviso(novo ? 'ONDA ' + Jogo.onda + ' — ' + TIPOS_INIMIGO[novo].nome : 'ONDA ' + Jogo.onda);
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

  spawnarBoss() {
    const encontro = Math.floor(Jogo.onda / 5) - 1;
    const indice = encontro % BOSSES.length;
    const def = BOSSES[indice];
    Jogo.boss = new Boss(def, Jogo.onda);
    Jogo.flashTela(0.5, def.cor);
    Camera.bater(20);
    Som.bossEntra();
    const ciclo = Math.floor(encontro / BOSSES.length) + 1;
    Jogo.aviso(def.nome + (ciclo > 1 ? ' · ASCENSÃO ' + ciclo : ''));
    UI.mostrarBarraBoss(Jogo.boss);
  },

  bossDerrotado() {
    Jogo.estat.bosses++;
    Jogo.pontos += 1500 * Jogo.onda;
    UI.esconderBarraBoss();
    // chuva de recompensa
    for (let i = 0; i < 26; i++) {
      Jogo.coletaveis.push(new Coletavel('xp', Jogo.boss.x + Mat.aleatorio(-70, 70), Jogo.boss.y + Mat.aleatorio(-70, 70), 12));
    }
    Jogo.coletaveis.push(new Coletavel('vida', Jogo.boss.x, Jogo.boss.y + 40));
    Jogo.boss = null;
    Jogo.filaDeMelhorias += 1;
    Jogo.terminarOnda();
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
    // Item raro ficou mais raro, e cura é o mais difícil de cair: vida perdida
    // tem que doer até o fim da partida.
    if (Mat.chance(e.elite ? 0.1 : 0.035)) {
      const sorteio = Mat.chance(0.25) ? 'vida' : Mat.escolher(['bomba', 'ima', 'frenesi']);
      Jogo.coletaveis.push(new Coletavel(sorteio, e.x, e.y));
    }
    if (j.classe.curaPorMorte) j.curar(j.attr.vidaMax * j.classe.curaPorMorte);
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

  aplicarRaio(x, y, angulo, dano) {
    // dano em tudo que estiver na linha do raio
    const dx = Math.cos(angulo), dy = Math.sin(angulo);
    const alvos = Jogo.inimigos.slice();
    if (Jogo.boss && Jogo.boss.vivo) alvos.push(Jogo.boss);
    for (const e of alvos) {
      const t = (e.x - x) * dx + (e.y - y) * dy;
      if (t < 0) continue;
      const px = x + dx * t, py = y + dy * t;
      if (Mat.distancia(px, py, e.x, e.y) < e.raio + 22) {
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

  aplicarRaioBoss(x, y, angulo, cor) {
    const dx = Math.cos(angulo), dy = Math.sin(angulo);
    for (const j of Jogo.jogadores()) {
      if (j.corpoPossuido) continue;
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

  atualizar(dtReal) {
    // hitstop e slow-motion
    let escala = 1;
    if (Jogo.hitstop > 0) { Jogo.hitstop -= dtReal; escala = 0.02; }
    else if (Jogo.lentidao > 0) { Jogo.lentidao -= dtReal; escala = 0.28; }

    const dt = dtReal * escala;
    Jogo.tempo += dt;
    Jogo.tempoJogo += dtReal;
    Jogo.imaGlobal = Math.max(0, Jogo.imaGlobal - dtReal);
    Jogo.avisoTimer = Math.max(0, Jogo.avisoTimer - dtReal);

    // pausa
    if (Input.apertou('KeyP') || Input.apertou('Escape')) { Jogo.pausar(); return; }

    // fila de melhorias tem prioridade
    if (Jogo.filaDeMelhorias > 0) { Jogo.abrirMelhoria(); return; }

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

    // spawn / ritmo da onda
    if (Jogo.intervaloOnda > 0) {
      Jogo.intervaloOnda -= dtReal;
      if (Jogo.intervaloOnda <= 0 && Jogo.ondaLimpa) {
        Jogo.onda++;
        Jogo.prepararOnda();
      } else if (Jogo.intervaloOnda <= 0 && Jogo.ehOndaDeBoss(Jogo.onda) && !Jogo.boss) {
        Jogo.spawnarBoss();
      }
    } else if (!Jogo.ondaLimpa) {
      if (Jogo.spawnRestante > 0) {
        Jogo.timerSpawn -= dtReal;
        const ritmo = Math.max(0.2, 0.95 - Jogo.onda * 0.026);
        // teto alto de novo: a arena cresceu e o perfil de custo aguenta
        // sobe devagar no começo e fecha alto no fim: onda 5 tem 9, onda 30 tem 30
        const tetoSimultaneo = Math.min(Jogo.modoLeve ? 20 : 30, Math.round(5 + Jogo.onda * 0.85));
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
      e.atualizar(dt);
      if (!e.vivo) Jogo.inimigos.splice(i, 1);
    }
    if (Jogo.boss) {
      Jogo.boss.atualizar(dt);
    }

    // projéteis + colisões
    for (let i = Jogo.projeteis.length - 1; i >= 0; i--) {
      const b = Jogo.projeteis[i];
      b.atualizar(dt);
      if (!b.vivo) { Jogo.projeteis.splice(i, 1); continue; }

      if (b.dono === 'jogador') {
        let acabou = false;
        for (const e of Jogo.inimigos) {
          if (!e.vivo || b.atingidos.indexOf(e) >= 0) continue;
          if (Mat.distancia(b.x, b.y, e.x, e.y) < b.raio + e.raio) {
            // couraça bloqueia tiro que vem de frente
            if (e.def.escudoFrontal) {
              const angDoTiro = Mat.anguloEntre(e.x, e.y, b.x, b.y);
              const angJog = Mat.anguloEntre(e.x, e.y, Jogo.jogador.x, Jogo.jogador.y);
              if (Math.abs(Mat.normalizarAngulo(angDoTiro - angJog)) < 0.9) {
                Particulas.faisca(b.x, b.y, b.angulo + Math.PI, '#dfe9f5');
                Som.acerto();
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
        if (j.corpoPossuido) continue;
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
        Jogo.ondasChoque.push({ x: s.x, y: s.y, raio: 10, raioMax: 380, dano: s.dano, cor: s.cor, atingidos: new Set(), empurrao: 700 });
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
    Jogo.intervaloHUD -= dtReal;
    if (Jogo.intervaloHUD <= 0) {
      UI.atualizarHUD();
      if (Jogo.boss) UI.atualizarBarraBoss(Jogo.boss);
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
    if (Jogo.estado === 'gameover') return;
    Jogo.estado = 'gameover';
    Som.gameOver();
    Camera.bater(30);
    Jogo.flashTela(0.8, '#ff2b4d');
    if (Jogo.jogador) Particulas.explosao(Jogo.jogador.x, Jogo.jogador.y, Jogo.jogador.classe.cor, 60, 620, 1.2, 6);
    Jogo.registrarPartida(false);
    UI.mostrarFinal(false);
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
  },

  desenharFundo(ctx) {
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
