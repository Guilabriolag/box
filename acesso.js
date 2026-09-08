// BOX — Validador de Autorizações v0

const AUTORIZACOES = [];

const LOGS = [];


// =====================================================
// REGISTRO DE AUTORIZAÇÃO
// =====================================================

function registrarAutorizacao(autorizacao) {

  AUTORIZACOES.push(autorizacao);

  registrarLog(
    autorizacao.sala,
    "REGISTRO",
    "autorização criada",
    autorizacao.token
  );

  return autorizacao;
}


// =====================================================
// LOG
// =====================================================

function registrarLog(
  sala,
  resultado,
  motivo,
  token = null
) {

  const registro = {

    data: new Date().toISOString(),

    sala: sala,

    resultado: resultado,

    motivo: motivo,

    token: token

  };


  LOGS.push(registro);


  return registro;
}


// =====================================================
// VALIDAÇÃO
// =====================================================

function validarAutorizacao(
  sala,
  token
) {

  // -----------------------------------------------
  // 1. verificar se o token existe
  // -----------------------------------------------

  const autorizacao =
    AUTORIZACOES.find(
      item => item.token === token
    );


  if (!autorizacao) {

    return registrarLog(
      sala,
      "DENY",
      "token desconhecido",
      token
    );

  }


  // -----------------------------------------------
  // 2. verificar se pertence à sala
  // -----------------------------------------------

  if (autorizacao.sala !== sala) {

    return registrarLog(
      sala,
      "DENY",
      "token não autorizado para esta sala",
      token
    );

  }


  // -----------------------------------------------
  // 3. verificar validade
  // -----------------------------------------------

  const agora =
    new Date();

  const expiracao =
    new Date(
      autorizacao.expira
    );


  if (agora > expiracao) {

    return registrarLog(
      sala,
      "DENY",
      "autorização expirada",
      token
    );

  }


  // -----------------------------------------------
  // 4. acesso permitido
  // -----------------------------------------------

  return {
    ...registrarLog(
      sala,
      "ALLOW",
      "autorização válida",
      token
    ),

    acesso: true,

    agente: autorizacao.agente,

    expira: autorizacao.expira

  };

}


// =====================================================
// CONSULTAR LOGS
// =====================================================

function consultarLogs() {

  return LOGS;

}


// =====================================================
// CONSULTAR AUTORIZAÇÕES
// =====================================================

function consultarAutorizacoes() {

  return AUTORIZACOES;

}