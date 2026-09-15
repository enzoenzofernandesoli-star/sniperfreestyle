/* ===========================================================================
   SALAS.JS — servidor de salas do cooperativo + servidor de arquivos local.

   Quem simula a partida é o ANFITRIÃO, no navegador dele. Aqui o servidor só:
     - cria salas com código de convite e no máximo 4 pessoas;
     - encaminha comando do convidado → anfitrião e snapshot → convidados;
     - derruba sala vazia, conexão morta e cliente que fala rápido demais.

   Nada de estado de jogo mora aqui. Isso mantém o servidor barato e faz o
   cooperativo rodar em qualquer host que aceite WebSocket. A contrapartida
   está escrita no COOPERATIVO.md: quem hospeda a partida é o anfitrião, então
   a autoridade é o navegador dele, não o servidor.

   Uso:  npm run salas       (ou: node servidor/salas.js 8123)
   Abre em http://localhost:8123 — a mesma porta serve o jogo e as salas.
   =========================================================================== */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { WebSocketServer } = require('ws');
const placar = require('../api/placar.js');

const raiz = path.resolve(__dirname, '..');
const salas = new Map();
const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const porta = Number(process.env.PORT) || Number(process.argv[2]) || 8123;

const MAX_CONVIDADOS = 3;          // + anfitrião = 4 na arena
const LIMITE_CONTROLE = 40;        // comandos por segundo aceitos de um convidado
const LIMITE_ESTADO = 30;          // snapshots por segundo aceitos do anfitrião
const TEMPO_MORTO = 45000;         // sem pong nesse tempo, a conexão cai
const SALA_OCIOSA = 30 * 60 * 1000;

/* ----------------------------- HTTP estático ---------------------------- */
const servidor = http.createServer((req, res) => {
  if (req.url && req.url.split('?')[0] === '/api/placar') {
    const consulta = new URL(req.url, 'http://localhost');
    req.query = Object.fromEntries(consulta.searchParams);
    res.status = (codigo) => { res.statusCode = codigo; return res; };
    res.json = (dados) => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(dados)); };
    if (req.method !== 'POST') { placar(req, res); return; }
    let corpo = '';
    req.on('data', (pedaço) => {
      corpo += pedaço;
      if (corpo.length > 16384) req.destroy();
    });
    req.on('end', () => { req.body = corpo; placar(req, res); });
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
  let nome;
  try { nome = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400).end(); return; }
  const permitido = ['/', '/index.html', '/style.css', '/manifest.webmanifest', '/sw.js', '/privacidade.html'];
  if (!permitido.includes(nome) && !/^\/(src|assets)\/[\w.-]+$/.test(nome)) {
    res.writeHead(403).end(); return;
  }
  const arquivo = path.resolve(raiz, '.' + (nome === '/' ? '/index.html' : nome));
  fs.stat(arquivo, (erro, stat) => {
    if (erro || !stat.isFile()) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': (tipos[path.extname(arquivo)] || 'application/octet-stream') + '; charset=utf-8', 'Cache-Control': 'no-store' });
    fs.createReadStream(arquivo).pipe(res);
  });
});

/* -------------------------------- Salas --------------------------------- */
const wss = new WebSocketServer({ server: servidor, maxPayload: 300000 });

