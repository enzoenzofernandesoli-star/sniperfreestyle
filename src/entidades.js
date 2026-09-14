/* ===========================================================================
   ENTIDADES.JS — Jogador, Projétil, Inimigos, Bosses, Coletáveis.
   =========================================================================== */

// Só os projéteis disparados pelo jogador usam esta paleta.
const CORES_TIRO = Object.freeze({
  jogador: '#dcff46', critico: '#ffffff'
});

/* =============================== JOGADOR ================================ */
class Jogador {
  constructor(classeId, skinId) {
    this.classe = classePorId(classeId);
    this.skin = skinDaClasse(classeId, skinId);
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
    this.xpProximo = 50;
    this.melhorias = {};
    this.multXP = 1;
    this.explodeAoMatar = 0;
    this.dashCongela = 0;
    this.vampirismo = 0;
    this.espinhos = 0;

    this.orbes = [];
    this.sincronizarOrbes();
    this.rastro = [];
    this.recuo = 0;
  }

  sincronizarOrbes() {
    this.orbes = [];
    for (let i = 0; i < this.attr.orbes; i++) {
      this.orbes.push({ angulo: (Mat.TAU / Math.max(1, this.attr.orbes)) * i, distancia: 62, raio: 11, cooldown: 0 });
    }
  }

  get escudoAtivo() { return this.escudoRestante > 0; }
  get intangivel() { return this.invulneravel > 0 || this.dashRestante > 0 || this.ultAtiva > 0 && this.classe.id === 'espectro'; }

