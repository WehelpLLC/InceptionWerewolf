// 一次性：查看后台是否对版型库做过手动覆盖（只打印板子名称和被覆盖的字段名）
const BASE = 'https://werewolf-favourite-tournament-default-rtdb.firebaseio.com';
const d = await (await fetch(`${BASE}/tournament/boardRules.json`)).json();
const arr = Object.values(d || {});
console.log('boardRules 覆盖条数', arr.length);
for (const o of arr) console.log(' -', o.name, '| status', o.status, '| 字段:', Object.keys(o).filter(k => !['name', 'status'].includes(k) && o[k] && (!Array.isArray(o[k]) || o[k].length) && (typeof o[k] !== 'object' || Array.isArray(o[k]) || Object.keys(o[k]).length)).join(','), '| skills:', Object.keys(o.skills || {}).join(','));
const t = await (await fetch(`${BASE}/tournament/boardTemplates.json`)).json();
console.log('boardTemplates 条数', Object.keys(t || {}).length, Object.values(t || {}).map(x => x && x.name).filter(Boolean).join(','));