function enviar(cliente, dados) {
  if (cliente.readyState === 1) cliente.send(JSON.stringify(dados));
}
function codigoNovo() {
  let valor;
  do { valor = crypto.randomBytes(4).toString('hex').toUpperCase(); } while (salas.has(valor));
  return valor;
}
// Código escolhido pelo anfitrião: aceita só o que cabe num convite falado em
// voz alta, e nunca rouba o código de uma sala que já existe.
function codigoPedido(bruto) {
  const limpo = String(bruto || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  return /^[A-Z0-9]{4,8}$/.test(limpo) ? limpo : null;
}
// janela deslizante de 1 segundo: se estourar, a mensagem é descartada em vez
// de derrubar a conexão — perder um comando é melhor que perder o jogador.
function passouDoLimite(cliente, chave, limite) {
  const agora = Date.now();
  if (agora - cliente[chave + 'Marca'] > 1000) { cliente[chave + 'Marca'] = agora; cliente[chave + 'Conta'] = 0; }
  cliente[chave + 'Conta']++;
  return cliente[chave + 'Conta'] > limite;
}
function sair(cliente) {
  const sala = cliente.sala;
  if (!sala) return;
  cliente.sala = null;
  if (cliente === sala.anfitriao) {
    for (const convidado of sala.convidados) { convidado.sala = null; enviar(convidado, { tipo: 'encerrada' }); }
    salas.delete(sala.codigo);
  } else {
    sala.convidados.delete(cliente);
    enviar(sala.anfitriao, { tipo: 'saiu', id: cliente.id });
  }
}

wss.on('connection', (cliente) => {
  cliente.vivo = true;
  cliente.id = crypto.randomBytes(6).toString('hex');
  cliente.controleMarca = 0; cliente.controleConta = 0;
  cliente.estadoMarca = 0; cliente.estadoConta = 0;
  cliente.on('pong', () => { cliente.vivo = true; });

  cliente.on('message', (bruto) => {
    const anfitriaoDaSala = cliente.sala && cliente === cliente.sala.anfitriao;
    if (bruto.length > (anfitriaoDaSala ? 260000 : 512)) return;
    let dados;
    try { dados = JSON.parse(bruto); } catch { return; }
    if (!dados || typeof dados.tipo !== 'string') return;

    if (dados.tipo === 'criar' && !cliente.sala) {
      let codigo = codigoNovo();
      if (dados.codigo !== undefined && dados.codigo !== '') {
        codigo = codigoPedido(dados.codigo);
        if (!codigo) { enviar(cliente, { tipo: 'erro', mensagem: 'Código inválido: use de 4 a 8 letras ou números.' }); return; }
        if (salas.has(codigo)) { enviar(cliente, { tipo: 'erro', mensagem: 'Esse código já está em uso. Escolha outro.' }); return; }
      }
      const sala = { codigo, anfitriao: cliente, convidados: new Set(), criada: Date.now() };
      salas.set(sala.codigo, sala);
      cliente.sala = sala;
      enviar(cliente, { tipo: 'criada', codigo: sala.codigo });

    } else if (dados.tipo === 'entrar' && !cliente.sala) {
      const sala = salas.get(String(dados.codigo || '').toUpperCase());
      if (!sala) { enviar(cliente, { tipo: 'erro', mensagem: 'Sala não encontrada. Confira o código.' }); return; }
      if (sala.convidados.size >= MAX_CONVIDADOS) { enviar(cliente, { tipo: 'erro', mensagem: 'A sala já está cheia (4 jogadores).' }); return; }
      cliente.sala = sala;
      sala.convidados.add(cliente);
      enviar(cliente, { tipo: 'entrou', id: cliente.id, codigo: sala.codigo });
      enviar(sala.anfitriao, { tipo: 'entrou', id: cliente.id, nome: String(dados.nome || '').slice(0, 12) });

    } else if (dados.tipo === 'pronto' && cliente.sala && !anfitriaoDaSala) {
      // convidado avisa ao anfitrião com que classe e skin quer entrar na arena
      enviar(cliente.sala.anfitriao, { tipo: 'pronto', id: cliente.id,
        classe: String(dados.classe || ''), skin: String(dados.skin || ''), nome: String(dados.nome || '').slice(0, 12) });

    } else if ((dados.tipo === 'lobby' || dados.tipo === 'comecou') && anfitriaoDaSala) {
      // painel da sala e largada saem do anfitrião; o servidor só repassa
      const pacote = dados.tipo === 'lobby'
        ? { tipo: 'lobby', lista: Array.isArray(dados.lista) ? dados.lista.slice(0, 4) : [] }
        : { tipo: 'comecou' };
      for (const convidado of cliente.sala.convidados) enviar(convidado, pacote);

    } else if (dados.tipo === 'controle' && cliente.sala && !anfitriaoDaSala) {
      if (passouDoLimite(cliente, 'controle', LIMITE_CONTROLE)) return;
      enviar(cliente.sala.anfitriao, { tipo: 'controle', id: cliente.id, controle: dados.controle });

    } else if (dados.tipo === 'estado' && anfitriaoDaSala) {
      if (passouDoLimite(cliente, 'estado', LIMITE_ESTADO)) return;
      for (const convidado of cliente.sala.convidados) enviar(convidado, { tipo: 'estado', estado: dados.estado });

    } else if (dados.tipo === 'sair') {
      sair(cliente);
    }
  });

  cliente.on('close', () => sair(cliente));
  cliente.on('error', () => sair(cliente));
});

// Conexão que não responde ao ping fica pendurada e deixa a sala ocupada; e
// sala sem ninguém dentro também não tem por que continuar existindo.
const vigia = setInterval(() => {
  for (const cliente of wss.clients) {
    if (!cliente.vivo) { cliente.terminate(); continue; }
    cliente.vivo = false;
    cliente.ping();
  }
  const agora = Date.now();
  for (const [codigo, sala] of salas) {
    const anfitriaoCaiu = !sala.anfitriao || sala.anfitriao.readyState > 1;
    if (anfitriaoCaiu || agora - sala.criada > SALA_OCIOSA) {
      for (const convidado of sala.convidados) { convidado.sala = null; enviar(convidado, { tipo: 'encerrada' }); }
      salas.delete(codigo);
    }
  }
}, TEMPO_MORTO / 3);
vigia.unref?.();

servidor.listen(porta, () => console.log('Salas em http://localhost:' + porta));
module.exports = { servidor, salas, wss };
