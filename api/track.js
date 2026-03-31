// api/track.js — Vercel Edge Function
// Registra visita + IP para un ref en stats.json (anti-trampa)
export const config = { runtime: 'edge' };

const REPO = process.env.GITHUB_REPO || 'DrCriptox/innova-ia-landing';
const BRANCH = 'main';
const FILE = 'stats.json';

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors() });

  let ref;
  if (req.method === 'POST') {
    try { const b = await req.json(); ref = b.ref; } catch {}
  } else {
    ref = new URL(req.url).searchParams.get('ref');
  }

  if (!ref || !/^[a-z0-9]{2,30}$/.test(ref)) {
    return new Response(JSON.stringify({ ok: false }), { status: 200, headers: { 'Content-Type': 'application/json', ...cors() } });
  }

  // Extraer IP del visitante
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown';

  const TOKEN = process.env.GITHUB_TOKEN;
  if (!TOKEN) return new Response(JSON.stringify({ ok: false }), { status: 200, headers: { 'Content-Type': 'application/json', ...cors() } });

  const ghHeaders = {
    Authorization: `token ${TOKEN}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
    'User-Agent': 'InnovaIA-App',
  };
  const apiBase = `https://api.github.com/repos/${REPO}/contents/${FILE}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      let stats = {};
      let fileSha = null;
      const getRes = await fetch(`${apiBase}?ref=${BRANCH}`, { headers: ghHeaders });
      if (getRes.ok) {
        const data = await getRes.json();
        fileSha = data.sha;
        if (data.encoding === 'base64' && data.content) {
          const text = atob(data.content.replace(/\n/g, ''));
          try { stats = JSON.parse(text); } catch {}
        }
      }

      // Estructura por ref: { total, ips: { "ip": count } }
      // Soporta formato legacy (numero simple) y nuevo (objeto)
      const entry = stats[ref];
      let entryObj;
      if (typeof entry === 'number') {
        // migrar formato antiguo
        entryObj = { total: entry, ips: {} };
      } else if (entry && typeof entry === 'object') {
        entryObj = entry;
      } else {
        entryObj = { total: 0, ips: {} };
      }

      entryObj.total = (entryObj.total || 0) + 1;
      if (ip !== 'unknown') {
        entryObj.ips[ip] = (entryObj.ips[ip] || 0) + 1;
      }
      stats[ref] = entryObj;

      const newContent = btoa(JSON.stringify(stats, null, 2));
      const putBody = { message: `track: +1 visita ${ref}`, content: newContent, branch: BRANCH };
      if (fileSha) putBody.sha = fileSha;
      const putRes = await fetch(apiBase, { method: 'PUT', headers: ghHeaders, body: JSON.stringify(putBody) });
      if (putRes.ok) {
        return new Response(JSON.stringify({ ok: true, ref, total: entryObj.total }), {
          status: 200, headers: { 'Content-Type': 'application/json', ...cors() }
        });
      }
      if (putRes.status === 409 || putRes.status === 422) continue;
      break;
    } catch (e) {
      if (attempt === 2) break;
    }
  }
  return new Response(JSON.stringify({ ok: false }), { status: 200, headers: { 'Content-Type': 'application/json', ...cors() } });
}

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
