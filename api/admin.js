// api/admin.js — Admin endpoint para gestionar asesores
// GET  /api/admin?slug=X  → lista keys (o entry si slug existe)
// DELETE /api/admin?slug=X  → elimina entry
// PUT  /api/admin?slug=X  body:{field,value} o {entry:{...}} → actualiza

export const config = { runtime: 'edge' };

const GITHUB_REPO   = process.env.GITHUB_REPO   || 'DrCriptox/innova-ia-landing';
const GITHUB_BRANCH = 'main';
const FILE_PATH     = 'asesores.json';

function b64Encode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
}

async function readAsesores(headers) {
  const r = await fetch('https://api.github.com/repos/' + GITHUB_REPO + '/contents/' + FILE_PATH + '?ref=' + GITHUB_BRANCH, { headers });
  const meta = await r.json();
  let text;
  if (meta.encoding === 'none' || !meta.content) {
    const raw = await fetch('https://raw.githubusercontent.com/' + GITHUB_REPO + '/' + GITHUB_BRANCH + '/' + FILE_PATH + '?_=' + Date.now());
    text = await raw.text();
  } else {
    const bin = atob(meta.content.replace(/\n/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    text = new TextDecoder().decode(bytes);
  }
  return { sha: meta.sha, data: JSON.parse(text) };
}

async function writeAsesores(data, sha, msg, headers) {
  const res = await fetch('https://api.github.com/repos/' + GITHUB_REPO + '/contents/' + FILE_PATH, {
    method: 'PUT', headers,
    body: JSON.stringify({ message: msg, content: b64Encode(JSON.stringify(data, null, 2)), sha, branch: GITHUB_BRANCH })
  });
  return res;
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,DELETE,PUT,OPTIONS', 'Access-Control-Allow-Headers': 'x-admin-secret,content-type' } });

  const secret = process.env.SKYTEAM_SECRET;
  const provided = req.headers.get('x-admin-secret');
  if (!secret || provided !== secret) return json({ error: 'Unauthorized' }, 401);

  const url = new URL(req.url);
  const slug = url.searchParams.get('slug');
  if (!slug) return json({ error: 'slug required' }, 400);

  const TOKEN = process.env.GITHUB_TOKEN;
  if (!TOKEN) return json({ error: 'No token' }, 500);

  const ghH = { 'Authorization': 'token ' + TOKEN, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json', 'User-Agent': 'InnovaIA-App' };

  const { sha, data } = await readAsesores(ghH);

  if (req.method === 'GET') {
    return json({ ok: true, keys: Object.keys(data), entry: data[slug] || null });
  }

  if (req.method === 'DELETE') {
    if (!data[slug]) return json({ error: 'slug not found' }, 404);
    delete data[slug];
    const res = await writeAsesores(data, sha, 'admin: delete ' + slug, ghH);
    const r = await res.json();
    return json({ ok: res.ok, slug, commit: r.commit?.sha }, res.ok ? 200 : 500);
  }

  if (req.method === 'PUT') {
    let body;
    try { body = await req.json(); } catch { return json({ error: 'JSON invalido' }, 400); }
    if (body.entry) {
      // Replace entire entry
      data[slug] = body.entry;
    } else if (body.field !== undefined && body.value !== undefined) {
      // Update single field
      if (!data[slug]) data[slug] = {};
      data[slug][body.field] = body.value;
    } else {
      return json({ error: 'Provide entry:{} or field+value' }, 400);
    }
    const res = await writeAsesores(data, sha, 'admin: update ' + slug, ghH);
    const r = await res.json();
    return json({ ok: res.ok, slug, commit: r.commit?.sha }, res.ok ? 200 : 500);
  }

  return json({ error: 'Method not allowed' }, 405);
}
