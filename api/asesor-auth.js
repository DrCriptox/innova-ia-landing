// api/asesor-auth.js — Verifica credenciales de asesor
// Contrasena: campo password si existe, sino el numero de telefono registrado
export const config = { runtime: 'edge' };
const REPO   = process.env.GITHUB_REPO || 'DrCriptox/innova-ia-landing';
const BRANCH = 'main';

export default async function handler(req) {
  if (req.method === 'OPTIONS') return resp(null, 204);
  if (req.method !== 'POST') return resp({ ok: false, error: 'method not allowed' }, 405);

  let slug, password;
  try { const b = await req.json(); slug = (b.slug||'').trim().toLowerCase(); password = (b.password||'').trim(); } catch {}

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
      asesores = await (await fetch(meta.download_url)).json();
    }
  } catch { return resp({ ok: false, error: 'Error del servidor' }); }

  const asesor = asesores[slug];
  if (!asesor) return resp({ ok: false, error: 'Usuario no encontrado' });

  // Contrasena valida: campo password (si existe) O el numero de telefono registrado
  const telefono = (asesor.telefono || asesor.whatsapp || '').replace(/\D/g, '');
  const pwIngresado = password.replace(/^\+/, '').replace(/\D/g, '');

  const tienePassword = asesor.password && asesor.password.trim().length > 0;

  let acceso = false;
  if (tienePassword) {
    // Tiene password creado: comparar directo
    acceso = asesor.password === password;
  } else {
    // Sin password: usar telefono como fallback (comparar solo digitos)
    acceso = telefono.length > 0 && pwIngresado === telefono;
  }

  if (!acceso) {
    const hint = tienePassword
      ? 'Contrasena incorrecta'
      : 'Contrasena incorrecta. Usa tu numero de telefono registrado (con codigo de pais, ej: 573001234567)';
    return resp({ ok: false, error: hint });
  }

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
