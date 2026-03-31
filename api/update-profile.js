// api/update-profile.js — Actualiza perfil del asesor (nombre, telefono, frase, foto)
export const config = { runtime: 'edge' };
const REPO   = process.env.GITHUB_REPO || 'DrCriptox/innova-ia-landing';
const BRANCH = 'main';
const GH     = 'https://api.github.com/repos/'+REPO+'/contents/';

export default async function handler(req) {
  if (req.method === 'OPTIONS') return resp(null, 204);
  if (req.method !== 'POST') return resp({ ok: false, error: 'method not allowed' }, 405);

  let slug, password, nombre, telefono, frase, foto_base64, foto_ext, new_password;
  try {
    const b = await req.json();
    slug         = (b.slug||'').trim().toLowerCase();
    password     = b.password||'';
    nombre       = b.nombre;
    telefono     = b.telefono;
    frase        = b.frase;
    foto_base64  = b.foto_base64;
    foto_ext     = (b.foto_ext||'jpg').replace('.','').toLowerCase();
    new_password = b.new_password;
  } catch { return resp({ ok: false, error: 'JSON invalido' }); }

  if (!slug || !password) return resp({ ok: false, error: 'Faltan credenciales' });

  const TOKEN = process.env.GITHUB_TOKEN;
  if (!TOKEN) return resp({ ok: false, error: 'server error' });
  const ghH = { Authorization: 'token '+TOKEN, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json', 'User-Agent': 'InnovaIA-App' };

  // ── Leer asesores.json ──
  let asesores = {}, fileSha;
  try {
    const r    = await fetch(GH+'asesores.json?ref='+BRANCH, { headers: ghH });
    const meta = await r.json();
    fileSha    = meta.sha;
    if (meta.encoding === 'base64' && meta.content) {
      asesores = JSON.parse(atob(meta.content.replace(/\n/g,'')));
    } else if (meta.download_url) {
      asesores = await (await fetch(meta.download_url)).json();
    }
  } catch { return resp({ ok: false, error: 'Error del servidor' }); }

  const asesor = asesores[slug];
  if (!asesor)                       return resp({ ok: false, error: 'Usuario no encontrado' });
  if (asesor.password !== password)  return resp({ ok: false, error: 'Contraseña incorrecta' });

  // ── Subir foto si viene en base64 ──
  if (foto_base64) {
    const path     = 'fotos/'+slug+'.'+foto_ext;
    const b64clean = foto_base64.includes(',') ? foto_base64.split(',')[1] : foto_base64;
    let existSha;
    try { const c = await (await fetch(GH+path+'?ref='+BRANCH, { headers: ghH })).json(); existSha = c.sha; } catch {}
    const photoBody = { message: 'foto: '+slug, content: b64clean, branch: BRANCH };
    if (existSha) photoBody.sha = existSha;
    await fetch(GH+path, { method: 'PUT', headers: ghH, body: JSON.stringify(photoBody) });
    asesores[slug].foto = path;
  }

  // ── Actualizar campos ──
  if (nombre       && nombre.trim())      asesores[slug].nombre   = nombre.trim();
  if (telefono     && telefono.trim())  { asesores[slug].telefono = telefono.trim(); asesores[slug].whatsapp = telefono.trim(); }
  if (frase        && frase.trim())       asesores[slug].frase    = frase.trim();
  if (new_password && new_password.trim().length >= 6) asesores[slug].password = new_password.trim();

  // ── Guardar asesores.json ──
  function b64e(s) { const b=new TextEncoder().encode(s);let r='';for(const x of b)r+=String.fromCharCode(x);return btoa(r); }
  const put = await fetch(GH+'asesores.json', {
    method: 'PUT', headers: ghH,
    body: JSON.stringify({ message: 'perfil: actualizar '+slug, content: b64e(JSON.stringify(asesores,null,2)), branch: BRANCH, sha: fileSha }),
  });
  if (!put.ok) return resp({ ok: false, error: 'Error al guardar' });

  const safe = Object.assign({}, asesores[slug]);
  delete safe.password;
  return resp({ ok: true, slug, asesor: safe });
}

function resp(data, status) {
  return new Response(data ? JSON.stringify(data) : null, {
    status: status||200,
    headers: { 'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type' },
  });
}
