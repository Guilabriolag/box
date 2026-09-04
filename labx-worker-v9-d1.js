/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  LAB-X v9 — Cloudflare Worker (KV + D1 Hybrid)                     ║
 * ║  LABRIOLAG Holding · labriolag.shop                                 ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║  BINDINGS (wrangler.toml):                                          ║
 * ║                                                                      ║
 * ║  KV  LABX_KV       91a2942878d74f3c9621f29d453e4e99  (rate/cache)  ║
 * ║  KV  LAB_MENU      b57ff55f4faa48babfb933cb80bba2b1  (legado)      ║
 * ║  KV  LABSYSTEM_DATA dfd5232ebd7248b48922b080d4f77b78 (system)      ║
 * ║                                                                      ║
 * ║  D1  D1_AUTH       → perfis, API keys, créditos                    ║
 * ║  D1  D1_CARDAPIO   → cardápios, slugs, itens                       ║
 * ║  D1  D1_PEDIDOS    → histórico de pedidos (permanente)             ║
 * ║  D1  D1_VOUCHERS   → fábrica de vouchers + auditoria               ║
 * ║  D1  MIMOGAME_DB   → 24781592-6518-4fb9-b291-f8fdd8bc30c1 (cross) ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║  ESTRATÉGIA HÍBRIDA:                                                ║
 * ║  LABX_KV → rate limiting, cache BCB/IBGE/feed (TTL automático)     ║
 * ║  D1_*    → dados permanentes sem TTL (SQL, JOINs, analytics)       ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║  ROTAS PÚBLICAS:                                                    ║
 * ║    GET  /health                                                      ║
 * ║    GET  /feed                                                        ║
 * ║    GET  /menu/:slug[?mesa=N]  → cardápio público (qrAtivado=true)  ║
 * ║    POST /pedido/enviar        → registra + retorna tel WhatsApp     ║
 * ║                                                                      ║
 * ║  AUTENTICADAS (X-API-Key):                                          ║
 * ║    GET  /me                                                          ║
 * ║    POST /cardapio/salvar                                             ║
 * ║    POST /cardapio/ativar-qr   → consome 1 qrCredit (R$ 2,50)       ║
 * ║    GET  /cardapio/meu                                                ║
 * ║    POST /voucher/resgatar     → credita qrCredits via voucher       ║
 * ║    GET  /pedidos/feed         → últimos 20 pedidos (polling 5s)     ║
 * ║    PATCH /pedidos/:id/status  → novo→preparando→pronto→entregue    ║
 * ║    GET  /pedidos/historico    → todos pedidos da loja               ║
 * ║    GET  /ibge/:cod                                                   ║
 * ║    POST /calcular             → motor 16D (consome 1 credit)        ║
 * ║                                                                      ║
 * ║  ADMIN (X-Admin-Secret):                                            ║
 * ║    POST   /admin/keys                                                ║
 * ║    GET    /admin/keys                                                ║
 * ║    PATCH  /admin/keys/:key                                           ║
 * ║    DELETE /admin/keys/:key                                           ║
 * ║    GET    /admin/stats                                               ║
 * ║    POST   /admin/vouchers/gerar                                      ║
 * ║    GET    /admin/vouchers[?status=]                                  ║
 * ║    DELETE /admin/vouchers/:codigo                                    ║
 * ║    GET    /admin/pedidos      → todos pedidos últimas 24h           ║
 * ║    GET    /admin/cross/mimo   → cruzamento D1_AUTH × MIMOGAME_DB   ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

// ─── CORS ──────────────────────────────────────────────────────────────────
function corsHeaders(env, request) {
  const allowed   = env.ALLOWED_ORIGIN || '*';
  const origin    = request.headers.get('Origin') || '';
  const useOrigin = (allowed === '*') ? '*' : (origin === allowed ? origin : allowed);
  return {
    'Access-Control-Allow-Origin':  useOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, X-Admin-Secret',
    'Content-Type': 'application/json',
  };
}

// ─── CONSTANTES ────────────────────────────────────────────────────────────
const QR_PRECO_BRL = 2.50;
const TIERS_CARDAPIO = ['basic', 'pro', 'enterprise'];
const BCB = { SELIC: 11, IPCA: 433, IBCBR: 24363, CAMBIO: 1 };
const TTL = {
  BCB:    60 * 60 * 4,
  IBGE:   60 * 60 * 24,
  RATE:   60,
  CACHE:  60 * 30,      // 30min — cache de leituras D1 frequentes no KV
};

