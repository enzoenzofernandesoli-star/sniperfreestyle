/* ===========================================================================
   LOJA.JS — moedas, catálogo de cosméticos e a tela da lojinha.

   A cor deixou de pertencer à classe: agora tudo que é aparência sai daqui e
   vale para as cinco classes. Quem paga é a moeda, que cai do inimigo morto.
   Nada aqui mexe em atributo, dano ou pontuação — é só aparência.
   =========================================================================== */

/* ------------------------------- Carteira -------------------------------- */
const Carteira = {
  CHAVE: 'sniper.loja',
  moedas: 0,
  ganhasNaPartida: 0,
  itens: ['casco-original', 'tiro-lima', 'acessorio-nenhum', 'emoji-nenhum'],
  equipado: { casco: 'casco-original', tiro: 'tiro-lima', acessorio: 'acessorio-nenhum', emoji: 'emoji-nenhum' },

  carregar() {
    let bruto = null;
    try { bruto = JSON.parse(localStorage.getItem(Carteira.CHAVE) || 'null'); }
    catch (e) { bruto = null; }
    if (!bruto) return;
    Carteira.moedas = Math.max(0, Math.round(Number(bruto.moedas) || 0));
    if (Array.isArray(bruto.itens)) {
      for (const id of bruto.itens) if (!Carteira.itens.includes(id)) Carteira.itens.push(id);
    }
    if (bruto.equipado) {
      for (const tipo of Object.keys(Carteira.equipado)) {
        const id = bruto.equipado[tipo];
        if (id && Carteira.tem(id)) Carteira.equipado[tipo] = id;
      }
    }
  },

  salvar() {
    try {
      localStorage.setItem(Carteira.CHAVE, JSON.stringify({
        moedas: Carteira.moedas, itens: Carteira.itens, equipado: Carteira.equipado
      }));
    } catch (e) { /* modo privado: a carteira vale só nesta sessão */ }
  },

  tem(id) { return Carteira.itens.indexOf(id) !== -1; },

  // A moeda cai no bolso na hora em que é apanhada. Morrer não tira nada: o
  // castigo de perder já é perder a run.
  ganhar(n) {
    const q = Math.max(0, Math.round(n));
    if (!q) return;
    Carteira.moedas += q;
    Carteira.ganhasNaPartida += q;
    Carteira.salvar();
    if (typeof UI !== 'undefined' && UI.atualizarMoedas) UI.atualizarMoedas();
  },

  gastar(n) {
    if (Carteira.moedas < n) return false;
    Carteira.moedas -= n;
    Carteira.salvar();
    if (typeof UI !== 'undefined' && UI.atualizarMoedas) UI.atualizarMoedas();
    return true;
  }
};

/* ------------------------------- Catálogo -------------------------------- */
/* Preço alto de propósito: nada aqui sai em uma partida. O barato pede umas   */
/* três runs boas; o topo da vitrine é meta de temporada, não de tarde.        */

const CASCOS = [
  { id: 'casco-original', nome: 'Original', preco: 0, cor: '#31e0ff', cor2: '#0b7fa8' },
  { id: 'casco-polar', nome: 'Polar', preco: 900, cor: '#e6fbff', cor2: '#5289a9' },
  { id: 'casco-jade', nome: 'Jade', preco: 1200, cor: '#65f0ad', cor2: '#1c7658' },
  { id: 'casco-solar', nome: 'Solar', preco: 1200, cor: '#ff9f43', cor2: '#87371c' },
  { id: 'casco-veneno', nome: 'Veneno', preco: 1800, cor: '#b6ff49', cor2: '#4d7916' },
  { id: 'casco-rubi', nome: 'Rubi', preco: 2200, cor: '#ff6588', cor2: '#87284f' },
  { id: 'casco-sombra', nome: 'Sombra', preco: 2800, cor: '#b28aff', cor2: '#4c2b77' },
  { id: 'casco-abissal', nome: 'Abissal', preco: 3500, cor: '#6db6ff', cor2: '#1c3f70' },
  { id: 'casco-enxofre', nome: 'Enxofre', preco: 4200, cor: '#ffe14d', cor2: '#7a6410' },
  { id: 'casco-aurora', nome: 'Aurora', preco: 5600, cor: '#6cf5e9', cor2: '#225c79' },
  { id: 'casco-magma', nome: 'Magma', preco: 7500, cor: '#ff5324', cor2: '#6b1200' },
  { id: 'casco-void', nome: 'Vazio', preco: 10000, cor: '#20122e', cor2: '#7a3cff' },
  { id: 'casco-ouro', nome: 'Ouro Puro', preco: 16000, cor: '#ffd34d', cor2: '#8a6100' },
  { id: 'casco-prisma', nome: 'Prisma', preco: 30000, cor: '#ff6cd4', cor2: '#6cf5e9', vivo: true }
];

