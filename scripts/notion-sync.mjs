// 把网站（Firebase）里的本季玩家战绩和对局记录同步到 Notion。
// 由 GitHub Actions 定时运行；密钥只从环境变量读取，绝不写进网页代码。
//   NOTION_TOKEN          Notion 集成密钥（必填）
//   NOTION_PARENT_PAGE_ID 放数据库的 Notion 页面 ID（必填，需已把集成连接到该页面）
//   SEASON_PATH           默认 playerProfiles/s4
//   SEASON_LABEL          默认 S4
//   FIREBASE_URL / NOTION_API  仅测试用，可覆盖
import crypto from 'node:crypto';

// 失败时把原因显示在 GitHub 的运行提示里（不会输出密钥）
const fail = msg => { console.log(`::error title=Notion 同步失败::${String(msg).replace(/\r?\n/g, ' ').slice(0, 500)}`); console.error(msg); process.exit(1); };
process.on('uncaughtException', e => fail(e?.message || e));
process.on('unhandledRejection', e => fail(e?.message || e));

const TOKEN = process.env.NOTION_TOKEN;
// 页面 ID 永远是链接路径最后的 32 位十六进制（可带连字符）；标题里的字母（如 "S4-"）不能算进去
const PARENT = (() => { const last = (process.env.NOTION_PARENT_PAGE_ID || '').trim().split(/[?#]/)[0].replace(/\/+$/, '').split('/').pop();
  const m = last.match(/([0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12})$/i); return m ? m[1].replace(/-/g, '').toLowerCase() : null; })();
const FB = process.env.FIREBASE_URL || 'https://werewolf-favourite-tournament-default-rtdb.firebaseio.com';
const API = process.env.NOTION_API || 'https://api.notion.com';
const SEASON_PATH = process.env.SEASON_PATH || 'playerProfiles/s4';
const LABEL = process.env.SEASON_LABEL || 'S4';
if (!TOKEN) fail('GitHub 里没有读到 NOTION_TOKEN：请在仓库 Settings → Secrets and variables → Actions 添加名为 NOTION_TOKEN 的 secret');
if (!PARENT) fail('没有读到有效的 NOTION_PARENT_PAGE_ID：请添加这个 secret，值为放数据的 Notion 页面链接或 32 位页面 ID');

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function notion(method, path, body, tries = 5) {
  for (let i = 0; i < tries; i++) {
    const r = await fetch(API + path, { method, headers: { Authorization: `Bearer ${TOKEN}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    if (r.status === 429 || r.status >= 500) { await sleep((Number(r.headers.get('retry-after')) || 1 + i) * 1000); continue; }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`Notion ${method} ${path} -> ${r.status} ${j.code || ''} ${j.message || ''}`);
    await sleep(340); // 官方限速约 3 次/秒
    return j;
  }
  throw new Error(`Notion ${method} ${path} 多次重试仍失败`);
}
async function fbGet(p) { const r = await fetch(`${FB}/${p}.json`); if (!r.ok) throw new Error(`Firebase ${p} -> ${r.status}`); return r.json(); }

// ── 与网站 index.html 一致的口径 ──
const isWolf = role => /狼|石像鬼|恶灵|梦魇|血月|诡术|假面|盗宝|莉娅|莉莉丝/.test(role || '');
const winSide = m => { const w = (m.entries || []).filter(e => e.result === 'win'); if (!w.length) return null; return w.some(e => isWolf(e.role)) ? '狼人胜' : '好人胜'; };
const hash = o => crypto.createHash('sha1').update(JSON.stringify(o)).digest('hex').slice(0, 16);
const txt = s => [{ type: 'text', text: { content: String(s ?? '').slice(0, 1990) } }];

const [playersRaw, matchesRaw] = await Promise.all([fbGet(`${SEASON_PATH}/players`), fbGet(`${SEASON_PATH}/matches`)]);
if (!playersRaw || !matchesRaw) { fail('Firebase 返回为空，为安全起见本次不同步、不删除任何内容'); }
const players = Object.entries(playersRaw).map(([id, p]) => ({ ...p, id: p.id || id })).filter(p => p && p.name);
const allMatches = Object.values(matchesRaw).filter(Boolean);
const matches = allMatches.filter(m => !m.exhibition); // 表演赛不计入任何统计
const nameOf = id => players.find(p => String(p.id) === String(id))?.name || '?';

// ── 玩家战绩 ──
const playerRows = players.map(p => {
  const g = []; matches.forEach(m => { const e = (m.entries || []).find(x => String(x.playerId) === String(p.id)); if (e) g.push(e); });
  const wins = g.filter(e => e.result === 'win').length;
  const wolves = g.filter(e => isWolf(e.role)), goods = g.filter(e => !isWolf(e.role));
  const pct = (a, b) => b ? Math.round(a / b * 100) : null;
  return {
    key: String(p.id), title: p.name, emoji: p.emoji || '🎭',
    积分: +g.reduce((a, e) => a + Number(e.total || 0), 0).toFixed(1), 场次: g.length, 胜场: wins, 胜率: pct(wins, g.length),
    好人胜率: pct(goods.filter(e => e.result === 'win').length, goods.length), 狼人胜率: pct(wolves.filter(e => e.result === 'win').length, wolves.length),
    执法场次: matches.filter(m => Array.isArray(m.judges) && m.judges.map(String).includes(String(p.id))).length,
  };
}).sort((a, b) => b.积分 - a.积分 || b.胜率 - a.胜率);

// ── 对局记录（一局一行）──
const matchRows = allMatches.map(m => {
  const isBaby = m.track === 'baby';
  const ents = (m.entries || []).slice().sort((a, b) => (a.seat || 99) - (b.seat || 99));
  const date = /^\d{4}-\d{2}-\d{2}$/.test(m.date || '') ? m.date : null;
  return {
    key: String(m.id), title: `${m.exhibition ? '表演赛' : isBaby ? '宝宝赛' : '第' + m.week + '周'} · ${m.date || '日期待定'} · 第${m.round || '?'}局`,
    日期: date, 周: isBaby ? '宝宝赛' : `第${m.week}周`, 局: Number(m.round) || null, 赛道: m.exhibition ? '表演赛' : isBaby ? '宝宝赛' : '正赛', 桌: m.table || (isBaby ? 'B' : 'A'),
    胜方: winSide(m) || '待记录', 表演赛: !!m.exhibition, 人数: ents.length,
    法官: (Array.isArray(m.judges) ? m.judges : []).map(nameOf).join('、'),
    名单: ents.map(e => `${e.seat ? e.seat + '号 ' : ''}${nameOf(e.playerId)}（${e.role || '?'}）${e.result === 'win' ? '✓胜' : '✗负'} ${e.total > 0 ? '+' : ''}${e.total ?? 0}`).join('\n'),
  };
}).sort((a, b) => (b.日期 || '').localeCompare(a.日期 || '') || (b.局 || 0) - (a.局 || 0));

// ── 找到 / 创建数据库 ──
async function childDatabases() {
  const out = []; let cursor;
  do { const j = await notion('GET', `/v1/blocks/${PARENT}/children?page_size=100${cursor ? '&start_cursor=' + cursor : ''}`); j.results.forEach(b => b.type === 'child_database' && out.push({ id: b.id, title: b.child_database.title })); cursor = j.has_more ? j.next_cursor : null; } while (cursor);
  return out;
}
const sel = names => ({ select: { options: names.map(name => ({ name })) } });
const schemas = {
  [`${LABEL} 玩家战绩`]: { 玩家: { title: {} }, 玩家ID: { rich_text: {} }, 积分: { number: {} }, 场次: { number: {} }, 胜场: { number: {} }, 胜率: { number: { format: 'percent' } }, 好人胜率: { number: { format: 'percent' } }, 狼人胜率: { number: { format: 'percent' } }, 执法场次: { number: {} }, 校验: { rich_text: {} } },
  [`${LABEL} 对局记录`]: { 对局: { title: {} }, 对局ID: { rich_text: {} }, 日期: { date: {} }, 周: { rich_text: {} }, 局: { number: {} }, 赛道: sel(['正赛', '宝宝赛', '表演赛']), 桌: sel(['A', 'B']), 胜方: sel(['好人胜', '狼人胜', '待记录']), 人数: { number: {} }, 法官: { rich_text: {} }, 参赛名单: { rich_text: {} }, 校验: { rich_text: {} } },
};
const existing = await childDatabases(); const dbId = {};
for (const [title, properties] of Object.entries(schemas)) {
  const hit = existing.find(d => d.title === title);
  if (hit) { dbId[title] = hit.id; continue; }
  const j = await notion('POST', '/v1/databases', { parent: { type: 'page_id', page_id: PARENT }, title: txt(title), properties });
  dbId[title] = j.id; console.log('已创建数据库', title);
}

// ── 通用 upsert ──
async function loadPages(db, keyProp) {
  const map = new Map(); let cursor;
  do { const j = await notion('POST', `/v1/databases/${db}/query`, { page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) });
    j.results.forEach(pg => { const k = pg.properties[keyProp]?.rich_text?.map(t => t.plain_text).join(''); if (k) map.set(k, { id: pg.id, sum: pg.properties['校验']?.rich_text?.map(t => t.plain_text).join('') }); });
    cursor = j.has_more ? j.next_cursor : null; } while (cursor);
  return map;
}
async function upsert(db, keyProp, rows, toProps, toIcon) {
  const have = await loadPages(db, keyProp); const seen = new Set(); let c = 0, u = 0, s = 0, d = 0;
  for (const r of rows) {
    seen.add(r.key); const props = toProps(r); const sum = hash(props); props['校验'] = { rich_text: txt(sum) };
    const cur = have.get(r.key);
    if (!cur) { await notion('POST', '/v1/pages', { parent: { database_id: db }, ...(toIcon ? { icon: { type: 'emoji', emoji: toIcon(r) } } : {}), properties: props }); c++; }
    else if (cur.sum !== sum) { await notion('PATCH', `/v1/pages/${cur.id}`, { properties: props }); u++; }
    else s++;
  }
  for (const [k, v] of have) if (!seen.has(k)) { await notion('PATCH', `/v1/pages/${v.id}`, { in_trash: true }); d++; } // 网站里已删除的记录
  return { c, u, s, d };
}

const pl = await upsert(dbId[`${LABEL} 玩家战绩`], '玩家ID', playerRows, r => ({
  玩家: { title: txt(r.title) }, 玩家ID: { rich_text: txt(r.key) }, 积分: { number: r.积分 }, 场次: { number: r.场次 }, 胜场: { number: r.胜场 },
  胜率: { number: r.胜率 == null ? null : r.胜率 / 100 }, 好人胜率: { number: r.好人胜率 == null ? null : r.好人胜率 / 100 }, 狼人胜率: { number: r.狼人胜率 == null ? null : r.狼人胜率 / 100 }, 执法场次: { number: r.执法场次 },
}), r => r.emoji);
const mt = await upsert(dbId[`${LABEL} 对局记录`], '对局ID', matchRows, r => ({
  对局: { title: txt(r.title) }, 对局ID: { rich_text: txt(r.key) }, 日期: { date: r.日期 ? { start: r.日期 } : null }, 周: { rich_text: txt(r.周) }, 局: { number: r.局 },
  赛道: { select: { name: r.赛道 } }, 桌: { select: { name: r.桌 } }, 胜方: { select: { name: r.胜方 } }, 人数: { number: r.人数 }, 法官: { rich_text: txt(r.法官) }, 参赛名单: { rich_text: txt(r.名单) },
}));
console.log(`玩家：新增${pl.c} 更新${pl.u} 未变${pl.s} 移除${pl.d}；对局：新增${mt.c} 更新${mt.u} 未变${mt.s} 移除${mt.d}`);
