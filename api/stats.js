// api/stats.js — Vercel Edge Function
// Sirve stats.json (visitas por ref) desde GitHub
export const config = { runtime: 'edge' };

const REPO = process.env.GITHUB_REPO || 'DrCriptox/innova-ia-landing';
const FILE = 'stats.json';

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors() });

  const token = process.env.GITHUB_TOKEN;
  const headers = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'InnovaIA-App',
    ...(token ? { Authorization: `token ${token}` } : {}),
  };

  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE}`, { headers });
    if (!res.ok) return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json', ...cors() } });
    const data = await res.json();
    let text = '{}';
    if (data.encoding === 'base64' && data.content) {
      text = atob(data.content.replace(/\n/g, ''));
    }
    return new Response(text, {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors() }
    });
  } catch (e) {
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json', ...cors() } });
  }
}

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
