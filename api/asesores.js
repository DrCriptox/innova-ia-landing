// api/asesores.js — Vercel Edge Function
// Sirve asesores.json en tiempo real desde GitHub (sin caché stale de Vercel)
// Reemplaza el archivo estático: vercel.json lo redirige aquí

export const config = { runtime: 'edge' };

const GITHUB_REPO   = process.env.GITHUB_REPO || 'DrCriptox/innova-ia-landing';
const GITHUB_BRANCH = 'main';
const FILE_PATH     = 'asesores.json';

export default async function handler(req) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Cache-Control': 'public, max-age=30, stale-while-revalidate=60',
    'Content-Type': 'application/json',
  };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  try {
    const token = process.env.GITHUB_TOKEN;
    const hdrs = { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'InnovaIA-App' };
    if (token) hdrs['Authorization'] = 'token ' + token;

    const r = await fetch('https://api.github.com/repos/' + GITHUB_REPO + '/contents/' + FILE_PATH + '?ref=' + GITHUB_BRANCH, { headers: hdrs });
    let text;
    if (r.ok) {
      const meta = await r.json();
      if (meta.encoding === 'none' || !meta.content) {
        const raw = await fetch('https://raw.githubusercontent.com/' + GITHUB_REPO + '/' + GITHUB_BRANCH + '/' + FILE_PATH);
        text = await raw.text();
      } else {
        const bin = atob(meta.content.replace(/\n/g, ''));
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        text = new TextDecoder().decode(bytes);
      }
    } else {
      const raw = await fetch('https://raw.githubusercontent.com/' + GITHUB_REPO + '/' + GITHUB_BRANCH + '/' + FILE_PATH);
      text = await raw.text();
    }
    return new Response(text, { status: 200, headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Error cargando asesores' }), { status: 500, headers: cors });
  }
}
