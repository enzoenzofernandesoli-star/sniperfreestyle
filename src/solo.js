/* Modo exclusivamente solo. Mantém a interface interna esperada pelo motor
   sem abrir WebSocket, criar sala ou transmitir qualquer estado de partida. */
const Coop = {
  papel: null,
  intencao: null,
  controlesRemotos: new Map(),
  controleParado: {},
  ativo() { return false; },
  convidado() { return false; },
  anfitriao() { return false; },
  entreQuadros() {},
  enviarControle() {},
  enviarEstado() {},
  status() {},
  sair() {}
};
