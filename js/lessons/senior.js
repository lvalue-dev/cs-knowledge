/* 시니어: DB 인덱스, 경쟁 상태, N+1 쿼리 */
(function () {
  const CS = window.CS;

  /* ---------- 11. DB 인덱스 ---------- */
  const ROWS = 27, PAGE = 3, TARGET = 23;
  const heapRows = CS.perm(ROWS, 5); // 테이블에는 삽입된 순서대로(정렬 안 됨) 저장되어 있다
  const tablePanel = (state, title) => ({
    type: 'cells', cols: 9, compact: true, title,
    items: heapRows.map((v, k) => ({ id: k, v, gap: k % PAGE === PAGE - 1, s: state(k, Math.floor(k / PAGE)) })),
  });
  CS.add({
    id: 'db-index', level: 'senior',
    title: 'DB 인덱스: 풀 스캔 vs B-Tree',
    summary: 'WHERE 조건 하나에 DB가 디스크를 몇 번 읽는지 봅니다. 인덱스가 없으면 테이블 전체를, 있으면 트리의 높이만큼만 읽습니다.',
    headline: '디스크 페이지 읽기',
    verdict: '여기서는 9 대 4지만, 행이 1억 개가 되면 풀 스캔은 수백만 페이지를 읽고 B-Tree는 여전히 4~5페이지만 읽습니다. 트리 높이는 log로 자라기 때문입니다.',
    variants: [
      {
        name: '인덱스 없음 (Seq Scan)', tone: 'bad', big: { time: 'O(n)', space: 'O(1)' },
        code: `SELECT * FROM users WHERE code = 23;

-- 실행 계획: Seq Scan on users
for (const page of table.pages) {
  for (const row of page.rows) {
    if (row.code === 23) result.push(row);
  }
}`,
        notes: { 4: '모든 페이지를 디스크에서 읽음', 6: '모든 행 비교' },
        run(t) {
          t.m['디스크 페이지 읽기'] = 0; t.m['행 비교'] = 0;
          let found = -1;
          const snap = (pg, row) => [tablePanel(
            (k, p) => (k === found ? 'done' : k === row ? 'active' : p === pg ? 'cmp' : p < pg ? 'dim' : ''),
            `users 테이블 — 3행씩 한 페이지(디스크 블록), 저장 순서는 뒤죽박죽`)];
          t.step(1, `<code>code = ${TARGET}</code>인 행을 찾습니다. 인덱스가 없어서 DB는 그 행이 어디 있는지 모릅니다.`, snap(-1, -1));
          for (let pg = 0; pg < ROWS / PAGE; pg++) {
            t.m['디스크 페이지 읽기']++;
            t.step(4, `${pg + 1}번째 페이지를 디스크에서 읽습니다.`, snap(pg, -1));
            for (let k = pg * PAGE; k < (pg + 1) * PAGE; k++) {
              t.m['행 비교']++;
              if (heapRows[k] === TARGET) {
                found = k;
                t.step(6, `<code>code = ${TARGET}</code> 발견! 하지만 <b>멈출 수 없습니다.</b> 뒤에 같은 값이 더 있을지 DB는 알 수 없습니다.`, snap(pg, k));
              } else {
                t.step(6, `code = ${heapRows[k]} — 아닙니다.`, snap(pg, k));
              }
            }
          }
          t.step(8, `테이블 끝까지 읽었습니다. 행 1개를 찾으려고 <b>${t.m['디스크 페이지 읽기']}페이지 전부</b>를 읽었습니다.`, snap(99, -1));
        },
      },
      {
        name: 'B-Tree 인덱스 (Index Scan)', tone: 'good', big: { time: 'O(log n)', space: 'O(n) 추가 저장' },
        code: `CREATE INDEX idx_code ON users(code);

-- 실행 계획: Index Scan using idx_code
let node = index.root;
while (!node.isLeaf) {
  node = node.childFor(23);
}
const ptr = node.find(23);
const row = table.fetch(ptr);`,
        notes: { 5: '트리 높이만큼만 반복', 9: '필요한 페이지 1개만' },
        run(t) {
          t.m['디스크 페이지 읽기'] = 0; t.m['행 비교'] = 0;
          const nodes = [{ id: 'r', parent: null, v: '10 | 19', w: 58 }];
          for (let i = 0; i < 3; i++) {
            nodes.push({ id: 'i' + i, parent: 'r', v: `${i * 9 + 4} | ${i * 9 + 7}`, w: 58 });
            for (let j = 0; j < 3; j++) { const b = i * 9 + j * 3 + 1; nodes.push({ id: 'l' + (i * 3 + j), parent: 'i' + i, v: `${b} ${b + 1} ${b + 2}`, w: 58 }); }
          }
          const lay = CS.layoutTree(nodes, 64, 50);
          const path = [];
          const at = heapRows.indexOf(TARGET);
          const snap = (cur, fetched) => [
            {
              type: 'graph', title: 'B-Tree 인덱스 — 정렬된 키를 가진 노드(페이지)들', ...lay, scale: 1.3,
              nodes: nodes.map((n) => ({ ...n, s: n.id === cur ? 'active' : path.includes(n.id) ? 'done' : cur ? 'dim' : '' })),
              edges: nodes.filter((n) => n.parent).map((n) => ({ a: n.parent, b: n.id, s: path.includes(n.id) || n.id === cur ? 'active' : cur ? 'dim' : '' })),
            },
            tablePanel((k, p) => (fetched && k === at ? 'done' : fetched && p === Math.floor(at / PAGE) ? 'cmp' : 'dim'), 'users 테이블 — 인덱스가 알려 준 페이지만 읽음'),
          ];
          t.step(1, `<code>code</code> 컬럼에 인덱스를 만들어 두었습니다. 인덱스는 값이 정렬된 별도의 트리입니다.`, snap());
          t.m['디스크 페이지 읽기']++; t.m['행 비교'] += 2;
          t.step(4, `루트 노드를 읽습니다. 키는 10, 19 — ${TARGET}은 19 이상이므로 <b>세 번째 가지</b>로 갑니다. 나머지 2/3는 볼 필요가 없습니다.`, snap('r'));
          path.push('r');
          t.m['디스크 페이지 읽기']++; t.m['행 비교'] += 2;
          t.step(6, `중간 노드를 읽습니다. 키는 22, 25 — 22 ≤ ${TARGET} &lt; 25이므로 <b>가운데 가지</b>로 갑니다.`, snap('i2'));
          path.push('i2');
          t.m['디스크 페이지 읽기']++; t.m['행 비교'] += 2;
          t.step(8, `리프 노드에서 <b>${TARGET}</b>을 찾았습니다. 리프에는 실제 행이 있는 위치(포인터)가 들어 있습니다.`, snap('l7'));
          path.push('l7');
          t.m['디스크 페이지 읽기']++;
          t.step(9, `포인터를 따라 테이블에서 해당 페이지 <b>1개만</b> 읽습니다. 총 ${t.m['디스크 페이지 읽기']}페이지로 끝났습니다.`, snap('l7', true));
        },
      },
    ],
    points: [
      'B-Tree는 노드 하나가 디스크 페이지 하나입니다. 실제로는 노드당 키가 수백 개라서 <b>높이 3~4로 수억 행</b>을 덮습니다.',
      '인덱스는 "정렬된 사본"입니다. 그래서 <code>=</code>뿐 아니라 범위 조건, <code>ORDER BY</code>에도 쓰입니다.',
      '<code>EXPLAIN</code>으로 실행 계획을 확인하는 습관을 들이세요. Seq Scan이 보이면 이 그림의 왼쪽입니다.',
    ],
    senior: '인덱스는 읽기를 싸게 하는 대신 쓰기를 비싸게 합니다. INSERT/UPDATE마다 모든 인덱스 트리를 고쳐야 하고 저장 공간도 더 씁니다. 또 인덱스가 있어도 안 타는 경우가 많습니다: 컬럼에 함수를 씌운 조건(<code>WHERE LOWER(email) = ...</code>), 복합 인덱스의 앞 컬럼을 건너뛴 조건, 결과가 테이블의 큰 비율일 때(랜덤 I/O보다 풀 스캔이 싸다고 옵티마이저가 판단). "인덱스를 추가했다"가 아니라 "실행 계획이 바뀌었다"를 확인해야 끝난 것입니다.',
  });

  /* ---------- 12. 경쟁 상태 ---------- */
  const raceRun = (locked) => (t) => {
    let counter = 0, owner = null;
    const th = { A: { tmp: '–', next: '–' }, B: { tmp: '–', next: '–' } };
    t.m['counter (기대값 4)'] = 0; t.m['유실된 업데이트'] = 0; t.m['락 대기'] = 0;
    const snap = (who, bad, waiting) => [
      { type: 'cells', title: '공유 메모리', items: [{ id: 'c', v: counter, sub: 'counter', s: bad ? 'bad' : who ? 'active' : '' }, ...(locked ? [{ id: 'l', v: owner ? `🔒 ${owner}` : '열림', sub: 'lock', s: owner ? 'new' : '' }] : [])] },
      ...['A', 'B'].map((id) => ({
        type: 'cells', hot: who === id, title: `스레드 ${id}${who === id ? ' ← 지금 실행 중' : waiting === id ? ' (락 대기 중)' : ''}`,
        items: [{ id: 'tmp', v: th[id].tmp, sub: 'tmp', s: who === id ? 'cmp' : waiting === id ? 'dim' : '' }, { id: 'next', v: th[id].next, sub: 'next', s: who === id ? 'cmp' : waiting === id ? 'dim' : '' }],
      })),
    ];
    const read = (id) => { th[id].tmp = counter; th[id].next = '–'; t.step(3, `<b>${id}</b>: <code>tmp = counter</code> → ${counter}을 읽습니다.`, snap(id)); };
    const calc = (id) => { th[id].next = th[id].tmp + 1; t.step(4, `<b>${id}</b>: <code>next = ${th[id].tmp} + 1</code> = ${th[id].next}`, snap(id)); };
    const write = (id, lost) => {
      counter = th[id].next; t.m['counter (기대값 4)'] = counter;
      if (lost) t.m['유실된 업데이트']++;
      t.step(5, lost
        ? `<b>${id}</b>: <code>counter = ${counter}</code> — 방금 상대가 쓴 값을 <b>덮어썼습니다.</b> 증가 한 번이 사라졌습니다.`
        : `<b>${id}</b>: <code>counter = ${counter}</code> 저장.`, snap(id, lost));
    };
    t.step(1, `스레드 A와 B가 각각 <code>increment()</code>를 2번씩 호출합니다. 끝나면 counter는 <b>4</b>여야 합니다.`, snap());
    for (let round = 0; round < 2; round++) {
      if (!locked) {
        read('A'); read('B');
        calc('A'); calc('B');
        write('A', false); write('B', true);
      } else {
        for (const [id, other] of [['A', 'B'], ['B', 'A']]) {
          owner = id;
          t.step(2, `<b>${id}</b>: <code>lock.acquire()</code> — 락을 잡았습니다. 이제 이 구간은 ${id}만 실행합니다.`, snap(id));
          if (id === 'A') { t.m['락 대기']++; t.step(2, `<b>${other}</b>: <code>lock.acquire()</code> — 이미 잠겨 있습니다. ${id}가 놓을 때까지 <b>기다립니다.</b>`, snap(id, false, other)); }
          read(id); calc(id); write(id, false);
          owner = null;
          t.step(6, `<b>${id}</b>: <code>lock.release()</code> — 락을 풉니다.`, snap(id));
        }
      }
    }
    t.step(locked ? 7 : 6, locked
      ? `최종 counter = <b>4</b>. 정확합니다. 대신 스레드가 서로를 기다리는 시간이 생겼습니다.`
      : `최종 counter = <b>${counter}</b>. 4번 증가시켰는데 2입니다. 에러도, 경고도 없습니다.`, snap(null, !locked));
  };
  CS.add({
    id: 'race-condition', level: 'senior',
    title: '경쟁 상태: counter++ 는 한 동작이 아니다',
    summary: '한 줄짜리 증가 연산도 실제로는 읽기 → 계산 → 쓰기 세 단계입니다. 두 실행 흐름이 그 사이에 끼어들면 업데이트가 조용히 사라집니다.',
    headline: '유실된 업데이트',
    verdict: '락이 없으면 틀린 결과가 에러 없이 나옵니다. 락은 정확성을 주지만 대기 시간이라는 비용을 받습니다. 동시성은 언제나 이 둘 사이의 거래입니다.',
    variants: [
      {
        name: '락 없음', tone: 'bad',
        code: `// 스레드 A, B가 동시에 실행
function increment() {
  const tmp = counter;
  const next = tmp + 1;
  counter = next;
}`,
        notes: { 3: '① 읽기', 4: '② 계산', 5: '③ 쓰기 — 사이에 끼어들 수 있음' },
        run: raceRun(false),
      },
      {
        name: '뮤텍스(락) 사용', tone: 'good',
        code: `function increment() {
  lock.acquire();
  const tmp = counter;
  const next = tmp + 1;
  counter = next;
  lock.release();
}`,
        notes: { 2: '한 번에 한 스레드만', 6: '대기하던 스레드 진입' },
        run: raceRun(true),
      },
    ],
    points: [
      '문제의 구조는 항상 같습니다: <b>읽고 → 판단하고 → 쓰는</b> 사이에 다른 누군가가 값을 바꾼다(check-then-act).',
      '경쟁 상태는 타이밍에 따라 가끔만 일어나서 테스트에서는 통과하고 운영에서만 터집니다.',
      '해결 도구: 락(뮤텍스), 원자적 연산(atomic increment, CAS), 공유 자체를 없애기(메시지 전달, 불변 데이터).',
    ],
    senior: '싱글 스레드인 Node.js도 안전하지 않습니다. <code>await</code>가 곧 끼어들 수 있는 지점이고, 서버가 여러 대면 이미 멀티 스레드입니다. 재고 차감, 쿠폰 중복 사용, 잔액 이체가 전부 이 그림입니다. "SELECT로 읽고 애플리케이션에서 계산해 UPDATE"하는 코드를 보면 의심하세요. <code>UPDATE ... SET stock = stock - 1 WHERE stock > 0</code> 같은 원자적 쿼리, 낙관적 락(version 컬럼), <code>SELECT ... FOR UPDATE</code>, 유니크 제약으로 DB가 판정하게 해야 합니다. 락을 쓴다면 범위는 최소로, 획득 순서는 일정하게(데드락 방지).',
  });

  /* ---------- 13. N+1 쿼리 ---------- */
  const RTT = 5, POSTS = 8, TOTAL = (POSTS + 1) * RTT;
  const queryRun = (batched) => (t) => {
    const items = [];
    let now = 0;
    t.m['쿼리 수'] = 0; t.m['네트워크 대기 (ms)'] = 0;
    const snap = () => [{ type: 'timeline', total: TOTAL, title: `시간 축 → (DB 왕복 1번 ≈ ${RTT}ms로 가정, 전체 폭 = ${TOTAL}ms)`, items: items.map((x) => ({ ...x })) }];
    const query = (line, label, msg) => {
      items.forEach((x) => (x.s = 'done'));
      items.push({ id: items.length, label, start: now, len: RTT, s: 'active', text: `${RTT}ms` });
      now += RTT; t.m['쿼리 수']++; t.m['네트워크 대기 (ms)'] = now;
      t.step(line, msg, snap());
    };
    query(1, 'posts 목록', `게시글 ${POSTS}개를 가져옵니다. 쿼리 1번, 네트워크 왕복 1번.`);
    if (!batched) {
      for (let i = 1; i <= POSTS; i++) {
        t.step(2, `${i}번째 게시글 — 작성자 정보가 필요합니다.`, snap());
        query(3, `user #${i}`, `작성자 <b>한 명</b>을 가져오려고 DB까지 또 왕복합니다. 쿼리 자체는 빠르지만 왕복 시간은 매번 듭니다.`);
      }
      items.forEach((x) => (x.s = 'bad'));
      t.step(6, `게시글 ${POSTS}개를 보여 주려고 쿼리를 <b>${t.m['쿼리 수']}번</b>(1 + N) 보냈습니다. 목록이 100개면 101번입니다.`, snap());
    } else {
      t.step(2, `작성자 id ${POSTS}개를 먼저 모읍니다. 메모리 안에서 끝나는 작업입니다.`, snap());
      query(3, `users ${POSTS}명`, `작성자 ${POSTS}명을 <code>IN</code> 조건으로 <b>한 번에</b> 가져옵니다.`);
      items.forEach((x) => (x.s = 'done'));
      t.step(5, `id → user Map을 만듭니다. (메모리, 수 마이크로초)`, snap());
      t.step(6, `게시글마다 Map에서 작성자를 꺼내 붙입니다. DB에 다시 가지 않습니다. 총 쿼리 <b>2번</b>.`, snap());
    }
  };
  CS.add({
    id: 'n-plus-one', level: 'senior',
    title: 'N+1 쿼리: 루프 안의 await',
    summary: '로컬에서는 멀쩡하던 목록 API가 운영에서 느린 가장 흔한 이유입니다. 쿼리 하나하나는 빠른데, 네트워크 왕복이 목록 길이만큼 쌓입니다.',
    headline: '네트워크 대기 (ms)',
    verdict: '느린 쿼리는 하나도 없습니다. 슬로우 쿼리 로그에도 안 잡힙니다. 느린 것은 "횟수"입니다. 목록이 길어질수록 격차는 선형으로 벌어집니다.',
    variants: [
      {
        name: 'N+1 (루프 안에서 쿼리)', tone: 'bad', big: { time: '왕복 N + 1번', space: 'O(n)' },
        code: `const posts = await db.query('SELECT * FROM posts LIMIT 8');
for (const post of posts) {
  post.author = await db.query(
    'SELECT * FROM users WHERE id = ?', post.userId);
}
return posts;`,
        notes: { 3: '게시글마다 DB 왕복' },
        run: queryRun(false),
      },
      {
        name: '배치 조회 (IN 한 번)', tone: 'good', big: { time: '왕복 2번', space: 'O(n)' },
        code: `const posts = await db.query('SELECT * FROM posts LIMIT 8');
const ids = posts.map(p => p.userId);
const users = await db.query(
  'SELECT * FROM users WHERE id IN (?)', ids);
const byId = new Map(users.map(u => [u.id, u]));
for (const post of posts) post.author = byId.get(post.userId);`,
        notes: { 3: 'DB 왕복 1번으로 전부', 6: '메모리 조회 O(1)' },
        run: queryRun(true),
      },
    ],
    points: [
      '메모리 접근은 나노초, 같은 데이터센터의 네트워크 왕복은 밀리초 단위입니다. <b>약 100만 배</b> 차이입니다.',
      '루프 안에 <code>await</code>로 I/O(DB, HTTP, Redis)를 호출하는 코드가 보이면 일단 멈추고 묶을 수 있는지 봅니다.',
      'ORM의 지연 로딩(lazy loading)은 이 코드를 눈에 안 보이게 만들어 냅니다. <code>post.author</code> 한 줄이 쿼리입니다.',
    ],
    senior: '이 패턴은 DB에만 있지 않습니다. 마이크로서비스 간 호출, GraphQL 리졸버, 외부 API 호출 전부 같은 병에 걸립니다. 처방도 같습니다: 배치 API, JOIN/eager loading, DataLoader식 요청 묶기. 탐지는 "요청당 쿼리 수"를 지표로 남기는 것이 가장 확실합니다. 다만 <code>IN</code> 목록이 수만 개가 되면 그것대로 문제이니 청크로 나누고, 서로 독립인 호출이라면 <code>Promise.all</code>로 병렬화하는 것도 방법입니다(대상 시스템의 동시 연결 한도 안에서).',
  });
})();
