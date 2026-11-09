/* 기초: 탐색, 배열 vs 연결 리스트, 콜 스택, Big-O */
(function () {
  const CS = window.CS;

  /* ---------- 1. 선형 탐색 vs 이진 탐색 ---------- */
  const sorted = (n) => Array.from({ length: n }, (_, i) => i * 3 + 2);
  CS.add({
    id: 'search', level: 'basic',
    title: '선형 탐색 vs 이진 탐색',
    summary: '같은 배열에서 같은 값을 찾는데, 한쪽은 하나씩 다 보고 다른 쪽은 매번 절반을 버립니다. n을 키워 보면 차이가 어떻게 벌어지는지 보입니다.',
    param: { label: '배열 크기 n', options: [16, 32, 64], value: 32 },
    headline: '비교 횟수',
    verdict: 'n이 2배가 되면 선형 탐색의 비교는 2배가 되지만, 이진 탐색은 딱 1번 늘어납니다. 이것이 O(n)과 O(log n)의 차이입니다.',
    variants: [
      {
        name: '선형 탐색', tone: 'bad', big: { time: 'O(n)', space: 'O(1)' },
        code: `function find(arr, target) {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] === target) return i;
  }
  return -1;
}`,
        notes: { 2: '최대 n번 반복' },
        run(t, n) {
          const a = sorted(n), target = a[n - 3];
          t.m['비교 횟수'] = 0;
          const snap = (i, found) => [{
            type: 'cells', title: `arr (n = ${n}) · target = ${target}`,
            items: a.map((v, k) => ({ id: k, v, s: k === i ? (found ? 'done' : 'active') : k < i ? 'dim' : '', ptr: k === i ? 'i' : '' })),
          }];
          t.step(1, `정렬된 배열에서 <b>${target}</b>을 찾습니다. 앞에서부터 하나씩 확인합니다.`, snap(-1));
          for (let i = 0; i < n; i++) {
            t.step(2, `<code>i = ${i}</code> — 아직 배열 끝이 아니므로 계속합니다.`, snap(i));
            t.m['비교 횟수']++;
            if (a[i] === target) {
              t.step(3, `<code>arr[${i}]</code> = ${a[i]} — 찾았습니다! 여기까지 <b>${i + 1}번</b> 비교했습니다.`, snap(i, true));
              return;
            }
            t.step(3, `<code>arr[${i}]</code> = ${a[i]} ≠ ${target}. 이 칸 하나만 후보에서 제외됩니다.`, snap(i));
          }
        },
      },
      {
        name: '이진 탐색', tone: 'good', big: { time: 'O(log n)', space: 'O(1)' },
        code: `function find(arr, target) {
  let lo = 0, hi = arr.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] === target) return mid;
    if (arr[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}`,
        notes: { 3: '최대 log₂n번 반복', 6: '왼쪽 절반 버림', 7: '오른쪽 절반 버림' },
        run(t, n) {
          const a = sorted(n), target = a[n - 3];
          t.m['비교 횟수'] = 0;
          let lo = 0, hi = n - 1;
          const snap = (mid, found) => [{
            type: 'cells', title: `arr (n = ${n}) · target = ${target} · 남은 후보 ${Math.max(0, hi - lo + 1)}칸`,
            items: a.map((v, k) => ({
              id: k, v,
              s: k === mid ? (found ? 'done' : 'active') : k < lo || k > hi ? 'dim' : 'cmp',
              ptr: [k === lo && 'lo', k === mid && 'mid', k === hi && 'hi'].filter(Boolean).join('·'),
            })),
          }];
          t.step(2, `탐색 범위를 배열 전체(<code>lo = 0, hi = ${hi}</code>)로 잡습니다. 정렬되어 있다는 사실을 이용합니다.`, snap(-1));
          while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            t.step(4, `가운데 칸 <code>mid = ${mid}</code>를 고릅니다.`, snap(mid));
            t.m['비교 횟수']++;
            if (a[mid] === target) {
              t.step(5, `<code>arr[${mid}]</code> = ${a[mid]} — 찾았습니다! 단 <b>${t.m['비교 횟수']}번</b> 만에 끝났습니다.`, snap(mid, true));
              return;
            }
            if (a[mid] < target) {
              const cut = mid - lo + 1;
              lo = mid + 1;
              t.step(6, `${a[mid]} &lt; ${target} → 왼쪽 <b>${cut}칸을 한 번에</b> 버립니다.`, snap(mid));
            } else {
              const cut = hi - mid + 1;
              hi = mid - 1;
              t.step(7, `${a[mid]} &gt; ${target} → 오른쪽 <b>${cut}칸을 한 번에</b> 버립니다.`, snap(mid));
            }
          }
        },
      },
    ],
    points: [
      '코드 왼쪽의 붉은 막대와 <code>×N</code>은 그 줄이 실행된 횟수입니다. 느린 코드는 특정 줄이 뜨겁게 달아오릅니다.',
      '이진 탐색은 <b>정렬된 데이터</b>에서만 쓸 수 있습니다. 정렬이라는 사전 비용을 내고 조회를 싸게 만드는 거래입니다.',
      '100만 건이면 선형은 최대 100만 번, 이진은 최대 20번 비교합니다.',
    ],
    senior: 'DB 인덱스, <code>git bisect</code>, 장애 원인 배포 찾기까지 전부 같은 원리입니다. "후보를 매번 절반으로 줄일 수 있는가?"를 묻는 습관이 생기면 문제를 보는 눈이 달라집니다.',
  });

  /* ---------- 2. 배열 vs 연결 리스트: 맨 앞 삽입 ---------- */
  CS.add({
    id: 'array-vs-list', level: 'basic',
    title: '배열 vs 연결 리스트: 맨 앞에 넣기',
    summary: '배열의 맨 앞에 값을 넣으면 뒤의 모든 원소가 한 칸씩 밀립니다. 연결 리스트는 포인터 두 개만 바꿉니다. unshift 한 줄 뒤에 숨은 비용입니다.',
    param: { label: '기존 원소 수 n', options: [6, 9, 12], value: 9 },
    headline: '메모리 쓰기',
    verdict: '배열 맨 앞 삽입은 원소 수만큼 쓰기가 발생합니다(O(n)). 연결 리스트는 n과 무관하게 항상 3번입니다(O(1)).',
    variants: [
      {
        name: '배열 맨 앞 삽입 (unshift)', tone: 'bad', big: { time: 'O(n)', space: 'O(1)' },
        code: `function pushFront(arr, x) {
  for (let i = arr.length; i > 0; i--) {
    arr[i] = arr[i - 1];
  }
  arr[0] = x;
}`,
        notes: { 3: '원소마다 1번 복사' },
        run(t, n) {
          const a = Array.from({ length: n }, (_, i) => ({ id: 'e' + i, v: (i + 1) * 10 }));
          a.push({ id: 'hole', v: '', s: 'hole' });
          t.m['메모리 쓰기'] = 0;
          const snap = (hot) => [{
            type: 'cells', title: '연속된 메모리 칸 (index 순서)',
            items: a.map((e, k) => ({ ...e, s: e.s || (k === hot ? 'active' : ''), sub: k })),
          }];
          t.step(1, `배열 맨 앞에 <b>5</b>를 넣으려 합니다. 하지만 0번 칸에는 이미 값이 있습니다.`, snap(-1));
          for (let i = n; i > 0; i--) {
            t.step(2, `<code>i = ${i}</code> — 뒤에서부터 자리를 비워 갑니다.`, snap(i - 1));
            [a[i], a[i - 1]] = [a[i - 1], a[i]];
            t.m['메모리 쓰기']++;
            t.step(3, `<code>arr[${i}] = arr[${i - 1}]</code> — ${a[i].v}을 오른쪽으로 한 칸 복사합니다.`, snap(i));
          }
          a[0] = { id: 'new', v: 5, s: 'new' };
          t.m['메모리 쓰기']++;
          t.step(5, `이제야 0번 칸이 비었습니다. 값 하나 넣으려고 <b>${n + 1}번</b> 메모리에 썼습니다.`, snap(-1));
        },
      },
      {
        name: '연결 리스트 맨 앞 삽입', tone: 'good', big: { time: 'O(1)', space: 'O(1)' },
        code: `function pushFront(list, x) {
  const node = { value: x, next: null };
  node.next = list.head;
  list.head = node;
}`,
        notes: { 3: '포인터 1개', 4: '포인터 1개' },
        run(t, n) {
          t.m['메모리 쓰기'] = 0;
          const nodes = Array.from({ length: n }, (_, i) => ({ id: 'e' + i, v: (i + 1) * 10, x: 110 + i * 54, y: 84 }));
          const chain = nodes.slice(1).map((nd, i) => ({ a: 'e' + i, b: nd.id }));
          const head = { id: 'head', v: 'head', x: 40, y: 26, w: 44, s: 'cmp' };
          const fresh = { id: 'new', v: 5, x: 40, y: 84, s: 'new' };
          const snap = (stage) => [{
            type: 'graph', title: '노드는 메모리 여기저기에 흩어져 있고, 포인터로 이어집니다', directed: true,
            w: 110 + n * 54, h: 112,
            nodes: [head, ...(stage >= 1 ? [fresh] : []), ...nodes],
            edges: [
              ...chain,
              stage >= 3 ? { a: 'head', b: 'new', s: 'active' } : { a: 'head', b: 'e0' },
              ...(stage >= 2 ? [{ a: 'new', b: 'e0', s: stage === 2 ? 'active' : '' }] : []),
            ],
          }];
          t.step(1, `연결 리스트 맨 앞에 <b>5</b>를 넣습니다. 기존 노드는 아무도 움직이지 않습니다.`, snap(0));
          t.m['메모리 쓰기']++;
          t.step(2, `새 노드를 하나 만듭니다. 메모리 어디에 있어도 상관없습니다.`, snap(1));
          t.m['메모리 쓰기']++;
          t.step(3, `새 노드의 <code>next</code>가 기존 첫 노드를 가리키게 합니다.`, snap(2));
          t.m['메모리 쓰기']++;
          t.step(4, `<code>head</code>를 새 노드로 바꾸면 끝. 원소가 100만 개여도 <b>3번</b>입니다.`, snap(3));
        },
      },
    ],
    points: [
      '배열은 <b>연속된 메모리</b>라서 인덱스 접근이 O(1)이지만, 중간·앞 삽입은 뒤를 전부 밀어야 합니다.',
      '연결 리스트는 삽입이 O(1)이지만, k번째 원소를 찾으려면 처음부터 따라가야 합니다(O(n)).',
      '루프 안에서 <code>arr.unshift()</code>나 <code>[x, ...arr]</code>를 쓰면 O(n²)이 됩니다.',
    ],
    senior: '그런데 실무에서는 배열이 이기는 경우가 훨씬 많습니다. 연속 메모리는 CPU 캐시에 통째로 올라오지만, 연결 리스트 노드는 따라갈 때마다 캐시 미스가 납니다. Big-O만 보지 말고 "심화 › CPU 캐시와 메모리 지역성"을 함께 보세요. 앞쪽 삽입·삭제가 잦다면 연결 리스트보다 링 버퍼(덱)가 보통 정답입니다.',
  });

  /* ---------- 3. 재귀와 콜 스택 ---------- */
  CS.add({
    id: 'call-stack', level: 'basic',
    title: '재귀와 콜 스택',
    summary: '함수를 호출할 때마다 스택에 프레임이 쌓입니다. 재귀는 돌아올 때까지 프레임을 전부 들고 있고, 반복문은 프레임 하나로 끝냅니다.',
    param: { label: 'n', options: [4, 6, 8], value: 6 },
    headline: '최대 스택 깊이',
    verdict: '결과는 같지만 재귀는 n개의 프레임을 메모리에 쌓습니다. n이 수만 단위가 되면 "Maximum call stack size exceeded"가 나는 이유입니다.',
    variants: [
      {
        name: '재귀', tone: 'bad', big: { time: 'O(n)', space: 'O(n)' },
        code: `function fact(n) {
  if (n <= 1) return 1;
  return n * fact(n - 1);
}`,
        notes: { 3: '호출마다 프레임 +1' },
        run(t, n) {
          const frames = [];
          t.m['최대 스택 깊이'] = 0; t.m['함수 호출'] = 0;
          const snap = () => [{ type: 'stack', title: '콜 스택 (아래에서 위로 쌓임)', items: frames.map((f) => ({ ...f })) }];
          const rec = (k) => {
            frames.push({ id: k, v: `fact(${k})`, s: 'active' });
            if (frames.length > 1) frames[frames.length - 2].s = 'cmp';
            t.m['함수 호출']++;
            t.m['최대 스택 깊이'] = Math.max(t.m['최대 스택 깊이'], frames.length);
            t.step(1, `<code>fact(${k})</code> 호출 — 새 프레임이 스택에 쌓입니다. (깊이 ${frames.length})`, snap());
            if (k <= 1) {
              frames[frames.length - 1] = { id: k, v: 'fact(1) → 1', s: 'done' };
              t.step(2, `기저 조건 도달. <b>1</b>을 반환하고, 이제부터 쌓인 프레임을 하나씩 걷어 냅니다.`, snap());
              frames.pop();
              return 1;
            }
            t.step(3, `<code>${k} * fact(${k - 1})</code> — 곱하려면 <code>fact(${k - 1})</code>이 먼저 끝나야 합니다. 이 프레임은 <b>대기 상태로 메모리에 남습니다.</b>`, snap());
            const r = rec(k - 1);
            frames[frames.length - 1] = { id: k, v: `fact(${k}) → ${k} × ${r} = ${k * r}`, s: 'done' };
            t.step(3, `<code>fact(${k - 1})</code>이 ${r}을 돌려줬습니다. ${k} × ${r} = <b>${k * r}</b> 반환 후 프레임 제거.`, snap());
            frames.pop();
            return k * r;
          };
          rec(n);
        },
      },
      {
        name: '반복문', tone: 'good', big: { time: 'O(n)', space: 'O(1)' },
        code: `function fact(n) {
  let result = 1;
  for (let i = 2; i <= n; i++) {
    result *= i;
  }
  return result;
}`,
        notes: { 4: '프레임 추가 없음' },
        run(t, n) {
          t.m['최대 스택 깊이'] = 1; t.m['함수 호출'] = 1;
          let result = 1;
          const snap = (i, s) => [
            { type: 'stack', title: '콜 스택', items: [{ id: 'f', v: `fact(${n})`, s: 'active' }] },
            { type: 'cells', title: '지역 변수 (프레임 하나 안에서 값만 바뀜)', items: [{ id: 'i', v: i ?? '–', sub: 'i' }, { id: 'r', v: result, sub: 'result', s }] },
          ];
          t.step(1, `<code>fact(${n})</code> 호출 — 프레임은 이것 하나뿐입니다.`, snap());
          t.step(2, `<code>result = 1</code>`, snap(null, 'active'));
          for (let i = 2; i <= n; i++) {
            t.step(3, `<code>i = ${i}</code>`, snap(i));
            result *= i;
            t.step(4, `<code>result *= ${i}</code> → <b>${result}</b>. 같은 변수를 덮어쓸 뿐 스택은 그대로입니다.`, snap(i, 'active'));
          }
          t.step(6, `<b>${result}</b> 반환. 스택 깊이는 끝까지 1이었습니다.`, snap(n, 'done'));
        },
      },
    ],
    points: [
      '스택 프레임에는 인자, 지역 변수, 돌아갈 주소가 들어갑니다. 함수가 <b>반환해야</b> 사라집니다.',
      '재귀 깊이 = 동시에 살아 있는 프레임 수 = 공간 복잡도.',
      '트리 순회처럼 깊이가 log n으로 보장되면 재귀가 더 읽기 좋고 안전합니다.',
    ],
    senior: '사용자 입력이 재귀 깊이를 결정하는 코드(중첩 JSON 파서, 댓글 트리, 그래프 탐색)는 스택 오버플로 공격 지점이 됩니다. 깊이 제한을 두거나 명시적 스택(배열)을 쓰는 반복문으로 바꾸세요. JS 엔진 대부분은 꼬리 호출 최적화를 해 주지 않습니다.',
  });

  /* ---------- 4. Big-O 체감: 중복 찾기 ---------- */
  const dupInput = (n) => { const a = CS.perm(n, 11); a[n - 1] = a[n - 2]; return a; };
  CS.add({
    id: 'big-o', level: 'basic',
    title: 'Big-O 체감하기: 이중 루프 vs Set',
    summary: '배열에 중복이 있는지 찾는 두 가지 방법입니다. 이중 for문은 모든 쌍을 비교하고, Set은 "본 적 있는지"를 한 번에 답합니다. 메모리를 써서 시간을 사는 거래입니다.',
    param: { label: '배열 크기 n', options: [8, 12, 16], value: 12 },
    headline: '비교 횟수',
    verdict: 'n이 2배가 되면 이중 루프의 비교는 약 4배가 됩니다. Set은 2배만 늘지만, 대신 원소 수만큼 메모리를 더 씁니다.',
    variants: [
      {
        name: '이중 루프', tone: 'bad', big: { time: 'O(n²)', space: 'O(1)' },
        code: `function hasDup(arr) {
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      if (arr[i] === arr[j]) return true;
    }
  }
  return false;
}`,
        notes: { 2: 'n번', 4: 'n × n / 2번' },
        run(t, n) {
          const a = dupInput(n);
          t.m['비교 횟수'] = 0; t.m['추가 메모리 (칸)'] = 0;
          const snap = (i, j, found) => [{
            type: 'cells', title: `arr (n = ${n}) — 모든 쌍 (i, j)을 확인`,
            items: a.map((v, k) => ({ id: k, v, s: k === i ? (found ? 'bad' : 'active') : k === j ? (found ? 'bad' : 'cmp') : k < i ? 'dim' : '', ptr: k === i ? 'i' : k === j ? 'j' : '' })),
          }];
          t.step(1, `중복이 있는지 확인합니다. (최악의 경우: 중복이 맨 끝에 있음)`, snap(-1, -1));
          for (let i = 0; i < n; i++) {
            t.step(2, `<code>i = ${i}</code> — 이 원소를 뒤의 <b>모든</b> 원소와 비교합니다.`, snap(i, -1));
            for (let j = i + 1; j < n; j++) {
              t.m['비교 횟수']++;
              if (a[i] === a[j]) {
                t.step(4, `<code>arr[${i}] === arr[${j}]</code> — 중복 발견! 총 <b>${t.m['비교 횟수']}번</b> 비교했습니다.`, snap(i, j, true));
                return;
              }
              t.step(4, `${a[i]} vs ${a[j]} — 다릅니다.`, snap(i, j));
            }
          }
        },
      },
      {
        name: 'Set (해시)', tone: 'good', big: { time: 'O(n)', space: 'O(n)' },
        code: `function hasDup(arr) {
  const seen = new Set();
  for (const x of arr) {
    if (seen.has(x)) return true;
    seen.add(x);
  }
  return false;
}`,
        notes: { 3: 'n번', 4: 'O(1) 조회', 5: '메모리 +1' },
        run(t, n) {
          const a = dupInput(n), seen = [];
          t.m['비교 횟수'] = 0; t.m['추가 메모리 (칸)'] = 0;
          const snap = (i, hit) => [
            { type: 'cells', title: `arr (n = ${n})`, items: a.map((v, k) => ({ id: k, v, s: k === i ? (hit ? 'bad' : 'active') : k < i ? 'dim' : '', ptr: k === i ? 'x' : '' })) },
            { type: 'cells', title: 'seen (Set) — 지금까지 본 값', items: seen.map((v) => ({ id: v, v, s: hit && v === a[i] ? 'bad' : 'new' })) },
          ];
          t.step(2, `"본 적 있는 값"을 기억할 Set을 만듭니다.`, snap(-1));
          for (let i = 0; i < n; i++) {
            t.m['비교 횟수']++;
            if (seen.includes(a[i])) {
              t.step(4, `<code>seen.has(${a[i]})</code> → 있습니다! 중복 발견. 총 <b>${t.m['비교 횟수']}번</b> 조회했습니다.`, snap(i, true));
              return;
            }
            t.step(4, `<code>seen.has(${a[i]})</code> → 없음. Set 조회는 원소 수와 무관하게 한 번에 끝납니다.`, snap(i));
            seen.push(a[i]);
            t.m['추가 메모리 (칸)']++;
            t.step(5, `<code>seen.add(${a[i]})</code> — 기억해 둡니다. 메모리를 한 칸 더 씁니다.`, snap(i));
          }
        },
      },
    ],
    points: [
      '중첩 루프가 보이면 "안쪽 루프를 해시 조회로 바꿀 수 있나?"부터 생각합니다.',
      'n = 10,000이면 이중 루프는 약 5천만 번, Set은 1만 번입니다.',
      '공짜는 없습니다. Set은 O(n) 메모리를 씁니다. <b>시간-공간 트레이드오프</b>의 가장 흔한 예입니다.',
    ],
    senior: '<code>arr.includes()</code>, <code>indexOf()</code>, <code>find()</code>를 루프나 <code>filter</code> 안에서 쓰는 코드는 겉보기엔 한 줄이지만 O(n²)입니다. 데이터가 100건일 때는 아무도 모르다가 10만 건이 되는 날 장애가 됩니다. 코드 리뷰에서 가장 자주 잡아야 하는 패턴입니다.',
  });
})();
