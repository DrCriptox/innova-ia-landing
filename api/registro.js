// api/registro.js — Vercel Edge Function
export const config = { runtime: 'edge' };

const ALLOWED_ORIGINS = [
  'https://www.innovaia.app',
  'https://innovaia.app',
  'https://skyteam.global',
  'https://www.skyteam.global',
];
const REPO   = 'DrCriptox/innova-ia-landing';
const BRANCH = 'main';
const FILE   = 'asesores.json';
const GH_API = 'https://api.github.com';

// Edge-runtime safe base64 encode (UTF-8)
function b64Encode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

// Edge-runtime safe base64 decode (UTF-8)
function b64Decode(b64) {
  const bin = atob(b64.replace(/\n/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
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

export default async function handler(req) {
  if (req.method === 'OPTIONS') return json({}, 204, req);
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, req);

  const origin    = req.headers.get('origin') || '';
  const skySecret = req.headers.get('x-skyteam-secret') || '';
  const validOrigin = ALLOWED_ORIGINS.includes(origin);
  const validSecret = !!(process.env.SKYTEAM_SECRET && skySecret === process.env.SKYTEAM_SECRET);
  if (!validOrigin && !validSecret) return json({ error: 'Unauthorized' }, 403, req);

  const token = process.env.GITHUB_TOKEN;
  if (!token) return json({ error: 'Server misconfiguration: missing GITHUB_TOKEN' }, 500, req);

  let body;
  try { body = await req.json(); }
  catch { return json({ error: 'Invalid JSON body' }, 400, req); }

  const { nombre, slug, telefono, foto, frase } = body;
  if (!nombre || !slug || !telefono) return json({ error: 'Faltan campos requeridos: nombre, slug, telefono' }, 400, req);
  if (!/^[a-z0-9_-]{3,40}$/.test(slug)) return json({ error: 'Slug invalido. Solo letras minusculas, numeros, guiones (3-40 chars).' }, 400, req);

  const ghHeaders = {
    'Authorization': 'token ' + token,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
    'User-Agent': 'innovaia-registro',
  };

  const getRes = await fetch(GH_API + '/repos/' + REPO + '/contents/' + FILE + '?ref=' + BRANCH, { headers: ghHeaders });
  if (!getRes.ok) return json({ error: 'No se pudo leer asesores.json' }, 500, req);

  const fileData = await getRes.json();
  const fileSha  = fileData.sha;
  const decoded  = JSON.parse(b64Decode(fileData.content));

  if (decoded[slug]) return json({ error: 'Ese slug ya esta en uso. Elige otro.' }, 409, req);

  decoded[slug] = { nombre, telefono, foto: foto || '', frase: frase || '' };

  const putRes = await fetch(GH_API + '/repos/' + REPO + '/contents/' + FILE, {
    method: 'PUT',
    headers: ghHeaders,
    body: JSON.stringify({
      message: 'registro: add asesor ' + slug,
      content: b64Encode(JSON.stringify(decoded, null, 2)),
      sha: fileSha,
      branch: BRANCH,
    }),
  });

  if (!putRes.ok) {
    const err = await putRes.json().catch(() => ({}));
    return json({ error: 'No se pudo guardar el asesor', detail: err }, 500, req);
  }

  return json({ ok: true, slug, url: 'https://www.innovaia.app/?ref=' + slug }, 200, req);
}
