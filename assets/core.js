/* 竹北選舉功課表：五種視覺共用的資料呈現與盲測邏輯。
 * 各視覺只提供 window.THEME（文案與 hero）和自己的 CSS。 */
(function () {
  'use strict';

  const D = window.ELECTION;
  const T = window.THEME || {};
  const app = document.getElementById('app');

  // ---------- 小工具 ----------
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem('zb:' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem('zb:' + k, JSON.stringify(v)); } catch { /* 私密視窗等情況，略過 */ } },
  };
  const office = (id) => D.offices.find((o) => o.id === id);
  const cand = (id) => D.candidates[id];
  const groupOf = (o, gid) => o.groups.find((g) => g.id === gid) || o.groups[0];

  // 字串雜湊＋種子亂數：讓選項順序固定但與候選人無關
  function seeded(str) {
    let h = 2166136261;
    for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; };
  }
  function shuffle(arr, seed) {
    const r = seeded(seed); const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  const ELECTION_DAY = new Date(D.meta.election_date + 'T08:00:00+08:00');
  const IDENTITIES = [
    { id: 'general', label: '一般選民' },
    { id: 'pi', label: '平地原住民' },
    { id: 'mi', label: '山地原住民' },
  ];
  const STATUS_TONE = (s) => (/判決確定|有罪/.test(s || '') ? 'grave' : /起訴|偵查/.test(s || '') ? 'open' : 'soft');

  // ---------- 選民身分：住哪個里、什麼身分 ----------
  const profile = Object.assign({ village: null, identity: 'general' }, store.get('profile', {}));
  function saveProfile() { store.set('profile', profile); }

  // 這位選民在某職務投的是哪一個選區（group）
  function groupFor(o, p) {
    const fits = (g) => !g.villages || (p.village && g.villages.includes(p.village));
    const pick = (e) => o.groups.find((g) => (g.eligibility || 'all') === e && fits(g));
    if (p.identity !== 'general') { const g = pick(p.identity); if (g) return g; }
    return pick('all') || pick('general') || null;
  }
  function ballot(p) {
    return D.offices.map((o) => {
      const g = groupFor(o, p);
      const needVillage = !g && o.groups.some((x) => x.villages);
      return { office: o, group: g, needVillage };
    });
  }

  // ---------- 外框 ----------
  const NAV = [
    { href: '#/', label: '首頁', match: /^$/ },
    { href: '#/offices', label: '職務與候選人', match: /^(offices|office|candidate)/ },
    { href: '#/compare', label: '政見對照', match: /^compare/ },
    { href: '#/quiz', label: '盲測', match: /^quiz/ },
    { href: '#/about', label: '方法與來源', match: /^about/ },
  ];
  const REPO = 'https://github.com/Benjamin-Teng/Zhubei-election';

  function renderShell() {
    app.innerHTML = `
      <a class="skip" href="#main">跳到主要內容</a>
      <header class="site-head">
        <a class="brand" href="#/">${T.brandHTML || esc(T.brand || '竹北選舉功課表')}</a>
        <nav class="site-nav" aria-label="主選單">
          ${NAV.map((n) => `<a href="${n.href}" data-nav="${n.href}">${n.label}</a>`).join('')}
        </nav>
      </header>
      <main id="main" class="site-main" tabindex="-1"></main>
      <footer class="site-foot">
        <p class="foot-note">本站整理 2026 年 11 月 28 日地方選舉竹北市民可投的職務與候選人資料。每一條事實都附來源；不替任何候選人或政黨背書。</p>
        <p class="foot-build">資料整理日 ${esc(D.meta.built_at)}</p>
        <p class="foot-links"><a href="${REPO}/tree/main/research" target="_blank" rel="noopener">原始資料與查證紀錄（GitHub）</a><a href="${REPO}/issues" target="_blank" rel="noopener">回報錯誤</a></p>
      </footer>`;
  }

  function setActiveNav(path) {
    app.querySelectorAll('[data-nav]').forEach((a) => {
      const n = NAV.find((x) => x.href === a.dataset.nav);
      a.toggleAttribute('aria-current', n.match.test(path));
    });
  }

  // ---------- 共用片段 ----------
  function partyTag(c) { return `<span class="party">${esc(c.party || '政黨待查')}</span>`; }
  function numTag(c) { return `<span class="ballot-no" aria-label="號次">${c.ballot_number ?? '–'}</span>`; }

  function candCard(c) {
    const n = (k) => (c[k] || []).length;
    return `
      <a class="cand-card" href="#/candidate/${esc(c.id)}">
        ${numTag(c)}
        <span class="cand-name">${esc(c.name)}</span>
        <span class="cand-meta">${partyTag(c)}${c.incumbent ? '<span class="flag">現任</span>' : ''}</span>
        <span class="cand-bg">${esc(c.background || '背景資料待補')}</span>
        <span class="cand-stats">
          <span><b>${n('platform')}</b> 政見</span>
          <span><b>${n('achievements')}</b> 政績</span>
          <span><b>${n('controversies')}</b> 爭議</span>
        </span>
      </a>`;
  }

  function groupPicker(o, gid, base) {
    if (o.groups.length < 2) return '';
    return `<label class="group-pick">選區
      <select data-goto="${base}">
        ${o.groups.map((g) => `<option value="${g.id}" ${g.id === gid ? 'selected' : ''}>${esc(g.name)}（${g.candidates.length} 人）</option>`).join('')}
      </select></label>`;
  }

  function villageSelect(name, value, placeholder) {
    return `<select name="${name}">
      <option value="">${placeholder}</option>
      ${D.villages.map((v) => `<option ${v === value ? 'selected' : ''}>${esc(v)}</option>`).join('')}
    </select>`;
  }

  function profileForm(id) {
    return `
      <form class="profile-form" id="${id}">
        <label>我住在${villageSelect('village', profile.village, '選擇里別')}</label>
        <fieldset><legend>選民身分</legend>
          ${IDENTITIES.map((x) => `<label class="radio"><input type="radio" name="identity" value="${x.id}" ${profile.identity === x.id ? 'checked' : ''}> ${x.label}</label>`).join('')}
        </fieldset>
      </form>`;
  }
  function bindProfileForm(id, onChange) {
    const f = document.getElementById(id); if (!f) return;
    f.addEventListener('change', () => {
      profile.village = f.village.value || null;
      profile.identity = f.identity.value || 'general';
      saveProfile(); onChange();
    });
  }

  function ballotList(p) {
    return `<ol class="my-ballot">${ballot(p).map(({ office: o, group: g, needVillage }) => `
      <li class="ballot-row">
        <span class="ballot-office">${esc(o.name)}</span>
        ${g ? `<a class="ballot-group" href="#/office/${o.id}/${g.id}">${esc(g.name)}<small>${g.candidates.length} 位候選人${g.seats ? `，應選 ${g.seats} 席` : ''}</small></a>`
          : `<span class="ballot-group muted">${needVillage ? '先選你住的里' : '這個身分不投此職務'}</span>`}
      </li>`).join('')}</ol>`;
  }

  // ---------- 頁面：首頁 ----------
  function pageHome(main) {
    const days = Math.ceil((ELECTION_DAY - new Date()) / 86400000);
    const total = Object.keys(D.candidates).length;
    const ctx = { days, total, offices: D.offices, esc };
    main.innerHTML = `
      ${T.hero ? T.hero(ctx) : `<section class="hero"><h1>竹北投票前，先做功課</h1><p>距離投票日還有 ${days} 天</p></section>`}
      <section class="home-ballot">
        <h2>你在竹北會拿到哪幾張票</h2>
        <p class="lede">選你住的里和身分，就知道自己投哪些選區、有哪些候選人。</p>
        ${profileForm('home-profile')}
        <div id="home-ballot">${ballotList(profile)}</div>
      </section>
      <section class="home-paths">
        <a class="path" href="#/offices"><h3>看候選人</h3><p>經歷、政績、政見、爭議，一人一頁，每條附來源。</p></a>
        <a class="path" href="#/compare"><h3>對照政見</h3><p>同一職務的候選人放在一起，依議題逐列比較。</p></a>
        <a class="path" href="#/quiz"><h3>做盲測</h3><p>隱藏姓名與政黨，只看政見與政績，最後揭曉你最接近誰。</p></a>
      </section>`;
    bindProfileForm('home-profile', () => { document.getElementById('home-ballot').innerHTML = ballotList(profile); });
  }

  // ---------- 頁面：職務總覽 ----------
  function pageOffices(main) {
    main.innerHTML = `
      <header class="page-head"><h1>職務與候選人</h1>
        <p class="lede">竹北市民這次最多會領到五張選票。點進職務看候選人名單。</p></header>
      <div class="office-list">${D.offices.map((o) => {
        const n = o.groups.reduce((s, g) => s + g.candidates.length, 0);
        return `<a class="office-card" href="#/office/${o.id}">
          <span class="office-level">${esc(o.level)}</span>
          <h2>${esc(o.name)}</h2>
          <p>${esc(o.desc)}</p>
          <span class="office-count"><b>${n}</b> 位候選人${o.groups.length > 1 ? `，分 ${o.groups.length} 個選區` : ''}</span>
        </a>`;
      }).join('')}</div>`;
  }

  // ---------- 頁面：單一職務 ----------
  function pageOffice(main, oid, gid) {
    const o = office(oid); if (!o) return notFound(main);
    if (!gid) { const mine = groupFor(o, profile); gid = mine ? mine.id : o.groups[0].id; }
    const g = groupOf(o, gid);
    const list = g.candidates.map(cand).sort((a, b) => (a.ballot_number ?? 99) - (b.ballot_number ?? 99));
    main.innerHTML = `
      <nav class="crumbs"><a href="#/offices">職務與候選人</a><span>${esc(o.name)}</span></nav>
      <header class="page-head"><h1>${esc(o.name)}</h1>
        <p class="lede">${esc(o.desc)}</p>
        ${o.who_votes ? `<p class="who-votes">${esc(o.who_votes)}</p>` : ''}
      </header>
      <div class="toolbar">${groupPicker(o, g.id, `#/office/${o.id}/`)}
        <a class="btn ghost" href="#/compare/${o.id}/${g.id}">對照這個選區的政見</a></div>
      <section class="group-info">
        <h2>${esc(g.name)}</h2>
        ${g.seats ? `<p>應選 <b>${g.seats}</b> 席，候選人 <b>${list.length}</b> 位</p>` : ''}
        ${g.note ? `<p class="muted">${esc(g.note)}</p>` : ''}
      </section>
      ${list.length ? `<div class="cand-grid">${list.map(candCard).join('')}</div>` : '<p class="empty">這個選區還沒有候選人資料。</p>'}
      ${o.list_source ? `<p class="list-source">名單來源：<a href="${esc(o.list_source)}" target="_blank" rel="noopener">${esc(o.list_source)}</a></p>` : ''}`;
  }

  // ---------- 頁面：候選人 ----------
  function refLink(c, i) {
    if (i == null || !c.sources[i]) return '';
    return `<a class="ref" href="${esc(c.sources[i].url)}" target="_blank" rel="noopener" title="${esc(c.sources[i].title)}">[${i + 1}]</a>`;
  }
  function itemList(c, arr, cls) {
    return `<ul class="${cls}">${arr.map((x) => `<li>${esc(x.text)} ${refLink(c, x.source)}</li>`).join('')}</ul>`;
  }
  function section(id, title, body, empty) {
    return `<section class="c-sec" id="sec-${id}"><h2>${title}</h2>${body || `<p class="empty">${empty}</p>`}</section>`;
  }

  function pageCandidate(main, id) {
    const c = cand(id); if (!c) return notFound(main);
    const o = office(c.office); const g = groupOf(o, c.group);
    const byTopic = {};
    c.platform.forEach((p) => { (byTopic[p.topic || '其他'] ||= []).push(p); });
    const SECS = [['background', '背景'], ['achievements', '政績'], ['platform', '政見'], ['controversies', '爭議'], ['livelihood', '民生觀察'], ['sources', '來源']];
    main.innerHTML = `
      <nav class="crumbs"><a href="#/offices">職務與候選人</a><a href="#/office/${o.id}/${g.id}">${esc(o.name)}${o.groups.length > 1 ? `／${esc(g.name)}` : ''}</a><span>${esc(c.name)}</span></nav>
      <header class="cand-head">
        ${numTag(c)}
        <div class="cand-id">
          <h1>${esc(c.name)}</h1>
          <p class="cand-meta">${partyTag(c)}${c.incumbent ? '<span class="flag">現任</span>' : ''}
            ${c.gender ? `<span>${esc(c.gender)}</span>` : ''}${c.birth_year ? `<span>${esc(c.birth_year)} 年生</span>` : ''}</p>
          <p class="cand-office">參選 ${esc(o.name)}${o.groups.length > 1 ? `　${esc(g.name)}` : ''}</p>
        </div>
      </header>
      <nav class="sec-nav" aria-label="本頁段落">${SECS.map(([k, t]) => `<a href="#sec-${k}" data-scroll="sec-${k}">${t}</a>`).join('')}</nav>
      ${section('background', '背景', `
        ${c.background ? `<p class="bg-text">${esc(c.background)}</p>` : ''}
        <div class="bg-cols">
          <div><h3>學歷</h3>${c.education?.length ? `<ul>${c.education.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>` : '<p class="empty">查無</p>'}</div>
          <div><h3>經歷</h3>${c.experience?.length ? `<ul>${c.experience.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>` : '<p class="empty">查無</p>'}</div>
        </div>`)}
      ${section('achievements', '政績', c.achievements.length && itemList(c, c.achievements, 'achv-list'), '查無可查證的過往施政或問政紀錄。')}
      ${section('platform', '政見', Object.keys(byTopic).length && Object.entries(byTopic).map(([t, arr]) => `
        <div class="topic-block"><h3 class="topic">${esc(t)}</h3>${itemList(c, arr, 'plat-list')}</div>`).join(''), '尚未查到具體政見。')}
      ${section('controversies', '爭議', c.controversies.length && `<div class="contro-list">${c.controversies.map((x) => `
        <article class="contro tone-${STATUS_TONE(x.status)}">
          <header><h3>${esc(x.title)}</h3>${x.date ? `<time>${esc(x.date)}</time>` : ''}</header>
          <p>${esc(x.summary)} ${refLink(c, x.source)}</p>
          ${x.status ? `<p class="contro-status">目前狀態：${esc(x.status)}</p>` : ''}
          <p class="contro-resp">本人回應：${esc(x.candidate_response || '查無公開回應')}</p>
        </article>`).join('')}</div>`, '查無可信來源記載的爭議。')}
      ${section('livelihood', '民生觀察', c.livelihood.length && itemList(c, c.livelihood, 'live-list'), '查無針對竹北民生議題的公開表態。')}
      ${section('sources', '來源', c.sources.length && `<ol class="src-list">${c.sources.map((s, i) => `
        <li id="src-${i}"><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title || s.url)}</a>${s.accessed ? `<small>查閱 ${esc(s.accessed)}</small>` : ''}</li>`).join('')}</ol>`, '無')}
      <p class="next-step"><a class="btn" href="#/compare/${o.id}/${g.id}">跟同選區候選人對照</a></p>`;
  }

  // ---------- 頁面：政見對照 ----------
  function pageCompare(main, oid, gid) {
    const o = office(oid || 'magistrate') || D.offices[0];
    if (!gid) { const mine = groupFor(o, profile); gid = mine ? mine.id : o.groups[0].id; }
    const g = groupOf(o, gid);
    const list = g.candidates.map(cand).sort((a, b) => (a.ballot_number ?? 99) - (b.ballot_number ?? 99));
    const blind = store.get('blindCompare', false);
    const topics = [...new Set(list.flatMap((c) => c.platform.map((p) => p.topic || '其他')))];
    const label = (c, i) => (blind ? `候選人 ${String.fromCharCode(65 + i)}` : `${c.ballot_number ?? '–'} ${c.name}`);
    main.innerHTML = `
      <header class="page-head"><h1>政見對照</h1>
        <p class="lede">同一選區的候選人並排，一列一個議題。空格代表沒查到這個議題的政見。</p></header>
      <div class="toolbar">
        <label class="group-pick">職務
          <select data-goto="#/compare/">${D.offices.map((x) => `<option value="${x.id}" ${x.id === o.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
        ${groupPicker(o, g.id, `#/compare/${o.id}/`)}
        <label class="toggle"><input type="checkbox" id="blind" ${blind ? 'checked' : ''}> 隱藏姓名</label>
      </div>
      ${list.length < 1 ? '<p class="empty">這個選區還沒有候選人資料。</p>' : `
      <div class="matrix-wrap" tabindex="0" role="region" aria-label="政見對照表">
        <table class="matrix" style="--cols:${list.length}">
          <thead><tr><th scope="col">議題</th>${list.map((c, i) => `<th scope="col">${blind ? esc(label(c, i)) : `<a href="#/candidate/${c.id}">${esc(label(c, i))}</a>`}${blind ? '' : `<small>${esc(c.party || '')}</small>`}</th>`).join('')}</tr></thead>
          <tbody>${topics.map((t) => `<tr><th scope="row">${esc(t)}</th>${list.map((c) => {
            const items = c.platform.filter((p) => (p.topic || '其他') === t);
            return `<td class="${items.length ? '' : 'none'}">${items.length ? `<ul>${items.map((p) => `<li>${esc(blind ? mask(p.text, o) : p.text)}</li>`).join('')}</ul>` : '<span aria-label="無資料">—</span>'}</td>`;
          }).join('')}</tr>`).join('')}</tbody>
        </table>
      </div>`}`;
    const b = document.getElementById('blind');
    if (b) b.addEventListener('change', () => { store.set('blindCompare', b.checked); pageCompare(main, o.id, g.id); });
  }

  // ---------- 盲測 ----------
  // 隱去選項裡會洩漏身分的字：同職務所有候選人姓名、政黨名
  const PARTIES = ['中國國民黨', '國民黨', '民主進步黨', '民進黨', '台灣民眾黨', '民眾黨', '時代力量', '台灣基進', '親民黨', '無黨團結聯盟', '綠黨', '社會民主黨', '小民參政歐巴桑聯盟', '無黨籍'];
  function mask(text, o) {
    let t = String(text);
    // 原住民候選人姓名常含族名（「中文名 族名」），兩段都要遮
    const names = o.groups.flatMap((g) => g.candidates.flatMap((id) => {
      const n = cand(id).name || '';
      return [n, ...n.split(/[\s　]+/)].filter((s) => s.length >= 2);
    }));
    for (const n of names.sort((a, b) => b.length - a.length)) t = t.split(n).join('○○○');
    for (const p of PARTIES) t = t.split(p).join('某政黨');
    return t;
  }

  const QUIZ_MAX_PER_OFFICE = 6;
  const QUIZ_PER_CAND_TOPIC = 2;

  function buildQuestions(p) {
    const out = [];
    for (const { office: o, group: g } of ballot(p)) {
      if (!g || g.candidates.length < 2) continue;
      const inGroup = new Set(g.candidates);
      const curated = (D.quiz && D.quiz[o.id]) || null;
      let qs = [];
      if (curated) {
        qs = curated.map((q) => ({
          ...q,
          options: q.options.map((x) => ({ ...x, cands: x.cands.filter((c) => inGroup.has(c)) })).filter((x) => x.cands.length),
        })).filter((q) => new Set(q.options.flatMap((x) => x.cands)).size >= 2);
      } else {
        // 自動出題：依議題把政見與政績分組，至少兩位候選人有內容的議題才出
        const byTopic = {};
        for (const id of g.candidates) {
          const c = cand(id);
          const items = [
            ...c.platform.map((x) => ({ ...x, kind: '政見' })),
            ...c.achievements.map((x) => ({ ...x, kind: '政績', topic: x.topic || '過往作為' })),
          ];
          const perTopic = {};
          for (const it of items) {
            const t = it.topic || '其他';
            perTopic[t] = (perTopic[t] || 0) + 1;
            // 候選人多的選區（縣議員、市民代表）每人每議題只出一個選項，免得一題幾十個選項
            if (perTopic[t] > (g.candidates.length > 6 ? 1 : QUIZ_PER_CAND_TOPIC)) continue;
            (byTopic[t] ||= []).push({ text: mask(it.text, o), kind: it.kind, cands: [id] });
          }
        }
        qs = Object.entries(byTopic)
          .filter(([, opts]) => new Set(opts.flatMap((x) => x.cands)).size >= 2)
          .sort((a, b) => new Set(b[1].flatMap((x) => x.cands)).size - new Set(a[1].flatMap((x) => x.cands)).size)
          .slice(0, QUIZ_MAX_PER_OFFICE)
          .map(([t, opts], i) => ({ id: `auto-${i}`, topic: t, prompt: `關於「${t}」，下列哪些做法是你認同的？`, options: opts.map((x, j) => ({ ...x, id: `o${j}` })) }));
      }
      qs.forEach((q) => out.push({
        ...q,
        key: `${o.id}:${g.id}:${q.id}`,
        office: o.id, group: g.id,
        options: shuffle(q.options, `${o.id}:${g.id}:${q.id}`),
      }));
    }
    return out;
  }

  const quiz = Object.assign({ answers: {}, started: false }, store.get('quiz', {}));
  function saveQuiz() { store.set('quiz', quiz); }

  function pageQuizSetup(main) {
    const qs = buildQuestions(profile);
    const offices = [...new Set(qs.map((q) => q.office))];
    main.innerHTML = `
      <header class="page-head"><h1>盲測：只看政見和政績</h1>
        <p class="lede">題目裡沒有姓名、沒有政黨。每題可複選，勾你認同的做法；都不認同就直接下一題。做完後，每個你能投的職務各揭曉一位最接近你的候選人。</p></header>
      <section class="quiz-setup">
        <h2>先確認你能投哪些職務</h2>
        ${profileForm('quiz-profile')}
        <div id="quiz-ballot">${ballotList(profile)}</div>
        <p class="quiz-summary">${qs.length ? `共 <b>${qs.length}</b> 題，涵蓋 ${offices.map((id) => esc(office(id).short)).join('、')}。` : '目前還出不了題：先選你住的里，或這些選區的候選人資料還不夠。'}</p>
        ${skippedNote(profile)}
        ${(() => {
          const thin = ballot(profile).filter(({ office: o, group: g }) => g && g.candidates.length >= 2 && !offices.includes(o.id));
          return thin.length ? `<p class="muted">政見資料還不夠，暫不出題：${thin.map(({ office: o, group: g }) => `${esc(o.short)}（${esc(g.name)}）`).join('、')}。選舉公報出刊後補上。</p>` : '';
        })()}
        <div class="quiz-actions">
          ${qs.length ? `<a class="btn" href="#/quiz/q/1" id="quiz-start">${Object.keys(quiz.answers).length ? '繼續作答' : '開始作答'}</a>` : ''}
          ${Object.keys(quiz.answers).length ? '<button class="btn ghost" type="button" id="quiz-reset">清除答案重來</button>' : ''}
        </div>
      </section>
      <details class="quiz-method"><summary>怎麼計分</summary>
        <p>每個選項都來自某位候選人的政見或過往政績。你勾的選項算那位候選人一分，再除以（他在題目裡出現的選項總數＋1），得到契合度。用比例而非總分，是為了不讓資料比較多的候選人占便宜。</p>
        <p>同額競選、或只有一位候選人有資料的選區不出題。</p>
      </details>`;
    bindProfileForm('quiz-profile', () => pageQuizSetup(main));
    const r = document.getElementById('quiz-reset');
    if (r) r.addEventListener('click', () => { quiz.answers = {}; saveQuiz(); pageQuizSetup(main); });
  }

  function skippedNote(p) {
    const skipped = ballot(p).filter(({ group: g }) => g && g.candidates.length < 2);
    if (!skipped.length) return '';
    return `<p class="muted">不出題：${skipped.map(({ office: o, group: g }) => `${esc(o.short)}（${esc(g.name)}，${g.candidates.length ? '同額競選' : '無人登記'}）`).join('、')}</p>`;
  }

  function pageQuizQuestion(main, n) {
    const qs = buildQuestions(profile);
    if (!qs.length) { location.hash = '#/quiz'; return; }
    const i = Math.min(Math.max(1, n), qs.length) - 1;
    const q = qs[i]; const o = office(q.office);
    const chosen = new Set(quiz.answers[q.key] || []);
    main.innerHTML = `
      <section class="quiz-q">
        <div class="quiz-progress" role="progressbar" aria-valuemin="1" aria-valuemax="${qs.length}" aria-valuenow="${i + 1}" style="--p:${(i + 1) / qs.length}">
          <span>第 ${i + 1} 題，共 ${qs.length} 題</span><i></i></div>
        <p class="quiz-office">${esc(o.name)}${o.groups.length > 1 ? `　${esc(groupOf(o, q.group).name)}` : ''}</p>
        <h1 class="quiz-prompt">${esc(q.prompt)}</h1>
        <p class="muted">可複選，也可以都不勾。</p>
        <form class="quiz-options" id="qform">
          ${q.options.map((x) => `
            <label class="q-opt">
              <input type="checkbox" name="opt" value="${esc(x.id)}" ${chosen.has(x.id) ? 'checked' : ''}>
              <span class="q-mark" aria-hidden="true"></span>
              <span class="q-text">${esc(x.text)}${x.kind ? `<small class="q-kind">${esc(x.kind)}</small>` : ''}</span>
            </label>`).join('')}
        </form>
        <div class="quiz-nav">
          ${i > 0 ? `<a class="btn ghost" href="#/quiz/q/${i}">上一題</a>` : '<a class="btn ghost" href="#/quiz">回設定</a>'}
          ${i < qs.length - 1 ? `<a class="btn" href="#/quiz/q/${i + 2}">下一題</a>` : '<a class="btn" href="#/quiz/result">看結果</a>'}
        </div>
      </section>`;
    document.getElementById('qform').addEventListener('change', (e) => {
      quiz.answers[q.key] = [...e.currentTarget.querySelectorAll('input:checked')].map((x) => x.value);
      saveQuiz();
    });
  }

  function score(qs) {
    const byOffice = {};
    for (const q of qs) {
      const k = `${q.office}:${q.group}`;
      const s = (byOffice[k] ||= { office: q.office, group: q.group, cands: {}, answered: 0, qs: [] });
      s.qs.push(q);
      const picked = new Set(quiz.answers[q.key] || []);
      if (picked.size) s.answered++;
      for (const x of q.options) for (const c of x.cands) {
        const r = (s.cands[c] ||= { id: c, hits: 0, total: 0 });
        r.total++; if (picked.has(x.id)) r.hits++;
      }
    }
    return Object.values(byOffice).map((s) => {
      const rows = Object.values(s.cands).map((r) => ({ ...r, pct: r.hits / (r.total + 1) }))
        .sort((a, b) => b.pct - a.pct || b.hits - a.hits);
      const top = rows[0];
      const winners = top && top.hits ? rows.filter((r) => r.pct === top.pct && r.hits === top.hits) : [];
      return { ...s, rows, winners };
    });
  }

  function pageQuizResult(main) {
    const qs = buildQuestions(profile);
    if (!qs.length) { location.hash = '#/quiz'; return; }
    const results = score(qs);
    main.innerHTML = `
      <header class="page-head"><h1>揭曉：你的理念最接近誰</h1>
        <p class="lede">每個職務各一位。契合度＝你勾選的該候選人選項數 ÷（他在題目中的選項數＋1）。分母加 1，是為了不讓只有一兩個選項的候選人勾一個就拿高分。</p></header>
      <div class="results">${results.map((r) => {
        const o = office(r.office); const g = groupOf(o, r.group);
        return `<article class="result">
          <header><p class="result-office">${esc(o.name)}${o.groups.length > 1 ? `　${esc(g.name)}` : ''}</p>
          ${r.winners.length ? `<h2 class="result-name">${r.winners.map((w) => `<a href="#/candidate/${w.id}">${esc(cand(w.id).name)}</a>`).join('、')}${r.winners.length > 1 ? '<small>（同分）</small>' : ''}</h2>
            <p class="result-party">${r.winners.map((w) => esc(cand(w.id).party)).join('、')}</p>`
            : '<h2 class="result-name muted">這個職務你沒有勾任何選項</h2>'}</header>
          <ol class="score-bars">${r.rows.map((x) => `
            <li style="--v:${x.pct}"><span class="sb-name">${esc(cand(x.id).ballot_number ?? '–')} ${esc(cand(x.id).name)}</span>
              <span class="sb-bar"><i></i></span><span class="sb-val">${Math.round(x.pct * 100)}%<small>${x.hits}/${x.total}</small></span></li>`).join('')}</ol>
          ${(() => {
            const missing = g.candidates.filter((id) => !r.rows.some((x) => x.id === id));
            return missing.length ? `<p class="muted">沒有查到政見或政績、未列入比對：${missing.map((id) => `<a href="#/candidate/${id}">${esc(cand(id).name)}</a>`).join('、')}</p>` : '';
          })()}
          <details class="reveal"><summary>逐題對答案</summary>
            ${r.qs.map((q) => {
              const picked = new Set(quiz.answers[q.key] || []);
              return `<div class="reveal-q"><h3>${esc(q.prompt)}</h3><ul>${q.options.map((x) => `
                <li class="${picked.has(x.id) ? 'picked' : ''}"><span class="rv-who">${x.cands.map((c) => esc(cand(c).name)).join('、')}</span>${esc(x.text)}</li>`).join('')}</ul></div>`;
            }).join('')}
          </details>
        </article>`;
      }).join('')}</div>
      <p class="result-note">盲測只比對政見與政績的文字內容，沒有評估可行性、財源與候選人過去是否兌現承諾。投票前建議再讀一次候選人頁的爭議與民生觀察。</p>
      <div class="quiz-nav"><a class="btn ghost" href="#/quiz/q/1">修改答案</a><a class="btn" href="#/offices">看完整候選人資料</a></div>`;
  }

  // ---------- 頁面：方法 ----------
  function pageAbout(main) {
    main.innerHTML = `
      <header class="page-head"><h1>方法與來源</h1></header>
      <section class="prose">
        <h2>不以黨廢人</h2>
        <p>每位候選人用同一份欄位查資料：學經歷、政績、政見、爭議、民生觀察。政黨只標示、不加權，盲測裡完全隱藏。</p>
        <h2>資料怎麼來</h2>
        <p>候選人名單以中央選舉委員會與新竹縣選舉委員會公告為準。其餘資料取自政府機關網站、議會紀錄、法院判決、候選人自己發布的政見，以及主流與地方媒體報導。每一條事實都標了來源編號，點下去就是原始網頁。</p>
        <h2>爭議怎麼收</h2>
        <p>只收法院、檢調、監察院、議會紀錄或主流媒體可查證的事件，並寫明目前的司法狀態與本人回應。網路傳言與匿名爆料不收。</p>
        <h2>盲測怎麼出題</h2>
        <p>題目只用政見與政績。選項文字會隱去候選人姓名與政黨，選項順序打亂且與候選人無關。縣長、縣議員、市長的題目經人工改寫成中性敘述；市民代表與里長依議題自動分組出題。</p>
        <h2>限制</h2>
        <p>新人沒有政績、資料少的候選人選項也少，契合度只能參考。計分時分母加 1，避免只出現一兩個選項的候選人勾一個就拿高分。里長與市民代表的公開資料普遍不多，選舉公報出刊後會再補。</p>
        <h2>發現錯誤</h2>
        <p>請到 <a href="${REPO}/issues" target="_blank" rel="noopener">GitHub issues</a> 回報，附上正確來源，查證後更新。</p>
        <h2>原始資料與查證紀錄</h2>
        <p>每位候選人的原始資料與查證筆記，以及另外委派審查者逐條核對來源的驗證報告，都公開在 <a href="${REPO}/tree/main/research" target="_blank" rel="noopener">GitHub 的 research 資料夾</a>。驗證發現的錯誤與修正方式也記在報告裡。</p>
      </section>
      <section class="prose">
        <h2>各職務名單來源</h2>
        <ul>${D.offices.map((o) => `<li>${esc(o.name)}：${o.list_source ? `<a href="${esc(o.list_source)}" target="_blank" rel="noopener">${esc(o.list_source)}</a>` : '待補'}${o.researched_at ? `（查閱 ${esc(o.researched_at)}）` : ''}</li>`).join('')}</ul>
      </section>`;
  }

  function notFound(main) {
    main.innerHTML = '<section class="page-head"><h1>找不到這一頁</h1><p><a class="btn" href="#/">回首頁</a></p></section>';
  }

  // ---------- 路由 ----------
  function route() {
    const path = location.hash.replace(/^#\/?/, '');
    const [a, b, c] = path.split('/');
    const main = document.getElementById('main');
    setActiveNav(path);
    if (!a) pageHome(main);
    else if (a === 'offices') pageOffices(main);
    else if (a === 'office') pageOffice(main, b, c);
    else if (a === 'candidate') pageCandidate(main, b);
    else if (a === 'compare') pageCompare(main, b, c);
    else if (a === 'quiz' && b === 'q') pageQuizQuestion(main, parseInt(c, 10) || 1);
    else if (a === 'quiz' && b === 'result') pageQuizResult(main);
    else if (a === 'quiz') pageQuizSetup(main);
    else if (a === 'about') pageAbout(main);
    else notFound(main);
    document.title = `${(main.querySelector('h1') || {}).textContent || ''}｜${T.brand || '竹北選舉功課表'}`;
    window.scrollTo(0, 0);
    main.focus({ preventScroll: true });
    if (T.afterRender) T.afterRender(path, main);
  }

  // 事件委派：下拉選單換頁、頁內捲動
  document.addEventListener('change', (e) => {
    const s = e.target.closest('select[data-goto]');
    if (s) location.hash = s.dataset.goto + s.value;
  });
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-scroll]');
    if (a) { e.preventDefault(); document.getElementById(a.dataset.scroll)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }
  });

  renderShell();
  window.addEventListener('hashchange', route);
  route();
})();
