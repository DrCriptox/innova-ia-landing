// api/add-asesor.js — Vercel Edge Function
// Agrega un nuevo asesor a asesores.json (admin only)
export const config = { runtime: 'edge' };

const REPO   = process.env.GITHUB_REPO || 'DrCriptox/innova-ia-landing';
const BRANCH = 'main';
const FILE   = 'asesores.json';
const SECRET = process.env.ADMIN_SECRET || 'Genesis22';

function toBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = ''; bytes.forEach(b => bin += String.fromCharCode(b));
  return btoa(bin);
}
function fromBase64(b64) {
  const bin = atob(b64.replace(/\n/g, ''));
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors() });
  if (req.method !== 'POST') return json({ ok: false, error: 'method' }, 405);

  let slug, nombre, rol, telefono, frase, foto, secret;
  try {
    const b = await req.json();
    slug = b.slug; nombre = b.nombre; rol = b.rol;
    telefono = b.telefono; frase = b.frase; foto = b.foto;
    secret = b.secret;
  } catch {}

  if (secret !== SECRET) return json({ ok: false, error: 'unauthorized' }, 401);
  if (!slug || !/^[a-z0-9]{2,50}$/.test(slug)) return json({ ok: false, error: 'invalid slug' }, 400);
  if (!telefono) return json({ ok: false, error: 'telefono required' }, 400);

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

      let asesores = {};
      if (data.encoding === 'base64' && data.content) {
        try { asesores = JSON.parse(fromBase64(data.content)); } catch {}
      } else if (data.download_url) {
        const rawRes = await fetch(data.download_url);
        if (rawRes.ok) try { asesores = await rawRes.json(); } catch {}
      }

      if (asesores[slug]) return json({ ok: false, error: 'slug already exists' }, 409);

      asesores[slug] = {
        nombre:    nombre || '',
        rol:       rol || 'Asesor InnovaIA',
        telefono:  telefono,
        whatsapp:  telefono,
        frase:     frase || '',
        foto:      foto || '',
        registrado: new Date().toISOString(),
      };

      const putBody = {
        message: `admin: agregar asesor ${slug}`,
        content: toBase64(JSON.stringify(asesores, null, 2)),
        branch: BRANCH,
        sha: fileSha,
      };
      const putRes = await fetch(apiBase, { method: 'PUT', headers: ghHeaders, body: JSON.stringify(putBody) });
      if (putRes.ok) return json({ ok: true, slug });
      if (putRes.status === 409 || putRes.status === 422) continue;
      break;
    } catch (e) { if (attempt === 2) break; }
  }
  return json({ ok: false, error: 'write failed' }, 500);
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors() },
  });
}
function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