// ─── HELPERS ───────────────────────────────────────────────────────────────
function ok(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data, null, 2), { status, headers });
}
function err(msg, status = 400, headers = {}, extra = {}) {
  return new Response(JSON.stringify({ error: msg, ...extra }), { status, headers });
}
function gerarSlug(nome) {
  return nome.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .substring(0, 40);
}
function gerarCodigo(valor) {
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `LAB-${valor}-${rand}`;
}
function gerarApiKey() {
  return `sk_lab_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

// ─── RATE LIMIT (KV — TTL automático, sem limpeza manual) ─────────────────
async function checkRateLimit(env, apiKey) {
  const key   = `rate:${apiKey}:${Math.floor(Date.now() / 60000)}`;
  const count = parseInt(await env.LABX_KV.get(key).catch(() => '0')) || 0;
  if (count >= 30) return false;
  await env.LABX_KV.put(key, String(count + 1), { expirationTtl: TTL.RATE });
  return true;
}

// ─── AUTH via D1_AUTH ──────────────────────────────────────────────────────
async function getProfile(env, apiKey) {
  if (!apiKey || !apiKey.startsWith('sk_lab_')) return null;
  // Cache rápido no KV para evitar D1 em cada request
  const cacheKey = `auth_cache:${apiKey}`;
  const cached = await env.LABX_KV.get(cacheKey).catch(() => null);
  if (cached) return JSON.parse(cached);
  // D1 como fonte da verdade
  const row = await env.D1_AUTH.prepare(
    'SELECT * FROM profiles WHERE api_key = ?'
  ).bind(apiKey).first().catch(() => null);
  if (!row) return null;
  // Armazena no KV por 30min para reads subsequentes
  await env.LABX_KV.put(cacheKey, JSON.stringify(row), { expirationTtl: TTL.CACHE });
  return row;
}

async function saveProfile(env, apiKey, updates) {
  const fields = Object.entries(updates)
    .map(([k, _]) => `${k} = ?`).join(', ');
  const values = Object.values(updates);
  await env.D1_AUTH.prepare(
    `UPDATE profiles SET ${fields}, updated_at = datetime('now') WHERE api_key = ?`
  ).bind(...values, apiKey).run();
  // Invalida cache KV
  await env.LABX_KV.delete(`auth_cache:${apiKey}`).catch(() => null);
}

// ─── BCB (cache no KV) ─────────────────────────────────────────────────────
async function fetchBCB(serie) {
  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${serie}/dados/ultimos/1?formato=json`;
  const r = await fetch(url, { cf: { cacheTtl: TTL.BCB, cacheEverything: true } });
  if (!r.ok) throw new Error(`BCB ${serie}: ${r.status}`);
  const d = await r.json(); return d[d.length - 1];
}

async function fetchIBGEEmpresas(cod) {
  const url = `https://apisidra.ibge.gov.br/values/t/6321/n6/${cod}/v/allxp/p/last%201/f/u`;
  const r = await fetch(url, { cf: { cacheTtl: 60 * 60 * 24, cacheEverything: true } });
  if (!r.ok) throw new Error(`IBGE: ${r.status}`);
  const d = await r.json(); const row = d.find(x => x.V && x.V !== '-') || d[1];
  return row ? parseInt(row.V.replace(/\./g, ''), 10) || 0 : 0;
}

async function fetchIBGEPessoal(cod) {
  const url = `https://apisidra.ibge.gov.br/values/t/6579/n6/${cod}/v/allxp/p/last%201/f/u`;
  const r = await fetch(url, { cf: { cacheTtl: 60 * 60 * 24, cacheEverything: true } });
  if (!r.ok) throw new Error(`IBGE: ${r.status}`);
  const d = await r.json(); const row = d.find(x => x.V && x.V !== '-') || d[1];
  return row ? parseInt(row.V.replace(/\./g, ''), 10) || 0 : 0;
}

