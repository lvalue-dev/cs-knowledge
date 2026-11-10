/* 인메모리 저장소와 캐시: cache-aside, 영속화(스냅샷 vs AOF), 스킵 리스트, 캐시 무효화
   지연 시간은 원리를 보이기 위한 가정값이다 (DB 조회 20ms, 캐시 조회 1ms 등) */
(function () {
  const CS = window.CS;

  /* ---------- cache-aside ---------- */
  const CA_REQS = [7, 7, 3, 7, 3, 7, 7, 3], DB_MS = 20, CACHE_MS = 1;
  const caRun = (cached) => (t) => {
    t.m['DB 쿼리 수'] = 0; t.m['총 응답 시간 (ms)'] = 0;
    const store = [];
    const snap = (i, hot, s) => [
      { type: 'cells', title: '들어오는 요청 (상품 id)', items: CA_REQS.map((v, k) => ({ id: k, v, s: k === i ? 'active' : k < i ? 'dim' : '' })) },
      ...(cached ? [{ type: 'cells', title: '인메모리 저장소 (Redis) — 메모리에 key → value', items: store.map((v) => ({ id: v, v: `product:${v}`, s: v === hot ? s : '' })) }] : []),
      { type: 'cells', title: '디스크 기반 DB', items: [{ id: 'db', v: 'products 테이블', s: hot === 'db' ? 'bad' : '' }] },
    ];
    t.step(1, cached ? `DB 앞에 인메모리 저장소를 둡니다. 먼저 캐시를 보고, 없을 때만 DB에 갑니다.` : `상품 조회 요청 8개가 들어옵니다. 같은 상품을 여러 번 묻지만 매번 DB에 갑니다.`, snap(-1));
    CA_REQS.forEach((id, i) => {
      if (!cached) {
        t.m['DB 쿼리 수']++; t.m['총 응답 시간 (ms)'] += DB_MS;
        t.step(2, `상품 ${id} — DB 조회(${DB_MS}ms). 디스크에서 페이지를 읽고, SQL을 해석하고, 인덱스를 탑니다.${i && CA_REQS.slice(0, i).includes(id) ? ' <b>방금 읽은 것과 같은 데이터</b>입니다.' : ''}`, snap(i, 'db'));
        return;
      }
      if (store.includes(id)) {
        t.m['총 응답 시간 (ms)'] += CACHE_MS;
        t.step(3, `상품 ${id} — <b>캐시 적중.</b> 메모리에서 키 하나를 찾아 바로 반환합니다(약 ${CACHE_MS}ms, 대부분 네트워크 왕복).`, snap(i, id, 'done'));
        return;
      }
      t.m['총 응답 시간 (ms)'] += CACHE_MS;
      t.step(2, `상품 ${id} — 캐시에 없습니다(미스).`, snap(i));
      t.m['DB 쿼리 수']++; t.m['총 응답 시간 (ms)'] += DB_MS;
      t.step(4, `DB에서 읽어 옵니다(${DB_MS}ms).`, snap(i, 'db'));
      store.push(id); t.m['총 응답 시간 (ms)'] += CACHE_MS;
      t.step(5, `읽은 결과를 캐시에 저장합니다. <b>만료 시간(60초)</b>을 함께 줍니다. 다음 요청부터는 DB에 가지 않습니다.`, snap(i, id, 'new'));
    });
    t.step(cached ? 6 : 3, cached
      ? `DB 쿼리는 처음 본 상품 2번뿐입니다. 총 <b>${t.m['총 응답 시간 (ms)']}ms</b>.`
      : `8번 모두 DB에 갔습니다. 총 <b>${t.m['총 응답 시간 (ms)']}ms</b>. 읽기가 몰리면 DB가 먼저 지칩니다.`, snap(CA_REQS.length));
  };
  CS.add({
    id: 'cache-aside', level: 'mid',
    title: '인메모리 캐시: DB 앞에 Redis를 두는 이유',
    summary: '디스크 기반 DB는 정확하고 오래 보관하지만 조회마다 할 일이 많습니다. 자주 읽는 데이터를 메모리에 key-value로 올려 두면 같은 질문에 훨씬 싸게 답할 수 있습니다. 가장 널리 쓰는 cache-aside 패턴입니다.',
    headline: '총 응답 시간 (ms)',
    verdict: '인메모리 저장소가 빠른 이유는 (1) 디스크가 아니라 RAM에서 읽고 (2) SQL 해석·조인 없이 해시 조회 한 번으로 끝나기 때문입니다. 대가는 메모리 비용, 그리고 원본과 어긋날 수 있다는 점입니다.',
    variants: [
      {
        name: '매번 DB 조회', tone: 'bad', big: { time: '요청마다 DB 왕복', space: '–' },
        code: `async function getProduct(id) {
  return db.query('SELECT * FROM products WHERE id = ?', id);
}`,
        notes: { 2: '같은 데이터도 매번 조회' }, run: caRun(false),
      },
      {
        name: 'cache-aside (Redis)', tone: 'good', big: { time: '적중 시 메모리 조회', space: 'O(캐시한 키 수)' },
        code: `async function getProduct(id) {
  const cached = await redis.get('product:' + id);
  if (cached) return JSON.parse(cached);
  const row = await db.query('SELECT * FROM products WHERE id = ?', id);
  await redis.set('product:' + id, JSON.stringify(row), 'EX', 60);
  return row;
}`,
        notes: { 2: '먼저 캐시 확인', 3: '있으면 DB 생략', 5: '만료 시간과 함께 저장' }, run: caRun(true),
      },
    ],
    points: [
      'cache-aside: 애플리케이션이 <b>캐시를 먼저 보고 → 없으면 DB → 결과를 캐시에 저장</b>합니다. 캐시가 죽어도 DB로 동작합니다.',
      '효과는 <b>적중률</b>이 결정합니다. 읽기가 많고 같은 키를 반복해 읽는 데이터에 씁니다. 매번 다른 키면 메모리만 씁니다.',
      'Redis는 단순 key-value 이상입니다. 리스트, 해시, 집합, 정렬 집합, 만료, 원자적 증가를 제공해 세션·카운터·랭킹·분산 락에도 쓰입니다.',
    ],
    senior: '캐시를 넣는 순간 "데이터가 두 군데에 있다"는 문제를 떠안습니다. 값이 바뀌었을 때 캐시를 어떻게 할 것인가(무효화), 만료 순간 요청이 몰리면 어떻게 할 것인가(스탬피드), 캐시가 통째로 비면 DB가 버티는가(콜드 스타트)를 함께 설계해야 합니다. 또 캐시는 느린 쿼리를 가려 줄 뿐 고치지 않습니다. 인덱스로 해결될 문제에 캐시부터 붙이면 캐시가 비는 날 장애가 됩니다. 캐시 도입 전에 적중률을 예상해 보고, 도입 후에는 실제 적중률과 메모리 사용량을 지표로 봅니다.',
  });

  /* ---------- 영속화: 스냅샷 vs AOF ---------- */
  const WRITES = 8, SNAP_AT = 5;
  const persistRun = (aof) => (t) => {
    t.m['유실된 쓰기'] = 0; t.m['디스크 쓰기 횟수'] = 0;
    let mem = [], disk = [], dead = false;
    const snap = (hot) => [
      { type: 'cells', title: dead ? '메모리 (RAM) — 전원이 꺼지면 사라짐' : '메모리 (RAM)', items: mem.map((v) => ({ id: `m${v}`, v: `w${v}`, s: v === hot ? 'active' : '' })) },
      { type: 'cells', title: aof ? '디스크: 명령 로그 (AOF) — 쓰기마다 한 줄씩 덧붙임' : `디스크: 스냅샷 — ${SNAP_AT}번째 쓰기 시점의 메모리 전체 복사본`, items: disk.map((v) => ({ id: `d${v}`, v: aof ? `SET w${v}` : `w${v}`, s: 'new' })) },
    ];
    t.step(1, aof ? `쓰기가 올 때마다 메모리를 바꾸기 <b>전에</b> 그 명령을 디스크 로그 끝에 적습니다.` : `쓰기는 메모리에만 반영하고, 주기적으로 메모리 전체를 디스크에 복사(스냅샷)합니다.`, snap());
    for (let w = 1; w <= WRITES; w++) {
      if (aof) { disk.push(w); t.m['디스크 쓰기 횟수']++; t.step(2, `w${w} — 로그에 <code>SET w${w}</code>를 덧붙입니다(순차 쓰기라 빠릅니다).`, snap()); }
      mem.push(w);
      t.step(aof ? 3 : 2, `w${w} — 메모리에 반영. 클라이언트에게 "성공"을 응답합니다.`, snap(w));
      if (!aof && w === SNAP_AT) { disk = [...mem]; t.m['디스크 쓰기 횟수']++; t.step(4, `스냅샷 시점입니다. 지금 메모리 전체(w1~w${w})를 디스크에 저장합니다.`, snap()); }
    }
    dead = true; mem = [];
    t.step(0, `<b>전원이 나갑니다.</b> 메모리의 내용은 전부 사라졌습니다. 디스크에 있는 것만 남습니다.`, snap());
    mem = [...disk];
    t.m['유실된 쓰기'] = WRITES - mem.length;
    dead = false;
    t.step(7, aof
      ? `재시작 — 로그를 처음부터 다시 실행해 메모리를 복원합니다. <b>8개 전부</b> 돌아왔습니다.`
      : `재시작 — 마지막 스냅샷을 불러옵니다. w${SNAP_AT}까지만 있습니다. 그 뒤의 <b>w${SNAP_AT + 1}~w${WRITES}은 "성공"이라고 응답했지만 사라졌습니다.</b>`, snap());
  };
  CS.add({
    id: 'persistence', level: 'adv',
    title: '인메모리 저장소가 꺼지면: 스냅샷 vs 로그',
    summary: '메모리는 빠르지만 전원이 꺼지면 사라집니다. 인메모리 저장소는 이를 보완하려고 디스크에 흔적을 남기는데, 방식에 따라 "얼마나 잃는가"와 "얼마나 느려지는가"가 갈립니다.',
    headline: '유실된 쓰기',
    verdict: '스냅샷은 가볍지만 마지막 스냅샷 이후의 쓰기를 잃습니다. 로그(AOF)는 모든 쓰기를 남기는 대신 쓰기마다 디스크 작업이 붙습니다. 이 "먼저 로그에 적고 나서 반영한다"는 원리는 DB의 WAL과 같습니다.',
    variants: [
      {
        name: '주기적 스냅샷 (RDB)', tone: 'bad', label: '최근 쓰기 유실',
        code: `function set(key, value) {
  memory.set(key, value);
}
setInterval(() => disk.save(copy(memory)), INTERVAL);

function recover() {
  memory = disk.loadSnapshot();
}`,
        notes: { 2: '메모리에만 반영', 4: '가끔 전체를 복사', 7: '마지막 스냅샷 시점으로' }, run: persistRun(false),
      },
      {
        name: '명령 로그 (AOF)', tone: 'good', label: '유실 없음',
        code: `function set(key, value) {
  log.append('SET ' + key + ' ' + value);
  memory.set(key, value);
}

function recover() {
  for (const cmd of log.readAll()) apply(cmd);
}`,
        notes: { 2: '먼저 디스크 로그에 기록', 7: '로그를 재실행해 복원' }, run: persistRun(true),
      },
    ],
    points: [
      '이 데모의 로그 방식은 쓰기마다 디스크에 확정(fsync)한다고 가정했습니다. 실제로는 "1초마다 확정"이 흔한 기본값이고, 그러면 최대 1초치를 잃을 수 있습니다.',
      '로그는 계속 길어지므로 주기적으로 압축(재작성)합니다. 스냅샷과 로그를 함께 쓰는 구성도 일반적입니다.',
      '로그 덧붙이기는 디스크의 <b>순차 쓰기</b>라 임의 위치 쓰기보다 훨씬 빠릅니다. Kafka와 DB의 WAL이 빠른 이유도 같습니다.',
    ],
    senior: '결정해야 할 질문은 "이 데이터를 잃어도 되는가"입니다. 순수한 캐시라면 영속화를 끄고 속도를 얻는 편이 낫고, 세션·대기열·카운터처럼 원본이 Redis뿐이라면 유실 범위를 숫자로 정해야 합니다(RPO). 영속화는 장비 고장까지 막아 주지 않으므로 복제본(replica)과 함께 씁니다. 그런데 복제가 비동기면 장애 조치 순간 복제되지 않은 쓰기를 또 잃습니다. "성공 응답을 받았다"와 "안전하게 저장됐다" 사이의 거리를 아는 것이 핵심입니다.',
  });

  /* ---------- 스킵 리스트 (정렬 집합) ---------- */
  const SL = Array.from({ length: 15 }, (_, i) => (i + 1) * 10), SL_NEW = 135, MAXLV = 3;
  const height = (i) => { let h = 0, n = i + 1; while (n % 2 === 0 && h < MAXLV) { h++; n /= 2; } return h; }; // i번째 원소가 올라가는 최고 층
  CS.add({
    id: 'skip-list', level: 'adv',
    title: '스킵 리스트: 실시간 랭킹은 어떻게 정렬을 유지하나',
    summary: '점수가 바뀔 때마다 순위를 유지해야 하는 랭킹 보드. 정렬된 배열은 자리를 찾느라 훑고 넣느라 밀어야 합니다. Redis의 정렬 집합(Sorted Set)이 쓰는 스킵 리스트는 "급행 차선"을 여러 층 쌓아 이를 O(log n)으로 줄입니다.',
    headline: '비교 횟수',
    verdict: '위층일수록 원소가 듬성듬성해서 한 걸음에 멀리 갑니다. 위에서 크게 건너뛰고 아래로 내려오며 좁히면 이진 탐색과 같은 효과가 나고, 삽입은 포인터 몇 개만 고치면 됩니다. 원소가 100만 개여도 약 20번의 비교입니다.',
    variants: [
      {
        name: '정렬된 배열에 삽입', tone: 'bad', big: { time: 'O(n)', space: 'O(n)' },
        code: `function insert(sorted, score) {
  let i = 0;
  while (i < sorted.length && sorted[i] < score) i++;
  sorted.splice(i, 0, score);
}`,
        notes: { 3: '앞에서부터 하나씩', 4: '뒤 원소를 전부 밀기' },
        run(t) {
          t.m['비교 횟수'] = 0;
          const a = SL.map((v) => ({ id: v, v }));
          const snap = (i, s) => [{ type: 'cells', compact: true, title: `점수 오름차순 배열 — ${SL_NEW}점을 넣을 자리 찾기`, items: a.map((e, k) => ({ ...e, s: e.id === SL_NEW ? 'new' : k === i ? s : k < i ? 'dim' : '' })) }];
          t.step(2, `새 점수 <b>${SL_NEW}</b>이 들어왔습니다. 맨 앞부터 비교하며 자리를 찾습니다.`, snap(-1));
          let i = 0;
          while (i < a.length) {
            t.m['비교 횟수']++;
            if (a[i].v >= SL_NEW) { t.step(3, `${a[i].v} ≥ ${SL_NEW} — 여기 앞이 자리입니다. ${t.m['비교 횟수']}번 비교했습니다.`, snap(i, 'active')); break; }
            t.step(3, `${a[i].v} &lt; ${SL_NEW} — 다음 칸.`, snap(i, 'cmp'));
            i++;
          }
          a.splice(i, 0, { id: SL_NEW, v: SL_NEW });
          t.step(4, `${SL_NEW}을 넣고 뒤의 원소를 한 칸씩 밉니다. 앞쪽에 넣었다면 거의 전부를 밀어야 했습니다.`, snap(-1));
        },
      },
      {
        name: '스킵 리스트', tone: 'good', big: { time: '평균 O(log n)', space: 'O(n)' },
        code: `function insert(list, score) {
  let node = list.head;
  for (let lv = list.maxLevel; lv >= 0; lv--) {
    while (node.next[lv] && node.next[lv].score < score) {
      node = node.next[lv];
    }
    update[lv] = node;
  }
  link(new Node(score), update);
}`,
        notes: { 3: '위층부터 아래로', 4: '갈 수 있으면 건너뜀', 9: '포인터만 연결' },
        run(t) {
          t.m['비교 횟수'] = 0;
          const X = (i) => 40 + (i + 1) * 31, Y = (lv) => (MAXLV - lv) * 32 + 22;
          const visited = new Set(), path = [];
          let inserted = false;
          const snap = (cur, probe) => {
            const nodes = [], edges = [];
            for (let lv = MAXLV; lv >= 0; lv--) {
              nodes.push({ id: `h${lv}`, v: `L${lv}`, x: 26, y: Y(lv), w: 30, h: 22, s: cur === `h${lv}` ? 'active' : visited.has(`h${lv}`) ? 'cmp' : '' });
              let prev = `h${lv}`;
              const xs = SL.map((v, i) => [v, X(i + (inserted && v > SL_NEW ? 1 : 0)), i]).filter(([, , i]) => height(i) >= lv);
              if (inserted && lv === 0) xs.push([SL_NEW, X(13), -1]);
              xs.sort((p, q) => p[1] - q[1]);
              for (const [v, x] of xs) {
                const id = `${v}-${lv}`;
                nodes.push({ id, v, x, y: Y(lv), w: 27, h: 22, s: v === SL_NEW ? 'new' : id === cur ? 'active' : id === probe ? 'bad' : visited.has(id) ? 'cmp' : '' });
                edges.push({ a: prev, b: id, s: path.includes(`${prev}>${id}`) ? 'done' : '' });
                prev = id;
              }
            }
            return [{ type: 'graph', directed: true, w: 40 + 17 * 31, h: MAXLV * 32 + 44, scale: 1.4, title: '맨 아래 L0에 전부, 위층에는 일부만 — 위층이 급행 차선', nodes, edges }];
          };
          let cur = `h${MAXLV}`, curIdx = -1;
          t.step(2, `맨 위층의 출발점에서 시작합니다. <b>${SL_NEW}</b>이 들어갈 자리를 찾습니다.`, snap(cur));
          for (let lv = MAXLV; lv >= 0; lv--) {
            cur = curIdx < 0 ? `h${lv}` : `${SL[curIdx]}-${lv}`;
            visited.add(cur);
            for (;;) {
              let nx = curIdx + 1;
              while (nx < SL.length && height(nx) < lv) nx++;
              if (nx >= SL.length) { t.step(4, `L${lv}: 오른쪽에 더 없습니다. 한 층 내려갑니다.`, snap(cur)); break; }
              t.m['비교 횟수']++;
              if (SL[nx] < SL_NEW) {
                path.push(`${cur}>${SL[nx]}-${lv}`);
                curIdx = nx; cur = `${SL[nx]}-${lv}`; visited.add(cur);
                t.step(5, `L${lv}: 다음은 ${SL[nx]} &lt; ${SL_NEW} — <b>건너뜁니다.</b>${lv ? ' 사이의 원소들은 보지도 않습니다.' : ''}`, snap(cur));
              } else {
                t.step(4, `L${lv}: 다음은 ${SL[nx]} ≥ ${SL_NEW} — 지나칩니다. ${lv ? '한 층 내려가 더 촘촘하게 봅니다.' : '여기가 자리입니다.'}`, snap(cur, `${SL[nx]}-${lv}`));
                break;
              }
            }
          }
          inserted = true;
          t.step(9, `${SL[curIdx]} 뒤에 <b>${SL_NEW}</b>을 연결합니다. 다른 원소는 움직이지 않고 포인터만 바뀝니다. 비교는 ${t.m['비교 횟수']}번이었습니다.`, snap());
        },
      },
    ],
    points: [
      '각 원소가 몇 층까지 올라갈지는 <b>동전 던지기</b>로 정합니다(이 그림은 이해를 돕기 위해 규칙적으로 그렸습니다). 확률적으로 균형이 잡혀 평균 O(log n)이 됩니다.',
      '균형 이진 트리와 성능은 비슷하지만 구현이 단순하고, 정렬된 순서로 이어져 있어 <b>범위 조회</b>(상위 10명, 100~200등)가 쉽습니다.',
      'Redis 정렬 집합은 스킵 리스트(순위·범위용)와 해시 테이블(멤버 → 점수 조회용)을 함께 씁니다.',
    ],
    senior: '실시간 랭킹을 RDB로 구현하면 "내 순위"를 구하는 쿼리(<code>COUNT(*) WHERE score > ?</code>)가 사용자 수에 비례해 느려집니다. 정렬 집합은 순위 조회·점수 갱신·범위 조회가 모두 O(log n)이라 이 용도의 사실상 표준입니다. 같은 구조가 지연 작업 큐(점수 = 실행 시각), 슬라이딩 윈도 레이트 리미터(점수 = 타임스탬프), 타임라인 피드에도 쓰입니다. 다만 한 키에 수천만 원소가 쌓이면 그 키 하나가 메모리와 지연의 병목이 되므로 기간·구간별로 키를 나눕니다.',
  });

  /* ---------- 캐시 무효화 ---------- */
  const invRun = (del) => (t) => {
    t.m['옛 가격을 본 요청'] = 0;
    let db = 1000, cache = 1000;
    const seen = [];
    const snap = (hot) => [
      { type: 'cells', title: '원본과 캐시', items: [{ id: 'db', v: `${db.toLocaleString()}원`, sub: 'DB (원본)', s: hot === 'db' ? 'active' : '' }, { id: 'c', v: cache == null ? '없음' : `${cache.toLocaleString()}원`, sub: '캐시', s: hot === 'c' ? 'active' : cache == null ? 'hole' : cache !== db ? 'bad' : 'done' }] },
      { type: 'cells', title: '사용자에게 보인 가격', items: seen.map((v, k) => ({ id: k, v: `${v.toLocaleString()}원`, s: v === db ? 'done' : 'bad' })) },
    ];
    const read = (line, note) => {
      if (cache == null) { cache = db; seen.push(db); t.step(line, `조회 — 캐시에 없으므로 DB에서 읽어 <b>${db.toLocaleString()}원</b>을 캐시에 다시 채웁니다.`, snap('c')); return; }
      seen.push(cache);
      if (cache !== db) t.m['옛 가격을 본 요청']++;
      t.step(line, `조회 — 캐시 적중 → <b>${cache.toLocaleString()}원</b>. ${cache !== db ? `DB는 이미 ${db.toLocaleString()}원인데 <b>옛 가격</b>이 나갑니다. ${note}` : '원본과 같습니다.'}`, snap('c'));
    };
    t.step(1, `상품 가격 1,000원이 DB와 캐시에 모두 들어 있습니다. 운영자가 가격을 <b>1,200원</b>으로 올립니다.`, snap());
    db = 1200;
    t.step(2, `DB를 갱신했습니다.${del ? '' : ' 함수는 여기서 끝납니다. <b>캐시는 아무도 건드리지 않았습니다.</b>'}`, snap('db'));
    if (del) { cache = null; t.step(3, `이어서 캐시의 해당 키를 <b>삭제</b>합니다. 새 값을 써넣는 것이 아니라 지웁니다.`, snap('c')); }
    read(0, '');
    read(0, '');
    read(0, 'TTL이 끝날 때까지 계속 이럽니다.');
    t.step(del ? 4 : 3, del
      ? `갱신 직후 첫 조회가 DB에서 새 값을 읽어 캐시를 채웠고, 이후는 모두 새 가격입니다.`
      : `세 요청 모두 옛 가격을 봤습니다. 에러는 없습니다. 고객은 1,000원에 결제하려 하고 서버는 1,200원이라고 합니다.`, snap());
  };
  CS.add({
    id: 'cache-invalidation', level: 'senior',
    title: '캐시 무효화: 원본이 바뀌었는데 캐시는 모를 때',
    summary: '"컴퓨터 과학에서 어려운 두 가지는 캐시 무효화와 이름 짓기"라는 말이 있습니다. 데이터를 바꾸는 코드가 캐시를 함께 챙기지 않으면, 사용자는 TTL이 끝날 때까지 옛 값을 봅니다.',
    headline: '옛 가격을 본 요청',
    verdict: '쓰기 경로가 캐시를 지워야 읽기 경로가 새 값을 채웁니다. 새 값을 직접 써넣기보다 "지우기"를 쓰는 이유는, 동시에 일어난 두 갱신의 순서가 뒤바뀌어도 틀린 값이 캐시에 남지 않기 때문입니다.',
    variants: [
      {
        name: 'DB만 갱신', tone: 'bad', label: '옛 값 노출',
        code: `async function updatePrice(id, price) {
  await db.query('UPDATE products SET price = ? WHERE id = ?', price, id);
}`,
        notes: { 2: '캐시는 그대로 남음' }, run: invRun(false),
      },
      {
        name: 'DB 갱신 후 캐시 삭제', tone: 'good', label: '다음 조회에 갱신',
        code: `async function updatePrice(id, price) {
  await db.query('UPDATE products SET price = ? WHERE id = ?', price, id);
  await redis.del('product:' + id);
}`,
        notes: { 3: '지우면 다음 조회가 새 값으로 채움' }, run: invRun(true),
      },
    ],
    points: [
      '순서는 <b>DB 먼저, 캐시 삭제는 나중</b>입니다. 반대로 하면 삭제와 갱신 사이에 들어온 조회가 옛 값을 다시 캐시에 채웁니다.',
      'TTL은 무효화의 대체재가 아니라 <b>안전망</b>입니다. 삭제가 실패하거나 빠진 경로가 있어도 언젠가는 바로잡힙니다.',
      '같은 데이터가 여러 키에 들어 있으면(상세, 목록, 검색 결과) 전부 지워야 합니다. 키 설계가 무효화의 난이도를 정합니다.',
    ],
    senior: '"DB 갱신 후 삭제"도 완벽하지 않습니다. 삭제 호출이 실패하면 옛 값이 남고, 드물게는 캐시 미스로 옛 값을 읽던 요청이 삭제보다 늦게 캐시에 써넣는 경쟁도 있습니다. 그래서 중요한 데이터에는 TTL을 짧게 두고, 삭제 실패를 재시도 큐로 보내거나, DB 변경 로그(CDC)를 구독해 무효화를 한곳에서 처리합니다. 가격·재고·권한처럼 틀리면 안 되는 값은 최종 판정 시점(결제, 차감)에 반드시 원본으로 다시 확인하세요. 캐시는 "보여 주는 용도"로만 믿는 것이 원칙입니다.',
  });
})();
