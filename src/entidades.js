/* ===========================================================================
   ENTIDADES.JS — Jogador, Projétil, Inimigos, Bosses, Coletáveis.
   =========================================================================== */

// Só os projéteis disparados pelo jogador usam esta paleta, e quem a define é
// o item de tiro equipado na loja. Tiro de inimigo e de boss não passa por aqui.
const CORES_TIRO = {
  get jogador() { return Cosmeticos.tiro().jogador; },
  get critico() { return Cosmeticos.tiro().critico; }
};

/* =============================== JOGADOR ================================ */
class Jogador {
  // Teto duro de corações: nenhuma melhoria, cura ou classe passa disso.
  static VIDA_MAXIMA = 6;

  constructor(classeId, skinId) {
    this.classe = classePorId(classeId);
    this.skin = skinDaClasse(classeId, skinId);
    this.acessorio = Cosmeticos.acessorio();
    this.emoji = Cosmeticos.emoji();
    this.attr = Object.assign({}, this.classe.atributos);

    this.x = Jogo.LARGURA / 2;
    this.y = Jogo.ALTURA / 2;
    this.vx = 0; this.vy = 0;
    this.raio = 16;
    this.angulo = 0;
    this.vida = this.attr.vidaMax;

    // temporizadores
    this.recargaTiro = 0;
    this.dashRestante = 0;
    this.dashCarga = this.attr.dashRecarga;      // já começa com dash e escudo prontos
    this.escudoRestante = 0;
    this.escudoCarga = this.attr.escudoRecarga;
    this.ultCarga = this.attr.ultRecarga * 0.5;
    this.ultAtiva = 0;
    this.invulneravel = 0;
    this.frenesi = 0;

    // progressão
    this.nivel = 1;
    this.xp = 0;
    this.xpProximo = 60;
    this.melhorias = {};
    this.multXP = 1;
    this.vampirismo = 0;
    this.espinhos = 0;

    this.orbes = [];
    this.attr.vidaMax = Math.min(Jogador.VIDA_MAXIMA, this.attr.vidaMax);
    this.vida = Math.min(this.vida, this.attr.vidaMax);
    this.sincronizarOrbes();
    this.lacaios = [];
    this.sincronizarLacaios();
    this.rastro = [];
    this.recuo = 0;
    this.nome = '';            // apelido mostrado no cooperativo
  }

  sincronizarOrbes() {
    this.orbes = [];
    for (let i = 0; i < this.attr.orbes; i++) {
      this.orbes.push({ angulo: (Mat.TAU / Math.max(1, this.attr.orbes)) * i, distancia: 62, raio: 11, cooldown: 0 });
    }
  }

  get escudoAtivo() { return this.escudoRestante > 0; }
  // Drones do INVOCADOR: seguem em órbita larga, procuram alvo sozinhos e
  // atiram com uma fração do dano do dono. Não têm vida — o preço deles é o
  // tiro pessoal fraco da classe, não um bichinho para babysittar.
  sincronizarLacaios() {
    const quantos = this.attr.lacaios || 0;
    const fixos = this.lacaios ? this.lacaios.filter((l) => !l.temporario) : [];
    while (fixos.length > quantos) fixos.pop();
    while (fixos.length < quantos) fixos.push(this.novoLacaio(fixos.length, quantos));
    const temporarios = this.lacaios ? this.lacaios.filter((l) => l.temporario) : [];
    this.lacaios = fixos.concat(temporarios);
    this.reposicionarLacaios();
  }

  novoLacaio(indice, total, tempo) {
    return {
      angulo: (Mat.TAU / Math.max(1, total)) * indice,
      x: this.x, y: this.y, recarga: Mat.aleatorio(0, 0.5),
      temporario: tempo !== undefined, restante: tempo || 0, mira: 0
    };
  }

  reposicionarLacaios() {
    const total = Math.max(1, this.lacaios.length);
    this.lacaios.forEach((l, i) => { l.angulo = (Mat.TAU / total) * i; });
  }

  atualizarLacaios(dt) {
    if (!this.lacaios.length) return;
    const orbita = 78;
    for (let i = this.lacaios.length - 1; i >= 0; i--) {
      const l = this.lacaios[i];
      if (l.temporario) {
        l.restante -= dt;
        if (l.restante <= 0) { this.lacaios.splice(i, 1); this.reposicionarLacaios(); continue; }
      }
      l.angulo += dt * 1.1;
      const alvoX = this.x + Math.cos(l.angulo) * orbita;
      const alvoY = this.y + Math.sin(l.angulo) * orbita;
      l.x = Mat.suave(l.x, alvoX, 7, dt);
      l.y = Mat.suave(l.y, alvoY, 7, dt);

      l.recarga -= dt;
      if (l.recarga > 0) continue;
      const alvo = Jogo.inimigoMaisProximo(l.x, l.y, 760) || (Jogo.boss && Jogo.boss.vivo ? Jogo.boss : null);
      if (!alvo) continue;
      l.mira = Mat.anguloEntre(l.x, l.y, alvo.x, alvo.y);
      l.recarga = this.attr.cadencia * (this.ultAtiva > 0 ? 0.8 : 1.05);
      // A bala do drone é um tiro seu saindo de outro lugar: mesmo dano, mesmo
      // crítico, mesma perfuração, ricochete e alcance. Toda melhoria que vale
      // para o seu tiro vale para o dele — e ele conta na estatística de tiros.
      const a = this.attr;
      const crit = Mat.chance(a.critChance);
      Jogo.projeteis.push(new Projetil({
        x: l.x, y: l.y, angulo: l.mira,
        velocidade: a.balaVel * Mat.aleatorio(0.95, 1.05),
        raio: a.balaRaio,
        dano: a.dano * (crit ? a.critMult : 1),
        critico: crit,
        dono: 'jogador',
        cor: crit ? CORES_TIRO.critico : CORES_TIRO.jogador,
        perfuracao: a.perfuracao,
        ricochete: a.ricochete,
        homing: Math.max(a.homing, 0.6),
        alcance: this.classe.alcanceCurto || 0
      }));
      Jogo.estat.tiros++;
      Particulas.faisca(l.x, l.y, l.mira, this.skin.cor);
      Som.tiro(this.classe.somTiro);
    }
  }

  get intangivel() { return this.invulneravel > 0 || this.dashRestante > 0 || this.ultAtiva > 0 && this.classe.id === 'espectro'; }

  /* --------------------------- Atualização --------------------------- */
  atualizar(dt, controles = Input) {
    // mira: joystick de mira > mira automática (toque) > mouse
    const forcaMira = Math.hypot(controles.mira.x, controles.mira.y);
    let alvo;
    if (controles.mira.ativo && forcaMira > 0.22) {
      alvo = Math.atan2(controles.mira.y, controles.mira.x);
    } else if (controles.modoToque) {
      const inimigo = Jogo.inimigoMaisProximo(this.x, this.y, 1400);
      alvo = inimigo ? Mat.anguloEntre(this.x, this.y, inimigo.x, inimigo.y) : this.angulo;
    } else {
      alvo = Mat.anguloEntre(this.x, this.y, controles.mouseX, controles.mouseY);
    }
    this.angulo = this.angulo + Mat.normalizarAngulo(alvo - this.angulo) * Math.min(1, 18 * dt);

    // movimento
    const ex = controles.eixoX(), ey = controles.eixoY();
    const mag = Math.hypot(ex, ey) || 1;
    // A CARNIFICINA também dá pernas: sem isso o ESPECTRO não alcança ninguém
    // durante os cinco segundos em que o corte vale cinco vezes o tiro.
    const corrida = (this.ultAtiva > 0 && this.classe.id === 'espectro') ? 1.4 : 1;
    const velocidadeAtual = this.attr.velocidade * corrida;
    const alvoVX = (ex / mag) * velocidadeAtual * (Math.hypot(ex, ey) > 0 ? 1 : 0);
    const alvoVY = (ey / mag) * velocidadeAtual * (Math.hypot(ex, ey) > 0 ? 1 : 0);

    if (this.dashRestante > 0) {
      this.dashRestante -= dt;
      this.x += this.dashVX * dt;
      this.y += this.dashVY * dt;
      if (Mat.chance(0.45)) {
        Particulas.emitir({
          x: this.x, y: this.y, vx: Mat.aleatorio(-40, 40), vy: Mat.aleatorio(-40, 40),
          vida: 0.3, tam: 7, cor: this.classe.cor, brilho: 16, atrito: 0.85
        });
      }
      if (this.classe.dashCorta) this.cortarNoDash();
    } else {
      this.vx = Mat.suave(this.vx, alvoVX, 12, dt);
      this.vy = Mat.suave(this.vy, alvoVY, 12, dt);
      this.x += this.vx * dt;
      this.y += this.vy * dt;
    }

    const m = this.raio + 4;
    this.x = Mat.limitar(this.x, m, Jogo.LARGURA - m);
    this.y = Mat.limitar(this.y, m, Jogo.ALTURA - m);

    this.rastro.push({ x: this.x, y: this.y, a: this.angulo, vida: 0.22 });
    if (this.rastro.length > 14) this.rastro.shift();
    for (let i = this.rastro.length - 1; i >= 0; i--) {
      this.rastro[i].vida -= dt;
      if (this.rastro[i].vida <= 0) this.rastro.splice(i, 1);
    }

    // temporizadores
    this.recargaTiro -= dt;
    this.dashCarga = Math.min(this.attr.dashRecarga, this.dashCarga + dt);
    this.escudoCarga = Math.min(this.attr.escudoRecarga, this.escudoCarga + dt);
    this.ultCarga = Math.min(this.attr.ultRecarga, this.ultCarga + dt);
    this.invulneravel = Math.max(0, this.invulneravel - dt);
    this.frenesi = Math.max(0, this.frenesi - dt);
    this.recuo = Mat.suave(this.recuo, 0, 14, dt);
    if (this.escudoRestante > 0) {
      this.escudoRestante -= dt;
      if (this.escudoRestante <= 0) this.escudoCarga = 0;
    }
    if (this.ultAtiva > 0) {
      this.ultAtiva -= dt;
      this.tickUlt(dt);
      // Fim da CARNIFICINA: tudo que foi cortado volta de uma vez, num estouro
      // do tamanho da carnificina que o jogador fez.
      if (this.ultAtiva <= 0 && this.classe.id === 'espectro') this.estourarCarnificina();
    }

    // regeneração
    if (this.attr.regen > 0 && this.vida < this.attr.vidaMax) {
      this.vida = Math.min(this.attr.vidaMax, this.vida + this.attr.regen * dt);
    }

    this.atualizarLacaios(dt);

    // orbes orbitais
    for (const o of this.orbes) {
      o.angulo += 2.4 * dt;
      o.cooldown = Math.max(0, o.cooldown - dt);
      const ox = this.x + Math.cos(o.angulo) * o.distancia;
      const oy = this.y + Math.sin(o.angulo) * o.distancia;
      o.x = ox; o.y = oy;
      if (o.cooldown <= 0) {
        for (const e of Jogo.inimigos) {
          if (Mat.distancia(ox, oy, e.x, e.y) < o.raio + e.raio) {
            Jogo.danificarInimigo(e, this.attr.dano * 0.7, false, ox, oy);
            o.cooldown = 0.35;
            break;
          }
        }
      }
      if (Mat.chance(0.2)) {
        Particulas.emitir({ x: ox, y: oy, vida: 0.25, tam: 3, cor: this.classe.cor, brilho: 12, atrito: 0.9 });
      }
    }

    // ações
    if (controles.atirando() && this.recargaTiro <= 0) this.atirar();
    if (controles.apertou('Space')) this.dash(controles);
    if (controles.apertou('KeyQ') || controles.apertou('CapsLock')) this.ativarEscudo();
    // E e SHIFT fazem a mesma coisa: a ultimate. O E ficou livre quando a
    // possessão saiu, e quem já tinha o dedo nele não perde a mão.
    if (controles.apertou('KeyE') || controles.apertou('ShiftLeft') || controles.botaoDireito) this.ativarUlt();
  }

  /* ------------------- Previsão local (cooperativo) ------------------ */
  /* O convidado só prevê mira e deslocamento entre um snapshot e outro, para a
     nave responder na hora. Tiro, dash, dano e progressão continuam decididos
     pelo anfitrião — nada disso é simulado aqui. */
  moverPrevisto(dt, controles) {
    const forcaMira = Math.hypot(controles.mira.x, controles.mira.y);
    let alvo;
    if (controles.mira.ativo && forcaMira > 0.22) {
      alvo = Math.atan2(controles.mira.y, controles.mira.x);
    } else if (controles.modoToque) {
      const inimigo = Jogo.inimigoMaisProximo(this.x, this.y, 1400);
      alvo = inimigo ? Mat.anguloEntre(this.x, this.y, inimigo.x, inimigo.y) : this.angulo;
    } else {
      alvo = Mat.anguloEntre(this.x, this.y, controles.mouseX, controles.mouseY);
    }
    this.angulo = this.angulo + Mat.normalizarAngulo(alvo - this.angulo) * Math.min(1, 18 * dt);
    if (this.dashRestante > 0) return;

    const ex = controles.eixoX(), ey = controles.eixoY();
    const mag = Math.hypot(ex, ey);
    const velocidade = this.attr.velocidade;
    this.vx = Mat.suave(this.vx, mag > 0 ? (ex / mag) * velocidade : 0, 12, dt);
    this.vy = Mat.suave(this.vy, mag > 0 ? (ey / mag) * velocidade : 0, 12, dt);
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    const m = this.raio + 4;
    this.x = Mat.limitar(this.x, m, Jogo.LARGURA - m);
    this.y = Mat.limitar(this.y, m, Jogo.ALTURA - m);
    if (this.alvoX !== undefined) {
      this.alvoX = Mat.limitar(this.alvoX, m, Jogo.LARGURA - m);
      this.alvoY = Mat.limitar(this.alvoY, m, Jogo.ALTURA - m);
    }
  }

  /* ------------------------------ Tiro ------------------------------- */
  atirar() {
    const a = this.attr;
    this.recargaTiro = a.cadencia * (this.frenesi > 0 ? 0.45 : 1);
    const n = a.projeteis;
    const abertura = a.espalhamento;
    for (let i = 0; i < n; i++) {
      const desvio = n === 1 ? 0 : Mat.misturar(-abertura / 2, abertura / 2, i / (n - 1)) + Mat.aleatorio(-0.02, 0.02);
      const ang = this.angulo + desvio;
      const crit = Mat.chance(a.critChance);
      Jogo.projeteis.push(new Projetil({
        x: this.x + Math.cos(ang) * (this.raio + 10),
        y: this.y + Math.sin(ang) * (this.raio + 10),
        angulo: ang,
        velocidade: a.balaVel * Mat.aleatorio(0.95, 1.05),
        raio: a.balaRaio,
        dano: a.dano * (crit ? a.critMult : 1),
        critico: crit,
        dono: 'jogador',
        cor: crit ? CORES_TIRO.critico : CORES_TIRO.jogador,
        perfuracao: a.perfuracao,
        ricochete: a.ricochete,
        homing: a.homing,
        alcance: this.classe.alcanceCurto || 0
      }));
    }
    // recuo, fumaça e som
    Jogo.estat.tiros += n;
    this.recuo = 6;
    this.vx -= Math.cos(this.angulo) * 40;
    this.vy -= Math.sin(this.angulo) * 40;
    Particulas.faisca(this.x + Math.cos(this.angulo) * (this.raio + 12), this.y + Math.sin(this.angulo) * (this.raio + 12), this.angulo, this.classe.cor);
    Camera.bater(1.2);
    Som.tiro(this.classe.somTiro);
  }

  /* ------------------------------ Dash ------------------------------- */
  dash(controles = Input) {
    if (this.dashCarga < this.attr.dashRecarga) return;
    this.dashCarga = 0;
    this.dashRestante = 0.16;
    const ex = controles.eixoX(), ey = controles.eixoY();
    const ang = (ex || ey) ? Math.atan2(ey, ex) : this.angulo;
    const forca = 1450;
    this.dashVX = Math.cos(ang) * forca;
    this.dashVY = Math.sin(ang) * forca;
    this.vx = Math.cos(ang) * this.attr.velocidade;
    this.vy = Math.sin(ang) * this.attr.velocidade;
    this.invulneravel = Math.max(this.invulneravel, 0.28);
    Particulas.anel(this.x, this.y, this.classe.cor, 26, 16);
    Camera.bater(4);
    Som.dash();
  }

