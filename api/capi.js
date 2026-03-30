// Meta Conversions API (CAPI) — Vercel Edge Function
// Pixel ID: 916162744586534

export const config = { runtime: 'edge' };

const PIXEL_ID = '916162744586534';
const ALLOWED_ORIGIN = 'https://www.innovaia.app';

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  const TOKEN = process.env.META_CAPI_TOKEN;
  if (!TOKEN) {
    return new Response(JSON.stringify({ error: 'CAPI not configured' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }
  const { event_name, event_data = {} } = body;
  if (!event_name) {
    return new Response(JSON.stringify({ error: 'event_name required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
             req.headers.get('cf-connecting-ip') || null;
  const userAgent = req.headers.get('user-agent') || null;
  const userData = {};
  if (ip) userData.client_ip_address = ip;
  if (userAgent) userData.client_user_agent = userAgent;
  if (event_data.fbp) userData.fbp = event_data.fbp;
  if (event_data.fbc) userData.fbc = event_data.fbc;
  if (event_data.em) userData.em = event_data.em;
  if (event_data.ph) userData.ph = event_data.ph;
  if (event_data.fn) userData.fn = event_data.fn;
  if (event_data.ln) userData.ln = event_data.ln;
  const eventPayload = {
    event_name,
    event_time: Math.floor(Date.now() / 1000),
    action_source: 'website',
    event_source_url: event_data.url || 'https://www.innovaia.app/',
    event_id: event_data.event_id || (event_name + '_' + Date.now()),
    user_data: userData,
  };
  if (event_data.custom_data && Object.keys(event_data.custom_data).length > 0) {
    eventPayload.custom_data = event_data.custom_data;
  }
  const capiPayload = { data: [eventPayload] };
  if (process.env.CAPI_TEST_CODE) capiPayload.test_event_code = process.env.CAPI_TEST_CODE;
  try {
    const metaRes = await fetch(
      'https://graph.facebook.com/v19.0/' + PIXEL_ID + '/events?access_token=' + TOKEN,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(capiPayload) }
    );
    const result = await metaRes.json();
    return new Response(JSON.stringify(result), {
      status: metaRes.ok ? 200 : 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(req) },
    });
  } catch (err) {
    console.error('CAPI fetch error:', err);
    return new Response(JSON.stringify({ error: 'Meta API error' }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders(req) },
    });
  }
}

function corsHeaders(req) {
  const origin = req.headers.get('origin') || '';
  const allowed = (origin === ALLOWED_ORIGIN || origin === 'https://innovaia.app') ? origin : ALLOWED_ORIGIN;
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
