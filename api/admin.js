// api/admin.js — Admin endpoint para gestionar asesores
// DELETE /api/admin?slug=X con header X-Admin-Secret para eliminar entradas
// Solo para uso interno — requiere SKYTEAM_SECRET

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

export default async function handler(req) {
  const secret = process.env.SKYTEAM_SECRET;
  const provided = req.headers.get('x-admin-secret');
  if (!secret || provided !== secret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  const url = new URL(req.url);
  const slug = url.searchParams.get('slug');
  if (!slug) return new Response(JSON.stringify({ error: 'slug required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

  const TOKEN = process.env.GITHUB_TOKEN;
  if (!TOKEN) return new Response(JSON.stringify({ error: 'No token' }), { status: 500, headers: { 'Content-Type': 'application/json' } });

  const ghHeaders = { 'Authorization': 'token ' + TOKEN, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json', 'User-Agent': 'InnovaIA-App' };

  const { sha, data } = await readAsesores(ghHeaders);
  
  if (req.method === 'DELETE') {
    if (!data[slug]) return new Response(JSON.stringify({ error: 'slug not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    delete data[slug];
    const newContent = b64Encode(JSON.stringify(data, null, 2));
    const putRes = await fetch('https://api.github.com/repos/' + GITHUB_REPO + '/contents/' + FILE_PATH, {
      method: 'PUT', headers: ghHeaders,
      body: JSON.stringify({ message: 'admin: delete asesor ' + slug, content: newContent, sha, branch: GITHUB_BRANCH })
    });
    const result = await putRes.json();
    return new Response(JSON.stringify({ ok: putRes.ok, slug, commit: result.commit?.sha }), { status: putRes.ok ? 200 : 500, headers: { 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({ ok: true, keys: Object.keys(data) }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
