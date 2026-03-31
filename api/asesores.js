export const config = { runtime: 'edge' };

const REPO = process.env.GITHUB_REPO || 'DrCriptox/innova-ia-landing';
const FILE = 'asesores.json';

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors() });
  }

  const token = process.env.GITHUB_TOKEN;
  const headers = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'InnovaIA-App',
    ...(token ? { Authorization: `token ${token}` } : {}),
  };

  try {
    // Step 1: Contents API — works for files < 1MB, returns sha for all
    const contentsUrl = `https://api.github.com/repos/${REPO}/contents/${FILE}`;
    const contentsRes = await fetch(contentsUrl, { headers });
    if (!contentsRes.ok) throw new Error(`contents ${contentsRes.status}`);
    const contentsData = await contentsRes.json();

    let jsonText;

    if (contentsData.encoding === 'base64' && contentsData.content) {
      // Small file — decode inline base64
      const b64 = contentsData.content.replace(/\n/g, '');
      jsonText = new TextDecoder().decode(
        Uint8Array.from(atob(b64), c => c.charCodeAt(0))
      );
    } else {
      // Large file (encoding:"none") — use Git Blobs API (no 1MB limit, always fresh)
      const blobUrl = `https://api.github.com/repos/${REPO}/git/blobs/${contentsData.sha}`;
      const blobRes = await fetch(blobUrl, { headers });
      if (!blobRes.ok) throw new Error(`blob ${blobRes.status}`);
      const blobData = await blobRes.json();
      const b64 = blobData.content.replace(/\n/g, '');
      jsonText = new TextDecoder().decode(
        Uint8Array.from(atob(b64), c => c.charCodeAt(0))
      );
    }

    return new Response(jsonText, {
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
