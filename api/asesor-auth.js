// api/asesor-auth.js — Verifica credenciales de asesor
export const config = { runtime: 'edge' };
const REPO   = process.env.GITHUB_REPO || 'DrCriptox/innova-ia-landing';
const BRANCH = 'main';

export default async function handler(req) {
  if (req.method === 'OPTIONS') return resp(null, 204);
  if (req.method !== 'POST') return resp({ ok: false, error: 'method not allowed' }, 405);

  let slug, password;
  try { const b = await req.json(); slug = (b.slug||'').trim().toLowerCase(); password = b.password||''; } catch {}

  if (!slug || !password)
    return resp({ ok: false, error: 'Faltan campos' });

  const TOKEN = process.env.GITHUB_TOKEN;
  if (!TOKEN) return resp({ ok: false, error: 'server error' });

  const ghH = { Authorization: 'token '+TOKEN, Accept: 'application/vnd.github.v3+json', 'User-Agent': 'InnovaIA-App' };

  let asesores = {};
  try {
    const r = await fetch('https://api.github.com/repos/'+REPO+'/contents/asesores.json?ref='+BRANCH, { headers: ghH });
    const meta = await r.json();
    if (meta.encoding === 'base64' && meta.content) {
      asesores = JSON.parse(atob(meta.content.replace(/\n/g,'')));
    } else if (meta.download_url) {
      const raw = await fetch(meta.download_url);
      asesores = await raw.json();
    }
  } catch { return resp({ ok: false, error: 'Error del servidor' }); }

  const asesor = asesores[slug];
  if (!asesor)         return resp({ ok: false, error: 'Usuario no encontrado' });
  if (!asesor.password) return resp({ ok: false, error: 'Este usuario no tiene contraseña configurada. Contacta al administrador.' });
  if (asesor.password !== password) return resp({ ok: false, error: 'Contraseña incorrecta' });

  // Devolver perfil sin la contraseña
  const safe = Object.assign({}, asesor);
  delete safe.password;
  return resp({ ok: true, slug, asesor: safe });
}

function resp(data, status) {
  return new Response(data ? JSON.stringify(data) : null, {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' },
  });
}
