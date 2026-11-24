const BASE='https://werewolf-favourite-tournament-default-rtdb.firebaseio.com';
const get=async p=>(await fetch(`${BASE}/${p}.json`)).json();
const names=new Set();
for(const s of ['s1','s2','s3','s4']){const pl=await get(`playerProfiles/${s}/players`);for(const p of Object.values(pl||{}))[p.name,p.displayName].forEach(x=>x&&String(x).trim().length>1&&names.add(String(x).trim()));}
const mask=t=>{let o=t;for(const n of [...names].sort((a,b)=>b.length-a.length))o=o.split(n).join('某');return o;};
const all=new Map();
for(const p of ['tournament/s4/recaps','tournament/recaps','archive/s3/recaps']){const d=await get(p);for(const r of Object.values(d||{}))if(r&&r.body){const k=r.title+'|'+(r.date||'')+'|'+(r.game||'');if(!all.has(k))all.set(k,r);}}
const rs=[...all.values()];console.log('n',rs.length);
for(const r of [rs[0],rs[Math.floor(rs.length/2)],rs[rs.length-1]])console.log('-----\n'+mask(r.body).slice(0,1800));
