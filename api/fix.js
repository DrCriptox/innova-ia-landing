export const config = { runtime: 'edge' };
const REPO = 'DrCriptox/innova-ia-landing';
const BRANCH = 'main';
const FILE = 'asesores.json';
const GH_API = 'https://api.github.com';
const ADMIN_KEY = 'fix2026innova';
function dl1(s){if(!s)return s;const b=new Uint8Array(s.length);for(let i=0;i<s.length;i++)b[i]=s.charCodeAt(i)&0xFF;return new TextDecoder('utf-8',{fatal:false}).decode(b);}
function isMoj(s){return /[\xC0-\xC5][\x80-\xBF]/.test(s);}
function fixF(s,t){if(!s||!isMoj(s))return s;const a=dl1(s);if(!isMoj(a))return a;const b=dl1(a);if(!isMoj(b))return b;return t==='frase'?'':b;}
function b64e(str){const bytes=new TextEncoder().encode(str);let bin='';for(const b of bytes)bin+=String.fromCharCode(b);return btoa(bin);}
export default async function handler(req){
  const url=new URL(req.url);
  if(url.searchParams.get('key')!==ADMIN_KEY)return new Response(JSON.stringify({error:'unauth'}),{status:401,headers:{'Content-Type':'application/json'}});
  const token=process.env.GITHUB_TOKEN;
  if(!token)return new Response(JSON.stringify({error:'no token'}),{status:500,headers:{'Content-Type':'application/json'}});
  const gh={'Authorization':'token '+token,'Accept':'application/vnd.github.v3+json','Content-Type':'application/json','User-Agent':'innova-fix'};
  const r=await fetch(GH_API+'/repos/'+REPO+'/contents/'+FILE+'?ref='+BRANCH,{headers:gh});
  const meta=await r.json();
  let text;
  if(meta.encoding==='none'||!meta.content){const raw=await fetch('https://raw.githubusercontent.com/'+REPO+'/'+BRANCH+'/'+FILE);text=await raw.text();}
  else{const bin=atob(meta.content.replace(/\n/g,''));const bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);text=new TextDecoder().decode(bytes);}
  const data=JSON.parse(text);
  let fixCount=0;
  for(const[slug,a]of Object.entries(data)){
    const fn=fixF(a.nombre||'','nombre');const ff=fixF(a.frase||a.mensaje||'','frase');const fr=fixF(a.rol||'','rol');
    if(fn!==a.nombre){data[slug].nombre=fn;fixCount++;}
    if(ff!==(a.frase||a.mensaje||'')){data[slug].frase=ff;fixCount++;}
    if(fr!==a.rol&&a.rol){data[slug].rol=fr;fixCount++;}
    if(a.mensaje!==undefined){data[slug].frase=ff;delete data[slug].mensaje;}
  }
  const putRes=await fetch(GH_API+'/repos/'+REPO+'/contents/'+FILE,{method:'PUT',headers:gh,body:JSON.stringify({message:'fix: reparar encoding UTF-8 en asesores.json',content:b64e(JSON.stringify(data,null,2)),sha:meta.sha,branch:BRANCH})});
  if(!putRes.ok){const e=await putRes.json().catch(()=>({}));return new Response(JSON.stringify({error:'write failed',d:e.message}),{status:500,headers:{'Content-Type':'application/json'}});}
  return new Response(JSON.stringify({ok:true,fixCount,total:Object.keys(data).length}),{status:200,headers:{'Content-Type':'application/json'}});
}
