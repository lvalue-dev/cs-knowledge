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

  const state = { lesson: null, n: null, runs: [], keys: [], idx: 0, total: 1, playing: false, speed: 1, timer: null, side: true, tab: 0 };

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
    const animate = flip && !reduced && !state.measuring;
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
    const dur = Math.min(320, 420 / state.speed);
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
      b.className = 'pb cells' + (p.bars ? ' bars' : '') + (p.tiny ? ' tiny' : p.items.length > 20 || p.compact ? ' compact' : '') + (p.cols ? ' grid' : '');
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
      svg.style.setProperty('--gmax', `${p.w * (p.scale || 1.25)}px`);
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
    $('#summary').className = '';
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
    state.tab = 0;
    const lv = LEVELS.find((l) => l[0] === lesson.level);
    const i = CS.lessons.indexOf(lesson);
    $('#level').textContent = lv[1];
    $('#level').className = 'badge ' + lesson.level;
    $('#pos').textContent = `${i + 1} / ${CS.lessons.length}`;
    $('#title').textContent = lesson.title;
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

  const textLen = (html) => html.replace(/<[^>]+>/g, '').length;
  const shown = () => (state.side ? state.runs : [state.runs[state.tab]]);
  const wantSide = () => {
    if (state.runs.length < 2 || innerWidth < 860) return false;
    const pref = store.get('cs-view');
    return pref ? pref === 'side' : innerWidth >= 1180 && innerHeight >= 760; // 작은 화면은 '하나씩'이 기본
  };

  // 현재 입력 크기로 모든 방식을 실행해 단계를 만들고 카드·점수판 DOM을 새로 짠다
  function build() {
    const { lesson } = state;
    state.runs = lesson.variants.map((v) => ({ v, steps: CS.trace(v, state.n) }));
    state.maxHits = Math.max(1, ...state.runs.flatMap((r) => Object.values(r.steps[r.steps.length - 1].hits)));
    state.maxM = {};
    state.keys = [];
    for (const r of state.runs)
      for (const [k, v] of Object.entries(r.steps[r.steps.length - 1].m)) {
        if (!state.keys.includes(k)) state.keys.push(k);
        if (typeof v === 'number') state.maxM[k] = Math.max(state.maxM[k] || 0, v);
      }

    const cards = $('#cards');
    cards.innerHTML = '';
    for (const r of state.runs) {
      const card = document.createElement('article');
      card.className = 'card ' + (r.v.tone || 'info');
      card.innerHTML = `
        <header><span class="tone">${esc(r.v.label || TONE[r.v.tone || 'info'])}</span><h2>${esc(r.v.name)}</h2><span class="status"></span></header>
        <div class="body">
          <div class="left">
            <div class="code">${r.v.code.split('\n').map((line, i) =>
              `<div class="ln" data-l="${i + 1}"><span class="heat"></span><span class="no">${i + 1}</span><code>${hl(line) || ' '}</code>${
                r.v.notes && r.v.notes[i + 1] ? `<span class="note">${esc(r.v.notes[i + 1])}</span>` : ''}<span class="hits"></span></div>`).join('')}</div>
            <p class="msg"></p>
          </div>
          <div class="viz"><div class="viz-in"></div></div>
        </div>`;
      cards.appendChild(card);
      r.el = card;
      r.lines = [...card.querySelectorAll('.ln')];
      r.codeEl = $('.code', card);
      r.msgEl = $('.msg', card);
      r.vizEl = $('.viz-in', card);
    }

    // 점수판: 모든 방식의 지표를 같은 눈금으로 한 줄에 놓아 비교한다
    const tone = (r) => r.v.tone || 'info';
    $('#score').style.setProperty('--cols', state.runs.length);
    $('#score').innerHTML = state.keys.length ? `
      <div class="sc-r sc-h"><span></span>${state.runs.map((r) => `<span class="sc-n ${tone(r)}"><i></i>${esc(r.v.name)}<em></em></span>`).join('')}</div>
      ${state.keys.map((k) => `<div class="sc-r"><span class="sc-k">${esc(k)}<b class="ratio" hidden></b></span>${state.runs.map((r) =>
        `<span class="sc-c ${tone(r)}"><span class="mbar"><i></i></span><b></b></span>`).join('')}</div>`).join('')}` : '';
    $('#tabs').innerHTML = state.runs.map((r, i) => `<button type="button" class="tab ${tone(r)}" data-i="${i}"><span class="tone">${esc(r.v.label || TONE[tone(r)])}</span>${esc(r.v.name)}</button>`).join('');
    layout(true);
  }

  // 보기 방식(나란히 / 하나씩)에 맞춰 보이는 카드와 전체 단계 수를 정한다
  function layout(reset) {
    state.side = wantSide();
    const multi = state.runs.length > 1;
    $('#viewmode').hidden = !multi || innerWidth < 860;
    for (const b of $('#viewmode').children) b.classList.toggle('on', (b.dataset.m === 'side') === state.side);
    $('#tabs').hidden = !multi || state.side;
    [...$('#tabs').children].forEach((b, i) => b.classList.toggle('on', i === state.tab));
    $('#cards').className = 'cards ' + (state.side ? 'side' : 'one');
    state.runs.forEach((r, i) => { r.el.hidden = !state.side && i !== state.tab; });
    state.total = Math.max(...shown().map((r) => r.steps.length));
    state.idx = reset ? 0 : Math.min(state.idx, state.total - 1);
    $('#scrub').max = state.total - 1;
    render();
    fitViz();
  }

  // 한 화면 안에서 코드와 그림이 차지할 높이를 나누고, 그래도 넘치면 그림을 축소한다.
  // 단계마다 크기가 흔들리지 않게, 여러 시점을 미리 그려 가장 큰 높이를 기준으로 레슨당 한 번만 계산한다.
  function fitViz() {
    state.measuring = true;
    let minZoom = 1;
    for (const r of state.runs) {
      const inner = r.vizEl, box = inner.parentNode, left = r.codeEl.parentNode, body = left.parentNode;
      inner.style.zoom = ''; box.style.flex = ''; left.style.flex = ''; inner.style.removeProperty('--w');
      r.el.classList.remove('scrolls');
      if (r.el.hidden || getComputedStyle(box).overflowY === 'visible') continue; // 좁은 화면: 카드가 자연 높이라 맞출 필요 없음
      const last = r.steps.length - 1;
      const need = (z) => {
        inner.style.zoom = z === 1 ? '' : z;
        let h = 0;
        for (const f of [0, 0.25, 0.5, 0.75, 1]) { renderPanels(inner, r.steps[Math.round(last * f)].panels); h = Math.max(h, inner.getBoundingClientRect().height); }
        return h;
      };
      const cs = getComputedStyle(box), pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      inner.style.setProperty('--w', `${inner.clientWidth}px`);
      const full = need(1);
      if (getComputedStyle(body).flexDirection !== 'row') {
        // 위아래 배치: 둘 다 들어가면 남는 높이는 그림에. 모자라면 그림을 조금 줄이고, 그래도 모자라면
        // 코드를 최소 6줄 남기고 스크롤시킨다(실행 줄을 따라감)
        const bodyH = body.clientHeight, msgH = r.msgEl.offsetHeight, codeH = r.codeEl.scrollHeight + 2;
        const soft = full * 0.8 + pad; // 그림은 80%까지는 줄여도 읽기에 무리가 없다
        const vizH = soft + msgH + codeH <= bodyH ? bodyH - msgH - codeH
          : Math.max(bodyH * 0.38, Math.min(soft, bodyH - msgH - Math.min(codeH, 132)));
        box.style.flex = `0 0 ${vizH}px`;
        left.style.flex = '1 1 0';
      }
      const avail = box.clientHeight - pad;
      if (full > avail + 1) {
        let lo = 0.55, hi = 1;
        if (need(lo) <= avail + 1) for (let k = 0; k < 6; k++) { const mid = (lo + hi) / 2; if (need(mid) <= avail + 1) lo = mid; else hi = mid; }
        if (need(lo) > avail + 1) r.el.classList.add('scrolls');
        minZoom = Math.min(minZoom, lo);
      }
    }
    state.measuring = false;
    // 그림이 많이 줄었고 목차가 펼쳐져 있으면, 목차를 접어 넓게 볼 수 있다고 알려 준다
    $('#tip').hidden = !(minZoom < 0.75 && state.side && !document.body.classList.contains('nav-off'));
    render();
  }

  function render() {
    const { idx, lesson } = state;
    const end = idx >= state.total - 1;
    state.runs.forEach((r, i) => {
      if (r.el.hidden) return;
      const last = r.steps.length - 1, s = r.steps[Math.min(idx, last)], fin = idx >= last;
      let on = null;
      for (const ln of r.lines) {
        const no = +ln.dataset.l, h = s.hits[no] || 0;
        ln.classList.toggle('on', s.line === no);
        if (s.line === no) on = ln;
        ln.style.setProperty('--heat', h / state.maxHits);
        ln.lastChild.textContent = h ? `×${h}` : '';
      }
      // 실행 중인 줄이 코드 창 밖에 있으면 창 안으로 스크롤한다 (페이지는 움직이지 않게)
      const box = r.codeEl;
      if (on && (on.offsetTop < box.scrollTop || on.offsetTop + on.offsetHeight > box.scrollTop + box.clientHeight))
        box.scrollTop = on.offsetTop - box.clientHeight / 2;
      if (r.msgEl.dataset.h !== s.msg) {
        r.msgEl.dataset.h = s.msg;
        r.msgEl.innerHTML = s.msg;
        r.msgEl.scrollTop = 0;
        r.msgEl.classList.remove('flash');
        void r.msgEl.offsetWidth;
        r.msgEl.classList.add('flash');
      }
      renderPanels(r.vizEl, s.panels);
      r.el.classList.toggle('fin', fin && state.side && !end);
      $('.status', r.el).textContent = fin ? `완료 · ${last + 1}단계` : `${Math.min(idx, last) + 1} / ${last + 1}단계`;
    });

    // 점수판. "하나씩" 보기에서는 보이지 않는 방식의 최종 결과를 기준선으로 보여 준다
    const rows = [...document.querySelectorAll('#score .sc-r')];
    if (rows.length) {
      state.runs.forEach((r, i) => { rows[0].children[i + 1].lastChild.textContent = state.side || i === state.tab ? '' : ' · 최종 결과'; });
      state.keys.forEach((k, ki) => {
        const cells = rows[ki + 1].children;
        state.runs.forEach((r, i) => {
          const last = r.steps.length - 1, live = state.side || i === state.tab;
          const v = r.steps[live ? Math.min(idx, last) : last].m[k];
          const cell = cells[i + 1], max = state.maxM[k];
          cell.classList.toggle('ref', !live);
          cell.lastChild.textContent = v === undefined ? '–' : fmt(v);
          cell.firstChild.style.visibility = max && typeof v === 'number' ? '' : 'hidden';
          if (max && typeof v === 'number') cell.firstChild.firstChild.style.width = `${(v / max) * 100}%`;
        });
        const chip = cells[0].lastChild;
        const vals = state.runs.map((r) => r.steps[r.steps.length - 1].m[k]);
        const hi = Math.max(...vals), lo = Math.min(...vals);
        chip.hidden = !(end && k === lesson.headline && vals.length === 2 && lo > 0 && hi > lo);
        if (!chip.hidden) chip.textContent = `${(hi / lo).toFixed(hi / lo >= 10 ? 0 : 1)}배 차이`;
      });
    }

    // 머리말 자리: 진행 중에는 소개, 끝나면 결론
    const sum = $('#summary');
    sum.classList.toggle('verdict', end);
    if (end) sum.innerHTML = `<b>결론</b> ${lesson.verdict}`; else sum.textContent = lesson.summary;

    $('#scrub').value = idx;
    $('#count').textContent = `${idx + 1} / ${state.total}`;
    $('#b-play').textContent = state.playing ? '❚❚ 정지' : end ? '↺ 처음부터' : '▶ 자동 재생';
    $('#b-prev').disabled = idx === 0;
    $('#b-next').disabled = end;
    if (end && !done.has(lesson.id)) {
      done.add(lesson.id);
      store.set('cs-done', [...done]);
      markNav();
    }
  }

  /* ---------- 플레이어 ---------- */
  const tbar = $('#tbar');
  const barStop = () => { tbar.style.transition = 'none'; tbar.style.width = '0'; };
  function barStart(ms) {
    barStop();
    void tbar.offsetWidth;
    tbar.style.transition = `width ${ms}ms linear`;
    tbar.style.width = '100%';
  }
  // 지금 화면에 새로 나온 설명의 글자 수만큼 기다린다. 글이 길면 오래, 짧으면 금방 넘어간다
  function readTime() {
    let chars = 0;
    for (const r of shown()) if (state.idx < r.steps.length) chars += textLen(r.steps[state.idx].msg);
    return Math.min(10000, Math.max(900, 500 + chars * 48)) / state.speed;
  }
  function go(i) {
    state.idx = Math.max(0, Math.min(state.total - 1, i));
    render();
  }
  function schedule() {
    clearTimeout(state.timer);
    const ms = readTime();
    barStart(ms);
    state.timer = setTimeout(() => {
      go(state.idx + 1);
      if (state.idx >= state.total - 1) pause(); else schedule();
    }, ms);
  }
  function play() {
    if (state.idx >= state.total - 1) state.idx = 0;
    state.playing = true;
    render();
    schedule();
  }
  function pause() {
    state.playing = false;
    clearTimeout(state.timer);
    barStop();
    if (state.lesson && state.runs.length) render();
  }
  const toggle = () => (state.playing ? pause() : play());

  $('#b-play').onclick = toggle;
  $('#b-prev').onclick = () => { pause(); go(state.idx - 1); };
  $('#b-next').onclick = () => { pause(); go(state.idx + 1); };
  $('#b-reset').onclick = () => { pause(); go(0); };
  $('#scrub').oninput = (e) => { const v = +e.target.value; pause(); go(v); };
  $('#speed').onchange = (e) => { state.speed = +e.target.value; store.set('cs-speed', state.speed); if (state.playing) schedule(); };
  $('#viewmode').onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    pause();
    store.set('cs-view', b.dataset.m);
    layout(false);
  };
  $('#tabs').onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    pause();
    state.tab = +b.dataset.i;
    layout(true);
  };
  $('#tolearn').onclick = (e) => { e.preventDefault(); $('#learn').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' }); };
  let rz;
  addEventListener('resize', () => {
    clearTimeout(rz);
    rz = setTimeout(() => {
      if (!state.lesson) return;
      if (wantSide() !== state.side) { pause(); layout(false); } else fitViz();
    }, 150);
  });
  $('#param select').onchange = (e) => { pause(); state.n = +e.target.value; build(); };
  $('#tip').onclick = () => $('#menu').click();
  $('#menu').onclick = () => {
    if (innerWidth <= 860) return document.body.classList.toggle('nav-open');
    store.set('cs-nav-off', document.body.classList.toggle('nav-off')); // 넓은 화면: 목차를 접어 무대를 넓힌다
    if (state.lesson) fitViz();
  };
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

  if (store.get('cs-nav-off')) document.body.classList.add('nav-off');
  const sp = store.get('cs-speed');
  if (sp && $(`#speed option[value="${sp}"]`)) { state.speed = sp; $('#speed').value = sp; }
  const theme = store.get('cs-theme');
  if (theme) document.documentElement.dataset.theme = theme;
  CS.lessons.sort((a, b) => LEVELS.findIndex((l) => l[0] === a.level) - LEVELS.findIndex((l) => l[0] === b.level));
  buildNav();
  load(location.hash.slice(1));
})();
