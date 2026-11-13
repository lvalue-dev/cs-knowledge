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
    target: ic('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.5"/><path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4"/>'),
    paper: ic('<path d="M7 3h8l4 4v14H7z"/><path d="M15 3v4h4M10 12h6M10 16h6"/>'),
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
    const lv = store.get('cs-lv', ''), q = $('#navq').value.trim().toLowerCase();
    for (const b of $('#lvfilter').children) b.classList.toggle('on', b.dataset.l === lv);
    const lvName = (l) => LEVELS.find((x) => x[0] === l.level)[1];
    $('#nav').innerHTML = CS.topics.map(([key, name, desc]) => {
      const items = CS.lessons.filter((l) => CS.topicOf[l.id] === key && (!lv || l.level === lv) && (!q || `${l.title} ${l.id} ${l.summary}`.toLowerCase().includes(q)));
      return items.length ? `<section class="cat" data-t="${key}">
        <button type="button" class="cat-h"><span class="cat-ic">${IC[key]}</span><span class="cat-t"><b>${name}</b><small>${desc}</small></span><span class="cnt"></span>${IC.chev}</button>
        <div class="lvbar"><i></i></div>
        <div class="cat-b"><div>${items.map((l) => `<a href="#${l.id}" data-id="${l.id}">${CHK}<span>${esc(l.title)}</span><i class="lv ${l.level}" title="${lvName(l)}"></i></a>`).join('')}</div></div>
      </section>` : '';
    }).join('') || `<p class="none">${q ? '일치하는 레슨이 없습니다.' : '이 단계의 레슨이 없습니다.'}</p>`;
    markNav();
  }
  function markNav() {
    const lv = store.get('cs-lv', '') || $('#navq').value.trim(); // 걸러 보는 동안에는 모든 분야를 펼친다
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
    $('#drilllink').classList.toggle('cur', state.page === 'drill');
    $('#paperlink').classList.toggle('cur', state.page === 'papers');
  }
  const saveCats = () => store.set('cs-cats', [...openCats]);
  $('#nav').addEventListener('click', (e) => {
    const h = e.target.closest('.cat-h');
    if (!h || store.get('cs-lv', '') || $('#navq').value.trim()) return;
    const t = h.parentNode.dataset.t;
    if (openCats.has(t)) openCats.delete(t); else openCats.add(t);
    saveCats(); markNav();
  });
  $('#navq').oninput = buildNav;
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
  /* 긴 목록은 한 쪽 분량만 그린다. 쪽 넘김 막대는 화면 아래에 붙어 있어서 목록이 끝없이 길어지지 않는다 */
  function paged(per, empty) {
    const list = $('#symlist'), bar = $('#lpager');
    let rows = [], page = 0;
    const show = (scroll) => {
      const pages = Math.max(1, Math.ceil(rows.length / per));
      page = Math.max(0, Math.min(page, pages - 1));
      const from = page * per, to = Math.min(rows.length, from + per);
      list.innerHTML = rows.slice(from, to).join('') || `<p class="none">${empty}</p>`;
      bar.hidden = !rows.length;
      // 쪽 번호는 처음 · 끝 · 현재 주변만 보여 준다
      const nums = [...new Set([0, pages - 1, page - 1, page, page + 1].filter((i) => i >= 0 && i < pages))].sort((a, b) => a - b);
      bar.innerHTML = `<button type="button" data-p="${page - 1}" ${page ? '' : 'disabled'} aria-label="이전 쪽">${IC.prev}<span>이전</span></button>
        <div class="lp-nums">${nums.map((i, k) => `${k && i - nums[k - 1] > 1 ? '<i>…</i>' : ''}<button type="button" data-p="${i}"${i === page ? ' class="on" aria-current="page"' : ''}>${i + 1}</button>`).join('')}</div>
        <span class="lp-info"><b>${rows.length ? from + 1 : 0}–${to}</b> / ${rows.length}</span>
        <button type="button" data-p="${page + 1}" ${page < pages - 1 ? '' : 'disabled'} aria-label="다음 쪽"><span>다음</span>${IC.next}</button>`;
      if (scroll) list.scrollIntoView({ block: 'start' });
    };
    bar.onclick = (e) => {
      const b = e.target.closest('button[data-p]');
      if (b && !b.disabled) { page = +b.dataset.p; show(true); }
    };
    const api = {
      set(r) { rows = r; page = 0; show(false); },
      step(d) { const pages = Math.ceil(rows.length / per); if (page + d >= 0 && page + d < pages) { page += d; show(true); } },
      open(i) { if (i >= 0) { page = Math.floor(i / per); show(false); } },
    };
    state.pager = api;
    return api;
  }
  const fold = (title, body, cls = '') => `<details class="box fold ${cls}"><summary><h3>${title}</h3><span class="fold-t"></span></summary><div class="fold-b">${body}</div></details>`;
  const LISTBAR = '<div id="symlist"></div><nav id="lpager" class="lpager" aria-label="쪽 이동" hidden></nav>';

  function openPage(page, badge, title, count, summary) {
    pause();
    state.lesson = null;
    state.page = page;
    state.pager = null;
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
      ${fold('코딩 테스트 ① 입력 크기로 허용 복잡도 가늠하기', `<table><tr><th>입력 크기 n</th><th>통과 가능한 복잡도</th><th>떠올릴 방법</th></tr>${CS.sizes.map((r) => `<tr><td><code>${r[0]}</code></td><td><code>${r[1]}</code></td><td>${r[2]}</td></tr>`).join('')}</table>
        <p class="fineprint">1초에 단순 연산 약 1억 번을 기준으로 한 어림값입니다. 제한 시간과 언어에 따라 달라집니다.</p>`)}
      ${fold('코딩 테스트 ② 문제 문장의 신호로 유형 고르기', `<div class="tri">${CS.lessons.filter((l) => CS.ct[l.id]).map((l) => { const c = CS.ct[l.id]; return `<div class="tri-row"><div><b>${c.signal}</b></div><div>${c.how} <code>${c.big}</code></div><div class="chips">${lessonLink(l.id)}</div></div>`; }).join('')}</div><a class="dr-cta" href="#drill">표를 봤다면 실전처럼 유형 맞히기 →</a>`)}
      <div class="symbar"><input id="symq" type="search" placeholder="질문 검색 (예: 인덱스, TCP, 캐시, 토큰)" aria-label="질문 검색">
        <div class="chips" id="symcats"><button type="button" class="chip on" data-c="">전체</button>${CS.topics.map(([k, n]) => `<button type="button" class="chip" data-c="${k}">${n}</button>`).join('')}</div>
        <div class="qa-tools"><button type="button" id="qa-rand" class="ghost">${IC.replay}아직 못 푼 질문 하나 뽑기</button><label><input type="checkbox" id="qa-todo"> 못 푼 질문만</label><span id="qa-prog">${known.size} / ${total} 답할 수 있음</span></div></div>
      ${LISTBAR}`;
    const pg = paged(6, '일치하는 질문이 없습니다.');
    let cat = '', cards = [];
    const draw = () => {
      const q = $('#symq').value.trim().toLowerCase(), todo = $('#qa-todo').checked;
      cards = CS.lessons.filter((l) => CS.qa[l.id] && (!cat || CS.topicOf[l.id] === cat)).map((l) => {
        const items = CS.qa[l.id].map((x, i) => [x, i]).filter(([x, i]) => (!q || (l.title + x[0] + x[1]).toLowerCase().includes(q)) && (!todo || !known.has(`${l.id}:${i}`)));
        if (!items.length) return null;
        const all = qaHTML(l.id).split('</details>').filter((h) => h.trim()).map((h) => h + '</details>');
        return { keys: items.map(([, i]) => `${l.id}:${i}`), html: `<article class="sym-card"><header><div class="chips"><span class="tag">${topicName(l.id)}</span></div>${levelBadge(l)}</header>
          ${items.map(([, i]) => all[i]).join('')}
          <a class="go" href="#${l.id}">애니메이션으로 복습: ${esc(l.title)} →</a></article>` };
      }).filter(Boolean);
      pg.set(cards.map((c) => c.html));
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
      const todo = cards.flatMap((c, ci) => c.keys.filter((k) => !known.has(k)).map((k) => [ci, k]));
      const got = todo[Math.floor(Math.random() * todo.length)];
      if (!got) return;
      pg.open(got[0]);
      const pick = document.querySelector(`#symlist .qa[data-k="${got[1]}"]`);
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
      ${fold('원인을 좁히는 순서', `<ol>${CS.method.map((m) => `<li><span><b>${m[0]}</b> ${m[1]}</span></li>`).join('')}</ol>`, 'steps')}
      ${fold('1차 분류: 관찰한 것으로 영역 좁히기', `<div class="tri">${CS.triage.map((t) => `<div class="tri-row"><div><b>${t.see}</b></div><div>${t.suspect}</div><div class="chips">${t.lessons.map(lessonLink).join('')}</div></div>`).join('')}</div>`)}
      <div class="symbar"><input id="symq" type="search" placeholder="현상을 검색해 보세요 (예: 타임아웃, 메모리, 중복, 느려)" aria-label="증상 검색">
        <div class="chips" id="symcats"><button type="button" class="chip on" data-c="">전체</button>${CATS.map(([k, n]) => `<button type="button" class="chip" data-c="${k}">${n}</button>`).join('')}</div></div>
      ${LISTBAR}`;
    const pg = paged(6, '일치하는 항목이 없습니다. 다른 단어로 검색해 보세요.');
    let cat = '';
    const draw = () => {
      const q = $('#symq').value.trim().toLowerCase();
      const rows = CS.lessons.filter((l) => CS.diagnose[l.id]).map((l) => [l, CS.diagnose[l.id]]).filter(([l, d]) =>
        (!cat || d.cat.includes(cat)) && (!q || [l.title, d.concept, d.check, d.fix, ...d.symptoms].join(' ').toLowerCase().includes(q)));
      pg.set(rows.map(([l, d]) => `
        <article class="sym-card">
          <header><div class="chips">${d.cat.map((c) => `<span class="tag">${CATS.find((x) => x[0] === c)[1]}</span>`).join('')}</div><span class="badge ${l.level}">${LEVELS.find((x) => x[0] === l.level)[1]}</span></header>
          <ul class="sx">${d.symptoms.map((x) => `<li>${x}</li>`).join('')}</ul>
          <dl><dt>의심할 개념</dt><dd><b>${d.concept}</b></dd></dl>
          <details class="more"><summary>확인 방법과 고치는 방향</summary><dl><dt>확인 방법</dt><dd>${d.check}</dd><dt>고치는 방향</dt><dd>${d.fix}</dd></dl></details>
          <a class="go" href="#${l.id}">애니메이션으로 보기: ${esc(l.title)} →</a>
        </article>`));
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

  /* ---------- 코테 실전 훈련: 문제를 읽고 복잡도 · 접근 · 자료구조를 고른 뒤 채점 ---------- */
  let drillTimer = null;
  const DLV = { easy: '쉬움', mid: '보통', hard: '어려움' };
  const DQ = [['cx', '이 제한에서 통과할 수 있는 가장 느린 복잡도는?'], ['algo', '어떤 접근으로 풀까요?'], ['ds', '핵심이 되는 자료구조는?']];
  const big = (x) => {
    if (!isFinite(x) || x >= 1e20) return isFinite(x) ? `10<sup>${Math.round(Math.log10(x))}</sup>` : '사실상 무한';
    for (const [u, name] of [[1e16, '경'], [1e12, '조'], [1e8, '억'], [1e4, '만']]) {
      if (x >= u) { const v = x / u; return `${(v >= 100 ? Math.round(v) : +v.toPrecision(2)).toLocaleString()}${name}`; }
    }
    return Math.round(x).toLocaleString();
  };
  const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  function loadDrill(sub) {
    const D = CS.drill, P = D.problems;
    clearInterval(drillTimer);
    let rec = store.get('cs-drill', {});
    const solved = () => P.filter((x) => rec[x.id] && (rec[x.id].first || rec[x.id].clear)).length;
    const tips = sub === 'tips';
    const view = openPage('drill', '훈련', '코테 실전 훈련', `${solved()} / ${P.length} 해결`,
      tips ? '유형을 외우는 것보다 문제를 받았을 때 무엇부터 볼지 순서를 정해 두는 편이 효과가 큽니다. 시험장에서 그대로 따라 할 수 있는 순서와 점검표입니다.'
        : '코드를 쓰기 전에 방향부터 잡는 연습입니다. 문제를 읽고 허용 복잡도 · 접근 · 자료구조를 고르면, 왜 그런지와 실전에서 생각하는 순서를 보여 줍니다.');
    const top = `<div class="dr-top"><div class="seg dr-seg"><a href="#drill"${tips ? '' : ' class="on"'}>문제 풀기</a><a href="#drill/tips"${tips ? ' class="on"' : ''}>사고방식 · 팁</a></div>`;

    if (tips) {
      const [routine, ...rest] = D.tips;
      view.innerHTML = `${top}</div>
        <div class="box steps dr-routine"><h3>${routine.title}</h3><ol>${routine.items.map((x) => `<li><span>${x}</span></li>`).join('')}</ol></div>
        <div class="box"><h3>1단계의 근거: 입력 크기 → 허용 복잡도</h3>
          <table><tr><th>입력 크기 n</th><th>통과 가능한 복잡도</th><th>떠올릴 방법</th></tr>${CS.sizes.map((r) => `<tr><td><code>${r[0]}</code></td><td><code>${r[1]}</code></td><td>${r[2]}</td></tr>`).join('')}</table>
          <p class="fineprint">1초에 단순 연산 약 1억 번을 기준으로 한 어림값입니다. <a class="go" href="#prep">문제 문장의 신호 → 유형 표 보기 →</a></p></div>
        <div class="dr-tips">${rest.map((t) => `<div class="box"><h3>${t.title}</h3><ul>${t.items.map((x) => `<li>${x}</li>`).join('')}</ul></div>`).join('')}</div>
        <a class="dr-cta" href="#drill">순서를 익혔다면 문제로 연습하기 →</a>`;
      markNav();
      scrollTo(0, 0);
      return;
    }

    const p = P.find((x) => x.id === sub) || P.find((x) => !rec[x.id]) || P[0];
    const no = P.indexOf(p);
    const status = (x) => { const r = rec[x.id]; return !r ? '' : r.first ? 'ok' : r.clear ? 're' : 'try'; };
    const nameOf = (list, k) => list.find((x) => x[0] === k)[1];
    const opts = (q) => (q === 'cx' ? D.cx : q === 'algo' ? D.algos : D.ds)
      .map(([k, name, hint]) => `<button type="button" class="dr-opt" data-v="${k}" aria-pressed="false"><span>${name}</span>${hint ? `<small>${hint}</small>` : ''}</button>`).join('');

    view.innerHTML = `${top}
        <nav class="dr-board" aria-label="문제 목록">${P.map((x, i) => `<a class="dr-tile ${x.lv} ${status(x)}${x === p ? ' cur' : ''}" href="#drill/${x.id}" title="${esc(x.title)} · ${DLV[x.lv]}" aria-label="문제 ${i + 1}: ${esc(x.title)}">${i + 1}</a>`).join('')}</nav>
        <button type="button" class="ghost" id="dr-rand">${IC.replay}안 푼 문제 무작위</button></div>
      <div id="dr-stats"></div>
      <div class="dr-main">
        <article class="box dr-prob">
          <header><span class="dr-no">문제 ${no + 1}</span><span class="badge dr-lv ${p.lv}">${DLV[p.lv]}</span><span class="dr-timer" id="dr-timer" title="유형 판단 목표: 3분">0:00</span></header>
          <h2>${p.title}</h2>
          <p class="dr-text">${p.text}</p>
          <dl><dt>제한</dt><dd>${p.limits.map((x) => `<code>${x}</code>`).join(' ')}</dd><dt>예시</dt><dd>${p.ex}</dd></dl>
          <button type="button" class="ghost" id="dr-hint">${IC.search}막히면: 눈여겨볼 표현 표시</button>
        </article>
        <section class="box dr-ans" aria-label="답 고르기">
          ${DQ.map(([q, label], i) => `<div class="dr-q" data-q="${q}" role="group" aria-label="${label}"><h3><span class="qm">${i + 1}</span>${label}</h3><div class="dr-opts">${opts(q)}</div></div>`).join('')}
          <div class="dr-submit"><button type="button" id="dr-grade" class="dr-go" disabled>채점하기</button><span id="dr-left">세 가지를 모두 고르면 채점할 수 있습니다</span></div>
        </section>
      </div>
      <section id="dr-fb" hidden></section>`;

    const drawStats = () => {
      const tried = P.filter((x) => rec[x.id]);
      $('#pos').textContent = `${solved()} / ${P.length} 해결`;
      if (!tried.length) { $('#dr-stats').innerHTML = ''; return; }
      const pct = (k) => Math.round(tried.filter((x) => rec[x.id][k]).length / tried.length * 100);
      const weak = [...new Set(tried.filter((x) => !rec[x.id].algo || !rec[x.id].ds).map((x) => x.lesson))];
      $('#dr-stats').innerHTML = `<div class="box dr-stats"><h3>첫 시도 기준 정답률 <small>${tried.length}문제 풀이</small></h3>
        <div class="dr-meters">${[['cx', '복잡도 판단'], ['algo', '접근 고르기'], ['ds', '자료구조 고르기']].map(([k, n]) => `<div class="dr-meter"><span>${n}</span><b>${pct(k)}%</b><div class="lvbar"><i style="width:${pct(k)}%"></i></div></div>`).join('')}</div>
        ${weak.length ? `<div class="dr-weak"><span>다시 볼 개념</span><div class="chips">${weak.map(lessonLink).join('')}</div></div>` : ''}
        <button type="button" class="dr-reset" id="dr-reset">기록 지우기</button></div>`;
      $('#dr-reset').onclick = () => { if (confirm('훈련 기록을 모두 지울까요?')) { store.set('cs-drill', {}); loadDrill(p.id); } };
    };
    drawStats();

    const t0 = Date.now();
    const tick = () => {
      const s = Math.floor((Date.now() - t0) / 1000), el = $('#dr-timer');
      if (!el) return clearInterval(drillTimer);
      el.textContent = mmss(s);
      el.classList.toggle('over', s >= 180);
    };
    drillTimer = setInterval(tick, 1000);

    const pick = {};
    $('.dr-ans').onclick = (e) => {
      const b = e.target.closest('.dr-opt');
      if (!b || $('.dr-ans').classList.contains('graded')) return;
      const q = b.closest('.dr-q').dataset.q;
      pick[q] = b.dataset.v;
      for (const x of b.parentNode.children) { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); }
      const left = 3 - Object.keys(pick).length;
      $('#dr-grade').disabled = left > 0;
      $('#dr-left').textContent = left ? `${left}가지가 남았습니다` : '준비됐습니다';
    };
    $('#dr-hint').onclick = () => { $('.dr-prob').classList.add('hint'); $('#dr-hint').hidden = true; };
    $('#dr-rand').onclick = () => {
      const pool = P.filter((x) => x !== p && !(rec[x.id] && (rec[x.id].first || rec[x.id].clear)));
      const x = pool[Math.floor(Math.random() * pool.length)];
      if (x) location.hash = `drill/${x.id}`;
    };

    $('#dr-grade').onclick = () => {
      clearInterval(drillTimer);
      const sec = Math.floor((Date.now() - t0) / 1000);
      // 판정: 2 = 대표 풀이, 1 = 다른 풀이로 인정, 0 = 오답
      const judge = (k, ans, ok) => (k === ans ? 2 : ok && ok[k] ? 1 : 0);
      const res = { cx: pick.cx === p.cx ? 2 : 0, algo: judge(pick.algo, p.algo, p.algoOk), ds: judge(pick.ds, p.ds, p.dsOk) };
      const score = Object.values(res).filter(Boolean).length;
      const order = D.cx.map((x) => x[0]);
      const why = {
        cx: res.cx ? p.cxWhy : `${order.indexOf(pick.cx) < order.indexOf(p.cx) ? '그 복잡도로는 시간 초과입니다.' : '그렇게까지 빠를 필요는 없습니다. 필요 이상으로 어려운 풀이를 찾게 됩니다.'} ${p.cxWhy}`,
        algo: res.algo === 2 ? '대표 풀이와 같습니다.' : res.algo ? `${p.algoOk[pick.algo]} 대표 풀이는 <b>${nameOf(D.algos, p.algo)}</b>입니다.` : `${(p.wrong || {})[pick.algo] || D.whenAlgo[pick.algo]} 대표 풀이는 <b>${nameOf(D.algos, p.algo)}</b>입니다.`,
        ds: res.ds === 2 ? '대표 풀이와 같습니다.' : res.ds ? `${p.dsOk[pick.ds]} 대표 풀이는 <b>${nameOf(D.ds, p.ds)}</b>입니다.` : `${(p.wrongDs || {})[pick.ds] || D.whenDs[pick.ds]} 대표 풀이는 <b>${nameOf(D.ds, p.ds)}</b>입니다.`,
      };
      rec = store.get('cs-drill', {});
      if (!rec[p.id]) rec[p.id] = { cx: +!!res.cx, algo: +!!res.algo, ds: +!!res.ds, sec, first: +(score === 3) };
      else if (score === 3) rec[p.id].clear = 1;
      store.set('cs-drill', rec);

      $('.dr-ans').classList.add('graded');
      $('.dr-prob').classList.add('hint');
      $('#dr-hint').hidden = true;
      $('.dr-submit').hidden = true;
      const lists = { cx: D.cx, algo: D.algos, ds: D.ds };
      for (const [q] of DQ) {
        for (const b of $(`.dr-q[data-q="${q}"] .dr-opts`).children) {
          b.disabled = true;
          if (b.dataset.v === p[q]) b.classList.add('ans');
          if (b.dataset.v === pick[q]) b.classList.add(res[q] === 2 ? 'ans' : res[q] ? 'alt' : 'no');
        }
      }
      const n = p.n, lg = Math.log2(n);
      const rows = [['log', 'O(log n)', lg], ['', 'O(n)', n], ['nlogn', 'O(n log n)', n * lg], ['quad', 'O(n²)', n * n], ['exp', 'O(2ⁿ)', n > 1000 ? Infinity : 2 ** n]];
      const next = P.slice(no + 1).concat(P.slice(0, no)).find((x) => !rec[x.id]) || P[(no + 1) % P.length];
      const lesson = CS.lessons.find((l) => l.id === p.lesson);
      const MARK = ['✕', '△', '✓'], CLS = ['no', 'alt', 'ans'];
      const fb = $('#dr-fb');
      fb.hidden = false;
      fb.innerHTML = `
        <div class="box dr-result s${score}">
          <header><b class="dr-score">${score}<small> / 3</small></b><div><strong>${['이번에는 세 가지 모두 놓쳤습니다. 아래 사고 과정을 따라가 보세요.', '한 가지를 맞혔습니다. 어디서 갈렸는지 확인하세요.', '두 가지를 맞혔습니다. 놓친 하나만 짚고 넘어가세요.', '세 가지 모두 맞혔습니다.'][score]}</strong>
            <span>판단 시간 ${mmss(sec)} · 목표 3:00${sec > 180 ? ' (초과)' : ''}</span></div></header>
          ${DQ.map(([q, label]) => `<div class="dr-row ${CLS[res[q]]}"><i>${MARK[res[q]]}</i><div><small>${label}</small><b>${nameOf(lists[q], pick[q])}</b><p>${why[q]}</p></div></div>`).join('')}
        </div>
        <div class="dr-cols">
          <div class="box steps"><h3>이렇게 생각합니다</h3><ol>${p.think.map((x) => `<li><span>${x}</span></li>`).join('')}</ol></div>
          <div class="box"><h3>이 입력 크기에서의 연산 횟수 <small>n = ${big(n)}</small></h3>
            <table class="dr-ops">${rows.map(([k, name, v]) => `<tr class="${v <= 1e8 ? 'ans' : v <= 1e9 ? 'alt' : 'no'}${k === p.cx ? ' line' : ''}"><td><code>${name}</code></td><td>${big(v)}번</td><td>${v <= 1e8 ? '통과' : v <= 1e9 ? '아슬아슬' : '시간 초과'}</td></tr>`).join('')}</table>
            <p class="fineprint">1초에 약 1억 번을 기준으로 한 어림입니다.</p></div>
        </div>
        <div class="box"><h3>풀이 뼈대</h3><pre class="dr-code">${esc(p.sk)}</pre></div>
        <div class="box senior"><h3>자주 틀리는 곳</h3><p>${p.trap}</p></div>
        <div class="dr-next"><button type="button" class="ghost" id="dr-again">${IC.replay}다시 풀기</button>${lesson ? `<a class="ghost" href="#${lesson.id}">애니메이션으로 복습: ${esc(lesson.title)}</a>` : ''}<a class="dr-go" href="#drill/${next.id}">다음 문제 ${IC.next}</a></div>`;
      $('#dr-again').onclick = () => loadDrill(p.id);
      const tile = $('.dr-tile.cur');
      tile.classList.remove('ok', 're', 'try');
      if (status(p)) tile.classList.add(status(p));
      drawStats();
      fb.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' });
    };
    markNav();
    scrollTo(0, 0);
  }

  /* ---------- 논문 · 연구: 분야별 고전과 최신 연구 요약 ---------- */
  const NEW_FROM = 2023;
  function loadPapers(focus) {
    const all = [...CS.papers].sort((a, b) => b.year - a.year);
    const fresh = all.filter((x) => x.year >= NEW_FROM).length;
    const view = openPage('papers', '연구', '논문 · 연구', `${all.length}편 · 최신 ${fresh}편`,
      '레슨에서 본 기법이 어디서 나왔는지, 그리고 지금 연구가 어디까지 왔는지를 정리했습니다. 논문마다 풀려던 문제, 핵심 아이디어, 개발자에게 주는 의미를 요약하고 원문과 관련 레슨을 연결했습니다.');
    view.innerHTML = `
      ${fold('논문을 읽는 순서 · 이 요약을 읽을 때 주의할 점', `<ol>
        <li><span><b>제목 · 초록 · 결론만 먼저.</b> 무엇을 풀었고 무엇을 주장하는지 5분 안에 파악합니다. 여기서 관심이 없으면 그만 읽어도 됩니다.</span></li>
        <li><span><b>그림과 실험 결과.</b> 무엇과 비교해 얼마나 나아졌는지, 어떤 조건에서 잰 것인지 봅니다. 불리한 조건이 빠져 있지 않은지도 확인합니다.</span></li>
        <li><span><b>본문은 필요한 부분만.</b> 직접 구현하거나 판단 근거로 쓸 때에만 방법과 증명을 따라갑니다.</span></li></ol>
        <p class="fineprint">아래 요약은 원문을 대신하지 않습니다. 이론적 결과가 바로 실무 성능으로 이어지지 않는 경우가 많으므로 "주의" 항목을 함께 보세요.${CS.papersChecked ? ` 서지 정보 확인 시점: ${CS.papersChecked}.` : ''}</p>`, 'steps pp-how')}
      <div class="symbar"><input id="symq" type="search" placeholder="논문 검색 (예: 캐시, 최단 경로, 어텐션, 합의)" aria-label="논문 검색">
        <div class="chips" id="symcats"><button type="button" class="chip on" data-c="">전체</button>${CS.topics.filter(([k]) => all.some((x) => x.topic === k)).map(([k, n]) => `<button type="button" class="chip" data-c="${k}">${n}</button>`).join('')}</div>
        <div class="qa-tools"><div class="seg" id="pp-era"><button type="button" class="on" data-e="">전체</button><button type="button" data-e="new">최신 (${NEW_FROM}~)</button><button type="button" data-e="old">고전</button></div><span id="qa-prog"></span></div></div>
      ${LISTBAR}`;
    const pg = paged(6, '일치하는 논문이 없습니다.');
    let cat = '', era = '', shown = [];
    const draw = () => {
      const q = $('#symq').value.trim().toLowerCase();
      shown = all.filter((x) => (!cat || x.topic === cat) && (!era || (era === 'new') === (x.year >= NEW_FROM))
        && (!q || [x.title, x.authors, x.venue, x.one, x.problem, x.idea, x.impact].join(' ').toLowerCase().includes(q)));
      $('#qa-prog').textContent = `${shown.length}편`;
      pg.set(shown.map((x) => `
        <article class="sym-card pp" id="pp-${x.id}">
          <header><div class="chips"><span class="tag">${CS.topics.find((t) => t[0] === x.topic)[1]}</span>${x.year >= NEW_FROM ? '<span class="tag fresh">최신</span>' : ''}</div><span class="pp-venue">${esc(x.venue)}</span></header>
          <h3><a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(x.title)}<span aria-hidden="true"> ↗</span></a></h3>
          <p class="pp-au">${esc(x.authors)} · ${x.year}</p>
          <p class="pp-one">${x.one}</p>
          <details class="more"><summary>문제 · 핵심 아이디어 · 개발자에게 주는 의미</summary><dl><dt>문제</dt><dd>${x.problem}</dd><dt>핵심 아이디어</dt><dd>${x.idea}</dd><dt>개발자에게</dt><dd>${x.impact}</dd>${x.caveat ? `<dt>주의</dt><dd>${x.caveat}</dd>` : ''}</dl></details>
          ${x.lessons.some((id) => lessonLink(id)) ? `<div class="pp-rel"><span>관련 레슨</span><div class="chips">${x.lessons.map(lessonLink).join('')}</div></div>` : ''}
        </article>`));
    };
    $('#symq').oninput = draw;
    $('#symcats').onclick = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      cat = b.dataset.c;
      for (const x of $('#symcats').children) x.classList.toggle('on', x === b);
      draw();
    };
    $('#pp-era').onclick = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      era = b.dataset.e;
      for (const x of $('#pp-era').children) x.classList.toggle('on', x === b);
      draw();
    };
    draw();
    markNav();
    // 레슨에서 넘어온 경우: 그 논문이 있는 쪽을 열고 펼쳐 보여 준다
    pg.open(shown.findIndex((x) => x.id === focus));
    const hit = focus && document.getElementById(`pp-${focus}`);
    if (hit) { hit.classList.add('pick'); $('.more', hit).open = true; hit.scrollIntoView({ block: 'center' }); } else scrollTo(0, 0);
  }

  function load(id) {
    clearInterval(drillTimer);
    if (id === 'papers' || id.startsWith('papers/')) return loadPapers(id.slice(7));
    if (id === 'symptoms') return loadSymptoms();
    if (id === 'prep') return loadPrep();
    if (id === 'drill' || id.startsWith('drill/')) return loadDrill(id.slice(6));
    state.page = null;
    state.pager = null;
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
    const related = CS.papers.filter((x) => x.lessons.includes(lesson.id));
    $('#learn').innerHTML = `
      ${dg ? `<div class="box dx"><h3>이런 현상을 봤다면 이 개념입니다</h3><ul class="sx">${dg.symptoms.map((x) => `<li>${x}</li>`).join('')}</ul>
        <dl><dt>확인 방법</dt><dd>${dg.check}</dd><dt>고치는 방향</dt><dd>${dg.fix}</dd></dl><a class="go" href="#symptoms">다른 증상 찾아보기 →</a></div>` : ''}
      ${lesson.story ? `<div class="box story"><h3>비유로 다시 보기</h3><p>${lesson.story.scene}</p>
        <table><tr><th>이야기 속에서는</th><th>실제 용어로는</th></tr>${lesson.story.map.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</table>
        <p class="fineprint"><b>비유가 맞지 않는 부분</b> — ${lesson.story.limit}</p></div>` : ''}
      ${ct ? `<div class="box ct"><h3>코딩 테스트에서</h3><dl><dt>이런 문제면</dt><dd><b>${ct.signal}</b></dd><dt>접근</dt><dd>${ct.how} <code>${ct.big}</code></dd><dt>자주 틀리는 곳</dt><dd>${ct.trap}</dd></dl>${CS.drill.problems.filter((x) => x.lesson === lesson.id).map((x) => `<a class="go" href="#drill/${x.id}">실전 문제로 연습: ${x.title} →</a>`).join('')}</div>` : ''}
      ${qa ? `<div class="box iv"><h3>면접 질문 — 답을 가린 채 먼저 말해 보세요</h3>${qaHTML(lesson.id)}<a class="go" href="#prep">질문 은행 전체 보기 →</a></div>` : ''}
      ${related.length ? `<div class="box pp-box"><h3>더 깊이: 관련 논문</h3><ul>${related.map((x) => `<li><a href="#papers/${x.id}">${esc(x.title)}</a> <small>${esc(x.venue)}</small><br>${x.one}</li>`).join('')}</ul></div>` : ''}
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
    const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) && e.target.type !== 'range';
    if (e.key === '/' && !typing) { e.preventDefault(); ($('#symq') && state.page ? $('#symq') : $('#navq')).focus(); return; }
    if (typing) return;
    if (state.pager && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { e.preventDefault(); state.pager.step(e.key === 'ArrowRight' ? 1 : -1); return; }
    if (!state.lesson) return;
    if (e.key === ' ') { e.preventDefault(); toggle(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); pause(); go(state.idx + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); pause(); go(state.idx - 1); }
    else if (e.key === 'Home') { e.preventDefault(); pause(); go(0); }
    else if (e.key === 'End') { e.preventDefault(); pause(); go(state.total - 1); }
  });
  $('#paperlink').hidden = !CS.papers.length; // 논문 데이터가 비어 있으면 메뉴를 숨긴다
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