const TIROS = [
  { id: 'tiro-lima', nome: 'Lima', preco: 0, cor: '#dcff46', critico: '#ffffff' },
  { id: 'tiro-gelo', nome: 'Gelo', preco: 1000, cor: '#9be8ff', critico: '#ffffff' },
  { id: 'tiro-sangue', nome: 'Sangue', preco: 1400, cor: '#ff5470', critico: '#ffd9df' },
  { id: 'tiro-ametista', nome: 'Ametista', preco: 1800, cor: '#c98bff', critico: '#ffffff' },
  { id: 'tiro-brasa', nome: 'Brasa', preco: 2400, cor: '#ff9224', critico: '#fff0b0' },
  { id: 'tiro-esmeralda', nome: 'Esmeralda', preco: 3200, cor: '#4dffa3', critico: '#e6fff2' },
  { id: 'tiro-choque', nome: 'Choque', preco: 4800, cor: '#7cd4ff', critico: '#fbff00' },
  { id: 'tiro-rosa', nome: 'Rosa Neon', preco: 6200, cor: '#ff5ce1', critico: '#ffffff' },
  { id: 'tiro-ouro', nome: 'Ouro', preco: 11000, cor: '#ffd34d', critico: '#fff6cf' },
  { id: 'tiro-breu', nome: 'Breu', preco: 17000, cor: '#2b1a45', critico: '#b06dff' },
  { id: 'tiro-prisma', nome: 'Prisma', preco: 27000, cor: '#ffffff', critico: '#ffffff', vivo: true }
];

const ACESSORIOS = [
  { id: 'acessorio-nenhum', nome: 'Nenhum', preco: 0 },
  { id: 'acessorio-antena', nome: 'Antena', preco: 1100 },
  { id: 'acessorio-chifres', nome: 'Chifres', preco: 2000 },
  { id: 'acessorio-capa', nome: 'Capa', preco: 3000 },
  { id: 'acessorio-cartola', nome: 'Cartola', preco: 4000 },
  { id: 'acessorio-aureola', nome: 'Auréola', preco: 5200 },
  { id: 'acessorio-asas', nome: 'Asas', preco: 7200 },
  { id: 'acessorio-coroa', nome: 'Coroa', preco: 10000 },
  { id: 'acessorio-orbe', nome: 'Orbe Guardião', preco: 14000 }
];

const EMOJIS = [
  { id: 'emoji-nenhum', nome: 'Nenhum', preco: 0, glifo: '' },
  { id: 'emoji-cocô', nome: 'Cocô', preco: 800, glifo: '💩' },
  { id: 'emoji-oculos', nome: 'De Boa', preco: 1200, glifo: '😎' },
  { id: 'emoji-fogo', nome: 'Fogo', preco: 1500, glifo: '🔥' },
  { id: 'emoji-caveira', nome: 'Caveira', preco: 1800, glifo: '💀' },
  { id: 'emoji-cowboy', nome: 'Cowboy', preco: 2000, glifo: '🤠' },
  { id: 'emoji-palhaco', nome: 'Palhaço', preco: 2200, glifo: '🤡' },
  { id: 'emoji-raio', nome: 'Raio', preco: 2400, glifo: '⚡' },
  { id: 'emoji-et', nome: 'ET', preco: 2700, glifo: '👽' },
  { id: 'emoji-pizza', nome: 'Pizza', preco: 3000, glifo: '🍕' },
  { id: 'emoji-gelado', nome: 'Congelante', preco: 3400, glifo: '🥶' },
  { id: 'emoji-tubarao', nome: 'Tubarão', preco: 4000, glifo: '🦈' },
  { id: 'emoji-diabo', nome: 'Diabinho', preco: 4500, glifo: '😈' },
  { id: 'emoji-foguete', nome: 'Foguete', preco: 5000, glifo: '🚀' },
  { id: 'emoji-cerebro', nome: 'Cérebro', preco: 5800, glifo: '🧠' },
  { id: 'emoji-robo', nome: 'Robô', preco: 6500, glifo: '🤖' },
  { id: 'emoji-arcoiris', nome: 'Arco-íris', preco: 7500, glifo: '🌈' },
  { id: 'emoji-coroa', nome: 'Coroa', preco: 9000, glifo: '👑' },
  { id: 'emoji-diamante', nome: 'Diamante', preco: 12500, glifo: '💎' },
  { id: 'emoji-goat', nome: 'GOAT', preco: 22000, glifo: '🐐' }
];

