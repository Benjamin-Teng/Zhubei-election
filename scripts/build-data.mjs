// 把 research/raw/*.json 合併成網站用的 assets/data.js。
// 用法：node scripts/build-data.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = join(ROOT, 'research', 'raw');
const warnings = [];

function load(name) {
  const p = join(RAW, name);
  if (!existsSync(p)) { warnings.push(`缺檔：research/raw/${name}`); return null; }
  return JSON.parse(readFileSync(p, 'utf8'));
}

const candidates = {};
const offices = [];

// 把來源索引換成來源物件，讓前端不必再查表
function addCandidate(c, officeId, groupId) {
  const sources = (c.sources || []).map((s, i) => ({ n: i + 1, ...s }));
  const fix = (arr) => (arr || []).map((x) => ({ ...x, source: Number.isInteger(x.source) ? x.source : null }));
  // 選委會登記冊的欄位是「推薦之政黨」，填「無」只代表沒有政黨推薦，不等於沒有黨籍
  const party = /^(無|無黨籍)$/.test(c.party || '') ? '無（未經政黨推薦）' : c.party;
  candidates[c.id] = {
    ...c,
    party,
    office: officeId,
    group: groupId,
    achievements: fix(c.achievements),
    platform: fix(c.platform),
    controversies: fix(c.controversies),
    livelihood: fix(c.livelihood),
    sources,
  };
  return c.id;
}

function single(raw, meta) {
  if (!raw) return;
  const g = {
    id: 'all', name: meta.groupName || raw.district || '全區',
    eligibility: meta.eligibility || 'all', villages: null,
    seats: raw.seats ?? null, note: raw.district_note || null,
    candidates: (raw.candidates || []).map((c) => addCandidate(c, meta.id, 'all')),
  };
  offices.push({
    id: meta.id, name: raw.office_name || meta.name, short: meta.short, level: meta.level,
    desc: meta.desc, who_votes: raw.who_votes || null, list_source: raw.official_list_source || null,
    researched_at: raw.researched_at || null, groups: [g],
  });
}

single(load('magistrate.json'), {
  id: 'magistrate', name: '新竹縣長', short: '縣長', level: '縣',
  desc: '新竹縣的行政首長，掌管縣府預算、交通建設、教育、社福與都市計畫。',
});

// 縣議員：一般選區＋兩個原住民選區合成一個職務
{
  const general = load('councilor.json');
  const pi = load('councilor-plain-indigenous.json');
  const mi = load('councilor-mountain-indigenous.json');
  const groups = [];
  const mk = (raw, id, elig, fallback) => raw && groups.push({
    id, name: raw.district || fallback, eligibility: elig, villages: null,
    seats: raw.seats ?? null, note: raw.district_note || null,
    candidates: (raw.candidates || []).map((c) => addCandidate(c, 'councilor', id)),
  });
  // 竹北本屆依台鐵分東西兩個選區：候選人有 district 欄位，里別寫在 district_note
  // 「第N選舉區＝竹北市甲里、乙里…（15 里）」，從這段文字解析出各區的里
  if (general && general.candidates.some((c) => c.district)) {
    const allVillages = (load('villages.json') || []).map((v) => v.village);
    const covered = new Set();
    const names = [...new Set(general.candidates.map((c) => c.district))].sort();
    const villageRows = load('villages.json') || [];
    for (const [i, name] of names.entries()) {
      // 優先讀 villages.json 的 councilor_district；沒有才從公告文字解析
      const fromRows = villageRows.filter((v) => v.councilor_district === name).map((v) => v.village);
      const m = new RegExp(`${name}＝竹北市([^（]+)（`).exec(general.district_note || '');
      const vs = fromRows.length ? fromRows : (m ? m[1].split('、').map((s) => s.trim()) : null);
      if (!vs) warnings.push(`縣議員 ${name} 解析不到里別`);
      (vs || []).forEach((v) => { covered.add(v); if (!allVillages.includes(v)) warnings.push(`縣議員 ${name} 的「${v}」不在 villages.json`); });
      const seatM = new RegExp(`${name}＝[^；]*?應選 (\\d+) 席(，其中婦女保障 (\\d+) 席)?`).exec(general.district_note || '');
      const id = `g${i + 1}`;
      groups.push({
        id, name: `竹北市${name}`, eligibility: 'general', villages: vs,
        seats: seatM ? Number(seatM[1]) : null,
        note: seatM?.[3] ? `其中婦女保障 ${seatM[3]} 席` : null,
        candidates: general.candidates.filter((c) => c.district === name).map((c) => addCandidate(c, 'councilor', id)),
      });
    }
    for (const v of allVillages) if (!covered.has(v)) warnings.push(`縣議員選區沒有涵蓋「${v}」`);
  } else mk(general, 'general', 'general', '竹北市選區');
  mk(pi, 'pi', 'pi', '平地原住民選區');
  mk(mi, 'mi', 'mi', '山地原住民選區');
  if (groups.length) offices.push({
    id: 'councilor', name: '新竹縣議員', short: '縣議員', level: '縣',
    desc: '監督縣府、審議縣預算與自治條例。竹北是複數席次選區，一張選票圈一人。',
    who_votes: general?.who_votes || null, list_source: general?.official_list_source || null,
    researched_at: general?.researched_at || null, groups,
  });
}

