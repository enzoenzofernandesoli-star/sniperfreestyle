/* ===========================================================================
   PLACAR-CONFIG.JS — endereço do placar mundial.

   Este é o ÚNICO arquivo que precisa mudar pra ligar/desligar o placar online.
   Deixe `url` vazio e o jogo funciona igual, só com o placar deste aparelho.

   `url` aponta pra função /api/placar publicada na Vercel, que é quem fala com
   o banco (Neon, projeto `sobrecarga-placar`, região sa-east-1, plano grátis).
   Aqui não existe senha nenhuma: a credencial do banco vive só no servidor.

   Endereço absoluto de propósito — assim a cópia aberta direto do arquivo no PC
   também manda pontuação pro mesmo placar do site.
   =========================================================================== */

const PLACAR_CONFIG = {
  url: '/api/placar',
  limite: 25          // quantas linhas o placar mundial mostra
};
