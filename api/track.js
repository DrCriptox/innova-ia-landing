// api/track.js — Vercel Edge Function
// Registra visita + IP, o conversion, para un ref en stats.json
export const config = { runtime: 'edge' };

const REPO   = process.env.GITHUB_REPO || 'DrCriptox/innova-ia-landing';
const BRANCH = 'main';
const FILE   = 'stats.json';

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors() });

  let ref, type;
  if (req.method === 'POST') {
    try { const b = await req.json(); ref = b.ref; type = b.type; } catch {}
  } else {
    const p = new URL(req.url).searchParams;
    ref  = p.get('ref');
    type = p.get('type');
  }

  const ALIASES = { 'emily2025': 'emily2026' };
  if (ALIASES[ref]) ref = ALIASES[ref];

  if (!ref || !/^[a-z0-9]{2,30}$/.test(ref)) {
    return new Response(JSON.stringify({ ok: false }), { status: 200, headers: { 'Content-Type': 'application/json', ...cors() } });
  }

  const isConversion = type === 'conversion';
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';

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
      let stats = {}, fileSha = null;
      const getRes = await fetch(`${apiBase}?ref=${BRANCH}`, { headers: ghHeaders });
      if (getRes.ok) {
        const data = await getRes.json();
        fileSha = data.sha;
        if (data.encoding === 'base64' && data.content) {
          try { stats = JSON.parse(atob(data.content.replace(/\n/g, ''))); } catch {}
        } else if (data.download_url) {
          try { const r = await fetch(data.download_url); if (r.ok) stats = await r.json(); } catch {}
        }
      }

      const entry = stats[ref];
      let obj;
      if (typeof entry === 'number') {
        obj = { total: entry, ips: {} };
      } else if (entry && typeof entry === 'object') {
        obj = entry;
      } else {
        obj = { total: 0, ips: {} };
      }

      if (isConversion) {
        obj.conversions = (obj.conversions || 0) + 1;
      } else {
        obj.total = (obj.total || 0) + 1;
        if (ip !== 'unknown') obj.ips[ip] = (obj.ips[ip] || 0) + 1;
        // Contador diario Colombia (UTC-5)
        const _d=new Date(Date.now()-18000000).toISOString().split('T')[0];
        if(!obj.days)obj.days={};
        obj.days[_d]=(obj.days[_d]||0)+1;
        const _dk=Object.keys(obj.days).sort();if(_dk.length>60)_dk.slice(0,_dk.length-60).forEach(function(k){delete obj.days[k];});
      }

      stats[ref] = obj;

      const putBody = {
        message: isConversion ? `track: +1 conversion ${ref}` : `track: +1 visita ${ref}`,
        content: btoa(JSON.stringify(stats, null, 2)),
        branch: BRANCH,
      };
      if (fileSha) putBody.sha = fileSha;

      const putRes = await fetch(apiBase, { method: 'PUT', headers: ghHeaders, body: JSON.stringify(putBody) });
      if (putRes.ok) {
        return new Response(JSON.stringify({ ok: true, ref, total: obj.total, conversions: obj.conversions || 0 }), {
          status: 200, headers: { 'Content-Type': 'application/json', ...cors() },
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
