/* Conta do jogador. O token Google é validado no servidor; a sessão fica em
   cookie HttpOnly e nunca é exposta ao JavaScript do jogo. */
const Conta = {
  atual: null,

  async requisitar(url, opcoes) {
    const resposta = await fetch(url, Object.assign({ credentials: 'same-origin' }, opcoes || {}));
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) throw new Error(dados.erro || 'serviço indisponível');
    return dados;
  },

  async iniciar() {
    try {
      const dados = await Conta.requisitar('/api/conta');
      Conta.aplicar(dados.conta);
      if (dados.conta) await Conta.sincronizarRecordes();
    } catch (e) { Conta.aplicar(null); }
    const compra = new URLSearchParams(location.search).get('compra');
    if (compra) {
      history.replaceState({}, '', location.pathname + location.hash);
      if (compra === 'sucesso') await Conta.aguardarCompra();
      else if (typeof Loja !== 'undefined') Loja.avisar('COMPRA CANCELADA. NADA FOI COBRADO.');
    }
    if (!Conta.atual) await Conta.prepararGoogle();
  },

  aplicar(conta) {
    Conta.atual = conta || null;
    const caixa = document.getElementById('contaMenu');
    const perfil = document.getElementById('contaPerfil');
    const login = document.getElementById('googleLogin');
    if (!caixa || !perfil || !login) return;
    caixa.classList.toggle('logada', !!conta);
    perfil.hidden = !conta;
    login.hidden = !!conta;
    if (!conta) return;
    document.getElementById('contaNome').textContent = conta.nome;
    const foto = document.getElementById('contaFoto');
    foto.hidden = !conta.foto;
    if (conta.foto) foto.src = conta.foto;
    Carteira.nucleus = Math.max(0, Math.round(Number(conta.nucleus) || 0));
    if (Array.isArray(conta.classes)) {
      for (const item of conta.classes) {
        if (/^classe-(espectro|invocador|desenvolvedor)$/.test(item) && !Carteira.itens.includes(item)) {
          Carteira.itens.push(item);
        }
      }
    }
    Carteira.salvar();
    if (typeof UI !== 'undefined') UI.atualizarMoedas();
    if (typeof Loja !== 'undefined' && Loja.aba === 'nucleus') Loja.montarPacotes();
  },

  carregarGoogle() {
    if (window.google && google.accounts) return Promise.resolve();
    return new Promise((resolver, rejeitar) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true; script.defer = true;
      script.onload = resolver; script.onerror = rejeitar;
      document.head.appendChild(script);
    });
  },

  async prepararGoogle() {
    const alvo = document.getElementById('googleLogin');
    if (!alvo) return;
    try {
      const config = await Conta.requisitar('/api/config-publica');
      if (!config.googleClientId) throw new Error('Google não configurado');
      await Conta.carregarGoogle();
      google.accounts.id.initialize({ client_id: config.googleClientId, callback: Conta.receberGoogle });
      alvo.textContent = '';
      google.accounts.id.renderButton(alvo, {
        type: 'standard', theme: 'filled_black', size: 'medium', shape: 'pill', text: 'signin_with'
      });
    } catch (e) { alvo.textContent = 'LOGIN GOOGLE EM CONFIGURAÇÃO'; }
  },

  async receberGoogle(resposta) {
    try {
      const dados = await Conta.requisitar('/api/auth-google', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: resposta.credential })
      });
      Conta.aplicar(dados.conta);
      await Conta.sincronizarRecordes();
      if (typeof Loja !== 'undefined') Loja.avisar('CONTA GOOGLE CONECTADA.');
    } catch (e) {
      if (typeof Loja !== 'undefined') Loja.avisar('NÃO FOI POSSÍVEL ENTRAR COM GOOGLE.');
    }
  },

  async sair() {
    try { await Conta.requisitar('/api/sair', { method: 'POST' }); } catch (e) {}
    Conta.aplicar(null);
    await Conta.prepararGoogle();
  },

  async comprarStripe(pacote) {
    if (!Conta.atual) { Loja.avisar('ENTRE COM GOOGLE NO MENU ANTES DE COMPRAR.'); return; }
    try {
      Loja.avisar('ABRINDO PAGAMENTO SEGURO…');
      const dados = await Conta.requisitar('/api/stripe-checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ produto: pacote.id })
      });
      try { localStorage.setItem('sniper.nucleus-antes-checkout', String(Carteira.nucleus)); } catch (e) {}
      location.assign(dados.url);
    } catch (e) {
      Loja.avisar(String(e.message || 'NÃO FOI POSSÍVEL ABRIR O PAGAMENTO.').toUpperCase());
      Som.erro();
    }
  },

  async desbloquearClasse(classe) {
    if (!Conta.atual) throw new Error('ENTRE COM GOOGLE ANTES DE DESBLOQUEAR.');
    const dados = await Conta.requisitar('/api/desbloquear-classe', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classe })
    });
    Conta.atual.nucleus = dados.nucleus;
    Conta.atual.classes = dados.classes;
    Conta.aplicar(Conta.atual);
    return dados;
  },

  async sincronizarRecordes() {
    if (!Conta.atual || typeof Recordes === 'undefined') return;
    try {
      const dados = await Conta.requisitar('/api/meus-recordes');
      Recordes.mesclarDaConta(dados.recordes);
    } catch (e) { /* recorde local continua funcionando offline */ }
  },

  async aguardarCompra() {
    if (typeof Loja !== 'undefined') Loja.avisar('PAGAMENTO RECEBIDO. CONFIRMANDO NUCLEUS…');
    let anterior = -1;
    try { anterior = Number(localStorage.getItem('sniper.nucleus-antes-checkout')); } catch (e) {}
    for (let tentativa = 0; tentativa < 8; tentativa++) {
      try {
        const dados = await Conta.requisitar('/api/conta');
        Conta.aplicar(dados.conta);
        if (dados.conta && Number(dados.conta.nucleus) > anterior) {
          try { localStorage.removeItem('sniper.nucleus-antes-checkout'); } catch (e) {}
          if (typeof Loja !== 'undefined') Loja.avisar('COMPRA CONFIRMADA. NUCLEUS ATUALIZADOS.');
          return;
        }
      } catch (e) {}
      await new Promise((resolver) => setTimeout(resolver, 1200));
    }
    if (typeof Loja !== 'undefined') Loja.avisar('PAGAMENTO EM PROCESSAMENTO. O SALDO ATUALIZA AUTOMATICAMENTE.');
  }
};

addEventListener('load', () => {
  const sair = document.getElementById('btSairConta');
  if (sair) sair.addEventListener('click', () => Conta.sair());
  Conta.iniciar();
});
