const { neon } = require('@neondatabase/serverless');

let url = process.env.DATABASE_URL;
if (!url) {
  try { url = require('../api/conexao-local.js'); } catch (e) { /* sem conexão local */ }
}
if (!url) {
  console.error('DATABASE_URL ausente');
  process.exit(1);
}

const sql = neon(url);
Promise.all([
  sql`select current_user as usuario, count(*)::int as resultados,
      max(onda) as maior_onda from public.placar_sobrecarga`,
  sql`select conname, pg_get_constraintdef(oid) as definicao
      from pg_constraint where conrelid = 'public.placar_sobrecarga'::regclass`
])
  .then(([estado, restricoes]) => console.log(JSON.stringify({ estado, restricoes }, null, 2)))
  .catch((erro) => { console.error(erro.message); process.exitCode = 1; });
