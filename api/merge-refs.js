// api/merge-refs.js — TEMPORAL: borrar despues de ejecutar
export const config = { runtime: 'edge' };
const REPO='DrCriptox/innova-ia-landing',BRANCH='main',FILE='stats.json';
const MERGES=[['yane27','yanecxis27']];
export default async function handler(req){
  const s=new URL(req.url).searchParams.get('s');
  if(s!=='innova2026')return new Response(JSON.stringify({ok:false}),{status:401,headers:{'Content-Type':'application/json'}});
  const TOKEN=process.env.GITHUB_TOKEN;
  const gh={Authorization:`token ${TOKEN}`,Accept:'application/vnd.github.v3+json','Content-Type':'application/json','User-Agent':'InnovaIA-App'};
  const api=`https://api.github.com/repos/${REPO}/contents/${FILE}`;
  let stats={},sha=null;
  const g=await fetch(`${api}?ref=${BRANCH}`,{headers:gh});
  if(g.ok){const d=await g.json();sha=d.sha;if(d.content){const b=atob(d.content.replace(/\\n/g,''));const by=new Uint8Array(b.length);for(let i=0;i<b.length;i++)by[i]=b.charCodeAt(i);try{stats=JSON.parse(new TextDecoder().decode(by));}catch{}}}
  const log=[];
  for(const[o,n]of MERGES){const od=stats[o];if(!od){log.push(o+':sin datos');continue;}
    const oo=typeof od==='object'?od:{total:od,ips:{},days:{}};
    const no=typeof stats[n]==='object'?{...stats[n]}:{total:stats[n]||0,ips:{},days:{}};
    no.total=(no.total||0)+(oo.total||0);
    if(!no.ips)no.ips={};
    for(const[ip,c]of Object.entries(oo.ips||{}))no.ips[ip]=(no.ips[ip]||0)+c;
    if(!no.days)no.days={};
    for(const[day,c]of Object.entries(oo.days||{}))no.days[day]=(no.days[day]||0)+c;
    no.suspicious=Object.values(no.ips).filter(c=>c>=2).length;
    if(oo.conversions)no.conversions=(no.conversions||0)+(oo.conversions||0);
    stats[n]=no;delete stats[o];
    log.push(o+'('+oo.total+')->'+n+'('+(no.total)+')');
  }
  const j=JSON.stringify(stats,null,2);const e=new TextEncoder();const by=e.encode(j);let b64='';
  for(let i=0;i<by.length;i++)b64+=String.fromCharCode(by[i]);
  const pb={message:'fix: merge yane27 -> yanecxis27',content:btoa(b64),branch:BRANCH};
  if(sha)pb.sha=sha;
  const p=await fetch(api,{method:'PUT',headers:gh,body:JSON.stringify(pb)});
  return new Response(JSON.stringify({ok:p.ok,log}),{status:200,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}});
}