  // Ecos da CARNIFICINA: cópias do ESPECTRO que ficam para trás e continuam
  // cortando por conta própria. Cada passo do jogador deixa um, e o eco vale
  // metade do corte — atravessar a multidão em linha reta vira um corredor de
  // lâminas que continua matando depois que ele já passou.
  // O troco da CARNIFICINA: quanto mais gente caiu durante a ult, maior o
  // estouro que fecha a conta. Vazia, é um empurrão; cheia, limpa a tela.
  estourarCarnificina() {
    const abates = this.abatesNaUlt || 0;
    const raio = Mat.limitar(320 + abates * 32, 320, 820);
    Jogo.ondasChoque.push({
      x: this.x, y: this.y, raio: 10, raioMax: raio,
      dano: this.attr.dano * (3 + abates * 0.5), cor: this.classe.cor,
      atingidos: new Set(), empurrao: 1100, limpaTiros: true
    });
    Jogo.flashTela(0.5, this.classe.cor);
    Camera.bater(20 + Math.min(20, abates));
    Particulas.anel(this.x, this.y, this.classe.cor, raio * 0.35, 40);
    Som.ultimate();
    if (abates > 0) Textos.criar(this.x, this.y - 40, abates + ' CORTADOS', this.classe.cor, 26);
    this.abatesNaUlt = 0;
    this.ecos = [];
  }

  atualizarEcos(dt) {
    if (!this.ecos) this.ecos = [];
    this.tempoEco = (this.tempoEco || 0) - dt;
    // Teto de 8 ecos, um a cada 0,12 s: o corredor de lâminas continua, mas
    // deixa de virar oito fontes de dano em cima do mesmo ponto.
    if (this.tempoEco <= 0 && this.ecos.length < 8) {
      this.tempoEco = 0.12;
      this.ecos.push({ x: this.x, y: this.y, a: this.angulo, vida: 0.75, vidaMax: 0.75, golpe: 0 });
    }
    for (let i = this.ecos.length - 1; i >= 0; i--) {
      const eco = this.ecos[i];
      eco.vida -= dt;
      if (eco.vida <= 0) { this.ecos.splice(i, 1); continue; }
      eco.golpe -= dt;
      if (eco.golpe > 0) continue;
      eco.golpe = 0.4;
      for (const alvo of Jogo.inimigos) {
        if (Mat.distancia(eco.x, eco.y, alvo.x, alvo.y) < alvo.raio + 90) {
          Jogo.danificarInimigo(alvo, this.attr.dano * 1.2, false, eco.x, eco.y);
        }
      }
      // O eco NÃO fere boss, de propósito. Parado colado no boss, os oito ecos
      // somavam mais dano que o corte e a luta virava um botão só. Eco é arma
      // de multidão: atravessar o enxame continua valendo, encostar no boss e
      // esperar não.
    }
  }

  cortarNoDash() {
    // Durante a CARNIFICINA o corte tem alcance de foice, não de encostão, e
    // volta no mesmo alvo bem mais rápido que o tiro.
    //
    // Os números já foram 10x o tiro a cada 70 ms, o que dava mais de 7.000 de
    // dano por ult num alvo só — quarenta vezes a ultimate do SNIPER. Hoje é
    // 5x a cada 110 ms: continua sendo a ult mais forte do jogo, mas na mesma
    // ordem de grandeza das outras. Medido em ferramentas/medir-dano.js.
    const naUlt = this.ultAtiva > 0;
    const extra = naUlt ? 175 : 12;
    const forca = naUlt ? 5 : 2.4;
    const espera = naUlt ? 110 : 240;
    for (const e of Jogo.inimigos) {
      if (e._cortado) continue;
      if (Mat.distancia(this.x, this.y, e.x, e.y) < this.raio + e.raio + extra) {
        e._cortado = true;
        Jogo.danificarInimigo(e, this.attr.dano * forca, true, this.x, this.y);
        setTimeout(() => { e._cortado = false; }, espera);
      }
    }
    // O boss também sangra na foice, senão a ult seria inútil justo na luta que
    // mais importa.
    const b = Jogo.boss;
    if (naUlt && b && b.vivo && !b._cortado
      && Mat.distancia(this.x, this.y, b.x, b.y) < this.raio + b.raio + extra) {
      b._cortado = true;
      b.receberDano(this.attr.dano * forca, true, this.x, this.y);
      setTimeout(() => { if (Jogo.boss) Jogo.boss._cortado = false; }, espera);
    }
  }

  /* ----------------------------- Escudo ------------------------------ */
  ativarEscudo() {
    if (this.escudoAtivo || this.escudoCarga < this.attr.escudoRecarga) return;
    this.escudoRestante = this.attr.escudoDuracao;
    this.escudoCarga = 0;
    Particulas.anel(this.x, this.y, '#ffd34d', 40, 26);
    Som.escudo();
  }

  /* ---------------------------- Ultimate ----------------------------- */
  ativarUlt() {
    if (this.ultCarga < this.attr.ultRecarga) return;
    this.ultCarga = 0;
    Camera.bater(18);
    Camera.pulsar(1.06);
    Som.ultimate();
    Jogo.flashTela(0.5, this.classe.cor);

    Camera.bater(26);
    Camera.pulsar(1.1);

    if (this.classe.id === 'sniper') {
      // TRAÇANTE: feixe largo que varre a arena inteira e arrasta um rastro
      // de faíscas. A faixa de acerto acompanha a largura desenhada.
      const dano = this.attr.dano * 9;
      Jogo.raios.push({ x: this.x, y: this.y, angulo: this.angulo, vida: 0.6, vidaMax: 0.6, largura: 52, dano: dano, cor: this.classe.cor });
      Jogo.aplicarRaio(this.x, this.y, this.angulo, dano, 46);
      for (let i = 1; i <= 16; i++) {
        Particulas.emitir({
          x: this.x + Math.cos(this.angulo) * i * 110, y: this.y + Math.sin(this.angulo) * i * 110,
          vida: 0.35, tam: 7, cor: this.classe.cor, brilho: 20, atrito: 0.85
        });
      }
    } else if (this.classe.id === 'guardiao') {
      // IMPACTO: onda que cruza meia arena, empurra forte e apaga o tiro
      // inimigo que estiver no caminho.
      Jogo.ondasChoque.push({ x: this.x, y: this.y, raio: 10, raioMax: 820, dano: this.attr.dano * 5, cor: this.classe.cor, atingidos: new Set(), empurrao: 1300, limpaTiros: true });
    } else if (this.classe.id === 'espectro') {
      // CARNIFICINA: a jogada mais forte do jogo, e a mais arriscada de usar —
      // ela só rende se o jogador atravessar a arena colado nos inimigos.
      this.ultAtiva = 5;
      this.invulneravel = Math.max(this.invulneravel, 5);
      this.abatesNaUlt = 0;
      this.ecos = [];
      Jogo.ondasChoque.push({ x: this.x, y: this.y, raio: 10, raioMax: 620,
        dano: this.attr.dano * 3, cor: this.classe.cor, atingidos: new Set(),
        empurrao: 900, limpaTiros: true });
    } else if (this.classe.id === 'invocador') {
      // LEGIÃO: tropa maior, mais longa, e um estouro na chamada
      const total = this.lacaios.length + 5;
      for (let i = 0; i < 5; i++) this.lacaios.push(this.novoLacaio(this.lacaios.length, total, 14));
      this.ultAtiva = 14;   // enquanto dura, a tropa inteira atira mais rápido
      this.reposicionarLacaios();
      Jogo.ondasChoque.push({ x: this.x, y: this.y, raio: 10, raioMax: 520, dano: this.attr.dano * 3, cor: this.classe.cor, atingidos: new Set(), empurrao: 760 });
      Particulas.anel(this.x, this.y, this.classe.cor, 110, 30);
    } else {
      // SINGULARIDADE: buraco negro que pega quase metade da arena
      Jogo.singularidades.push({ x: this.x, y: this.y, vida: 2.8, vidaMax: 2.8, raio: 480, dano: this.attr.dano * 9, cor: this.classe.cor, explodiu: false });
    }
  }

  tickUlt(dt) {
    if (this.classe.id === 'espectro') {
      this.cortarNoDash();
      this.atualizarEcos(dt);
      if (Mat.chance(0.4)) {
        Particulas.emitir({ x: this.x + Mat.aleatorio(-18, 18), y: this.y + Mat.aleatorio(-18, 18), vida: 0.3, tam: 6, cor: '#ff4d6d', brilho: 18, atrito: 0.86 });
      }
    }
  }

  /* ------------------------------ Dano ------------------------------- */
  receberDano(quantidade, fonteX, fonteY) {
    if (this.escudoAtivo) {
      Particulas.anel(this.x, this.y, '#ffd34d', 30, 12);
      return false;
    }
    if (this.invulneravel > 0 || this.dashRestante > 0) return false;
    this.vida -= quantidade;
    this.invulneravel = 1.2;
    Camera.bater(14);
    Jogo.flashTela(0.55, '#ff2b4d');
    Jogo.pararTempo(0.09);
    Som.dano();
    Particulas.explosao(this.x, this.y, '#ff3355', 10, 300, 0.5, 4);
    if (fonteX !== undefined) {
      const a = Mat.anguloEntre(fonteX, fonteY, this.x, this.y);
      this.vx += Math.cos(a) * 320;
      this.vy += Math.sin(a) * 320;
    }
    if (this.vida <= 0 && Jogo.jogadores().length === 0) Jogo.derrota();
    return true;
  }

  curar(q) {
    const antes = this.vida;
    this.vida = Math.min(this.attr.vidaMax, this.vida + q);
    if (this.vida > antes) {
      Textos.criar(this.x, this.y - 30, '+' + (Math.round((this.vida - antes) * 10) / 10), '#5cff9d', 18);
    }
  }

  ganharXP(q) {
    this.xp += q * this.multXP;
    while (this.xp >= this.xpProximo) {
      this.xp -= this.xpProximo;
      this.nivel++;
      this.xpProximo = Math.round(60 * Math.pow(1.45, this.nivel - 1));
      if (this !== Jogo.jogador && Coop.papel === 'anfitriao') {
        const opcoes = sortearMelhorias(this, 3);
        if (opcoes.length) this.aplicarMelhoria(opcoes[0]);
      } else Jogo.filaDeMelhorias++;
    }
  }

  // A loja pode trocar a aparência com o jogo já rodando; isso relê a carteira
  // sem tocar em nada de atributo.
  recarregarVisual() {
    this.skin = skinDaClasse(this.classe.id, null);
    this.acessorio = Cosmeticos.acessorio();
    this.emoji = Cosmeticos.emoji();
  }

  aplicarMelhoria(m) {
    this.melhorias[m.id] = (this.melhorias[m.id] || 0) + 1;
    m.aplicar(this);
    Som.subirNivel();
    Particulas.anel(this.x, this.y, COR_RARIDADE[m.raridade], 50, 30);
  }

  /* ----------------------------- Desenho ----------------------------- */
  desenhar(ctx) {
    const tons = Cosmeticos.tons(this.skin);
    const cor = tons.cor;
    const cor2 = tons.cor2;
    // rastro
    for (const r of this.rastro) {
      const a = Mat.limitar(r.vida / 0.22, 0, 1) * 0.25;
      ctx.globalAlpha = a;
      ctx.fillStyle = cor;
      ctx.beginPath();
      ctx.arc(r.x, r.y, this.raio * 0.9, 0, Mat.TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // ecos da CARNIFICINA, desenhados atrás de tudo do jogador
    if (this.ecos && this.ecos.length) {
      for (const eco of this.ecos) {
        const p = Mat.limitar(eco.vida / eco.vidaMax, 0, 1);
        ctx.save();
        ctx.translate(eco.x - this.x, eco.y - this.y);
        ctx.rotate(eco.a);
        ctx.globalAlpha = p * 0.55;
        ctx.strokeStyle = cor;
        ctx.lineWidth = 2;
        ctx.shadowBlur = Jogo.modoLeve ? 0 : 18; ctx.shadowColor = cor;
        ctx.beginPath();
        ctx.moveTo(this.raio * 1.1, 0);
        ctx.lineTo(-this.raio * 0.8, this.raio * 0.8);
        ctx.lineTo(-this.raio * 0.4, 0);
        ctx.lineTo(-this.raio * 0.8, -this.raio * 0.8);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }
    }

    // drones
    for (const l of this.lacaios) {
      ctx.save();
      ctx.translate(l.x - this.x, l.y - this.y);
      ctx.rotate(l.mira);
      ctx.globalAlpha = l.temporario ? 0.75 : 1;
      ctx.fillStyle = cor2;
      ctx.strokeStyle = cor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(9, 0); ctx.lineTo(-6, 6); ctx.lineTo(-3, 0); ctx.lineTo(-6, -6);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }

    // orbes
    for (const o of this.orbes) {
      ctx.save();
      ctx.shadowBlur = 22; ctx.shadowColor = cor;
      ctx.fillStyle = cor;
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.raio, 0, Mat.TAU);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.raio * 0.4, 0, Mat.TAU);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angulo);

    const piscando = this.invulneravel > 0 && Math.floor(this.invulneravel * 16) % 2 === 0;
    ctx.globalAlpha = piscando ? 0.4 : 1;

    // arma: fica mesmo com emoji equipado, senão não se lê pra onde se mira
    ctx.shadowBlur = 18; ctx.shadowColor = cor;
    ctx.fillStyle = '#e9f6ff';
    ctx.fillRect(this.raio - 2 - this.recuo, -4, 22, 8);
    ctx.fillStyle = cor2;
    ctx.fillRect(this.raio + 12 - this.recuo, -6, 7, 12);

    // Com emoji equipado, o emoji É o jogador: a nave não é desenhada. Fica só
    // um disco na cor do casco por baixo, pra o emoji não flutuar no vazio e
    // pra a cor comprada continuar valendo alguma coisa.
    if (this.emoji) {
      ctx.rotate(-this.angulo);
      ctx.shadowBlur = Jogo.modoLeve ? 0 : 26; ctx.shadowColor = cor;
      const disco = ctx.createRadialGradient(0, 0, 2, 0, 0, this.raio * 1.12);
      disco.addColorStop(0, cor);
      disco.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = (piscando ? 0.4 : 1) * 0.5;
      ctx.fillStyle = disco;
      ctx.beginPath();
      ctx.arc(0, 0, this.raio * 1.12, 0, Mat.TAU);
      ctx.fill();
      ctx.globalAlpha = piscando ? 0.4 : 1;
      ctx.rotate(this.angulo);
    } else {
      // corpo: losango com núcleo
      ctx.beginPath();
      ctx.moveTo(this.raio + 4, 0);
      ctx.lineTo(-2, -this.raio);
      ctx.lineTo(-this.raio, 0);
      ctx.lineTo(-2, this.raio);
      ctx.closePath();
      const grad = ctx.createLinearGradient(-this.raio, 0, this.raio, 0);
      grad.addColorStop(0, cor2);
      grad.addColorStop(1, cor);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#f2fbff';
      ctx.stroke();

      // núcleo
      ctx.shadowBlur = 26;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Mat.TAU);
      ctx.fill();
    }

    // acessório da loja: acompanha a mira junto com o casco
    desenharAcessorio(ctx, this.acessorio, this.raio, cor, cor2, this.angulo);
    ctx.restore();

    // O emoji em si vai por cima e em pé — emoji de cabeça pra baixo não se lê.
    if (this.emoji) {
      ctx.save();
      ctx.font = Math.round(this.raio * 2.5) + 'px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = piscando ? 0.4 : 1;
      ctx.fillText(this.emoji, this.x, this.y + this.raio * 0.06);
      ctx.restore();
    }

    // escudo
    if (this.escudoAtivo) {
      const pulso = 1 + Math.sin(Jogo.tempo * 12) * 0.05;
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = '#ffd34d';
      ctx.shadowBlur = 26; ctx.shadowColor = '#ffd34d';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.raio * 2.1 * pulso, 0, Mat.TAU);
      ctx.stroke();
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = '#ffd34d';
      ctx.fill();
      ctx.restore();
    }

    // aura da ultimate do espectro
    if (this.ultAtiva > 0 && this.classe.id === 'espectro') {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = '#ff4d6d';
      ctx.lineWidth = 4;
      ctx.shadowBlur = 30; ctx.shadowColor = '#ff4d6d';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.raio * 2.6 + Math.sin(Jogo.tempo * 20) * 5, 0, Mat.TAU);
      ctx.stroke();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

}

/* ============================== PROJÉTIL ================================ */
class Projetil {
  constructor(cfg) {
    this.id = Jogo.proximoId();
    this.x = cfg.x; this.y = cfg.y;
    this.angulo = cfg.angulo;
    this.velocidade = cfg.velocidade;
    this.raio = cfg.raio || 5;
    this.dano = cfg.dano;
    this.dono = cfg.dono;
    this.cor = cfg.cor || '#fff';
    this.perfuracao = cfg.perfuracao || 0;
    this.ricochete = cfg.ricochete || 0;
    this.homing = cfg.homing || 0;
    this.perseguePor = cfg.perseguePor || 0;   // segundos que um tiro de boss persegue
    this.explodeEm = cfg.explodeEm || 0;       // mina: estoura sozinha nesse tempo
    this.estilhacos = cfg.estilhacos || 0;
    this.critico = !!cfg.critico;
    this.alcance = cfg.alcance || 0;
    this.percorrido = 0;
    this.vivo = true;
    this.atingidos = [];
    this.rastro = [];
    this.giro = 0;
  }

