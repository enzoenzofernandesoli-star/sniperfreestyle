/* Google Play Billing para o TWA. A Digital Goods API só existe dentro do app
   instalado pela Play; no navegador comum a loja continua visível, mas não
   oferece um pagamento alternativo que violaria a política da plataforma. */
const Pagamento = {
  LOJA: 'https://play.google.com/billing',
  CHAVE_INSTALACAO: 'sniper.instalacao',
  CHAVE_RECIBOS: 'sniper.recibos-google',
  servico: null,
  detalhes: new Map(),
  preparando: null,

  idInstalacao() {
    let id = '';
    try { id = localStorage.getItem(Pagamento.CHAVE_INSTALACAO) || ''; } catch (e) {}
    if (/^[A-Za-z0-9_-]{20,80}$/.test(id)) return id;
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    id = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    try { localStorage.setItem(Pagamento.CHAVE_INSTALACAO, id); } catch (e) {}
    return id;
  },

  recibos() {
    try { return JSON.parse(localStorage.getItem(Pagamento.CHAVE_RECIBOS) || '[]'); }
    catch (e) { return []; }
  },
  lembrar(token) {
    const hash = String(token);
    const lista = Pagamento.recibos();
    if (!lista.includes(hash)) lista.push(hash);
    try { localStorage.setItem(Pagamento.CHAVE_RECIBOS, JSON.stringify(lista.slice(-100))); } catch (e) {}
  },

  async preparar() {
    if (Pagamento.servico || Pagamento.preparando) return Pagamento.preparando;
    Pagamento.preparando = (async () => {
      if (!('getDigitalGoodsService' in window) || !('PaymentRequest' in window)) return false;
      try {
        Pagamento.servico = await window.getDigitalGoodsService(Pagamento.LOJA);
        const itens = await Pagamento.servico.getDetails(PACOTES_NUCLEUS.map((p) => p.id));
        for (const item of itens) Pagamento.detalhes.set(item.itemId, item);
        if (typeof Loja !== 'undefined' && Loja.aba === 'nucleus') Loja.montarPacotes();
        return true;
      } catch (e) {
        Pagamento.servico = null;
        return false;
      }
    })();
    return Pagamento.preparando;
  },

  preco(pacote) {
    const item = Pagamento.detalhes.get(pacote.id);
    if (!item || !item.price) return pacote.preco;
    return new Intl.NumberFormat(navigator.language || 'pt-BR', {
      style: 'currency', currency: item.price.currency
    }).format(item.price.value);
  },

  async validar(pacote, token) {
    const resposta = await fetch('/api/compra-google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ produto: pacote.id, token, instalacao: Pagamento.idInstalacao() })
    });
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok || dados.nucleus !== pacote.nucleus) throw new Error(dados.erro || 'recibo recusado');
    return dados;
  },

  async iniciar(pacote) {
    if (!pacote || !PACOTES_NUCLEUS.some((p) => p.id === pacote.id)) return;
    if (!('getDigitalGoodsService' in window)) {
      if (typeof Conta !== 'undefined') await Conta.comprarStripe(pacote);
      return;
    }
    Loja.avisar('ABRINDO GOOGLE PLAY…');
    if (!(await Pagamento.preparar())) {
      Loja.avisar('COMPRAS DISPONÍVEIS SOMENTE NO APP INSTALADO PELA GOOGLE PLAY.');
      Som.erro();
      return;
    }
    let resposta;
    try {
      const pedido = new PaymentRequest([{ supportedMethods: Pagamento.LOJA, data: { sku: pacote.id } }], {
        total: { label: 'NUCLEUS', amount: { currency: 'BRL', value: '0' } }
      });
      resposta = await pedido.show();
      const token = resposta && resposta.details && resposta.details.purchaseToken;
      if (!token) throw new Error('token ausente');
      const chaveLocal = pacote.id + ':' + token;
      await Pagamento.validar(pacote, token);
      if (!Pagamento.recibos().includes(chaveLocal)) {
        Carteira.creditarNucleus(pacote.nucleus);
        Pagamento.lembrar(chaveLocal);
      }
      await Pagamento.servico.consume(token);
      await resposta.complete('success');
      Som.subirNivel();
      Loja.avisar(pacote.nucleus.toLocaleString('pt-BR') + ' NUCLEUS ADICIONADOS.');
      Loja.montarPacotes();
    } catch (e) {
      if (resposta) await resposta.complete('fail').catch(() => {});
      if (e && e.name !== 'AbortError') Loja.avisar('NÃO FOI POSSÍVEL VALIDAR A COMPRA. NADA FOI COBRADO NOVAMENTE.');
    }
  }
};

addEventListener('load', () => Pagamento.preparar());
