// api/merge-stats.js — one-shot: fusiona alias en stats.json
// Mueve visitas de un slug alias al slug principal y elimina el alias
export const config = { runtime: 'edge' };

const REPO   = process.env.GITHUB_REPO || 'DrCriptox/innova-ia-landing';
const BRANCH = 'main';
const FILE   = 'stats.json';
const SECRET = process.env.ADMIN_SECRET || 'Genesis22';

export default async function handler(req) {
  if (req.method !== 'POST') return json({ ok: false, error: 'method' }, 405);

  let secret, from, to;
  try { const b = await req.json(); secret = b.secret; from = b.from; to = b.to; } catch {}
  if (secret !== SECRET) return json({ ok: false, error: 'unauthorized' }, 401);
  if (!from || !to) return json({ ok: false, error: 'from and to required' }, 400);

  const TOKEN = process.env.GITHUB_TOKEN;
  if (!TOKEN) return json({ ok: false, error: 'no token' }, 500);

  const ghHeaders = {
    Authorization: `token ${TOKEN}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
    'User-Agent': 'InnovaIA-App',
  };
  const apiBase = `https://api.github.com/repos/${REPO}/contents/${FILE}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const getRes = await fetch(`${apiBase}?ref=${BRANCH}`, { headers: ghHeaders });
      if (!getRes.ok) return json({ ok: false, error: 'no file' }, 404);
      const data = await getRes.json();
      const fileSha = data.sha;

      let stats = {};
      if (data.encoding === 'base64' && data.content) {
        try { stats = JSON.parse(atob(data.content.replace(/\n/g, ''))); } catch {}
      } else if (data.download_url) {
        const raw = await fetch(data.download_url);
        if (raw.ok) try { stats = await raw.json(); } catch {}
      }

      const src  = stats[from] || { total: 0, ips: {} };
      const dst  = stats[to]   || { total: 0, ips: {} };

      // Merge totals
      dst.total = (dst.total || 0) + (src.total || 0);

      // Merge IPs
      const srcIps = src.ips || {};
      dst.ips = dst.ips || {};
      for (const ip of Object.keys(srcIps)) {
        dst.ips[ip] = (dst.ips[ip] || 0) + srcIps[ip];
      }

      stats[to] = dst;
      delete stats[from]; // eliminar alias del ranking

      const bytes = new TextEncoder().encode(JSON.stringify(stats, null, 2));
      let bin = ''; bytes.forEach(b => bin += String.fromCharCode(b));
      const newContent = btoa(bin);

      const putRes = await fetch(apiBase, {
        method: 'PUT', headers: ghHeaders,
        body: JSON.stringify({
          message: `admin: fusionar stats ${from} → ${to}`,
          content: newContent, branch: BRANCH, sha: fileSha,
        }),
      });
      if (putRes.ok) return json({ ok: true, merged: src.total, newTotal: dst.total });
      if (putRes.status === 409 || putRes.status === 422) continue;
      break;
    } catch (e) { if (attempt === 2) break; }
  }
  return json({ ok: false, error: 'write failed' }, 500);
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