const VITRINES = [
  { chave: 'casco', titulo: 'COR DA NAVE', itens: CASCOS },
  { chave: 'tiro', titulo: 'COR DO TIRO', itens: TIROS },
  { chave: 'acessorio', titulo: 'ACESSÓRIOS', itens: ACESSORIOS },
  { chave: 'emoji', titulo: 'EMOJIS', itens: EMOJIS }
];

// Pacotes de moeda com dinheiro de verdade. O meio de pagamento entra depois:
// aqui fica só a vitrine e o gancho `Pagamento.iniciar`, que ainda não existe.
const PACOTES_MOEDA = [
  { id: 'pacote-p', moedas: 1200, preco: 'R$ 4,90', selo: '' },
  { id: 'pacote-m', moedas: 3500, preco: 'R$ 12,90', selo: '+17% de bônus' },
  { id: 'pacote-g', moedas: 9000, preco: 'R$ 29,90', selo: 'MAIS POPULAR' },
  { id: 'pacote-gg', moedas: 28000, preco: 'R$ 79,90', selo: 'MELHOR VALOR' }
];

/* --------------------------- Consultas rápidas --------------------------- */
const Cosmeticos = {
  achar(lista, id) { return lista.find((i) => i.id === id) || lista[0]; },

  // Cor viva do PRISMA: gira no círculo de matiz em vez de ser fixa.
  matiz(desloc) {
    const t = (typeof Jogo !== 'undefined' ? Jogo.tempo : Date.now() / 1000);
    return 'hsl(' + Math.round((t * 90 + (desloc || 0)) % 360) + ' 100% 62%)';
  },

  casco() { return Cosmeticos.achar(CASCOS, Carteira.equipado.casco); },

  // Tons de agora deste casco. Só o PRISMA muda de quadro para quadro; para o
  // resto isto devolve o próprio item, sem alocar nada.
  tons(item) {
    if (!item || !item.vivo) return item || CASCOS[0];
    return { cor: Cosmeticos.matiz(0), cor2: Cosmeticos.matiz(140) };
  },

  tiro() {
    const item = Cosmeticos.achar(TIROS, Carteira.equipado.tiro);
    if (!item.vivo) return { jogador: item.cor, critico: item.critico };
    return { jogador: Cosmeticos.matiz(0), critico: Cosmeticos.matiz(180) };
  },

  acessorio() { return Carteira.equipado.acessorio; },
  emoji() { return Cosmeticos.achar(EMOJIS, Carteira.equipado.emoji).glifo; }
};

// Acessórios que ocupam o espaço de cima da nave. O emoji sobe para não
// sentar em cima do chapéu.
const ACESSORIOS_ALTOS = ['acessorio-cartola', 'acessorio-aureola', 'acessorio-coroa'];

