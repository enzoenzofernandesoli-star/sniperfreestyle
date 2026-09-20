const { banco, contaDaRequisicao } = require('../servidor/conta');

module.exports = async function (req, res) {
  if (req.method !== 'GET') { res.status(405).json({ erro: 'método não suportado' }); return; }
  try {
    const conta = await contaDaRequisicao(req);
    if (!conta) { res.status(401).json({ erro: 'entre com Google' }); return; }
    const sql = banco();
    const linhas = await sql`
      select nome, pontos, classe, onda, nivel, tempo, abates, venceu, temporada, criado_em
      from public.placar_sobrecarga
      where conta_id = ${conta.id}
      order by pontos desc, criado_em asc
      limit 200
    `;
    res.setHeader('Cache-Control', 'private, no-store');
    res.status(200).json({ recordes: linhas });
  } catch (e) {
    res.status(500).json({ erro: 'não foi possível carregar os recordes' });
  }
};
