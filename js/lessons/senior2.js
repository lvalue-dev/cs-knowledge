/* 시니어(실전): 데드락, 페이지네이션, 캐시 스탬피드, 커넥션 풀, 일관 해싱, 멱등성 */
(function () {
  const CS = window.CS;

  /* ---------- 데드락 ---------- */
  const deadlockRun = (ordered) => (t) => {
    t.m['완료된 이체'] = 0; t.m['멈춘 스레드'] = 0;
    const held = {}, wait = {}, st = {};
    const snap = (cur) => [{
      type: 'graph', directed: true, w: 420, h: 160, scale: 1.5,
      title: '실선: 락 → 보유한 스레드 · 붉은 점선: 스레드 → 기다리는 락',
      nodes: [
        { id: 'T1', v: 'T1: A→B 이체', x: 80, y: 32, w: 104, s: st.T1 || (cur === 'T1' ? 'active' : 'cmp') },
        { id: 'T2', v: 'T2: B→A 이체', x: 80, y: 128, w: 104, s: st.T2 || (cur === 'T2' ? 'active' : 'cmp') },
        { id: 'A', v: '계좌 A 락', x: 330, y: 32, w: 78, round: true, s: held.A ? 'new' : '' },
        { id: 'B', v: '계좌 B 락', x: 330, y: 128, w: 78, round: true, s: held.B ? 'new' : '' },
      ],
      edges: [
        ...Object.entries(held).filter((e) => e[1]).map(([lock, th]) => ({ a: lock, b: th, s: 'done' })),
        ...Object.entries(wait).filter((e) => e[1]).map(([th, lock]) => ({ a: th, b: lock, s: 'bad' })),
      ],
    }];
    t.step(1, `두 요청이 동시에 들어옵니다. T1은 A→B 이체, T2는 B→A 이체. 둘 다 계좌 두 개를 잠가야 합니다.`, snap());
    if (!ordered) {
      held.A = 'T1'; t.step(2, `<b>T1</b>: <code>lock(from)</code> — 계좌 A를 잠급니다.`, snap('T1'));
      held.B = 'T2'; t.step(2, `<b>T2</b>: <code>lock(from)</code> — 계좌 B를 잠급니다. (T2에게는 B가 from)`, snap('T2'));
      wait.T1 = 'B'; t.step(3, `<b>T1</b>: <code>lock(to)</code> — B가 필요한데 T2가 쥐고 있습니다. 기다립니다.`, snap('T1'));
      wait.T2 = 'A'; st.T1 = st.T2 = 'bad'; t.m['멈춘 스레드'] = 2;
      t.step(3, `<b>T2</b>: <code>lock(to)</code> — A가 필요한데 T1이 쥐고 있습니다. 화살표가 <b>고리</b>를 이뤘습니다. 서로가 서로를 기다리므로 영원히 풀리지 않습니다.`, snap('T2'));
      t.step(3, `<b>데드락.</b> 에러도 없고 CPU도 쓰지 않습니다. 그냥 멈춰 있다가 타임아웃이 납니다.`, snap());
      return;
    }
    t.step(2, `두 스레드 모두 <b>id가 작은 계좌부터</b> 잠그기로 약속합니다. T2도 A부터 시도합니다.`, snap());
    held.A = 'T1'; t.step(3, `<b>T1</b>: <code>lock(first)</code> — 계좌 A를 잠급니다.`, snap('T1'));
    wait.T2 = 'A'; t.step(3, `<b>T2</b>: <code>lock(first)</code> — 역시 A부터. 이미 잠겨 있어 기다립니다. <b>B는 건드리지 않은 채로</b> 기다리는 것이 핵심입니다.`, snap('T2'));
    held.B = 'T1'; t.step(4, `<b>T1</b>: <code>lock(second)</code> — B는 아무도 쥐고 있지 않습니다. 바로 획득.`, snap('T1'));
    t.m['완료된 이체'] = 1; t.step(5, `<b>T1</b>: 이체 실행.`, snap('T1'));
    held.A = held.B = null; st.T1 = 'done'; t.step(6, `<b>T1</b>: 락을 모두 풉니다.`, snap('T1'));
    wait.T2 = null; held.A = 'T2'; t.step(3, `<b>T2</b>: 기다리던 A를 획득합니다.`, snap('T2'));
    held.B = 'T2'; t.step(4, `<b>T2</b>: B 획득.`, snap('T2'));
    t.m['완료된 이체'] = 2; held.A = held.B = null; st.T2 = 'done';
    t.step(6, `<b>T2</b>: 이체 후 락 해제. 고리가 한 번도 만들어지지 않았습니다.`, snap());
  };
  CS.add({
    id: 'deadlock', level: 'senior',
    title: '데드락: 서로가 서로를 기다린다',
    summary: '락을 두 개 이상 잡는 코드가 서로 다른 순서로 잡으면, 각자 하나씩 쥔 채 상대 것을 기다리는 상황이 생깁니다. CPU는 0%인데 요청은 끝나지 않습니다.',
    verdict: '데드락은 "기다림의 고리"입니다. 모든 코드가 같은 순서로 락을 잡으면 고리가 만들어질 수 없습니다.',
    variants: [
      {
        name: '인자 순서대로 락 획득', tone: 'bad', label: '교착',
        code: `async function transfer(from, to, amount) {
  await lock(from);
  await lock(to);
  from.balance -= amount; to.balance += amount;
  unlock(to); unlock(from);
}`,
        notes: { 2: '호출마다 순서가 다름', 3: '하나 쥔 채로 대기' }, run: deadlockRun(false),
      },
      {
        name: '항상 같은 순서로 락 획득', tone: 'good', label: '정상 완료',
        code: `async function transfer(from, to, amount) {
  const [first, second] = [from, to].sort(byId);
  await lock(first);
  await lock(second);
  from.balance -= amount; to.balance += amount;
  unlock(second); unlock(first);
}`,
        notes: { 2: '전역적으로 일관된 순서' }, run: deadlockRun(true),
      },
    ],
    points: [
      '데드락의 네 조건: 상호 배제, <b>점유한 채 대기</b>, 빼앗을 수 없음, <b>순환 대기</b>. 하나만 깨면 됩니다.',
      '가장 실용적인 방법은 순환 대기를 깨는 것(락 순서 통일)과 타임아웃을 두는 것입니다.',
      '경쟁 상태를 막으려고 넣은 락이 데드락을 만듭니다. 락은 적게, 짧게.',
    ],
    senior: 'DB에서 훨씬 자주 만납니다. 트랜잭션 X가 행 1 → 행 2 순서로, 트랜잭션 Y가 행 2 → 행 1 순서로 UPDATE하면 같은 그림입니다. DB는 고리를 감지해서 한쪽을 강제로 롤백시키고 "Deadlock found when trying to get lock" 에러를 줍니다. 대응은 ① 여러 행을 건드릴 때 항상 같은 순서(예: PK 오름차순)로 ② 트랜잭션을 짧게, 트랜잭션 안에서 외부 API를 호출하지 않고 ③ 데드락 에러는 재시도하도록 만드는 것입니다. 애플리케이션 레벨에서는 스레드 덤프에서 BLOCKED 상태 스레드들이 서로의 락을 기다리고 있으면 확정입니다.',
  });

  /* ---------- 페이지네이션 ---------- */
  const PER = 4;
  CS.add({
    id: 'pagination', level: 'senior',
    title: '페이지네이션: OFFSET은 뒤로 갈수록 느려진다',
    summary: '1페이지는 빠른데 500페이지는 느립니다. OFFSET은 "건너뛰기"가 아니라 "읽고 버리기"이기 때문입니다. 마지막으로 본 위치에서 이어 읽는 커서 방식과 비교합니다.',
    param: { label: '조회할 페이지', options: [2, 4, 7], value: 4 },
    headline: '읽은 행',
    verdict: 'OFFSET은 페이지 번호에 비례해서 읽고, 커서는 항상 한 페이지 분량만 읽습니다. 10만 번째 페이지라면 40만 행 대 4행입니다.',
    variants: [
      {
        name: 'LIMIT / OFFSET', tone: 'bad', big: { time: 'O(offset + limit)', space: 'O(1)' },
        code: `SELECT * FROM posts
ORDER BY id DESC
LIMIT 4 OFFSET :offset;`,
        notes: { 3: 'offset개를 읽고 버린 뒤 4개 반환' },
        run(t, page) {
          const offset = (page - 1) * PER, total = 32;
          t.m['읽은 행'] = 0; t.m['읽고 버린 행'] = 0;
          const snap = (read) => [{
            type: 'cells', cols: 8, compact: true, title: `posts 테이블 (id 내림차순) — ${page}페이지 = OFFSET ${offset}`,
            items: Array.from({ length: total }, (_, k) => ({ id: k, v: 100 - k, gap: k % PER === PER - 1, s: k >= read ? '' : k < offset ? 'bad' : 'done' })),
          }];
          t.step(2, `인덱스를 따라 최신 글부터 읽기 시작합니다. DB는 "${offset}번째 행"이 어디 있는지 미리 알 수 없습니다.`, snap(0));
          for (let k = 0; k < offset; k++) {
            t.m['읽은 행']++; t.m['읽고 버린 행']++;
            t.step(3, `id ${100 - k} — 읽었지만 OFFSET 범위라 <b>버립니다.</b> (${k + 1} / ${offset})`, snap(k + 1));
          }
          t.m['읽은 행'] += PER;
          t.step(3, `이제야 원하는 4행을 반환합니다. 4행을 보여 주려고 <b>${offset + PER}행</b>을 읽었습니다.`, snap(offset + PER));
        },
      },
      {
        name: '커서 (keyset)', tone: 'good', big: { time: 'O(log n + limit)', space: 'O(1)' },
        code: `SELECT * FROM posts
WHERE id < :last_seen_id
ORDER BY id DESC
LIMIT 4;`,
        notes: { 2: '인덱스로 시작 위치에 바로 이동' },
        run(t, page) {
          const offset = (page - 1) * PER, total = 32, last = 100 - offset + 1;
          t.m['읽은 행'] = 0; t.m['읽고 버린 행'] = 0;
          const snap = (read, seek) => [{
            type: 'cells', cols: 8, compact: true, title: `posts 테이블 (id 내림차순) — 앞 페이지의 마지막 id = ${last}`,
            items: Array.from({ length: total }, (_, k) => ({ id: k, v: 100 - k, gap: k % PER === PER - 1, s: k < offset ? 'dim' : k < offset + read ? 'done' : seek && k === offset ? 'active' : '' })),
          }];
          t.step(1, `클라이언트가 "마지막으로 본 글의 id는 ${last}"이라고 알려 줍니다.`, snap(0));
          t.step(2, `<code>id &lt; ${last}</code> — B-Tree 인덱스를 타고 그 위치로 <b>바로 이동</b>합니다. 앞의 ${offset}행은 건드리지 않습니다.`, snap(0, true));
          t.m['읽은 행'] = PER;
          t.step(4, `거기서부터 4행만 읽고 끝. 몇 페이지든 읽는 양이 같습니다.`, snap(PER));
        },
      },
    ],
    points: [
      'OFFSET N은 앞의 N행을 실제로 읽어야 합니다. 정렬 인덱스가 없으면 매번 전체 정렬까지 합니다.',
      'OFFSET은 조회 사이에 글이 추가·삭제되면 <b>같은 글이 두 번 나오거나 건너뛰는</b> 문제도 있습니다. 커서는 그렇지 않습니다.',
      '커서의 대가: "37페이지로 바로 가기"가 안 되고, 정렬 기준이 유일해야 합니다(<code>created_at</code>만으로 부족하면 <code>(created_at, id)</code>).',
    ],
    senior: '무한 스크롤·피드·API 목록에는 커서, 관리자 화면처럼 페이지 번호가 꼭 필요하고 깊이가 얕은 곳에는 OFFSET이 실용적입니다. 운영에서는 깊은 페이지를 긁어 가는 크롤러 하나가 DB를 느리게 만드는 일이 흔하므로, OFFSET을 쓴다면 최대 페이지를 제한하세요. 그리고 목록 위에 붙는 "총 N건"(<code>COUNT(*)</code>)이 본 쿼리보다 비싼 경우가 많습니다. 정확한 총 개수가 정말 필요한지부터 물어볼 만합니다.',
  });

  /* ---------- 캐시 스탬피드 ---------- */
  const REQN = 5, QMS = 40;
  const stampedeRun = (single) => (t) => {
    t.m['무거운 DB 쿼리 수'] = 0;
    const items = [];
    const snap = () => [{ type: 'timeline', total: 60, title: '시간 축 → 캐시가 만료된 직후 요청 5개가 거의 동시에 도착', items: items.map((x) => ({ ...x })) }];
    const L = single ? { get: 3, q: 5, done: 6, ret: 9 } : { get: 2, q: 4, done: 5, ret: 7 };
    t.step(L.get, `인기 랭킹 캐시의 TTL이 방금 만료됐습니다. 요청들이 차례로 캐시를 확인합니다.`, snap());
    for (let i = 0; i < REQN; i++) {
      const first = i === 0 || !single;
      if (first) t.m['무거운 DB 쿼리 수']++;
      items.push({ id: i, label: `요청 ${i + 1}`, start: i * 3, len: first ? QMS : QMS - i * 3, s: first ? (single ? 'active' : 'bad') : 'cmp', text: first ? 'DB 쿼리' : '결과 기다림' });
      t.step(first ? L.q : L.ret, first
        ? (i === 0 ? `요청 1 — 캐시 없음. 무거운 쿼리를 시작합니다(${QMS}ms).` : `요청 ${i + 1} — 캐시 없음. 앞 요청의 쿼리가 <b>아직 안 끝나서 캐시는 여전히 비어 있습니다.</b> 똑같은 쿼리를 또 시작합니다.`)
        : `요청 ${i + 1} — 캐시는 없지만 <b>이미 진행 중인 쿼리</b>가 있습니다. 새로 시작하지 않고 그 결과를 함께 기다립니다.`, snap());
    }
    items.forEach((x) => { if (x.s !== 'bad') x.s = 'done'; });
    t.step(L.done, single
      ? `쿼리 <b>1번</b>으로 5개 요청이 모두 응답을 받았습니다. 결과는 캐시에 저장됩니다.`
      : `같은 쿼리 <b>${REQN}개</b>가 동시에 DB를 때렸습니다. 실제 트래픽이면 수백 개이고, DB가 느려지면서 쿼리가 더 오래 걸려 더 많은 요청이 쌓입니다.`, snap());
  };
  CS.add({
    id: 'cache-stampede', level: 'senior',
    title: '캐시 스탬피드: 만료 순간에 몰려드는 요청',
    summary: '캐시가 있는 동안은 평화롭습니다. 문제는 만료되는 그 순간입니다. 동시에 들어온 요청들이 전부 "캐시 없음"을 보고 전부 같은 무거운 쿼리를 실행합니다.',
    headline: '무거운 DB 쿼리 수',
    verdict: '캐시 확인과 캐시 채우기 사이에는 시간 차가 있고, 그 틈으로 요청이 몰려듭니다. 진행 중인 작업을 공유하면(single-flight) 쿼리는 한 번만 실행됩니다.',
    variants: [
      {
        name: '없으면 각자 조회', tone: 'bad', label: '쿼리 폭주',
        code: `async function getRanking() {
  let data = await cache.get('ranking');
  if (!data) {
    data = await db.heavyQuery();
    await cache.set('ranking', data, { ttl: 60 });
  }
  return data;
}`,
        notes: { 3: '모든 요청이 동시에 참', 4: '같은 쿼리를 각자 실행' }, run: stampedeRun(false),
      },
      {
        name: '진행 중인 조회를 공유 (single-flight)', tone: 'good', label: '쿼리 1번',
        code: `let inflight = null;
async function getRanking() {
  const data = await cache.get('ranking');
  if (data) return data;
  inflight ??= db.heavyQuery().then(async (d) => {
    await cache.set('ranking', d, { ttl: 60 });
    inflight = null; return d;
  });
  return inflight;
}`,
        notes: { 5: '첫 요청만 쿼리 시작', 9: '나머지는 같은 Promise를 기다림' }, run: stampedeRun(true),
      },
    ],
    points: [
      '"확인하고 → 없으면 → 채운다"는 경쟁 상태의 check-then-act와 같은 구조입니다.',
      '인기 있는 키일수록, 원본 쿼리가 느릴수록 피해가 큽니다.',
      '키 여러 개의 TTL이 같은 시각에 끝나면 동시에 터집니다. TTL에 무작위 편차(지터)를 섞습니다.',
    ],
    senior: '서버가 여러 대면 프로세스 안의 single-flight만으로는 서버 수만큼 쿼리가 나갑니다. 그때는 분산 락을 잡은 쪽만 갱신하게 하거나, 만료된 값을 일단 돌려주면서 뒤에서 갱신하는 stale-while-revalidate, 만료 전에 미리 갱신하는 방식을 씁니다. 증상은 "DB 부하 그래프에 TTL 주기와 같은 간격의 스파이크"입니다. 배포 직후나 캐시 서버 재시작 직후(캐시가 통째로 비었을 때)에 장애가 나는 것도 같은 현상이므로, 그런 작업은 트래픽이 적을 때 하거나 캐시를 미리 데워 둡니다.',
  });

  /* ---------- 커넥션 풀 고갈 ---------- */
  const POOL = 3, OUTCOME = ['ok', 'fail', 'ok', 'fail', 'ok', 'fail', 'ok', 'ok'];
  const poolRun = (safe) => (t) => {
    t.m['처리한 요청'] = 0; t.m['반환 안 된 커넥션'] = 0; t.m['멈춘 요청'] = 0;
    const conns = Array(POOL).fill(''), waiting = [];
    const L = safe ? { acq: 2, q: 4, thr: 5, rel: 8 } : { acq: 2, q: 3, thr: 4, rel: 5 };
    const snap = (cur) => [
      { type: 'cells', title: `커넥션 풀 (최대 ${POOL}개) — 붉은 칸은 반환되지 않은 커넥션`, items: conns.map((s, i) => ({ id: i, v: `conn ${i + 1}`, s, sub: s === 'bad' ? '누수' : s === 'active' ? `요청 ${cur}` : '대기 중' })) },
      { type: 'cells', title: '커넥션을 기다리며 멈춘 요청', items: waiting.map((r) => ({ id: r, v: `요청 ${r}`, s: 'bad' })) },
    ];
    t.step(1, `요청 8개를 차례로 처리합니다. 그중 일부는 조회 결과가 없어 예외가 납니다.`, snap());
    OUTCOME.forEach((res, i) => {
      const r = i + 1, slot = conns.indexOf('');
      if (slot < 0) {
        waiting.push(r); t.m['멈춘 요청']++;
        t.step(L.acq, `요청 ${r}: <code>pool.acquire()</code> — 남은 커넥션이 <b>없습니다.</b> 누군가 반환하기를 기다리지만, 아무도 반환하지 않습니다.`, snap(r));
        return;
      }
      conns[slot] = 'active';
      t.step(L.acq, `요청 ${r}: 풀에서 커넥션을 빌립니다.`, snap(r));
      if (res === 'fail') {
        if (safe) {
          t.step(L.thr, `요청 ${r}: 결과 없음 → 예외 발생. 하지만 <code>finally</code>는 예외가 나도 실행됩니다.`, snap(r));
          conns[slot] = '';
          t.step(L.rel, `요청 ${r}: <code>conn.release()</code> — 커넥션이 풀로 돌아갑니다.`, snap(r));
        } else {
          conns[slot] = 'bad'; t.m['반환 안 된 커넥션']++;
          t.step(L.thr, `요청 ${r}: 결과 없음 → 예외 발생. 함수가 여기서 끝나서 아래의 <code>release()</code>는 <b>실행되지 않습니다.</b> 커넥션 하나가 영영 돌아오지 않습니다.`, snap(r));
        }
        t.m['처리한 요청']++;
        return;
      }
      t.step(L.q, `요청 ${r}: 쿼리 실행, 결과 있음.`, snap(r));
      conns[slot] = ''; t.m['처리한 요청']++;
      t.step(L.rel, `요청 ${r}: <code>conn.release()</code> — 커넥션 반환.`, snap(r));
    });
    t.step(safe ? 10 : 7, safe
      ? `예외가 몇 번 나든 풀은 그대로입니다. 8개 요청 모두 처리했습니다.`
      : `예외 3번에 커넥션 3개가 모두 새어 나갔습니다. 이후 요청은 전부 타임아웃입니다. DB는 한가한데 서비스는 죽어 있습니다.`, snap());
  };
  CS.add({
    id: 'connection-pool', level: 'senior',
    title: '커넥션 풀 고갈: DB는 한가한데 요청이 멈춘다',
    summary: 'DB 커넥션은 개수가 정해진 자원이라 빌려 쓰고 돌려줘야 합니다. 예외가 나는 경로에서 반환을 빼먹으면 커넥션이 하나씩 사라지다가, 어느 순간 모든 요청이 멈춥니다.',
    headline: '반환 안 된 커넥션',
    verdict: '정상 경로만 보면 두 코드는 똑같이 동작합니다. 차이는 예외 경로입니다. 빌린 자원은 반드시 finally(또는 그에 해당하는 구문)에서 반환해야 합니다.',
    variants: [
      {
        name: '정상 경로에서만 반환', tone: 'bad', label: '커넥션 누수',
        code: `async function handler(req) {
  const conn = await pool.acquire();
  const rows = await conn.query(sql);
  if (!rows.length) throw new NotFound();
  conn.release();
  return rows;
}`,
        notes: { 4: '여기서 나가면 반환 안 됨', 5: '예외 시 실행되지 않음' }, run: poolRun(false),
      },
      {
        name: 'try / finally로 반환 보장', tone: 'good', label: '항상 반환',
        code: `async function handler(req) {
  const conn = await pool.acquire();
  try {
    const rows = await conn.query(sql);
    if (!rows.length) throw new NotFound();
    return rows;
  } finally {
    conn.release();
  }
}`,
        notes: { 8: '어떤 경로로 나가도 실행' }, run: poolRun(true),
      },
    ],
    points: [
      '풀은 "한정된 자원 + 대기 줄"입니다. 반환이 없으면 대기 줄은 영원히 줄지 않습니다.',
      '누수는 예외·조기 return·타임아웃 같은 <b>드문 경로</b>에 숨어 있어서, 배포 후 몇 시간~며칠 뒤에 터집니다.',
      '파일 핸들, 소켓, 락, 세마포어도 전부 같은 규칙입니다: 획득 직후 try, 해제는 finally.',
    ],
    senior: '누수가 없어도 풀은 고갈됩니다. 커넥션을 쥔 채로 느린 외부 API를 호출하거나 긴 트랜잭션을 돌리면, 그 시간 동안 커넥션이 묶여 같은 증상이 납니다. 그래서 풀 지표(사용 중 / 유휴 / 대기 수, 획득 대기 시간)를 반드시 수집해야 합니다. "DB CPU는 낮은데 애플리케이션은 타임아웃, 재시작하면 한동안 정상"이면 풀을 의심합니다. 풀 크기를 무작정 늘리는 것은 답이 아닙니다. <code>인스턴스 수 × 풀 크기</code>가 DB의 최대 커넥션 수를 넘으면 DB 쪽에서 거부당하고, 커넥션이 너무 많으면 DB 자체가 느려집니다.',
  });

  /* ---------- 일관 해싱 ---------- */
  const KEYS = [5, 12, 20, 28, 37, 44, 52, 61, 70, 78, 86, 95];
  const RING3 = [[30, 'S1'], [60, 'S2'], [90, 'S3']], RING4 = [[30, 'S1'], [45, 'S4'], [60, 'S2'], [90, 'S3']];
  const ringOwner = (ring, h) => (ring.find((n) => n[0] >= h) || ring[0])[1];
  CS.add({
    id: 'consistent-hashing', level: 'senior',
    title: '일관 해싱: 서버 한 대 추가했더니 캐시가 다 날아갔다',
    summary: '캐시 서버 3대에 키를 나눠 담다가 4대로 늘렸습니다. 나누는 규칙이 "해시 % 서버 수"라면 거의 모든 키의 담당 서버가 바뀌어, 캐시가 통째로 빈 것과 같아집니다.',
    headline: '담당 서버가 바뀐 키',
    verdict: '% N 방식은 N이 바뀌면 대부분의 키가 이사합니다. 일관 해싱은 새 서버가 맡게 된 구간의 키만 옮기므로, 평균적으로 전체의 1/N만 영향을 받습니다.',
    variants: [
      {
        name: 'hash % 서버 수', tone: 'bad', label: '대부분 재배치',
        code: `function pick(key, servers) {
  return servers[hash(key) % servers.length];
}`,
        notes: { 2: 'length가 바뀌면 결과가 전부 바뀜' },
        run(t) {
          t.m['담당 서버가 바뀐 키'] = 0; t.m['캐시 적중률 (%)'] = 100;
          const now = {};
          const snap = (cur, n) => [{
            type: 'cells', title: `키 12개 (숫자 = 해시값) — 아래는 담당 서버 · 현재 서버 ${n}대`,
            items: KEYS.map((h) => ({ id: h, v: h, sub: now[h] ? `S${now[h].to + 1}` : `S${(h % 3) + 1}`, s: h === cur ? 'active' : now[h] ? (now[h].moved ? 'bad' : 'done') : '' })),
          }];
          t.step(2, `서버 3대일 때: <code>hash % 3</code>으로 담당 서버를 정했습니다. 캐시가 잘 채워져 있습니다.`, snap(null, 3));
          t.step(2, `서버를 <b>4대로</b> 늘립니다. 이제 같은 키에 <code>hash % 4</code>를 적용합니다.`, snap(null, 4));
          let moved = 0;
          KEYS.forEach((h) => {
            const was = h % 3, to = h % 4;
            now[h] = { to, moved: was !== to };
            if (was !== to) moved++;
            t.m['담당 서버가 바뀐 키'] = moved;
            t.m['캐시 적중률 (%)'] = Math.round(((KEYS.length - moved) / KEYS.length) * 100);
            t.step(2, was !== to
              ? `키 ${h}: ${h} % 3 = S${was + 1} → ${h} % 4 = <b>S${to + 1}</b>. 새 서버에는 이 키의 캐시가 없습니다 → 미스.`
              : `키 ${h}: 우연히 같은 서버(S${to + 1})에 남았습니다.`, snap(h, 4));
          });
          t.step(3, `12개 중 <b>${moved}개</b>가 다른 서버로 갔습니다. 서버를 늘린 순간 적중률이 ${t.m['캐시 적중률 (%)']}%로 떨어지고, 그만큼의 요청이 DB로 쏟아집니다.`, snap(null, 4));
        },
      },
      {
        name: '일관 해싱 (해시 링)', tone: 'good', label: '일부만 재배치',
        code: `function pick(key, ring) {
  const h = hash(key);
  const node = ring.find(n => n.pos >= h) ?? ring[0];
  return node.server;
}`,
        notes: { 3: '시계 방향으로 처음 만나는 서버' },
        run(t) {
          t.m['담당 서버가 바뀐 키'] = 0; t.m['캐시 적중률 (%)'] = 100;
          const at = (p, r) => ({ x: 130 + r * Math.sin((p / 100) * 2 * Math.PI), y: 118 - r * Math.cos((p / 100) * 2 * Math.PI) });
          const snap = (ring, moved = []) => [{
            type: 'graph', w: 260, h: 250, scale: 1.7, title: '해시 공간을 원으로 놓고, 키는 시계 방향으로 처음 만나는 서버가 담당',
            nodes: [
              ...ring.map(([p, name]) => ({ id: name, v: name, ...at(p, 62), w: 30, s: name === 'S4' ? 'new' : 'cmp' })),
              ...KEYS.map((h) => ({ id: 'k' + h, v: h, ...at(h, 100), w: 24, round: true, sub: ringOwner(ring, h), s: moved.includes(h) ? 'bad' : ring.length === 4 ? 'done' : '' })),
            ],
            edges: [],
          }];
          t.step(2, `서버 3대가 원 위의 30, 60, 90 위치에 있습니다. 각 키는 자기 해시값에서 시계 방향으로 처음 만나는 서버가 맡습니다.`, snap(RING3));
          t.step(3, `서버 S4를 <b>45 위치</b>에 추가합니다. S4는 30 초과 ~ 45 이하 구간만 넘겨받습니다.`, snap(RING4));
          const moved = KEYS.filter((h) => ringOwner(RING3, h) !== ringOwner(RING4, h));
          t.m['담당 서버가 바뀐 키'] = moved.length;
          t.m['캐시 적중률 (%)'] = Math.round(((KEYS.length - moved.length) / KEYS.length) * 100);
          t.step(3, `담당이 바뀐 키는 그 구간에 있던 <b>${moved.join(', ')}</b>뿐입니다. 나머지 ${KEYS.length - moved.length}개는 그대로입니다.`, snap(RING4, moved));
          t.step(4, `적중률 ${t.m['캐시 적중률 (%)']}% 유지. 서버를 빼는 경우에도 그 서버가 맡던 구간만 옆 서버로 넘어갑니다.`, snap(RING4, moved));
        },
      },
    ],
    points: [
      '분산의 기본 질문: "이 데이터는 어느 서버에 있는가". 규칙이 서버 수에 통째로 의존하면 확장할 때마다 전부 흔들립니다.',
      '실제로는 서버 하나를 원 위에 수백 개의 가상 노드로 흩어 놓아 구간 크기를 고르게 만듭니다.',
      '캐시 클러스터, 분산 DB 파티셔닝, 로드 밸런서의 세션 고정이 이 원리를 씁니다.',
    ],
    senior: '증상은 "스케일 아웃(또는 서버 한 대 장애) 직후 캐시 적중률 급락 → DB 부하 급증"입니다. 서버를 늘려서 살리려던 조치가 오히려 장애를 키우는 전형입니다. 캐시 클라이언트의 분배 방식이 modulo인지 일관 해싱(ketama 등)인지 확인하세요. DB 샤딩도 같습니다. <code>user_id % 샤드 수</code>로 나눴다면 샤드를 추가하는 날 거의 모든 데이터를 옮겨야 합니다. 그래서 처음부터 고정된 개수의 논리 슬롯(Redis Cluster의 16,384개 슬롯처럼)에 매핑하고 슬롯 단위로 옮기는 설계를 씁니다.',
  });

  /* ---------- 멱등성 ---------- */
  const idemRun = (safe) => (t) => {
    t.m['결제된 횟수'] = 0; t.m['고객이 낸 금액 (원)'] = 0;
    const items = [], ledger = [];
    const snap = () => [
      { type: 'timeline', total: 100, title: '시간 축 → 클라이언트와 서버 사이', items: items.map((x) => ({ ...x })) },
      { type: 'cells', title: '결제 원장 (실제로 빠져나간 돈)', items: ledger.map((v, i) => ({ id: i, v, s: i ? 'bad' : 'done' })) },
      ...(safe ? [{ type: 'cells', title: '처리 결과 저장소 (idempotency-key → 결과)', items: ledger.length ? [{ id: 'k', v: 'key abc-123 → 성공', s: 'new' }] : [] }] : []),
    ];
    const add = (id, label, start, len, s, text) => { items.push({ id, label, start, len, s, text }); };
    const charge = safe ? 5 : 2;
    add('r1', '요청 1', 0, 20, 'active', 'POST /pay');
    t.step(1, `사용자가 결제 버튼을 누릅니다. 1만 원 결제 요청이 서버로 갑니다.${safe ? ' 클라이언트가 만든 고유 키(abc-123)가 헤더에 실려 있습니다.' : ''}`, snap());
    if (safe) t.step(3, `이 키로 처리한 적이 있는지 확인합니다 → 없음. 처음 온 요청입니다.`, snap());
    ledger.push('10,000원'); t.m['결제된 횟수'] = 1; t.m['고객이 낸 금액 (원)'] = 10000;
    add('c1', '서버: 결제', 20, 15, 'done', 'charge');
    t.step(charge, `서버가 결제를 실행합니다. 돈이 빠져나갔습니다.`, snap());
    if (safe) t.step(6, `결과를 키와 함께 저장합니다.`, snap());
    add('x1', '응답 1', 35, 15, 'bad', '유실 ✕');
    t.step(safe ? 7 : 3, `응답을 보내는 중에 <b>네트워크가 끊깁니다.</b> 클라이언트는 응답을 받지 못합니다. 성공인지 실패인지 알 수 없습니다.`, snap());
    add('r2', '요청 2 재시도', 55, 20, 'active', 'POST /pay');
    t.step(1, `타임아웃. 클라이언트(또는 사용자, 또는 중간의 프록시)가 <b>같은 요청을 다시</b> 보냅니다.${safe ? ' 같은 키(abc-123)를 그대로 씁니다.' : ''}`, snap());
    if (safe) {
      t.step(3, `이 키로 처리한 적이 있는지 확인합니다 → <b>있음.</b>`, snap());
      add('x2', '응답 2', 75, 15, 'done', '저장된 결과');
      t.step(4, `결제를 다시 실행하지 않고, 저장해 둔 결과를 그대로 돌려줍니다. 결제는 <b>한 번</b>뿐입니다.`, snap());
    } else {
      ledger.push('10,000원'); t.m['결제된 횟수'] = 2; t.m['고객이 낸 금액 (원)'] = 20000;
      add('c2', '서버: 결제', 75, 15, 'bad', 'charge 또!');
      t.step(2, `서버는 이것이 재시도인지 알 방법이 없습니다. 새 요청으로 보고 <b>결제를 또 실행</b>합니다.`, snap());
      t.step(3, `이번에는 응답이 도착합니다. 화면에는 "결제 성공" 한 번, 통장에서는 <b>2만 원</b>이 나갔습니다.`, snap());
    }
  };
  CS.add({
    id: 'idempotency', level: 'senior',
    title: '멱등성: 재시도가 중복 결제가 될 때',
    summary: '네트워크 요청의 결과는 성공·실패 두 가지가 아니라 "모름"까지 세 가지입니다. 응답이 유실되면 클라이언트는 재시도할 수밖에 없고, 서버가 대비하지 않았다면 같은 작업이 두 번 실행됩니다.',
    headline: '결제된 횟수',
    verdict: '재시도는 막을 수 없습니다(브라우저, 프록시, 메시지 큐가 알아서 합니다). 그래서 서버가 "같은 요청을 여러 번 받아도 결과가 한 번 실행한 것과 같도록" 만들어야 합니다. 이것이 멱등성입니다.',
    variants: [
      {
        name: '요청마다 그대로 실행', tone: 'bad', label: '중복 결제',
        code: `app.post('/pay', async (req, res) => {
  await charge(req.body.orderId, req.body.amount);
  res.send({ ok: true });
});`,
        notes: { 2: '재시도인지 구분 못 함', 3: '응답이 유실될 수 있음' }, run: idemRun(false),
      },
      {
        name: '멱등 키로 중복 판별', tone: 'good', label: '한 번만 결제',
        code: `app.post('/pay', async (req, res) => {
  const key = req.headers['idempotency-key'];
  const saved = await results.get(key);
  if (saved) return res.send(saved);
  const result = await charge(req.body.orderId, req.body.amount);
  await results.set(key, result);
  res.send(result);
});`,
        notes: { 3: '같은 키를 본 적 있는가', 4: '있으면 실행하지 않고 재응답' }, run: idemRun(true),
      },
    ],
    points: [
      '멱등: 여러 번 실행해도 한 번 실행한 것과 결과가 같음. <code>잔액 = 5000</code>은 멱등, <code>잔액 -= 1000</code>은 아닙니다.',
      'GET·PUT·DELETE는 멱등하게 설계하는 것이 관례이고, POST는 기본적으로 아닙니다. 그래서 키가 필요합니다.',
      '버튼 더블클릭, 모바일 앱의 자동 재시도, 로드 밸런서 재전송이 전부 같은 문제를 만듭니다.',
    ],
    senior: '위의 "확인하고 → 없으면 실행"도 동시에 두 요청이 오면 둘 다 "없음"을 봅니다(경쟁 상태). 실제 구현은 멱등 키나 주문 번호에 <b>유니크 제약</b>을 걸고 먼저 INSERT를 시도해서, 판정을 DB에 맡깁니다. 메시지 큐도 마찬가지입니다. Kafka·SQS 같은 큐는 대부분 "최소 한 번 전달"이므로 컨슈머는 같은 메시지를 두 번 받을 수 있다고 가정하고 짜야 합니다. "가끔 주문이 두 건 생긴다", "포인트가 두 번 적립된다", "알림이 두 번 간다"는 신고가 들어오면 타임아웃·재시도 로그와 시각을 맞춰 보세요.',
  });
})();