  /* --------------------------- Atualização --------------------------- */
  atualizar(dt) {
    // mira: joystick de mira > mira automática (toque) > mouse
    const forcaMira = Math.hypot(Input.mira.x, Input.mira.y);
    let alvo;
    if (Input.mira.ativo && forcaMira > 0.22) {
      alvo = Math.atan2(Input.mira.y, Input.mira.x);
    } else if (Input.modoToque) {
      const inimigo = Jogo.inimigoMaisProximo(this.x, this.y, 1400);
      alvo = inimigo ? Mat.anguloEntre(this.x, this.y, inimigo.x, inimigo.y) : this.angulo;
    } else {
      alvo = Mat.anguloEntre(this.x, this.y, Input.mouseX, Input.mouseY);
    }
    this.angulo = this.angulo + Mat.normalizarAngulo(alvo - this.angulo) * Math.min(1, 18 * dt);

    // movimento
    const ex = Input.eixoX(), ey = Input.eixoY();
    const mag = Math.hypot(ex, ey) || 1;
    const alvoVX = (ex / mag) * this.attr.velocidade * (Math.hypot(ex, ey) > 0 ? 1 : 0);
    const alvoVY = (ey / mag) * this.attr.velocidade * (Math.hypot(ex, ey) > 0 ? 1 : 0);

    if (this.dashRestante > 0) {
      this.dashRestante -= dt;
      this.x += this.dashVX * dt;
      this.y += this.dashVY * dt;
      if (Mat.chance(0.9)) {
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

    // rastro fantasma
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
    }

    // regeneração
    if (this.attr.regen > 0 && this.vida < this.attr.vidaMax) {
      this.vida = Math.min(this.attr.vidaMax, this.vida + this.attr.regen * dt);
    }

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
      if (Mat.chance(0.4)) {
        Particulas.emitir({ x: ox, y: oy, vida: 0.25, tam: 3, cor: this.classe.cor, brilho: 12, atrito: 0.9 });
      }
    }

    // ações
    if (Input.atirando() && this.recargaTiro <= 0) this.atirar();
    if (Input.apertou('Space')) this.dash();
    if (Input.apertou('KeyQ') || Input.apertou('CapsLock')) this.ativarEscudo();
    if (Input.apertou('KeyE') || Input.apertou('ShiftLeft') || Input.botaoDireito) this.ativarUlt();
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
  dash() {
    if (this.dashCarga < this.attr.dashRecarga) return;
    this.dashCarga = 0;
    this.dashRestante = 0.16;
    const ex = Input.eixoX(), ey = Input.eixoY();
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
    if (this.dashCongela > 0) Jogo.congelarTempo(this.dashCongela);
  }

  cortarNoDash() {
    for (const e of Jogo.inimigos) {
      if (e._cortado) continue;
      if (Mat.distancia(this.x, this.y, e.x, e.y) < this.raio + e.raio + 12) {
        e._cortado = true;
        Jogo.danificarInimigo(e, this.attr.dano * 2.2, true, this.x, this.y);
        setTimeout(() => { e._cortado = false; }, 260);
      }
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

    if (this.classe.id === 'sniper') {
      // raio perfurante gigante
      Jogo.raios.push({ x: this.x, y: this.y, angulo: this.angulo, vida: 0.5, vidaMax: 0.5, largura: 26, dano: this.attr.dano * 6, cor: this.classe.cor });
      Jogo.aplicarRaio(this.x, this.y, this.angulo, this.attr.dano * 6);
    } else if (this.classe.id === 'guardiao') {
      // onda de choque expansiva
      Jogo.ondasChoque.push({ x: this.x, y: this.y, raio: 10, raioMax: 460, dano: this.attr.dano * 3.2, cor: this.classe.cor, atingidos: new Set(), empurrao: 900 });
    } else if (this.classe.id === 'espectro') {
      this.ultAtiva = 3;
      this.invulneravel = Math.max(this.invulneravel, 3);
    } else {
      // singularidade: suga e explode
      Jogo.singularidades.push({ x: this.x, y: this.y, vida: 2.2, vidaMax: 2.2, raio: 300, dano: this.attr.dano * 7, cor: this.classe.cor, explodiu: false });
    }
  }

  tickUlt(dt) {
    if (this.classe.id === 'espectro') {
      this.cortarNoDash();
      if (Mat.chance(0.8)) {
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
    Particulas.explosao(this.x, this.y, '#ff3355', 22, 320, 0.6, 4);
    if (fonteX !== undefined) {
      const a = Mat.anguloEntre(fonteX, fonteY, this.x, this.y);
      this.vx += Math.cos(a) * 320;
      this.vy += Math.sin(a) * 320;
    }
    if (this.vida <= 0) Jogo.derrota();
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
      this.xpProximo = Math.round(50 * Math.pow(1.38, this.nivel - 1));
      Jogo.filaDeMelhorias++;
    }
  }

  aplicarMelhoria(m) {
    this.melhorias[m.id] = (this.melhorias[m.id] || 0) + 1;
    m.aplicar(this);
    Som.subirNivel();
    Particulas.anel(this.x, this.y, COR_RARIDADE[m.raridade], 50, 30);
  }

  /* ----------------------------- Desenho ----------------------------- */
  desenhar(ctx) {
    const cor = this.skin.cor;
    const cor2 = this.skin.cor2;
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

    // arma
    ctx.shadowBlur = 18; ctx.shadowColor = cor;
    ctx.fillStyle = '#e9f6ff';
    ctx.fillRect(this.raio - 2 - this.recuo, -4, 22, 8);
    ctx.fillStyle = cor2;
    ctx.fillRect(this.raio + 12 - this.recuo, -6, 7, 12);

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
    ctx.restore();

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
    this.critico = !!cfg.critico;
    this.alcance = cfg.alcance || 0;
    this.percorrido = 0;
    this.vivo = true;
    this.atingidos = [];
    this.rastro = [];
    this.giro = 0;
  }

  atualizar(dt) {
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
    nome: 'CORREDOR', cor: '#ff5470', cor2: '#7a0f27', raio: 17, vida: 22, velocidade: 145,
    dano: 1, xp: 6, pontos: 10, lados: 3, comportamento: 'perseguir', desde: 1
  },
  bruto: {
    nome: 'BRUTO', cor: '#ff8c42', cor2: '#7a3a0f', raio: 30, vida: 95, velocidade: 70,
    dano: 1, xp: 18, pontos: 30, lados: 6, comportamento: 'perseguir', desde: 3, resiste: 0.65
  },
  atirador: {
    nome: 'ATIRADOR', cor: '#c874ff', cor2: '#4b177a', raio: 19, vida: 38, velocidade: 110,
    dano: 1, xp: 14, pontos: 25, lados: 5, comportamento: 'atirar', desde: 2,
    distanciaIdeal: 320, recarga: 2.6, projetilVel: 340
  },
  kamikaze: {
    nome: 'KAMIKAZE', cor: '#ffe14d', cor2: '#7a6a0f', raio: 15, vida: 18, velocidade: 250,
    dano: 1, xp: 12, pontos: 22, lados: 4, comportamento: 'kamikaze', desde: 5, raioExplosao: 80
  },
  divisor: {
    nome: 'DIVISOR', cor: '#4dffc3', cor2: '#0f7a5c', raio: 24, vida: 58, velocidade: 100,
    dano: 1, xp: 16, pontos: 28, lados: 8, comportamento: 'perseguir', desde: 6, divideEm: 2
  },
  orbitador: {
    nome: 'ORBITADOR', cor: '#4da6ff', cor2: '#0f3d7a', raio: 20, vida: 50, velocidade: 170,
    dano: 1, xp: 18, pontos: 32, lados: 7, comportamento: 'orbitar', desde: 6,
    distanciaIdeal: 240, recarga: 2.1, projetilVel: 290
  },
  couraca: {
    nome: 'COURAÇA', cor: '#9aa7b5', cor2: '#3a4450', raio: 26, vida: 75, velocidade: 92,
    dano: 1, xp: 22, pontos: 40, lados: 4, comportamento: 'perseguir', desde: 9,
    escudoFrontal: true
  }
};

class Inimigo {
  constructor(tipo, x, y, escala) {
    const t = TIPOS_INIMIGO[tipo];
    this.tipo = tipo;
    this.def = t;
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.escala = escala || 1;
    this.raio = t.raio * this.escala;
    this.vidaMax = t.vida * this.escala * Jogo.multiplicadorVida();
    this.vida = this.vidaMax;
    this.velocidade = t.velocidade * Mat.aleatorio(0.9, 1.1);
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
  }

  atualizar(dt) {
    if (this.nascendo > 0) {
      this.nascendo -= dt;
      this.angulo += this.giro * dt * 3;
      return;
    }
    this.flash = Math.max(0, this.flash - dt * 4);
    this.angulo += this.giro * dt;
    const j = Jogo.jogador;
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
          this.recarga = this.def.recarga * Mat.aleatorio(0.85, 1.15);
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
          this.recarga = this.def.recarga;
          for (let i = -1; i <= 1; i++) {
            Jogo.tiroInimigo(this.x, this.y, angJog + i * 0.28, this.def.projetilVel, this.def.dano, this.def.cor);
          }
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
          if (this.timerEstado <= 0 || dist < this.raio + Jogo.jogador.raio + 6) this.explodir();
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
      } else if (j.receberDano(this.def.dano, this.x, this.y)) {
        if (j.espinhos > 0) Jogo.danificarInimigo(this, j.espinhos, false, j.x, j.y);
        if (this.def.comportamento === 'kamikaze') this.explodir();
      }
    }
  }

  explodir() {
    if (!this.vivo) return;
    this.vivo = false;
    Particulas.explosao(this.x, this.y, this.def.cor, 34, 460, 0.7, 5);
    Particulas.anel(this.x, this.y, '#ffe14d', 60, 26);
    Camera.bater(9);
    Som.morteInimigo();
    const j = Jogo.jogador;
    if (Mat.distancia(this.x, this.y, j.x, j.y) < this.def.raioExplosao + j.raio) {
      j.receberDano(this.def.dano, this.x, this.y);
    }
    Jogo.marcarMorte(this, false);
  }

  morrer(porTiro) {
    if (!this.vivo) return;
    this.vivo = false;
    Particulas.explosao(this.x, this.y, this.def.cor, 20 + Math.floor(this.raio), 340, 0.6, 4);
    Particulas.anel(this.x, this.y, this.def.cor, this.raio * 1.4, 14);
    Camera.bater(3.5);
    Som.morteInimigo();

    // divisor gera filhotes
    if (this.def.divideEm && this.escala > 0.6) {
      for (let i = 0; i < this.def.divideEm; i++) {
        const a = (Mat.TAU / this.def.divideEm) * i;
        const f = new Inimigo('divisor', this.x + Math.cos(a) * 26, this.y + Math.sin(a) * 26, this.escala * 0.55);
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

    ctx.rotate(this.angulo);
    ctx.shadowBlur = Jogo.modoLeve ? 0 : 20;
    ctx.shadowColor = t.cor;

    // corpo poligonal
    const lados = t.lados;
    ctx.beginPath();
    for (let i = 0; i < lados; i++) {
      const a = (Mat.TAU / lados) * i;
      const r = this.raio * (this.estado === 'carregando' ? 1 + Math.sin(Jogo.tempo * 40) * 0.12 : 1);
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

    // escudo frontal da couraça
    if (t.escudoFrontal) {
      const angJog = Mat.anguloEntre(this.x, this.y, Jogo.jogador.x, Jogo.jogador.y);
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(angJog);
      ctx.strokeStyle = '#dfe9f5';
      ctx.lineWidth = 5;
      ctx.shadowBlur = Jogo.modoLeve ? 0 : 14; ctx.shadowColor = '#dfe9f5';
      ctx.beginPath();
      ctx.arc(0, 0, this.raio + 8, -0.9, 0.9);
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
      { movimento: 'horizontal', velocidade: 190, ataques: ['unico'], recarga: 1.1 },
      { movimento: 'horizontal', velocidade: 260, ataques: ['unico', 'leque3'], recarga: 0.85 },
      { movimento: 'perseguir', velocidade: 190, ataques: ['leque3', 'anel'], recarga: 0.7 }
    ]
  },
  {
    id: 'serpente',
    nome: 'SERPENTE DE VÍDEO',
    titulo: 'A Onda que Não Quebra',
    cor: '#00e5ff', cor2: '#00485c',
    raio: 58, vida: 1800, lados: 5,
    fases: [
      { movimento: 'senoidal', velocidade: 240, ataques: ['leque'], recarga: 1.5 },
      { movimento: 'senoidal', velocidade: 320, ataques: ['leque', 'unico'], recarga: 1.0 },
      { movimento: 'senoidal', velocidade: 400, ataques: ['leque', 'anel', 'invocar'], recarga: 0.8 }
    ]
  },
  {
    id: 'olho',
    nome: 'OLHO DO VAZIO',
    titulo: 'Aquele que Espirala',
    cor: '#b06dff', cor2: '#3a0d63',
    raio: 66, vida: 3000, lados: 8,
    fases: [
      { movimento: 'circular', velocidade: 1.0, ataques: ['espiral'], recarga: 0.14 },
      { movimento: 'circular', velocidade: 1.5, ataques: ['espiral', 'leque'], recarga: 0.12 },
      { movimento: 'circular', velocidade: 2.0, ataques: ['espiral', 'anel', 'invocar'], recarga: 0.1 }
    ]
  },
  {
    id: 'arquiteto',
    nome: 'O ARQUITETO',
    titulo: 'Fim da Linha',
    cor: '#ffd34d', cor2: '#6b4a00',
    raio: 74, vida: 4900, lados: 3,
    fases: [
      { movimento: 'perseguir', velocidade: 175, ataques: ['leque', 'laser'], recarga: 1.2 },
      { movimento: 'senoidal', velocidade: 340, ataques: ['espiral', 'anel'], recarga: 0.4 },
      { movimento: 'circular', velocidade: 2.0, ataques: ['laser', 'invocar', 'leque'], recarga: 0.6 },
      { movimento: 'caotico', velocidade: 420, ataques: ['espiral', 'anel', 'laser', 'invocar'], recarga: 0.35 }
    ]
  },
  {
    id: 'ferreiro', nome: 'FERREIRO SOLAR', titulo: 'Forja em Colapso',
    cor: '#ff8e45', cor2: '#7a2909', raio: 65, vida: 5100, lados: 6,
    fases: [
      { movimento: 'horizontal', velocidade: 250, ataques: ['leque3', 'anel'], recarga: 0.9 },
      { movimento: 'perseguir', velocidade: 215, ataques: ['leque', 'invocar'], recarga: 0.8 },
      { movimento: 'caotico', velocidade: 330, ataques: ['laser', 'anel'], recarga: 0.7 }
    ]
  },
  {
    id: 'oraculo', nome: 'ORÁCULO DE JADE', titulo: 'Geometria Viva',
    cor: '#56f0b0', cor2: '#176451', raio: 61, vida: 5600, lados: 8,
    fases: [
      { movimento: 'circular', velocidade: 1.1, ataques: ['espiral', 'unico'], recarga: 0.26 },
      { movimento: 'senoidal', velocidade: 280, ataques: ['leque', 'anel'], recarga: 0.85 },
      { movimento: 'circular', velocidade: 1.8, ataques: ['espiral', 'invocar', 'laser'], recarga: 0.45 }
    ]
  },
  {
    id: 'eclipse', nome: 'ECLIPSE FANTASMA', titulo: 'Luz Devorada',
    cor: '#8d83ff', cor2: '#33226e', raio: 70, vida: 6200, lados: 5,
    fases: [
      { movimento: 'senoidal', velocidade: 300, ataques: ['leque3', 'laser'], recarga: 0.95 },
      { movimento: 'caotico', velocidade: 350, ataques: ['anel', 'invocar'], recarga: 0.65 },
      { movimento: 'perseguir', velocidade: 250, ataques: ['espiral', 'leque', 'laser'], recarga: 0.5 }
    ]
  },
  {
    id: 'nucleo', nome: 'NÚCLEO INFINITO', titulo: 'Último Pulso',
    cor: '#ff5cae', cor2: '#791c55', raio: 78, vida: 7600, lados: 7,
    fases: [
      { movimento: 'circular', velocidade: 1.15, ataques: ['espiral', 'leque3'], recarga: 0.42 },
      { movimento: 'horizontal', velocidade: 310, ataques: ['anel', 'invocar'], recarga: 0.68 },
      { movimento: 'senoidal', velocidade: 350, ataques: ['laser', 'leque'], recarga: 0.6 },
      { movimento: 'caotico', velocidade: 410, ataques: ['espiral', 'anel', 'laser'], recarga: 0.42 }
    ]
  }
];

class Boss {
  constructor(def, onda) {
    this.def = def;
    this.x = Jogo.LARGURA / 2;
    this.y = 150;
    this.direcao = 1;
    this.raio = def.raio;
    const escala = 1 + (onda - 5) * 0.025;
    this.vidaMax = def.vida * escala;
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
    this.laser = null;
    this.enraivecido = false;
  }

  get porcentagem() { return Mat.limitar(this.vida / this.vidaMax, 0, 1); }

  atualizarFase() {
    const total = this.def.fases.length;
    const idx = Mat.limitar(total - 1 - Math.floor(this.porcentagem * total), 0, total - 1);
    if (idx !== this.faseIndice) {
      this.faseIndice = idx;
      this.fase = this.def.fases[idx];
      this.telegrafo = 0.8;
      Camera.bater(16);
      Jogo.flashTela(0.35, this.def.cor);
      Particulas.anel(this.x, this.y, this.def.cor, 120, 44);
      Jogo.aviso('FASE ' + (idx + 1) + ' — ' + this.def.nome);
      Som.bossEntra();
    }
  }

  atualizar(dt) {
    this.tempoVivo += dt;
    this.flash = Math.max(0, this.flash - dt * 4);
    this.angulo += dt * 0.9;

    if (this.entrando > 0) {
      this.entrando -= dt;
      this.y = Mat.misturar(-120, this.baseY, 1 - Math.max(0, this.entrando) / 1.6);
      return;
    }

    this.atualizarFase();
    if (this.telegrafo > 0) { this.telegrafo -= dt; return; }

    const j = Jogo.jogador;
    const f = this.fase;

    // movimento
    switch (f.movimento) {
      case 'horizontal':
        this.x += this.direcao * f.velocidade * dt;
        if (this.x - this.raio < 0 || this.x + this.raio > Jogo.LARGURA) {
          this.direcao *= -1;
          this.x = Mat.limitar(this.x, this.raio, Jogo.LARGURA - this.raio);
        }
        this.y = Mat.suave(this.y, this.baseY + Math.sin(this.tempoVivo * 1.4) * 30, 4, dt);
        break;
      case 'senoidal':
        this.x += this.direcao * f.velocidade * dt;
        if (this.x - this.raio < 0 || this.x + this.raio > Jogo.LARGURA) {
          this.direcao *= -1;
          this.x = Mat.limitar(this.x, this.raio, Jogo.LARGURA - this.raio);
        }
        this.y = Jogo.ALTURA / 2 + Math.sin(this.tempoVivo * 1.9) * (Jogo.ALTURA / 2 - this.raio - 30);
        break;
      case 'circular': {
        this.orbita += f.velocidade * dt;
        const rx = Jogo.LARGURA / 2, ry = Jogo.ALTURA / 2;
        this.x = rx + Math.cos(this.orbita) * (Jogo.LARGURA / 2 - this.raio - 60);
        this.y = ry + Math.sin(this.orbita) * (Jogo.ALTURA / 2 - this.raio - 50);
        break;
      }
      case 'perseguir': {
        const a = Mat.anguloEntre(this.x, this.y, j.x, j.y);
        const d = Mat.distancia(this.x, this.y, j.x, j.y);
        const alvo = d > 260 ? 1 : -0.4;
        this.x += Math.cos(a) * f.velocidade * alvo * dt;
        this.y += Math.sin(a) * f.velocidade * alvo * dt;
        break;
      }
      case 'caotico': {
        if (!this.destino || Mat.distancia(this.x, this.y, this.destino.x, this.destino.y) < 40) {
          this.destino = { x: Mat.aleatorio(this.raio + 20, Jogo.LARGURA - this.raio - 20), y: Mat.aleatorio(this.raio + 20, Jogo.ALTURA - this.raio - 20) };
        }
        const a = Mat.anguloEntre(this.x, this.y, this.destino.x, this.destino.y);
        this.x += Math.cos(a) * f.velocidade * dt;
        this.y += Math.sin(a) * f.velocidade * dt;
        break;
      }
    }
    this.x = Mat.limitar(this.x, this.raio, Jogo.LARGURA - this.raio);
    this.y = Mat.limitar(this.y, this.raio, Jogo.ALTURA - this.raio);

    // ataques
    this.recarga -= dt;
    if (this.recarga <= 0) {
      const ataque = Mat.escolher(f.ataques);
      this.executarAtaque(ataque);
      this.recarga = f.recarga * Mat.aleatorio(0.85, 1.15);
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
      j.receberDano(1, this.x, this.y);
    }

    // partículas de aura
    if (Mat.chance(0.6)) {
      const a = Math.random() * Mat.TAU;
      Particulas.emitir({
        x: this.x + Math.cos(a) * this.raio, y: this.y + Math.sin(a) * this.raio,
        vx: Math.cos(a) * 40, vy: Math.sin(a) * 40, vida: 0.5, tam: 3,
        cor: this.def.cor, brilho: 14, atrito: 0.9
      });
    }
  }

  executarAtaque(tipo) {
    const j = Jogo.jogador;
    const angJog = Mat.anguloEntre(this.x, this.y, j.x, j.y);
    switch (tipo) {
      case 'unico':
        for (let i = 0; i < 3; i++) {
          setTimeout(() => {
            if (this.vivo) Jogo.tiroInimigo(this.x, this.y, Mat.anguloEntre(this.x, this.y, j.x, j.y), 480, 1, this.def.cor, 9);
          }, i * 130);
        }
        break;
      case 'leque3':
        for (let i = -1; i <= 1; i++) Jogo.tiroInimigo(this.x, this.y, angJog + i * 0.24, 430, 1, this.def.cor, 9);
        break;
      case 'leque': {
        const n = 9;
        for (let i = 0; i < n; i++) {
          const a = angJog + Mat.misturar(-0.85, 0.85, i / (n - 1));
          Jogo.tiroInimigo(this.x, this.y, a, 400, 1, this.def.cor, 8);
        }
        break;
      }
      case 'anel': {
        const n = 24;
        for (let i = 0; i < n; i++) Jogo.tiroInimigo(this.x, this.y, (Mat.TAU / n) * i + this.tempoVivo, 320, 1, this.def.cor, 8);
        Camera.bater(6);
        break;
      }
      case 'espiral': {
        this.anguloEspiral += 0.42;
        for (let b = 0; b < 3; b++) {
          Jogo.tiroInimigo(this.x, this.y, this.anguloEspiral + (Mat.TAU / 3) * b, 330, 1, this.def.cor, 8);
        }
        break;
      }
      case 'laser':
        this.laser = { tempo: 0, aviso: 0.9, duracao: 1.7, angulo: angJog - 0.6, giro: 1.3 * (Mat.chance(0.5) ? 1 : -1) };
        Som.bossEntra();
        break;
      case 'invocar': {
        const quantos = 2 + this.faseIndice;
        for (let i = 0; i < quantos; i++) {
          const a = Math.random() * Mat.TAU;
          Jogo.inimigos.push(new Inimigo(
            Mat.escolher(['corredor', 'atirador', 'kamikaze']),
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
    this.vida -= q;
    this.flash = 0.25;
    Camera.bater(crit ? 5 : 2);
    if (fx !== undefined) Particulas.faisca(fx, fy, Math.random() * Mat.TAU, this.def.cor);
    Textos.criar(fx || this.x, fy || this.y, Math.round(q) + (crit ? '!' : ''), crit ? '#fff27a' : '#ffffff', crit ? 22 : 15);
    if (this.vida <= 0) this.morrer();
  }

  morrer() {
    this.vivo = false;
    Jogo.pararTempo(0.5);
    Camera.bater(34);
    Camera.pulsar(1.1);
    Jogo.flashTela(0.8, '#ffffff');
    Som.bossMorre();
    for (let i = 0; i < 8; i++) {
      setTimeout(() => {
        Particulas.explosao(this.x + Mat.aleatorio(-60, 60), this.y + Mat.aleatorio(-60, 60), this.def.cor, 40, 520, 0.9, 6);
        Camera.bater(8);
      }, i * 110);
    }
    Jogo.bossDerrotado(this);
  }

  desenhar(ctx) {
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
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#08070d';
    ctx.beginPath();
    ctx.arc(0, 0, this.raio * 0.42, 0, Mat.TAU);
    ctx.fill();
    ctx.fillStyle = d.cor;
    ctx.shadowBlur = 30; ctx.shadowColor = d.cor;
    ctx.beginPath();
    ctx.arc(Math.cos(olhoAng) * this.raio * 0.14, Math.sin(olhoAng) * this.raio * 0.14, this.raio * 0.2, 0, Mat.TAU);
    ctx.fill();
    ctx.restore();
  }
}

/* ============================= COLETÁVEIS =============================== */
const TIPOS_COLETAVEL = {
  xp: { cor: '#8fe3ff', raio: 6, brilho: 14 },
  vida: { cor: '#ff4d6d', raio: 12, brilho: 22, icone: '❤' },
  bomba: { cor: '#ffd34d', raio: 12, brilho: 22, icone: '✹' },
  ima: { cor: '#b06dff', raio: 12, brilho: 22, icone: '◈' },
  frenesi: { cor: '#5cff9d', raio: 12, brilho: 22, icone: '⚡' }
};

class Coletavel {
  constructor(tipo, x, y, valor) {
    this.tipo = tipo;
    this.def = TIPOS_COLETAVEL[tipo];
    this.x = x; this.y = y;
    this.valor = valor || 1;
    this.vx = Mat.aleatorio(-70, 70);
    this.vy = Mat.aleatorio(-70, 70);
    this.vida = tipo === 'xp' ? 18 : 22;
    this.fase = Math.random() * Mat.TAU;
    this.vivo = true;
  }

  atualizar(dt) {
    this.vida -= dt;
    if (this.vida <= 0) { this.vivo = false; return; }
    const j = Jogo.jogador;
    const d = Mat.distancia(this.x, this.y, j.x, j.y);
    const raioIma = this.tipo === 'xp' ? j.attr.ima : 90;
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

    if (d < j.raio + this.def.raio + 4) this.coletar();
  }

  coletar() {
    this.vivo = false;
    const j = Jogo.jogador;
    if (this.tipo === 'xp') {
      j.ganharXP(this.valor);
      Som.xp();
      Particulas.emitir({ x: this.x, y: this.y, vida: 0.3, tam: 5, cor: this.def.cor, brilho: 16, atrito: 0.9 });
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
