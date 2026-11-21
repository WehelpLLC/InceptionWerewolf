// 一次性：从复盘文本里统计名场面（只打印汇总数字和脱敏样例，不打印玩家名字）
const BASE = 'https://werewolf-favourite-tournament-default-rtdb.firebaseio.com';
const get = async p => (await fetch(`${BASE}/${p}.json`)).json();
const all = {};
for (const p of ['tournament/recaps', 'archive/s3/recaps']) { const d = await get(p); console.log(p, '条数', d ? Object.keys(d).length : 0); for (const r of Object.values(d || {})) { if (r && r.body) all[(r.date || '') + '|' + (r.game || r.title) + '|' + (r.track || '') + '|' + r.title] = r; } }
const recaps = Object.values(all);
console.log('去重后复盘', recaps.length, '含身份信息', recaps.filter(r => /身份信息/.test(r.body)).length, '含第一晚', recaps.filter(r => /第一晚/.test(r.body)).length);
const F = ['狼人击杀', '击杀号码', '女巫救', '女巫毒', '预言家查验', '通灵师查验', '守卫目标', '警长', '死亡情况', '猎人枪口', '猎人开枪目标', '狼王枪口', '自爆情况', '放逐投票'];
const none = s => !s || /空过|null|无|没|平安|流失/.test(s) && !/\d/.test(s);
const nums = s => (s.match(/\d+/g) || []).map(Number);
function parseLine(line) {
  const idx = []; for (const f of F) { let p = -1; while ((p = line.indexOf(f, p + 1)) >= 0) idx.push([p, f]); }
  idx.sort((a, b) => a[0] - b[0]); const out = {};
  idx.forEach(([p, f], i) => { const end = i + 1 < idx.length ? idx[i + 1][0] : line.length; const seg = line.slice(p + f.length, end); (out[f] ??= []).push(seg); });
  return out;
}
const C = { n: 0, 女巫首夜被刀: 0, 预言家通灵师首日被放逐: 0, 猎人被毒: 0, 猎人开枪: 0, 狼王开枪: 0, 有女巫局: 0, 有猎人局: 0, 有狼王局: 0, 有预言家或通灵师局: 0, 有首夜刀口: 0, 有首日放逐: 0 };
const WH = new Set();
for (const r of recaps) {
  const b = r.body; const head = b.split('🌙')[0];
  const seats = role => { const m = head.match(new RegExp(role + '\\s*(\\d+(?:\\/\\d+)*)')); return m ? m[1].split('/').map(Number) : []; };
  const witch = seats('女巫'), hunter = seats('猎人'), wk = seats('狼王'), seer = [...seats('预言家'), ...seats('通灵师')];
  const lines = b.split('\n'); const nights = {}, days = {};
  for (const ln of lines) { const m = ln.match(/第(一|二|三|四|五|六)(晚|天)/); if (!m) continue; const k = '一二三四五六'.indexOf(m[1]); (m[2] === '晚' ? nights : days)[k] = parseLine(ln); }
  C.n++;
  if (witch.length) C.有女巫局++; if (hunter.length) C.有猎人局++; if (wk.length) C.有狼王局++; if (seer.length) C.有预言家或通灵师局++;
  const n0 = nights[0] || {}; const kill = (n0['狼人击杀'] || n0['击杀号码'] || []).flatMap(nums);
  if (kill.length) { C.有首夜刀口++; if (kill.some(s => witch.includes(s))) C.女巫首夜被刀++; }
  const ex = ((days[0] || {})['放逐投票'] || []).flatMap(nums);
  if (ex.length) { C.有首日放逐++; if (ex.some(s => seer.includes(s))) C.预言家通灵师首日被放逐++; }
  const poison = Object.values(nights).flatMap(n => n['女巫毒'] || []).flatMap(nums);
  if (poison.some(s => hunter.includes(s))) C.猎人被毒++;
  const shot = [...Object.values(days), ...Object.values(nights)].flatMap(n => [...(n['猎人枪口'] || []), ...(n['猎人开枪目标'] || [])]).flatMap(nums);
  if (shot.length) C.猎人开枪++;
  const wks = [...Object.values(days), ...Object.values(nights)].flatMap(n => n['狼王枪口'] || []).flatMap(nums);
  if (wks.length) C.狼王开枪++;
}
console.log(JSON.stringify(C));
// 脱敏样例：只保留关键词、数字和标点
const KW = [...F, '身份信息', '狼人阵营', '好人阵营', '狼人', '女巫', '猎人', '预言家', '通灵师', '守卫', '狼王', '平民', '第一晚', '第二晚', '第一天', '第二天', '获胜', '阵营'];
const mask = s => { let t = s; KW.sort((a, b) => b.length - a.length).forEach((w, i) => { t = t.split(w).join(`\u0001${i}\u0002`); }); t = t.replace(/[A-Za-z一-龥]+/g, '□'); return t.replace(/\u0001(\d+)\u0002/g, (_, i) => KW[+i]); };
const samp = recaps.filter(r => /第一晚/.test(r.body)).slice(0, 2);
samp.forEach((r, i) => console.log('--样例' + (i + 1) + '--\n' + mask(r.body).slice(0, 700)));
