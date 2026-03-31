// api/merge-refs.js — Migracion UNICA: suma stats de slugs viejos a nuevos
// BORRAR ESTE ARCHIVO despues de ejecutarlo una vez
export const config = { runtime: 'edge' };

const REPO   = process.env.GITHUB_REPO || 'DrCriptox/innova-ia-landing';
const BRANCH = 'main';
const FILE   = 'stats.json';

const MERGES = [
  ['nemecisinn26', 'nemecisinn96'],
  ['billonarios',  'bellyvane'],
  ['nayi2026',     'nayibe5k'],
];

export default async function handler(req) {
  const secret = new URL(req.url).searchParams.get('s');
  if (secret !== 'innova2026') {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  const TOKEN = process.env.GITHUB_TOKEN;
  if (!TOKEN) return new Response(JSON.stringify({ ok: false }), { status: 500, headers: { 'Content-Type': 'application/json' } });

  const ghHeaders = { Authorization: `token ${TOKEN}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json', 'User-Agent': 'InnovaIA-App' };
  const apiBase = `https://api.github.com/repos/${REPO}/contents/${FILE}`;

  let stats = {}, fileSha = null;
  const getRes = await fetch(`${apiBase}?ref=${BRANCH}`, { headers: ghHeaders });
  if (getRes.ok) {
    const data = await getRes.json();
    fileSha = data.sha;
    if (data.encoding === 'base64' && data.content) {
      const bin = atob(data.content.replace(/\\n/g, ''));
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      try { stats = JSON.parse(new TextDecoder().decode(bytes)); } catch {}
    }
  }

  const log = [];
  for (const [oldRef, newRef] of MERGES) {
    const oldData = stats[oldRef];
    if (!oldData) { log.push(oldRef + ': sin datos'); continue; }
    const oldObj = (typeof oldData === 'object') ? oldData : { total: oldData, ips: {}, days: {} };
    const newObj = (typeof stats[newRef] === 'object') ? { ...stats[newRef] } : { total: stats[newRef] || 0, ips: {}, days: {} };
    newObj.total = (newObj.total || 0) + (oldObj.total || 0);
    if (!newObj.ips) newObj.ips = {};
    for (const [ip, cnt] of Object.entries(oldObj.ips || {})) newObj.ips[ip] = (newObj.ips[ip] || 0) + cnt;
    if (!newObj.days) newObj.days = {};
    for (const [day, cnt] of Object.entries(oldObj.days || {})) newObj.days[day] = (newObj.days[day] || 0) + cnt;
    newObj.suspicious = Object.values(newObj.ips).filter(c => c >= 2).length;
    stats[newRef] = newObj;
    delete stats[oldRef];
    log.push(oldRef + '(' + (oldObj.total||0) + ') fusionado con ' + newRef + '(' + newObj.total + ')');
  }

  const jsonStr = JSON.stringify(stats, null, 2);
  const enc = new TextEncoder();
  const bytes = enc.encode(jsonStr);
  let b64 = '';
  for (let i = 0; i < bytes.length; i++) b64 += String.fromCharCode(bytes[i]);
  const newContent = btoa(b64);
  const putBody = { message: 'fix: merge stats slugs viejos a nuevos', content: newContent, branch: BRANCH };
  if (fileSha) putBody.sha = fileSha;
  const putRes = await fetch(apiBase, { method: 'PUT', headers: ghHeaders, body: JSON.stringify(putBody) });
  return new Response(JSON.stringify({ ok: putRes.ok, log }), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
}
