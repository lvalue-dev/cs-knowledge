/* 화면 렌더링 + 플레이어. 레슨 데이터는 js/lessons/*.js, 추적 도구는 js/engine.js */
(function () {
  const CS = window.CS;
  const $ = (s, r = document) => r.querySelector(s);
  const LEVELS = [
    ['basic', '기초', '자료구조와 복잡도의 첫 감각'],
    ['mid', '중급', '자료구조 내부와 알고리즘 선택'],
    ['adv', '심화', '런타임과 하드웨어가 하는 일'],
    ['senior', '시니어', '시스템 규모에서 터지는 문제'],
  ];
  const TONE = { bad: '느린 방식', good: '빠른 방식', info: '동작 원리' };
  const SVG = 'http://www.w3.org/2000/svg';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const state = { lesson: null, n: null, runs: [], idx: 0, total: 1, playing: false, speed: 1, timer: null };

  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };
  let done = new Set(store.get('cs-done', []));

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const KW = 'function|return|const|let|for|while|if|else|of|new|await|async|continue|SELECT|FROM|WHERE|CREATE|INDEX|ON|LIMIT|IN|true|false|null|undefined';
  const HL = new RegExp(`(\\/\\/.*$|-- .*$)|('(?:[^'\\\\]|\\\\.)*')|\\b(\\d+)\\b|\\b(${KW})\\b`, 'g');
  const hl = (line) => esc(line).replace(HL, (m, c, s, n, k) =>
    c ? `<i class="t-c">${c}</i>` : s ? `<i class="t-s">${s}</i>` : n ? `<i class="t-n">${n}</i>` : `<i class="t-k">${k}</i>`);
  const fmt = (v) => (typeof v === 'number' ? v.toLocaleString('ko-KR') : v);

  /* ---------- 키 기반 DOM 동기화 + FLIP 이동 애니메이션 ---------- */
  function sync(parent, items, make, upd, flip = true) {
    const old = new Map(), first = new Map();
    for (const el of [...parent.children]) old.set(el.dataset.k, el);
    const animate = flip && !reduced;
    if (animate) old.forEach((el, k) => first.set(k, el.getBoundingClientRect()));
    let prev = null;
    for (const it of items) {
      const k = String(it.id);
      let el = old.get(k);
      if (el) old.delete(k);
      else {
        el = make(it);
        el.dataset.k = k;
        el.classList.add('enter');
        el.addEventListener('animationend', () => el.classList.remove('enter'), { once: true });
      }
      upd(el, it);
      const want = prev ? prev.nextSibling : parent.firstChild;
      if (el !== want) parent.insertBefore(el, want);
      prev = el;
    }
    old.forEach((el) => el.remove());
    if (!animate) return;
    const dur = Math.min(320, (650 / state.speed) * 0.85);
    for (const el of parent.children) {
      const f = first.get(el.dataset.k);
      if (!f) continue;
      const l = el.getBoundingClientRect();
      const dx = f.left - l.left, dy = f.top - l.top;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1)
        el.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: dur, easing: 'ease-out' });
    }
  }

  /* ---------- 패널 렌더러 ---------- */
  const mkCell = () => {
    const el = document.createElement('div');
    el.className = 'cell';
    el.innerHTML = '<span class="ptr"></span><span class="v"></span><span class="sub"></span>';
    return el;
  };
  const updCell = (el, it) => {
    el.dataset.s = it.s || '';
    el.children[0].textContent = it.ptr || '';
    el.children[1].textContent = it.v ?? '';
    el.children[2].textContent = it.sub ?? '';
    el.style.marginRight = it.gap ? '12px' : '';
  };

  const R = {
    cells(b, p) {
      b.className = 'pb cells' + (p.bars ? ' bars' : '') + (p.items.length > 20 || p.compact ? ' compact' : '') + (p.cols ? ' grid' : '');
      b.style.gridTemplateColumns = p.cols ? `repeat(${p.cols}, max-content)` : '';
      sync(b, p.items, mkCell, (el, it) => {
        updCell(el, it);
        if (p.bars) el.style.setProperty('--h', `${16 + (it.v / p.max) * 96}px`);
      });
    },
    stack(b, p) {
      b.className = 'pb stack' + (p.down ? ' down' : '');
      sync(b, p.items, mkCell, updCell);
    },
    buckets(b, p) {
      b.className = 'pb buckets';
      while (b.children.length < p.buckets.length) {
        const row = document.createElement('div');
        row.className = 'brow';
        row.innerHTML = `<span class="bi">${b.children.length}</span><div class="chain"></div>`;
        b.appendChild(row);
      }
      p.buckets.forEach((items, i) => {
        const row = b.children[i];
        row.classList.toggle('on', p.active === i);
        sync(row.lastChild, items, mkCell, updCell);
      });
    },
    timeline(b, p) {
      b.className = 'pb timeline';
      sync(b, p.items, () => {
        const el = document.createElement('div');
        el.className = 'trow';
        el.innerHTML = '<span class="tl"></span><div class="track"><span class="bar"></span></div>';
        return el;
      }, (el, it) => {
        el.dataset.s = it.s || '';
        el.firstChild.textContent = it.label;
        const bar = el.lastChild.firstChild;
        bar.style.left = `${(it.start / p.total) * 100}%`;
        bar.style.width = `${(it.len / p.total) * 100}%`;
        bar.textContent = it.text || '';
      }, false);
    },
    graph(b, p) {
      b.className = 'pb graph';
      let svg = b.firstChild;
      if (!svg) {
        svg = document.createElementNS(SVG, 'svg');
        svg.append(document.createElementNS(SVG, 'g'), document.createElementNS(SVG, 'g'));
        b.appendChild(svg);
      }
      svg.setAttribute('viewBox', `0 0 ${p.w} ${p.h}`);
      svg.style.maxWidth = `${p.w * (p.scale || 1.25)}px`;
      const at = (n) => (p.pos ? p.pos[n.id] : n);
      const byId = new Map(p.nodes.map((n) => [n.id, n]));
      const half = (n) => [(n.w || 32) / 2, 14];
      sync(svg.children[0], p.edges.filter((e) => byId.has(e.a) && byId.has(e.b)).map((e) => ({ ...e, id: `${e.a}>${e.b}` })),
        () => document.createElementNS(SVG, 'path'),
        (el, e) => {
          const A = at(byId.get(e.a)), B = at(byId.get(e.b));
          const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy) || 1;
          const clip = (n) => { const [hw, hh] = half(n); return Math.min(hw / Math.abs(dx || 1e-9), hh / Math.abs(dy || 1e-9)) * len + 3; };
          const ux = dx / len, uy = dy / len, ca = clip(byId.get(e.a)), cb = clip(byId.get(e.b));
          const x1 = A.x + ux * ca, y1 = A.y + uy * ca, x2 = B.x - ux * cb, y2 = B.y - uy * cb;
          let d = `M${x1} ${y1}L${x2} ${y2}`;
          if (p.directed) {
            const s = 6;
            d += `M${x2 - ux * s - uy * s * 0.6} ${y2 - uy * s + ux * s * 0.6}L${x2} ${y2}L${x2 - ux * s + uy * s * 0.6} ${y2 - uy * s - ux * s * 0.6}`;
          }
          el.setAttribute('d', d);
          el.setAttribute('class', 'edge' + (el.classList.contains('enter') ? ' enter' : ''));
          el.dataset.s = e.s || '';
        }, false);
      sync(svg.children[1], p.nodes, () => {
        const g = document.createElementNS(SVG, 'g');
        g.append(document.createElementNS(SVG, 'rect'), document.createElementNS(SVG, 'text'), document.createElementNS(SVG, 'text'));
        g.setAttribute('class', 'node');
        return g;
      }, (g, n) => {
        const { x, y } = at(n), [hw, hh] = half(n);
        g.style.transform = `translate(${x}px,${y}px)`;
        g.dataset.s = n.s || '';
        const [r, t, sub] = g.children;
        r.setAttribute('x', -hw); r.setAttribute('y', -hh); r.setAttribute('width', hw * 2); r.setAttribute('height', hh * 2);
        r.setAttribute('rx', n.round ? hh : 6);
        t.textContent = n.v; t.setAttribute('y', 4);
        sub.textContent = n.sub || ''; sub.setAttribute('class', 'nsub' + (n.side ? ' side' : ''));
        sub.setAttribute('x', n.side ? hw + 4 : 0); sub.setAttribute('y', n.side ? 3 : hh + 12);
      }, false);
    },
  };

  function renderPanels(viz, panels) {
    panels.forEach((p, i) => {
      let el = viz.children[i];
      if (!el || el.dataset.type !== p.type) {
        const n = document.createElement('div');
        n.className = 'panel';
        n.dataset.type = p.type;
        n.innerHTML = '<div class="pt"></div><div class="pb"></div>';
        if (el) el.replaceWith(n); else viz.appendChild(n);
        el = n;
      }
      el.firstChild.textContent = p.title || '';
      el.classList.toggle('hot', !!p.hot);
      R[p.type](el.lastChild, p);
    });
    while (viz.children.length > panels.length) viz.lastChild.remove();
  }

  /* ---------- 레슨 로드 ---------- */
  function buildNav() {
    $('#nav').innerHTML = LEVELS.map(([key, name, desc]) => {
      const items = CS.lessons.filter((l) => l.level === key);
      return `<div class="group"><h2><span class="badge ${key}">${name}</span><small>${desc}</small></h2>${items.map((l) =>
        `<a href="#${l.id}" data-id="${l.id}"><span class="chk"></span>${esc(l.title)}</a>`).join('')}</div>`;
    }).join('');
    markNav();
  }
  function markNav() {
    for (const a of document.querySelectorAll('#nav a')) {
      a.classList.toggle('cur', !!state.lesson && a.dataset.id === state.lesson.id);
      a.classList.toggle('done', done.has(a.dataset.id));
    }
    $('#symlink').classList.toggle('cur', !state.lesson);
    const cur = $('#nav a.cur');
    if (cur) cur.scrollIntoView({ block: 'nearest' });
  }

  const CATS = [['slow', '느려진다'], ['hang', '멈춘다 · 타임아웃'], ['memory', '메모리가 늘어난다'], ['wrong', '값이 틀리다'], ['flaky', '가끔만 발생한다'], ['data', '데이터 중복 · 유실'], ['crash', '에러로 죽는다']];
  const lessonLink = (id) => { const l = CS.lessons.find((x) => x.id === id); return l ? `<a class="chip" href="#${id}">${esc(l.title)}</a>` : ''; };

  // 증상 사전: 디버깅 중 관찰한 현상 → 의심할 CS 개념 → 확인 방법 → 처방
  function loadSymptoms() {
    pause();
    state.lesson = null;
    document.body.classList.add('sym');
    document.body.classList.remove('nav-open');
    $('#level').textContent = '진단';
    $('#level').className = 'badge';
    $('#pos').textContent = `${Object.keys(CS.diagnose).length}개 항목`;
    $('#title').textContent = '증상으로 찾기';
    $('#summary').textContent = '디버깅하다 본 현상에서 출발합니다. 어떤 CS 개념의 문제인지, 무엇을 재 보면 확신할 수 있는지, 어느 방향으로 고쳐야 하는지를 정리했습니다.';
    document.title = '증상으로 찾기 — CS 보이는 코드';
    $('#param').hidden = true;
    const view = $('#symview');
    view.hidden = false;
    view.innerHTML = `
      <div class="box steps"><h3>원인을 좁히는 순서</h3><ol>${CS.method.map((m) => `<li><b>${m[0]}</b> ${m[1]}</li>`).join('')}</ol></div>
      <div class="box"><h3>1차 분류: 관찰한 것으로 영역 좁히기</h3>
        <div class="tri">${CS.triage.map((t) => `<div class="tri-row"><div><b>${t.see}</b></div><div>${t.suspect}</div><div class="chips">${t.lessons.map(lessonLink).join('')}</div></div>`).join('')}</div></div>
      <div class="symbar"><input id="symq" type="search" placeholder="현상을 검색해 보세요 (예: 타임아웃, 메모리, 중복, 느려)" aria-label="증상 검색">
        <div class="chips" id="symcats"><button type="button" class="chip on" data-c="">전체</button>${CATS.map(([k, n]) => `<button type="button" class="chip" data-c="${k}">${n}</button>`).join('')}</div></div>
      <div id="symlist"></div>`;
    let cat = '';
    const draw = () => {
      const q = $('#symq').value.trim().toLowerCase();
      const rows = CS.lessons.filter((l) => CS.diagnose[l.id]).map((l) => [l, CS.diagnose[l.id]]).filter(([l, d]) =>
        (!cat || d.cat.includes(cat)) && (!q || [l.title, d.concept, d.check, d.fix, ...d.symptoms].join(' ').toLowerCase().includes(q)));
      $('#symlist').innerHTML = rows.map(([l, d]) => `
        <article class="sym-card">
          <header><div class="chips">${d.cat.map((c) => `<span class="tag">${CATS.find((x) => x[0] === c)[1]}</span>`).join('')}</div><span class="badge ${l.level}">${LEVELS.find((x) => x[0] === l.level)[1]}</span></header>
          <ul class="sx">${d.symptoms.map((x) => `<li>${x}</li>`).join('')}</ul>
          <dl><dt>의심할 개념</dt><dd><b>${d.concept}</b></dd><dt>확인 방법</dt><dd>${d.check}</dd><dt>고치는 방향</dt><dd>${d.fix}</dd></dl>
          <a class="go" href="#${l.id}">애니메이션으로 보기: ${esc(l.title)} →</a>
        </article>`).join('') || '<p class="none">일치하는 항목이 없습니다. 다른 단어로 검색해 보세요.</p>';
    };
    $('#symq').oninput = draw;
    $('#symcats').onclick = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      cat = b.dataset.c;
      for (const x of $('#symcats').children) x.classList.toggle('on', x === b);
      draw();
    };
    draw();
    markNav();
    scrollTo(0, 0);
  }

  function load(id) {
    if (id === 'symptoms') return loadSymptoms();
    const lesson = CS.lessons.find((l) => l.id === id) || CS.lessons[0];
    pause();
    document.body.classList.remove('sym');
    $('#symview').hidden = true;
    state.lesson = lesson;
    state.n = lesson.param ? lesson.param.value : null;
    const lv = LEVELS.find((l) => l[0] === lesson.level);
    const i = CS.lessons.indexOf(lesson);
    $('#level').textContent = lv[1];
    $('#level').className = 'badge ' + lesson.level;
    $('#pos').textContent = `${i + 1} / ${CS.lessons.length}`;
    $('#title').textContent = lesson.title;
    $('#summary').textContent = lesson.summary;
    document.title = `${lesson.title} — CS 보이는 코드`;

    const pm = $('#param');
    pm.hidden = !lesson.param;
    if (lesson.param) {
      pm.firstChild.textContent = lesson.param.label;
      pm.lastChild.innerHTML = lesson.param.options.map((o) => `<option${o === state.n ? ' selected' : ''}>${o}</option>`).join('');
    }

    const dg = CS.diagnose[lesson.id];
    $('#learn').innerHTML = `
      ${dg ? `<div class="box dx"><h3>이런 현상을 봤다면 이 개념입니다</h3><ul class="sx">${dg.symptoms.map((x) => `<li>${x}</li>`).join('')}</ul>
        <dl><dt>확인 방법</dt><dd>${dg.check}</dd><dt>고치는 방향</dt><dd>${dg.fix}</dd></dl><a class="go" href="#symptoms">다른 증상 찾아보기 →</a></div>` : ''}
      <div class="box"><h3>핵심 정리</h3><ul>${lesson.points.map((p) => `<li>${p}</li>`).join('')}</ul></div>
      <div class="box senior"><h3>시니어의 시선</h3><p>${lesson.senior}</p></div>
      ${lesson.variants.some((v) => v.big) ? `<div class="box"><h3>복잡도 비교</h3><table><tr><th>방식</th><th>시간</th><th>공간</th></tr>${lesson.variants.map((v) =>
        `<tr><td>${esc(v.name)}</td><td><code>${v.big.time}</code></td><td><code>${v.big.space}</code></td></tr>`).join('')}</table></div>` : ''}`;

    const prev = CS.lessons[i - 1], next = CS.lessons[i + 1];
    $('#pager').innerHTML = (prev ? `<a href="#${prev.id}">← ${esc(prev.title)}</a>` : '<span></span>') +
      (next ? `<a href="#${next.id}" class="next">다음: ${esc(next.title)} →</a>` : '<span></span>');

    markNav();
    document.body.classList.remove('nav-open');
    build();
    scrollTo(0, 0);
  }

  // 현재 입력 크기로 모든 방식을 실행해 단계를 만들고 카드 DOM을 새로 짠다
  function build() {
    const { lesson } = state;
    state.runs = lesson.variants.map((v) => ({ v, steps: CS.trace(v, state.n) }));
    state.total = Math.max(...state.runs.map((r) => r.steps.length));
    state.maxHits = Math.max(1, ...state.runs.flatMap((r) => Object.values(r.steps[r.steps.length - 1].hits)));
    state.maxM = {};
    for (const r of state.runs)
      for (const [k, v] of Object.entries(r.steps[r.steps.length - 1].m))
        if (typeof v === 'number') state.maxM[k] = Math.max(state.maxM[k] || 0, v);

    const cards = $('#cards');
    cards.className = 'cards n' + state.runs.length;
    cards.innerHTML = '';
    for (const r of state.runs) {
      const card = document.createElement('article');
      card.className = 'card ' + (r.v.tone || 'info');
      card.innerHTML = `
        <header><span class="tone">${esc(r.v.label || TONE[r.v.tone || 'info'])}</span><h2>${esc(r.v.name)}</h2><span class="status"></span></header>
        <div class="code">${r.v.code.split('\n').map((line, i) =>
          `<div class="ln" data-l="${i + 1}"><span class="heat"></span><span class="no">${i + 1}</span><code>${hl(line) || ' '}</code>${
            r.v.notes && r.v.notes[i + 1] ? `<span class="note">${esc(r.v.notes[i + 1])}</span>` : ''}<span class="hits"></span></div>`).join('')}</div>
        <p class="msg"></p>
        <div class="viz"></div>
        <div class="metrics">${Object.keys(r.steps[r.steps.length - 1].m).map((k) =>
          `<div class="metric"><span class="mk">${esc(k)}</span><b class="mv"></b><span class="mbar"><i></i></span></div>`).join('')}</div>`;
      cards.appendChild(card);
      r.el = card;
      r.lines = [...card.querySelectorAll('.ln')];
    }
    state.idx = 0;
    $('#scrub').max = state.total - 1;
    render();
  }

  function render() {
    const { idx } = state;
    for (const r of state.runs) {
      const last = r.steps.length - 1, s = r.steps[Math.min(idx, last)], fin = idx >= last;
      for (const ln of r.lines) {
        const no = +ln.dataset.l, h = s.hits[no] || 0;
        ln.classList.toggle('on', s.line === no);
        ln.style.setProperty('--heat', h / state.maxHits);
        ln.lastChild.textContent = h ? `×${h}` : '';
      }
      $('.msg', r.el).innerHTML = s.msg;
      renderPanels($('.viz', r.el), s.panels);
      const keys = Object.keys(r.steps[last].m);
      [...r.el.querySelectorAll('.metric')].forEach((el, i) => {
        const v = s.m[keys[i]] ?? 0;
        el.children[1].textContent = fmt(v);
        const max = state.maxM[keys[i]];
        el.children[2].hidden = !max;
        if (max) el.children[2].firstChild.style.width = `${(v / max) * 100}%`;
      });
      r.el.classList.toggle('fin', fin);
      $('.status', r.el).textContent = fin ? `완료 · ${last + 1}단계` : `${Math.min(idx, last) + 1} / ${last + 1}단계`;
    }
    $('#scrub').value = idx;
    $('#scrub').style.setProperty('--p', `${(idx / Math.max(1, state.total - 1)) * 100}%`);
    $('#count').textContent = `${idx + 1} / ${state.total}`;
    const end = idx >= state.total - 1;
    $('#b-play').textContent = state.playing ? '❚❚ 정지' : end ? '↺ 다시 보기' : '▶ 재생';
    renderVerdict(end);
    if (end && !done.has(state.lesson.id)) {
      done.add(state.lesson.id);
      store.set('cs-done', [...done]);
      markNav();
    }
  }

  function renderVerdict(end) {
    const el = $('#verdict'), { lesson, runs } = state;
    el.hidden = !end;
    if (!end) return;
    const key = lesson.headline;
    const vals = key ? runs.map((r) => r.steps[r.steps.length - 1].m[key]) : [];
    let html = '';
    if (vals.length === 2) {
      const [hi, lo] = [Math.max(...vals), Math.min(...vals)];
      html += `<div class="vs"><span class="vk">${esc(key)}</span>${runs.map((r, i) =>
        `<span class="vv ${r.v.tone || ''}"><b>${fmt(vals[i])}</b>${esc(r.v.name)}</span>`).join('<span class="vsx">vs</span>')}${
        lo > 0 && hi > lo ? `<span class="ratio">${(hi / lo).toFixed(hi / lo >= 10 ? 0 : 1)}배 차이</span>` : ''}</div>`;
    }
    el.innerHTML = html + `<p>${lesson.verdict}</p>`;
  }

  /* ---------- 플레이어 ---------- */
  function go(i) {
    state.idx = Math.max(0, Math.min(state.total - 1, i));
    render();
  }
  function tick() {
    if (state.idx >= state.total - 1) return pause();
    go(state.idx + 1);
    state.timer = setTimeout(tick, 650 / state.speed);
  }
  function play() {
    if (state.idx >= state.total - 1) state.idx = 0;
    state.playing = true;
    render();
    clearTimeout(state.timer);
    state.timer = setTimeout(tick, 650 / state.speed);
  }
  function pause() {
    state.playing = false;
    clearTimeout(state.timer);
    if (state.lesson && state.runs.length) render();
  }
  const toggle = () => (state.playing ? pause() : play());

  $('#b-play').onclick = toggle;
  $('#b-prev').onclick = () => { pause(); go(state.idx - 1); };
  $('#b-next').onclick = () => { pause(); go(state.idx + 1); };
  $('#b-reset').onclick = () => { pause(); go(0); };
  $('#scrub').oninput = (e) => { const v = +e.target.value; pause(); go(v); };
  $('#speed').onchange = (e) => { state.speed = +e.target.value; };
  $('#param select').onchange = (e) => { pause(); state.n = +e.target.value; build(); };
  $('#menu').onclick = () => document.body.classList.toggle('nav-open');
  $('#scrim').onclick = () => document.body.classList.remove('nav-open');
  $('#theme').onclick = () => {
    const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    store.set('cs-theme', next);
  };
  addEventListener('keydown', (e) => {
    if (!state.lesson) return;
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) && e.target.type !== 'range') return;
    if (e.key === ' ') { e.preventDefault(); toggle(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); pause(); go(state.idx + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); pause(); go(state.idx - 1); }
    else if (e.key === 'Home') { e.preventDefault(); pause(); go(0); }
    else if (e.key === 'End') { e.preventDefault(); pause(); go(state.total - 1); }
  });
  addEventListener('hashchange', () => load(location.hash.slice(1)));

  const theme = store.get('cs-theme');
  if (theme) document.documentElement.dataset.theme = theme;
  CS.lessons.sort((a, b) => LEVELS.findIndex((l) => l[0] === a.level) - LEVELS.findIndex((l) => l[0] === b.level));
  buildNav();
  load(location.hash.slice(1));
})();