/* ----------------------- Desenho dos acessórios -------------------------- */
/* Vetorial e no mesmo espaço girado da nave, para o acessório acompanhar a   */
/* mira. Usado tanto no jogo quanto na miniatura da loja.                     */
function desenharAcessorio(ctx, id, raio, cor, cor2, anguloNave) {
  if (!id || id === 'acessorio-nenhum') return;
  ctx.save();
  // Chapéu, coroa e auréola ficam de pé no mundo: desfazem o giro da nave em
  // vez de rodar junto com a mira. O resto acompanha o casco.
  const emPe = -(anguloNave || 0);
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  const brilho = (typeof Jogo !== 'undefined' && Jogo.modoLeve) ? 0 : 14;

  if (id === 'acessorio-antena') {
    ctx.strokeStyle = '#dfe9f5';
    ctx.shadowBlur = brilho; ctx.shadowColor = cor;
    ctx.beginPath();
    ctx.moveTo(-raio * 0.2, -raio * 0.5);
    ctx.lineTo(-raio * 0.9, -raio * 1.7);
    ctx.stroke();
    ctx.fillStyle = '#ff4d6d';
    ctx.beginPath();
    ctx.arc(-raio * 0.9, -raio * 1.8, 3.4, 0, Math.PI * 2);
    ctx.fill();
  } else if (id === 'acessorio-chifres') {
    ctx.strokeStyle = '#ffe9c9';
    ctx.lineWidth = 3;
    ctx.shadowBlur = brilho; ctx.shadowColor = '#ff7043';
    for (const lado of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, lado * raio * 0.6);
      ctx.quadraticCurveTo(raio * 0.5, lado * raio * 1.5, raio * 1.2, lado * raio * 1.1);
      ctx.stroke();
    }
  } else if (id === 'acessorio-capa') {
    ctx.fillStyle = cor2;
    ctx.globalAlpha = 0.85;
    ctx.shadowBlur = brilho; ctx.shadowColor = cor2;
    const balanco = Math.sin((typeof Jogo !== 'undefined' ? Jogo.tempo : 0) * 7) * raio * 0.25;
    ctx.beginPath();
    ctx.moveTo(-raio * 0.3, -raio * 0.9);
    ctx.quadraticCurveTo(-raio * 2.1, balanco, -raio * 0.3, raio * 0.9);
    ctx.closePath();
    ctx.fill();
  } else if (id === 'acessorio-cartola') {
    ctx.save();
    ctx.rotate(emPe);
    ctx.fillStyle = '#12151f';
    ctx.strokeStyle = '#e9f6ff';
    ctx.fillRect(-raio * 0.9, -raio * 2.2, raio * 1.8, raio * 0.35);
    ctx.strokeRect(-raio * 0.9, -raio * 2.2, raio * 1.8, raio * 0.35);
    ctx.fillRect(-raio * 0.55, -raio * 3.3, raio * 1.1, raio * 1.15);
    ctx.strokeRect(-raio * 0.55, -raio * 3.3, raio * 1.1, raio * 1.15);
    ctx.fillStyle = cor;
    ctx.fillRect(-raio * 0.55, -raio * 2.55, raio * 1.1, raio * 0.3);
    ctx.restore();
  } else if (id === 'acessorio-aureola') {
    ctx.save();
    ctx.rotate(emPe);
    ctx.strokeStyle = '#ffe98a';
    ctx.lineWidth = 3;
    ctx.shadowBlur = brilho + 12; ctx.shadowColor = '#ffe98a';
    ctx.beginPath();
    ctx.ellipse(0, -raio * 2.1, raio * 0.95, raio * 0.33, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  } else if (id === 'acessorio-asas') {
    ctx.fillStyle = '#e9f6ff';
    ctx.globalAlpha = 0.8;
    ctx.shadowBlur = brilho; ctx.shadowColor = cor;
    const bater = Math.sin((typeof Jogo !== 'undefined' ? Jogo.tempo : 0) * 14) * raio * 0.3;
    for (const lado of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(-raio * 0.2, lado * raio * 0.4);
      ctx.quadraticCurveTo(-raio * 1.6, lado * (raio * 1.9 + bater), -raio * 1.9, lado * raio * 0.5);
      ctx.quadraticCurveTo(-raio * 1.2, lado * raio * 0.3, -raio * 0.2, lado * raio * 0.4);
      ctx.fill();
    }
  } else if (id === 'acessorio-coroa') {
    ctx.save();
    ctx.rotate(emPe);
    ctx.fillStyle = '#ffd34d';
    ctx.strokeStyle = '#8a6100';
    ctx.shadowBlur = brilho + 10; ctx.shadowColor = '#ffd34d';
    ctx.beginPath();
    ctx.moveTo(-raio * 0.9, -raio * 1.8);
    ctx.lineTo(-raio * 0.9, -raio * 2.9);
    ctx.lineTo(-raio * 0.3, -raio * 2.2);
    ctx.lineTo(0, -raio * 3.2);
    ctx.lineTo(raio * 0.3, -raio * 2.2);
    ctx.lineTo(raio * 0.9, -raio * 2.9);
    ctx.lineTo(raio * 0.9, -raio * 1.8);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
  } else if (id === 'acessorio-orbe') {
    const t = (typeof Jogo !== 'undefined' ? Jogo.tempo : 0) * 2.4;
    ctx.shadowBlur = brilho + 10; ctx.shadowColor = cor;
    ctx.fillStyle = cor;
    ctx.beginPath();
    ctx.arc(Math.cos(t) * raio * 2.1, Math.sin(t) * raio * 2.1, raio * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(Math.cos(t) * raio * 2.1, Math.sin(t) * raio * 2.1, raio * 0.13, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/* ------------------------------- Tela da loja ---------------------------- */
const Loja = {
  aba: 'casco',

  iniciar() {
    Carteira.carregar();
    const abas = document.getElementById('lojaAbas');
    if (!abas) return;
    abas.innerHTML = '';
    for (const v of VITRINES) {
      const bt = document.createElement('button');
      bt.type = 'button';
      bt.className = 'loja-aba';
      bt.dataset.aba = v.chave;
      bt.textContent = v.titulo;
      bt.onclick = () => { Som.clique(); Loja.abrirAba(v.chave); };
      abas.appendChild(bt);
    }
    const btMoedas = document.createElement('button');
    btMoedas.type = 'button';
    btMoedas.className = 'loja-aba moeda';
    btMoedas.dataset.aba = 'moedas';
    btMoedas.textContent = '＋ MOEDAS';
    btMoedas.onclick = () => { Som.clique(); Loja.abrirAba('moedas'); };
    abas.appendChild(btMoedas);
    Loja.abrirAba(Loja.aba);
  },

  abrirAba(chave) {
    Loja.aba = chave;
    document.querySelectorAll('.loja-aba').forEach((bt) => {
      bt.setAttribute('aria-pressed', String(bt.dataset.aba === chave));
    });
    if (chave === 'moedas') Loja.montarPacotes();
    else Loja.montarVitrine(VITRINES.find((v) => v.chave === chave));
    Loja.atualizarSaldo();
  },

  atualizarSaldo() {
    const el = document.getElementById('lojaSaldo');
    if (el) el.textContent = Carteira.moedas.toLocaleString('pt-BR');
    if (UI.atualizarMoedas) UI.atualizarMoedas();
  },

  montarVitrine(vitrine) {
    const grade = document.getElementById('lojaGrade');
    grade.innerHTML = '';
    grade.classList.remove('pacotes');
    for (const item of vitrine.itens) {
      const dono = Carteira.tem(item.id);
      const posto = Carteira.equipado[vitrine.chave] === item.id;
      const card = document.createElement('div');
      card.className = 'loja-item' + (posto ? ' equipado' : '') + (dono ? ' tenho' : '');
      card.innerHTML =
        '<div class="li-previa"></div>' +
        '<b class="li-nome">' + item.nome + '</b>' +
        '<span class="li-preco">' + (dono ? (posto ? 'EM USO' : 'DESBLOQUEADO')
          : '<i class="moeda-mini"></i>' + item.preco.toLocaleString('pt-BR')) + '</span>' +
        '<button type="button" class="li-bt"></button>';
      card.querySelector('.li-previa').appendChild(Loja.previa(vitrine.chave, item));
      const bt = card.querySelector('.li-bt');
      if (posto) { bt.textContent = 'EQUIPADO'; bt.disabled = true; }
      else if (dono) { bt.textContent = 'EQUIPAR'; bt.onclick = () => Loja.equipar(vitrine.chave, item); }
      else {
        bt.textContent = 'COMPRAR';
        bt.disabled = Carteira.moedas < item.preco;
        bt.onclick = () => Loja.comprar(vitrine.chave, item);
      }
      grade.appendChild(card);
    }
  },

  // Miniatura desenhada com o mesmo código do jogo: o que aparece aqui é
  // exatamente o que vai para a arena.
  previa(chave, item) {
    if (chave === 'emoji') {
      const span = document.createElement('span');
      span.className = 'li-emoji';
      span.textContent = item.glifo || '—';
      return span;
    }
    const tela = document.createElement('canvas');
    tela.width = 120; tela.height = 90;
    const ctx = tela.getContext('2d');
    const cor = item.vivo ? '#7cf2a0' : (item.cor || '#31e0ff');
    const cor2 = item.vivo ? '#b06dff' : (item.cor2 || '#0b7fa8');
    ctx.translate(60, 45);
    if (chave === 'tiro') {
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i === 3 ? item.critico : cor;
        ctx.shadowBlur = 12; ctx.shadowColor = ctx.fillStyle;
        ctx.beginPath();
        ctx.ellipse(-36 + i * 24, 0, 9, 5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      return tela;
    }
    const raio = 13;
    if (chave === 'acessorio') desenharAcessorio(ctx, item.id, raio, '#31e0ff', '#0b7fa8');
    const g = ctx.createLinearGradient(-raio, 0, raio, 0);
    g.addColorStop(0, chave === 'acessorio' ? '#0b7fa8' : cor2);
    g.addColorStop(1, chave === 'acessorio' ? '#31e0ff' : cor);
    ctx.shadowBlur = 16; ctx.shadowColor = cor;
    ctx.beginPath();
    ctx.moveTo(raio + 4, 0);
    ctx.lineTo(-2, -raio);
    ctx.lineTo(-raio, 0);
    ctx.lineTo(-2, raio);
    ctx.closePath();
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#f2fbff';
    ctx.stroke();
    return tela;
  },

  montarPacotes() {
    const grade = document.getElementById('lojaGrade');
    grade.innerHTML = '';
    grade.classList.add('pacotes');
    for (const p of PACOTES_MOEDA) {
      const card = document.createElement('div');
      card.className = 'loja-item pacote';
      card.innerHTML =
        '<div class="pa-moeda"></div>' +
        '<b class="li-nome">' + p.moedas.toLocaleString('pt-BR') + ' moedas</b>' +
        (p.selo ? '<span class="pa-selo">' + p.selo + '</span>' : '<span class="pa-selo vazio"></span>') +
        '<span class="li-preco">' + p.preco + '</span>' +
        '<button type="button" class="li-bt">COMPRAR</button>';
      card.querySelector('.li-bt').onclick = () => Loja.comprarMoedas(p);
      grade.appendChild(card);
    }
    const nota = document.createElement('p');
    nota.className = 'loja-nota';
    nota.textContent = 'Comprar moeda é atalho, não obrigação: tudo na loja sai matando inimigo. '
      + 'O pagamento entra numa atualização — por enquanto o botão só avisa.';
    grade.appendChild(nota);
  },

  // Gancho único para o meio de pagamento que vier depois. Enquanto
  // `Pagamento` não existir, a loja é honesta e diz que ainda não dá.
  comprarMoedas(pacote) {
    Som.clique();
    if (typeof Pagamento !== 'undefined' && Pagamento.iniciar) {
      Pagamento.iniciar(pacote);
      return;
    }
    Loja.avisar('A compra de moedas ainda não está no ar. Por enquanto, moeda só caindo de inimigo.');
  },

  comprar(chave, item) {
    if (Carteira.tem(item.id)) return;
    if (!Carteira.gastar(item.preco)) {
      Som.erro();
      Loja.avisar('Faltam ' + (item.preco - Carteira.moedas).toLocaleString('pt-BR') + ' moedas para ' + item.nome + '.');
      return;
    }
    Carteira.itens.push(item.id);
    Carteira.salvar();
    Som.subirNivel();
    Loja.avisar(item.nome + ' desbloqueado.');
    Loja.equipar(chave, item);
  },

  equipar(chave, item) {
    Carteira.equipado[chave] = item.id;
    Carteira.salvar();
    Som.clique();
    if (typeof Jogo !== 'undefined' && Jogo.jogador) Jogo.jogador.recarregarVisual();
    Loja.abrirAba(chave);
  },

  avisar(texto) {
    const el = document.getElementById('lojaAviso');
    if (el) el.textContent = texto;
  }
};