  atualizar(dt) {
    // mina do boss: fica parada, pisca e abre um anel quando o tempo acaba
    if (this.explodeEm > 0) {
      this.explodeEm -= dt;
      this.giro += dt * 6;
      if (this.explodeEm <= 0) {
        const n = this.estilhacos || 10;
        for (let i = 0; i < n; i++) {
          Jogo.tiroInimigo(this.x, this.y, (Mat.TAU / n) * i + Math.random() * 0.2, 300, this.dano, this.cor, 7);
        }
        Particulas.anel(this.x, this.y, this.cor, 60, 16);
        this.vivo = false;
      }
      return;
    }

    // tiro de boss que persegue por alguns segundos antes de seguir reto
    if (this.perseguePor > 0 && this.dono === 'inimigo') {
      this.perseguePor -= dt;
      const alvo = Jogo.alvoJogador(this.x, this.y);
      if (alvo) {
        const desejado = Mat.anguloEntre(this.x, this.y, alvo.x, alvo.y);
        this.angulo = Mat.girarPara(this.angulo, desejado, 1.8 * dt);
      }
    }

    // teleguiado
    if (this.homing > 0 && this.dono === 'jogador') {
      const alvo = Jogo.inimigoMaisProximo(this.x, this.y, 420);
      if (alvo) {
        const desejado = Mat.anguloEntre(this.x, this.y, alvo.x, alvo.y);
        this.angulo = Mat.girarPara(this.angulo, desejado, this.homing * 6 * dt);
      }
    }

    const dx = Math.cos(this.angulo) * this.velocidade * dt;
    const dy = Math.sin(this.angulo) * this.velocidade * dt;
    this.x += dx; this.y += dy;
    this.percorrido += Math.hypot(dx, dy);
    this.giro += dt * 14;

    this.rastro.push({ x: this.x, y: this.y });
    if (this.rastro.length > 6) this.rastro.shift();

    // paredes
    if (this.x < this.raio || this.x > Jogo.LARGURA - this.raio) {
      if (this.ricochete > 0) {
        this.ricochete--;
        this.angulo = Math.PI - this.angulo;
        this.x = Mat.limitar(this.x, this.raio, Jogo.LARGURA - this.raio);
        this.atingidos = [];
        Particulas.faisca(this.x, this.y, this.angulo, this.cor);
      } else this.vivo = false;
    }
    if (this.y < this.raio || this.y > Jogo.ALTURA - this.raio) {
      if (this.ricochete > 0) {
        this.ricochete--;
        this.angulo = -this.angulo;
        this.y = Mat.limitar(this.y, this.raio, Jogo.ALTURA - this.raio);
        this.atingidos = [];
        Particulas.faisca(this.x, this.y, this.angulo, this.cor);
      } else this.vivo = false;
    }

    if (this.alcance && this.percorrido > this.alcance) {
      this.vivo = false;
      Particulas.explosao(this.x, this.y, this.cor, 4, 70, 0.2, 2);
    }

    if (Mat.chance(Jogo.modoLeve ? 0.18 : 0.5)) {
      Particulas.emitir({ x: this.x, y: this.y, vida: 0.16, tam: this.raio * 0.7, cor: this.cor, brilho: 10, atrito: 0.9 });
    }
  }

  desenhar(ctx) {
    // rastro
    ctx.save();
    ctx.strokeStyle = this.cor;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = this.raio * 1.4;
    ctx.lineCap = 'round';
    if (this.rastro.length > 1) {
      ctx.beginPath();
      ctx.moveTo(this.rastro[0].x, this.rastro[0].y);
      for (const r of this.rastro) ctx.lineTo(r.x, r.y);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.shadowBlur = Jogo.modoLeve ? 0 : (this.critico ? 30 : 18);
    ctx.shadowColor = this.cor;
    ctx.fillStyle = this.cor;
    if (this.dono === 'inimigo') {
      ctx.translate(this.x, this.y);
      ctx.rotate(this.giro);
      ctx.beginPath();
      const lados = 4;
      for (let i = 0; i < lados; i++) {
        const a = (Mat.TAU / lados) * i;
        ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * this.raio * 1.3, Math.sin(a) * this.raio * 1.3);
      }
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.raio, 0, Mat.TAU);
      ctx.fill();
      ctx.fillStyle = this.critico ? CORES_TIRO.jogador : '#151c00';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.raio * 0.45, 0, Mat.TAU);
      ctx.fill();
    }
    ctx.restore();
  }
}

/* ============================== INIMIGOS ================================ */
const TIPOS_INIMIGO = {
  corredor: {
    nome: 'CORREDOR', cor: '#ff5470', cor2: '#7a0f27', raio: 17, vida: 30, velocidade: 150,
    dano: 1, xp: 8, pontos: 10, lados: 3, comportamento: 'perseguir', ato: 1, desde: 1
  },
  atirador: {
    nome: 'ATIRADOR', cor: '#c874ff', cor2: '#4b177a', raio: 19, vida: 54, velocidade: 115,
    dano: 1, xp: 16, pontos: 25, lados: 5, comportamento: 'atirar', ato: 1, desde: 2,
    distanciaIdeal: 320, recarga: 2.2, projetilVel: 360
  },
  bruto: {
    nome: 'BRUTO', cor: '#ff8c42', cor2: '#7a3a0f', raio: 30, vida: 140, velocidade: 74,
    dano: 2, xp: 22, pontos: 30, lados: 6, comportamento: 'perseguir', ato: 1, desde: 3, resiste: 0.65
  },
  kamikaze: {
    nome: 'KAMIKAZE', cor: '#ffe14d', cor2: '#7a6a0f', raio: 15, vida: 26, velocidade: 255,
    dano: 2, xp: 15, pontos: 22, lados: 4, comportamento: 'kamikaze', ato: 1, desde: 4, raioExplosao: 88
  },
  divisor: {
    nome: 'DIVISOR', cor: '#4dffc3', cor2: '#0f7a5c', raio: 24, vida: 82, velocidade: 105,
    dano: 1, xp: 19, pontos: 28, lados: 8, comportamento: 'perseguir', ato: 1, desde: 5, divideEm: 2
  },
  orbitador: {
    nome: 'ORBITADOR', cor: '#4da6ff', cor2: '#0f3d7a', raio: 20, vida: 72, velocidade: 175,
    dano: 1, xp: 21, pontos: 32, lados: 7, comportamento: 'orbitar', ato: 1, desde: 6,
    distanciaIdeal: 240, recarga: 1.8, projetilVel: 310
  },
  couraca: {
    nome: 'COURAÇA', cor: '#9aa7b5', cor2: '#3a4450', raio: 26, vida: 110, velocidade: 96,
    dano: 2, xp: 26, pontos: 40, lados: 4, comportamento: 'perseguir', ato: 1, desde: 7,
    escudoFrontal: true, escudoVida: 26
  },
  // Da onda 8 em diante cada onda ainda estreia um jeito novo de atacar: não é
  // só mais bicho na tela, é um problema diferente para resolver.
  lanceiro: {
    nome: 'LANCEIRO', cor: '#ff3d3d', cor2: '#6b0d0d', raio: 22, vida: 88, velocidade: 130,
    dano: 2, xp: 24, pontos: 38, lados: 3, comportamento: 'investir', ato: 1, desde: 8,
    alcanceInvestida: 460, forcaInvestida: 3.1
  },
  tecelao: {
    nome: 'TECELÃO', cor: '#ff9edb', cor2: '#6b1f52', raio: 21, vida: 78, velocidade: 88,
    dano: 1, xp: 25, pontos: 42, lados: 6, comportamento: 'espiral', ato: 1, desde: 9,
    distanciaIdeal: 400, recarga: 0.34, projetilVel: 240
  },
  fantasma: {
    nome: 'FANTASMA', cor: '#a0f0ff', cor2: '#164a58', raio: 18, vida: 60, velocidade: 165,
    dano: 1, xp: 26, pontos: 44, lados: 5, comportamento: 'piscar', ato: 1, desde: 10,
    recarga: 2.4
  },
  enxame: {
    nome: 'ENXAME', cor: '#c6ff4d', cor2: '#3d6b0f', raio: 13, vida: 34, velocidade: 235,
    dano: 1, xp: 12, pontos: 18, lados: 3, comportamento: 'zigue', ato: 1, desde: 11
  },
  torreta: {
    nome: 'TORRETA', cor: '#ffc14d', cor2: '#6b4a09', raio: 24, vida: 130, velocidade: 34,
    dano: 1, xp: 30, pontos: 50, lados: 8, comportamento: 'rajada', ato: 1, desde: 12,
    recarga: 2.8, projetilVel: 420, resiste: 0.5
  },

  /* --------------------------- ATO II — NÁDIR ---------------------------- */
  /* Nenhum inimigo do Ato I atravessa a fenda: a Arena ficou para trás e os
     bichos de lá com ela. É o que `ato` separa — a onda sorteia só entre os
     tipos do ato em que a campanha está.

     Cinco destes são **ruínas**: o que sobrou dos Condutores que cairam, com o
     jeito de lutar da classe preservado e o corpo apodrecido (`podre`). Quem
     jogou de SNIPER reconhece o tiro que está tomando. Os outros cinco são de
     NÁDIR mesmo, e não imitam ninguém.

     Vida base fica na faixa do Ato I de propósito: na onda 101 o
     `multiplicadorVida` já está perto de 5×, e é ele que faz o Ato II doer. */

  // A mira que não esqueceu: fica longe, atira pouco e acerta forte.
  ruinaSniper: {
    nome: 'RUÍNA DO SNIPER', cor: '#b06cff', cor2: '#2a0d4d', raio: 18, vida: 70, velocidade: 124,
    dano: 2, xp: 34, pontos: 60, lados: 5, comportamento: 'atirar', ato: 2, desde: 101, podre: true,
    distanciaIdeal: 500, recarga: 2.1, projetilVel: 560
  },
  // Andou com escudo tanto tempo que apodreceu segurando: lento e de frente.
  ruinaGuardiao: {
    nome: 'RUÍNA DO GUARDIÃO', cor: '#8f8aa8', cor2: '#2b2740', raio: 28, vida: 190, velocidade: 88,
    dano: 2, xp: 40, pontos: 72, lados: 4, comportamento: 'perseguir', ato: 2, desde: 102, podre: true,
    escudoFrontal: true, escudoVida: 46, resiste: 0.6
  },
  // Some e volta mais perto, como em vida. A diferença é que agora não cansa.
  ruinaEspectro: {
    nome: 'RUÍNA DO ESPECTRO', cor: '#e14dff', cor2: '#3d0a4d', raio: 17, vida: 58, velocidade: 210,
    dano: 1, xp: 36, pontos: 64, lados: 5, comportamento: 'piscar', ato: 2, desde: 103, podre: true,
    recarga: 1.7
  },
  // A espiral continua saindo dela sozinha, mesmo sem ninguém mandando.
  ruinaArcano: {
    nome: 'RUÍNA DO ARCANO', cor: '#ff4da6', cor2: '#4d0f2e', raio: 22, vida: 96, velocidade: 96,
    dano: 1, xp: 38, pontos: 68, lados: 6, comportamento: 'espiral', ato: 2, desde: 104, podre: true,
    distanciaIdeal: 420, recarga: 0.3, projetilVel: 265
  },
  // Não briga: repovoa. Mantém distância e cospe larvas enquanto puder.
  ruinaInvocador: {
    nome: 'RUÍNA DO INVOCADOR', cor: '#6f4dff', cor2: '#1a0f4d', raio: 24, vida: 130, velocidade: 92,
    dano: 1, xp: 44, pontos: 80, lados: 7, comportamento: 'invocar', ato: 2, desde: 105, podre: true,
    distanciaIdeal: 440, recarga: 2.6, invoca: 'larvaNadir', teto: 4
  },

  // Bicho de NÁDIR, não ruína de ninguém: nasce da névoa e corre em zigue.
  larvaNadir: {
    nome: 'LARVA DE NÁDIR', cor: '#c9a0ff', cor2: '#2e1a4d', raio: 12, vida: 40, velocidade: 250,
    dano: 1, xp: 14, pontos: 22, lados: 3, comportamento: 'zigue', ato: 2, desde: 106
  },
  // Jardim de Ossos: costela solta que se atira como lança.
  costelaViva: {
    nome: 'COSTELA VIVA', cor: '#d9cdbb', cor2: '#4a3f33', raio: 21, vida: 104, velocidade: 140,
    dano: 2, xp: 36, pontos: 62, lados: 3, comportamento: 'investir', ato: 2, desde: 107,
    alcanceInvestida: 520, forcaInvestida: 3.4
  },
  // Cidade Invertida: orbita ao contrário de quem olha, e atira no meio disso.
  oInvertido: {
    nome: 'O INVERTIDO', cor: '#b84dff', cor2: '#2e0a4d', raio: 20, vida: 88, velocidade: 190,
    dano: 1, xp: 38, pontos: 66, lados: 7, comportamento: 'orbitar', ato: 2, desde: 108,
    distanciaIdeal: 230, recarga: 1.5, projetilVel: 340
  },
  // Mar Sem Fundo: quase parado, quase preto, e castiga quem fica no aberto.
  afogado: {
    nome: 'AFOGADO', cor: '#6a57b5', cor2: '#120d24', raio: 26, vida: 200, velocidade: 40,
    dano: 2, xp: 46, pontos: 84, lados: 8, comportamento: 'rajada', ato: 2, desde: 109,
    recarga: 2.5, projetilVel: 430, resiste: 0.5
  },
  // Trono Ausente: não ataca, se entrega. O estouro é o ataque.
  vigiaDoTrono: {
    nome: 'VIGIA DO TRONO', cor: '#ff2e8a', cor2: '#4d0020', raio: 19, vida: 66, velocidade: 268,
    dano: 2, xp: 40, pontos: 70, lados: 4, comportamento: 'kamikaze', ato: 2, desde: 110,
    raioExplosao: 112
  }
};


class Inimigo {
  constructor(tipo, x, y, escala, elite) {
    const t = TIPOS_INIMIGO[tipo];
    this.id = Jogo.proximoId();
    this.tipo = tipo;
    this.def = t;
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.escala = escala || 1;
    // Elite: mesmo bicho, versão dourada e bem mais dura. Entra a partir da
    // onda 8 e é a principal fonte de perigo no fim do jogo.
    this.elite = elite === undefined ? Jogo.sorteiaElite() : !!elite;
    if (this.elite) this.escala *= 1.22;
    this.raio = t.raio * this.escala;
    this.vidaMax = t.vida * this.escala * Jogo.multiplicadorVida() * (this.elite ? 2.6 : 1);
    this.vida = this.vidaMax;
    this.velocidade = t.velocidade * Mat.aleatorio(0.9, 1.1) * Jogo.aceleracaoOnda() * (this.elite ? 1.12 : 1);
    this.angulo = Math.random() * Mat.TAU;
    this.giro = Mat.aleatorio(-1.6, 1.6);
    this.recarga = Mat.aleatorio(0.4, 1.4);
    this.flash = 0;
    this.vivo = true;
    this.nascendo = 0.45;
    this.estado = 'normal';
    this.timerEstado = 0;
    this.fase = Math.random() * Mat.TAU;
    this.direcaoOrbita = Mat.chance(0.5) ? 1 : -1;
    // Escudo da couraça: acompanha a escala da onda como a vida do corpo, e o
    // elite carrega um escudo reforçado.
    this.escudoVidaMax = t.escudoFrontal
      ? (t.escudoVida || 26) * this.escala * Math.sqrt(Jogo.multiplicadorVida()) * (this.elite ? 1.4 : 1)
      : 0;
    this.escudoVida = this.escudoVidaMax;
    this.escudoFlash = 0;
    // Corpo apodrecido das ruínas: cada vértice recua um tanto diferente, e o
    // tanto é sorteado uma vez aqui — no desenho seria alocação por quadro, e
    // o bicho ficaria tremendo em vez de parecer comido.
    this.mordidas = null;
    if (t.podre) {
      this.mordidas = new Array(t.lados);
      for (let i = 0; i < t.lados; i++) this.mordidas[i] = Mat.aleatorio(0.58, 1.06);
    }
  }

