/* 중급: 해시 테이블, 정렬, 메모이제이션 */
(function () {
  const CS = window.CS;

  /* ---------- 5. 해시 테이블 내부 ---------- */
  const KEYS = ['apple', 'grape', 'melon', 'peach', 'lemon', 'mango', 'berry', 'guava'];
  const hashRun = (hash, off, hashMsg) => (t) => {
    const buckets = Array.from({ length: 8 }, () => []);
    t.m['체인 비교 횟수'] = 0; t.m['가장 긴 체인'] = 0;
    const snap = (active, hot, s = 'cmp') => [{
      type: 'buckets', title: 'buckets[0..7] — 같은 칸에 몰리면 체인이 길어집니다', active,
      buckets: buckets.map((b, i) => b.map((k, j) => ({ id: k, v: k, s: i === active && j === hot ? s : '' }))),
    }];
    t.step(off + 5, `키 8개를 차례로 넣습니다. 해시 함수가 각 키가 들어갈 칸 번호를 정합니다.`, snap(-1));
    for (const key of KEYS) {
      const i = hash(key);
      t.step(off + 6, `<code>set('${key}')</code> — ${hashMsg(key, i)} → <b>${i}번 칸</b>`, snap(i));
      for (let j = 0; j < buckets[i].length; j++) {
        t.m['체인 비교 횟수']++;
        t.step(off + 8, `같은 칸에 이미 '${buckets[i][j]}'가 있습니다(<b>충돌</b>). 같은 키인지 하나씩 비교해야 합니다.`, snap(i, j));
      }
      buckets[i].push(key);
      t.m['가장 긴 체인'] = Math.max(t.m['가장 긴 체인'], buckets[i].length);
      t.step(off + 10, `'${key}'를 ${i}번 칸${buckets[i].length > 1 ? ` 체인 끝(${buckets[i].length}번째)` : ''}에 넣습니다.`, snap(i, buckets[i].length - 1, 'new'));
    }
  };
  const goodHash = (key) => { let h = 0; for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h % 8; };

  CS.add({
    id: 'hash-table', level: 'mid',
    title: '해시 테이블: O(1)은 공짜가 아니다',
    summary: 'Map과 객체가 빠른 이유는 해시 함수가 키를 배열 칸 번호로 바꿔 주기 때문입니다. 해시가 한쪽으로 쏠리면 해시 테이블은 그냥 느린 리스트가 됩니다.',
    headline: '체인 비교 횟수',
    verdict: '같은 자료구조, 같은 키인데 해시 함수 한 줄 차이로 비교 횟수가 갈립니다. "평균 O(1)"은 키가 고르게 퍼진다는 가정 위에 서 있습니다.',
    variants: [
      {
        name: '나쁜 해시 (길이만 사용)', tone: 'bad', big: { time: '조회 O(n)', space: 'O(n)' },
        code: `function hash(key) {
  return key.length % 8;
}

function set(key, value) {
  const i = hash(key);
  for (const e of buckets[i]) {
    if (e.key === key) return update(e, value);
  }
  buckets[i].push({ key, value });
}`,
        notes: { 2: '전부 같은 칸으로', 7: '체인 길이만큼 반복' },
        run: hashRun((k) => k.length % 8, 0, (k) => `길이 ${k.length} % 8`),
      },
      {
        name: '좋은 해시 (모든 글자 반영)', tone: 'good', big: { time: '조회 평균 O(1)', space: 'O(n)' },
        code: `function hash(key) {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 8;
}

function set(key, value) {
  const i = hash(key);
  for (const e of buckets[i]) {
    if (e.key === key) return update(e, value);
  }
  buckets[i].push({ key, value });
}`,
        notes: { 3: '글자마다 섞기', 9: '대부분 0~1번' },
        run: hashRun(goodHash, 2, () => `모든 글자를 섞은 값 % 8`),
      },
    ],
    points: [
      '해시 테이블 = 배열 + 해시 함수. <code>buckets[hash(key)]</code>로 바로 점프하기 때문에 빠릅니다.',
      '서로 다른 키가 같은 칸에 떨어지는 것이 <b>충돌</b>이고, 충돌은 피할 수 없습니다. 얼마나 고르게 퍼뜨리느냐가 성능입니다.',
      '실제 구현은 칸이 일정 비율(load factor) 이상 차면 배열을 2배로 늘리고 전체를 다시 넣습니다(리사이즈).',
    ],
    senior: '공격자가 일부러 충돌하는 키를 대량으로 보내 서버를 O(n²)으로 만드는 것이 Hash DoS입니다. 그래서 언어 런타임들은 해시에 무작위 시드를 넣습니다. 또 리사이즈는 그 한 번의 삽입을 O(n)으로 만들기 때문에, 지연 시간이 중요한 경로에서는 초기 용량을 미리 잡아 둡니다.',
  });

  /* ---------- 6. 정렬 ---------- */
  CS.add({
    id: 'sorting', level: 'mid',
    title: '정렬: 버블 정렬 vs 퀵 정렬',
    summary: '버블 정렬은 이웃끼리만 바꾸느라 원소가 한 칸씩 기어갑니다. 퀵 정렬은 기준값(pivot)으로 한 번에 크게 나눕니다.',
    param: { label: '배열 크기 n', options: [8, 12, 16], value: 12 },
    headline: '비교 횟수',
    verdict: '버블 정렬은 항상 n²/2번 비교합니다. 퀵 정렬은 매번 문제를 둘로 쪼개 평균 n·log n번에 끝냅니다. n이 커질수록 격차는 더 벌어집니다.',
    variants: [
      {
        name: '버블 정렬', tone: 'bad', big: { time: 'O(n²)', space: 'O(1)' },
        code: `function sort(a) {
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < a.length - 1 - i; j++) {
      if (a[j] > a[j + 1]) {
        swap(a, j, j + 1);
      }
    }
  }
}`,
        notes: { 4: 'n²/2번 비교', 5: '한 칸씩만 이동' },
        run(t, n) {
          const a = CS.perm(n, 3).map((v) => ({ id: v, v }));
          t.m['비교 횟수'] = 0; t.m['교환 횟수'] = 0;
          const snap = (j, s, sortedFrom) => [{
            type: 'cells', bars: true, max: n, title: '막대 높이 = 값',
            items: a.map((e, k) => ({ ...e, s: k === j || k === j + 1 ? s : k >= sortedFrom ? 'done' : '' })),
          }];
          t.step(1, `뒤죽박죽인 배열을 정렬합니다.`, snap(-9, '', n));
          for (let i = 0; i < n; i++) {
            if (n - 1 - i > 0) t.step(2, `${i + 1}번째 훑기 — 남은 것 중 가장 큰 값을 맨 뒤로 보냅니다.`, snap(-9, '', n - i));
            for (let j = 0; j < n - 1 - i; j++) {
              t.m['비교 횟수']++;
              if (a[j].v > a[j + 1].v) {
                t.step(4, `${a[j].v} &gt; ${a[j + 1].v} — 순서가 틀렸습니다.`, snap(j, 'cmp', n - i));
                [a[j], a[j + 1]] = [a[j + 1], a[j]];
                t.m['교환 횟수']++;
                t.step(5, `이웃끼리 교환. 큰 값이 <b>한 칸</b> 전진했습니다.`, snap(j, 'active', n - i));
              } else {
                t.step(4, `${a[j].v} &lt; ${a[j + 1].v} — 그대로 둡니다.`, snap(j, 'cmp', n - i));
              }
            }
          }
          t.step(8, `정렬 완료. 비교 <b>${t.m['비교 횟수']}번</b>, 교환 <b>${t.m['교환 횟수']}번</b>.`, snap(-9, '', 0));
        },
      },
      {
        name: '퀵 정렬', tone: 'good', big: { time: '평균 O(n log n)', space: 'O(log n)' },
        code: `function sort(a, lo = 0, hi = a.length - 1) {
  if (lo >= hi) return;
  const pivot = a[hi];
  let p = lo;
  for (let i = lo; i < hi; i++) {
    if (a[i] < pivot) swap(a, i, p++);
  }
  swap(a, p, hi);
  sort(a, lo, p - 1);
  sort(a, p + 1, hi);
}`,
        notes: { 6: '구간 길이만큼 비교', 9: '절반 크기 문제', 10: '절반 크기 문제' },
        run(t, n) {
          const a = CS.perm(n, 3).map((v) => ({ id: v, v }));
          const fixed = new Set();
          t.m['비교 횟수'] = 0; t.m['교환 횟수'] = 0;
          const snap = (lo, hi, hot = {}) => [{
            type: 'cells', bars: true, max: n, title: '막대 높이 = 값 · 흐린 막대는 지금 보지 않는 구간',
            items: a.map((e, k) => ({ ...e, s: hot[k] || (fixed.has(e.id) ? 'done' : k < lo || k > hi ? 'dim' : ''), ptr: hot[k] === 'new' ? 'pivot' : '' })),
          }];
          const swap = (i, j) => { if (i !== j) { [a[i], a[j]] = [a[j], a[i]]; t.m['교환 횟수']++; } };
          const sort = (lo, hi) => {
            if (lo >= hi) { if (lo === hi) fixed.add(a[lo].id); return; }
            const pivot = a[hi].v;
            t.step(3, `구간 [${lo}..${hi}]의 마지막 값 <b>${pivot}</b>을 pivot으로 잡습니다.`, snap(lo, hi, { [hi]: 'new' }));
            let p = lo;
            for (let i = lo; i < hi; i++) {
              t.m['비교 횟수']++;
              if (a[i].v < pivot) {
                swap(i, p);
                t.step(6, `${a[p].v} &lt; ${pivot} — pivot보다 작으니 왼쪽 무리로 보냅니다.`, snap(lo, hi, { [hi]: 'new', [p]: 'active', [i]: 'active' }));
                p++;
              } else {
                t.step(6, `${a[i].v} &gt; ${pivot} — 오른쪽 무리에 그대로 둡니다.`, snap(lo, hi, { [hi]: 'new', [i]: 'cmp' }));
              }
            }
            swap(p, hi);
            fixed.add(a[p].id);
            t.step(8, `pivot ${pivot}을 두 무리 사이에 꽂습니다. 이 칸은 <b>최종 위치</b>입니다. 이제 양쪽을 따로 정렬합니다.`, snap(lo, hi, { [p]: 'done' }));
            sort(lo, p - 1);
            sort(p + 1, hi);
          };
          t.step(1, `같은 배열을 정렬합니다.`, snap(0, n - 1));
          sort(0, n - 1);
          t.step(11, `정렬 완료. 비교 <b>${t.m['비교 횟수']}번</b>, 교환 <b>${t.m['교환 횟수']}번</b>.`, snap(0, n - 1));
        },
      },
    ],
    points: [
      '좋은 알고리즘은 한 번의 작업으로 <b>더 많은 정보</b>를 얻습니다. pivot 분할 한 번이 문제를 절반 크기 두 개로 줄입니다.',
      '분할 정복: 크기 n 문제를 n/2 두 개로 쪼개면 깊이가 log n이 되어 전체가 n·log n이 됩니다.',
      '직접 구현할 일은 거의 없습니다. 언어 내장 정렬(Timsort, pdqsort 등)을 쓰되, 그 비용이 n·log n임을 기억하세요.',
    ],
    senior: '이 퀵 정렬은 이미 정렬된 입력을 만나면 분할이 한쪽으로 쏠려 O(n²)이 됩니다. 평균과 최악은 다르고, 운영 데이터는 "거의 정렬된" 경우가 흔합니다. 그래서 실제 라이브러리는 pivot을 무작위/중앙값으로 고르고, 작은 구간은 삽입 정렬로 바꾸는 하이브리드를 씁니다. 그리고 DB가 <code>ORDER BY</code>로 정렬해 줄 수 있는 것을 애플리케이션에서 정렬하고 있지는 않은지도 확인하세요.',
  });

  /* ---------- 7. 메모이제이션 ---------- */
  const fibRun = (memoized) => (t, n) => {
    const nodes = [], edges = [], memo = {};
    const key = '함수 호출 횟수';
    t.m[key] = 0; t.m['캐시 적중'] = 0; t.m['추가 메모리 (칸)'] = 0;
    const lay = { pos: {}, w: 100, h: 100 };
    const snap = () => [{ type: 'graph', title: `fib(${n}) 호출 트리 — 노드 하나가 함수 호출 한 번`, nodes: nodes.map((x) => ({ ...x })), edges: [...edges], pos: lay.pos, lay }];
    let seq = 0;
    const fib = (k, parent) => {
      const nd = { id: seq++, parent, v: `f(${k})`, s: 'active' };
      nodes.push(nd);
      if (parent != null) edges.push({ a: parent, b: nd.id });
      t.m[key]++;
      if (k < 2) {
        nd.s = 'done'; nd.sub = `= ${k}`;
        t.step(memoized ? 3 : 2, `<code>fib(${k})</code> — 기저 조건, ${k} 반환.`, snap());
        return k;
      }
      if (memoized && memo[k] !== undefined) {
        nd.s = 'new'; nd.sub = `캐시 ${memo[k]}`;
        t.m['캐시 적중']++;
        t.step(4, `<code>fib(${k})</code> — 이미 계산해 둔 값 <b>${memo[k]}</b>이 있습니다. 아래 가지 전체를 건너뜁니다.`, snap());
        return memo[k];
      }
      const seen = !memoized && nodes.filter((x) => x.v === nd.v).length > 1;
      t.step(memoized ? 5 : 3, seen
        ? `<code>fib(${k})</code> — <b>아까 계산한 값인데 또 처음부터</b> 계산합니다.`
        : `<code>fib(${k})</code> = fib(${k - 1}) + fib(${k - 2}) — 두 갈래로 호출합니다.`, snap());
      if (seen) nd.s = 'bad'; else nd.s = 'cmp';
      const r = fib(k - 1, nd.id) + fib(k - 2, nd.id);
      nd.sub = `= ${r}`;
      if (memoized) {
        memo[k] = r; t.m['추가 메모리 (칸)']++;
        nd.s = 'done';
        t.step(5, `<code>memo[${k}] = ${r}</code> — 결과를 저장해 둡니다.`, snap());
      } else if (nd.s === 'cmp') nd.s = 'done';
      return r;
    };
    const r = fib(n, null);
    t.step(memoized ? 6 : 3, `<code>fib(${n})</code> = <b>${r}</b>. 총 ${t.m[key]}번 호출했습니다.`, snap());
    Object.assign(lay, CS.layoutTree(nodes));
  };
  // 그래프 패널은 w/h가 필요하므로 추적이 끝난 뒤 계산된 배치를 각 스냅샷에 채운다
  const withLayout = (run) => (t, n) => {
    const steps = [];
    const orig = t.step;
    t.step = (line, msg, panels) => { steps.push(panels[0]); orig(line, msg, panels); };
    run(t, n);
    for (const p of steps) { p.w = p.lay.w; p.h = p.lay.h; p.pos = p.lay.pos; }
  };

  CS.add({
    id: 'memoization', level: 'mid',
    title: '메모이제이션: 같은 계산을 두 번 하지 않기',
    summary: '재귀 피보나치는 같은 값을 계속 다시 계산해서 호출 수가 지수적으로 폭발합니다. 결과를 한 번 저장해 두면 트리의 가지가 통째로 사라집니다.',
    param: { label: 'n', options: [5, 6, 7], value: 6 },
    headline: '함수 호출 횟수',
    verdict: 'n이 1 늘 때마다 순수 재귀의 호출 수는 약 1.6배씩 불어납니다(fib(40)은 3억 번 이상). 메모이제이션은 2n − 1번이면 끝납니다.',
    variants: [
      {
        name: '순수 재귀', tone: 'bad', big: { time: 'O(2ⁿ)', space: 'O(n)' },
        code: `function fib(n) {
  if (n < 2) return n;
  return fib(n - 1) + fib(n - 2);
}`,
        notes: { 3: '호출이 2배씩 증가' },
        run: withLayout(fibRun(false)),
      },
      {
        name: '메모이제이션', tone: 'good', big: { time: 'O(n)', space: 'O(n)' },
        code: `const memo = {};
function fib(n) {
  if (n < 2) return n;
  if (memo[n] !== undefined) return memo[n];
  memo[n] = fib(n - 1) + fib(n - 2);
  return memo[n];
}`,
        notes: { 4: '가지 전체를 생략', 5: '메모리 +1' },
        run: withLayout(fibRun(true)),
      },
    ],
    points: [
      '붉은 노드는 <b>이미 계산했던 값을 다시 계산</b>하는 호출입니다. 낭비가 눈에 보입니다.',
      '메모이제이션 = 순수 함수의 결과를 입력값을 키로 캐시하는 것. 동적 계획법(DP)의 출발점입니다.',
      '"겹치는 하위 문제"가 있을 때만 효과가 있습니다. 매번 입력이 다르면 메모리만 낭비합니다.',
    ],
    senior: '캐시는 전부 같은 구조입니다. React의 <code>useMemo</code>, HTTP 캐시, Redis까지. 그리고 전부 같은 숙제를 가집니다: 언제 무효화할 것인가, 얼마나 커지게 둘 것인가. 상한 없는 메모이제이션 객체는 장기 실행 서버에서 가장 흔한 메모리 누수 원인 중 하나입니다. 크기 제한(LRU)과 만료를 함께 설계하세요.',
  });
})();