async function fetchIBGEPopulacao(cod) {
  const r = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${cod}`);
  if (!r.ok) return { nome: 'Município', pop: 50000 };
  const m = await r.json(); return { nome: m.nome || 'Município', pop: 50000 };
}

// ─── MOTOR 16D (mantido do v8) ─────────────────────────────────────────────
function calcularVetores({ renda, cnpjs, populacao, pib, modo = 1.0, bcbData = {}, ibgeData = {} }) {
  const minmax = (v, min, max) => Math.max(0, Math.min(1, (v - min) / (max - min)));
  const clamp  = v => Math.max(0, Math.min(10, v));
  const r2     = v => Number(v.toFixed(2));
  const avg    = arr => arr.reduce((s, v) => s + v, 0) / arr.length;
  const { selic = 10.5, ipca = 0.44, ibcbr = 118 } = bcbData;
  const rN=Math.min(renda/5000,1), dN=Math.min(cnpjs/200,1), pN=Math.min(populacao/500000,1), gN=Math.min(pib/200,1);
  const selicN=minmax(selic,2,15), ipcaN=minmax(ipca,0,1.5), ibcN=minmax(ibcbr,95,145);
  const sat=dN>0.7?(dN-0.7)*3:0, liq=(rN+gN)/2, inov=ibcN>0.5?1.1:0.9;
  const N=clamp((gN*8+pN*2)*modo), S=clamp((dN*5+(ibgeData.pessoal?Math.min(ibgeData.pessoal/50000,1):dN)*3+rN*2)*modo);
  const L=clamp(((1-sat)*6+liq*3+ibcN)*modo), O=clamp((rN*4+gN*4+(1-selicN)*2)*modo);
  const NE=clamp(((N+L)/2*0.9)*modo), SE=clamp((gN*6+ibcN*2+rN*2)*0.9*modo);
  const SO=clamp((sat*4+selicN*4+(1-liq)*2)*0.8*modo), NO=clamp(((N+O)/2*0.9)*modo);
  const NNE=clamp(((NE+N)/2*0.85)*modo), ENE=clamp((liq*6+pN*2+(1-ipcaN)*2)*0.8*modo);
  const ESE=clamp((dN*4+rN*3+ibcN*3)*0.8*modo), SSE=clamp(((ibcN*7+(1-ipcaN)*3)*0.85)*modo);
  const SSO=clamp((selicN*5+sat*3+(1-gN)*2)*0.8*modo), OSO=clamp((sat*8+dN*2)*0.8*modo);
  const ONO=clamp(((NO+NE)/2*inov*0.85)*modo), NNO=clamp(((N*0.5+pN*3+ibcN*1.5)*0.8)*modo);
  const v={N:r2(N),S:r2(S),L:r2(L),O:r2(O),NE:r2(NE),SE:r2(SE),SO:r2(SO),NO:r2(NO),NNE:r2(NNE),ENE:r2(ENE),ESE:r2(ESE),SSE:r2(SSE),SSO:r2(SSO),OSO:r2(OSO),ONO:r2(ONO),NNO:r2(NNO)};
  const card=[N,S,L,O],cola=[NE,SE,SO,NO],sub=[NNE,ENE,ESE,SSE,SSO,OSO,ONO,NNO];
  const iac=r2(avg(card)*0.5+avg(cola)*0.3+avg(sub)*0.2);
  const entries=Object.entries(v);
  return { vetores:v, iac, dom:[...entries].sort((a,b)=>b[1]-a[1])[0][0], neg:entries.filter(([,x])=>x<4).map(([k])=>k), crit:entries.filter(([k,x])=>['N','S','L','O','NE','SE','SO','NO'].includes(k)&&x<5).map(([k])=>k), mediaGeral:r2(avg(Object.values(v))) };
}

// ══════════════════════════════════════════════════════════════════════════
//  HANDLER PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const CH  = corsHeaders(env, request);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CH });

    // ── GET /health ────────────────────────────────────────────────────────
    if (url.pathname === '/health') {
      return ok({
        status: 'ok', version: 'v9-d1',
        storage: 'KV(rate/cache) + D1(auth/cardapio/pedidos/vouchers)',
        bindings: {
          kv:  ['LABX_KV', 'LAB_MENU', 'LABSYSTEM_DATA'],
          d1:  ['D1_AUTH', 'D1_CARDAPIO', 'D1_PEDIDOS', 'D1_VOUCHERS', 'MIMOGAME_DB'],
        },
        precoBRL: QR_PRECO_BRL,
        ts: new Date().toISOString(),
      }, 200, CH);
    }

    // ── GET /feed (cache no KV) ────────────────────────────────────────────
    if (url.pathname === '/feed' && request.method === 'GET') {
      try {
        const cached = await env.LABX_KV.get('feed:macro:v9').catch(() => null);
        if (cached) return ok({ ...JSON.parse(cached), cached: true }, 200, CH);
        const [s,i,b,c] = await Promise.all([
          fetchBCB(BCB.SELIC), fetchBCB(BCB.IPCA), fetchBCB(BCB.IBCBR), fetchBCB(BCB.CAMBIO),
        ]);
        const feed = { selic:s, ipca:i, ibcbr:b, cambio:c, capturedAt:new Date().toISOString() };
        await env.LABX_KV.put('feed:macro:v9', JSON.stringify(feed), { expirationTtl: TTL.BCB });
        return ok(feed, 200, CH);
      } catch(e) { return err('BCB indisponível: '+e.message, 503, CH); }
    }

    // ══════════════════════════════════════════════════════════════════════
    //  PÚBLICAS — Cardápio e Pedidos
    // ══════════════════════════════════════════════════════════════════════

    // GET /menu/:slug[?mesa=N] ─────────────────────────────────────────────
    if (url.pathname.startsWith('/menu/') && request.method === 'GET') {
      const slug = decodeURIComponent(url.pathname.replace('/menu/', '').trim());
      if (!slug) return err('Slug não informado', 400, CH);

      const cardapio = await env.D1_CARDAPIO.prepare(
        'SELECT * FROM cardapios WHERE slug = ?'
      ).bind(slug).first().catch(() => null);

      if (!cardapio) return err('Cardápio não encontrado', 404, CH);
      if (!cardapio.qr_ativado) return err('Cardápio ainda não ativado pelo comerciante.', 402, { ...CH, 'Cache-Control': 'no-store' });

      // Analytics: incrementa views no D1
      const hoje = new Date().toISOString().slice(0, 10);
      await env.D1_CARDAPIO.prepare(`
        INSERT INTO cardapio_views (slug, data, views) VALUES (?, ?, 1)
        ON CONFLICT(slug, data) DO UPDATE SET views = views + 1
      `).bind(slug, hoje).run().catch(() => null);

      const mesa = url.searchParams.get('mesa') || url.searchParams.get('comanda') || null;
      return ok({
        slug: cardapio.slug,
        nomeLoja:   cardapio.nome_loja,
        descricao:  cardapio.descricao,
        telefone:   cardapio.telefone,
        endereco:   cardapio.endereco,
        instagram:  cardapio.instagram,
        corPrimaria: cardapio.cor_primaria,
        logo:       cardapio.logo,
        horarios:   JSON.parse(cardapio.horarios  || '{}'),
        categorias: JSON.parse(cardapio.categorias|| '[]'),
        entrega:    JSON.parse(cardapio.entrega   || '{}'),
        qrAtivado:  !!cardapio.qr_ativado,
        mesa,
        ts: new Date().toISOString(),
      }, 200, { ...CH, 'Cache-Control': 'public, max-age=30' });
    }

    // POST /pedido/enviar ───────────────────────────────────────────────────
    if (url.pathname === '/pedido/enviar' && request.method === 'POST') {
      const body = await request.json().catch(() => null);
      if (!body) return err('Payload inválido', 400, CH);
      const { slug, itens, identificacao, mesa, total, obs } = body;
      if (!slug)                  return err('slug obrigatório', 400, CH);
      if (!itens?.length)         return err('Carrinho vazio', 400, CH);
      if (!identificacao?.trim()) return err('Informe nome ou mesa', 400, CH);

      const cardapio = await env.D1_CARDAPIO.prepare(
        'SELECT api_key, nome_loja, telefone, qr_ativado FROM cardapios WHERE slug = ?'
      ).bind(slug).first().catch(() => null);

      if (!cardapio)           return err('Loja não encontrada', 404, CH);
      if (!cardapio.qr_ativado) return err('Loja não ativou o sistema de pedidos.', 403, CH);

      const pedidoId = `PED-${Date.now().toString(36).toUpperCase()}`;
      await env.D1_PEDIDOS.prepare(`
        INSERT INTO pedidos (id, api_key, slug, nome_loja, identificacao, mesa, itens, total, obs, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'novo')
      `).bind(
        pedidoId,
        cardapio.api_key,
        slug,
        cardapio.nome_loja,
        identificacao.trim(),
        mesa || identificacao.trim(),
        JSON.stringify(itens),
        String(total),
        obs?.trim() || '',
      ).run();

      return ok({ ok:true, pedidoId, telefone:cardapio.telefone||'', nomeLoja:cardapio.nome_loja }, 201, CH);
    }

    // ══════════════════════════════════════════════════════════════════════
    //  ADMIN (X-Admin-Secret)
    // ══════════════════════════════════════════════════════════════════════
    const adminSecret = request.headers.get('X-Admin-Secret');
    const isAdmin = env.LABX_ADMIN_SECRET && adminSecret === env.LABX_ADMIN_SECRET;

    if (url.pathname.startsWith('/admin/')) {
      if (!isAdmin) return err('Não autorizado', 401, CH);

      // POST /admin/keys ─────────────────────────────────────────────────
      if (url.pathname === '/admin/keys' && request.method === 'POST') {
        const { owner='Anônimo', tier='starter', credits=0, qrCredits=0, revendedor=null } = await request.json().catch(()=>({}));
        const key = gerarApiKey();
        await env.D1_AUTH.prepare(`
          INSERT INTO profiles (api_key, owner, tier, credits, qr_credits, revendedor)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(key, owner, tier, credits, qrCredits, revendedor).run();
        await env.D1_AUTH.prepare(
          `INSERT INTO auth_log (api_key, action, detail) VALUES (?, 'create', ?)`
        ).bind(key, JSON.stringify({ owner, tier, credits, qrCredits })).run();
        return ok({ ok:true, key, profile:{ owner, tier, credits, qrCredits, revendedor } }, 201, CH);
      }

      // GET /admin/keys ──────────────────────────────────────────────────
      if (url.pathname === '/admin/keys' && request.method === 'GET') {
        const { results } = await env.D1_AUTH.prepare(
          'SELECT * FROM profiles ORDER BY created_at DESC'
        ).all();
        return ok({ total:results.length, keys:results }, 200, CH);
      }

      // PATCH /admin/keys/:key ───────────────────────────────────────────
      if (url.pathname.startsWith('/admin/keys/sk_lab_') && request.method === 'PATCH') {
        const key = url.pathname.replace('/admin/keys/', '');
        const body = await request.json().catch(()=>({}));
        const row = await env.D1_AUTH.prepare('SELECT * FROM profiles WHERE api_key = ?').bind(key).first();
        if (!row) return err('Chave não encontrada', 404, CH);
        // Constrói update dinâmico
        const upd = {};
        if (body.credits   !== undefined) upd.credits    = row.credits   + body.credits;
        if (body.qrCredits !== undefined) upd.qr_credits = row.qr_credits + body.qrCredits;
        if (body.tier      !== undefined) upd.tier       = body.tier;
        if (body.active    !== undefined) upd.active     = body.active ? 1 : 0;
        if (body.revendedor!== undefined) upd.revendedor = body.revendedor;
        if (!Object.keys(upd).length) return err('Nenhum campo para atualizar', 400, CH);
        await saveProfile(env, key, upd);
        await env.D1_AUTH.prepare(
          `INSERT INTO auth_log (api_key, action, detail) VALUES (?, 'patch', ?)`
        ).bind(key, JSON.stringify(body)).run();
        const updated = await env.D1_AUTH.prepare('SELECT * FROM profiles WHERE api_key = ?').bind(key).first();
        return ok({ ok:true, profile:updated }, 200, CH);
      }

      // DELETE /admin/keys/:key ──────────────────────────────────────────
      if (url.pathname.startsWith('/admin/keys/sk_lab_') && request.method === 'DELETE') {
        const key = url.pathname.replace('/admin/keys/', '');
        await env.D1_AUTH.prepare(
          `UPDATE profiles SET active = 0, updated_at = datetime('now') WHERE api_key = ?`
        ).bind(key).run();
        await env.LABX_KV.delete(`auth_cache:${key}`).catch(() => null);
        await env.D1_AUTH.prepare(
          `INSERT INTO auth_log (api_key, action, detail) VALUES (?, 'revoke', 'admin action')`
        ).bind(key).run();
        return ok({ ok:true, revoked:key }, 200, CH);
      }

      // GET /admin/stats ─────────────────────────────────────────────────
      if (url.pathname === '/admin/stats' && request.method === 'GET') {
        const [keys, qrStats, pedStats, vStats] = await Promise.all([
          env.D1_AUTH.prepare(`
            SELECT COUNT(*) as total, SUM(CASE WHEN active=1 THEN 1 ELSE 0 END) as ativos,
            SUM(qr_credits) as credits_em_circulacao, SUM(qr_total) as qr_ativados
            FROM profiles
          `).first(),
          env.D1_CARDAPIO.prepare(`
            SELECT COUNT(*) as total_cardapios,
            SUM(CASE WHEN qr_ativado=1 THEN 1 ELSE 0 END) as ativos
            FROM cardapios
          `).first(),
          env.D1_PEDIDOS.prepare(`
            SELECT COUNT(*) as total_pedidos,
            COUNT(CASE WHEN created_at >= datetime('now', '-1 day') THEN 1 END) as ultimas_24h
            FROM pedidos
          `).first(),
          env.D1_VOUCHERS.prepare(`
            SELECT COUNT(*) as total,
            SUM(CASE WHEN status='disponivel' THEN 1 ELSE 0 END) as disponiveis,
            SUM(CASE WHEN status='usado' THEN 1 ELSE 0 END) as usados
            FROM vouchers
          `).first(),
        ]);
        return ok({
          keys:        { total:keys?.total||0, ativos:keys?.ativos||0 },
          creditos:    { emCirculacao:keys?.credits_em_circulacao||0 },
          qr:          { ativados:keys?.qr_ativados||0, receitaBRL:((keys?.qr_ativados||0)*QR_PRECO_BRL).toFixed(2) },
          cardapios:   { total:qrStats?.total_cardapios||0, ativos:qrStats?.ativos||0 },
          pedidos:     { total:pedStats?.total_pedidos||0, ultimas24h:pedStats?.ultimas_24h||0 },
          vouchers:    { total:vStats?.total||0, disponiveis:vStats?.disponiveis||0, usados:vStats?.usados||0 },
          precoPorQR:  QR_PRECO_BRL,
          ts: new Date().toISOString(),
        }, 200, CH);
      }

      // ── VOUCHER FACTORY ─────────────────────────────────────────────────

      // POST /admin/vouchers/gerar ───────────────────────────────────────
      if (url.pathname === '/admin/vouchers/gerar' && request.method === 'POST') {
        const { quantidade=1, valor=1, revendedor='Holding', observacao='' } = await request.json().catch(()=>({}));
        if (quantidade < 1 || quantidade > 200) return err('quantidade: 1–200', 400, CH);
        if (valor < 1)                          return err('valor mínimo: 1', 400, CH);
        const gerados = [];
        // Batch insert no D1
        const stmts = [];
        for (let i=0; i<quantidade; i++) {
          const codigo = gerarCodigo(valor);
          gerados.push(codigo);
          stmts.push(env.D1_VOUCHERS.prepare(`
            INSERT INTO vouchers (codigo, valor, revendedor, observacao)
            VALUES (?, ?, ?, ?)
          `).bind(codigo, parseInt(valor), revendedor, observacao));
        }
        await env.D1_VOUCHERS.batch(stmts);
        return ok({
          ok:true, gerados, quantidade, valor, revendedor,
          valorTotalBRL: (quantidade * valor * QR_PRECO_BRL).toFixed(2),
        }, 201, CH);
      }

      // GET /admin/vouchers[?status=] ────────────────────────────────────
      if (url.pathname === '/admin/vouchers' && request.method === 'GET') {
        const filtro = url.searchParams.get('status');
        const { results } = filtro
          ? await env.D1_VOUCHERS.prepare('SELECT * FROM vouchers WHERE status = ? ORDER BY created_at DESC').bind(filtro).all()
          : await env.D1_VOUCHERS.prepare('SELECT * FROM vouchers ORDER BY created_at DESC LIMIT 500').all();
        return ok({ total:results.length, vouchers:results }, 200, CH);
      }

      // DELETE /admin/vouchers/:codigo ───────────────────────────────────
      if (url.pathname.startsWith('/admin/vouchers/LAB-') && request.method === 'DELETE') {
        const codigo = url.pathname.replace('/admin/vouchers/', '');
        const v = await env.D1_VOUCHERS.prepare('SELECT * FROM vouchers WHERE codigo = ?').bind(codigo).first();
        if (!v) return err('Voucher não encontrado', 404, CH);
        if (v.status === 'usado') return err('Voucher já utilizado, não pode ser cancelado', 400, CH);
        await env.D1_VOUCHERS.prepare(
          `UPDATE vouchers SET status='cancelado', cancelado_em=datetime('now') WHERE codigo=?`
        ).bind(codigo).run();
        return ok({ ok:true, codigo, status:'cancelado' }, 200, CH);
      }

      // GET /admin/pedidos ───────────────────────────────────────────────
      if (url.pathname === '/admin/pedidos' && request.method === 'GET') {
        const { results } = await env.D1_PEDIDOS.prepare(`
          SELECT * FROM pedidos
          WHERE created_at >= datetime('now', '-1 day')
          ORDER BY created_at DESC
        `).all();
        return ok({ total:results.length, pedidos:results }, 200, CH);
      }

      // GET /admin/cross/mimo — cruzamento D1_AUTH × MIMOGAME_DB ─────────
      if (url.pathname === '/admin/cross/mimo' && request.method === 'GET') {
        // Exemplo de cross-query: lojistas que também têm conta no MimoGame
        // Ajuste a query de acordo com o schema real do MIMOGAME_DB
        const { results: labUsers }  = await env.D1_AUTH.prepare('SELECT api_key, owner, tier FROM profiles WHERE active=1').all();
        const { results: mimoUsers } = await env.MIMOGAME_DB.prepare('SELECT * FROM users LIMIT 100').all().catch(() => ({ results: [] }));
        return ok({
          labUsers:  labUsers.length,
          mimoUsers: mimoUsers.length,
          cross: {
            note: 'Cross-join disponível — atualize esta query com o schema real do MIMOGAME_DB',
            mimoSample: mimoUsers.slice(0, 5),
          },
        }, 200, CH);
      }

      return err('Rota admin não encontrada', 404, CH);
    }

    // ══════════════════════════════════════════════════════════════════════
    //  AUTENTICADAS (X-API-Key)
    // ══════════════════════════════════════════════════════════════════════
    const apiKey  = request.headers.get('X-API-Key');
    const profile = await getProfile(env, apiKey);
    if (!profile)         return err('API Key inválida. Obtenha em labriolag.shop', 401, CH);
    if (!profile.active)  return err('API Key revogada. Contate a Labriolag Holding.', 403, CH);

    const withinLimit = await checkRateLimit(env, apiKey);
    if (!withinLimit) return err('Rate limit: 30 req/min por chave.', 429, CH);

    // ── GET /me ────────────────────────────────────────────────────────────
    if (url.pathname === '/me') {
      const cardapio = await env.D1_CARDAPIO.prepare(
        'SELECT slug, qr_ativado FROM cardapios WHERE api_key = ?'
      ).bind(apiKey).first().catch(() => null);
      return ok({
        owner:       profile.owner,
        tier:        profile.tier,
        credits:     profile.credits || 0,
        qrCredits:   profile.tier === 'enterprise' ? 'ilimitado' : (profile.qr_credits || 0),
        qrTotal:     profile.qr_total || 0,
        usageTotal:  profile.usage_total || 0,
        active:      !!profile.active,
        revendedor:  profile.revendedor || null,
        temCardapio: !!cardapio,
        slugAtual:   cardapio?.slug || null,
        qrAtivado:   !!(cardapio?.qr_ativado),
        precoPorQR:  QR_PRECO_BRL,
      }, 200, CH);
    }

    // ── POST /cardapio/salvar ──────────────────────────────────────────────
    if (url.pathname === '/cardapio/salvar' && request.method === 'POST') {
      if (!TIERS_CARDAPIO.includes(profile.tier)) {
        return err(`Tier "${profile.tier}" não permite cardápio.`, 403, CH);
      }
      const body = await request.json().catch(()=>({}));
      const { nomeLoja, descricao='', telefone='', endereco='', instagram='', corPrimaria='#ff4040', logo='', horarios={}, categorias=[], entrega={ ativa:false, taxas:[] }, slug:slugSolicitado } = body;
      if (!nomeLoja) return err('nomeLoja é obrigatório', 400, CH);

      // Resolve slug
      const existente = await env.D1_CARDAPIO.prepare(
        'SELECT slug, qr_ativado, qr_ativado_em FROM cardapios WHERE api_key = ?'
      ).bind(apiKey).first().catch(() => null);
      let slug = slugSolicitado ? gerarSlug(slugSolicitado) : (existente?.slug || gerarSlug(nomeLoja));

      // Verifica unicidade
      const slugConflito = await env.D1_CARDAPIO.prepare(
        'SELECT api_key FROM cardapios WHERE slug = ? AND api_key != ?'
      ).bind(slug, apiKey).first().catch(() => null);
      if (slugConflito) slug = slug + '-' + Date.now().toString(36).slice(-4);

      const qrAtivado   = existente?.qr_ativado   || 0;
      const qrAtivadoEm = existente?.qr_ativado_em || null;

      // Upsert no D1
      await env.D1_CARDAPIO.prepare(`
        INSERT INTO cardapios (api_key, slug, nome_loja, descricao, telefone, endereco, instagram, cor_primaria, logo, horarios, categorias, entrega, qr_ativado, qr_ativado_em, owned_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(api_key) DO UPDATE SET
          slug=excluded.slug, nome_loja=excluded.nome_loja, descricao=excluded.descricao,
          telefone=excluded.telefone, endereco=excluded.endereco, instagram=excluded.instagram,
          cor_primaria=excluded.cor_primaria, logo=excluded.logo, horarios=excluded.horarios,
          categorias=excluded.categorias, entrega=excluded.entrega, owned_by=excluded.owned_by,
          updated_at=datetime('now')
      `).bind(
        apiKey, slug, nomeLoja, descricao, telefone, endereco, instagram,
        corPrimaria, logo,
        JSON.stringify(horarios), JSON.stringify(categorias), JSON.stringify(entrega),
        qrAtivado, qrAtivadoEm, profile.owner,
      ).run();

      const menuUrl = `${new URL(request.url).origin}/menu/${slug}`;
      return ok({
        ok:true, slug, menuUrl, updatedAt:new Date().toISOString(),
        qrAtivado: !!qrAtivado,
        qrCredits: profile.tier==='enterprise'?'ilimitado':(profile.qr_credits||0),
      }, 200, CH);
    }

    // ── POST /cardapio/ativar-qr ───────────────────────────────────────────
    if (url.pathname === '/cardapio/ativar-qr' && request.method === 'POST') {
      if (!TIERS_CARDAPIO.includes(profile.tier)) return err('Tier não permite ativação.', 403, CH);

      const cardapio = await env.D1_CARDAPIO.prepare(
        'SELECT slug, qr_ativado FROM cardapios WHERE api_key = ?'
      ).bind(apiKey).first().catch(() => null);
      if (!cardapio) return err('Salve o cardápio antes de ativar o QR.', 400, CH);

      if (cardapio.qr_ativado) {
        return ok({ ok:true, jaAtivado:true, slug:cardapio.slug, qrCredits:profile.qr_credits||0, msg:'QR já ativo. Nenhum crédito consumido.' }, 200, CH);
      }

      const isEnterprise = profile.tier === 'enterprise';
      const creds = profile.qr_credits ?? 0;
      if (!isEnterprise && creds < 1) {
        return err(`Saldo insuficiente (${creds} créditos). Cada ativação = R$ ${QR_PRECO_BRL}.`, 402, CH);
      }

      const agora = new Date().toISOString();
      // Atualiza cardápio
      await env.D1_CARDAPIO.prepare(
        `UPDATE cardapios SET qr_ativado=1, qr_ativado_em=?, updated_at=datetime('now') WHERE api_key=?`
      ).bind(agora, apiKey).run();

      // Debita crédito + incrementa qr_total
      if (!isEnterprise) {
        await env.D1_AUTH.prepare(`
          UPDATE profiles SET qr_credits = qr_credits - 1, qr_total = qr_total + 1,
          last_qr_at = ?, updated_at = datetime('now') WHERE api_key = ?
        `).bind(agora, apiKey).run();
        await env.LABX_KV.delete(`auth_cache:${apiKey}`).catch(() => null);
      }

      // Log de auditoria no D1_VOUCHERS (tabela qr_log)
      await env.D1_VOUCHERS.prepare(
        `INSERT INTO qr_log (api_key, slug, owner, tier, credit_used) VALUES (?,?,?,?,?)`
      ).bind(apiKey, cardapio.slug, profile.owner, profile.tier, isEnterprise ? 0 : 1).run();

      const menuUrl = `${new URL(request.url).origin}/menu/${cardapio.slug}`;
      const novoSaldo = isEnterprise ? 'ilimitado' : (creds - 1);
      return ok({
        ok:true, slug:cardapio.slug, menuUrl, qrCredits:novoSaldo,
        creditUsed: !isEnterprise,
        msg: isEnterprise ? 'QR ativado (Enterprise).' : `✅ QR ativado! 1 crédito (R$ ${QR_PRECO_BRL}) consumido.`,
      }, 200, CH);
    }

    // ── GET /cardapio/meu ──────────────────────────────────────────────────
    if (url.pathname === '/cardapio/meu' && request.method === 'GET') {
      const row = await env.D1_CARDAPIO.prepare('SELECT * FROM cardapios WHERE api_key = ?').bind(apiKey).first().catch(() => null);
      if (!row) return ok({ existe:false, qrCredits:profile.qr_credits||0 }, 200, CH);
      const origin = new URL(request.url).origin;
      return ok({
        existe: true,
        slug:       row.slug,
        nomeLoja:   row.nome_loja,
        descricao:  row.descricao,
        telefone:   row.telefone,
        endereco:   row.endereco,
        instagram:  row.instagram,
        corPrimaria: row.cor_primaria,
        logo:       row.logo,
        horarios:   JSON.parse(row.horarios  || '{}'),
        categorias: JSON.parse(row.categorias|| '[]'),
        entrega:    JSON.parse(row.entrega   || '{}'),
        qrAtivado:  !!row.qr_ativado,
        menuUrl:    row.qr_ativado ? `${origin}/menu/${row.slug}` : null,
        qrCredits:  profile.tier==='enterprise' ? 'ilimitado' : (profile.qr_credits||0),
      }, 200, CH);
    }

    // ── POST /voucher/resgatar ─────────────────────────────────────────────
    if (url.pathname === '/voucher/resgatar' && request.method === 'POST') {
      const { codigo } = await request.json().catch(()=>({}));
      if (!codigo) return err('Código obrigatório', 400, CH);

      const voucher = await env.D1_VOUCHERS.prepare(
        'SELECT * FROM vouchers WHERE codigo = ?'
      ).bind(codigo.trim().toUpperCase()).first().catch(() => null);
      if (!voucher) return err('Voucher inválido ou inexistente', 404, CH);
      if (voucher.status !== 'disponivel') return err(`Voucher ${voucher.status === 'usado' ? 'já utilizado' : 'cancelado'}`, 400, CH);

      const saldoAnterior = profile.qr_credits || 0;
      const novoSaldo = saldoAnterior + voucher.valor;

      await env.D1_VOUCHERS.batch([
        // Mata o voucher
        env.D1_VOUCHERS.prepare(`
          UPDATE vouchers SET status='usado', resgatado_por=?, resgatado_em=datetime('now')
          WHERE codigo=?
        `).bind(apiKey, codigo.toUpperCase()),
        // Log imutável
        env.D1_VOUCHERS.prepare(`
          INSERT INTO voucher_log (api_key, codigo, valor, saldo_anterior, novo_saldo, owner)
          VALUES (?,?,?,?,?,?)
        `).bind(apiKey, codigo.toUpperCase(), voucher.valor, saldoAnterior, novoSaldo, profile.owner),
      ]);

      // Credita no perfil
      await env.D1_AUTH.prepare(
        `UPDATE profiles SET qr_credits = ?, updated_at = datetime('now') WHERE api_key = ?`
      ).bind(novoSaldo, apiKey).run();
      await env.LABX_KV.delete(`auth_cache:${apiKey}`).catch(() => null);

      return ok({ ok:true, msg:`+${voucher.valor} créditos adicionados!`, novoSaldo, valorBRL:(voucher.valor*QR_PRECO_BRL).toFixed(2) }, 200, CH);
    }

    // ── GET /pedidos/feed — últimos 20 (polling 5s) ────────────────────────
    if (url.pathname === '/pedidos/feed' && request.method === 'GET') {
      const { results } = await env.D1_PEDIDOS.prepare(`
        SELECT * FROM pedidos WHERE api_key = ?
        ORDER BY created_at DESC LIMIT 20
      `).bind(apiKey).all();
      return ok({
        pedidos: results.map(p => ({ ...p, itens: JSON.parse(p.itens||'[]') })),
      }, 200, CH);
    }

    // ── PATCH /pedidos/:id/status ──────────────────────────────────────────
    if (url.pathname.match(/^\/pedidos\/PED-[A-Z0-9]+\/status$/) && request.method === 'PATCH') {
      const pedidoId = url.pathname.split('/')[2];
      const { status } = await request.json().catch(()=>({}));
      const VALIDOS = ['novo','preparando','pronto','entregue','cancelado'];
      if (!VALIDOS.includes(status)) return err(`Status inválido. Use: ${VALIDOS.join(', ')}`, 400, CH);

      const res = await env.D1_PEDIDOS.prepare(`
        UPDATE pedidos SET status=?, status_at=datetime('now')
        WHERE id=? AND api_key=?
      `).bind(status, pedidoId, apiKey).run();

      if (!res.meta?.changes) return err('Pedido não encontrado', 404, CH);
      return ok({ ok:true, id:pedidoId, status }, 200, CH);
    }

    // ── GET /pedidos/historico ─────────────────────────────────────────────
    if (url.pathname === '/pedidos/historico' && request.method === 'GET') {
      const { results } = await env.D1_PEDIDOS.prepare(`
        SELECT * FROM pedidos WHERE api_key = ?
        ORDER BY created_at DESC LIMIT 200
      `).bind(apiKey).all();
      return ok({
        total: results.length,
        pedidos: results.map(p => ({ ...p, itens: JSON.parse(p.itens||'[]') })),
      }, 200, CH);
    }

    // ── GET /ibge/:cod (cache no LABX_KV) ─────────────────────────────────
    if (url.pathname.startsWith('/ibge/') && request.method === 'GET') {
      const cod = url.pathname.replace('/ibge/', '').trim();
      if (!/^\d{7}$/.test(cod)) return err('Código IBGE inválido', 400, CH);
      const cached = await env.LABX_KV.get(`ibge:${cod}`).catch(() => null);
      if (cached) return ok({ ...JSON.parse(cached), cached:true }, 200, CH);
      try {
        const [empR,pesR,popR] = await Promise.allSettled([fetchIBGEEmpresas(cod),fetchIBGEPessoal(cod),fetchIBGEPopulacao(cod)]);
        const data = { codMunicipio:cod, nome:popR.value?.nome||'Município', populacao:popR.value?.pop||50000, empresas:empR.value||null, pessoal:pesR.value||null, fonte:'IBGE CEMPRE/SIDRA', capturedAt:new Date().toISOString() };
        await env.LABX_KV.put(`ibge:${cod}`, JSON.stringify(data), { expirationTtl: 60*60*24 });
        return ok(data, 200, CH);
      } catch(e) { return err('IBGE indisponível: '+e.message, 503, CH); }
    }

    // ── POST /calcular (motor 16D) ─────────────────────────────────────────
    if (url.pathname === '/calcular' && request.method === 'POST') {
      if ((profile.credits||0) <= 0) return err('Créditos 16D esgotados.', 402, CH);
      const body = await request.json().catch(()=>({}));
      const { renda=0,cnpjs=0,populacao=50000,pib=35,modo=1.0,codMunicipio } = body;
      let bcbData={},ibgeData={};
      const [bcbRes,ibgeRes] = await Promise.allSettled([
        (async()=>{ const c=await env.LABX_KV.get('feed:macro:v9').catch(()=>null); if(c){const d=JSON.parse(c);return{selic:+d.selic.valor,ipca:+d.ipca.valor,ibcbr:+d.ibcbr.valor};} const[s,i,b]=await Promise.all([fetchBCB(BCB.SELIC),fetchBCB(BCB.IPCA),fetchBCB(BCB.IBCBR)]); return{selic:+s.valor,ipca:+i.valor,ibcbr:+b.valor}; })(),
        codMunicipio&&/^\d{7}$/.test(codMunicipio)?(async()=>{ const c=await env.LABX_KV.get(`ibge:${codMunicipio}`).catch(()=>null); if(c)return JSON.parse(c); return{}; })():Promise.resolve({}),
      ]);
      if(bcbRes.status==='fulfilled')bcbData=bcbRes.value;
      if(ibgeRes.status==='fulfilled')ibgeData=ibgeRes.value;
      const resultado=calcularVetores({renda:Number(renda),cnpjs:Number(cnpjs),populacao:Number(populacao),pib:Number(pib),modo:Number(modo),bcbData,ibgeData});
      await env.D1_AUTH.prepare(
        `UPDATE profiles SET credits=credits-1, usage_total=usage_total+1, last_used_at=datetime('now'), updated_at=datetime('now') WHERE api_key=?`
      ).bind(apiKey).run();
      await env.LABX_KV.delete(`auth_cache:${apiKey}`).catch(()=>null);
      resultado.creditsRestantes=(profile.credits||0)-1;
      return ok(resultado,200,CH);
    }

    return err('Rota não encontrada', 404, CH);
  },
};