  atualizar(dt) {
    if (this.nascendo > 0) {
      this.nascendo -= dt;
      this.angulo += this.giro * dt * 3;
      return;
    }
    this.flash = Math.max(0, this.flash - dt * 4);
    if (this.escudoFlash > 0) this.escudoFlash = Math.max(0, this.escudoFlash - dt * 3);
    this.angulo += this.giro * dt;
    const j = Jogo.alvoJogador(this.x, this.y);
    if (!j) {
      this.vx *= Math.pow(0.08, dt);
      this.vy *= Math.pow(0.08, dt);
      this.x = Mat.limitar(this.x + this.vx * dt, this.raio, Jogo.LARGURA - this.raio);
      this.y = Mat.limitar(this.y + this.vy * dt, this.raio, Jogo.ALTURA - this.raio);
      return;
    }
    const dist = Mat.distancia(this.x, this.y, j.x, j.y);
    const angJog = Mat.anguloEntre(this.x, this.y, j.x, j.y);

    switch (this.def.comportamento) {
      case 'perseguir': {
        this.vx = Mat.suave(this.vx, Math.cos(angJog) * this.velocidade, 6, dt);
        this.vy = Mat.suave(this.vy, Math.sin(angJog) * this.velocidade, 6, dt);
        break;
      }
      case 'atirar': {
        const alvoDist = this.def.distanciaIdeal;
        const dir = dist > alvoDist + 40 ? 1 : dist < alvoDist - 40 ? -1 : 0;
        const lateral = Math.cos(Jogo.tempo * 1.2 + this.fase) * 0.6;
        const ax = Math.cos(angJog) * dir - Math.sin(angJog) * lateral;
        const ay = Math.sin(angJog) * dir + Math.cos(angJog) * lateral;
        this.vx = Mat.suave(this.vx, ax * this.velocidade, 5, dt);
        this.vy = Mat.suave(this.vy, ay * this.velocidade, 5, dt);
        this.recarga -= dt;
        if (this.recarga <= 0 && dist < 620) {
          this.recarga = this.def.recarga * Jogo.ritmoInimigo() * Mat.aleatorio(0.85, 1.15);
          Jogo.tiroInimigo(this.x, this.y, angJog, this.def.projetilVel, this.def.dano, this.def.cor);
        }
        break;
      }
      case 'orbitar': {
        const alvoDist = this.def.distanciaIdeal;
        const radial = dist > alvoDist ? 1 : -1;
        const ax = Math.cos(angJog) * radial * 0.8 - Math.sin(angJog) * this.direcaoOrbita;
        const ay = Math.sin(angJog) * radial * 0.8 + Math.cos(angJog) * this.direcaoOrbita;
        this.vx = Mat.suave(this.vx, ax * this.velocidade, 6, dt);
        this.vy = Mat.suave(this.vy, ay * this.velocidade, 6, dt);
        this.recarga -= dt;
        if (this.recarga <= 0) {
          this.recarga = this.def.recarga * Jogo.ritmoInimigo();
          for (let i = -1; i <= 1; i++) {
            Jogo.tiroInimigo(this.x, this.y, angJog + i * 0.28, this.def.projetilVel, this.def.dano, this.def.cor);
          }
        }
        break;
      }
      // Investida telegrafada: para, mira, dispara o corpo numa linha reta. Dá
      // para desviar — mas só se o jogador ler o telegrafo.
      case 'investir': {
        if (this.estado === 'normal') {
          this.vx = Mat.suave(this.vx, Math.cos(angJog) * this.velocidade, 5, dt);
          this.vy = Mat.suave(this.vy, Math.sin(angJog) * this.velocidade, 5, dt);
          if (dist < this.def.alcanceInvestida) { this.estado = 'mirando'; this.timerEstado = 0.7; }
        } else if (this.estado === 'mirando') {
          this.timerEstado -= dt;
          this.vx *= 0.86; this.vy *= 0.86;
          this.anguloCarga = angJog;
          this.flash = Math.max(this.flash, 0.2);
          if (this.timerEstado <= 0) {
            this.estado = 'investindo';
            this.timerEstado = 0.85;
            this.vx = Math.cos(this.anguloCarga) * this.velocidade * this.def.forcaInvestida;
            this.vy = Math.sin(this.anguloCarga) * this.velocidade * this.def.forcaInvestida;
          }
        } else {
          this.timerEstado -= dt;
          this.vx *= 0.995; this.vy *= 0.995;
          if (this.timerEstado <= 0) { this.estado = 'normal'; this.timerEstado = 0; }
        }
        break;
      }
      // Espiral contínua: nunca mira no jogador, cobre área. Obriga a andar.
      case 'espiral': {
        const dir = dist > this.def.distanciaIdeal ? 0.7 : -0.9;
        this.vx = Mat.suave(this.vx, Math.cos(angJog) * dir * this.velocidade, 4, dt);
        this.vy = Mat.suave(this.vy, Math.sin(angJog) * dir * this.velocidade, 4, dt);
        this.recarga -= dt;
        if (this.recarga <= 0 && dist < 760) {
          this.recarga = this.def.recarga;
          this.fase += 0.55;
          Jogo.tiroInimigo(this.x, this.y, this.fase, this.def.projetilVel, this.def.dano, this.def.cor);
          Jogo.tiroInimigo(this.x, this.y, this.fase + Math.PI, this.def.projetilVel, this.def.dano, this.def.cor);
        }
        break;
      }
      // Some e reaparece do lado de fora do alcance de tiro: não dá para
      // resolver o fantasma só segurando o gatilho numa direção.
      case 'piscar': {
        this.recarga -= dt;
        if (this.recarga <= 0 && dist > 120) {
          this.recarga = this.def.recarga * Mat.aleatorio(0.8, 1.2);
          Particulas.anel(this.x, this.y, this.def.cor, 26, 14);
          const a = Math.random() * Mat.TAU;
          this.x = Mat.limitar(j.x + Math.cos(a) * 190, this.raio, Jogo.LARGURA - this.raio);
          this.y = Mat.limitar(j.y + Math.sin(a) * 190, this.raio, Jogo.ALTURA - this.raio);
          Particulas.anel(this.x, this.y, this.def.cor, 26, 14);
          this.vx = 0; this.vy = 0;
        }
        const ang = Mat.anguloEntre(this.x, this.y, j.x, j.y);
        this.vx = Mat.suave(this.vx, Math.cos(ang) * this.velocidade, 7, dt);
        this.vy = Mat.suave(this.vy, Math.sin(ang) * this.velocidade, 7, dt);
        break;
      }
      // Rápido e em zigue-zague: trajetória que atrapalha a mira.
      case 'zigue': {
        const lateral = Math.sin(Jogo.tempo * 5.5 + this.fase) * 0.95;
        const ax = Math.cos(angJog) - Math.sin(angJog) * lateral;
        const ay = Math.sin(angJog) + Math.cos(angJog) * lateral;
        this.vx = Mat.suave(this.vx, ax * this.velocidade, 8, dt);
        this.vy = Mat.suave(this.vy, ay * this.velocidade, 8, dt);
        break;
      }
      // Quase parada, mas castiga quem fica no aberto: rajada de três tiros.
      case 'rajada': {
        this.vx = Mat.suave(this.vx, Math.cos(angJog) * this.velocidade, 2, dt);
        this.vy = Mat.suave(this.vy, Math.sin(angJog) * this.velocidade, 2, dt);
        this.recarga -= dt;
        if (this.estado === 'atirando') {
          if (this.recarga <= 0) {
            this.timerEstado--;
            this.recarga = 0.16;
            Jogo.tiroInimigo(this.x, this.y, angJog, this.def.projetilVel, this.def.dano, this.def.cor);
            if (this.timerEstado <= 0) { this.estado = 'normal'; this.recarga = this.def.recarga; }
          }
        } else if (this.recarga <= 0 && dist < 700) {
          this.estado = 'atirando';
          this.timerEstado = 3;
          this.recarga = 0.4;
          this.flash = Math.max(this.flash, 0.25);
        }
        break;
      }
      // A ruína do invocador não luta: ela repovoa. Mantém distância e cospe
      // larvas, com teto de ninhada — sem teto, uma onda de NÁDIR nunca
      // terminaria, porque o spawn correria atrás do abate para sempre.
      case 'invocar': {
        const alvo = this.def.distanciaIdeal;
        const dir = dist > alvo + 50 ? 1 : dist < alvo - 50 ? -1 : 0;
        this.vx = Mat.suave(this.vx, Math.cos(angJog) * dir * this.velocidade, 4, dt);
        this.vy = Mat.suave(this.vy, Math.sin(angJog) * dir * this.velocidade, 4, dt);
        this.recarga -= dt;
        if (this.recarga <= 0) {
          this.recarga = this.def.recarga * Jogo.ritmoInimigo() * Mat.aleatorio(0.9, 1.1);
          if (this.ninhadaViva() < this.def.teto) this.invocar();
        }
        break;
      }
      case 'kamikaze': {
        if (this.estado === 'normal') {
          this.vx = Mat.suave(this.vx, Math.cos(angJog) * this.velocidade * 0.55, 5, dt);
          this.vy = Mat.suave(this.vy, Math.sin(angJog) * this.velocidade * 0.55, 5, dt);
          if (dist < 250) { this.estado = 'carregando'; this.timerEstado = 0.85; }
        } else if (this.estado === 'carregando') {
          this.timerEstado -= dt;
          this.vx *= 0.9; this.vy *= 0.9;
          this.anguloCarga = angJog;
          if (this.timerEstado <= 0) {
            this.estado = 'investindo';
            this.timerEstado = 1.1;
            this.vx = Math.cos(this.anguloCarga) * this.velocidade * 2.4;
            this.vy = Math.sin(this.anguloCarga) * this.velocidade * 2.4;
          }
        } else {
          this.timerEstado -= dt;
          if (this.timerEstado <= 0 || dist < this.raio + j.raio + 6) this.explodir();
        }
        break;
      }
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // separação simples pra não empilhar
    if (Jogo.inimigos.length < 90) {
      for (const o of Jogo.inimigos) {
        if (o === this) continue;
        const d = Mat.distancia(this.x, this.y, o.x, o.y);
        const min = this.raio + o.raio;
        if (d > 0 && d < min) {
          const a = Mat.anguloEntre(o.x, o.y, this.x, this.y);
          const empurra = (min - d) * 0.5;
          this.x += Math.cos(a) * empurra;
          this.y += Math.sin(a) * empurra;
        }
      }
    }

    const m = this.raio;
    this.x = Mat.limitar(this.x, m, Jogo.LARGURA - m);
    this.y = Mat.limitar(this.y, m, Jogo.ALTURA - m);

    // contato com o jogador
    if (dist < this.raio + j.raio) {
      if (j.escudoAtivo || j.intangivel) {
        // escudo queima quem encosta (dano por segundo, não por quadro)
        if (j.escudoAtivo && this.def.comportamento !== 'kamikaze') {
          this.vida -= 55 * dt;
          this.flash = 0.15;
          if (this.vida <= 0) this.morrer(false);
        }
        // Elite reforça quem tirava 1, mas nada de encostão de 3: só a
        // investida do lanceiro chega lá, e ela é telegrafada.
      } else if (j.receberDano(Math.min(2, this.def.dano + (this.elite ? 1 : 0)) + (this.estado === 'investindo' ? 1 : 0), this.x, this.y)) {
        if (j.espinhos > 0) Jogo.danificarInimigo(this, j.espinhos, false, j.x, j.y);
        if (this.def.comportamento === 'kamikaze') this.explodir();
      }
    }
  }

  // Só conta as larvas que ESTA ruína pôs no mundo: duas ruínas na tela são
  // duas ninhadas, e matar as de uma libera vaga só para ela.
  ninhadaViva() {
    let n = 0;
    for (const o of Jogo.inimigos) {
      if (o.vivo && o.criadaPor === this.id) n++;
    }
    return n;
  }

  invocar() {
    const a = Math.random() * Mat.TAU;
    const cria = new Inimigo(this.def.invoca,
      Mat.limitar(this.x + Math.cos(a) * 34, 20, Jogo.LARGURA - 20),
      Mat.limitar(this.y + Math.sin(a) * 34, 20, Jogo.ALTURA - 20), 0.86, false);
    cria.criadaPor = this.id;
    Jogo.inimigos.push(cria);
    Particulas.anel(cria.x, cria.y, this.def.cor, 30, 12);
  }

  explodir() {
    if (!this.vivo) return;
    this.vivo = false;
    Particulas.explosao(this.x, this.y, this.def.cor, 34, 460, 0.7, 5);
    Particulas.anel(this.x, this.y, '#ffe14d', 60, 26);
    Camera.bater(9);
    Som.morteInimigo();
    for (const j of Jogo.jogadores()) {
      if (Mat.distancia(this.x, this.y, j.x, j.y) < this.def.raioExplosao + j.raio) {
        j.receberDano(this.def.dano, this.x, this.y);
      }
    }
    Jogo.marcarMorte(this, false);
  }

  // Escudo quebrado: anel de estilhaços, o bicho acelera de raiva e o jogador
  // ganha o flanco de graça pelo resto da vida dele.
  quebrarEscudo() {
    if (this.escudoVida > 0) return;
    this.escudoVida = 0;
    this.velocidade *= 1.25;
    this.escudoFlash = 0.4;
    Particulas.anel(this.x, this.y, '#dfe9f5', this.raio * 1.6, 14);
    Som.acerto();
    Textos.criar(this.x, this.y - this.raio - 10, 'ESCUDO QUEBRADO', '#dfe9f5', 14);
  }

  morrer(porTiro) {
    if (!this.vivo) return;
    this.vivo = false;
    Particulas.explosao(this.x, this.y, this.def.cor, 8 + Math.floor(this.raio * 0.35), 300, 0.45, 4);
    Particulas.anel(this.x, this.y, this.def.cor, this.raio * 1.1, 8);
    Camera.bater(3.5);
    Som.morteInimigo();

    // divisor gera filhotes
    if (this.def.divideEm && this.escala > 0.6) {
      for (let i = 0; i < this.def.divideEm; i++) {
        const a = (Mat.TAU / this.def.divideEm) * i;
        const f = new Inimigo('divisor', this.x + Math.cos(a) * 26, this.y + Math.sin(a) * 26, this.escala * 0.55, this.elite);
        f.vidaMax = f.vida = Math.max(12, this.vidaMax * 0.28);
        Jogo.inimigos.push(f);
      }
    }
    Jogo.marcarMorte(this, porTiro);
  }

  desenhar(ctx) {
    const t = this.def;
    ctx.save();
    ctx.translate(this.x, this.y);

    if (this.nascendo > 0) {
      const p = 1 - this.nascendo / 0.45;
      ctx.globalAlpha = p;
      ctx.scale(0.4 + p * 0.6, 0.4 + p * 0.6);
      ctx.strokeStyle = t.cor;
      ctx.lineWidth = 2;
      ctx.shadowBlur = Jogo.modoLeve ? 0 : 20; ctx.shadowColor = t.cor;
      ctx.beginPath();
      ctx.arc(0, 0, this.raio * (2.4 - p * 1.4), 0, Mat.TAU);
      ctx.stroke();
    }

    if (this.elite) {
      ctx.save();
      ctx.strokeStyle = '#ffd34d';
      ctx.lineWidth = 2.5;
      ctx.shadowBlur = Jogo.modoLeve ? 0 : 18; ctx.shadowColor = '#ffd34d';
      ctx.beginPath();
      ctx.arc(0, 0, this.raio + 7 + Math.sin(Jogo.tempo * 4 + this.fase) * 2, 0, Mat.TAU);
      ctx.stroke();
      ctx.restore();
    }

    /* O eco: ruína é cópia de um Condutor que morreu, e a cópia não fecha
       direito. Um contorno do mesmo corpo, girado um tanto atrás e quase
       transparente, dá a sensação de imagem que não alinha. Só contorno, e só
       fora do modo leve: é enfeite, e enfeite é o primeiro a sair quando o
       celular está sofrendo. */
    if (this.mordidas && !Jogo.modoLeve) {
      ctx.save();
      ctx.rotate(this.angulo - 0.22);
      ctx.globalAlpha = 0.28;
      ctx.strokeStyle = t.cor;
      ctx.lineWidth = 1.4;
      ctx.shadowBlur = 12;
      ctx.shadowColor = t.cor;
      ctx.beginPath();
      for (let i = 0; i < t.lados; i++) {
        const a = (Mat.TAU / t.lados) * i;
        const r = this.raio * this.mordidas[i] * 1.14;
        ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    ctx.rotate(this.angulo);
    ctx.shadowBlur = Jogo.modoLeve ? 0 : 20;
    ctx.shadowColor = t.cor;

    // corpo poligonal
    const lados = t.lados;
    ctx.beginPath();
    for (let i = 0; i < lados; i++) {
      const a = (Mat.TAU / lados) * i;
      let r = this.raio * (this.estado === 'carregando' ? 1 + Math.sin(Jogo.tempo * 40) * 0.12 : 1);
      if (this.mordidas) r *= this.mordidas[i];
      ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    let g = t.cor;
    if (!Jogo.modoLeve) {
      g = ctx.createRadialGradient(0, 0, this.raio * 0.2, 0, 0, this.raio);
      g.addColorStop(0, this.flash > 0 ? '#ffffff' : t.cor);
      g.addColorStop(1, t.cor2);
    }
    ctx.fillStyle = this.flash > 0 ? '#fff' : g;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = this.flash > 0 ? '#fff' : t.cor;
    ctx.stroke();

    /* Ruína: o corpo não é só um polígono comido, está rachado. As rachas saem
       das próprias `mordidas`, então são as mesmas em todo quadro e não custam
       sorteio nem alocação. Duas linhas do centro para fora bastam — mais que
       isso, no tamanho que o bicho tem na tela, vira borrão. */
    if (this.mordidas) {
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(0,0,0,.55)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let i = 0; i < 2; i++) {
        const m = this.mordidas[i % this.mordidas.length];
        const a = m * Mat.TAU;
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * this.raio * 0.95, Math.sin(a) * this.raio * 0.95);
      }
      ctx.stroke();
    }

    // núcleo
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.beginPath();
    ctx.arc(0, 0, this.raio * 0.34, 0, Mat.TAU);
    ctx.fill();
    ctx.fillStyle = this.flash > 0 ? '#fff' : t.cor;
    ctx.beginPath();
    ctx.arc(0, 0, this.raio * 0.18, 0, Mat.TAU);
    ctx.fill();
    ctx.restore();

    // escudo frontal da couraça: encolhe e escurece conforme apanha
    if (t.escudoFrontal && this.escudoVida > 0 && Jogo.jogador) {
      const p = Mat.limitar(this.escudoVida / this.escudoVidaMax, 0, 1);
      const angJog = Mat.anguloEntre(this.x, this.y, Jogo.jogador.x, Jogo.jogador.y);
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(angJog);
      ctx.globalAlpha = 0.35 + p * 0.65;
      ctx.strokeStyle = this.escudoFlash > 0 ? '#ffffff' : '#dfe9f5';
      ctx.lineWidth = 2 + p * 3;
      ctx.shadowBlur = Jogo.modoLeve ? 0 : 14; ctx.shadowColor = '#dfe9f5';
      ctx.beginPath();
      ctx.arc(0, 0, this.raio + 8, -0.9 * p, 0.9 * p);
      ctx.stroke();
      ctx.restore();
    }

    // barra de vida
    if (this.vida < this.vidaMax) {
      const largura = this.raio * 2;
      const p = Mat.limitar(this.vida / this.vidaMax, 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,.6)';
      ctx.fillRect(this.x - largura / 2, this.y - this.raio - 12, largura, 5);
      ctx.fillStyle = p > 0.5 ? '#5cff9d' : p > 0.25 ? '#ffd34d' : '#ff4d6d';
      ctx.fillRect(this.x - largura / 2, this.y - this.raio - 12, largura * p, 5);
    }

    // Barra do escudo, logo acima da de vida: dá para ver o escudo descendo a
    // cada tiro em vez de adivinhar quanto falta para quebrar.
    if (this.escudoVidaMax > 0 && this.escudoVida > 0) {
      const largura = this.raio * 2;
      const p = Mat.limitar(this.escudoVida / this.escudoVidaMax, 0, 1);
      const y = this.y - this.raio - 20;
      ctx.fillStyle = 'rgba(0,0,0,.6)';
      ctx.fillRect(this.x - largura / 2, y, largura, 5);
      ctx.fillStyle = this.escudoFlash > 0 ? '#ffffff' : '#7fd4ff';
      ctx.fillRect(this.x - largura / 2, y, largura * p, 5);
      ctx.strokeStyle = 'rgba(160,220,255,.55)';
      ctx.lineWidth = 1;
      ctx.strokeRect(this.x - largura / 2, y, largura, 5);
    }

  }
}

/* ================================ BOSSES ================================ */
const BOSSES = [
  {
    id: 'sentinela',
    nome: 'SENTINELA CARMESIM',
    titulo: 'Guardião do Corredor',
    cor: '#ff2e5b', cor2: '#5c0018',
    raio: 62, vida: 950, lados: 6,
    fases: [
      { movimento: 'horizontal', velocidade: 210, ataques: ['unico', 'leque3'], recarga: 1.0 },
      { movimento: 'investida', velocidade: 250, ataques: ['leque3', 'precisao'], recarga: 0.8 },
      { movimento: 'cerco', velocidade: 1.2, ataques: ['leque3', 'anel', 'precisao', 'cacador'], recarga: 0.62 }
    ]
  },
  {
    id: 'serpente',
    nome: 'SERPENTE DE VÍDEO',
    titulo: 'A Onda que Não Quebra',
    cor: '#00e5ff', cor2: '#00485c',
    raio: 58, vida: 1100, lados: 5,
    fases: [
      { movimento: 'senoidal', velocidade: 260, ataques: ['leque', 'chuva'], recarga: 1.3 },
      { movimento: 'senoidal', velocidade: 350, ataques: ['leque', 'precisao', 'parede'], recarga: 0.9 },
      { movimento: 'cerco', velocidade: 1.5, ataques: ['leque', 'anel', 'invocar', 'chuva', 'cacador'], recarga: 0.66 }
    ]
  },
  {
    id: 'olho',
    nome: 'OLHO DO VAZIO',
    titulo: 'Aquele que Espirala',
    cor: '#b06dff', cor2: '#3a0d63',
    raio: 66, vida: 1300, lados: 8,
    fases: [
      { movimento: 'circular', velocidade: 1.0, ataques: ['espiral'], recarga: 0.14 },
      { movimento: 'teleporte', velocidade: 200, ataques: ['espiral', 'cruz'], recarga: 0.4 },
      { movimento: 'circular', velocidade: 2.1, ataques: ['espiral', 'parede', 'invocar', 'minas'], recarga: 0.28 }
    ]
  },
  {
    id: 'arquiteto',
    nome: 'O ARQUITETO',
    titulo: 'Fim da Linha',
    cor: '#ffd34d', cor2: '#6b4a00',
    raio: 74, vida: 1550, lados: 3,
    fases: [
      { movimento: 'perseguir', velocidade: 185, ataques: ['leque', 'laser', 'precisao'], recarga: 1.05 },
      { movimento: 'investida', velocidade: 300, ataques: ['parede', 'anel'], recarga: 0.7 },
      { movimento: 'teleporte', velocidade: 230, ataques: ['laser', 'invocar', 'cruz'], recarga: 0.5 },
      { movimento: 'caotico', velocidade: 430, ataques: ['espiral', 'parede', 'laser', 'chuva', 'minas', 'cacador'], recarga: 0.34 }
    ]
  },
  {
    id: 'ferreiro', nome: 'FERREIRO SOLAR', titulo: 'Forja em Colapso',
    cor: '#ff8e45', cor2: '#7a2909', raio: 65, vida: 1800, lados: 6,
    fases: [
      { movimento: 'investida', velocidade: 270, ataques: ['leque3', 'anel'], recarga: 0.85 },
      { movimento: 'cerco', velocidade: 1.3, ataques: ['chuva', 'invocar', 'precisao'], recarga: 0.7 },
      { movimento: 'caotico', velocidade: 350, ataques: ['laser', 'parede', 'cruz', 'minas'], recarga: 0.55 }
    ]
  },
  {
    id: 'oraculo', nome: 'ORÁCULO DE JADE', titulo: 'Geometria Viva',
    cor: '#56f0b0', cor2: '#176451', raio: 61, vida: 2150, lados: 8,
    fases: [
      { movimento: 'circular', velocidade: 1.2, ataques: ['espiral', 'precisao'], recarga: 0.24 },
      { movimento: 'teleporte', velocidade: 240, ataques: ['cruz', 'parede'], recarga: 0.55 },
      { movimento: 'cerco', velocidade: 1.7, ataques: ['espiral', 'invocar', 'laser', 'chuva', 'cacador'], recarga: 0.4 }
    ]
  },
  {
    id: 'eclipse', nome: 'ECLIPSE FANTASMA', titulo: 'Luz Devorada',
    cor: '#8d83ff', cor2: '#33226e', raio: 70, vida: 2550, lados: 5,
    fases: [
      { movimento: 'teleporte', velocidade: 240, ataques: ['leque3', 'laser'], recarga: 0.85 },
      { movimento: 'caotico', velocidade: 370, ataques: ['parede', 'invocar', 'precisao'], recarga: 0.58 },
      { movimento: 'cerco', velocidade: 1.9, ataques: ['espiral', 'cruz', 'laser', 'minas', 'cacador'], recarga: 0.44 }
    ]
  },
  {
    // Boss final da onda 100. `final: true` tira ele do rodízio normal.
    // `velocidadeTiro` multiplica a velocidade de todo projétil que ele solta.
    id: 'ceifador', nome: 'CEIFADOR ABSOLUTO', titulo: 'O Fim da Arena',
    final: true, velocidadeTiro: 2.1,
    // Ele não é difícil: ele é invencível, de propósito. `regenera` devolve 7%
    // da barra por segundo — mais do que qualquer build do jogo tira — e
    // `tetoDeDano` limita o quanto um único acerto pode arrancar, para que nem
    // ultimate nem crítico gigante furem a conta. A onda 100 é onde a corrida
    // termina, não onde ela é vencida.
    regenera: 0.07, tetoDeDano: 0.004, tetoPorSegundo: 0.02,
    volumeExtra: 1.6,   // cada ataque dele sai com 60% mais bala que o normal
    cor: '#ff1744', cor2: '#3d0010', raio: 92, vida: 21000, lados: 3,
    fases: [
      { movimento: 'emboscada', velocidade: 360, ataques: ['execucao', 'todosOsLados', 'precisao'], recarga: 0.6 },
      { movimento: 'emboscada', velocidade: 380, ataques: ['execucao', 'todosOsLados', 'parede', 'cacador'], recarga: 0.48 },
      { movimento: 'emboscada', velocidade: 420, ataques: ['execucao', 'todosOsLados', 'espiral', 'cruz', 'minas'], recarga: 0.36 },
      { movimento: 'emboscada', velocidade: 520, ataques: ['execucao', 'todosOsLados', 'parede', 'laser', 'chuva', 'cacador', 'cruz'], recarga: 0.26 }
    ]
  },
  {
    id: 'nucleo', nome: 'NÚCLEO INFINITO', titulo: 'Último Pulso',
    cor: '#ff5cae', cor2: '#791c55', raio: 78, vida: 3000, lados: 7,
    fases: [
      { movimento: 'circular', velocidade: 1.2, ataques: ['espiral', 'leque3', 'precisao'], recarga: 0.38 },
      { movimento: 'investida', velocidade: 330, ataques: ['parede', 'invocar'], recarga: 0.6 },
      { movimento: 'teleporte', velocidade: 280, ataques: ['laser', 'cruz', 'chuva'], recarga: 0.5 },
      { movimento: 'cerco', velocidade: 2.1, ataques: ['espiral', 'parede', 'laser', 'cruz', 'chuva', 'minas', 'cacador'], recarga: 0.34 }
    ]
  },

  /* ------------------ Segunda volta: ondas 50, 60, 70, 80 e 90 -------------
     Da onda 40 em diante o boss vem de 10 em 10, e cada encontro é um bicho
     novo em vez do rodízio repetido. São cinco, e ficam progressivamente mais
     próximos do CEIFADOR — o último deles é o ensaio geral da onda 100.
     ------------------------------------------------------------------------ */
  {
    id: 'tita', nome: 'TITÃ DE FERRO', titulo: 'A Muralha que Anda',
    cor: '#9fb3c8', cor2: '#38485c', raio: 96, vida: 3250, lados: 6,
    fases: [
      { movimento: 'investida', velocidade: 240, ataques: ['leque3', 'minas'], recarga: 0.95 },
      { movimento: 'perseguir', velocidade: 210, ataques: ['parede', 'anel', 'precisao'], recarga: 0.7 },
      { movimento: 'investida', velocidade: 330, ataques: ['parede', 'minas', 'chuva', 'invocar'], recarga: 0.5 }
    ]
  },
  {
    id: 'vidro', nome: 'CORTEJO DE VIDRO', titulo: 'Mil Reflexos',
    cor: '#7ef9ff', cor2: '#12586b', raio: 64, vida: 3650, lados: 4,
    fases: [
      { movimento: 'circular', velocidade: 1.5, ataques: ['cruz', 'precisao'], recarga: 0.4 },
      { movimento: 'teleporte', velocidade: 300, ataques: ['cruz', 'espiral', 'leque'], recarga: 0.34 },
      { movimento: 'cerco', velocidade: 2.0, ataques: ['cruz', 'espiral', 'parede', 'cacador'], recarga: 0.28 }
    ]
  },
  {
    id: 'rainha', nome: 'RAINHA ESTÁTICA', titulo: 'Tempestade Presa',
    cor: '#ffe14d', cor2: '#6b5a0c', raio: 72, vida: 4200, lados: 5,
    fases: [
      { movimento: 'teleporte', velocidade: 280, ataques: ['laser', 'leque'], recarga: 0.8 },
      { movimento: 'caotico', velocidade: 400, ataques: ['laser', 'cacador', 'chuva'], recarga: 0.55 },
      { movimento: 'cerco', velocidade: 2.2, ataques: ['laser', 'cacador', 'anel', 'cruz'], recarga: 0.4 }
    ]
  },
  {
    id: 'abismo', nome: 'ABISMO CARMESIM', titulo: 'O Que Engole a Arena',
    cor: '#c2185b', cor2: '#4a0322', raio: 88, vida: 4850, lados: 8,
    fases: [
      { movimento: 'cerco', velocidade: 1.4, ataques: ['anel', 'invocar'], recarga: 0.7 },
      { movimento: 'caotico', velocidade: 380, ataques: ['anel', 'parede', 'minas'], recarga: 0.5 },
      { movimento: 'cerco', velocidade: 2.4, ataques: ['anel', 'parede', 'espiral', 'invocar', 'chuva'], recarga: 0.36 }
    ]
  },
  {
    id: 'arauto', nome: 'ÚLTIMO ARAUTO', titulo: 'A Sombra do Ceifador',
    cor: '#ff5252', cor2: '#5c0b0b', raio: 82, vida: 5700, lados: 3,
    velocidadeTiro: 1.35,
    fases: [
      { movimento: 'investida', velocidade: 340, ataques: ['precisao', 'leque'], recarga: 0.62 },
      { movimento: 'teleporte', velocidade: 320, ataques: ['precisao', 'parede', 'cacador'], recarga: 0.48 },
      { movimento: 'caotico', velocidade: 440, ataques: ['cruz', 'laser', 'minas', 'chuva'], recarga: 0.4 },
      { movimento: 'cerco', velocidade: 2.5, ataques: ['espiral', 'parede', 'cacador', 'laser', 'anel', 'chuva'], recarga: 0.3 }
    ]
  },

  /* ----------------------------- O SEGREDO -------------------------------
     Não existe onda para ele. `secreto: true` tira ele do rodízio e da onda
     100: quem o chama é Jogo.abrirSegredo(), depois do CEIFADOR cair.

     `invencivel` não é dificuldade, é regra: receberDano devolve sem tocar na
     barra. Não há build, crítico, ultimate ou bug de dano que mude isso, e a
     barra não desce um pixel porque não existe número para descer.

     As fases dele passam por TEMPO (`fasesPorTempo`), não por vida — vida que
     não cai nunca trocaria de fase. A cada 18 segundos ele fica pior.
     ---------------------------------------------------------------------- */
  /* ===================== BOSSES DO ATO II — NÁDIR ======================

     Um a cada dez ondas: 110, 120, ... 190, e a onda 200 é O ESPECTADOR.
     Cinco deles são as classes jogáveis apodrecidas, e lutam como a classe
     lutava — quem jogou de ESPECTRO reconhece de quem é o passo. Os outros
     quatro são de NÁDIR: o senhor de cada região e VÉSPERA, a primeira
     Condutora (ver HISTORIA.md).

     `ato: 2` é o que os mantém fora do rodízio do Ato I.

     A vida não foi chutada: o CEIFADOR, com a escala da própria campanha, tem
     154.392 de vida na onda 100. O primeiro de NÁDIR empata com ele (~157 mil)
     e cada encontro seguinte sobe ~1,12×, até ~2,6× o CEIFADOR na onda 190.
     Começar abaixo dele seria degrau para baixo depois da luta mais dura do
     jogo; subir 1,3× por encontro faria a onda 190 durar dez minutos. */

  {
    id: 'ruinaPrimeiroTiro',
    glifo: 'M',
    nome: 'O PRIMEIRO TIRO',
    titulo: 'Ruína do SNIPER',
    ato: 2,
    cor: '#b06cff', cor2: '#2a0d4d',
    raio: 62, vida: 20800, lados: 5,
    fases: [
      { movimento: 'teleporte', velocidade: 210, ataques: ['unico', 'precisao'], recarga: 1.0 },
      { movimento: 'emboscada', velocidade: 280, ataques: ['precisao', 'cacador', 'laser'], recarga: 0.72 },
      { movimento: 'teleporte', velocidade: 330, ataques: ['precisao', 'laser', 'parede', 'cacador'], recarga: 0.52 }
    ]
  },
  {
    id: 'ruinaMuralha',
    glifo: 'G',
    nome: 'A MURALHA QUE CEDEU',
    titulo: 'Ruína do GUARDIÃO',
    ato: 2,
    cor: '#8f8aa8', cor2: '#2b2740',
    raio: 82, vida: 22400, lados: 4,
    fases: [
      { movimento: 'horizontal', velocidade: 190, ataques: ['anel', 'leque'], recarga: 1.05 },
      { movimento: 'investida', velocidade: 240, ataques: ['anel', 'parede', 'cruz'], recarga: 0.8 },
      { movimento: 'cerco', velocidade: 1.3, ataques: ['anel', 'parede', 'cruz', 'chuva'], recarga: 0.6 }
    ]
  },
  {
    id: 'jardineiroDeOssos',
    nome: 'O JARDINEIRO DE OSSOS',
    titulo: 'Senhor do Jardim de Ossos',
    ato: 2,
    cor: '#d9cdbb', cor2: '#4a3f33',
    raio: 74, vida: 24500, lados: 7,
    convoca: ['costelaViva', 'larvaNadir'],
    fases: [
      { movimento: 'senoidal', velocidade: 200, ataques: ['invocar', 'chuva'], recarga: 1.0 },
      { movimento: 'cerco', velocidade: 1.2, ataques: ['invocar', 'chuva', 'minas'], recarga: 0.76 },
      { movimento: 'cerco', velocidade: 1.6, ataques: ['invocar', 'minas', 'espiral', 'cacador'], recarga: 0.56 }
    ]
  },
  {
    id: 'ruinaDuasVezes',
    glifo: 'E',
    nome: 'O QUE PISCA DUAS VEZES',
    titulo: 'Ruína do ESPECTRO',
    ato: 2,
    cor: '#e14dff', cor2: '#3d0a4d',
    raio: 56, vida: 26800, lados: 5,
    velocidadeTiro: 1.25,
    fases: [
      { movimento: 'teleporte', velocidade: 300, ataques: ['leque3', 'precisao'], recarga: 0.86 },
      { movimento: 'emboscada', velocidade: 380, ataques: ['precisao', 'cruz', 'espiral'], recarga: 0.62 },
      { movimento: 'emboscada', velocidade: 440, ataques: ['precisao', 'cruz', 'espiral', 'todosOsLados'], recarga: 0.44 }
    ]
  },
  {
    id: 'prumoInvertido',
    nome: 'O PRUMO INVERTIDO',
    titulo: 'Senhor da Cidade Invertida',
    ato: 2,
    cor: '#b84dff', cor2: '#2e0a4d',
    raio: 70, vida: 29400, lados: 8,
    fases: [
      { movimento: 'circular', velocidade: 1.7, ataques: ['parede', 'anel'], recarga: 0.94 },
      { movimento: 'caotico', velocidade: 340, ataques: ['parede', 'cruz', 'anel'], recarga: 0.7 },
      { movimento: 'circular', velocidade: 2.3, ataques: ['parede', 'cruz', 'espiral', 'minas'], recarga: 0.5 }
    ]
  },
  {
    id: 'ruinaCirculoQuebrado',
    glifo: 'A',
    nome: 'O CÍRCULO QUEBRADO',
    titulo: 'Ruína do ARCANO',
    ato: 2,
    cor: '#ff4da6', cor2: '#4d0f2e',
    raio: 66, vida: 32200, lados: 6,
    volumeExtra: 1.15,
    fases: [
      { movimento: 'circular', velocidade: 1.5, ataques: ['espiral', 'anel'], recarga: 0.9 },
      { movimento: 'perseguir', velocidade: 250, ataques: ['espiral', 'anel', 'todosOsLados'], recarga: 0.66 },
      { movimento: 'caotico', velocidade: 360, ataques: ['espiral', 'todosOsLados', 'parede', 'laser'], recarga: 0.46 }
    ]
  },
  {
    id: 'bocaDoMar',
    nome: 'A BOCA DO MAR',
    titulo: 'Fundo do Mar Sem Fundo',
    ato: 2,
    cor: '#6a57b5', cor2: '#120d24',
    raio: 98, vida: 35500, lados: 10,
    fases: [
      { movimento: 'senoidal', velocidade: 170, ataques: ['chuva', 'parede'], recarga: 0.92 },
      { movimento: 'cerco', velocidade: 1.2, ataques: ['chuva', 'parede', 'laser'], recarga: 0.68 },
      { movimento: 'cerco', velocidade: 1.7, ataques: ['chuva', 'parede', 'laser', 'todosOsLados', 'minas'], recarga: 0.46 }
    ]
  },
  {
    id: 'vespera',
    nome: 'VÉSPERA',
    titulo: 'A Primeira Condutora',
    ato: 2,
    cor: '#ff2e8a', cor2: '#4d0020',
    raio: 58, vida: 39300, lados: 3,
    velocidadeTiro: 1.35,
    fases: [
      { movimento: 'investida', velocidade: 330, ataques: ['precisao', 'leque3'], recarga: 0.8 },
      { movimento: 'caotico', velocidade: 420, ataques: ['precisao', 'cacador', 'cruz'], recarga: 0.58 },
      { movimento: 'emboscada', velocidade: 470, ataques: ['precisao', 'cacador', 'cruz', 'espiral'], recarga: 0.42 },
      { movimento: 'caotico', velocidade: 520, ataques: ['precisao', 'cacador', 'cruz', 'espiral', 'laser', 'minas'], recarga: 0.3 }
    ]
  },
  {
    id: 'ruinaQueChama',
    glifo: 'I',
    nome: 'O QUE AINDA CHAMA',
    titulo: 'Ruína do INVOCADOR',
    ato: 2,
    cor: '#6f4dff', cor2: '#1a0f4d',
    raio: 76, vida: 43400, lados: 7,
    convoca: ['larvaNadir', 'costelaViva', 'vigiaDoTrono', 'oInvertido'],
    fases: [
      { movimento: 'cerco', velocidade: 1.2, ataques: ['invocar', 'anel'], recarga: 0.88 },
      { movimento: 'cerco', velocidade: 1.6, ataques: ['invocar', 'anel', 'cacador', 'chuva'], recarga: 0.62 },
      { movimento: 'teleporte', velocidade: 320, ataques: ['invocar', 'espiral', 'laser', 'chuva', 'minas'], recarga: 0.42 }
    ]
  },
  {
    id: 'espectador', nome: 'O ESPECTADOR', titulo: 'O autor do fim',
    ato: 2, secreto: true, invencivel: true, fasesPorTempo: 18,
    velocidadeTiro: 1.5, volumeExtra: 1.5,
    cor: '#f4f6ff', cor2: '#05050a', raio: 118, vida: 1, lados: 12,
    fases: [
      { movimento: 'teleporte', velocidade: 240, ataques: ['precisao', 'anel'], recarga: 1.1 },
      { movimento: 'emboscada', velocidade: 300, ataques: ['precisao', 'espiral', 'cruz'], recarga: 0.7 },
      { movimento: 'emboscada', velocidade: 380, ataques: ['espiral', 'parede', 'laser', 'cacador'], recarga: 0.45 },
      { movimento: 'caotico', velocidade: 520, ataques: ['todosOsLados', 'espiral', 'parede', 'laser', 'chuva', 'cruz', 'minas'], recarga: 0.22 }
    ]
  }
];


class Boss {
  // Dificuldade do boss num lugar só: vida e intervalo entre ataques. Mexer
  // aqui é mais seguro que reescrever as fases de oito tabelas.
  // Vida e aperto não são mais um número fixo para os catorze: cada um é uma
  // faixa que a campanha percorre. O boss da onda 5 pega a ponta de baixo, o da
  // 90 pega a de cima. Era o que faltava — um multiplicador único deixava o
  // primeiro boss tão apertado quanto o último.
  static VIDA_MIN = 1.4;      // multiplicador de vida no primeiro encontro
  static VIDA_MAX = 2.9;      // e no último antes do final
  static APERTO_MIN = 0.8;    // ataca 20% menos vezes que a tabela pede
  static APERTO_MAX = 1.55;   // e, no fim, 55% mais
  static DIFICULDADE = 1.5;   // continua valendo para o CEIFADOR, que é teto
  static RITMO_ATAQUE = 1.15;   // < 1 = ataca mais vezes
  static FURIA_VIDA = 0.25;     // abaixo disso o boss acelera
  static FURIA_RITMO = 0.75;
  static DESESPERO_VIDA = 0.1;  // e no fim da barra ele perde o freio
  static DESESPERO_RITMO = 0.6;

  // Rampa por encontro: o boss da onda 5 é uma aula e o da onda 90 é um muro.
  // `dureza` vai de 0 (primeiro boss) a 1 (último antes do final) e controla
  // ritmo de ataque e passo — sem isso o primeiro boss já vinha no talo.
  // Curva da campanha inteira, de 0 (boss da onda 5) a 1 (boss da onda 90).
  // Até a onda 50 ela sobe devagar — é a metade tranquila do jogo, onde dá para
  // aprender o padrão. Da 50 em diante ela acelera e o jogo mostra os dentes.
  static dureza(onda) {
    // Até a onda 50 a curva sobe ao quadrado: quase nada nos três primeiros
    // encontros, que é onde o jogador ainda está montando a build, e acelerando
    // só depois. Da 50 em diante é reta até 1 na onda 90.
    if (onda <= 50) {
      const t = Mat.limitar((onda - 5) / 45, 0, 1);
      return t * t * 0.35;
    }
    return Mat.limitar(0.35 + ((onda - 50) / 40) * 0.65, 0, 1);
  }

  /* Ato II não estica `dureza` acima de 1, e isso é de propósito: dureza manda
     em volume de projétil, tamanho de leque e quantos ataques a fase libera, e
     esses números foram medidos no teto do Ato I. Esticar para 1,9 daria anel
     de 89 projéteis — não é dificuldade, é tela branca.

     O que cresce em NÁDIR é a PRESSÃO: o boss ataca mais vezes, com os mesmos
     ataques. Vai de 1,0 no primeiro encontro (onda 110) a 1,4 no último antes
     do fim (onda 190), e a onda 200 herda o teto. */
  static pressao(onda) {
    if (onda <= Jogo.TOTAL_ONDAS) return 1;
    return 1 + Mat.limitar((onda - 110) / 80, 0, 1) * 0.4;
  }

  /* Vida de boss do Ato II também olha o NÍVEL do jogador, o que nenhum boss do
     Ato I faz. Motivo: em NÁDIR não existe mais "nível esperado" — quem
     atravessou a fenda pode estar no 28 ou no 45, e a mesma barra seria um muro
     para um e um trâmite para o outro. Teto de 30% para isso continuar sendo
     tempero, e não castigo por ter jogado bem. */
  static pesoDoNivel(nivel) {
    return 1 + Mat.limitar((nivel - 20) * 0.012, 0, 0.3);
  }

  // O quanto ESTE boss aperta, entre APERTO_MIN e APERTO_MAX. O final ignora a
  // faixa e usa DIFICULDADE cheia.
  get aperto() {
    return this.def.final ? Boss.DIFICULDADE : Mat.misturar(Boss.APERTO_MIN, Boss.APERTO_MAX, this.dureza);
  }

  // A luta tem que crescer, não começar no talo: a primeira fase é de leitura
  // e cada fase seguinte aperta o ritmo e o passo do boss.
  static RITMO_FASE = [1.45, 1.1, 0.85, 0.7];
  static IMPETO_FASE = [0.8, 0.95, 1.1, 1.25];

  constructor(def, onda) {
    this.id = Jogo.proximoId();
    this.def = def;
    this.x = Jogo.LARGURA / 2;
    this.y = 150;
    this.direcao = 1;
    this.raio = def.raio;
    const encontro = Math.max(1, Math.floor(onda / 5));
    /* Ascensão é repetição de rodízio: quando o mesmo boss volta, volta pior.
       A conta é sobre o tamanho do RODÍZIO, não sobre BOSSES.length — a lista
       cresceu com NÁDIR, e usar o tamanho dela desligaria em silêncio a
       ascensão dos últimos bosses da Arena. Em NÁDIR cada um dos dez aparece
       uma única vez, logo ascensão lá é sempre 0. */
    const voltas = def.ato === 2 ? 0 : Jogo.rodizioDoAto1().length;
    this.ascensao = voltas ? Math.floor((encontro - 1) / voltas) : 0;
    this.ritmoAscensao = Math.max(0.72, 1 - this.ascensao * 0.035);
    this.impetoAscensao = Math.min(1.18, 1 + this.ascensao * 0.025);
    const escala = 1 + Math.min(encontro - 1, 7) * 0.13 + Math.pow(Math.max(0, encontro - 8), 0.78) * 0.09;
    // Boss final ignora a rampa: ele é o teto, não um degrau.
    this.dureza = def.final ? 1 : Boss.dureza(onda);
    const vidaExtra = def.final ? Boss.VIDA_MAX : Mat.misturar(Boss.VIDA_MIN, Boss.VIDA_MAX, this.dureza);
    // Pressão e peso de nível só existem no Ato II; no Ato I os dois valem 1.
    this.pressao = Boss.pressao(onda);
    this.pesoNivel = def.ato === 2 && Jogo.jogador ? Boss.pesoDoNivel(Jogo.jogador.nivel) : 1;
    this.vidaMax = def.vida * escala * vidaExtra * this.pesoNivel;
    this.vida = this.vidaMax;
    this.faseIndice = 0;
    this.fase = def.fases[0];
    this.recarga = 1.4;
    this.anguloEspiral = 0;
    this.tempoVivo = 0;
    this.angulo = 0;
    this.flash = 0;
    this.vivo = true;
    this.entrando = 1.6;

    this.baseY = 150;
    this.orbita = 0;
    this.telegrafo = 0;
    this.absorveu = 0;
    this.imune = 0;
    this.imuneMax = 1;
    this.janelaDano = 0;
    this.danoNaJanela = 0;
    this.desesperado = false;
    this.laser = null;
    this.enraivecido = false;
  }

  get porcentagem() { return Mat.limitar(this.vida / this.vidaMax, 0, 1); }

  atualizarFase() {
    const total = this.def.fases.length;
    // Barra que não desce não troca de fase: quem tem vida intocável avança
    // por tempo de luta.
    const idx = this.def.fasesPorTempo
      ? Mat.limitar(Math.floor(this.tempoVivo / this.def.fasesPorTempo), 0, total - 1)
      : Mat.limitar(total - 1 - Math.floor(this.porcentagem * total), 0, total - 1);
    if (idx !== this.faseIndice) {
      this.faseIndice = idx;
      this.fase = this.def.fases[idx];
      this.telegrafo = 0.6;
      Camera.bater(16);
      Jogo.flashTela(0.35, this.def.cor);
      Particulas.anel(this.x, this.y, this.def.cor, 120, 44);
      Jogo.aviso('FASE ' + (idx + 1) + ' — ' + this.def.nome);
      Som.bossEntra();
      // Trocar de fase não é descanso: sai um anel junto com o telegrafo.
      this.executarAtaque('anel');
      // E a fase nova começa com escudo: ele fica imune por alguns segundos,
      // atirando o tempo todo. Quanto mais avançada a fase, mais tempo dura.
      // Escudo curto no começo da campanha, longo no fim: 1,2 s de imunidade na
      // segunda fase do primeiro boss contra 4,4 s na quarta fase do último.
      this.erguerEscudo((1 + idx * 0.5) + this.dureza * (1 + idx * 0.4));
    }
  }

  atualizar(dt) {
    this.tempoVivo += dt;
    this.flash = Math.max(0, this.flash - dt * 4);
    this.angulo += dt * 0.9;

    if (this.entrando > 0) {
      this.entrando -= dt;
      this.y = Mat.misturar(-120, this.baseY, 1 - Math.max(0, this.entrando) / 1.6);
      if (this.entrando <= 0) this.chamarEscolta();
      return;
    }

    // Regeneração absoluta: a barra volta sozinha, mais rápido do que qualquer
    // build consegue tirar. É o que torna a onda 100 inacabável.
    if (this.def.regenera && this.vida > 0) {
      const real = Jogo.dtReal || dt;   // hitstop e slow-motion não freiam a cura
      this.vida = Math.min(this.vidaMax, this.vida + this.vidaMax * this.def.regenera * real);
      if (this.absorveu > 0) this.absorveu -= dt;
    }

    if (this.imune > 0) this.imune = Math.max(0, this.imune - (Jogo.dtReal || dt));

    this.atualizarFase();
    if (this.telegrafo > 0) { this.telegrafo -= dt; return; }

    const j = Jogo.alvoJogador(this.x, this.y);
    if (!j) {
      this.recarga = Math.max(this.recarga, 0.35);
      this.laser = null;
      return;
    }
    const f = this.fase;
    // Fim de barra é a parte difícil: o boss anda e atira mais rápido.
    this.furioso = this.porcentagem <= Boss.FURIA_VIDA;
    this.desesperado = this.porcentagem <= Boss.DESESPERO_VIDA;
    const passoFase = Boss.IMPETO_FASE[Math.min(this.faseIndice, Boss.IMPETO_FASE.length - 1)];
    // Boss cedo anda a 80% do que a tabela pede; boss tardio, a 105%.
    const passoEncontro = 0.8 + this.dureza * 0.25;
    const impeto = passoFase * passoEncontro * this.impetoAscensao * (this.desesperado ? 1.35 : this.furioso ? 1.15 : 1);

    // movimento
    switch (f.movimento) {
      case 'horizontal':
        this.x += this.direcao * f.velocidade * impeto * dt;
        if (this.x - this.raio < 0 || this.x + this.raio > Jogo.LARGURA) {
          this.direcao *= -1;
          this.x = Mat.limitar(this.x, this.raio, Jogo.LARGURA - this.raio);
        }
        this.y = Mat.suave(this.y, this.baseY + Math.sin(this.tempoVivo * 1.4) * 30, 4, dt);
        break;
      case 'senoidal':
        this.x += this.direcao * f.velocidade * impeto * dt;
        if (this.x - this.raio < 0 || this.x + this.raio > Jogo.LARGURA) {
          this.direcao *= -1;
          this.x = Mat.limitar(this.x, this.raio, Jogo.LARGURA - this.raio);
        }
        this.y = Jogo.ALTURA / 2 + Math.sin(this.tempoVivo * 1.9) * (Jogo.ALTURA / 2 - this.raio - 30);
        break;
      case 'circular': {
        this.orbita += f.velocidade * impeto * dt;
        const rx = Jogo.LARGURA / 2, ry = Jogo.ALTURA / 2;
        this.x = rx + Math.cos(this.orbita) * (Jogo.LARGURA / 2 - this.raio - 60);
        this.y = ry + Math.sin(this.orbita) * (Jogo.ALTURA / 2 - this.raio - 50);
        break;
      }
      case 'perseguir': {
        const a = Mat.anguloEntre(this.x, this.y, j.x, j.y);
        const d = Mat.distancia(this.x, this.y, j.x, j.y);
        const alvo = d > 260 ? 1 : -0.4;
        this.x += Math.cos(a) * f.velocidade * alvo * impeto * dt;
        this.y += Math.sin(a) * f.velocidade * alvo * impeto * dt;
        break;
      }
      case 'caotico': {
        if (!this.destino || Mat.distancia(this.x, this.y, this.destino.x, this.destino.y) < 40) {
          this.destino = { x: Mat.aleatorio(this.raio + 20, Jogo.LARGURA - this.raio - 20), y: Mat.aleatorio(this.raio + 20, Jogo.ALTURA - this.raio - 20) };
        }
        const a = Mat.anguloEntre(this.x, this.y, this.destino.x, this.destino.y);
        this.x += Math.cos(a) * f.velocidade * impeto * dt;
        this.y += Math.sin(a) * f.velocidade * impeto * dt;
        break;
      }
      // Investida: encara, para, e atravessa a arena pela linha do jogador.
      // O tempo de leitura encolhe na fúria.
      case 'investida': {
        this.faseMov = this.faseMov || 'encarando';
        this.tempoMov = (this.tempoMov || 0) - dt;
        if (this.faseMov === 'encarando') {
          const a = Mat.anguloEntre(this.x, this.y, j.x, j.y);
          this.x += Math.cos(a) * f.velocidade * 0.35 * dt;
          this.y += Math.sin(a) * f.velocidade * 0.35 * dt;
          if (this.tempoMov <= 0) {
            this.faseMov = 'mirando';
            this.tempoMov = this.furioso ? 0.45 : 0.7;
            this.anguloInvestida = Mat.anguloEntre(this.x, this.y, j.x, j.y);
          }
        } else if (this.faseMov === 'mirando') {
          this.anguloInvestida = Mat.misturar(this.anguloInvestida, Mat.anguloEntre(this.x, this.y, j.x, j.y), 0.04);
          this.flash = Math.max(this.flash, 0.25);
          if (this.tempoMov <= 0) { this.faseMov = 'investindo'; this.tempoMov = 0.9; }
        } else {
          this.x += Math.cos(this.anguloInvestida) * f.velocidade * 2.6 * impeto * dt;
          this.y += Math.sin(this.anguloInvestida) * f.velocidade * 2.6 * impeto * dt;
          Particulas.emitir({ x: this.x, y: this.y, vida: 0.3, tam: 9, cor: this.def.cor, brilho: 18, atrito: 0.88 });
          const bateu = this.x <= this.raio || this.x >= Jogo.LARGURA - this.raio
            || this.y <= this.raio || this.y >= Jogo.ALTURA - this.raio;
          if (bateu) { Camera.bater(20); this.executarAtaque('anel'); }
          if (this.tempoMov <= 0 || bateu) {
            this.faseMov = 'encarando';
            this.tempoMov = this.furioso ? 0.5 : 0.9;
          }
        }
        break;
      }
      // Teleporte: pisca para o lado do jogador e cospe um leque ao chegar.
      // Tira a saída fácil de ficar longe girando em volta da arena.
      case 'teleporte': {
        this.tempoMov = (this.tempoMov || 0) - dt;
        const a = Mat.anguloEntre(this.x, this.y, j.x, j.y);
        this.x += Math.cos(a) * f.velocidade * 0.5 * impeto * dt;
        this.y += Math.sin(a) * f.velocidade * 0.5 * impeto * dt;
        if (this.tempoMov <= 0) {
          this.tempoMov = (this.furioso ? 1.5 : 2.4) * Mat.aleatorio(0.85, 1.15);
          Particulas.anel(this.x, this.y, this.def.cor, 80, 34);
          const volta = Math.random() * Mat.TAU;
          this.x = Mat.limitar(j.x + Math.cos(volta) * 300, this.raio, Jogo.LARGURA - this.raio);
          this.y = Mat.limitar(j.y + Math.sin(volta) * 300, this.raio, Jogo.ALTURA - this.raio);
          Particulas.anel(this.x, this.y, this.def.cor, 80, 34);
          Camera.bater(10);
          this.executarAtaque('leque');
        }
        break;
      }
      // Emboscada: pisca para as COSTAS do jogador — atrás de para onde ele
      // está mirando — e abre fogo em todas as direções assim que chega. Quem
      // fica de costas para o meio da arena não tem para onde correr.
      case 'emboscada': {
        this.tempoMov = (this.tempoMov || 0) - dt;
        const a = Mat.anguloEntre(this.x, this.y, j.x, j.y);
        this.x += Math.cos(a) * f.velocidade * 0.45 * impeto * dt;
        this.y += Math.sin(a) * f.velocidade * 0.45 * impeto * dt;
        if (this.tempoMov <= 0) {
          this.tempoMov = (this.furioso ? 0.9 : 1.5) * Mat.aleatorio(0.85, 1.15);
          Particulas.anel(this.x, this.y, this.def.cor, 90, 34);
          // as costas do jogador: o oposto de onde a nave dele aponta
          const costas = (j.angulo || 0) + Math.PI + Mat.aleatorio(-0.35, 0.35);
          const perto = 150 + Math.random() * 90;
          this.x = Mat.limitar(j.x + Math.cos(costas) * perto, this.raio, Jogo.LARGURA - this.raio);
          this.y = Mat.limitar(j.y + Math.sin(costas) * perto, this.raio, Jogo.ALTURA - this.raio);
          Particulas.anel(this.x, this.y, '#ffffff', 110, 36);
          Camera.bater(16);
          Jogo.flashTela(0.22, this.def.cor);
          this.executarAtaque('todosOsLados');
        }
        break;
      }
      // Órbita colada no jogador: ele não sai do seu pé.
      case 'cerco': {
        this.orbita += f.velocidade * 0.9 * impeto * dt;
        const raioCerco = 300 + Math.sin(this.tempoVivo * 0.8) * 90;
        const alvoX = j.x + Math.cos(this.orbita) * raioCerco;
        const alvoY = j.y + Math.sin(this.orbita) * raioCerco;
        this.x = Mat.suave(this.x, Mat.limitar(alvoX, this.raio, Jogo.LARGURA - this.raio), 3.2, dt);
        this.y = Mat.suave(this.y, Mat.limitar(alvoY, this.raio, Jogo.ALTURA - this.raio), 3.2, dt);
        break;
      }
    }
    this.x = Mat.limitar(this.x, this.raio, Jogo.LARGURA - this.raio);
    this.y = Mat.limitar(this.y, this.raio, Jogo.ALTURA - this.raio);

    // ataques
    this.recarga -= dt;
    if (this.recarga <= 0) {
      this.executarAtaque(Mat.escolher(this.ataquesLiberados(f)));
      const ritmo = this.desesperado ? Boss.DESESPERO_RITMO : this.furioso ? Boss.FURIA_RITMO : 1;
      const daFase = Boss.RITMO_FASE[Math.min(this.faseIndice, Boss.RITMO_FASE.length - 1)];
      // 1,6x de intervalo no primeiro boss, 0,85x no último: o começo dá tempo
      // de ler o padrão, o fim não dá.
      const doEncontro = 1.6 - this.dureza * 0.75;
      this.recarga = f.recarga * Boss.RITMO_ATAQUE * daFase * doEncontro * ritmo
        * this.ritmoAscensao / this.aperto / this.pressao * Mat.aleatorio(0.85, 1.15);
    }

    // laser em varredura
    if (this.laser) {
      this.laser.tempo += dt;
      if (this.laser.tempo < this.laser.aviso) {
        this.laser.angulo += this.laser.giro * dt * 0.3;
      } else if (this.laser.tempo < this.laser.aviso + this.laser.duracao) {
        this.laser.angulo += this.laser.giro * dt;
        Jogo.aplicarRaioBoss(this.x, this.y, this.laser.angulo, this.def.cor);
      } else {
        this.laser = null;
      }
    }

    // corpo do boss machuca
    if (Mat.distancia(this.x, this.y, j.x, j.y) < this.raio + j.raio) {
      // encostar no boss dói mais conforme ele troca de fase
      j.receberDano(this.faseIndice >= 2 ? 2 : 1, this.x, this.y);
    }

    // partículas de aura
    if (Mat.chance(0.28)) {
      const a = Math.random() * Mat.TAU;
      Particulas.emitir({
        x: this.x + Math.cos(a) * this.raio, y: this.y + Math.sin(a) * this.raio,
        vx: Math.cos(a) * 40, vy: Math.sin(a) * 40, vida: 0.5, tam: 3,
        cor: this.def.cor, brilho: 14, atrito: 0.9
      });
    }
  }

  // Escudo de fase: nada atravessa enquanto durar. O boss continua andando e
  // atirando, então o tempo de imunidade é tempo de desviar, não de descansar.
  erguerEscudo(segundos) {
    this.imune = Math.max(this.imune || 0, segundos);
    this.imuneMax = this.imune;
    Jogo.aviso('ESCUDO DE FASE — IMUNE');
    Particulas.anel(this.x, this.y, '#8fe3ff', this.raio * 2, 30);
    Camera.bater(12);
    Som.bossEntra();
  }

  // Boss sozinho vira duelo de decorar padrão. A escolta obriga a dividir a
  // atenção — e cresce com a onda.
  chamarEscolta() {
    const quantos = Math.min(3, Math.floor(this.dureza * 3.2));
    for (let i = 0; i < quantos; i++) {
      const a = (Mat.TAU / quantos) * i;
      Jogo.inimigos.push(new Inimigo(
        Mat.escolher(['corredor', 'atirador', 'orbitador', 'lanceiro']),
        Mat.limitar(this.x + Math.cos(a) * 260, 40, Jogo.LARGURA - 40),
        Mat.limitar(this.y + Math.sin(a) * 260, 40, Jogo.ALTURA - 40)
      ));
    }
    Particulas.anel(this.x, this.y, this.def.cor, 120, 40);
  }

  // Boss cedo usa só os primeiros ataques da lista da fase; os outros vão
  // entrando conforme a campanha avança. É isso que faz o mesmo boss parecer
  // outro bicho na onda 15 e na onda 90 — e que mantém a onda 15 legível.
  ataquesLiberados(f) {
    const quantos = Math.max(1, Math.round(1 + this.dureza * (f.ataques.length - 1)));
    return f.ataques.slice(0, quantos);
  }

  // Quantidade de bala por ataque: o mesmo leque tem 5 tiros cedo e 11 no fim.
  // `cheio` é o valor da versão dura; a fração vem da dureza da campanha.
  volume(minimo, cheio) {
    const base = Mat.misturar(minimo, cheio, this.dureza);
    return Math.max(1, Math.round(base * (this.def.volumeExtra || 1) * this.aperto));
  }

  // Tudo que o boss atira passa por aqui: é o ponto onde o CEIFADOR acelera os
  // projéteis dele sem precisar duplicar cada ataque.
  atirar(x, y, angulo, velocidade, dano, cor, raio, extra) {
    const fator = this.def.velocidadeTiro || 1;
    Jogo.tiroInimigo(x, y, angulo, velocidade * fator, dano, cor, raio, extra);
  }

  executarAtaque(tipo) {
    const j = Jogo.alvoJogador(this.x, this.y);
    if (!j) return;
    const angJog = Mat.anguloEntre(this.x, this.y, j.x, j.y);
    switch (tipo) {
      // EXECUÇÃO: a foice do CEIFADOR. Um telegrafo branco, depois três lâminas
      // largas que matam com qualquer quantidade de coração. É para desviar,
      // não para tankar.
      case 'execucao': {
        if (this.execucaoPronta === undefined) this.execucaoPronta = 0;
        Jogo.aviso('⚠ EXECUÇÃO — DESVIE');
        Jogo.flashTela(0.45, '#ffffff');
        Camera.bater(16);
        Som.bossEntra();
        const base = angJog;
        for (let k = 0; k < 3; k++) {
          setTimeout(() => {
            if (!this.vivo) return;
            const alvo = Jogo.alvoJogador(this.x, this.y);
            const a = Mat.anguloEntre(this.x, this.y, alvo.x, alvo.y);
            for (let i = -2; i <= 2; i++) {
              this.atirar(this.x, this.y, a + i * 0.16, 520, 99, '#ffffff', 16, { letal: true });
            }
          }, 620 + k * 260);
        }
        break;
      }
      case 'unico':
        for (let i = 0; i < 3; i++) {
          setTimeout(() => {
            if (this.vivo) this.atirar(this.x, this.y, Mat.anguloEntre(this.x, this.y, j.x, j.y), 480, 1, this.def.cor, 9);
          }, i * 130);
        }
        break;
      case 'leque3':
        for (let i = -1; i <= 1; i++) this.atirar(this.x, this.y, angJog + i * 0.24, 430, 1, this.def.cor, 9);
        break;
      case 'leque': {
        const n = this.volume(5, 11);
        for (let i = 0; i < n; i++) {
          const a = angJog + Mat.misturar(-0.85, 0.85, i / (n - 1));
          this.atirar(this.x, this.y, a, 400, 1, this.def.cor, 8);
        }
        break;
      }
      case 'anel': {
        const n = this.volume(12, 26);
        for (let i = 0; i < n; i++) this.atirar(this.x, this.y, (Mat.TAU / n) * i + this.tempoVivo, 320, 1, this.def.cor, 8);
        Camera.bater(6);
        break;
      }
      case 'espiral': {
        this.anguloEspiral += 0.42;
        const bracos = this.volume(2, 3);
        for (let b = 0; b < bracos; b++) {
          this.atirar(this.x, this.y, this.anguloEspiral + (Mat.TAU / bracos) * b, 330, 1, this.def.cor, 8);
        }
        break;
      }
      case 'laser':
        this.laser = { tempo: 0, aviso: (this.furioso ? 0.55 : 0.75) + (1 - this.dureza) * 0.35, duracao: 2.1,
          angulo: angJog - 0.6, giro: 1.5 * (Mat.chance(0.5) ? 1 : -1) };
        Som.bossEntra();
        break;
      // Caçador: tiros lentos que perseguem por 2,5 s. Não dá para só andar
      // reto — tem que quebrar a linha com dash ou com o canto da arena.
      case 'cacador': {
        const n = this.desesperado ? 5 : this.volume(2, 3);
        for (let i = 0; i < n; i++) {
          this.atirar(this.x, this.y, angJog + (i - (n - 1) / 2) * 0.5, 230, 1, this.def.cor, 9,
            { perseguePor: 2.5 });
        }
        break;
      }
      // Minas: nega o espaço. Ficam paradas, piscando, e abrem um anel.
      case 'minas': {
        const n = this.volume(2, 4) + this.faseIndice;
        for (let i = 0; i < n; i++) {
          const a = (Mat.TAU / n) * i + Math.random();
          const d = 200 + Math.random() * 260;
          this.atirar(
            Mat.limitar(this.x + Math.cos(a) * d, 40, Jogo.LARGURA - 40),
            Mat.limitar(this.y + Math.sin(a) * d, 40, Jogo.ALTURA - 40),
            0, 0, 1, this.def.cor, 11, { explodeEm: this.furioso ? 1.4 : 2, estilhacos: 10 });
        }
        break;
      }
      // Dois anéis girados um contra o outro: bala para todo lado, sem brecha
      // confortável. É o ataque de assinatura da emboscada.
      case 'todosOsLados': {
        const n = this.volume(14, 22);
        for (let i = 0; i < n; i++) {
          const a = (Mat.TAU / n) * i + this.tempoVivo;
          this.atirar(this.x, this.y, a, 330, 1, this.def.cor, 8);
          this.atirar(this.x, this.y, a + Math.PI / n, 220, 1, this.def.cor, 7);
        }
        Camera.bater(8);
        break;
      }
      // Parede de tiros com uma única brecha: obriga a achar o buraco e passar.
      case 'parede': {
        const n = this.volume(18, 32);
        const brecha = Math.random() * Mat.TAU;
        const largura = this.furioso ? 0.5 : 0.75;
        for (let i = 0; i < n; i++) {
          const a = (Mat.TAU / n) * i;
          if (Math.abs(Mat.normalizarAngulo(a - brecha)) < largura) continue;
          this.atirar(this.x, this.y, a, 300, 1, this.def.cor, 9);
        }
        Camera.bater(8);
        break;
      }
      // Cruz giratória: quatro braços que varrem a arena inteira.
      case 'cruz': {
        this.anguloEspiral += 0.3;
        const bracos = this.volume(2, 4);
        const porBraco = this.volume(2, 3);
        for (let b = 0; b < bracos; b++) {
          const a = this.anguloEspiral + (Mat.TAU / bracos) * b;
          for (let k = 1; k <= porBraco; k++) this.atirar(this.x, this.y, a, 260 + k * 70, 1, this.def.cor, 8);
        }
        break;
      }
      // Tiro de precisão: mira onde o jogador VAI estar, não onde está.
      case 'precisao': {
        const prev = 0.42;
        const alvoX = j.x + j.vx * prev, alvoY = j.y + j.vy * prev;
        const a = Mat.anguloEntre(this.x, this.y, alvoX, alvoY);
        for (let i = -1; i <= 1; i++) this.atirar(this.x, this.y, a + i * 0.1, 620, 1, this.def.cor, 7);
        break;
      }
      // Chuva: cai uma cortina do topo da arena, some o lugar seguro parado.
      case 'chuva': {
        const colunas = this.volume(7, 13);
        for (let i = 0; i < colunas; i++) {
          if (Mat.chance(0.22)) continue;   // buracos por onde dá para correr
          const x = (Jogo.LARGURA / colunas) * (i + 0.5);
          this.atirar(x, -20, Math.PI / 2, 340, 1, this.def.cor, 8);
        }
        break;
      }
      case 'invocar': {
        const quantos = this.volume(1, 2) + this.faseIndice;
        for (let i = 0; i < quantos; i++) {
          const a = Math.random() * Mat.TAU;
          // Elenco do ato: em NÁDIR o boss não pode chamar bicho da Arena, que
          // ficou do outro lado da fenda. `convoca` na def manda, se existir.
          const elenco = this.def.convoca || (Jogo.ato() === 2
            ? ['larvaNadir', 'costelaViva', 'vigiaDoTrono']
            : ['corredor', 'atirador', 'kamikaze', 'lanceiro', 'enxame']);
          Jogo.inimigos.push(new Inimigo(
            Mat.escolher(elenco),
            this.x + Math.cos(a) * (this.raio + 40),
            this.y + Math.sin(a) * (this.raio + 40)
          ));
        }
        Particulas.anel(this.x, this.y, this.def.cor, 90, 30);
        break;
      }
    }
  }

  receberDano(q, crit, fx, fy) {
    if (!this.vivo || this.entrando > 0) return;
    // Invencível de verdade: a barra não existe para ser reduzida. Nem o
    // TRAÇANTE, nem crítico somado, nem dano por segundo — nada entra aqui.
    if (this.def.invencivel) {
      this.absorveu = 0.3;
      if (fx !== undefined && Mat.chance(0.12)) {
        Textos.criar(fx, fy, 'IMUNE', '#f4f6ff', 15);
        Particulas.faisca(fx, fy, Math.random() * Mat.TAU, '#f4f6ff');
      }
      return;
    }
    if (this.imune > 0) {
      this.absorveu = 0.3;
      if (fx !== undefined && Mat.chance(0.3)) Particulas.faisca(fx, fy, Math.random() * Mat.TAU, '#8fe3ff');
      return;
    }
    if (this.def.tetoDeDano) {
      const teto = this.vidaMax * this.def.tetoDeDano;
      if (q > teto) {
        q = teto;
        this.absorveu = 0.4;   // brilho de couraça: o excesso não passou
      }
    }
    // Teto por segundo: é ele que fecha a conta. Um acerto sozinho já era
    // limitado, mas uma build de muitos projéteis somava acertos até passar da
    // regeneração. Agora a barra tem um máximo de dano por segundo, e esse
    // máximo é menor que o quanto ela recupera no mesmo segundo.
    if (this.def.tetoPorSegundo) {
      const agora = Jogo.tempoJogo;
      if (agora - (this.janelaDano || 0) >= 1) { this.janelaDano = agora; this.danoNaJanela = 0; }
      const restante = Math.max(0, this.vidaMax * this.def.tetoPorSegundo - (this.danoNaJanela || 0));
      if (q > restante) { q = restante; this.absorveu = 0.4; }
      this.danoNaJanela = (this.danoNaJanela || 0) + q;
      if (q <= 0) { this.flash = 0.25; return; }
    }
    this.vida -= q;
    this.flash = 0.25;
    Camera.bater(crit ? 5 : 2);
    if (fx !== undefined) Particulas.faisca(fx, fy, Math.random() * Mat.TAU, this.def.cor);
    Textos.criar(fx || this.x, fy || this.y, Math.round(q) + (crit ? '!' : ''), crit ? '#fff27a' : '#ffffff', crit ? 22 : 15);
    if (this.vida <= 0) this.morrer();
  }

  morrer() {
    this.vivo = false;
    Jogo.comemorar67(this.def);
    Som.proximaTrilha();
    Jogo.pararTempo(0.5);
    Camera.bater(34);
    Camera.pulsar(1.1);
    Jogo.flashTela(0.8, '#ffffff');
    Som.bossMorre();
    for (let i = 0; i < 4; i++) {
      setTimeout(() => {
        Particulas.explosao(this.x + Mat.aleatorio(-60, 60), this.y + Mat.aleatorio(-60, 60), this.def.cor, 18, 480, 0.8, 6);
        Camera.bater(8);
      }, i * 140);
    }
    Jogo.bossDerrotado(this);
  }

  desenhar(ctx) {
    // Escudo de fase: bolha hexagonal girando, que encolhe conforme o tempo
    // de imunidade acaba.
    if (this.imune > 0) {
      const p = Mat.limitar(this.imune / (this.imuneMax || 1), 0, 1);
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(Jogo.tempo * 1.6);
      ctx.strokeStyle = '#8fe3ff';
      ctx.lineWidth = 3 + p * 3;
      ctx.globalAlpha = 0.35 + p * 0.45;
      ctx.shadowBlur = Jogo.modoLeve ? 0 : 24; ctx.shadowColor = '#8fe3ff';
      const r = this.raio + 26;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Mat.TAU / 6) * i;
        const px = Math.cos(a) * r, py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    // Couraça acesa quando o acerto foi maior que o teto: o jogador vê que o
    // dano bateu e não entrou.
    if (this.absorveu > 0) {
      ctx.save();
      ctx.globalAlpha = Mat.limitar(this.absorveu, 0, 1) * 0.8;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 6;
      ctx.shadowBlur = Jogo.modoLeve ? 0 : 26; ctx.shadowColor = this.def.cor;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.raio + 16, 0, Mat.TAU);
      ctx.stroke();
      ctx.restore();
    }

    const d = this.def;
    // telegrafo de fase
    if (this.telegrafo > 0) {
      ctx.save();
      ctx.globalAlpha = 0.5 + Math.sin(Jogo.tempo * 30) * 0.3;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.raio * 1.6, 0, Mat.TAU);
      ctx.stroke();
      ctx.restore();
    }

    // laser
    if (this.laser) {
      const avisando = this.laser.tempo < this.laser.aviso;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.laser.angulo);
      ctx.globalAlpha = avisando ? 0.25 + Math.sin(Jogo.tempo * 30) * 0.15 : 0.9;
      const largura = avisando ? 6 : 30 + Math.sin(Jogo.tempo * 40) * 6;
      const g = ctx.createLinearGradient(0, 0, 2200, 0);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.2, d.cor);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.shadowBlur = Jogo.modoLeve ? 0 : 40; ctx.shadowColor = d.cor;
      ctx.fillRect(0, -largura / 2, 2200, largura);
      ctx.restore();
    }

    ctx.save();
    ctx.translate(this.x, this.y);

    // anéis externos
    for (let k = 0; k < 3; k++) {
      ctx.save();
      ctx.rotate(this.angulo * (k % 2 ? -1 : 1) * (1 + k * 0.4));
      ctx.strokeStyle = d.cor;
      ctx.globalAlpha = 0.35 - k * 0.08;
      ctx.lineWidth = 3;
      ctx.shadowBlur = 24; ctx.shadowColor = d.cor;
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) {
        const a = (Mat.TAU / 6) * i;
        const r = this.raio * (1.35 + k * 0.28);
        ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.stroke();
      ctx.restore();
    }

    // corpo
    ctx.rotate(-this.angulo * 0.6);
    ctx.shadowBlur = 40; ctx.shadowColor = d.cor;
    ctx.beginPath();
    for (let i = 0; i < d.lados; i++) {
      const a = (Mat.TAU / d.lados) * i;
      ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * this.raio, Math.sin(a) * this.raio);
    }
    ctx.closePath();
    const g = ctx.createRadialGradient(0, 0, this.raio * 0.1, 0, 0, this.raio);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.12, d.cor);
    g.addColorStop(0.75, d.cor);
    g.addColorStop(1, d.cor2);
    ctx.fillStyle = this.flash > 0 ? '#ffffff' : g;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ffffff';
    ctx.globalAlpha = 0.8;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // olho
    const olhoAng = Mat.anguloEntre(this.x, this.y, Jogo.jogador.x, Jogo.jogador.y) + this.angulo * 0.6;
    /* Boss-ruína tem olho pequeno: no meio do corpo dele mora a letra da classe
       que ele foi, e olho do tamanho normal engolia a letra — as duas coisas
       juntas viravam uma bola preta sem leitura. */
    const rOlho = d.glifo ? 0.18 : 0.42;
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#08070d';
    ctx.beginPath();
    ctx.arc(0, 0, this.raio * rOlho, 0, Mat.TAU);
    ctx.fill();
    ctx.fillStyle = d.cor;
    ctx.shadowBlur = 30; ctx.shadowColor = d.cor;
    ctx.beginPath();
    ctx.arc(Math.cos(olhoAng) * this.raio * rOlho * 0.34, Math.sin(olhoAng) * this.raio * rOlho * 0.34,
      this.raio * rOlho * 0.48, 0, Mat.TAU);
    ctx.fill();

    /* Marca de NÁDIR: fissuras atravessando o corpo e, nos bosses que foram
       Condutores, a letra da classe apodrecida no meio. É o que faz a RUÍNA DO
       SNIPER parecer o SNIPER morto e não um polígono roxo qualquer. */
    if (d.ato === 2) {
      ctx.save();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(0,0,0,.45)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = (Mat.TAU / 4) * i + 0.4;
        ctx.moveTo(Math.cos(a) * this.raio * 0.2, Math.sin(a) * this.raio * 0.2);
        ctx.lineTo(Math.cos(a + 0.5) * this.raio * 0.96, Math.sin(a + 0.5) * this.raio * 0.96);
      }
      ctx.stroke();
      if (d.glifo) {
        /* A letra é ESCURA, não clara: o corpo do boss tem o centro quase
           branco, e letra branca em cima de branco simplesmente não aparece —
           foi o primeiro jeito que tentei e na tela não existia. Escura, ela
           lê como marca queimada no casco. */
        ctx.globalAlpha = 0.62 + Math.sin(Jogo.tempo * 1.3) * 0.1;
        ctx.font = '900 ' + Math.round(this.raio * 1.05) + 'px Orbitron, Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#0a0612';
        ctx.fillText(d.glifo, 0, this.raio * 0.04);
        // Contorno claro só para a letra não sumir quando o corpo escurece na
        // borda: a marca tem de aparecer no claro e no escuro.
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ffffff';
        ctx.strokeText(d.glifo, 0, this.raio * 0.04);
      }
      ctx.restore();
    }

    ctx.restore();
  }
}

