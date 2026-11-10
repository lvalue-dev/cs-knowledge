/* 중급(실전): 힙, BFS/DFS, Trie, LRU 캐시, 슬라이딩 윈도, 위상 정렬 */
(function () {
  const CS = window.CS;

  /* ---------- 힙(우선순위 큐) ---------- */
  const POPS = 3;
  CS.add({
    id: 'heap', level: 'mid',
    title: '힙(우선순위 큐): 가장 급한 것부터 꺼내기',
    summary: '작업 큐, 타이머, 스케줄러는 "남은 것 중 가장 작은 값"을 계속 꺼냅니다. 배열을 매번 훑으면 꺼낼 때마다 전부를 봐야 하지만, 힙은 트리의 한 줄기만 내려갑니다.',
    param: { label: '대기 중인 작업 수 n', options: [7, 15, 31], value: 15 },
    headline: '비교 횟수',
    verdict: '배열은 꺼낼 때마다 n번, 힙은 트리 높이인 log n 수준만 비교합니다. n이 100만이면 한 번 꺼내는 데 100만 번 대 약 40번입니다.',
    variants: [
      {
        name: '배열에서 최솟값 찾기', tone: 'bad', big: { time: 'pop O(n)', space: 'O(1)' },
        code: `function popMin(jobs) {
  let best = 0;
  for (let i = 1; i < jobs.length; i++) {
    if (jobs[i] < jobs[best]) best = i;
  }
  return jobs.splice(best, 1)[0];
}`,
        notes: { 4: '남은 작업 전부와 비교', 6: '뒤 원소를 당겨 채움' },
        run(t, n) {
          const a = CS.perm(n, 9), out = [];
          t.m['비교 횟수'] = 0;
          const snap = (i, best) => [
            { type: 'cells', title: `jobs — 숫자가 작을수록 급한 작업 (${a.length}개 대기)`, items: a.map((v, k) => ({ id: v, v, s: k === best ? 'active' : k === i ? 'cmp' : k < i ? 'dim' : '', ptr: k === best ? 'best' : '' })) },
            { type: 'cells', title: '꺼낸 순서', items: out.map((v) => ({ id: v, v, s: 'done' })) },
          ];
          for (let p = 0; p < POPS; p++) {
            let best = 0;
            t.step(2, `${p + 1}번째 꺼내기 — 어느 것이 가장 작은지 모르므로 처음부터 훑습니다.`, snap(0, 0));
            for (let i = 1; i < a.length; i++) {
              t.m['비교 횟수']++;
              if (a[i] < a[best]) best = i;
              t.step(4, `${a[i]}와 비교 — 지금까지 최솟값은 <b>${a[best]}</b>.`, snap(i, best));
            }
            out.push(a.splice(best, 1)[0]);
            t.step(6, `<b>${out[out.length - 1]}</b>을 꺼냈습니다. 다음에 꺼낼 때는 또 처음부터 전부 봐야 합니다.`, snap(-1, -1));
          }
        },
      },
      {
        name: '최소 힙', tone: 'good', big: { time: 'pop O(log n)', space: 'O(1)' },
        code: `function popMin(heap) {
  const top = heap[0], last = heap.pop();
  if (heap.length) heap[0] = last;
  let i = 0;
  while (true) {
    let c = 2 * i + 1;
    if (c + 1 < heap.length && heap[c + 1] < heap[c]) c++;
    if (c >= heap.length || heap[i] <= heap[c]) break;
    swap(heap, i, c); i = c;
  }
  return top;
}`,
        notes: { 2: '최솟값은 항상 루트', 5: '트리 높이만큼만 반복' },
        run(t, n) {
          const h = CS.perm(n, 9), out = [];
          const less = (i, j) => h[i] < h[j];
          for (let s = (n >> 1) - 1; s >= 0; s--) { // heapify (화면에는 완성된 힙부터 보여 준다)
            for (let i = s; ;) { let c = 2 * i + 1; if (c + 1 < n && less(c + 1, c)) c++; if (c >= n || h[i] <= h[c]) break; [h[i], h[c]] = [h[c], h[i]]; i = c; }
          }
          t.m['비교 횟수'] = 0;
          const depth = Math.floor(Math.log2(n)), W = 2 ** depth * 38 + 20;
          const pos = (k) => { const d = Math.floor(Math.log2(k + 1)), j = k + 1 - 2 ** d; return { x: ((j + 0.5) / 2 ** d) * W, y: d * 46 + 22 }; };
          const snap = (hot = {}) => [
            {
              type: 'graph', w: W, h: depth * 46 + 48, scale: 1.4, title: `최소 힙 — 부모는 항상 자식보다 작다 (${h.length}개 대기)`,
              nodes: h.map((v, k) => ({ id: v, v, ...pos(k), round: true, s: hot[k] || '' })),
              edges: h.map((v, k) => (k ? { a: h[(k - 1) >> 1], b: v, s: hot[k] && hot[(k - 1) >> 1] ? 'active' : '' } : null)).filter(Boolean),
            },
            { type: 'cells', title: '꺼낸 순서', items: out.map((v) => ({ id: v, v, s: 'done' })) },
          ];
          for (let p = 0; p < POPS; p++) {
            t.step(2, `${p + 1}번째 꺼내기 — 최솟값은 찾을 필요 없이 <b>루트(${h[0]})</b>입니다.`, snap({ 0: 'done' }));
            out.push(h[0]);
            const last = h.pop();
            if (h.length) h[0] = last;
            t.step(3, `빈 루트에 맨 끝 원소 <b>${last}</b>를 올립니다. 이제 제자리를 찾아 내려보냅니다.`, snap({ 0: 'active' }));
            let i = 0;
            while (true) {
              let c = 2 * i + 1;
              if (c + 1 < h.length) { t.m['비교 횟수']++; if (h[c + 1] < h[c]) c++; }
              if (c >= h.length) { t.step(8, `자식이 없습니다. 여기가 제자리입니다.`, snap({ [i]: 'done' })); break; }
              t.m['비교 횟수']++;
              if (h[i] <= h[c]) { t.step(8, `${h[i]} ≤ ${h[c]} — 자식보다 작으므로 여기가 제자리입니다.`, snap({ [i]: 'done', [c]: 'cmp' })); break; }
              t.step(7, `두 자식 중 더 작은 <b>${h[c]}</b>와 비교합니다. ${h[i]} &gt; ${h[c]}이므로 내려가야 합니다.`, snap({ [i]: 'active', [c]: 'cmp' }));
              [h[i], h[c]] = [h[c], h[i]];
              i = c;
              t.step(9, `교환. <b>한 층</b> 내려왔습니다. 반대쪽 가지는 쳐다보지도 않습니다.`, snap({ [i]: 'active' }));
            }
          }
          t.step(11, `${POPS}개를 꺼내는 데 비교 <b>${t.m['비교 횟수']}번</b>이면 충분했습니다.`, snap());
        },
      },
    ],
    points: [
      '힙은 "전체 정렬"을 포기하고 <b>"부모 ≤ 자식"</b>만 유지합니다. 그 덕에 삽입·삭제가 O(log n)입니다.',
      '배열 하나로 구현합니다: i의 자식은 <code>2i+1</code>, <code>2i+2</code>. 포인터가 없어 캐시에도 유리합니다.',
      '상위 K개 뽑기, 다익스트라 최단 경로, 타이머·지연 큐, 스트림 병합이 전부 힙입니다.',
    ],
    senior: 'JS에는 내장 우선순위 큐가 없어서 "매번 <code>sort()</code>하고 <code>shift()</code>"하는 코드가 자주 보입니다. 꺼낼 때마다 O(n log n)이라 큐가 길어지면 스케줄러 자체가 병목이 됩니다. 또 "상위 10개"가 필요할 뿐인데 전체를 정렬하는 것도 같은 낭비입니다. 크기 K짜리 힙이면 O(n log K)이고, DB라면 <code>ORDER BY … LIMIT 10</code>에 인덱스가 붙어 있는지 확인하는 것이 먼저입니다.',
  });

  /* ---------- BFS vs DFS ---------- */
  const ROWS = 5, COLS = 7, GOAL = 3, WALLS = new Set([11, 18, 26, 33]);
  const neighbors = (c) => {
    const r = Math.floor(c / COLS), k = c % COLS, out = [];
    if (r + 1 < ROWS) out.push(c + COLS);
    if (k + 1 < COLS) out.push(c + 1);
    if (r > 0) out.push(c - COLS);
    if (k > 0) out.push(c - 1);
    return out.filter((x) => !WALLS.has(x));
  };
  const gridPanel = (label, state, title) => ({
    type: 'cells', cols: COLS, title,
    items: Array.from({ length: ROWS * COLS }, (_, c) => ({ id: c, v: c === 0 ? 'S' : c === GOAL ? 'G' : label(c) ?? '', s: WALLS.has(c) ? 'wall' : state(c) })),
  });
  CS.add({
    id: 'bfs-dfs', level: 'mid',
    title: '그래프 탐색: DFS와 BFS는 다른 답을 낸다',
    summary: '둘 다 "연결된 곳을 전부 방문"하지만 순서가 다릅니다. DFS는 한 길을 끝까지 파고, BFS는 가까운 곳부터 넓혀 갑니다. 최단 경로가 필요한데 DFS를 쓰면 "경로는 나오는데 돌아가는" 버그가 됩니다.',
    headline: '찾은 경로 길이',
    verdict: 'DFS는 처음 발견한 경로를, BFS는 가장 짧은 경로를 돌려줍니다. 간선 비용이 모두 같을 때 BFS가 처음 도착한 순간의 거리가 곧 최단 거리입니다.',
    variants: [
      {
        name: 'DFS (깊이 우선, 재귀)', tone: 'bad', label: '경로가 길다', big: { time: 'O(V + E)', space: 'O(깊이)' },
        code: `function dfs(cell, path) {
  if (cell === goal) return path;
  visited.add(cell);
  for (const next of neighbors(cell)) {
    if (visited.has(next)) continue;
    const found = dfs(next, [...path, next]);
    if (found) return found;
  }
  return null;
}`,
        notes: { 6: '갈 수 있으면 일단 끝까지' },
        run(t) {
          const visited = new Set(), order = {};
          t.m['찾은 경로 길이'] = 0; t.m['방문한 칸'] = 0;
          let path = [];
          const snap = (cur, final) => [gridPanel((c) => order[c], (c) => (final && path.includes(c) ? 'done' : c === cur ? 'active' : c === GOAL ? 'new' : visited.has(c) ? 'cmp' : ''),
            'S에서 G까지 가는 길 찾기 — 숫자는 방문한 순서 (이웃 확인 순서: 아래 → 오른쪽 → 위 → 왼쪽)')];
          const dfs = (cell, p) => {
            if (cell === GOAL) { path = p; return true; }
            visited.add(cell); order[cell] = cell === 0 ? 'S' : ++t.m['방문한 칸'];
            t.m['찾은 경로 길이'] = p.length - 1;
            t.step(3, p.length === 1 ? `출발. DFS는 갈 수 있는 첫 번째 방향으로 <b>끝까지</b> 들어갑니다.` : `${p.length - 1}걸음째 — 막힐 때까지 계속 전진합니다. G가 바로 옆에 있었어도 모릅니다.`, snap(cell));
            for (const next of neighbors(cell)) {
              if (visited.has(next)) continue;
              if (dfs(next, [...p, next])) return true;
            }
            return false;
          };
          dfs(0, [0]);
          t.m['찾은 경로 길이'] = path.length - 1;
          t.step(2, `G 도착. 경로는 찾았지만 <b>${path.length - 1}걸음</b>이나 돌아왔습니다. DFS는 "처음 찾은 길"을 줄 뿐입니다.`, snap(GOAL, true));
        },
      },
      {
        name: 'BFS (너비 우선, 큐)', tone: 'good', label: '최단 경로', big: { time: 'O(V + E)', space: 'O(너비)' },
        code: `function bfs(start) {
  const queue = [start];
  dist.set(start, 0);
  while (queue.length) {
    const cell = queue.shift();
    if (cell === goal) return dist.get(cell);
    for (const next of neighbors(cell)) {
      if (dist.has(next)) continue;
      dist.set(next, dist.get(cell) + 1);
      queue.push(next);
    }
  }
}`,
        notes: { 5: '먼저 발견한 칸부터', 9: '거리 = 부모 + 1' },
        run(t) {
          const dist = new Map([[0, 0]]), parent = {}, queue = [0], doneSet = new Set();
          t.m['찾은 경로 길이'] = 0; t.m['방문한 칸'] = 0;
          let path = [];
          const snap = (cur, final) => [
            gridPanel((c) => dist.get(c), (c) => (final && path.includes(c) ? 'done' : c === cur ? 'active' : c === GOAL && !dist.has(c) ? 'new' : doneSet.has(c) ? 'cmp' : dist.has(c) ? 'new' : ''), 'S에서 G까지 — 숫자는 S로부터의 거리. 물결처럼 한 겹씩 퍼집니다'),
            { type: 'cells', compact: true, title: '큐 (왼쪽부터 꺼냄) — 숫자는 그 칸의 거리', items: queue.map((c) => ({ id: c, v: dist.get(c), s: 'new' })) },
          ];
          t.step(3, `출발점을 큐에 넣습니다. 거리 0.`, snap(0));
          while (queue.length) {
            const cell = queue.shift();
            doneSet.add(cell); t.m['방문한 칸']++;
            if (cell === GOAL) {
              for (let c = GOAL; c !== undefined; c = parent[c]) path.unshift(c);
              t.m['찾은 경로 길이'] = dist.get(cell);
              t.step(6, `G를 큐에서 꺼냈습니다. 거리 <b>${dist.get(cell)}</b> — 이보다 짧은 길은 있을 수 없습니다. 더 가까운 칸을 전부 먼저 확인했기 때문입니다.`, snap(cell, true));
              return;
            }
            const fresh = neighbors(cell).filter((x) => !dist.has(x));
            for (const next of fresh) { dist.set(next, dist.get(cell) + 1); parent[next] = cell; queue.push(next); }
            t.step(fresh.length ? 9 : 5, fresh.length
              ? `거리 ${dist.get(cell)}인 칸을 꺼내, 처음 보는 이웃 ${fresh.length}칸에 거리 <b>${dist.get(cell) + 1}</b>을 적고 큐 뒤에 넣습니다.`
              : `거리 ${dist.get(cell)}인 칸을 꺼냈지만 새 이웃이 없습니다.`, snap(cell));
          }
        },
      },
    ],
    points: [
      '차이는 자료구조 하나입니다. <b>스택(재귀)</b>이면 DFS, <b>큐</b>면 BFS.',
      '<code>visited</code> 표시를 빠뜨리면 순환이 있는 그래프에서 무한 루프(또는 스택 오버플로)가 됩니다.',
      'DFS가 나쁜 것이 아닙니다. 순환 감지, 위상 정렬, 모든 경로 탐색, 메모리가 빠듯할 때는 DFS가 맞습니다.',
    ],
    senior: '그래프는 격자에만 있지 않습니다. 조직도·댓글 트리·권한 상속·서비스 호출 관계·의존성이 전부 그래프입니다. "친구의 친구 2단계 이내", "이 설정을 바꾸면 영향받는 서비스"는 BFS 문제입니다. 간선 비용이 다르면(도로, 네트워크 지연) BFS 대신 힙을 쓰는 다익스트라가 필요합니다. 그리고 위 코드의 <code>queue.shift()</code>는 배열 앞을 당기는 O(n) 연산이라, 큰 그래프에서는 읽기 인덱스를 따로 두거나 덱을 쓰세요.',
  });

  /* ---------- Trie ---------- */
  const WORDS = ['car', 'card', 'care', 'cat', 'cow', 'cut', 'dog', 'dot', 'do', 'bus', 'bug', 'bat'];
  const PREFIX = 'ca';
  CS.add({
    id: 'trie', level: 'mid',
    title: 'Trie: 자동완성은 왜 빠른가',
    summary: '검색창에 "ca"를 치면 car, card, care, cat이 뜹니다. 모든 단어를 하나씩 확인하는 방법과, 글자를 따라 트리를 내려가는 방법을 비교합니다.',
    headline: '문자 비교',
    verdict: '전체 필터는 단어 수에 비례하고, Trie는 접두사 길이에만 비례합니다. 단어가 100만 개가 되어도 "ca"까지 내려가는 데는 2걸음입니다.',
    variants: [
      {
        name: '전체 단어 필터', tone: 'bad', big: { time: 'O(단어 수 × 접두사 길이)', space: 'O(1)' },
        code: `function suggest(words, prefix) {
  const out = [];
  for (const w of words) {
    if (w.startsWith(prefix)) out.push(w);
  }
  return out;
}`,
        notes: { 3: '단어 수만큼 반복', 4: '관계없는 단어도 비교' },
        run(t) {
          t.m['문자 비교'] = 0; t.m['살펴본 단어'] = 0;
          const st = {};
          const snap = (cur) => [{ type: 'cells', title: `words (${WORDS.length}개) — 접두사 '${PREFIX}'로 시작하는 단어 찾기`, items: WORDS.map((w, i) => ({ id: w, v: w, s: i === cur ? 'active' : st[w] || '' })) }];
          t.step(2, `'${PREFIX}'를 입력했습니다. 어떤 단어가 해당하는지 모르니 전부 확인합니다.`, snap(-1));
          WORDS.forEach((w, i) => {
            t.m['살펴본 단어']++;
            let k = 0;
            while (k < PREFIX.length) { t.m['문자 비교']++; if (w[k] !== PREFIX[k]) break; k++; }
            const ok = k === PREFIX.length;
            st[w] = ok ? 'done' : 'dim';
            t.step(4, ok ? `<b>${w}</b> — '${PREFIX}'로 시작합니다. 결과에 추가.` : `${w} — ${k + 1}번째 글자에서 불일치. 비교한 수고는 버려집니다.`, snap(i));
          });
          t.step(6, `${WORDS.length}개를 전부 확인해서 4개를 찾았습니다. 키를 한 번 누를 때마다 이 작업을 반복합니다.`, snap(-1));
        },
      },
      {
        name: 'Trie (접두사 트리)', tone: 'good', big: { time: 'O(접두사 길이 + 결과 수)', space: 'O(전체 글자 수)' },
        code: `function suggest(root, prefix) {
  let node = root;
  for (const ch of prefix) {
    node = node.children[ch];
    if (!node) return [];
  }
  return collect(node);
}`,
        notes: { 3: '접두사 길이만큼만 반복', 7: '이 가지 아래가 전부 정답' },
        run(t) {
          t.m['문자 비교'] = 0; t.m['살펴본 단어'] = 0;
          const nodes = [{ id: '', parent: null, v: '·', round: true }];
          for (const w of [...WORDS].sort()) for (let i = 1; i <= w.length; i++) {
            const id = w.slice(0, i);
            let nd = nodes.find((x) => x.id === id);
            if (!nd) nodes.push((nd = { id, parent: w.slice(0, i - 1), v: w[i - 1], round: true }));
            if (i === w.length) nd.sub = w;
          }
          for (const n of nodes) if (n.sub && nodes.some((x) => x.parent === n.id)) n.side = true; // 자식이 있는 단어 끝은 라벨을 옆에
          const lay = CS.layoutTree(nodes, 44, 48);
          const st = {};
          const snap = (cur) => [{
            type: 'graph', ...lay, scale: 1.5, title: '단어들을 글자 단위로 합친 트리 — 아래에 단어가 적힌 노드가 단어의 끝',
            nodes: nodes.map((n) => ({ ...n, s: n.id === cur ? 'active' : st[n.id] || '' })),
            edges: nodes.filter((n) => n.parent != null).map((n) => ({ a: n.parent, b: n.id, s: st[n.id] === 'cmp' || n.id === cur ? 'active' : st[n.id] === 'done' ? 'done' : '' })),
          }];
          t.step(2, `루트에서 출발합니다. 같은 접두사를 가진 단어들은 같은 길을 공유합니다.`, snap(''));
          for (let i = 1; i <= PREFIX.length; i++) {
            const id = PREFIX.slice(0, i);
            t.m['문자 비교']++;
            st[PREFIX.slice(0, i - 1)] = 'cmp';
            t.step(4, `'${PREFIX[i - 1]}' 가지로 내려갑니다. 다른 글자로 시작하는 단어는 <b>전부 건너뜁니다.</b>`, snap(id));
          }
          st[PREFIX] = 'cmp';
          for (const n of nodes) if (n.id.startsWith(PREFIX) && n.id !== PREFIX) { st[n.id] = 'done'; if (n.sub) t.m['살펴본 단어']++; }
          t.step(7, `이 노드 아래에 매달린 단어가 곧 정답입니다: <b>${nodes.filter((n) => n.sub && n.id.startsWith(PREFIX)).map((n) => n.sub).join(', ')}</b>. 문자 비교는 ${PREFIX.length}번뿐이었습니다.`, snap(PREFIX));
        },
      },
    ],
    points: [
      'Trie는 문자열 집합을 <b>공통 접두사를 합친 트리</b>로 저장합니다. 조회 비용이 저장된 단어 수와 무관합니다.',
      '대가는 메모리입니다. 글자마다 노드가 생기므로 압축형(radix tree)을 많이 씁니다.',
      'URL 라우터(<code>/users/:id</code> 매칭), IP 라우팅 테이블, 사전·금칙어 필터가 같은 구조입니다.',
    ],
    senior: '실무에서는 Trie를 직접 짜기보다 "접두사 검색을 정렬된 인덱스의 범위 스캔으로 바꿀 수 있다"는 사실을 더 자주 씁니다. <code>LIKE \'ca%\'</code>는 B-Tree 인덱스를 타지만 <code>LIKE \'%ca%\'</code>는 풀 스캔입니다. 앞에 와일드카드가 붙은 검색이 느리다면 인덱스 추가가 아니라 전문 검색(역색인)이 필요한 문제입니다. 자동완성 API는 키 입력마다 호출되므로 디바운스와 결과 캐시를 함께 설계하세요.',
  });

  /* ---------- LRU 캐시 ---------- */
  const REQS = [1, 2, 1, 3, 2, 1, 4, 1, 2, 5, 1, 2, 6, 1, 7, 2, 1, 8], MAX = 3;
  const cacheRun = (lru) => (t) => {
    const cache = [];
    t.m['캐시 크기 (항목 수)'] = 0; t.m['캐시 적중'] = 0; t.m['DB 조회'] = 0;
    const L = lru ? { hit: 5, miss: 8, set: 9, evict: 10 } : { hit: 3, miss: 4, set: 5 };
    const snap = (i, hot, s) => [
      { type: 'cells', compact: true, title: '들어오는 요청 (user id)', items: REQS.map((v, k) => ({ id: k, v, s: k === i ? 'active' : k < i ? 'dim' : '', ptr: k === i ? 'id' : '' })) },
      { type: 'cells', title: lru ? `cache (최대 ${MAX}개) — 왼쪽이 가장 오래전에 쓴 것` : 'cache — 한 번 들어오면 영원히 남음', items: cache.map((v) => ({ id: v, v: `u${v}`, s: v === hot ? s : '' })) },
    ];
    t.step(1, lru ? `캐시 크기를 <b>${MAX}개</b>로 제한합니다. Map은 넣은 순서를 기억하므로 맨 앞이 가장 오래된 항목입니다.` : `조회 결과를 Map에 저장해 두고 재사용합니다. 크기 제한은 없습니다.`, snap(-1));
    REQS.forEach((id, i) => {
      const at = cache.indexOf(id);
      if (at >= 0) {
        t.m['캐시 적중']++;
        if (lru) { cache.splice(at, 1); cache.push(id); }
        t.step(L.hit, lru ? `u${id} — <b>적중.</b> 방금 썼으니 맨 뒤(최신)로 옮깁니다.` : `u${id} — <b>적중.</b> DB에 가지 않습니다.`, snap(i, id, 'done'));
        return;
      }
      t.m['DB 조회']++;
      t.step(L.miss, `u${id} — 캐시에 없습니다. DB에서 가져옵니다.`, snap(i));
      cache.push(id);
      t.m['캐시 크기 (항목 수)'] = cache.length;
      t.step(L.set, `u${id}를 캐시에 저장합니다.${lru ? '' : ` 캐시가 <b>${cache.length}개</b>로 늘었습니다.`}`, snap(i, id, 'new'));
      if (lru && cache.length > MAX) {
        const old = cache[0];
        t.step(L.evict, `${MAX}개를 넘었습니다. 가장 오래 안 쓴 <b>u${old}</b>를 버립니다.`, snap(i, old, 'bad'));
        cache.shift();
        t.m['캐시 크기 (항목 수)'] = cache.length;
      }
    });
    t.step(lru ? 11 : 6, lru
      ? `요청이 아무리 많아도 캐시는 <b>${MAX}개</b>를 넘지 않습니다. 자주 쓰는 u1, u2는 계속 살아남아 적중 횟수는 거의 그대로입니다.`
      : `서로 다른 id가 들어올 때마다 캐시가 커집니다. 사용자가 100만 명이면 100만 개가 메모리에 남습니다.`, snap(REQS.length));
  };
  CS.add({
    id: 'lru-cache', level: 'mid',
    title: 'LRU 캐시: 무제한 캐시는 메모리 누수다',
    summary: '"DB 조회가 느리니 Map에 저장해 두자"는 좋은 생각이지만, 지우는 규칙이 없으면 서버 메모리가 끝없이 늘어납니다. 크기를 제한하고 가장 오래 안 쓴 것부터 버리는 LRU를 봅니다.',
    headline: '캐시 크기 (항목 수)',
    verdict: 'LRU는 DB 조회가 조금 늘어나는 대신 메모리 상한을 보장합니다. 요청은 보통 소수의 인기 항목에 몰리기 때문에, 작은 캐시로도 적중의 대부분을 가져갑니다.',
    variants: [
      {
        name: '크기 제한 없는 Map 캐시', tone: 'bad', label: '메모리 증가', big: { time: 'O(1)', space: 'O(전체 키 수)' },
        code: `const cache = new Map();
async function getUser(id) {
  if (cache.has(id)) return cache.get(id);
  const user = await db.find(id);
  cache.set(id, user);
  return user;
}`,
        notes: { 5: '지우는 코드가 없음' }, run: cacheRun(false),
      },
      {
        name: 'LRU 캐시 (최대 3개)', tone: 'good', label: '메모리 고정', big: { time: 'O(1)', space: 'O(MAX)' },
        code: `const cache = new Map(); // 넣은 순서를 기억한다
async function getUser(id) {
  if (cache.has(id)) {
    const user = cache.get(id);
    cache.delete(id); cache.set(id, user);
    return user;
  }
  const user = await db.find(id);
  cache.set(id, user);
  if (cache.size > MAX) cache.delete(cache.keys().next().value);
  return user;
}`,
        notes: { 5: '최근 사용 → 맨 뒤로', 10: '가장 오래된 것 제거' }, run: cacheRun(true),
      },
    ],
    points: [
      '캐시를 만들 때는 <b>언제 지울지</b>를 같이 정합니다: 크기 제한(LRU), 시간 제한(TTL), 또는 둘 다.',
      'LRU의 근거는 "최근에 쓴 것을 곧 또 쓴다"는 시간 지역성입니다. CPU 캐시, OS 페이지 캐시, DB 버퍼 풀도 같은 가정을 씁니다.',
      'Map의 삽입 순서 보장을 이용하면 조회·갱신·제거가 모두 O(1)입니다. (일반적인 구현은 해시맵 + 이중 연결 리스트)',
    ],
    senior: '운영에서 "메모리가 며칠에 걸쳐 서서히 오르고 재시작하면 내려간다"면 십중팔구 모듈 전역의 Map/객체/배열입니다. 힙 스냅샷에서 retained size 상위에 Map이 보이면 확정입니다. 캐시 키에 사용자 입력(검색어, URL 전체)이 들어가면 키 공간이 사실상 무한이라 더 빨리 터집니다. 서버가 여러 대면 프로세스 내 캐시는 서버마다 내용이 달라 "새로고침할 때마다 값이 바뀌는" 증상도 만듭니다. 그때는 Redis 같은 공유 캐시와 무효화 전략이 필요합니다.',
  });

  /* ---------- 슬라이딩 윈도 ---------- */
  const SERIES = [3, 5, 2, 8, 6, 1, 7, 9, 4, 2, 6, 5, 3, 8];
  CS.add({
    id: 'sliding-window', level: 'mid',
    title: '슬라이딩 윈도: 겹치는 계산을 재사용하기',
    summary: '"최근 k분간 요청 수", "k일 이동 평균"처럼 연속 구간을 한 칸씩 옮기며 계산할 때, 매번 처음부터 더하면 대부분이 직전 계산과 겹칩니다. 빠진 값만 빼고 들어온 값만 더하면 됩니다.',
    param: { label: '윈도 크기 k', options: [3, 5, 8], value: 5 },
    headline: '덧셈·뺄셈 횟수',
    verdict: '다시 합산하면 위치마다 k번, 슬라이딩 윈도는 위치마다 2번입니다. k가 커질수록(1시간 윈도, 30일 평균) 격차가 그대로 벌어집니다.',
    variants: [
      {
        name: '위치마다 다시 합산', tone: 'bad', big: { time: 'O(n × k)', space: 'O(1)' },
        code: `function maxWindow(a, k) {
  let best = -Infinity;
  for (let i = 0; i + k <= a.length; i++) {
    let sum = 0;
    for (let j = i; j < i + k; j++) sum += a[j];
    best = Math.max(best, sum);
  }
  return best;
}`,
        notes: { 5: '위치마다 k번 덧셈' },
        run(t, k) {
          const a = SERIES;
          t.m['덧셈·뺄셈 횟수'] = 0;
          let best = -Infinity, sum = 0;
          const snap = (i, j) => [
            { type: 'cells', title: `분당 요청 수 — 연속 ${k}분 합의 최댓값 찾기`, items: a.map((v, x) => ({ id: x, v, s: x === j ? 'active' : x >= i && x < i + k ? 'cmp' : 'dim' })) },
            { type: 'cells', title: '변수', items: [{ id: 's', v: sum, sub: 'sum', s: 'active' }, { id: 'b', v: best === -Infinity ? '–' : best, sub: 'best' }] },
          ];
          for (let i = 0; i + k <= a.length; i++) {
            sum = 0;
            t.step(4, `윈도를 ${i}번 칸으로 옮기고 <code>sum</code>을 <b>0으로 버립니다.</b>${i ? ` 방금 더한 ${k - 1}칸을 또 더해야 합니다.` : ''}`, snap(i, -1));
            for (let j = i; j < i + k; j++) { sum += a[j]; t.m['덧셈·뺄셈 횟수']++; t.step(5, `<code>sum += ${a[j]}</code> → ${sum}`, snap(i, j)); }
            best = Math.max(best, sum);
            t.step(6, `이 윈도의 합은 ${sum}. 지금까지 최댓값 <b>${best}</b>.`, snap(i, -1));
          }
        },
      },
      {
        name: '슬라이딩 윈도', tone: 'good', big: { time: 'O(n)', space: 'O(1)' },
        code: `function maxWindow(a, k) {
  let sum = 0;
  for (let i = 0; i < k; i++) sum += a[i];
  let best = sum;
  for (let i = k; i < a.length; i++) {
    sum += a[i] - a[i - k];
    best = Math.max(best, sum);
  }
  return best;
}`,
        notes: { 3: '처음 한 번만 k번', 6: '들어온 값 +, 나간 값 −' },
        run(t, k) {
          const a = SERIES;
          t.m['덧셈·뺄셈 횟수'] = 0;
          let sum = 0, best = '–';
          const snap = (lo, add, drop) => [
            { type: 'cells', title: `분당 요청 수 — 연속 ${k}분 합의 최댓값 찾기`, items: a.map((v, x) => ({ id: x, v, s: x === add ? 'done' : x === drop ? 'bad' : x >= lo && x < lo + k ? 'cmp' : 'dim', ptr: x === add ? '+' : x === drop ? '−' : '' })) },
            { type: 'cells', title: '변수', items: [{ id: 's', v: sum, sub: 'sum', s: 'active' }, { id: 'b', v: best, sub: 'best' }] },
          ];
          for (let i = 0; i < k; i++) { sum += a[i]; t.m['덧셈·뺄셈 횟수']++; t.step(3, `첫 윈도만 직접 더합니다. <code>sum += ${a[i]}</code> → ${sum}`, snap(0, i, -1)); }
          best = sum;
          t.step(4, `첫 윈도의 합 ${sum}. 이제부터는 <b>바뀐 부분만</b> 반영합니다.`, snap(0, -1, -1));
          for (let i = k; i < a.length; i++) {
            sum += a[i] - a[i - k]; t.m['덧셈·뺄셈 횟수'] += 2;
            best = Math.max(best, sum);
            t.step(6, `오른쪽으로 한 칸. 들어온 <b>+${a[i]}</b>, 나간 <b>−${a[i - k]}</b> → sum = ${sum}, best = ${best}. 가운데 ${k - 1}칸은 건드리지 않습니다.`, snap(i - k + 1, i, i - k));
          }
          t.step(9, `최댓값 <b>${best}</b>. 윈도 크기와 상관없이 칸마다 연산 2번입니다.`, snap(a.length - k, -1, -1));
        },
      },
    ],
    points: [
      '핵심은 <b>증분 계산</b>입니다. 전체를 다시 계산하지 말고, 직전 결과에 "달라진 것"만 반영합니다.',
      '합뿐 아니라 개수, 평균, 서로 다른 값의 수(해시맵과 함께)에도 같은 방식을 씁니다.',
      '투 포인터도 같은 계열입니다. 두 인덱스가 각각 앞으로만 움직이면 전체가 O(n)입니다.',
    ],
    senior: '레이트 리미터(최근 1분 요청 수), 모니터링 지표의 이동 평균, 스트림 처리의 윈도 집계가 전부 이 구조입니다. 요청이 올 때마다 "최근 1분 로그를 전부 세는" 구현은 트래픽이 늘수록 스스로 느려집니다. SQL에서도 날짜마다 서브쿼리로 7일 합계를 구하는 대신 윈도 함수(<code>SUM(...) OVER (ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)</code>)를 쓰면 한 번의 스캔으로 끝납니다.',
  });

  /* ---------- 위상 정렬 ---------- */
  const TOPO_NODES = { config: [60, 80], db: [180, 30], logger: [180, 130], auth: [300, 80], api: [410, 80], app: [510, 80] };
  const BASE_EDGES = [['config', 'db'], ['config', 'logger'], ['db', 'auth'], ['logger', 'auth'], ['auth', 'api'], ['api', 'app']];
  const topoRun = (cyclic) => (t) => {
    const edges = cyclic ? [...BASE_EDGES, ['api', 'db']] : BASE_EDGES;
    const ids = Object.keys(TOPO_NODES), indeg = {}, out = [], removed = new Set();
    for (const id of ids) indeg[id] = edges.filter((e) => e[1] === id).length;
    t.m['순서가 정해진 모듈'] = 0; t.m['순환에 갇힌 모듈'] = 0;
    const snap = (cur, stuck) => [
      {
        type: 'graph', directed: true, w: 560, h: 164, scale: 1.4, title: '화살표 A → B: "B는 A가 먼저 준비되어야 한다" · 아래 숫자는 아직 안 풀린 선행 조건 수',
        nodes: ids.map((id) => ({ id, v: id, x: TOPO_NODES[id][0], y: TOPO_NODES[id][1], w: 58, sub: removed.has(id) ? '완료' : `대기 ${indeg[id]}`, s: stuck && !removed.has(id) ? 'bad' : id === cur ? 'active' : removed.has(id) ? 'done' : indeg[id] === 0 ? 'new' : '' })),
        edges: edges.map(([a, b]) => ({ a, b, s: stuck && !removed.has(a) && !removed.has(b) ? 'bad' : removed.has(a) ? 'dim' : a === 'api' && b === 'db' ? 'bad' : '' })),
      },
      { type: 'cells', title: '초기화 순서 (out)', items: out.map((v) => ({ id: v, v, s: 'done' })) },
    ];
    const ready = ids.filter((n) => indeg[n] === 0);
    t.step(2, cyclic
      ? `누군가 <code>db</code>가 <code>api</code>를 참조하게 만들었습니다(붉은 점선). 선행 조건이 0인 모듈부터 시작합니다: <b>${ready.join(', ')}</b>`
      : `선행 조건이 하나도 없는 모듈부터 시작할 수 있습니다: <b>${ready.join(', ')}</b>`, snap());
    while (ready.length) {
      const n = ready.shift();
      out.push(n); removed.add(n); t.m['순서가 정해진 모듈']++;
      t.step(6, `<b>${n}</b>을 순서에 넣습니다. 이제 ${n}에 의존하던 모듈들의 선행 조건이 하나씩 줄어듭니다.`, snap(n));
      for (const [a, b] of edges) if (a === n) {
        indeg[b]--;
        if (indeg[b] === 0) ready.push(b);
        t.step(8, indeg[b] === 0 ? `<code>${b}</code>의 선행 조건이 모두 풀렸습니다 → 준비 완료.` : `<code>${b}</code>는 아직 ${indeg[b]}개를 더 기다려야 합니다.`, snap(n));
      }
    }
    if (out.length < ids.length) {
      t.m['순환에 갇힌 모듈'] = ids.length - out.length;
      t.step(11, `더 꺼낼 모듈이 없는데 ${ids.length - out.length}개가 남았습니다. 서로가 서로를 기다리는 <b>순환 의존</b>입니다: db → auth → api → db. 순환에 속하지 않은 app도 함께 막힙니다.`, snap(null, true));
    } else {
      t.step(12, `모든 모듈의 순서가 정해졌습니다: <b>${out.join(' → ')}</b>`, snap());
    }
  };
  const TOPO_CODE = `function order(graph) {
  const ready = nodes.filter(n => indegree[n] === 0);
  const out = [];
  while (ready.length) {
    const n = ready.shift();
    out.push(n);
    for (const m of graph[n]) {
      if (--indegree[m] === 0) ready.push(m);
    }
  }
  if (out.length < nodes.length) throw new Error('순환 의존');
  return out;
}`;
  CS.add({
    id: 'topo-sort', level: 'mid',
    title: '위상 정렬: 의존성 순서와 순환 의존',
    summary: '모듈 초기화, 빌드, DB 마이그레이션, 작업 파이프라인은 "무엇을 먼저 해야 하는가"의 문제입니다. 같은 알고리즘이 올바른 순서를 만들어 주고, 순환 의존이 있으면 그것도 찾아냅니다.',
    verdict: '위상 정렬은 "선행 조건이 0인 것부터 꺼내고, 꺼낸 것에 의존하던 쪽의 조건을 하나씩 줄이는" 과정입니다. 끝까지 꺼내지 못한 노드가 남으면 순환이 있다는 증거입니다.',
    variants: [
      { name: '정상 의존성 그래프', tone: 'good', label: '순서 결정', big: { time: 'O(V + E)', space: 'O(V)' }, code: TOPO_CODE, notes: { 2: '선행 조건 없는 것부터', 8: '조건이 0이 되면 준비 완료' }, run: topoRun(false) },
      { name: 'db → api 참조가 추가된 그래프', tone: 'bad', label: '순환 의존', big: { time: 'O(V + E)', space: 'O(V)' }, code: TOPO_CODE, notes: { 11: '남은 노드 = 순환' }, run: topoRun(true) },
    ],
    points: [
      '의존 관계는 <b>방향 그래프</b>이고, 실행 가능한 순서가 존재하려면 순환이 없어야 합니다(DAG).',
      '순환에 직접 속하지 않아도 순환에 의존하는 노드는 전부 함께 막힙니다.',
      'npm·Gradle의 설치 순서, Webpack 번들 순서, Airflow DAG, 스프레드시트 수식 재계산이 모두 위상 정렬입니다.',
    ],
    senior: '순환 import는 에러 없이 조용히 터지는 경우가 많습니다. A가 B를 불러오는 도중 B가 A를 불러오면, B는 "아직 절반만 초기화된 A"를 받습니다. 그래서 증상이 "import한 값이 undefined", "is not a function", "Cannot access before initialization"으로 나타나고, import 순서만 바꿔도 증상이 사라졌다 나타났다 합니다. 해결은 순서를 맞추는 것이 아니라 순환을 끊는 것입니다: 공통 부분을 제3의 모듈로 빼거나, 한쪽 의존을 인터페이스·이벤트·지연 참조로 뒤집습니다. 서비스 간 호출이 순환하면 한 곳의 장애가 고리를 따라 전체로 번집니다.',
  });
})();
