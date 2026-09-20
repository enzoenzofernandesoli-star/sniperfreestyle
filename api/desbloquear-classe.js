const { banco, contaDaRequisicao } = require('../servidor/conta');

const CLASSES = Object.freeze({ espectro: 700, invocador: 1500, desenvolvedor: 5000 });

module.exports = async function (req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.status(405).json({ erro: 'método não suportado' }); return; }
  const classe = String((req.body && req.body.classe) || '');
  const preco = CLASSES[classe];
  if (!preco) { res.status(400).json({ erro: 'classe inválida' }); return; }
  try {
    const conta = await contaDaRequisicao(req);
    if (!conta) { res.status(401).json({ erro: 'entre com Google antes de desbloquear' }); return; }
    const sql = banco();
    const item = `classe-${classe}`;
    const linhas = await sql`
      update public.contas_jogador
      set nucleus = nucleus - ${preco},
          classes_desbloqueadas = array_append(classes_desbloqueadas, ${item}),
          atualizado_em = now()
      where id = ${conta.id} and nucleus >= ${preco}
        and not (${item} = any(classes_desbloqueadas))
      returning nucleus, classes_desbloqueadas
    `;
    if (!linhas.length) {
      const atual = await sql`
        select nucleus, classes_desbloqueadas from public.contas_jogador where id = ${conta.id} limit 1
      `;
      if (atual[0] && atual[0].classes_desbloqueadas.includes(item)) {
        res.status(200).json({ nucleus: Number(atual[0].nucleus), classes: atual[0].classes_desbloqueadas, repetida: true });
        return;
      }
      res.status(409).json({ erro: 'NUCLEUS insuficientes' }); return;
    }
    res.status(200).json({ nucleus: Number(linhas[0].nucleus), classes: linhas[0].classes_desbloqueadas });
  } catch (e) {
    res.status(503).json({ erro: 'não foi possível desbloquear a classe' });
  }
};

module.exports.CLASSES = CLASSES;