/* ============================= COLETÁVEIS =============================== */
const TIPOS_COLETAVEL = {
  xp: { cor: '#8fe3ff', raio: 6, brilho: 14 },
  moeda: { cor: '#ffd34d', raio: 9, brilho: 18 },
  vida: { cor: '#ff4d6d', raio: 12, brilho: 22, icone: '❤' },
  bomba: { cor: '#ffd34d', raio: 12, brilho: 22, icone: '✹' },
  ima: { cor: '#b06dff', raio: 12, brilho: 22, icone: '◈' },
  frenesi: { cor: '#5cff9d', raio: 12, brilho: 22, icone: '⚡' }
};

class Coletavel {
  constructor(tipo, x, y, valor) {
    this.id = Jogo.proximoId();
    this.tipo = tipo;
    this.def = TIPOS_COLETAVEL[tipo];
    this.x = x; this.y = y;
    this.valor = valor || 1;
    this.vx = Mat.aleatorio(-70, 70);
    this.vy = Mat.aleatorio(-70, 70);
    this.vida = (tipo === 'xp' || tipo === 'moeda') ? 18 : 22;
    this.fase = Math.random() * Mat.TAU;
    this.vivo = true;
  }

  atualizar(dt) {
    this.vida -= dt;
    if (this.vida <= 0) { this.vivo = false; return; }
    const j = Jogo.jogadorMaisProximo(this.x, this.y, false);
    if (!j) return;
    const d = Mat.distancia(this.x, this.y, j.x, j.y);
    const raioIma = (this.tipo === 'xp' || this.tipo === 'moeda') ? j.attr.ima : 90;
    if (d < raioIma || Jogo.imaGlobal > 0) {
      const a = Mat.anguloEntre(this.x, this.y, j.x, j.y);
      const forca = Jogo.imaGlobal > 0 ? 900 : Mat.misturar(700, 180, d / raioIma);
      this.vx = Mat.suave(this.vx, Math.cos(a) * forca, 8, dt);
      this.vy = Mat.suave(this.vy, Math.sin(a) * forca, 8, dt);
    } else {
      // atração fraca de longe: o XP sempre chega, mas devagar
      const a = Mat.anguloEntre(this.x, this.y, j.x, j.y);
      this.vx = Mat.suave(this.vx, Math.cos(a) * 85, 2, dt);
      this.vy = Mat.suave(this.vy, Math.sin(a) * 85, 2, dt);
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.x = Mat.limitar(this.x, 8, Jogo.LARGURA - 8);
    this.y = Mat.limitar(this.y, 8, Jogo.ALTURA - 8);

    if (d < j.raio + this.def.raio + 4) this.coletar(j);
  }

  coletar(j = Jogo.jogador) {
    this.vivo = false;
    if (this.tipo === 'xp') {
      for (const jogador of Jogo.jogadores()) jogador.ganharXP(this.valor);
      Som.xp();
      Particulas.emitir({ x: this.x, y: this.y, vida: 0.3, tam: 5, cor: this.def.cor, brilho: 16, atrito: 0.9 });
      return;
    }
    if (this.tipo === 'moeda') {
      Carteira.ganhar(this.valor);
      Som.moeda();
      Particulas.emitir({ x: this.x, y: this.y, vida: 0.35, tam: 4, cor: this.def.cor, brilho: 18, atrito: 0.9 });
      return;
    }
    Som.pegar();
    Particulas.anel(this.x, this.y, this.def.cor, 40, 18);
    if (this.tipo === 'vida') { j.curar(1); }
    else if (this.tipo === 'bomba') { Jogo.bombaDeTela(); }
    else if (this.tipo === 'ima') { Jogo.imaGlobal = 3; Jogo.aviso('ÍMÃ ATIVADO'); }
    else if (this.tipo === 'frenesi') { j.frenesi = 8; Jogo.aviso('FRENESI — CADÊNCIA DOBRADA'); }
  }

  desenhar(ctx) {
    const flutua = Math.sin(Jogo.tempo * 5 + this.fase) * 3;
    const piscando = this.vida < 3 && Math.floor(this.vida * 8) % 2 === 0;
    ctx.save();
    ctx.globalAlpha = piscando ? 0.35 : 1;
    ctx.translate(this.x, this.y + flutua);
    ctx.shadowBlur = this.def.brilho; ctx.shadowColor = this.def.cor;
    ctx.fillStyle = this.def.cor;
    if (this.tipo === 'moeda') {
      // Gira de verdade: a largura encolhe e volta, como moeda rodando de pé.
      const giro = Math.cos(Jogo.tempo * 4 + this.fase);
      ctx.scale(Math.max(0.12, Math.abs(giro)), 1);
      ctx.beginPath();
      ctx.arc(0, 0, this.def.raio, 0, Mat.TAU);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#8a6100';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, this.def.raio * 0.58, 0, Mat.TAU);
      ctx.stroke();
      ctx.fillStyle = '#8a6100';
      ctx.font = '900 10px Rajdhani, Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', 0, 1);
      ctx.restore();
      return;
    }
    if (this.tipo === 'xp') {
      ctx.rotate(Jogo.tempo * 3 + this.fase);
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = (Mat.TAU / 4) * i;
        ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * this.def.raio, Math.sin(a) * this.def.raio * 1.4);
      }
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, this.def.raio + Math.sin(Jogo.tempo * 8 + this.fase) * 1.5, 0, Mat.TAU);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#0b0d14';
      ctx.font = '900 13px Rajdhani, Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.def.icone, 0, 1);
    }
    ctx.restore();
  }
}
