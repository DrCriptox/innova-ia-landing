// api/registro.js — Vercel Edge Function v3
// Fixes: large file (>1MB), concurrent writes, foto as separate file
export const config = { runtime: 'edge' };

const ALLOWED_ORIGINS = ['https://www.innovaia.app','https://innovaia.app','https://skyteam.global','https://www.skyteam.global'];
const REPO   = 'DrCriptox/innova-ia-landing';
const BRANCH = 'main';
const FILE   = 'asesores.json';
const GH_API = 'https://api.github.com';

function b64Encode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function json(data, status, req) {
  const origin = req?.headers?.get('origin') || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': allowed,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Skyteam-Secret',
      'Vary': 'Origin',
    },
  });
}

async function readAsesores(ghHeaders) {
  const r = await fetch(GH_API + '/repos/' + REPO + '/contents/' + FILE + '?ref=' + BRANCH, { headers: ghHeaders });
  if (!r.ok) throw new Error('read_failed');
  const meta = await r.json();
  // For files > 1MB GitHub omits base64 content — use raw URL instead
  let text;
  if (meta.encoding === 'none' || !meta.content) {
    const raw = await fetch('https://raw.githubusercontent.com/' + REPO + '/' + BRANCH + '/' + FILE);
    text = await raw.text();
  } else {
    const bin = atob(meta.content.replace(/\n/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    text = new TextDecoder().decode(bytes);
  }
  return { sha: meta.sha, data: JSON.parse(text) };
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return json({}, 204, req);
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, req);

  const origin    = req.headers.get('origin') || '';
  const skySecret = req.headers.get('x-skyteam-secret') || '';
  const validOrigin = ALLOWED_ORIGINS.includes(origin);
  const validSecret = !!(process.env.SKYTEAM_SECRET && skySecret === process.env.SKYTEAM_SECRET);
  if (!validOrigin && !validSecret) return json({ error: 'Unauthorized' }, 403, req);

  const token = process.env.GITHUB_TOKEN;
  if (!token) return json({ error: 'Missing GITHUB_TOKEN' }, 500, req);

  let body;
  try { body = await req.json(); }
  catch { return json({ error: 'Invalid JSON body' }, 400, req); }

  const { nombre, rol, slug, telefono, foto, frase, password } = body;
  if (!nombre || !slug || !telefono) return json({ error: 'Faltan campos: nombre, slug, telefono' }, 400, req);
  if (!/^[a-z0-9_-]{3,40}$/.test(slug)) return json({ error: 'Slug invalido (solo a-z, 0-9, guion, 3-40 chars)' }, 400, req);

  const ghHeaders = {
    'Authorization': 'token ' + token,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
    'User-Agent': 'innovaia-registro',
  };

  // Upload foto as separate file (keeps asesores.json slim)
  let fotoRef = foto || '';
  if (foto && foto.length > 100) {
    try {
      const fotoB64 = foto.includes(',') ? foto.split(',')[1] : foto;
      const fotoPath = 'fotos/' + slug + '.jpg';
      await fetch(GH_API + '/repos/' + REPO + '/contents/' + fotoPath, {
        method: 'PUT',
        headers: ghHeaders,
        body: JSON.stringify({ message: 'foto: ' + slug, content: fotoB64, branch: BRANCH }),
      });
      fotoRef = fotoPath;
    } catch(_) { fotoRef = ''; }
  }

  // Retry loop for concurrent write conflicts
  for (let attempt = 0; attempt < 4; attempt++) {
    let asesores;
    try { asesores = await readAsesores(ghHeaders); }
    catch { return json({ error: 'No se pudo leer asesores.json' }, 500, req); }

    if (asesores.data[slug]) return json({ error: 'Ese slug ya esta en uso. Elige otro.' }, 409, req);

    asesores.data[slug] = { nombre, rol: rol||'Asesor InnovaIA', telefono, frase: frase||'', foto: fotoRef, password: password||'', registrado: new Date().toISOString() };

    const putRes = await fetch(GH_API + '/repos/' + REPO + '/contents/' + FILE, {
      method: 'PUT',
      headers: ghHeaders,
      body: JSON.stringify({
        message: 'registro: add asesor ' + slug,
        content: b64Encode(JSON.stringify(asesores.data, null, 2)),
        sha: asesores.sha,
        branch: BRANCH,
      }),
    });

    if (putRes.ok) {
      return json({ ok: true, slug, url: 'https://www.innovaia.app/?ref=' + slug }, 200, req);
    }

    const err = await putRes.json().catch(() => ({}));
    // 409 = SHA conflict (concurrent write) — retry
    if (putRes.status === 409 || (err.message && err.message.includes('sha'))) {
      await new Promise(r => setTimeout(r, 300 + attempt * 200));
      continue;
    }
    return json({ error: 'No se pudo guardar', detail: err.message }, 500, req);
  }

  return json({ error: 'Conflicto de escritura. Intenta de nuevo en unos segundos.' }, 503, req);
}
