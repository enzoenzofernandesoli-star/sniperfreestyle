/* ===========================================================================
   SW.JS — service worker: o jogo abre e roda sem internet.

   Estratégia por tipo de pedido:
   - casco do jogo (html, css, js, ícones): cache primeiro, rede só pra atualizar
     em segundo plano. Abre instantâneo e funciona offline, que é requisito de
     qualidade pra empacotar como app Android (TWA).
   - /api/placar: rede sempre, nunca cache. Placar velho é pior que placar nenhum.
   - fontes do Google: cache primeiro (mudam quase nunca), com rede de reserva.

   Pra publicar uma versão nova basta subir o VERSAO: o cache antigo é apagado.
   =========================================================================== */

const VERSAO = 'sniper-freestyle-v43';

const CASCO = [
  './',
  './index.html',
  './style.css',
  './manifest.webmanifest',
  './src/nucleo.js',
  './src/placar-config.js',
  './src/placar.js',
  './src/classes.js',
  './src/entidades.js',
  './src/jogo.js',
  './src/coop.js',
  './src/ui.js',
  './assets/sixseven.mp3',
  './assets/encaixa-1.m4a',
  './assets/encaixa-2.m4a',
  './assets/encaixa-3.m4a',
  './assets/icone-192.png',
  './assets/icone-512.png',
  './assets/favicon-64.png',
  './assets/apple-touch-icon.png'
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(VERSAO)
      // addAll falha inteiro se um item falhar; um a um é mais resistente
      .then((cache) => Promise.allSettled(CASCO.map((u) => cache.add(new Request(u, { cache: 'reload' })))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== VERSAO).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (evento) => {
  const pedido = evento.request;
  if (pedido.method !== 'GET') return;

  const url = new URL(pedido.url);

  // placar sempre na rede
  if (url.pathname.indexOf('/api/') === 0) return;

  const mesmaOrigem = url.origin === self.location.origin;
  const fonteGoogle = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!mesmaOrigem && !fonteGoogle) return;

  evento.respondWith(
    caches.match(pedido).then((cacheado) => {
      const daRede = fetch(pedido)
        .then((resposta) => {
          if (resposta && resposta.ok && (resposta.type === 'basic' || resposta.type === 'cors')) {
            const copia = resposta.clone();
            caches.open(VERSAO).then((cache) => cache.put(pedido, copia));
          }
          return resposta;
        })
        .catch(() => cacheado || Response.error());

      return cacheado || daRede;
    })
  );
});
