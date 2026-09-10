/* ===========================================================================
   UI.JS — todas as telas, HUD e ligações de DOM. O canvas só desenha a arena.
   =========================================================================== */

const UI = {
  el: {},

  iniciar() {
    const g = (id) => document.getElementById(id);
    UI.el = {
      telas: document.querySelectorAll('.tela'),
      hud: g('hud'),
      coracoes: g('coracoes'),
      pontos: g('pontos'),
      multi: g('multi'),
      onda: g('onda'),
      nivel: g('nivel'),
      barraXP: g('barraXP'),
      fps: g('fps'),
      classeNome: g('classeNome'),
      habDash: g('habDash'),
      habEscudo: g('habEscudo'),
      habUlt: g('habUlt'),
      bossBarra: g('bossBarra'),
      bossNome: g('bossNome'),
      bossTitulo: g('bossTitulo'),
      bossFill: g('bossFill'),
      gradeClasses: g('gradeClasses'),
      gradeMelhorias: g('gradeMelhorias'),
      melhoriaNivel: g('melhoriaNivel'),
      finalTitulo: g('finalTitulo'),
      finalSub: g('finalSub'),
      finalEstat: g('finalEstat'),
      listaRecordes: g('listaRecordes'),
      listaMundial: g('listaMundial'),
      campoNome: g('campoNome'),
      avisoNome: g('avisoNome'),
      statusPlacar: g('statusPlacar'),
      recordeMenu: g('recordeMenu'),
      buffs: g('buffs'),
      toqueDash: g('btToqueDash'),
      toqueEscudo: g('btToqueEscudo'),
      toqueUlt: g('btToqueUlt'),
      listaMelhoriasAtivas: g('listaMelhoriasAtivas')
    };

    UI.montarClasses();
    UI.montarConfig();
    UI.montarNome();
    UI.montarAbas();
    Toque.iniciar();
    UI.montarRecordes();

    g('btJogar').onclick = () => { Som.clique(); UI.mostrarTela('classes'); };
    g('btComoJogar').onclick = () => { Som.clique(); UI.mostrarTela('ajuda'); };
    g('btConfig').onclick = () => { Som.clique(); UI.mostrarTela('config'); };
    g('btRecordes').onclick = () => { Som.clique(); UI.montarRecordes(); UI.montarMundial(); UI.mostrarTela('recordes'); };

    document.querySelectorAll('[data-voltar]').forEach((b) => {
      b.onclick = () => { Som.clique(); UI.mostrarTela('menu'); };
    });

    g('btPausar').onclick = () => { Som.clique(); Jogo.pausar(); };
    g('btRetomar').onclick = () => { Som.clique(); Jogo.retomar(); };
    g('btReiniciarPausa').onclick = () => { Som.clique(); UI.mostrarTela('classes'); Jogo.estado = 'classe'; };
    g('btMenuPausa').onclick = () => { Som.clique(); Jogo.estado = 'menu'; UI.esconderBarraBoss(); UI.mostrarTela('menu'); };
    g('btDeNovo').onclick = () => { Som.clique(); UI.mostrarTela('classes'); Jogo.estado = 'classe'; };
    g('btMenuFinal').onclick = () => { Som.clique(); Jogo.estado = 'menu'; UI.esconderBarraBoss(); UI.mostrarTela('menu'); };

    // atalhos: 1/2/3 escolhem melhoria, Esc/P retomam a pausa
    addEventListener('keydown', (e) => {
      if (Jogo.estado === 'melhoria' && UI._cartas) {
        const i = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
        if (i >= 0 && UI._cartas[i] && !UI._cartas[i].disabled) UI._cartas[i].click();
      } else if (Jogo.estado === 'pausado' && (e.code === 'Escape' || e.code === 'KeyP')) {
        Jogo.retomar();
      }
    });

    UI.mostrarTela('menu');
    UI.el.recordeMenu.textContent = Recordes.melhor().toLocaleString('pt-BR');
  },

  /* ------------------------------- Telas ------------------------------ */
  mostrarTela(nome) {
    UI.el.telas.forEach((t) => t.classList.toggle('ativa', t.dataset.tela === nome));
    document.body.classList.toggle('em-jogo', nome === null);
    if (nome === 'menu') {
      UI.esconderBarraBoss();
      UI.el.recordeMenu.textContent = Recordes.melhor().toLocaleString('pt-BR');
    }
  },

  montarClasses() {
    UI.el.gradeClasses.innerHTML = '';
    CLASSES.forEach((c, i) => {
      const card = document.createElement('button');
      card.className = 'cartao-classe';
      card.style.setProperty('--cor', c.cor);
      card.style.setProperty('--cor2', c.cor2);
      card.innerHTML =
        '<div class="cc-topo"><span class="cc-icone">' + c.icone + '</span>' +
        '<div><h3>' + c.nome + '</h3><p class="cc-apelido">' + c.apelido + '</p></div></div>' +
        '<p class="cc-desc">' + c.descricao + '</p>' +
        '<div class="cc-attr">' +
        UI.barrinha('VIDA', c.atributos.vidaMax / 6) +
        UI.barrinha('DANO', Math.min(1, (c.atributos.dano * c.atributos.projeteis) / 45)) +
        UI.barrinha('CADÊNCIA', Math.min(1, 0.12 / c.atributos.cadencia)) +
        UI.barrinha('VELOCIDADE', c.atributos.velocidade / 420) +
        '</div>' +
        '<ul class="cc-lista">' + c.forcas.map((f) => '<li class="bom">+ ' + f + '</li>').join('') +
        c.fraquezas.map((f) => '<li class="ruim">− ' + f + '</li>').join('') + '</ul>' +
        '<div class="cc-ult"><b>' + c.ult.nome + '</b><span>' + c.ult.descricao + '</span></div>' +
        '<span class="cc-jogar">SELECIONAR ▸</span>';
      card.onclick = () => {
        Som.clique();
        Som.destravar();
        Jogo.novoJogo(c.id);
        UI.el.classeNome.textContent = c.nome;
        document.documentElement.style.setProperty('--cor-classe', c.cor);
      };
      UI.el.gradeClasses.appendChild(card);
    });
  },

  barrinha(rotulo, valor) {
    const p = Math.round(Mat.limitar(valor, 0.05, 1) * 100);
    return '<div class="attr"><span>' + rotulo + '</span><div class="attr-barra"><i style="width:' + p + '%"></i></div></div>';
  },

  montarConfig() {
    const bind = (id, chave, transformar) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.type === 'range') {
        el.value = Config[chave] * 100;
        el.oninput = () => {
          Config[chave] = el.value / 100;
          Som.aplicarVolumes();
          Config.salvar();
        };
      } else {
        el.checked = !!Config[chave];
        el.onchange = () => { Config[chave] = el.checked; Config.salvar(); };
      }
    };
    bind('cfgMusica', 'volumeMusica');
    bind('cfgEfeitos', 'volumeEfeitos');
    bind('cfgTremor', 'tremorAtivo');
    bind('cfgParticulas', 'particulasAtivas');
    bind('cfgDano', 'mostrarDano');

    const sel = document.getElementById('cfgToque');
    if (sel) {
      sel.value = Config.controlesToque;
      sel.onchange = () => {
        Config.controlesToque = sel.value;
        Config.salvar();
        Toque.aplicarPreferencia();
      };
    }
    const bt = document.getElementById('btApagarRecordes');
    if (bt) bt.onclick = () => {
      try { localStorage.removeItem('sniper.recordes'); } catch (e) {}
      Recordes.lista = [];
      UI.montarRecordes();
      Som.clique();
    };
  },

  /* ------------------------------- Nome ------------------------------- */
  montarNome() {
    Perfil.carregar();
    const campos = [UI.el.campoNome, document.getElementById('cfgNome')].filter(Boolean);
    campos.forEach((campo) => {
      campo.value = Perfil.nome;
      campo.oninput = () => {
        const cursor = campo.selectionStart;
        campo.value = Perfil.limpar(campo.value);
        campo.setSelectionRange(cursor, cursor);
        UI.validarNome(campo.value);
      };
      campo.onchange = () => UI.gravarNome(campo.value);
      campo.onblur = () => UI.gravarNome(campo.value);
      // Enter no campo não deve escolher classe sem querer
      campo.onkeydown = (e) => { if (e.code === 'Enter') { e.preventDefault(); campo.blur(); } };
    });
    UI.validarNome(Perfil.nome);
  },

  validarNome(valor) {
    if (!UI.el.avisoNome) return true;
    if (!valor || !valor.trim()) {
      UI.el.avisoNome.textContent = 'Sem nome você entra como ANÔNIMO.';
      UI.el.avisoNome.className = 'neutro';
      return true;
    }
    const r = Perfil.valido(valor);
    UI.el.avisoNome.textContent = r.ok ? 'Vai aparecer como ' + r.nome : r.motivo;
    UI.el.avisoNome.className = r.ok ? 'ok' : 'erro';
    return r.ok;
  },

  gravarNome(valor) {
    if (!valor || !valor.trim()) { Perfil.salvar(''); return; }
    const r = Perfil.valido(valor);
    if (r.ok) Perfil.salvar(r.nome);
    const outro = document.getElementById('cfgNome');
    if (UI.el.campoNome) UI.el.campoNome.value = Perfil.nome;
    if (outro) outro.value = Perfil.nome;
  },

  /* ------------------------------- Abas ------------------------------- */
  montarAbas() {
    document.querySelectorAll('.aba').forEach((aba) => {
      aba.onclick = () => {
        Som.clique();
        document.querySelectorAll('.aba').forEach((a) => a.classList.toggle('ativa', a === aba));
        const mundial = aba.dataset.aba === 'mundial';
        UI.el.listaMundial.hidden = !mundial;
        UI.el.listaRecordes.hidden = mundial;
        if (mundial) UI.montarMundial();
      };
    });
  },

  /* --------------------------- Placar mundial ------------------------- */
  async montarMundial() {
    const caixa = UI.el.listaMundial;
    if (!caixa) return;
    if (!Placar.configurado()) {
      caixa.innerHTML =
        '<p class="vazio">O placar mundial ainda não está ligado neste arquivo.<br>' +
        'Preencha <code>src/placar-config.js</code> com a URL e a chave publicável ' +
        'e todo mundo passa a ver a mesma lista.</p>';
      return;
    }
    caixa.innerHTML = '<p class="vazio">Carregando o placar mundial…</p>';
    const linhas = await Placar.top(true);
    if (!linhas) {
      caixa.innerHTML = '<p class="vazio">Não deu pra falar com o placar mundial agora.<br>' +
        'Sua pontuação continua salva neste aparelho.</p>';
      return;
    }
    if (!linhas.length) {
      caixa.innerHTML = '<p class="vazio">Ninguém pontuou ainda. Seja o primeiro.</p>';
      return;
    }
    const meu = Perfil.exibir();
    caixa.innerHTML =
      '<table class="tabela"><thead><tr><th>#</th><th>NOME</th><th>PONTOS</th><th>CLASSE</th><th>ONDA</th><th></th></tr></thead><tbody>' +
      linhas.map((r, i) => {
        const eu = r.nome === meu ? ' class="eu"' : '';
        return '<tr' + eu + '><td>' + (i + 1) + '</td><td class="nome">' + UI.escapar(r.nome) +
          '</td><td class="destaque">' + Number(r.pontos).toLocaleString('pt-BR') + '</td><td>' +
          UI.escapar(r.classe) + '</td><td>' + r.onda + '</td><td>' + (r.venceu ? '🏆' : '') + '</td></tr>';
      }).join('') + '</tbody></table>';
  },

  // nome vem de outra pessoa: trata como texto, nunca como HTML
  escapar(texto) {
    return String(texto === null || texto === undefined ? '' : texto)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\u0022/g, '&quot;').replace(/\u0027/g, '&#39;');
  },

  montarRecordes() {
    const lista = Recordes.lista;
    if (!lista.length) {
      UI.el.listaRecordes.innerHTML = '<p class="vazio">Nenhuma partida registrada ainda.</p>';
      return;
    }
    UI.el.listaRecordes.innerHTML =
      '<table class="tabela"><thead><tr><th>#</th><th>NOME</th><th>PONTOS</th><th>CLASSE</th><th>ONDA</th><th>TEMPO</th><th></th></tr></thead><tbody>' +
      lista.map((r, i) =>
        '<tr><td>' + (i + 1) + '</td><td class="nome">' + UI.escapar(r.nome || 'ANÔNIMO') +
        '</td><td class="destaque">' + r.pontos.toLocaleString('pt-BR') + '</td><td>' + r.classe +
        '</td><td>' + r.onda + '</td><td>' + r.tempo + 's</td><td>' + (r.venceu ? '🏆' : '') + '</td></tr>'
      ).join('') + '</tbody></table>';
  },

  /* ----------------------------- Melhorias ---------------------------- */
  mostrarMelhorias(lista) {
    UI.el.melhoriaNivel.textContent = 'NÍVEL ' + Jogo.jogador.nivel;
    UI.el.gradeMelhorias.innerHTML = '';
    UI._cartas = [];
    lista.forEach((m, indice) => {
      const nivelAtual = Jogo.jogador.melhorias[m.id] || 0;
      const card = document.createElement('button');
      card.className = 'cartao-melhoria r-' + m.raridade;
      card.innerHTML =
        '<span class="cm-raridade">' + m.raridade.toUpperCase() + '</span>' +
        '<span class="cm-icone">' + m.icone + '</span>' +
        '<h3>' + m.nome + '</h3>' +
        '<p>' + m.texto + '</p>' +
        '<span class="cm-nivel">' + (nivelAtual > 0 ? 'NÍVEL ' + nivelAtual + ' ▸ ' + (nivelAtual + 1) : 'NOVO') + '</span>' +
        '<span class="cm-tecla">' + (indice + 1) + '</span>';
      // trava curta: quem está segurando o gatilho não escolhe carta sem querer
      card.disabled = true;
      setTimeout(() => { card.disabled = false; }, 380);
      card.onclick = () => { Som.clique(); Jogo.escolherMelhoria(m); };
      UI._cartas.push(card);
      UI.el.gradeMelhorias.appendChild(card);
    });
    UI.mostrarTela('melhoria');
  },

  /* ------------------------------- Final ------------------------------ */
  mostrarFinal(venceu) {
    const j = Jogo.jogador;
    UI.el.finalTitulo.textContent = venceu ? 'ARENA DOMINADA' : 'VOCÊ CAIU';
    UI.el.finalTitulo.className = venceu ? 'vitoria' : 'derrota';
    UI.el.finalSub.textContent = venceu
      ? 'As 20 ondas e os 4 bosses foram limpos. Respeito.'
      : 'Caiu na onda ' + Jogo.onda + ' de ' + Jogo.TOTAL_ONDAS + '. Tenta outra classe.';

    const linhas = [
      ['PONTOS', Math.round(Jogo.pontos).toLocaleString('pt-BR')],
      ['CLASSE', j.classe.nome],
      ['ONDA', Jogo.onda + ' / ' + Jogo.TOTAL_ONDAS],
      ['NÍVEL', j.nivel],
      ['ABATES', Jogo.estat.abates],
      ['BOSSES', Jogo.estat.bosses],
      ['MULTI MÁX.', 'x' + Jogo.estat.melhorMulti],
      ['DANO CAUSADO', Math.round(Jogo.estat.danoFeito).toLocaleString('pt-BR')],
      ['TEMPO', Math.round(Jogo.tempoJogo) + 's'],
      ['RECORDE', Recordes.melhor().toLocaleString('pt-BR')]
    ];
    UI.el.finalEstat.innerHTML = linhas.map(
      (l) => '<div class="estat"><span>' + l[0] + '</span><b>' + l[1] + '</b></div>'
    ).join('');

    const ativas = Object.keys(j.melhorias);
    UI.el.listaMelhoriasAtivas.innerHTML = ativas.length
      ? ativas.map((id) => {
        const m = MELHORIAS.find((x) => x.id === id);
        return '<span class="tag r-' + m.raridade + '">' + m.icone + ' ' + m.nome + ' <b>x' + j.melhorias[id] + '</b></span>';
      }).join('')
      : '<span class="vazio">Nenhuma melhoria pega.</span>';

    UI.atualizarStatusPlacar();
    UI.mostrarTela('final');
  },

  /* Mostra se a run foi pro placar mundial (e repinta quando a resposta chega). */
  atualizarStatusPlacar() {
    const el = UI.el.statusPlacar;
    if (!el) return;
    if (!Placar.configurado()) {
      el.textContent = 'Pontuação salva neste aparelho como ' + Perfil.exibir() + '.';
      el.className = 'status-placar neutro';
      return;
    }
    const pintar = () => {
      if (Placar.ultimoEnvio === 'ok') {
        el.textContent = '🌎 Enviado ao placar mundial como ' + Perfil.exibir() + '.';
        el.className = 'status-placar ok';
      } else if (Placar.ultimoEnvio === 'erro') {
        el.textContent = 'Não deu pra enviar ao placar mundial. Ficou salvo aqui como ' + Perfil.exibir() + '.';
        el.className = 'status-placar erro';
      } else {
        el.textContent = 'Enviando ao placar mundial como ' + Perfil.exibir() + '…';
        el.className = 'status-placar neutro';
      }
    };
    pintar();
    let tentativas = 0;
    const timer = setInterval(() => {
      pintar();
      if (Placar.ultimoEnvio !== 'enviando' || ++tentativas > 20) clearInterval(timer);
    }, 400);
  },

  /* -------------------------------- HUD ------------------------------- */
  atualizarHUD() {
    const j = Jogo.jogador;
    if (!j) return;

    // corações (suportam fração) — só reconstrói o DOM quando o total muda
    const max = Math.ceil(j.attr.vidaMax);
    if (UI._maxCoracoes !== max) {
      UI._maxCoracoes = max;
      let html = '';
      for (let i = 0; i < max; i++) html += '<span class="coracao"></span>';
      UI.el.coracoes.innerHTML = html;
      UI._coracoes = UI.el.coracoes.querySelectorAll('.coracao');
    }
    for (let i = 0; i < UI._coracoes.length; i++) {
      UI._coracoes[i].style.setProperty('--p', Mat.limitar(j.vida - i, 0, 1) * 100 + '%');
    }

    UI.el.pontos.textContent = Math.round(Jogo.pontos).toLocaleString('pt-BR');
    UI.el.onda.textContent = Jogo.onda + '/' + Jogo.TOTAL_ONDAS;
    UI.el.nivel.textContent = j.nivel;
    UI.el.barraXP.style.width = Mat.limitar(j.xp / j.xpProximo, 0, 1) * 100 + '%';
    UI.el.fps.textContent = Jogo.fps;

    const m = Jogo.multiplicador;
    UI.el.multi.textContent = 'x' + m;
    UI.el.multi.className = 'multi' + (m >= 6 ? ' fogo' : m >= 3 ? ' quente' : '');

    const pDash = j.dashCarga / j.attr.dashRecarga;
    const pEscudo = j.escudoAtivo ? 1 : j.escudoCarga / j.attr.escudoRecarga;
    const pUlt = j.ultCarga / j.attr.ultRecarga;
    UI.pintarHabilidade(UI.el.habDash, pDash, j.dashRestante > 0);
    UI.pintarHabilidade(UI.el.habEscudo, pEscudo, j.escudoAtivo);
    UI.pintarHabilidade(UI.el.habUlt, pUlt, j.ultAtiva > 0);
    UI.pintarHabilidade(UI.el.toqueDash, pDash, j.dashRestante > 0);
    UI.pintarHabilidade(UI.el.toqueEscudo, pEscudo, j.escudoAtivo);
    UI.pintarHabilidade(UI.el.toqueUlt, pUlt, j.ultAtiva > 0);

    // buffs temporários
    const buffs = [];
    if (j.frenesi > 0) buffs.push('<span class="buff verde">⚡ FRENESI ' + j.frenesi.toFixed(1) + 's</span>');
    if (Jogo.imaGlobal > 0) buffs.push('<span class="buff roxo">◈ ÍMÃ ' + Jogo.imaGlobal.toFixed(1) + 's</span>');
    if (j.escudoAtivo) buffs.push('<span class="buff amarelo">⛨ ESCUDO ' + j.escudoRestante.toFixed(1) + 's</span>');
    if (j.ultAtiva > 0) buffs.push('<span class="buff vermelho">★ ULT ' + j.ultAtiva.toFixed(1) + 's</span>');
    UI.el.buffs.innerHTML = buffs.join('');
  },

  pintarHabilidade(el, progresso, ativo) {
    if (!el) return;
    const p = Mat.limitar(progresso, 0, 1);
    el.style.setProperty('--p', (p * 100) + '%');
    el.classList.toggle('pronto', p >= 1);
    el.classList.toggle('ativo', !!ativo);
  },

  /* ----------------------------- Barra do boss ------------------------ */
  mostrarBarraBoss(boss) {
    UI.el.bossBarra.classList.add('ativa');
    UI.el.bossNome.textContent = boss.def.nome;
    UI.el.bossTitulo.textContent = boss.def.titulo;
    UI.el.bossBarra.style.setProperty('--cor-boss', boss.def.cor);
  },
  atualizarBarraBoss(boss) {
    UI.el.bossFill.style.width = (boss.porcentagem * 100) + '%';
    UI.el.bossBarra.dataset.fase = (boss.faseIndice + 1) + '/' + boss.def.fases.length;
  },
  esconderBarraBoss() { UI.el.bossBarra.classList.remove('ativa'); },

  aviso(texto) { /* o texto grande é desenhado no canvas; aqui fica o gancho */ }
};


