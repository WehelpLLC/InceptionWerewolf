const BASE='https://werewolf-favourite-tournament-default-rtdb.firebaseio.com';
const get=async p=>(await fetch(`${BASE}/${p}.json`)).json();
const all=new Map();
for(const [p,s] of [['tournament/s4/recaps','S4'],['tournament/recaps','S3'],['archive/s3/recaps','S3']]){const d=await get(p);for(const r of Object.values(d||{}))if(r&&r.body){const k=r.title+'|'+(r.date||'')+'|'+(r.game||'');if(!all.has(k))all.set(k,{...r,S:/^S4/.test(r.title)?'S4':s});}}
const C={};const inc=(S,k,n=1)=>{for(const x of [S,'合计']){C[x]??={};C[x][k]=(C[x][k]||0)+n;}};
const RL=['预言家','通灵师','女巫','猎人','狼王','白狼王','守卫','白痴','守墓人'];
for(const r of all.values()){
 const S=r.S,b=r.body;inc(S,'复盘数');
 const head=b.split('🌙')[0];const seat={};
 for(const m of head.matchAll(/(预言家|通灵师|女巫|猎人|白狼王|狼王|守卫|白痴)\s*(\d+)/g))(seat[m[1]]??=[]).push(+m[2]);
 const has=k=>seat[k]||[];const seers=[...has('预言家'),...has('通灵师')];
 if(has('女巫').length)inc(S,'有女巫');if(has('猎人').length)inc(S,'有猎人');if(has('狼王').length||has('白狼王').length)inc(S,'有狼王');if(seers.length)inc(S,'有预言家或通灵师');
 const blocks=b.split(/(?=🌙|☀️)/).slice(1).map(t=>({night:t.startsWith('🌙'),i:'一二三四五六七'.indexOf((t.match(/第(.)(?:晚|天)/)||[])[1]),t}));
 const n1=blocks.find(x=>x.night&&x.i===0),d1=blocks.find(x=>!x.night&&x.i===0);
 if(n1){const k=[...n1.t.matchAll(/击杀(?:号码)?\s*(\d+)\s*号/g)].map(m=>+m[1]);
  if(k.length&&has('女巫').length){inc(S,'首夜有刀口且知女巫');if(k.some(x=>has('女巫').includes(x)))inc(S,'女巫首夜被刀');}
  if(/平安夜/.test(n1.t)||/女巫救/.test(n1.t))inc(S,'首夜女巫救人/平安夜');}
 const poison=blocks.filter(x=>x.night).flatMap(x=>[...x.t.matchAll(/毒\s*(\d+)\s*号/g)].map(m=>+m[1]));
 if(poison.length)inc(S,'用过毒的局');
 if(has('猎人').length&&poison.some(x=>has('猎人').includes(x)))inc(S,'猎人被毒');
 if(d1&&seers.length){const ex=[...d1.t.matchAll(/(?:放逐(?:投票)?|公投|票出|抗推)[^\d\n]{0,6}(\d+)\s*号/g)].map(m=>+m[1]);
  const ex2=[...d1.t.matchAll(/(\d+)\s*号[^\n，。,]{0,8}(?:被放逐|被公投|被抗推|被票出|出局)/g)].map(m=>+m[1]);
  if([...ex,...ex2].some(x=>seers.includes(x)))inc(S,'预言家/通灵师首日被放逐');}
 const hs=has('猎人');if(/猎人[^\n]{0,12}(开枪|带走|枪杀)|开枪[^\n]{0,8}猎人/.test(b))inc(S,'文字提到猎人开枪');
 if(/狼王[^\n]{0,12}(开枪|带走|枪杀)|开枪[^\n]{0,8}狼王/.test(b))inc(S,'文字提到狼王开枪');
 if(/自爆/.test(b))inc(S,'有自爆的局');
 if(/悍跳/.test(b))inc(S,'提到悍跳的局');
 if(/平安夜/.test(b))inc(S,'出现平安夜的局');
 if(/空刀|空过刀/.test(b))inc(S,'提到空刀');
 if(/绑票/.test(b))inc(S,'绑票获胜');
 if(/好人阵营获胜|好人获胜/.test(b))inc(S,'好人获胜');
 if(/狼人阵营[^\n]{0,6}获胜|狼人获胜/.test(b))inc(S,'狼人获胜');
}
console.log(JSON.stringify(C,null,1));
