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

  const ic = (d) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  const IC = {
    menu: ic('<path d="M4 6h16M4 12h16M4 18h16"/>'),
    search: ic('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
    theme: ic('<path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z"/>'),
    down: ic('<path d="M12 5v14M6 13l6 6 6-6"/>'),
    first: ic('<path d="M6 5v14M19 6l-9 6 9 6z"/>'),
    prev: ic('<path d="m15 6-6 6 6 6"/>'),
    next: ic('<path d="m9 6 6 6-6 6"/>'),
    play: ic('<path d="M7 5l12 7-12 7z" fill="currentColor"/>'),
    pause: ic('<path d="M8 5v14M16 5v14"/>'),
    replay: ic('<path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v5h5"/>'),
    pulse: ic('<path d="M3 12h4l2.5-6 4 12 2.5-6h5"/>'),
    cap: ic('<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11.5V16c0 1.2 2.7 2.5 6 2.5s6-1.3 6-2.5v-4.5M22 9v5"/>'),
    chev: ic('<path d="m6 9 6 6 6-6"/>'),
    gauge: ic('<path d="M4 16a8 8 0 1 1 16 0"/><path d="m12 16 4-5"/>'),
    keyboard: ic('<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M6.5 10h.01M10 10h.01M14 10h.01M17.5 10h.01M7 14h10"/>'),
    // 분야 아이콘
    algo: ic('<circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M6 8.5v7M8.5 6H14a4 4 0 0 1 4 4v5.5"/>'),
    ds: ic('<rect x="9" y="3" width="6" height="5" rx="1.2"/><rect x="3" y="16" width="6" height="5" rx="1.2"/><rect x="15" y="16" width="6" height="5" rx="1.2"/><path d="M12 8v4M6 16v-2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2"/>'),
    lang: ic('<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="m7 10 3 2.5L7 15M13 15h4"/>'),
    net: ic('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'),
    db: ic('<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>'),
    mem: ic('<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>'),
    conc: ic('<path d="M4 7h14M15 4l3 3-3 3M20 17H6M9 14l-3 3 3 3"/>'),
    dist: ic('<circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="18" r="2.5"/><circle cx="19" cy="18" r="2.5"/><path d="M10.8 7.2 6.3 15.8M13.2 7.2l4.5 8.6M7.5 18h9"/>'),
    ai: ic('<path d="M11 3l1.9 5.1L18 10l-5.1 1.9L11 17l-1.9-5.1L4 10l5.1-1.9z"/><path d="M18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>'),
  };
  for (const el of document.querySelectorAll('[data-ic]')) el.outerHTML = IC[el.dataset.ic];
  const EASE = 'cubic-bezier(.22,1,.36,1)';

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

  /* ---------- 키 기반 DOM 동기화 + 이동/등장/퇴장 애니메이션 ----------
     - 자리를 옮긴 요소는 이전 위치에서 새 위치로 미끄러진다(FLIP). 좌우로 엇갈리는 교환은 호를 그리며 비켜 간다.
     - 사라지는 요소는 제자리에서 줄어들며 사라진다.
     위치는 offsetLeft/Top(레이아웃 좌표)으로 재서 그림이 축소(zoom)되어 있어도 어긋나지 않는다. */
  function sync(parent, items, make, upd, flip = true, onEnter) {
    const old = new Map(), first = new Map();
    const svg = parent instanceof SVGElement;
    const animate = !reduced && !state.measuring;
    for (const el of [...parent.children]) if (!el.dataset.leaving) old.set(el.dataset.k, el);
    if (animate && !svg) old.forEach((el, k) => first.set(k, [el.offsetLeft, el.offsetTop, el.offsetWidth, el.offsetHeight]));
    let prev = null;
    for (const it of items) {
      const k = String(it.id);
      let el = old.get(k);
      if (el) old.delete(k);
      else {
        el = make(it);
        el.dataset.k = k;
        el._new = true;
        if (!svg) {
          el.classList.add('enter');
          el.addEventListener('animationend', () => el.classList.remove('enter'), { once: true });
        }
      }
      upd(el, it);
      const want = prev ? prev.nextSibling : parent.firstChild;
      if (el !== want) parent.insertBefore(el, want);
      if (el._new) { el._new = false; if (animate && onEnter) onEnter(el, it); }
      prev = el;
    }
    const dur = Math.max(180, Math.min(460, 520 / state.speed));
    old.forEach((el, k) => {
      const f = first.get(k);
      if (!animate || (!svg && !f)) return el.remove();
      el.dataset.leaving = '1';
      delete el.dataset.k;
      parent.appendChild(el); // 남은 요소들의 순서 계산에 끼어들지 않게 맨 뒤로
      if (!svg) Object.assign(el.style, { position: 'absolute', left: `${f[0]}px`, top: `${f[1]}px`, width: `${f[2]}px`, height: `${f[3]}px`, margin: 0, pointerEvents: 'none' });
      el.animate(svg ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.55)' }], { duration: dur * 0.6, easing: 'ease-in', fill: 'forwards' }).onfinish = () => el.remove();
    });
    if (!animate || !flip || svg) return;
    for (const el of parent.children) {
      const f = first.get(el.dataset.k);
      if (!f) continue;
      const dx = f[0] - el.offsetLeft, dy = f[1] - el.offsetTop;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
      // 좌우 이동이면 가운데에서 살짝 떠올랐다(오른쪽으로 갈 때) 가라앉는(왼쪽으로 갈 때) 호를 그린다
      const lift = Math.abs(dy) < 2 && Math.abs(dx) > 8 ? Math.min(16, Math.abs(dx) * 0.3) * (dx < 0 ? -1 : 1) : 0;
      el.animate([
        { transform: `translate(${dx}px,${dy}px)`, zIndex: 2 },
        ...(lift ? [{ transform: `translate(${dx / 2}px,${lift}px)`, zIndex: 2 }] : []),
        { transform: 'none', zIndex: 2 },
      ], { duration: dur, easing: EASE });
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
    const v = String(it.v ?? ''), vEl = el.children[1];
    if (vEl.textContent !== v) {
      const had = vEl.textContent !== '' && !el.classList.contains('enter');
      vEl.textContent = v;
      // 값이 바뀌면 숫자가 위에서 굴러 내려온다
      if (had && !reduced && !state.measuring) vEl.animate([{ transform: 'translateY(-70%)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 300, easing: EASE });
    }
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
      const half = (n) => [(n.w || 32) / 2, (n.h || 28) / 2];
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
          el.setAttribute('class', 'edge');
          el.dataset.s = e.s || '';
        }, false, (el) => { // 새 간선은 출발점에서 도착점으로 그려진다
          const L = el.getTotalLength();
          el.animate([{ strokeDasharray: `${L} ${L}`, strokeDashoffset: L }, { strokeDasharray: `${L} ${L}`, strokeDashoffset: 0 }], { duration: 460, easing: EASE });
        });
      sync(svg.children[1], p.nodes, () => {
        const g = document.createElementNS(SVG, 'g');
        g.append(document.createElementNS(SVG, 'rect'), document.createElementNS(SVG, 'text'), document.createElementNS(SVG, 'text'));
        g.setAttribute('class', 'node');
        return g;
      }, (g, n) => {
        const { x, y } = at(n), [hw, hh] = half(n);
        g.style.transform = `translate(${x}px,${y}px)`;
        g.dataset.s = n.s || '';
        g.classList.toggle('bare', !!n.bare);
        const [r, t, sub] = g.children;
        r.setAttribute('x', -hw); r.setAttribute('y', -hh); r.setAttribute('width', hw * 2); r.setAttribute('height', hh * 2);
        r.setAttribute('rx', n.round ? hh : 6);
        t.textContent = n.v; t.setAttribute('y', 4);
        sub.textContent = n.sub || ''; sub.setAttribute('class', 'nsub' + (n.side ? ' side' : ''));
        sub.setAttribute('x', n.side ? hw + 4 : 0); sub.setAttribute('y', n.side ? 3 : hh + 12);
      }, false, (g, n) => { // 새 노드는 제자리에서 튀어나온다
        const { x, y } = at(n), t = `translate(${x}px,${y}px)`;
        g.animate([{ transform: `${t} scale(.3)`, opacity: 0 }, { transform: `${t} scale(1.12)`, opacity: 1, offset: 0.6 }, { transform: `${t} scale(1)`, opacity: 1 }], { duration: 440, easing: EASE });
      });
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
  const CHK = '<svg class="chk" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5"/><path d="M5 8.3l2.1 2.1L11 6.2"/></svg>';
  // 왼쪽 목차: 분야별 아코디언. 난이도 필터를 걸면 해당 단계만 남기고 전부 펼친다
  let openCats = new Set(store.get('cs-cats', []));
  function buildNav() {
    const lv = store.get('cs-lv', '');
    for (const b of $('#lvfilter').children) b.classList.toggle('on', b.dataset.l === lv);
    const lvName = (l) => LEVELS.find((x) => x[0] === l.level)[1];
    $('#nav').innerHTML = CS.topics.map(([key, name, desc]) => {
      const items = CS.lessons.filter((l) => CS.topicOf[l.id] === key && (!lv || l.level === lv));
      return items.length ? `<section class="cat" data-t="${key}">
        <button type="button" class="cat-h"><span class="cat-ic">${IC[key]}</span><span class="cat-t"><b>${name}</b><small>${desc}</small></span><span class="cnt"></span>${IC.chev}</button>
        <div class="lvbar"><i></i></div>
        <div class="cat-b"><div>${items.map((l) => `<a href="#${l.id}" data-id="${l.id}">${CHK}<span>${esc(l.title)}</span><i class="lv ${l.level}" title="${lvName(l)}"></i></a>`).join('')}</div></div>
      </section>` : '';
    }).join('') || '<p class="none">이 단계의 레슨이 없습니다.</p>';
    markNav();
  }
  function markNav() {
    const lv = store.get('cs-lv', '');
    for (const a of document.querySelectorAll('#nav a')) {
      a.classList.toggle('cur', !!state.lesson && a.dataset.id === state.lesson.id);
      a.classList.toggle('done', done.has(a.dataset.id));
    }
    const cats = [...document.querySelectorAll('#nav .cat')];
    for (const g of cats) {
      const all = g.querySelectorAll('a').length, n = g.querySelectorAll('a.done').length;
      $('.cnt', g).textContent = `${n}/${all}`;
      $('.lvbar i', g).style.width = `${(n / all) * 100}%`;
      const open = !!lv || openCats.has(g.dataset.t);
      g.classList.toggle('open', open);
      g.classList.toggle('has-cur', !!$('a.cur', g));
      $('.cat-h', g).setAttribute('aria-expanded', open);
    }
    $('#expand').hidden = !!lv;
    $('#expand').textContent = cats.every((g) => g.classList.contains('open')) ? '모두 접기' : '모두 펼치기';
    const total = CS.lessons.length, n = CS.lessons.filter((l) => done.has(l.id)).length;
    $('#prog b').textContent = `${n} / ${total}`;
    $('#prog .lvbar i').style.width = `${(n / total) * 100}%`;
    $('#symlink').classList.toggle('cur', state.page === 'symptoms');
    $('#preplink').classList.toggle('cur', state.page === 'prep');
  }
  const saveCats = () => store.set('cs-cats', [...openCats]);
  $('#nav').addEventListener('click', (e) => {
    const h = e.target.closest('.cat-h');
    if (!h || store.get('cs-lv', '')) return;
    const t = h.parentNode.dataset.t;
    if (openCats.has(t)) openCats.delete(t); else openCats.add(t);
    saveCats(); markNav();
  });
  $('#expand').onclick = () => {
    const all = CS.topics.map((t) => t[0]);
    openCats = new Set(all.every((t) => openCats.has(t)) ? [] : all);
    saveCats(); markNav();
  };
  $('#lvfilter').onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    store.set('cs-lv', b.dataset.l);
    buildNav();
  };

  const CATS = [['slow', '느려진다'], ['hang', '멈춘다 · 타임아웃'], ['memory', '메모리가 늘어난다'], ['wrong', '값이 틀리다'], ['flaky', '가끔만 발생한다'], ['data', '데이터 중복 · 유실'], ['crash', '에러로 죽는다']];
  const lessonLink = (id) => { const l = CS.lessons.find((x) => x.id === id); return l ? `<a class="chip" href="#${id}">${esc(l.title)}</a>` : ''; };

  // 증상 사전: 디버깅 중 관찰한 현상 → 의심할 CS 개념 → 확인 방법 → 처방
  // 레슨이 아닌 페이지(증상 사전, 면접·코테 대비)의 공통 틀
  function openPage(page, badge, title, count, summary) {
    pause();
    state.lesson = null;
    state.page = page;
    document.body.classList.add('sym');
    document.body.classList.remove('nav-open');
    $('#level').textContent = badge;
    $('#level').className = 'badge';
    $('#pos').textContent = count;
    $('#title').textContent = $('#title').title = title;
    $('#summary').className = '';
    $('#summary').textContent = summary;
    document.title = `${title} — CS 보이는 코드`;
    $('#param').hidden = true;
    const view = $('#symview');
    view.hidden = false;
    return view;
  }
  const topicName = (id) => (CS.topics.find((t) => t[0] === CS.topicOf[id]) || [])[1] || '';
  const levelBadge = (l) => `<span class="badge ${l.level}">${LEVELS.find((x) => x[0] === l.level)[1]}</span>`;

  /* ---------- 면접 질문: 떠올려 보고 → 답을 펼치고 → 스스로 채점 ---------- */
  let known = new Set(store.get('cs-known', []));
  const qaHTML = (id) => (CS.qa[id] || []).map(([q, a], i) => `
    <details class="qa${known.has(`${id}:${i}`) ? ' known' : ''}" data-k="${id}:${i}">
      <summary><span class="qm">Q</span><span>${q}</span></summary>
      <div class="qa-a"><p>${a}</p><button type="button" class="know">${known.has(`${id}:${i}`) ? '✓ 답할 수 있음' : '막힘 없이 답할 수 있었다'}</button></div>
    </details>`).join('');
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.know');
    if (!b) return;
    const d = b.closest('.qa'), k = d.dataset.k;
    if (known.has(k)) known.delete(k); else known.add(k);
    store.set('cs-known', [...known]);
    for (const el of document.querySelectorAll(`.qa[data-k="${k}"]`)) {
      el.classList.toggle('known', known.has(k));
      $('.know', el).textContent = known.has(k) ? '✓ 답할 수 있음' : '막힘 없이 답할 수 있었다';
    }
    const pc = $('#qa-prog');
    if (pc) pc.textContent = `${known.size} / ${Object.values(CS.qa).reduce((n, x) => n + x.length, 0)} 답할 수 있음`;
  });

  function loadPrep() {
    const total = Object.values(CS.qa).reduce((n, x) => n + x.length, 0);
    const view = openPage('prep', '대비', '면접 · 코테 대비', `질문 ${total}개`,
      '코딩 테스트는 "문제에서 유형을 알아보는 눈"이, 면접은 "왜 그런지 자기 말로 설명하는 힘"이 필요합니다. 표로 유형을 고르고, 질문은 답을 가린 채 먼저 말해 본 뒤 펼쳐 보세요.');
    view.innerHTML = `
      <div class="box"><h3>코딩 테스트 ① 입력 크기로 허용 복잡도 가늠하기</h3>
        <table><tr><th>입력 크기 n</th><th>통과 가능한 복잡도</th><th>떠올릴 방법</th></tr>${CS.sizes.map((r) => `<tr><td><code>${r[0]}</code></td><td><code>${r[1]}</code></td><td>${r[2]}</td></tr>`).join('')}</table>
        <p class="fineprint">1초에 단순 연산 약 1억 번을 기준으로 한 어림값입니다. 제한 시간과 언어에 따라 달라집니다.</p></div>
      <div class="box"><h3>코딩 테스트 ② 문제 문장의 신호로 유형 고르기</h3>
        <div class="tri">${CS.lessons.filter((l) => CS.ct[l.id]).map((l) => { const c = CS.ct[l.id]; return `<div class="tri-row"><div><b>${c.signal}</b></div><div>${c.how} <code>${c.big}</code></div><div class="chips">${lessonLink(l.id)}</div></div>`; }).join('')}</div></div>
      <div class="symbar"><input id="symq" type="search" placeholder="질문 검색 (예: 인덱스, TCP, 캐시, 토큰)" aria-label="질문 검색">
        <div class="chips" id="symcats"><button type="button" class="chip on" data-c="">전체</button>${CS.topics.map(([k, n]) => `<button type="button" class="chip" data-c="${k}">${n}</button>`).join('')}</div>
        <div class="qa-tools"><button type="button" id="qa-rand" class="ghost">${IC.replay}아직 못 푼 질문 하나 뽑기</button><label><input type="checkbox" id="qa-todo"> 못 푼 질문만</label><span id="qa-prog">${known.size} / ${total} 답할 수 있음</span></div></div>
      <div id="symlist"></div>`;
    let cat = '';
    const draw = () => {
      const q = $('#symq').value.trim().toLowerCase(), todo = $('#qa-todo').checked;
      const rows = CS.lessons.filter((l) => CS.qa[l.id] && (!cat || CS.topicOf[l.id] === cat)).map((l) => {
        const items = CS.qa[l.id].map((x, i) => [x, i]).filter(([x, i]) => (!q || (l.title + x[0] + x[1]).toLowerCase().includes(q)) && (!todo || !known.has(`${l.id}:${i}`)));
        if (!items.length) return '';
        const all = qaHTML(l.id).split('</details>').filter((h) => h.trim()).map((h) => h + '</details>');
        return `<article class="sym-card"><header><div class="chips"><span class="tag">${topicName(l.id)}</span></div>${levelBadge(l)}</header>
          ${items.map(([, i]) => all[i]).join('')}
          <a class="go" href="#${l.id}">애니메이션으로 복습: ${esc(l.title)} →</a></article>`;
      }).join('');
      $('#symlist').innerHTML = rows || '<p class="none">일치하는 질문이 없습니다.</p>';
    };
    $('#symq').oninput = draw;
    $('#qa-todo').onchange = draw;
    $('#symcats').onclick = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      cat = b.dataset.c;
      for (const x of $('#symcats').children) x.classList.toggle('on', x === b);
      draw();
    };
    $('#qa-rand').onclick = () => {
      const pool = [...document.querySelectorAll('#symlist .qa:not(.known)')];
      const pick = pool[Math.floor(Math.random() * pool.length)];
      if (!pick) return;
      for (const d of document.querySelectorAll('#symlist .qa.pick')) d.classList.remove('pick');
      pick.classList.add('pick');
      pick.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
    };
    draw();
    markNav();
    scrollTo(0, 0);
  }

  function loadSymptoms() {
    const view = openPage('symptoms', '진단', '증상으로 찾기', `${Object.keys(CS.diagnose).length}개 항목`,
      '디버깅하다 본 현상에서 출발합니다. 어떤 CS 개념의 문제인지, 무엇을 재 보면 확신할 수 있는지, 어느 방향으로 고쳐야 하는지를 정리했습니다.');
    view.innerHTML = `
      <div class="box steps"><h3>원인을 좁히는 순서</h3><ol>${CS.method.map((m) => `<li><span><b>${m[0]}</b> ${m[1]}</span></li>`).join('')}</ol></div>
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
    if (id === 'prep') return loadPrep();
    state.page = null;
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
    $('#pos').textContent = `${topicName(lesson.id)} · ${i + 1} / ${CS.lessons.length}`;
    $('#title').textContent = $('#title').title = lesson.title;
    document.title = `${lesson.title} — CS 보이는 코드`;

    const pm = $('#param');
    pm.hidden = !lesson.param;
    if (lesson.param) {
      pm.firstChild.textContent = lesson.param.label;
      pm.lastChild.innerHTML = lesson.param.options.map((o) => `<option${o === state.n ? ' selected' : ''}>${o}</option>`).join('');
    }

    const dg = CS.diagnose[lesson.id], ct = CS.ct[lesson.id], qa = CS.qa[lesson.id];
    $('#learn').innerHTML = `
      ${dg ? `<div class="box dx"><h3>이런 현상을 봤다면 이 개념입니다</h3><ul class="sx">${dg.symptoms.map((x) => `<li>${x}</li>`).join('')}</ul>
        <dl><dt>확인 방법</dt><dd>${dg.check}</dd><dt>고치는 방향</dt><dd>${dg.fix}</dd></dl><a class="go" href="#symptoms">다른 증상 찾아보기 →</a></div>` : ''}
      ${lesson.story ? `<div class="box story"><h3>비유로 다시 보기</h3><p>${lesson.story.scene}</p>
        <table><tr><th>이야기 속에서는</th><th>실제 용어로는</th></tr>${lesson.story.map.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</table>
        <p class="fineprint"><b>비유가 맞지 않는 부분</b> — ${lesson.story.limit}</p></div>` : ''}
      ${ct ? `<div class="box ct"><h3>코딩 테스트에서</h3><dl><dt>이런 문제면</dt><dd><b>${ct.signal}</b></dd><dt>접근</dt><dd>${ct.how} <code>${ct.big}</code></dd><dt>자주 틀리는 곳</dt><dd>${ct.trap}</dd></dl></div>` : ''}
      ${qa ? `<div class="box iv"><h3>면접 질문 — 답을 가린 채 먼저 말해 보세요</h3>${qaHTML(lesson.id)}<a class="go" href="#prep">질문 은행 전체 보기 →</a></div>` : ''}
      <div class="box"><h3>핵심 정리</h3><ul>${lesson.points.map((p) => `<li>${p}</li>`).join('')}</ul></div>
      <div class="box senior"><h3>시니어의 시선</h3><p>${lesson.senior}</p></div>
      ${lesson.variants.some((v) => v.big) ? `<div class="box"><h3>복잡도 비교</h3><table><tr><th>방식</th><th>시간</th><th>공간</th></tr>${lesson.variants.map((v) =>
        `<tr><td>${esc(v.name)}</td><td><code>${v.big.time}</code></td><td><code>${v.big.space}</code></td></tr>`).join('')}</table></div>` : ''}`;

    const prev = CS.lessons[i - 1], next = CS.lessons[i + 1];
    $('#pager').innerHTML = (prev ? `<a href="#${prev.id}">← ${esc(prev.title)}</a>` : '<span></span>') +
      (next ? `<a href="#${next.id}" class="next">다음: ${esc(next.title)} →</a>` : '<span></span>');

    if (!openCats.has(CS.topicOf[lesson.id])) { openCats.add(CS.topicOf[lesson.id]); saveCats(); }
    markNav();
    const curA = $('#nav a.cur');
    if (curA) setTimeout(() => curA.scrollIntoView({ block: 'nearest' }), 320); // 아코디언이 펼쳐진 뒤에
    document.body.classList.remove('nav-open');
    build();
    scrollTo(0, 0);
  }

  const textLen = (html) => html.replace(/<[^>]+>/g, '').length;
  const shown = () => (state.side ? state.runs : [state.runs[state.tab]]);
  // 화면 단계: 좁음(카드가 자연 높이로 쌓임) / 서랍(목차가 화면 밖 서랍). CSS의 미디어 쿼리와 같은 값
  const mqNarrow = matchMedia('(max-width: 760px)'), mqDrawer = matchMedia('(max-width: 1024px)');
  const roomy = () => !mqNarrow.matches && $('#main').clientWidth >= 780; // 두 카드를 나란히 놓을 최소 너비
  const wantSide = () => {
    if (state.runs.length < 2 || !roomy()) return false;
    const pref = store.get('cs-view');
    return pref ? pref === 'side' : $('#main').clientWidth >= 890 && innerHeight >= 760; // 작은 화면은 '하나씩'이 기본
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
    state.runs.forEach((r, ri) => {
      const card = document.createElement('article');
      card.className = 'card ' + (r.v.tone || 'info');
      card.style.setProperty('--i', ri);
      card.innerHTML = `
        <header><span class="tone">${esc(r.v.label || TONE[r.v.tone || 'info'])}</span><h2>${esc(r.v.name)}</h2><span class="status"></span></header>
        <div class="body">
          <div class="left">
            <div class="code"><div class="lines"><span class="cursor"></span>${r.v.code.split('\n').map((line, i) =>
              `<div class="ln" data-l="${i + 1}"><span class="heat"></span><span class="no">${i + 1}</span><code>${hl(line) || ' '}</code>${
                r.v.notes && r.v.notes[i + 1] ? `<span class="note">${esc(r.v.notes[i + 1])}</span>` : ''}<span class="hits"></span></div>`).join('')}</div></div>
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
      r.cursor = $('.cursor', card);
    });

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
    $('#viewmode').hidden = !multi || !roomy();
    for (const b of $('#viewmode').children) b.classList.toggle('on', (b.dataset.m === 'side') === state.side);
    $('#tabs').hidden = !multi || state.side;
    [...$('#tabs').children].forEach((b, i) => b.classList.toggle('on', i === state.tab));
    $('#cards').className = 'cards ' + (state.side ? 'side' : 'one');
    state.runs.forEach((r, i) => { r.el.hidden = !state.side && i !== state.tab; });
    state.total = Math.max(...shown().map((r) => r.steps.length));
    state.idx = reset ? 0 : Math.min(state.idx, state.total - 1);
    $('#scrub').max = state.total - 1;
    // 단계마다 읽는 데 필요한 시간(보통 속도 기준): 새로 나온 설명의 글자 수에 비례한다
    state.delays = Array.from({ length: state.total }, (_, i) => {
      let chars = 0;
      for (const r of shown()) if (i < r.steps.length) chars += textLen(r.steps[i].msg);
      return Math.min(10000, Math.max(900, 500 + chars * 48));
    });
    // 진행 막대 위에 "이 방식은 여기서 끝난다"를 점으로 표시
    $('#marks').innerHTML = state.side ? state.runs.filter((r) => r.steps.length < state.total).map((r) =>
      `<i class="${r.v.tone || 'info'}" style="--f:${(r.steps.length - 1) / (state.total - 1)}" title="${esc(r.v.name)} 완료 지점"></i>`).join('') : '';
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
    $('#tip').hidden = !(minZoom < 0.75 && state.side && !mqDrawer.matches && !document.body.classList.contains('nav-off'));
    render();
  }

  // 점수판 숫자는 이전 값에서 새 값으로 굴러 올라간다
  function count(el, to) {
    cancelAnimationFrame(el._raf);
    if (typeof to !== 'number' || reduced || state.measuring || typeof el._v !== 'number' || el._v === to) {
      el._v = to;
      el.textContent = to === undefined ? '–' : fmt(to);
      return;
    }
    const from = el._v, t0 = performance.now(), dur = Math.min(420, 120 + Math.abs(to - from) * 30);
    const frac = Number.isInteger(to) && Number.isInteger(from);
    const tick = (now) => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - (1 - k) ** 3, v = from + (to - from) * e;
      el.textContent = fmt(k === 1 ? to : frac ? Math.round(v) : +v.toFixed(1));
      if (k < 1) el._raf = requestAnimationFrame(tick); else el._v = to;
    };
    el._v = to; // 중간에 다시 불려도 목표값을 기준으로 이어 간다
    el._raf = requestAnimationFrame(tick);
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
        const hits = ln.lastChild, txt = h ? `×${h}` : '';
        if (hits.textContent !== txt) {
          const up = h > (hits._n || 0);
          hits.textContent = txt; hits._n = h;
          if (up && !state.measuring) { hits.classList.remove('bump'); void hits.offsetWidth; hits.classList.add('bump'); } // 실행될 때마다 횟수가 톡 튄다
        }
      }
      // 실행 줄 커서가 다음 줄로 미끄러져 간다. 줄이 코드 창 밖이면 창 안으로 스크롤한다 (페이지는 움직이지 않게)
      const box = r.codeEl;
      r.cursor.classList.toggle('show', !!on);
      if (on) {
        r.cursor.style.transform = `translateY(${on.offsetTop}px)`;
        const top = on.offsetTop + on.offsetParent.offsetTop;
        if (top < box.scrollTop || top + on.offsetHeight > box.scrollTop + box.clientHeight)
          box.scrollTo({ top: top - box.clientHeight / 2, behavior: reduced || state.measuring ? 'auto' : 'smooth' });
      }
      if (r.msgEl.dataset.h !== s.msg) {
        r.msgEl.dataset.h = s.msg;
        r.msgEl.innerHTML = s.msg;
        r.msgEl.scrollTop = 0;
        if (!reduced && !state.measuring) r.msgEl.animate([{ opacity: 0, transform: 'translateY(7px)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: EASE });
      }
      renderPanels(r.vizEl, s.panels);
      r.el.classList.toggle('fin', fin && state.side && !end);
      const st = $('.status', r.el);
      st.classList.toggle('end', fin);
      st.textContent = fin ? `완료 · ${last + 1}단계` : `${Math.min(idx, last) + 1} / ${last + 1}단계`;
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
          count(cell.lastChild, v);
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

    // 머리말 자리: 진행 중에는 소개, 끝나면 결론 (점수판에 빛이 한 번 지나간다)
    const sum = $('#summary');
    if (sum.classList.contains('verdict') !== end) {
      sum.classList.toggle('verdict', end);
      if (end) sum.innerHTML = `<b>결론</b> ${lesson.verdict}`; else sum.textContent = lesson.summary;
      $('#score').classList.toggle('finale', end && !state.measuring);
    } else if (!end) sum.textContent = lesson.summary;

    $('#scrub').value = idx;
    $('#scrub').style.setProperty('--p', `${(idx / Math.max(1, state.total - 1)) * 100}%`);
    $('#count').innerHTML = `<b>${idx + 1}</b> / ${state.total} 단계`;
    const rest = state.delays.slice(idx, state.total - 1).reduce((a, b) => a + b, 0) / state.speed / 1000;
    $('#eta').textContent = end ? '끝까지 봤습니다' : `자동 재생 시 약 ${rest < 55 ? `${Math.max(5, Math.round(rest / 5) * 5)}초` : `${Math.round(rest / 60)}분`} 남음`;
    const pb = state.playing ? 'pause' : end ? 'replay' : 'play';
    if ($('#b-play').dataset.m !== pb) { $('#b-play').dataset.m = pb; $('#b-play').innerHTML = `${IC[pb]}<span>${{ pause: '일시정지', replay: '처음부터', play: '자동 재생' }[pb]}</span>`; }
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
  const readTime = () => state.delays[state.idx] / state.speed;
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
  const SPEEDS = [[0.5, '느리게'], [1, '보통'], [2, '빠르게'], [5, '훑기']];
  function setSpeed(v, save = true) {
    state.speed = v;
    if (save) store.set('cs-speed', v);
    for (const b of $('#speed').children) b.classList.toggle('on', +b.dataset.v === v);
    $('#speed-cycle span').textContent = SPEEDS.find((x) => x[0] === v)[1];
    if (state.playing) schedule(); else if (state.lesson && state.runs.length) render();
  }
  $('#speed').onclick = (e) => { const b = e.target.closest('button'); if (b) setSpeed(+b.dataset.v); };
  $('#speed-cycle').onclick = () => setSpeed(SPEEDS[(SPEEDS.findIndex((x) => x[0] === state.speed) + 1) % SPEEDS.length][0]);
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
  // 창 크기·헤더 높이·목차 접힘이 바뀌면 보기 방식과 그림 크기를 다시 맞춘다
  let rz;
  const relayout = () => {
    clearTimeout(rz);
    rz = setTimeout(() => {
      if (!state.lesson) return;
      if (wantSide() !== state.side) { pause(); layout(false); } else { $('#viewmode').hidden = state.runs.length < 2 || !roomy(); fitViz(); }
    }, 150);
  };
  addEventListener('resize', relayout);
  // 고정 헤더의 실제 높이를 CSS 변수로 알려 준다 (무대 높이와 고정 요소 위치 계산에 쓰인다)
  new ResizeObserver(() => {
    const h = `${$('#bar').offsetHeight}px`;
    if (document.documentElement.style.getPropertyValue('--head-h') === h) return;
    document.documentElement.style.setProperty('--head-h', h);
    relayout();
  }).observe($('#bar'));
  mqDrawer.addEventListener('change', () => document.body.classList.remove('nav-open'));
  $('#param select').onchange = (e) => { pause(); state.n = +e.target.value; build(); };
  $('#tip').onclick = () => $('#menu').click();
  $('#menu').onclick = () => {
    if (mqDrawer.matches) return document.body.classList.toggle('nav-open');
    store.set('cs-nav-off', document.body.classList.toggle('nav-off')); // 넓은 화면: 목차를 접어 무대를 넓힌다
    relayout();
  };
  $('#scrim').onclick = () => document.body.classList.remove('nav-open');
  $('#theme').onclick = () => {
    const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    store.set('cs-theme', next);
  };
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') document.body.classList.remove('nav-open');
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
  setSpeed(SPEEDS.some((x) => x[0] === sp) ? sp : 1, false);
  const theme = store.get('cs-theme');
  if (theme) document.documentElement.dataset.theme = theme;
  // 레슨 순서 = 목차 순서: 분야 → 난이도. "다음 레슨"도 이 순서를 따른다
  const rank = (l) => CS.topics.findIndex((t) => t[0] === CS.topicOf[l.id]) * 10 + LEVELS.findIndex((x) => x[0] === l.level);
  CS.lessons.sort((a, b) => rank(a) - rank(b));
  buildNav();
  load(location.hash.slice(1));
})();
