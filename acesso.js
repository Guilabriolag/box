// BOX — Controle de Acesso + LOG v0

const SALAS = {
  "_01": {
    codigo: "BOX-SALA01-KEY0"
  }
};

const LOGS = [];

function registrarLog(sala, resultado, motivo) {
  const registro = {
    data: new Date().toISOString(),
    sala: sala,
    resultado: resultado,
    motivo: motivo
  };

  LOGS.push(registro);

  return registro;
}

function solicitarAcesso(sala, codigo) {
  const configuracao = SALAS[sala];

  if (!configuracao) {
    const registro = registrarLog(
      sala,
      "DENY",
      "sala inexistente"
    );

    return registro;
  }

  if (codigo !== configuracao.codigo) {
    const registro = registrarLog(
      sala,
      "DENY",
      "credencial inválida"
    );

    return registro;
  }

  const registro = registrarLog(
    sala,
    "ALLOW",
    "credencial válida"
  );

  return {
    ...registro,
    acesso: true
  };
}

function consultarLogs() {
  return LOGS;
}


// TESTES AUTOMÁTICOS

console.log(
  "TESTE 1:",
  solicitarAcesso("_01", "BOX-SALA01-KEY0")
);

console.log(
  "TESTE 2:",
  solicitarAcesso("_01", "CODIGO-ERRADO")
);

console.log(
  "TESTE 3:",
  solicitarAcesso("_99", "BOX-SALA01-KEY0")
);

console.log(
  "LOGS:",
  consultarLogs()
);