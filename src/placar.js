/* ===========================================================================
   PLACAR.JS — nome do jogador e placar mundial (opcional, via REST).

   Perfil : o nome fica no navegador de quem joga.
   Placar : envia a run pro placar compartilhado e lê o top geral.
            Se não estiver configurado ou a internet cair, o jogo segue igual —
            o placar local nunca depende disso.
   =========================================================================== */

/* ------------------------------- Perfil -------------------------------- */
const Perfil = {
  nome: '',
  MAX: 12,

  carregar() {
    try { Perfil.nome = localStorage.getItem('sniper.nome') || ''; }
    catch (e) { Perfil.nome = ''; }
  },

  salvar(nome) {
    Perfil.nome = Perfil.limpar(nome);
    try { localStorage.setItem('sniper.nome', Perfil.nome); } catch (e) { /* modo privado */ }
    return Perfil.nome;
  },

  // maiúsculas, sem acento estranho, sem símbolo, no máximo 12 caracteres
  limpar(nome) {
    return (nome || '')
      .toUpperCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z0-9 ._-]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, Perfil.MAX);
  },

  // o placar é público: barra o punhado de palavras que só serviriam pra sujar
  PROIBIDAS: ['VIADO', 'PUTA', 'CARALHO', 'BUCETA', 'PORRA', 'FDP', 'MACACO', 'NAZI', 'HITLER'],

  valido(nome) {
    const n = Perfil.limpar(nome);
    if (n.length < 2) return { ok: false, motivo: 'Use pelo menos 2 caracteres.' };
    for (const p of Perfil.PROIBIDAS) {
      if (n.replace(/[ ._-]/g, '').indexOf(p) >= 0) {
        return { ok: false, motivo: 'Esse nome não entra no placar público.' };
      }
    }
    return { ok: true, nome: n };
  },

  exibir() { return Perfil.nome || 'ANÔNIMO'; }
};

/* ---------------------------- Placar mundial ---------------------------- */
const Placar = {
  ultimoEnvio: null,   // 'enviando' | 'ok' | 'erro' | null
  cache: null,
  cacheEm: 0,

  configurado() {
    return !!PLACAR_CONFIG.url;
  },

  _endereco(consulta) {
    return Placar._base().replace(/\/+$/, '') + (consulta || '');
  },

  /* Envia a run. Nunca lança: o jogo não pode quebrar por causa da rede. */
  async enviar(entrada) {
    if (!Placar.configurado()) { Placar.ultimoEnvio = null; return false; }
    Placar.ultimoEnvio = 'enviando';
    try {
      const resposta = await fetch(Placar._endereco(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: entrada.nome,
          pontos: entrada.pontos,
          classe: entrada.classe,
          onda: entrada.onda,
          nivel: entrada.nivel,
          tempo: entrada.tempo,
          abates: entrada.abates,
          venceu: entrada.venceu
        })
      });
      if (!resposta.ok && Placar._podeTentarReserva()) {
        let motivo = '';
        try { motivo = (await resposta.json()).erro || ''; } catch (e) { /* corpo sem json */ }
        if (/banco|DATABASE_URL/i.test(motivo)) {
          Placar.usandoReserva = true;
          return Placar.enviar(entrada);
        }
      }
      Placar.ultimoEnvio = resposta.ok ? 'ok' : 'erro';
      if (resposta.ok) Placar.cache = null;   // força recarregar o top
      return resposta.ok;
    } catch (e) {
      Placar.ultimoEnvio = 'erro';
      return false;
    }
  },

  /* Lê o top geral. Devolve null quando não dá — quem chama decide o que mostrar. */
  ultimoErro: '',
  usandoReserva: false,

  // Endereço em uso: começa no do próprio site e cai para a reserva assim que
  // o site responde que está sem banco configurado.
  _base() {
    return (Placar.usandoReserva && PLACAR_CONFIG.reserva) ? PLACAR_CONFIG.reserva : PLACAR_CONFIG.url;
  },
  // Só vale tentar a reserva se ela existir e não for o próprio endereço.
  _podeTentarReserva() {
    if (!PLACAR_CONFIG.reserva || Placar.usandoReserva) return false;
    try { return new URL(PLACAR_CONFIG.reserva, location.href).host !== location.host; }
    catch (e) { return false; }
  },

  async top(forcar) {
    if (!Placar.configurado()) return null;
    Placar.ultimoErro = '';
    const agora = Date.now();
    if (!forcar && Placar.cache && agora - Placar.cacheEm < 30000) return Placar.cache;
    try {
      const resposta = await fetch(Placar._endereco('?limite=' + PLACAR_CONFIG.limite));
      if (!resposta.ok) {
        // Guarda o motivo que a API deu: "sem banco configurado" é problema de
        // deploy, não de rede, e a tela precisa dizer isso em vez de chutar.
        Placar.ultimoErro = '';
        try { Placar.ultimoErro = (await resposta.json()).erro || ''; } catch (e) { /* corpo sem json */ }
        // Site sem banco: tenta o servidor de reserva uma vez antes de desistir.
        if (/banco|DATABASE_URL/i.test(Placar.ultimoErro) && Placar._podeTentarReserva()) {
          Placar.usandoReserva = true;
          return Placar.top(true);
        }
        return null;
      }
      const linhas = await resposta.json();
      if (!Array.isArray(linhas)) return null;
      Placar.cache = linhas;
      Placar.cacheEm = agora;
      return linhas;
    } catch (e) {
      return null;
    }
  }
};