/* ===========================================================================
   TOQUE — joystick de movimento, joystick de mira e botões em tela.
   Alimenta Input.mover / Input.mira / Input.pulsos; teclado e mouse seguem valendo.
   =========================================================================== */
const Toque = {
  disponivel: false,

  iniciar() {
    Toque.disponivel =
      (window.matchMedia && matchMedia('(pointer: coarse)').matches) ||
      navigator.maxTouchPoints > 0 ||
      'ontouchstart' in window;

    Toque.ligarStick(document.getElementById('stickMover'), Input.mover);
    Toque.ligarStick(document.getElementById('stickMira'), Input.mira);

    // botão de tiro: mantém o gatilho preso enquanto o dedo estiver nele
    const tiro = document.getElementById('btToqueTiro');
    const soltarTiro = () => { Input.mouseBaixo = false; tiro.classList.remove('usando'); };
    tiro.addEventListener('pointerdown', (e) => {
      Som.destravar();
      try { tiro.setPointerCapture(e.pointerId); } catch (err) { /* ponteiro já liberado */ }
      Input.mouseBaixo = true;
      tiro.classList.add('usando');
      e.preventDefault();
    });
    tiro.addEventListener('pointerup', soltarTiro);
    tiro.addEventListener('pointercancel', soltarTiro);
    tiro.addEventListener('lostpointercapture', soltarTiro);

    // botões de habilidade viram um pulso de tecla
    const mapa = { dash: 'Space', escudo: 'KeyQ', ult: 'KeyE' };
    document.querySelectorAll('.hab-toque').forEach((b) => {
      b.addEventListener('pointerdown', (e) => {
        Som.destravar();
        Input.pulsar(mapa[b.dataset.hab]);
        b.classList.add('usando');
        e.preventDefault();
      });
      const solta = () => b.classList.remove('usando');
      b.addEventListener('pointerup', solta);
      b.addEventListener('pointercancel', solta);
    });

    Toque.aplicarPreferencia();
    addEventListener('resize', Toque.reavaliar);
    addEventListener('orientationchange', Toque.reavaliar);
  },

  // aparelho híbrido (notebook com tela sensível, tablet acoplado) pode mudar de modo
  reavaliar() {
    Toque.disponivel =
      (window.matchMedia && matchMedia('(pointer: coarse)').matches) ||
      navigator.maxTouchPoints > 0 ||
      'ontouchstart' in window;
    Toque.aplicarPreferencia();
  },

  aplicarPreferencia() {
    const modo = Config.controlesToque;
    const ligado = modo === 'sempre' || (modo === 'auto' && Toque.disponivel);
    document.body.classList.toggle('toque', ligado);
    Input.modoToque = ligado;
    if (!ligado) {
      Input.mover.ativo = false; Input.mover.x = 0; Input.mover.y = 0;
      Input.mira.ativo = false; Input.mira.x = 0; Input.mira.y = 0;
    }
  },

  ligarStick(el, destino) {
    if (!el) return;
    const knob = el.querySelector('i');
    let id = null, cx = 0, cy = 0, raio = 1;

    const mover = (e) => {
      let dx = (e.clientX - cx) / raio;
      let dy = (e.clientY - cy) / raio;
      const m = Math.hypot(dx, dy);
      if (m > 1) { dx /= m; dy /= m; }
      destino.x = dx; destino.y = dy;
      knob.style.transform =
        'translate(calc(-50% + ' + (dx * raio * 0.55).toFixed(1) + 'px), calc(-50% + ' + (dy * raio * 0.55).toFixed(1) + 'px))';
    };

    const soltar = (e) => {
      if (e && e.pointerId !== id) return;
      id = null;
      destino.ativo = false; destino.x = 0; destino.y = 0;
      knob.style.transform = 'translate(-50%, -50%)';
      el.classList.remove('usando');
    };

    el.addEventListener('pointerdown', (e) => {
      Som.destravar();
      id = e.pointerId;
      try { el.setPointerCapture(id); } catch (err) { /* ponteiro já liberado */ }
      const r = el.getBoundingClientRect();
      cx = r.left + r.width / 2;
      cy = r.top + r.height / 2;
      raio = r.width / 2;
      destino.ativo = true;
      el.classList.add('usando');
      mover(e);
      e.preventDefault();
    });
    el.addEventListener('pointermove', (e) => { if (e.pointerId === id) mover(e); });
    el.addEventListener('pointerup', soltar);
    el.addEventListener('pointercancel', soltar);
    el.addEventListener('lostpointercapture', soltar);
  }
};
