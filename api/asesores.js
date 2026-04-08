export const config = { runtime: 'edge' };

const REPO = process.env.GITHUB_REPO || 'DrCriptox/innova-ia-landing';
const FILE = 'asesores.json';

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors() });
  }

  const token = process.env.GITHUB_TOKEN;

  try {
    // Use raw content URL — much faster than Contents API (no base64 encoding overhead)
    const rawUrl = `https://raw.githubusercontent.com/${REPO}/main/${FILE}`;
    const headers = {
      'User-Agent': 'InnovaIA-App',
      'Cache-Control': 'no-cache',
      ...(token ? { Authorization: `token ${token}` } : {}),
    };

    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(rawUrl, { headers, signal: ctrl.signal });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`raw ${res.status}`);

    const data = await res.json();

    // Strip base64 photos from response — landing page uses fotos/ paths, not base64
    Object.keys(data).forEach(function(key) {
      if (data[key] && data[key].foto && data[key].foto.startsWith('data:')) {
        data[key].foto = '';
      }
    });

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=15, stale-while-revalidate=30',
        ...cors(),
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...cors() },
    });
  }
}

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
