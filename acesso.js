// BOX — Validador de Autorizações v0.1


// =====================================================
// ARMAZENAMENTO TEMPORÁRIO
// =====================================================

const AUTORIZACOES = [];

const LOGS = [];


// =====================================================
// REGISTRO DE AUTORIZAÇÃO
// =====================================================

function registrarAutorizacao(
  autorizacao
) {

  AUTORIZACOES.push(
    autorizacao
  );


  registrarLog(
    autorizacao.sala,
    "REGISTRO",
    "autorização criada",
    autorizacao.token
  );


  return autorizacao;

}


// =====================================================
// IMPORTAÇÃO DE AUTORIZAÇÃO
// =====================================================

function importarAutorizacao(
  pacote
) {

  if (
    !pacote ||
    typeof pacote !== "object"
  ) {

    return registrarLog(
      null,
      "DENY",
      "pacote inválido"
    );

  }


  if (
    !pacote.id ||
    !pacote.token ||
    !pacote.agente ||
    !pacote.sala ||
    !pacote.criado ||
    !pacote.expira
  ) {

    return registrarLog(
      pacote.sala || null,
      "DENY",
      "pacote incompleto",
      pacote.token || null
    );

  }


  const existente =
    AUTORIZACOES.find(
      item =>
        item.token ===
        pacote.token
    );


  if (existente) {

    return registrarLog(
      pacote.sala,
      "DENY",
      "autorização já registrada",
      pacote.token
    );

  }


  const autorizacao = {

    id:
      pacote.id,

    token:
      pacote.token,

    agente:
      pacote.agente,

    sala:
      pacote.sala,

    criado:
      pacote.criado,

    expira:
      pacote.expira

  };


  registrarAutorizacao(
    autorizacao
  );


  return {

    resultado:
      "ALLOW",

    motivo:
      "autorização importada",

    autorizacao:
      autorizacao

  };

}


// =====================================================
// REGISTRO DE LOG
// =====================================================

function registrarLog(
  sala,
  resultado,
  motivo,
  token = null
) {

  const registro = {

    data:
      new Date().toISOString(),

    sala:
      sala,

    resultado:
      resultado,

    motivo:
      motivo,

    token:
      token

  };


  LOGS.push(
    registro
  );


  return registro;

}


// =====================================================
// VALIDAÇÃO DE AUTORIZAÇÃO
// =====================================================

function validarAutorizacao(
  sala,
  token
) {

  const autorizacao =
    AUTORIZACOES.find(
      item =>
        item.token ===
        token
    );


  if (!autorizacao) {

    return registrarLog(
      sala,
      "DENY",
      "token desconhecido",
      token
    );

  }


  if (
    autorizacao.sala !==
    sala
  ) {

    return registrarLog(
      sala,
      "DENY",
      "token não autorizado para esta sala",
      token
    );

  }


  const agora =
    new Date();


  const expiracao =
    new Date(
      autorizacao.expira
    );


  if (
    agora > expiracao
  ) {

    return registrarLog(
      sala,
      "DENY",
      "autorização expirada",
      token
    );

  }


  return {

    ...registrarLog(
      sala,
      "ALLOW",
      "autorização válida",
      token
    ),

    acesso:
      true,

    agente:
      autorizacao.agente,

    expira:
      autorizacao.expira

  };

}


// =====================================================
// CONSULTA DE LOGS
// =====================================================

function consultarLogs() {

  return LOGS;

}


// =====================================================
// CONSULTA DE AUTORIZAÇÕES
// =====================================================

function consultarAutorizacoes() {

  return AUTORIZACOES;

}