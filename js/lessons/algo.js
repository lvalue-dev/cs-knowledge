/* 코딩 테스트 유형: 투 포인터, 누적합, 단조 스택, 유니온 파인드, 다익스트라, 그리디 vs DP, 백트래킹 */
(function () {
  const CS = window.CS;

  /* ---------- 투 포인터 ---------- */
  const TP = [1, 3, 4, 6, 8, 9, 11, 14, 15, 18], TP_TARGET = 29;
  CS.add({
    id: 'two-pointers', level: 'basic',
    title: '투 포인터: 정렬된 배열에서 짝 찾기',
    summary: '정렬된 배열에서 합이 목표값인 두 수를 찾습니다. 모든 쌍을 보는 대신 양 끝에서 좁혀 오면, 한 번 비교할 때마다 후보 한 줄이 통째로 사라집니다.',
    headline: '합 계산 횟수',
    verdict: '합이 작으면 왼쪽을, 크면 오른쪽을 한 칸 옮깁니다. 두 포인터는 서로를 향해서만 움직이므로 전체가 O(n)입니다. 정렬되어 있다는 사실이 "이쪽은 볼 필요 없다"는 근거가 됩니다.',
    variants: [
      {
        name: '모든 쌍 확인', tone: 'bad', big: { time: 'O(n²)', space: 'O(1)' },
        code: `function twoSum(a, target) {
  for (let i = 0; i < a.length; i++) {
    for (let j = i + 1; j < a.length; j++) {
      if (a[i] + a[j] === target) return [i, j];
    }
  }
  return null;
}`,
        notes: { 4: '쌍마다 한 번씩' },
        run(t) {
          t.m['합 계산 횟수'] = 0;
          const snap = (i, j, ok) => [{ type: 'cells', title: `정렬된 배열 · 목표 합 = ${TP_TARGET}`, items: TP.map((v, k) => ({ id: k, v, s: k === i || k === j ? (ok ? 'done' : k === i ? 'active' : 'cmp') : k < i ? 'dim' : '', ptr: k === i ? 'i' : k === j ? 'j' : '' })) }];
          t.step(1, `합이 <b>${TP_TARGET}</b>이 되는 두 수를 찾습니다. 가능한 쌍을 전부 확인합니다.`, snap(-1, -1));
          for (let i = 0; i < TP.length; i++) for (let j = i + 1; j < TP.length; j++) {
            t.m['합 계산 횟수']++;
            const ok = TP[i] + TP[j] === TP_TARGET;
            t.step(4, ok ? `${TP[i]} + ${TP[j]} = <b>${TP_TARGET}</b> — 찾았습니다. ${t.m['합 계산 횟수']}번 만입니다.` : `${TP[i]} + ${TP[j]} = ${TP[i] + TP[j]} — 아닙니다.`, snap(i, j, ok));
            if (ok) return;
          }
        },
      },
      {
        name: '투 포인터', tone: 'good', big: { time: 'O(n)', space: 'O(1)' },
        code: `function twoSum(a, target) {
  let lo = 0, hi = a.length - 1;
  while (lo < hi) {
    const sum = a[lo] + a[hi];
    if (sum === target) return [lo, hi];
    if (sum < target) lo++;
    else hi--;
  }
  return null;
}`,
        notes: { 6: '더 큰 수가 필요', 7: '더 작은 수가 필요' },
        run(t) {
          t.m['합 계산 횟수'] = 0;
          let lo = 0, hi = TP.length - 1;
          const snap = (ok) => [{ type: 'cells', title: `정렬된 배열 · 목표 합 = ${TP_TARGET}`, items: TP.map((v, k) => ({ id: k, v, s: k === lo || k === hi ? (ok ? 'done' : 'active') : k < lo || k > hi ? 'dim' : '', ptr: k === lo ? 'lo' : k === hi ? 'hi' : '' })) }];
          t.step(2, `가장 작은 수와 가장 큰 수에서 시작합니다.`, snap());
          while (lo < hi) {
            const sum = TP[lo] + TP[hi];
            t.m['합 계산 횟수']++;
            if (sum === TP_TARGET) { t.step(5, `${TP[lo]} + ${TP[hi]} = <b>${TP_TARGET}</b> — 찾았습니다. ${t.m['합 계산 횟수']}번 만입니다.`, snap(true)); return; }
            if (sum < TP_TARGET) {
              t.step(6, `${TP[lo]} + ${TP[hi]} = ${sum} — 모자랍니다. ${TP[lo]}은 <b>가장 큰 수와 더해도 모자라므로</b> 어떤 수와도 짝이 될 수 없습니다. 버립니다.`, snap());
              lo++;
            } else {
              t.step(7, `${TP[lo]} + ${TP[hi]} = ${sum} — 넘칩니다. ${TP[hi]}은 <b>가장 작은 수와 더해도 넘치므로</b> 버립니다.`, snap());
              hi--;
            }
          }
        },
      },
    ],
    points: [
      '투 포인터가 성립하려면 <b>단조성</b>이 필요합니다. 포인터를 옮기면 값이 한 방향으로만 변해야 "버려도 된다"고 말할 수 있습니다.',
      '양 끝에서 좁히는 형태(두 수의 합, 회문 검사)와 같은 방향으로 가는 형태(슬라이딩 윈도, 중복 제거)가 있습니다.',
      '정렬되어 있지 않다면 정렬 비용 O(n log n)을 먼저 내거나, 해시맵으로 O(n)에 푸는 방법과 비교합니다.',
    ],
    senior: '실무에서는 "정렬된 두 목록 합치기"가 같은 원리입니다. 두 정렬된 로그 스트림 병합, 버전 비교(diff), 정렬된 ID 목록의 교집합, DB의 merge join이 전부 포인터 두 개를 앞으로만 움직입니다. 데이터가 이미 정렬되어 있다면(인덱스, 시간순 로그) 해시 조인보다 메모리를 훨씬 덜 쓰고 끝낼 수 있습니다.',
  });

  /* ---------- 누적합 ---------- */
  const PS = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3];
  const psQueries = (q) => Array.from({ length: q }, (_, k) => { const l = (k * 3) % 5; return [l, Math.min(9, l + 4 + ((k * 2) % 5))]; });
  CS.add({
    id: 'prefix-sum', level: 'basic',
    title: '누적합: 구간 합을 뺄셈 한 번으로',
    summary: '"l번째부터 r번째까지의 합"을 여러 번 물어봅니다. 물을 때마다 더하는 대신, 앞에서부터의 합을 미리 적어 두면 어떤 구간이든 뺄셈 한 번으로 답합니다.',
    param: { label: '질의 수', options: [3, 6, 12], value: 6 },
    headline: '덧셈·뺄셈 횟수',
    verdict: '준비에 O(n)을 한 번 쓰고, 이후 질의는 구간 길이와 무관하게 O(1)입니다. 질의가 많을수록 차이가 커집니다. "미리 계산해 두고 조회는 싸게"의 가장 단순한 형태입니다.',
    variants: [
      {
        name: '질의마다 다시 더하기', tone: 'bad', big: { time: '질의당 O(n)', space: 'O(1)' },
        code: `function rangeSum(a, l, r) {
  let sum = 0;
  for (let i = l; i <= r; i++) sum += a[i];
  return sum;
}`,
        notes: { 3: '구간 길이만큼 덧셈' },
        run(t, q) {
          t.m['덧셈·뺄셈 횟수'] = 0;
          const out = [];
          const snap = (l, r, i) => [
            { type: 'cells', title: '배열 a', items: PS.map((v, k) => ({ id: k, v, sub: k, s: k === i ? 'active' : k >= l && k <= r ? 'cmp' : 'dim' })) },
            { type: 'cells', title: '질의 결과', items: out.map((v, k) => ({ id: k, v, s: 'done' })) },
          ];
          for (const [l, r] of psQueries(q)) {
            let sum = 0;
            t.step(2, `질의: <code>a[${l}..${r}]</code>의 합은? 처음부터 다시 더합니다.`, snap(l, r, -1));
            for (let i = l; i <= r; i++) { sum += PS[i]; t.m['덧셈·뺄셈 횟수']++; t.step(3, `<code>sum += ${PS[i]}</code> → ${sum}`, snap(l, r, i)); }
            out.push(sum);
            t.step(4, `답 <b>${sum}</b>. 다음 질의가 겹치는 구간이어도 재사용하지 못합니다.`, snap(l, r, -1));
          }
        },
      },
      {
        name: '누적합 배열', tone: 'good', big: { time: '준비 O(n), 질의 O(1)', space: 'O(n)' },
        code: `const pre = [0];
for (const x of a) pre.push(pre.at(-1) + x);

function rangeSum(l, r) {
  return pre[r + 1] - pre[l];
}`,
        notes: { 2: '처음 한 번만', 5: '뺄셈 한 번' },
        run(t, q) {
          t.m['덧셈·뺄셈 횟수'] = 0;
          const pre = [0], out = [];
          const snap = (l, r, hot) => [
            { type: 'cells', title: '배열 a', items: PS.map((v, k) => ({ id: k, v, sub: k, s: l != null && k >= l && k <= r ? 'cmp' : k === hot ? 'active' : l != null ? 'dim' : '' })) },
            { type: 'cells', title: 'pre[k] = a의 앞 k개 합', items: pre.map((v, k) => ({ id: k, v, sub: k, s: l != null ? (k === r + 1 ? 'active' : k === l ? 'bad' : 'dim') : k === pre.length - 1 ? 'new' : '', ptr: l != null ? (k === r + 1 ? '+' : k === l ? '−' : '') : '' })) },
            { type: 'cells', title: '질의 결과', items: out.map((v, k) => ({ id: k, v, s: 'done' })) },
          ];
          t.step(1, `<code>pre[0] = 0</code>에서 시작해, 앞에서부터의 합을 차례로 적어 둡니다.`, snap());
          PS.forEach((x, k) => { pre.push(pre[pre.length - 1] + x); t.m['덧셈·뺄셈 횟수']++; t.step(2, `<code>pre[${k + 1}]</code> = ${pre[k]} + ${x} = <b>${pre[k + 1]}</b>`, snap(null, null, k)); });
          for (const [l, r] of psQueries(q)) {
            const sum = pre[r + 1] - pre[l];
            out.push(sum); t.m['덧셈·뺄셈 횟수']++;
            t.step(5, `<code>a[${l}..${r}]</code> = pre[${r + 1}] − pre[${l}] = ${pre[r + 1]} − ${pre[l]} = <b>${sum}</b>. "앞 ${r + 1}개의 합"에서 "앞 ${l}개의 합"을 빼면 남는 것이 구간입니다.`, snap(l, r));
          }
        },
      },
    ],
    points: [
      '<code>pre</code>를 한 칸 길게(<code>pre[0] = 0</code>) 잡으면 l = 0일 때의 예외 처리가 사라집니다.',
      '2차원으로 확장하면 직사각형 영역의 합도 O(1)입니다(포함-배제).',
      '반대로 "구간에 값을 더하는" 갱신이 많으면 차분 배열을, 갱신과 질의가 섞이면 펜윅 트리·세그먼트 트리를 씁니다.',
    ],
    senior: '대시보드의 "기간별 합계"가 느리다면 같은 처방입니다. 매 요청마다 원본 행을 합산하는 대신 일별 누적 값이나 롤업 테이블을 미리 만들어 두고 두 시점의 차로 답합니다. 시계열 DB의 카운터 지표가 "누적값을 저장하고 rate()로 차이를 구하는" 방식인 것도 같은 이유입니다. 대가는 원본이 수정될 때 누적값을 함께 고쳐야 한다는 점입니다.',
  });

  /* ---------- 단조 스택 ---------- */
  const MS = [9, 8, 6, 7, 5, 3, 10, 4];
  const msPanels = (i, j, ans, stack, popped) => [
    { type: 'cells', bars: true, max: 10, title: '기온 — 각 날짜에서 "더 따뜻해지는 날"까지 며칠?', items: MS.map((v, k) => ({ id: k, v, s: k === i ? 'active' : k === j ? 'cmp' : k === popped ? 'done' : stack && stack.includes(k) ? 'new' : '' })) },
    { type: 'cells', title: '답 (며칠 뒤)', items: ans.map((v, k) => ({ id: k, v: v < 0 ? '–' : v, sub: k, s: v >= 0 ? 'done' : '' })) },
    ...(stack ? [{ type: 'cells', title: '스택 — 아직 답을 못 찾은 날 (기온이 내려가는 순서로 쌓임)', items: stack.map((k) => ({ id: k, v: MS[k], sub: `${k}일`, s: 'new' })) }] : []),
  ];
  CS.add({
    id: 'monotonic-stack', level: 'mid',
    title: '단조 스택: 다음으로 큰 값 찾기',
    summary: '각 원소마다 "오른쪽에서 처음으로 나보다 큰 값"을 찾습니다. 원소마다 오른쪽을 훑으면 O(n²)이지만, 답을 못 찾은 원소들을 스택에 쌓아 두면 한 번의 순회로 끝납니다.',
    headline: '비교 횟수',
    verdict: '모든 원소는 스택에 한 번 들어가고 한 번 나옵니다. 그래서 안쪽 while이 있어도 전체는 O(n)입니다. 스택 안이 항상 내림차순으로 유지된다는 점이 핵심입니다.',
    variants: [
      {
        name: '원소마다 오른쪽 훑기', tone: 'bad', big: { time: 'O(n²)', space: 'O(1)' },
        code: `function nextGreater(a) {
  const ans = Array(a.length).fill(-1);
  for (let i = 0; i < a.length; i++) {
    for (let j = i + 1; j < a.length; j++) {
      if (a[j] > a[i]) { ans[i] = j - i; break; }
    }
  }
  return ans;
}`,
        notes: { 5: '내려가는 구간이 길수록 오래 걸림' },
        run(t) {
          t.m['비교 횟수'] = 0;
          const ans = MS.map(() => -1);
          for (let i = 0; i < MS.length; i++) {
            t.step(3, `${i}일(${MS[i]}°) — 오른쪽으로 가며 더 따뜻한 날을 찾습니다.`, msPanels(i, -1, ans));
            for (let j = i + 1; j < MS.length; j++) {
              t.m['비교 횟수']++;
              if (MS[j] > MS[i]) { ans[i] = j - i; t.step(5, `${MS[j]}° &gt; ${MS[i]}° — 찾았습니다. <b>${j - i}일 뒤.</b>`, msPanels(i, j, ans)); break; }
              t.step(5, `${MS[j]}° ≤ ${MS[i]}° — 아닙니다. 계속.`, msPanels(i, j, ans));
            }
          }
        },
      },
      {
        name: '단조 스택', tone: 'good', big: { time: 'O(n)', space: 'O(n)' },
        code: `function nextGreater(a) {
  const ans = Array(a.length).fill(-1), stack = [];
  for (let i = 0; i < a.length; i++) {
    while (stack.length && a[stack.at(-1)] < a[i]) {
      const j = stack.pop();
      ans[j] = i - j;
    }
    stack.push(i);
  }
  return ans;
}`,
        notes: { 4: '나보다 작은 날들의 답은 "오늘"', 8: '원소당 push 1번' },
        run(t) {
          t.m['비교 횟수'] = 0;
          const ans = MS.map(() => -1), stack = [];
          for (let i = 0; i < MS.length; i++) {
            while (stack.length) {
              t.m['비교 횟수']++;
              const top = stack[stack.length - 1];
              if (MS[top] >= MS[i]) { t.step(4, `스택 맨 위 ${MS[top]}° ≥ 오늘 ${MS[i]}° — 오늘은 누구의 답도 아닙니다.`, msPanels(i, top, ans, [...stack])); break; }
              stack.pop(); ans[top] = i - top;
              t.step(6, `스택 맨 위 ${MS[top]}° &lt; 오늘 ${MS[i]}° — ${top}일의 답은 오늘입니다. <b>${i - top}일 뒤.</b> 스택에서 꺼냅니다.`, msPanels(i, -1, ans, [...stack], top));
            }
            stack.push(i);
            t.step(8, `${i}일(${MS[i]}°)은 아직 답을 모릅니다. 스택에 쌓아 둡니다.`, msPanels(i, -1, ans, [...stack]));
          }
          t.step(10, `끝까지 스택에 남은 날은 더 따뜻한 날이 없습니다. 비교 <b>${t.m['비교 횟수']}번</b>.`, msPanels(-1, -1, ans, [...stack]));
        },
      },
    ],
    points: [
      '스택에는 "아직 답을 기다리는 원소"만 남습니다. 새 원소가 들어올 때 자기보다 작은 것들을 한꺼번에 해결합니다.',
      '중첩 반복처럼 보여도 원소당 push·pop이 각 1번이므로 <b>분할 상환</b>하면 O(n)입니다.',
      '히스토그램에서 가장 큰 직사각형, 빗물 고이는 양, 주식 가격이 떨어지지 않은 기간이 같은 유형입니다.',
    ],
    senior: '"안쪽에 루프가 있으니 O(n²)"이라고 단정하지 않는 것이 포인트입니다. 각 원소가 평생 몇 번 처리되는지를 세는 분할 상환 분석은 동적 배열의 push, 해시 테이블 리사이즈, GC 비용을 이해할 때도 똑같이 쓰입니다. 면접에서 복잡도를 물으면 "최악의 한 번"과 "전체 평균"을 구분해 답하세요.',
  });

  /* ---------- 유니온 파인드 ---------- */
  const ufRun = (compress) => (t) => {
    const N = 6, parent = { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 6 }, st = {};
    t.m['부모 따라가기 횟수'] = 0;
    const snap = () => {
      const nodes = [{ id: 6, parent: null }];
      const add = (p) => { for (let k = 1; k <= N; k++) if (k !== p && parent[k] === p) { nodes.push({ id: k, parent: p }); add(k); } };
      add(6);
      const lay = CS.layoutTree(nodes, 44, 34);
      const W = 5 * 44 + 12, off = (W - lay.w) / 2;
      return [{
        type: 'graph', w: W, h: 5 * 34 + 52, scale: 1.5, title: '화살표 방향이 부모. 맨 위가 대표(루트) — 같은 루트면 같은 그룹',
        nodes: nodes.map((n) => ({ id: n.id, v: n.id, x: lay.pos[n.id].x + off, y: lay.pos[n.id].y, round: true, s: st[n.id] || (n.id === 6 ? 'new' : '') })),
        edges: nodes.filter((n) => n.parent).map((n) => ({ a: n.id, b: n.parent, s: st[n.id] === 'active' ? 'active' : '' })), directed: true,
      }];
    };
    t.step(1, `union을 여러 번 한 결과 1 → 2 → 3 → 4 → 5 → 6으로 길게 이어졌습니다. 이제 "1번은 어느 그룹인가?"를 묻습니다.`, snap());
    const L = compress ? { hop: 3, root: 2, fin: 4 } : { hop: 2, root: 3, fin: 3 };
    for (const q of [1, 2, 1]) {
      for (const k in st) delete st[k];
      const path = [];
      let x = q;
      st[x] = 'active';
      t.step(1, `<code>find(${q})</code> — 부모를 따라 루트까지 올라갑니다.`, snap());
      while (parent[x] !== x) {
        path.push(x); x = parent[x]; t.m['부모 따라가기 횟수']++;
        st[x] = 'active';
        t.step(L.hop, `${path[path.length - 1]}의 부모는 ${x}.${parent[x] === x ? ' 자기 자신이 부모이므로 <b>루트</b>입니다.' : ' 아직 루트가 아닙니다.'}`, snap());
      }
      if (compress && path.some((p) => parent[p] !== x)) {
        for (const p of path) parent[p] = x;
        for (const k in st) st[k] = 'done';
        t.step(3, `돌아오는 길에, 지나온 노드 전부를 <b>루트 바로 아래로</b> 옮겨 붙입니다(경로 압축). 다음에는 한 걸음이면 됩니다.`, snap());
      } else {
        t.step(L.fin, `대표는 <b>${x}</b>. ${compress ? '이미 루트 바로 아래라 한 걸음에 끝났습니다.' : '사슬은 그대로입니다. 다음에 물어도 똑같이 걸어 올라가야 합니다.'}`, snap());
      }
    }
  };
  CS.add({
    id: 'union-find', level: 'mid',
    title: '유니온 파인드: 같은 그룹인가를 빠르게',
    summary: '"A와 B가 연결되어 있는가", "이 간선을 추가하면 사이클이 생기는가"를 반복해서 묻는 문제의 전용 자료구조입니다. 각 원소가 부모를 가리키는 트리이고, 한 줄짜리 최적화가 성능을 바꿉니다.',
    headline: '부모 따라가기 횟수',
    verdict: '경로 압축은 find가 지나간 길을 평평하게 만들어, 다음 질의를 거의 O(1)로 만듭니다. 랭크(작은 트리를 큰 트리 밑에 붙이기)까지 쓰면 사실상 상수 시간입니다.',
    variants: [
      {
        name: '단순 find', tone: 'bad', big: { time: 'find O(n)', space: 'O(n)' },
        code: `function find(x) {
  while (parent[x] !== x) x = parent[x];
  return x;
}`,
        notes: { 2: '사슬 길이만큼 반복' }, run: ufRun(false),
      },
      {
        name: '경로 압축', tone: 'good', big: { time: 'find 거의 O(1)', space: 'O(n)' },
        code: `function find(x) {
  if (parent[x] === x) return x;
  parent[x] = find(parent[x]);
  return parent[x];
}`,
        notes: { 3: '지나온 길을 루트에 직접 연결' }, run: ufRun(true),
      },
    ],
    points: [
      '<code>union(a, b)</code>는 <code>parent[find(a)] = find(b)</code> 한 줄입니다. 두 그룹의 루트를 잇습니다.',
      '간선을 하나씩 추가하며 <code>find(a) === find(b)</code>면 이미 연결된 것 → 사이클. 크루스칼 최소 신장 트리의 핵심입니다.',
      '합치기만 가능하고 <b>끊기는 못 합니다.</b> 삭제가 필요하면 다른 접근(오프라인 처리 등)이 필요합니다.',
    ],
    senior: '네트워크 장비 중 어느 것들이 같은 망인지, 중복 계정 병합(같은 이메일·전화번호를 공유하는 계정을 한 사람으로 묶기), 이미지에서 연결된 영역 찾기가 유니온 파인드 문제입니다. BFS로도 풀 수 있지만 간선이 스트림으로 계속 들어오는 상황에서는 매번 탐색하지 않고 점진적으로 갱신할 수 있다는 점이 다릅니다.',
  });

  /* ---------- 다익스트라 ---------- */
  const DJ_POS = { S: [40, 86], A: [150, 30], B: [270, 30], C: [210, 142], G: [380, 86] };
  const DJ_EDGES = [['S', 'A', 2], ['A', 'B', 2], ['B', 'G', 1], ['S', 'C', 6], ['C', 'G', 4]];
  const djAdj = (u) => DJ_EDGES.filter((e) => e[0] === u || e[1] === u).map((e) => [e[0] === u ? e[1] : e[0], e[2]]);
  const djGraph = (nodeState, edgeState, sub) => ({
    type: 'graph', w: 420, h: 176, scale: 1.5, title: '숫자는 간선의 비용 (소요 시간, 요금 등)',
    nodes: [
      ...Object.keys(DJ_POS).map((id) => ({ id, v: id, x: DJ_POS[id][0], y: DJ_POS[id][1], round: true, s: nodeState(id), sub: sub ? sub(id) : '' })),
      ...DJ_EDGES.map(([a, b, w]) => ({ id: `w${a}${b}`, v: w, bare: true, w: 16, x: (DJ_POS[a][0] + DJ_POS[b][0]) / 2, y: (DJ_POS[a][1] + DJ_POS[b][1]) / 2 })),
    ],
    edges: DJ_EDGES.map(([a, b]) => ({ a, b, s: edgeState(a, b) })),
  });
  const onPath = (path) => (a, b) => (path.some((x, i) => (x === a && path[i + 1] === b) || (x === b && path[i + 1] === a)) ? 'done' : '');
  CS.add({
    id: 'dijkstra', level: 'adv',
    title: '다익스트라: 간선마다 비용이 다를 때의 최단 경로',
    summary: 'BFS는 "거쳐 가는 간선 수"가 가장 적은 길을 찾습니다. 간선마다 비용이 다르면 그것은 최단 경로가 아닙니다. 다익스트라는 "지금까지 비용이 가장 적은 곳"부터 확정해 나갑니다.',
    headline: '찾은 경로의 비용',
    verdict: 'BFS는 간선 2개짜리 길(비용 10)을 답으로 냈고, 다익스트라는 간선 3개짜리 길(비용 5)을 찾았습니다. 비용이 전부 같을 때만 BFS가 최단 경로를 보장합니다.',
    variants: [
      {
        name: 'BFS (간선 수 기준)', tone: 'bad', label: '틀린 답', big: { time: 'O(V + E)', space: 'O(V)' },
        code: `function bfs(start, goal) {
  const queue = [start], prev = {};
  const seen = new Set([start]);
  while (queue.length) {
    const u = queue.shift();
    if (u === goal) return path(prev, goal);
    for (const [v] of graph[u]) {
      if (seen.has(v)) continue;
      seen.add(v); prev[v] = u;
      queue.push(v);
    }
  }
}`,
        notes: { 7: '비용 w를 보지 않음' },
        run(t) {
          t.m['찾은 경로의 비용'] = 0; t.m['꺼낸 노드 수'] = 0;
          const queue = ['S'], seen = new Set(['S']), prev = {}, doneSet = new Set();
          let path = [];
          const snap = (cur) => [djGraph((id) => (path.includes(id) ? 'done' : id === cur ? 'active' : doneSet.has(id) ? 'cmp' : seen.has(id) ? 'new' : ''), onPath(path)),
            { type: 'cells', title: '큐 (먼저 발견한 순서)', items: queue.map((v) => ({ id: v, v, s: 'new' })) }];
          t.step(2, `S에서 G로 가는 가장 싼 길을 찾고 싶습니다. BFS로 시도합니다.`, snap());
          while (queue.length) {
            const u = queue.shift(); doneSet.add(u); t.m['꺼낸 노드 수']++;
            if (u === 'G') {
              for (let x = 'G'; x; x = prev[x]) path.unshift(x);
              const cost = path.slice(1).reduce((s, x, i) => s + DJ_EDGES.find((e) => (e[0] === path[i] && e[1] === x) || (e[1] === path[i] && e[0] === x))[2], 0);
              t.m['찾은 경로의 비용'] = cost;
              t.step(6, `G 도착. 경로 <b>${path.join(' → ')}</b>, 간선은 2개로 가장 적지만 비용은 <b>${cost}</b>입니다. 더 싼 길이 있는데 놓쳤습니다.`, snap(u));
              return;
            }
            const fresh = djAdj(u).filter(([v]) => !seen.has(v));
            for (const [v] of fresh) { seen.add(v); prev[v] = u; queue.push(v); }
            t.step(fresh.length ? 9 : 5, `${u}를 꺼내 이웃 ${fresh.map((x) => x[0]).join(', ') || '없음'}을 큐에 넣습니다. <b>비용은 보지 않고</b> 먼저 발견한 쪽을 그 노드의 경로로 확정합니다.`, snap(u));
          }
        },
      },
      {
        name: '다익스트라 (비용 기준, 힙)', tone: 'good', label: '최소 비용', big: { time: 'O((V + E) log V)', space: 'O(V)' },
        code: `function dijkstra(start) {
  const dist = { [start]: 0 };
  const pq = new MinHeap([[0, start]]);
  while (pq.size) {
    const [d, u] = pq.pop();
    if (d > dist[u]) continue;
    for (const [v, w] of graph[u]) {
      if (d + w < (dist[v] ?? Infinity)) {
        dist[v] = d + w;
        pq.push([dist[v], v]);
      }
    }
  }
  return dist;
}`,
        notes: { 5: '가장 싼 후보부터', 6: '이미 더 싼 길을 찾은 낡은 후보', 8: '더 싸면 갱신' },
        run(t) {
          t.m['찾은 경로의 비용'] = 0; t.m['꺼낸 노드 수'] = 0;
          const dist = { S: 0 }, prev = {}, fixed = new Set();
          let pq = [[0, 'S']], path = [];
          const snap = (cur, hotEdge) => [djGraph((id) => (path.includes(id) ? 'done' : id === cur ? 'active' : fixed.has(id) ? 'cmp' : id in dist ? 'new' : ''),
            (a, b) => (path.length ? onPath(path)(a, b) : hotEdge && ((hotEdge[0] === a && hotEdge[1] === b) || (hotEdge[0] === b && hotEdge[1] === a)) ? 'active' : ''), (id) => (id in dist ? `비용 ${dist[id]}` : '')),
            { type: 'cells', title: '우선순위 큐 [비용, 노드] — 비용이 작은 것부터 나옴', items: pq.map(([d, v]) => ({ id: `${v}${d}`, v: `${d}, ${v}`, s: 'new' })) }];
          t.step(3, `시작점 S의 비용은 0. 후보를 "지금까지의 비용" 순으로 꺼낼 힙을 준비합니다.`, snap());
          while (pq.length) {
            pq.sort((x, y) => x[0] - y[0]);
            const [d, u] = pq.shift();
            if (d > dist[u]) { t.step(6, `[${d}, ${u}] — ${u}는 이미 비용 ${dist[u]}으로 확정됐습니다. 낡은 후보이므로 버립니다.`, snap(u)); continue; }
            fixed.add(u); t.m['꺼낸 노드 수']++;
            t.step(5, `가장 싼 후보 <b>${u}</b>(비용 ${d})를 꺼냅니다. 이보다 싸게 ${u}에 올 방법은 없으므로 <b>확정</b>입니다.`, snap(u));
            if (u === 'G') break;
            for (const [v, w] of djAdj(u)) {
              if (d + w < (dist[v] ?? Infinity)) {
                dist[v] = d + w; prev[v] = u; pq.push([dist[v], v]);
                t.step(9, `${u} → ${v}: ${d} + ${w} = <b>${d + w}</b>. ${v}까지의 최소 비용을 갱신하고 후보에 넣습니다.`, snap(u, [u, v]));
              }
            }
          }
          for (let x = 'G'; x; x = prev[x]) path.unshift(x);
          t.m['찾은 경로의 비용'] = dist.G;
          t.step(14, `G까지의 최소 비용은 <b>${dist.G}</b>, 경로 ${path.join(' → ')}. 간선은 더 많지만 더 쌉니다.`, snap());
        },
      },
    ],
    points: [
      '다익스트라 = BFS의 큐를 <b>우선순위 큐</b>로 바꾼 것. "먼저 발견한 순"이 아니라 "비용이 적은 순"으로 꺼냅니다.',
      '<b>음수 간선이 있으면 틀립니다.</b> "꺼낸 순간 확정"이라는 전제가 깨지기 때문입니다. 그때는 벨만-포드를 씁니다.',
      '격자에서 이동 비용이 0 또는 1뿐이면 덱을 쓰는 0-1 BFS, 모든 쌍의 최단 거리가 필요하면 플로이드-워셜을 검토합니다.',
    ],
    senior: '지도 길찾기, 네트워크 라우팅 프로토콜(OSPF), 환승 최소 비용 계산이 다익스트라입니다. 실제 서비스 규모의 그래프에서는 그대로 쓰기엔 느려서, 목적지 방향으로 탐색을 유도하는 A*나 사전 계산(계층 축약) 같은 기법을 얹습니다. 면접에서는 "왜 음수 간선에서 안 되는가"와 "힙에 같은 노드가 여러 번 들어가도 되는 이유(낡은 후보 건너뛰기)"를 설명할 수 있어야 합니다.',
  });

  /* ---------- 그리디 vs DP ---------- */
  const AMOUNT = 6, COINS = [1, 3, 4];
  CS.add({
    id: 'greedy-dp', level: 'mid',
    title: '그리디 vs DP: 눈앞의 최선이 전체의 최선은 아니다',
    summary: '1원, 3원, 4원 동전으로 6원을 거슬러 줍니다. "가장 큰 동전부터"는 직관적이고 빠르지만 틀린 답을 냅니다. 작은 금액의 정답을 쌓아 올리는 DP가 최적을 보장합니다.',
    headline: '사용한 동전 수',
    verdict: '그리디는 4 + 1 + 1로 3개, DP는 3 + 3으로 2개입니다. 그리디는 한 번 고르면 되돌아보지 않기 때문에, "지금의 최선이 나중에 손해가 되지 않는다"는 증명이 있을 때만 쓸 수 있습니다.',
    variants: [
      {
        name: '그리디 (큰 동전부터)', tone: 'bad', label: '최적이 아님', big: { time: 'O(동전 종류)', space: 'O(1)' },
        code: `function coins(amount) {
  let count = 0;
  for (const c of [4, 3, 1]) {
    while (amount >= c) { amount -= c; count++; }
  }
  return count;
}`,
        notes: { 4: '고른 뒤에는 번복하지 않음' },
        run(t) {
          t.m['사용한 동전 수'] = 0;
          let amount = AMOUNT;
          const used = [];
          const snap = (c) => [
            { type: 'cells', title: '동전 종류', items: [4, 3, 1].map((v) => ({ id: v, v: `${v}원`, s: v === c ? 'active' : '' })) },
            { type: 'cells', title: `낸 동전 (남은 금액 ${amount}원)`, items: used.map((v, k) => ({ id: k, v: `${v}원`, s: 'bad' })) },
          ];
          t.step(2, `${AMOUNT}원을 가장 적은 개수의 동전으로 만들고 싶습니다. 큰 동전부터 집습니다.`, snap());
          for (const c of [4, 3, 1]) {
            if (amount < c) { t.step(3, `${c}원 — 남은 ${amount}원보다 커서 쓸 수 없습니다.`, snap(c)); continue; }
            while (amount >= c) { amount -= c; used.push(c); t.m['사용한 동전 수']++; t.step(4, `${c}원을 냅니다. 남은 금액 <b>${amount}원</b>.${c === 4 ? ' 이 선택이 3원 두 개의 가능성을 없앴습니다.' : ''}`, snap(c)); }
          }
          t.step(6, `4 + 1 + 1 = <b>3개</b>. 매 순간 가장 큰 것을 골랐지만 전체로는 최선이 아닙니다.`, snap());
        },
      },
      {
        name: 'DP (작은 금액부터 채우기)', tone: 'good', label: '최적', big: { time: 'O(금액 × 동전 종류)', space: 'O(금액)' },
        code: `function coins(amount) {
  const dp = [0];
  for (let x = 1; x <= amount; x++) {
    dp[x] = Infinity;
    for (const c of [1, 3, 4]) {
      if (x >= c) dp[x] = Math.min(dp[x], dp[x - c] + 1);
    }
  }
  return dp[amount];
}`,
        notes: { 6: '이미 구한 작은 답 + 동전 1개' },
        run(t) {
          t.m['사용한 동전 수'] = 0;
          const dp = [0];
          const snap = (x, from) => [{ type: 'cells', title: 'dp[x] = x원을 만드는 최소 동전 수', items: Array.from({ length: AMOUNT + 1 }, (_, k) => ({ id: k, v: dp[k] === undefined ? '' : dp[k] === Infinity ? '∞' : dp[k], sub: `${k}원`, s: k === x ? 'active' : k === from ? 'cmp' : dp[k] !== undefined ? 'done' : '' })) }];
          t.step(2, `0원은 동전 0개. 여기서부터 1원, 2원, …의 정답을 차례로 구합니다.`, snap());
          for (let x = 1; x <= AMOUNT; x++) {
            dp[x] = Infinity;
            for (const c of COINS) {
              if (x < c) continue;
              const cand = dp[x - c] + 1, better = cand < dp[x];
              if (better) dp[x] = cand;
              t.step(6, `${x}원: 마지막 동전이 ${c}원이라면 <code>dp[${x - c}] + 1</code> = ${cand}개.${better ? ` 지금까지 중 최선 → <b>${cand}</b>` : ' 더 좋지 않습니다.'}`, snap(x, x - c));
            }
          }
          t.m['사용한 동전 수'] = dp[AMOUNT];
          t.step(9, `<code>dp[${AMOUNT}]</code> = <b>${dp[AMOUNT]}개</b> (3 + 3). 모든 "마지막 동전" 경우를 비교했으므로 최적이 보장됩니다.`, snap(AMOUNT));
        },
      },
    ],
    points: [
      'DP의 두 조건: <b>최적 부분 구조</b>(큰 문제의 최적해가 작은 문제의 최적해로 만들어짐)와 <b>겹치는 하위 문제</b>.',
      'DP를 풀 때는 "dp[x]가 무엇을 뜻하는지"를 한 문장으로 먼저 정의합니다. 점화식은 거기서 나옵니다.',
      '그리디가 맞는 경우도 많습니다(회의실 배정, 동전이 서로 배수 관계일 때). 반례를 못 찾으면 증명을, 찾으면 DP를.',
    ],
    senior: '실무의 그리디 실패는 "가장 싼 것부터", "가장 빠른 것부터" 같은 규칙에서 나옵니다. 배송 묶음, 서버에 작업 배치, 광고 예산 배분에서 국소 최선이 전체 비용을 키우는 일이 흔합니다. 다만 최적해가 NP-난해인 문제(상자 채우기 등)에서는 그리디가 "충분히 좋은 근사"로서 의도적으로 선택됩니다. 중요한 것은 최적이 아님을 알고 쓰는 것입니다.',
  });

  /* ---------- 백트래킹 ---------- */
  const NQ = 4;
  const attacks = (q, r, c) => q.some((qc, qr) => qr < r && qc >= 0 && (qc === c || Math.abs(qc - c) === r - qr));
  const board = (q, hot, bad) => ({
    type: 'cells', cols: NQ, title: `${NQ}×${NQ} 판에 퀸 ${NQ}개 — 같은 줄·대각선에 둘이 있으면 안 됨`,
    items: Array.from({ length: NQ * NQ }, (_, k) => { const r = Math.floor(k / NQ), c = k % NQ; return { id: k, v: q[r] === c ? '♛' : '', s: q[r] === c ? (bad && bad.includes(r) ? 'bad' : r === hot ? 'active' : 'done') : '' }; }),
  });
  CS.add({
    id: 'backtracking', level: 'mid',
    title: '백트래킹: 안 되는 길은 끝까지 가지 않는다',
    summary: '4×4 판에 서로 공격하지 않게 퀸 4개를 놓습니다. 가능한 배치를 전부 만들어 검사하는 방법과, 놓는 순간 막힌 길을 바로 포기하는 방법을 비교합니다.',
    headline: '검사한 배치 수',
    verdict: '완전 탐색은 "다 놓고 나서" 검사하고, 백트래킹은 "놓을 때마다" 검사합니다. 첫 두 줄에서 이미 충돌했다면 그 아래의 모든 배치는 볼 필요가 없습니다. 이것이 가지치기입니다.',
    variants: [
      {
        name: '완전 탐색 (다 놓고 검사)', tone: 'bad', big: { time: 'O(Nᴺ)', space: 'O(N)' },
        code: `function solve() {
  for (const board of allBoards(N)) {
    if (isValid(board)) return board;
  }
}`,
        notes: { 2: 'Nᴺ가지 전부 생성', 3: '완성된 뒤에야 검사' },
        run(t) {
          t.m['검사한 배치 수'] = 0;
          for (let code = 0; code < NQ ** NQ; code++) {
            const q = Array.from({ length: NQ }, (_, r) => Math.floor(code / NQ ** (NQ - 1 - r)) % NQ);
            const bad = q.map((c, r) => (attacks(q, r, c) ? r : -1)).filter((r) => r >= 0);
            t.m['검사한 배치 수']++;
            if (!bad.length) { t.step(3, `${t.m['검사한 배치 수']}번째 배치 — 충돌 없음. <b>해를 찾았습니다.</b>`, [board(q)]); return; }
            const first = bad[0];
            t.step(3, `${t.m['검사한 배치 수']}번째 배치 — ${first + 1}번째 줄에서 충돌.${first < NQ - 1 ? ` 아래 줄을 어떻게 바꿔도 소용없지만, 그 배치들도 <b>전부 만들어 검사</b>합니다.` : ''}`, [board(q, -1, bad)]);
          }
        },
      },
      {
        name: '백트래킹 (놓을 때마다 검사)', tone: 'good', big: { time: '가지치기로 크게 감소', space: 'O(N)' },
        code: `function place(row) {
  if (row === N) return true;
  for (let col = 0; col < N; col++) {
    if (attacked(row, col)) continue;
    queens[row] = col;
    if (place(row + 1)) return true;
    queens[row] = -1;
  }
  return false;
}`,
        notes: { 4: '여기서 가지 전체를 잘라냄', 7: '되돌리고 다음 칸 시도' },
        run(t) {
          t.m['검사한 배치 수'] = 0;
          const q = Array(NQ).fill(-1);
          const place = (row) => {
            if (row === NQ) return true;
            for (let col = 0; col < NQ; col++) {
              t.m['검사한 배치 수']++;
              if (attacks(q, row, col)) {
                q[row] = col;
                t.step(4, `${row + 1}번째 줄 ${col + 1}번 칸 — 위쪽 퀸에게 공격당합니다. <b>이 아래는 볼 필요가 없습니다.</b>`, [board([...q], -1, [row])]);
                q[row] = -1;
                continue;
              }
              q[row] = col;
              t.step(5, `${row + 1}번째 줄 ${col + 1}번 칸 — 안전합니다. 놓고 다음 줄로 갑니다.`, [board([...q], row)]);
              if (place(row + 1)) return true;
              q[row] = -1;
              t.step(7, `아래 줄에 놓을 곳이 없었습니다. ${row + 1}번째 줄의 퀸을 <b>거두고</b> 다음 칸을 시도합니다.`, [board([...q])]);
            }
            return false;
          };
          place(0);
          t.step(2, `모든 줄에 놓았습니다. 검사 <b>${t.m['검사한 배치 수']}번</b>으로 해를 찾았습니다.`, [board([...q])]);
        },
      },
    ],
    points: [
      '백트래킹 = DFS + <b>가지치기</b>. "선택 → 재귀 → 선택 취소"의 세 박자가 뼈대입니다.',
      '가지치기 조건이 일찍, 싸게 판정될수록 효과가 큽니다. 선택 순서를 "제약이 강한 것부터"로 바꾸는 것도 방법입니다.',
      '순열·조합·부분집합 생성, 스도쿠, 단어 퍼즐이 같은 틀입니다. n이 작다는 것(보통 20 이하)이 문제에서 주는 신호입니다.',
    ],
    senior: '최악의 경우 여전히 지수 시간이라는 점은 변하지 않습니다. 실무에서 이런 탐색(일정 배치, 설정 조합 검증, 의존성 버전 해결)이 필요하면 직접 짜기 전에 SAT/제약 해결기나 기존 라이브러리를 먼저 검토하세요. 패키지 매니저의 의존성 해결기가 가끔 몇 분씩 걸리는 것도 내부에서 이 탐색을 하고 있기 때문입니다.',
  });
})();
