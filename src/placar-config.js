/* ===========================================================================
   PLACAR-CONFIG.JS — endereço do placar mundial.

   Este é o ÚNICO arquivo que precisa mudar pra ligar/desligar o placar online.
   Deixe `url` vazio e o jogo funciona igual, só com o placar deste aparelho.

   `url` aponta pra função /api/placar publicada na Vercel, que é quem fala com
   o banco (Neon, projeto `sobrecarga-placar`, região sa-east-1, plano grátis).
   Aqui não existe senha nenhuma: a credencial do banco vive só no servidor.

   A rota relativa funciona no site publicado. Para uma cópia local, use a URL
   HTTPS absoluta do site publicado; file:// não oferece uma API local.
   =========================================================================== */

const PLACAR_CONFIG = {
  url: '/api/placar',
  // Endereço de reserva: usado quando o /api/placar do próprio site responde
  // que está sem banco (é o caso da Vercel sem DATABASE_URL). Assim o placar
  // mundial só precisa de credencial em UM servidor, não em todos.
  reserva: 'https://sniper-salas.onrender.com/api/placar',

  // Última linha de defesa, e a que faz o placar funcionar em QUALQUER lugar:
  // o Data API do Neon, falando direto com o banco. Não há segredo aqui — o
  // token é anônimo, de 1 hora, emitido na hora para quem pedir. Quem manda é
  // o banco: o papel `anonymous` só pode ler o ranking e inserir uma linha que
  // passe por todas as CHECKs (nome, classe, onda, pontos). Alterar ou apagar
  // é negado no Postgres, não no navegador.
  dataApi: {
    tabela: 'https://ep-little-fog-acialbzu.apirest.sa-east-1.aws.neon.tech/neondb/rest/v1/placar_sobrecarga',
    token: 'https://ep-little-fog-acialbzu.neonauth.sa-east-1.aws.neon.tech/neondb/auth/token/anonymous'
  },

  limite: 25          // quantas linhas o placar mundial mostra
};