single(load('mayor.json'), {
  id: 'mayor', name: '竹北市長', short: '市長', level: '市',
  desc: '竹北市公所首長，負責市區道路、公園、清潔、市立托育與里鄰事務。',
});

// 市民代表：多選區，以里對應
const villages = load('villages.json') || [];
{
  const raw = load('representative.json');
  if (raw) {
    const groups = (raw.districts || []).map((d, i) => {
      const id = `d${i + 1}`;
      const isPi = /原住民/.test(d.district || '');
      return {
        id, name: d.district, eligibility: isPi ? 'pi' : 'general',
        villages: isPi ? null : (d.villages || villages.filter((v) => v.rep_district === d.district).map((v) => v.village)),
        seats: d.seats ?? null, note: d.district_note || null,
        candidates: (d.candidates || []).map((c) => addCandidate(c, 'representative', id)),
      };
    });
    offices.push({
      id: 'representative', name: '竹北市民代表', short: '市民代表', level: '市',
      desc: '竹北市民代表會成員，審議市公所預算、監督市政。依居住的里分選區。',
      who_votes: raw.who_votes || null, list_source: raw.official_list_source || null,
      researched_at: raw.researched_at || null, groups,
    });
  }
}

{
  const raw = load('village-chief.json');
  if (raw) {
    const groups = (raw.villages || []).map((v, i) => ({
      id: `v${String(i + 1).padStart(2, '0')}`, name: v.village, eligibility: 'all',
      villages: [v.village], seats: v.seats ?? 1, note: v.note || null,
      candidates: (v.candidates || []).map((c) => addCandidate(c, 'village-chief', `v${String(i + 1).padStart(2, '0')}`)),
    }));
    offices.push({
      id: 'village-chief', name: '竹北市里長', short: '里長', level: '里',
      desc: '里辦公處負責人，處理里內環境、巷道、守望相助與市府聯繫。',
      who_votes: raw.who_votes || null, list_source: raw.official_list_source || null,
      researched_at: raw.researched_at || null, groups,
    });
  }
}

const quiz = existsSync(join(ROOT, 'research', 'quiz.json'))
  ? JSON.parse(readFileSync(join(ROOT, 'research', 'quiz.json'), 'utf8')) : {};

// 基本檢查：quiz 引用到的候選人都要存在
for (const [oid, qs] of Object.entries(quiz)) {
  for (const q of qs) for (const o of q.options) for (const c of o.cands) {
    if (!candidates[c]) warnings.push(`quiz ${oid}/${q.id} 引用不存在的候選人 ${c}`);
  }
}

const data = {
  meta: { election_date: '2026-11-28', built_at: new Date().toISOString().slice(0, 10) },
  offices,
  villages: villages.map((v) => v.village),
  candidates,
  quiz,
};

writeFileSync(join(ROOT, 'assets', 'data.js'), `window.ELECTION = ${JSON.stringify(data)};\n`, 'utf8');
console.log(`職務 ${offices.length}、候選人 ${Object.keys(candidates).length}、里 ${villages.length}`);
for (const w of warnings) console.warn('警告：' + w);
