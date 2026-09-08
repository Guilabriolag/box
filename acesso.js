// BOX — Teste de Controle de Acesso v0

const SALAS = {
  "_01": {
    codigo: "BOX-SALA01-KEY0"
  }
};

function solicitarAcesso(sala, codigo) {
  const configuracao = SALAS[sala];

  if (!configuracao) {
    return {
      resultado: "DENY",
      motivo: "sala inexistente"
    };
  }

  if (codigo !== configuracao.codigo) {
    return {
      resultado: "DENY",
      motivo: "credencial inválida"
    };
  }

  return {
    resultado: "ALLOW",
    motivo: "credencial válida",
    sala: sala
  };
}

// TESTE 1 — código correto
console.log(
  "TESTE 1:",
  solicitarAcesso("_01", "BOX-SALA01-KEY0")
);

// TESTE 2 — código errado
console.log(
  "TESTE 2:",
  solicitarAcesso("_01", "CODIGO-ERRADO")
);

// TESTE 3 — sala inexistente
console.log(
  "TESTE 3:",
  solicitarAcesso("_99", "BOX-SALA01-KEY0")
);