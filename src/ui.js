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
      seloVersao: g('seloVersao'),
      avisoAtualizacao: g('avisoAtualizacao'),
      avaDetalhe: g('avaDetalhe'),
      versaoAtual: g('versaoAtual'),
      temporadaAtual: g('temporadaAtual'),
      listaAtualizacoes: g('listaAtualizacoes'),
      moedasMenu: g('moedasMenu'),
      moedasHud: g('moedasHud'),
      buffs: g('buffs'),
      toqueDash: g('btToqueDash'),
      toqueEscudo: g('btToqueEscudo'),
      toqueUlt: g('btToqueUlt'),
      listaMelhoriasAtivas: g('listaMelhoriasAtivas'),
      salaEquipe: g('salaEquipe'),
      salaEspera: g('salaEspera'),
      listaSala: g('listaSala'),
      codigoSala: g('codigoSala'),
      salaAviso: g('salaAviso')
    };

    Loja.iniciar();
    UI.montarClasses();
    UI.montarConfig();
    UI.montarNome();
    UI.montarAbas();
    Toque.iniciar();
    UI.montarRecordes();
    UI.marcarVersao();
    UI.ligarAvisoAtualizacao();

    g('btJogar').onclick = () => { Coop.intencao = null; Som.clique(); UI.mostrarTela('classes'); };
    g('btCriarSala').onclick = () => { Som.clique(); UI.abrirSala('criar'); };
    g('btEntrarSala').onclick = () => { Som.clique(); UI.abrirSala('entrar'); };
    g('btSairSala').onclick = () => { Som.clique(); Coop.sair(); };
    UI.ligarSala();
    g('btComoJogar').onclick = () => { Som.clique(); UI.mostrarTela('ajuda'); };
    g('btConfig').onclick = () => { Som.clique(); UI.mostrarTela('config'); };
    g('btAtualizar').onclick = () => { Som.clique(); UI.montarAtualizacoes(); UI.mostrarTela('atualizacoes'); };
    g('btBuscarAtualizacao').onclick = (e) => {
      Som.clique();
      e.currentTarget.textContent = 'BUSCANDO…';
      e.currentTarget.disabled = true;
      JOGO.atualizarAgora();
    };
    g('btLoja').onclick = () => { Som.clique(); Loja.abrirAba(Loja.aba); UI.mostrarTela('loja'); };
    g('btRecordes').onclick = () => { Som.clique(); UI.montarRecordes(); UI.montarMundial(); UI.mostrarTela('recordes'); };

    document.querySelectorAll('[data-voltar]').forEach((b) => {
      b.onclick = () => {
        Som.clique();
        if (Coop.ativo()) Coop.sair();      // sair da tela da sala solta a conexao
        UI.mostrarTela('menu');
      };
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

    // A marca de histórico sobrevive a um recarregar de página; limpar no boot
    // evita o caso em que o primeiro VOLTAR sai do jogo em vez de trocar de tela.
    try {
      if (history.state && history.state.sniper) history.replaceState(null, '');
    } catch (e) { /* file:// recusa */ }

    // botão VOLTAR do Android / gesto de voltar do navegador
    addEventListener('popstate', () => {
      if (Jogo.estado === 'jogando') { Jogo.pausar(); return; }
      if (Jogo.estado === 'melhoria') {
        // no meio da escolha, voltar não faz nada: repõe a entrada e segue
        UI.sincronizarHistorico('melhoria');
        return;
      }
      const atual = document.querySelector('.tela.ativa');
      const nome = atual ? atual.dataset.tela : null;
      if (nome !== 'menu') {
        Som.clique();
        Jogo.estado = 'menu';
        UI.esconderBarraBoss();
        UI.mostrarTela('menu');
      }
      // já no menu: deixa o navegador/Android sair, que é o esperado
    });

    UI.mostrarTela('menu');
    UI.el.recordeMenu.textContent = Recordes.melhor().toLocaleString('pt-BR');
    UI.atualizarMoedas();
  },

  // Um lugar só para o saldo: menu e HUD leem da mesma carteira.
  atualizarMoedas() {
    const texto = Carteira.moedas.toLocaleString('pt-BR');
    if (UI.el.moedasMenu) UI.el.moedasMenu.textContent = texto;
    if (UI.el.moedasHud) UI.el.moedasHud.textContent = texto;
  },

  /* ------------------------------- Telas ------------------------------ */
  mostrarTela(nome) {
    UI.el.telas.forEach((t) => t.classList.toggle('ativa', t.dataset.tela === nome));
    document.body.classList.toggle('em-jogo', nome === null);
    UI.sincronizarHistorico(nome);
    if (nome === 'menu') {
      UI.esconderBarraBoss();
      UI.el.recordeMenu.textContent = Recordes.melhor().toLocaleString('pt-BR');
      UI.atualizarMoedas();
    }
  },

  /* Deixa sempre uma entrada de histórico fora do menu, pra o botão VOLTAR do
     Android voltar de tela em vez de fechar o app na cara do jogador. */
  sincronizarHistorico(nome) {
    const foraDoMenu = nome !== 'menu';
    const temMarca = !!(history.state && history.state.sniper);
    if (foraDoMenu && !temMarca) {
      try { history.pushState({ sniper: true }, ''); } catch (e) { /* file:// recusa */ }
    }
  },

  // O teto do dano sai da classe mais forte, não de um número fixo: com teto
  // fixo a barra do ESPECTRO já batia em 100% e qualquer aumento de dano dele
  // não aparecia mais na tela.
  tetoDano() {
    return Math.max(...CLASSES.map((c) => c.atributos.dano * c.atributos.projeteis));
  },

  montarClasses() {
    UI.el.gradeClasses.innerHTML = '';
    CLASSES.forEach((c, i) => {
      const card = document.createElement('div');
      card.className = 'cartao-classe';
      card.style.setProperty('--cor', c.cor);
      card.style.setProperty('--cor2', c.cor2);
      card.innerHTML =
        '<div class="cc-topo"><span class="cc-icone">' + c.icone + '</span>' +
        '<div><h3>' + c.nome + '</h3><p class="cc-apelido">' + c.apelido + '</p></div></div>' +
        '<p class="cc-desc">' + c.descricao + '</p>' +
        '<div class="cc-attr">' +
        UI.barrinha('VIDA', c.atributos.vidaMax / 4) +
        UI.barrinha('DANO', (c.atributos.dano * c.atributos.projeteis) / UI.tetoDano()) +
        UI.barrinha('CADÊNCIA', Math.min(1, 0.12 / c.atributos.cadencia)) +
        UI.barrinha('VELOCIDADE', c.atributos.velocidade / 460) +
        '</div>' +
        '<ul class="cc-lista">' + c.forcas.map((f) => '<li class="bom">+ ' + f + '</li>').join('') +
        c.fraquezas.map((f) => '<li class="ruim">− ' + f + '</li>').join('') + '</ul>' +
        '<div class="cc-ult"><b>' + c.ult.nome + '</b><span>' + c.ult.descricao + '</span></div>' +
        '<button type="button" class="cc-loja">🛒 MUDAR APARÊNCIA NA LOJINHA</button>' +
        '<button type="button" class="cc-jogar">JOGAR COM ' + c.nome + ' ▸</button>';
      card.querySelector('.cc-loja').onclick = () => { Som.clique(); Loja.abrirAba(Loja.aba); UI.mostrarTela('loja'); };
      card.querySelector('.cc-jogar').onclick = () => {
        Som.clique();
        Som.destravar();
        UI.el.classeNome.textContent = c.nome;
        // Na sala a classe só é anotada: quem dá a largada é o anfitrião.
        if (Coop.intencao === 'sala') {
          Coop.escolherClasse(c.id, Carteira.equipado.casco);
          UI.mostrarTela('sala');
          return;
        }
        Jogo.novoJogo(c.id, Carteira.equipado.casco);
      };
      UI.el.gradeClasses.appendChild(card);
    });
  },

  barrinha(rotulo, valor) {
    const p = Math.round(Mat.limitar(valor, 0.05, 1) * 100);
    return '<div class="attr"><span>' + rotulo + '</span><div class="attr-barra"><i style="width:' + p + '%"></i></div></div>';
  },

  // O HUD inteiro bebe de uma variável só; assim o controle vale para bloco,
  // barra de boss, botões de toque e o que mais vier depois.
  aplicarOpacidadeHud() {
    document.documentElement.style.setProperty('--opacidade-hud', Config.opacidadeHud);
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
          UI.aplicarOpacidadeHud();
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
    bind('cfgHud', 'opacidadeHud');
    UI.aplicarOpacidadeHud();

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
        'Publique a API com o banco configurado para compartilhar a lista.</p>';
      return;
    }
    caixa.innerHTML = '<p class="vazio">Carregando o placar mundial…</p>';
    const linhas = await Placar.top(true);
    if (!linhas) {
      const semBanco = /banco|DATABASE_URL/i.test(Placar.ultimoErro || '');
      caixa.innerHTML = '<p class="vazio">' + (semBanco
        ? 'O placar mundial está sem banco configurado neste endereço.<br>'
          + 'Falta a variável <b>DATABASE_URL</b> no projeto da Vercel.'
        : 'Não deu pra falar com o placar mundial agora.')
        + '<br>Sua pontuação continua salva neste aparelho.</p>';
      return;
    }
    if (!linhas.length) {
      caixa.innerHTML = UI.linhaTemporada() +
        '<p class="vazio">Ninguém pontuou nesta temporada ainda. Seja o primeiro.</p>';
      return;
    }
    const meu = Perfil.exibir();
    caixa.innerHTML = UI.linhaTemporada() +
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

  /* --------------- Aviso de atualização disponível -------------------- */
  /* O jogador não deve precisar entrar em tela nenhuma para descobrir que saiu
     versão nova: o jogo pergunta ao servidor de tempo em tempo e, quando a
     versão de lá é mais nova que a que está rodando, a faixa desce na tela —
     no menu, na loja ou no meio de uma luta de boss.

     Três gatilhos, porque um só falha:
       1. 15 s depois de abrir (dá tempo de o jogo carregar sem competir por rede);
       2. a cada 5 minutos enquanto o jogo estiver aberto;
       3. quando a aba volta a ficar visível, se a última checagem passou de 2 min.
     Mais o sinal do service worker, que avisa quando encontra casco novo. */
  ESPERA_AVISO: 5 * 60 * 1000,        // de quanto em quanto tempo pergunta
  ADIAMENTO_AVISO: 5 * 60 * 1000,     // quanto tempo o "depois" silencia

  ligarAvisoAtualizacao() {
    if (typeof JOGO === 'undefined' || !UI.el.avisoAtualizacao) return;
    // Em file:// não existe servidor para perguntar: o aviso simplesmente não liga.
    if (location.protocol.indexOf('http') !== 0) return;

    UI._avisoAdiadoAte = 0;
    UI._ultimaChecagem = 0;

    document.getElementById('btAvisoAtualizar').onclick = () => {
      Som.clique();
      JOGO.atualizarAgora();
    };
    document.getElementById('btAvisoDepois').onclick = () => {
      Som.clique();
      UI._avisoAdiadoAte = Date.now() + UI.ADIAMENTO_AVISO;
      UI.el.avisoAtualizacao.hidden = true;
    };

    setTimeout(UI.verificarAtualizacao, 15000);
    setInterval(UI.verificarAtualizacao, UI.ESPERA_AVISO);
    addEventListener('visibilitychange', () => {
      if (document.hidden) return;
      if (Date.now() - UI._ultimaChecagem > 2 * 60 * 1000) UI.verificarAtualizacao();
    });

    // O service worker sabe antes de todos: ele busca o sw.js sozinho e, se o
    // conteúdo mudou, instala um novo. Isso é sinal de que saiu deploy.
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (!reg) return;
        reg.addEventListener('updatefound', () => UI.verificarAtualizacao());
      }).catch(() => { /* sem service worker: os outros gatilhos bastam */ });
    }
  },

  async verificarAtualizacao() {
    if (typeof JOGO === 'undefined') return;
    UI._ultimaChecagem = Date.now();
    // Pede ao service worker para conferir o casco também, senão ele só olharia
    // sozinho de vez em quando.
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg && reg.update) reg.update();
      }
    } catch (e) { /* não impede a checagem por versão */ }

    if (await JOGO.temAtualizacao()) UI.mostrarAvisoAtualizacao();
  },

  mostrarAvisoAtualizacao() {
    const faixa = UI.el.avisoAtualizacao;
    if (!faixa) return;
    if (Date.now() < (UI._avisoAdiadoAte || 0)) return;   // o jogador pediu "depois"

    const nova = JOGO.versaoNoServidor || '';
    let texto = 'A versão ' + nova + ' está no ar. Você está jogando a ' + JOGO.versao + '.';
    // Aviso honesto: atualizar recarrega o jogo, e partida em andamento morre.
    if (Jogo.estado === 'jogando' || Jogo.estado === 'pausado' || Jogo.estado === 'melhoria') {
      texto += ' Atualizar agora encerra a partida atual.';
    }
    UI.el.avaDetalhe.textContent = texto;
    faixa.hidden = false;
  },

  /* Acende o selo verde no botão ATUALIZAR quando a versão mudou desde a
     última vez que este navegador abriu o jogo. */
  marcarVersao() {
    if (typeof JOGO === 'undefined' || !UI.el.seloVersao) return;
    const situacao = JOGO.situacao();
    UI.el.seloVersao.textContent = 'NOVO';
    UI.el.seloVersao.classList.toggle('aceso', situacao === 'nova');
  },

  montarAtualizacoes() {
    if (typeof JOGO === 'undefined') return;
    UI.el.versaoAtual.textContent = JOGO.versao;
    UI.el.temporadaAtual.textContent = JOGO.temporada;
    UI.el.listaAtualizacoes.innerHTML = ATUALIZACOES.map((a, i) =>
      '<div class="atu-item' + (i === 0 ? ' agora' : '') + '">' +
        '<div class="atu-cabeca">' +
          '<span class="atu-versao">' + UI.escapar(a.versao) + '</span>' +
          '<span class="atu-titulo">' + UI.escapar(a.titulo) + '</span>' +
          (i === 0 ? '<span class="atu-agora">VOCÊ ESTÁ AQUI</span>' : '') +
          '<span class="atu-data">' + UI.escapar(a.data) + '</span>' +
        '</div>' +
        '<ul class="atu-itens">' + a.itens.map((t) => '<li>' + UI.escapar(t) + '</li>').join('') + '</ul>' +
      '</div>'
    ).join('');
    // Ver a lista conta como ter tomado conhecimento: o selo apaga.
    JOGO.anotarVersao();
    UI.marcarVersao();
  },

  // Cabeçalho comum das duas abas: diz de que temporada é a lista.
  linhaTemporada() {
    if (typeof JOGO === 'undefined') return '';
    return '<p class="temporada-linha">TEMPORADA <b>' + JOGO.temporada +
      '</b> · o ranking recomeça em cada atualização do jogo</p>';
  },

  montarRecordes() {
    const lista = Recordes.lista;
    if (!lista.length) {
      UI.el.listaRecordes.innerHTML = UI.linhaTemporada() +
        '<p class="vazio">Nenhuma partida nesta temporada ainda.' +
        (Recordes.melhorDeTodas() > 0
          ? '<br>Seu melhor de todas as temporadas: <b>' + Recordes.melhorDeTodas().toLocaleString('pt-BR') + '</b>.'
          : '') + '</p>';
      return;
    }
    UI.el.listaRecordes.innerHTML = UI.linhaTemporada() +
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
  mostrarFinal(venceu, segredo) {
    const j = Jogo.jogador;
    if (segredo) {
      UI.el.finalTitulo.textContent = 'VOCÊ VIU';
      UI.el.finalTitulo.className = 'segredo';
      UI.el.finalSub.textContent = 'As 100 ondas caíram, o CEIFADOR caiu, e então apareceu ' +
        'algo que não estava no jogo. O ESPECTADOR não tem barra para zerar: ele é imortal por ' +
        'regra, não por dificuldade. Ninguém vence essa luta — e sua vitória das 100 ondas já ' +
        'está registrada no placar.';
    } else {
      UI.el.finalTitulo.textContent = venceu ? 'ARENA DOMINADA' : 'VOCÊ CAIU';
      UI.el.finalTitulo.className = venceu ? 'vitoria' : 'derrota';
      UI.el.finalSub.textContent = venceu
        ? 'As 100 ondas caíram. Você derrubou o CEIFADOR ABSOLUTO.'
        : 'Caiu na onda ' + Jogo.onda + '. Tenta superar esse recorde.';
    }

    const linhas = [
      ['PONTOS', Math.round(Jogo.pontos).toLocaleString('pt-BR')],
      ['CLASSE', j.classe.nome],
      ['ONDA', segredo ? '100 + ???' : Jogo.onda + ' / ' + Jogo.TOTAL_ONDAS],
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
  /* --------------------------- Cooperativo --------------------------- */
  // Painel da sala: criar com código escolhido, entrar com o código do amigo,
  // ver quem já está dentro e só então começar.
  ligarSala() {
    const g = (id) => document.getElementById(id);
    g('btSortearCodigo').onclick = () => { Som.clique(); g('campoCodigoNovo').value = Coop.codigoSugerido(); };
    g('btAbrirSala').onclick = () => {
      const codigo = UI.codigoDigitado(g('campoCodigoNovo'));
      if (!codigo) { Coop.status('Código inválido: use de 4 a 8 letras ou números.'); return; }
      Som.clique();
      Coop.abrir(codigo);
    };
    g('btConectarSala').onclick = () => {
      const codigo = UI.codigoDigitado(g('campoCodigoEntrar'));
      if (!codigo) { Coop.status('Digite o código da sala (4 a 8 letras ou números).'); return; }
      Som.clique();
      Coop.entrar(codigo);
    };
    g('btCopiarCodigo').onclick = () => {
      Som.clique();
      const texto = Coop.codigo || '';
      if (navigator.clipboard) navigator.clipboard.writeText(texto).then(() => Coop.status('Código copiado: ' + texto), () => Coop.status('Copie na mão: ' + texto));
      else Coop.status('Copie na mão: ' + texto);
    };
    g('btMinhaClasse').onclick = () => { Som.clique(); Coop.intencao = 'sala'; UI.mostrarTela('classes'); };
    g('btComecarSala').onclick = () => { Som.clique(); Som.destravar(); Coop.comecar(); };

    const servidor = g('campoServidor');
    servidor.value = Coop.servidorSalvo();
    servidor.onchange = () => {
      Coop.guardarServidor(servidor.value.trim());
      UI.avisarServidor();
      Coop.status(servidor.value.trim() ? 'Servidor de salas salvo neste aparelho.' : 'Voltou a usar o servidor deste endereço.');
    };
  },

  codigoDigitado(campo) {
    const valor = campo.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    campo.value = valor;
    return /^[A-Z0-9]{4,8}$/.test(valor) ? valor : '';
  },

  // Site publicado sem WebSocket (Vercel): melhor avisar antes do clique do que
  // deixar o jogador esperando uma sala que nunca vai abrir.
  avisarServidor() {
    const caixa = document.getElementById('avisoServidor');
    if (!caixa) return;
    // Só avisa quando o servidor usado não é o do próprio endereço — aí vale
    // dizer de onde vêm as salas e que a primeira pode demorar a acordar.
    const emprestado = !Coop.servidorSalvo() && !Coop.hospedaSalas();
    caixa.hidden = !emprestado;
    if (emprestado) {
      caixa.innerHTML = 'Este endereço não hospeda salas, então o jogo usa o servidor '
        + '<b>' + UI.escapar(new URL(Coop.SERVIDOR_PADRAO.replace('wss://', 'https://')).hostname) + '</b>. '
        + 'Ele hiberna quando fica parado: a primeira sala do dia pode levar uns 50 segundos para abrir.';
    }
  },

  abrirSala(modo) {
    UI.modoSala = modo;
    if (modo === 'criar' && !document.getElementById('campoCodigoNovo').value) {
      document.getElementById('campoCodigoNovo').value = Coop.codigoSugerido();
    }
    Coop.status('');
    UI.mostrarTela('sala');
    UI.avisarServidor();
    UI.montarSala();
  },

  montarSala() {
    const g = (id) => document.getElementById(id);
    if (!g('blocoSala')) return;
    const dentro = Coop.fase === 'sala' || Coop.fase === 'partida';
    g('blocoCriar').hidden = dentro || UI.modoSala !== 'criar';
    g('blocoEntrar').hidden = dentro || UI.modoSala !== 'entrar';
    g('blocoSala').hidden = !dentro;
    g('salaTitulo').textContent = dentro
      ? (Coop.anfitriao() ? 'SUA SALA' : 'SALA DO ANFITRIÃO')
      : (UI.modoSala === 'entrar' ? 'ENTRAR NUMA SALA' : 'CRIAR UMA SALA');
    if (!dentro) return;

    UI.el.codigoSala.textContent = Coop.codigo || '------';
    const nomeClasse = (id) => (CLASSES.find((c) => c.id === id) || {}).nome || '';
    const minha = Coop.minhaClasse ? nomeClasse(Coop.minhaClasse) : '';
    g('btMinhaClasse').textContent = minha ? 'TROCAR CLASSE (' + minha + ')' : 'ESCOLHER MINHA CLASSE';
    g('btComecarSala').hidden = !Coop.anfitriao();

    const lista = Coop.listaSala.length ? Coop.listaSala : [{ id: 'anfitriao', nome: Perfil.exibir().toUpperCase(), classe: Coop.minhaClasse, anfitriao: true }];
    let html = '';
    for (const m of lista) {
      const classe = m.classe ? nomeClasse(m.classe) : 'escolhendo classe…';
      html += '<div class="sala-vaga' + (m.classe ? '' : ' esperando') + '">'
        + '<b>' + UI.escapar(m.nome || 'COLEGA') + (m.anfitriao ? ' · ANFITRIÃO' : '') + '</b>'
        + '<span>' + UI.escapar(classe.toUpperCase()) + '</span></div>';
    }
    for (let i = lista.length; i < Coop.MAX_JOGADORES; i++) {
      html += '<div class="sala-vaga esperando"><b>VAGA LIVRE</b><span>—</span></div>';
    }
    UI.el.listaSala.innerHTML = html;
    UI.el.salaAviso.textContent = Coop.anfitriao()
      ? (Coop.minhaClasse ? 'Comece quando quiser: quem entrar depois cai direto na arena.' : 'Escolha sua classe para poder começar.')
      : (Coop.minhaClasse ? 'Pronto. Esperando o anfitrião começar a partida.' : 'Escolha sua classe para entrar na arena quando começar.');
  },

  // Painel de equipe: quem está na arena, com que classe e com quanta vida.
  // Serve aos dois lados — o convidado monta a partir do snapshot recebido.
  montarEquipe() {
    const caixa = UI.el.salaEquipe;
    const sair = document.getElementById('btSairSala');
    if (sair) sair.classList.toggle('ativo', Coop.ativo());
    if (!caixa) return;
    if (!Coop.ativo()) { caixa.hidden = true; caixa.innerHTML = ''; return; }

    const linha = (j, eu) => {
      if (!j || !j.attr) return '';
      const vida = Mat.limitar(j.vida / j.attr.vidaMax, 0, 1) * 100;
      const nome = (eu ? Perfil.exibir() : (j.nome || 'COLEGA')).slice(0, 12);
      return '<div class="eq-linha' + (eu ? ' eu' : '') + (j.vida <= 0 ? ' caido' : '') + '">'
        + '<i class="eq-cor" style="background:' + j.skin.cor + '"></i>'
        + '<span class="eq-nome">' + UI.escapar(nome) + '</span>'
        + '<span class="eq-classe">' + UI.escapar(j.classe.nome) + '</span>'
        + '<span class="eq-vida"><i style="width:' + vida.toFixed(0) + '%"></i></span>'
        + '</div>';
    };

    let html = '<div class="eq-titulo">SALA ' + UI.escapar(Coop.codigo || '--') + '</div>';
    html += linha(Jogo.jogador, true);
    for (const outro of Jogo.outros.values()) html += linha(outro, false);
    caixa.innerHTML = html;
    caixa.hidden = false;
  },

  // Quando o anfitrião abre uma carta de melhoria a partida para para todo
  // mundo; o convidado precisa saber que não travou.
  atualizarEspera() {
    const el = UI.el.salaEspera;
    if (!el) return;
    const esperando = Coop.convidado() && Coop.esperando;
    el.hidden = !esperando;
    if (esperando) el.textContent = 'O ANFITRIÃO ESTÁ ESCOLHENDO UMA MELHORIA…';
  },

  atualizarStatusPlacar() {
    const el = UI.el.statusPlacar;
    if (!el) return;
    if (Coop.papel) {
      el.textContent = 'Partida cooperativa: ranking de equipe ainda indisponível.';
      el.className = 'status-placar neutro';
      return;
    }
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
      const preenchimento = Mat.limitar(j.vida - i, 0, 1);
      UI._coracoes[i].style.setProperty('--p', preenchimento * 100 + '%');
    }

    UI.el.pontos.textContent = Math.round(Jogo.pontos).toLocaleString('pt-BR');
    // No segredo não existe contagem de onda: a corrida já terminou.
    UI.el.onda.textContent = Jogo.segredo && Jogo.segredo.fase
      ? '???'
      : Jogo.onda + '/' + Jogo.TOTAL_ONDAS;
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
    UI.el.classeNome.textContent = j.classe.nome;

    // buffs temporários
    const buffs = [];
    if (j.frenesi > 0) buffs.push('<span class="buff verde">⚡ FRENESI ' + j.frenesi.toFixed(1) + 's</span>');
    if (Jogo.imaGlobal > 0) buffs.push('<span class="buff roxo">◈ ÍMÃ ' + Jogo.imaGlobal.toFixed(1) + 's</span>');
    if (j.escudoAtivo) buffs.push('<span class="buff amarelo">⛨ ESCUDO ' + j.escudoRestante.toFixed(1) + 's</span>');
    if (j.ultAtiva > 0) buffs.push('<span class="buff vermelho">★ ULT ' + j.ultAtiva.toFixed(1) + 's</span>');
    UI.el.buffs.innerHTML = buffs.join('');
    UI.atualizarEspera();
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
    // Quem regenera avisa na cara: é para o jogador entender que a barra volta
    // por regra do jogo, não por bug.
    UI.el.bossTitulo.textContent = boss.def.invencivel
      ? boss.def.titulo + ' · IMORTAL'
      : boss.def.regenera
        ? boss.def.titulo + ' · REGENERAÇÃO ABSOLUTA'
        : boss.def.titulo;
    UI.el.bossBarra.style.setProperty('--cor-boss', boss.def.cor);
  },
  atualizarBarraBoss(boss) {
    // Barra do invencível não se move: mostrar ela andando seria mentira.
    UI.el.bossFill.style.width = boss.def.invencivel ? '100%' : (boss.porcentagem * 100) + '%';
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
    const mapa = { dash: 'Space', escudo: 'KeyQ', ult: 'ShiftLeft' };
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
