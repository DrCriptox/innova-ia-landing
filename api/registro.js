// api/registro.js — Vercel Edge Function
// Registra un nuevo asesor en asesores.json via GitHub API
//
// Env vars necesarias en Vercel:
//   GITHUB_TOKEN  = Personal Access Token con permiso "repo" (Contents: write)
//                   Crear en: github.com/settings/tokens/new
//                   Scopes: repo (o solo "Contents: Read and Write" en fine-grained)
//   GITHUB_REPO   = DrCriptox/innova-ia-landing  (ya configurado abajo como default)

export const config = { runtime: 'edge' };

const GITHUB_REPO   = process.env.GITHUB_REPO   || 'DrCriptox/innova-ia-landing';
const GITHUB_BRANCH = 'main';
const FILE_PATH     = 'asesores.json';
const ALLOWED_ORIGIN = 'https://www.innovaia.app';

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, req);
  }

  const TOKEN = process.env.GITHUB_TOKEN;
  if (!TOKEN) {
    return json({ error: 'Registro no configurado. Contacta al administrador.' }, 500, req);
  }

  let body;
  try { body = await req.json(); } catch {
    return json({ error: 'JSON inválido' }, 400, req);
  }

  const { nombre, rol, whatsapp, ref, mensaje, foto } = body;

  // Validaciones
  if (!nombre || nombre.length < 2)   return json({ error: 'Nombre requerido' }, 400, req);
  if (!whatsapp || whatsapp.length < 7) return json({ error: 'WhatsApp requerido' }, 400, req);
  if (!ref || !/^[a-z0-9]{3,30}$/.test(ref)) return json({ error: 'Código de referido inválido (3-30 letras/números minúsculas)' }, 400, req);

  // Verificar que el ref no contenga palabras reservadas
  const RESERVED = ['default','admin','api','registro','socios','innova','sky','test'];
  if (RESERVED.includes(ref)) return json({ error: 'Ese código está reservado. Elige otro.' }, 400, req);

  // Foto: validar tamaño (base64 de 2MB ≈ 2.7MB string)
  const fotoClean = (foto && foto.startsWith('data:image/')) ? foto : '';
  if (fotoClean && fotoClean.length > 2_800_000) {
    return json({ error: 'La foto es demasiado grande. Máximo 2MB.' }, 400, req);
  }

  // ── Leer asesores.json desde GitHub ──────────────────
  const apiBase = `https://api.github.com/repos/${GITHUB_REPO}/contents/${FILE_PATH}`;
  const headers = {
    'Authorization': `token ${TOKEN}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
    'User-Agent': 'InnovaIA-App',
  };

  let currentData = {};
  let fileSha = null;

  try {
    const getRes = await fetch(`${apiBase}?ref=${GITHUB_BRANCH}`, { headers });
    if (getRes.ok) {
      const ghFile = await getRes.json();
      fileSha = ghFile.sha;
      const decoded = atob(ghFile.content.replace(/\n/g, ''));
      currentData = JSON.parse(decoded);
    }
  } catch (e) {
    // archivo no existe aún — empezamos fresco
  }

  // Verificar que el ref no esté ya tomado
  if (currentData[ref]) {
    return json({ error: 'Ese código de referido ya está en uso. Elige otro.' }, 409, req);
  }

  // Agregar nuevo asesor
  const nuevoAsesor = {
    nombre: nombre.trim(),
    rol: (rol || 'Asesor InnovaIA').trim(),
    whatsapp: whatsapp.trim(),
    foto: fotoClean,
    verificado: true,
    mensaje: (mensaje || `¡Hola! Soy ${nombre.trim()}, tu asesor InnovaIA 🚀`).trim(),
    pais: 'CO',
    registrado: new Date().toISOString(),
  };

  currentData[ref] = nuevoAsesor;

  // ── Escribir de vuelta a GitHub ───────────────────────
  const newContent = btoa(unescape(encodeURIComponent(JSON.stringify(currentData, null, 2))));

  const putBody = {
    message: `feat: nuevo asesor ${ref} — ${nombre.trim()}`,
    content: newContent,
    branch: GITHUB_BRANCH,
  };
  if (fileSha) putBody.sha = fileSha;

  const putRes = await fetch(apiBase, {
    method: 'PUT',
    headers,
    body: JSON.stringify(putBody),
  });

  if (!putRes.ok) {
    const err = await putRes.json().catch(() => ({}));
    console.error('GitHub PUT error:', err);
    return json({ error: 'Error al guardar tu perfil. Intenta de nuevo en 30 segundos.' }, 502, req);
  }

  return json({
    ok: true,
    ref,
    link: `https://www.innovaia.app/?ref=${ref}`,
    fotoUrl: fotoClean || '',
  }, 200, req);
}

function json(data, status, req) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(req) },
  });
}

function corsHeaders(req) {
  const origin = req ? (req.headers.get('origin') || '') : '';
  const allowed = (origin === ALLOWED_ORIGIN || origin === 'https://innovaia.app') ? origin : ALLOWED_ORIGIN;
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
