/* 데이터베이스 2: 트랜잭션 격리 수준, UUIDv7 기본 키, LSM 트리, 복합 인덱스
   페이지 크기·버퍼 풀 크기는 원리를 보이기 위해 아주 작게 잡은 가정값이다 */
(function () {
  const CS = window.CS;

  /* ---------- 트랜잭션 격리 수준 ---------- */
  const TI_AMT = { T1: 30, T2: 50 };
  const tiRun = (rr) => (t) => {
    const FINAL = '최종 잔액 (기대값 20)', LOST = '사라진 갱신', RETRY = '충돌로 재시도';
    t.m[FINAL] = 100; t.m[LOST] = 0; t.m[RETRY] = 0;
    let committed = 100, pending = null, lock = null;
    const tx = { T1: { read: '–', next: '–', st: '대기' }, T2: { read: '–', next: '–', st: '대기' } };
    const snap = (who, rowS) => [
      {
        type: 'cells', title: 'wallets 테이블의 id = 1 행 — 커밋된 값만 다른 트랜잭션에 보입니다',
        items: [
          { id: 'c', v: committed, sub: '커밋된 잔액', gap: true, s: rowS || '' },
          ...(pending ? [{ id: 'p', v: pending.v, sub: `${pending.by} 미커밋`, gap: true, s: 'new' }] : []),
          { id: 'l', v: lock ? `${lock} 보유` : '없음', sub: '행 잠금', s: lock ? 'active' : '' },
        ],
      },
      ...['T1', 'T2'].map((id) => ({
        type: 'cells', hot: who === id, title: `${id} — ${TI_AMT[id]}점 사용${who === id ? ' ← 지금 실행 중' : ''}`,
        items: [
          { id: 'r', v: tx[id].read, sub: '읽은 잔액', gap: true, s: who === id ? 'cmp' : '' },
          { id: 'n', v: tx[id].next, sub: '쓸 값', gap: true, s: who === id ? 'cmp' : '' },
          { id: 's', v: tx[id].st, sub: '상태', s: tx[id].st === '잠금 대기' ? 'active' : tx[id].st === '실패' ? 'bad' : tx[id].st === '커밋' ? 'done' : '' },
        ],
      })),
    ];
    const L = rr ? { begin: 1, sel: 2, calc: 3, upd: 4, commit: 5, err: 6, rollback: 7 } : { begin: 2, sel: 3, calc: 4, upd: 5, commit: 6 };
    const read = (id, msg) => { tx[id].read = committed; tx[id].next = '–'; tx[id].st = '실행 중'; t.step(L.sel, msg, snap(id)); };
    const calc = (id) => {
      tx[id].next = tx[id].read - TI_AMT[id];
      t.step(L.calc, `<b>${id}</b>: 애플리케이션이 계산합니다. ${tx[id].read} − ${TI_AMT[id]} = <b>${tx[id].next}</b>. 이 숫자는 DB 밖(서버 메모리)에 있습니다.`, snap(id));
    };

    t.step(L.begin, `T1과 T2가 거의 동시에 시작합니다. 잔액은 100점이고 T1은 30점, T2는 50점을 씁니다. 둘 다 반영되면 <b>20점</b>이어야 합니다.${rr ? ' 각 트랜잭션은 시작 시점의 <b>스냅샷</b>을 끝까지 봅니다.' : ''}`, snap());
    read('T1', `<b>T1</b>: <code>SELECT</code> → 100을 읽습니다. 일반 읽기는 잠금을 잡지 않습니다.`);
    read('T2', `<b>T2</b>: <code>SELECT</code> → 역시 100. T1이 아직 아무것도 쓰지 않았으므로 같은 값을 봅니다.`);
    calc('T1'); calc('T2');
    pending = { v: 70, by: 'T1' }; lock = 'T1';
    t.step(L.upd, `<b>T1</b>: <code>UPDATE</code> — 행의 새 버전(70)을 만들고 행 잠금을 잡습니다. 커밋 전이라 다른 트랜잭션에는 여전히 100이 보입니다(MVCC).`, snap('T1'));
    tx.T2.st = '잠금 대기';
    t.step(L.upd, `<b>T2</b>: <code>UPDATE</code> — 같은 행을 T1이 잠그고 있어 <b>기다립니다.</b> 쓰기끼리는 차례를 지킵니다. 다만 T2가 쓸 값(50)은 이미 계산이 끝나 있습니다.`, snap('T2'));
    committed = 70; pending = null; lock = null; tx.T1.st = '커밋'; t.m[FINAL] = 70;
    t.step(L.commit, `<b>T1</b>: <code>COMMIT</code> — 70이 확정되고 잠금이 풀립니다.`, snap('T1', 'done'));

    if (!rr) {
      pending = { v: 50, by: 'T2' }; lock = 'T2'; tx.T2.st = '실행 중';
      t.step(L.upd, `<b>T2</b>: 기다리던 <code>UPDATE</code>가 진행됩니다. READ COMMITTED는 그사이 행이 바뀐 것을 문제 삼지 않습니다. 100을 기준으로 계산해 둔 <b>50</b>을 그대로 씁니다.`, snap('T2'));
      committed = 50; pending = null; lock = null; tx.T2.st = '커밋'; t.m[FINAL] = 50; t.m[LOST] = 1;
      t.step(L.commit, `<b>T2</b>: <code>COMMIT</code> — 잔액 50. T1이 뺀 30점이 <b>덮어써져 사라졌습니다.</b>`, snap('T2', 'bad'));
      t.step(L.calc, `80점을 썼는데 50점만 줄었습니다. 두 트랜잭션 모두 오류 없이 "성공"했습니다. 트랜잭션으로 묶었다는 것만으로는 <b>읽고 → 계산하고 → 쓰는</b> 사이의 틈이 막히지 않습니다.`, snap(null, 'bad'));
      return;
    }
    tx.T2.st = '실패'; t.m[RETRY] = 1;
    t.step(L.err, `<b>T2</b>: 잠금이 풀려 <code>UPDATE</code>를 하려는 순간, DB가 <b>"내 스냅샷 이후에 다른 트랜잭션이 이 행을 바꿔 커밋했다"</b>는 것을 알아챕니다. 오류 40001(직렬화 실패)로 거부합니다.`, snap('T2'));
    tx.T2.read = '–'; tx.T2.next = '–'; tx.T2.st = '재시도';
    t.step(L.rollback, `<b>T2</b>: <code>ROLLBACK</code> 후 처음부터 다시 실행합니다. 재시도는 애플리케이션의 몫입니다.`, snap('T2'));
    read('T2', `<b>T2 (재시도)</b>: 새 스냅샷에서 <code>SELECT</code> → 이번에는 <b>70</b>을 읽습니다.`);
    calc('T2');
    pending = { v: 20, by: 'T2' }; lock = 'T2';
    t.step(L.upd, `<b>T2 (재시도)</b>: <code>UPDATE</code> — 그사이 이 행을 바꾼 트랜잭션이 없으므로 통과합니다.`, snap('T2'));
    committed = 20; pending = null; lock = null; tx.T2.st = '커밋'; t.m[FINAL] = 20;
    t.step(L.commit, `<b>T2 (재시도)</b>: <code>COMMIT</code> — 잔액 <b>20</b>. 두 사용분이 모두 반영됐습니다.`, snap('T2', 'done'));
    t.step(L.err, `정확한 결과를 얻은 대가는 <b>실패 1번과 재시도 1번</b>입니다. 격리 수준을 올리면 틀린 결과 대신 오류가 나고, 그 오류를 처리하는 코드가 필요해집니다.`, snap(null, 'done'));
  };
  CS.add({
    id: 'transaction-isolation', level: 'senior', topic: 'db',
    title: '트랜잭션 격리 수준: 트랜잭션으로 묶었는데 값이 틀린다',
    summary: '두 트랜잭션이 같은 행을 읽고, 각자 계산해서, 다시 씁니다. 기본 격리 수준에서는 나중에 쓴 쪽이 먼저 쓴 쪽의 결과를 덮어씁니다(갱신 유실). 격리 수준을 올리면 DB가 이 충돌을 어떻게 알아채는지 봅니다.',
    headline: '사라진 갱신',
    verdict: 'READ COMMITTED에서는 30점과 50점을 썼는데 잔액이 50으로 남았습니다(갱신 1건 유실). REPEATABLE READ(PostgreSQL)에서는 뒤늦은 쓰기를 오류로 거부해, 재시도 1번 끝에 20이 됐습니다. 격리 수준은 "틀린 결과"를 "오류와 재시도"로 바꾸는 장치입니다.',
    variants: [
      {
        name: 'READ COMMITTED: 읽고, 계산해서, 쓰기', tone: 'bad', label: '갱신 유실',
        code: `-- T1(30점 사용)과 T2(50점 사용)가 각자 실행
BEGIN;  -- 격리 수준: READ COMMITTED
SELECT balance FROM wallets WHERE id = 1;
-- 애플리케이션: next = balance - 사용액
UPDATE wallets SET balance = :next WHERE id = 1;
COMMIT;`,
        notes: { 3: '잠금 없이 읽음', 4: 'DB 밖에서 계산', 5: '옛 값으로 덮어씀' }, run: tiRun(false),
      },
      {
        name: 'REPEATABLE READ: 스냅샷 + 충돌 감지', tone: 'good', label: '충돌 감지',
        code: `BEGIN ISOLATION LEVEL REPEATABLE READ;
SELECT balance FROM wallets WHERE id = 1;
-- 애플리케이션: next = balance - 사용액
UPDATE wallets SET balance = :next WHERE id = 1;
COMMIT;
-- UPDATE가 오류 40001로 실패하면:
ROLLBACK;  -- BEGIN부터 다시 실행`,
        notes: { 1: '시작 시점의 스냅샷', 4: '바뀐 행이면 거부', 7: '재시도는 애플리케이션이' }, run: tiRun(true),
      },
    ],
    points: [
      '<b>READ COMMITTED</b>: 커밋되지 않은 값은 읽지 않습니다(dirty read 방지). 하지만 한 트랜잭션 안에서 같은 행을 두 번 읽으면 값이 달라질 수 있고, 위와 같은 갱신 유실을 막지 못합니다. PostgreSQL의 기본값입니다.',
      '<b>REPEATABLE READ</b>: 트랜잭션 시작 시점의 스냅샷을 끝까지 봅니다. PostgreSQL은 스냅샷 이후 바뀐 행을 쓰려 하면 오류로 거부하지만, MySQL(InnoDB, 기본값이 이 수준)은 일반 SELECT 뒤의 UPDATE를 거부하지 않아 갱신 유실이 그대로 일어납니다. <b>같은 이름이라도 DB마다 보장이 다릅니다.</b>',
      '<b>SERIALIZABLE</b>: 트랜잭션을 하나씩 차례로 실행한 것과 같은 결과만 허용합니다. 서로 다른 행을 읽고 판단해 쓰는 충돌(write skew, 예: 당직자가 최소 1명이어야 하는데 둘이 동시에 빠짐)까지 막습니다. 대가는 더 많은 실패와 재시도입니다.',
      '격리 수준을 올리지 않고 막는 방법도 있습니다. 계산을 DB에 맡기는 <code>UPDATE wallets SET balance = balance - 30 WHERE balance >= 30</code>, 읽는 순간 행을 잠그는 <code>SELECT ... FOR UPDATE</code>, version 컬럼을 비교하는 낙관적 잠금입니다.',
    ],
    senior: '애플리케이션 메모리의 경쟁 상태와 구조는 같지만, 여기서는 DB가 어디까지 막아 주는지가 설정값(격리 수준)과 제품에 따라 달라진다는 점이 핵심입니다. 먼저 쓰는 DB의 기본 격리 수준을 확인하세요. 프레임워크의 트랜잭션 어노테이션은 원자성(전부 반영 또는 전부 취소)을 줄 뿐, 동시 실행의 간섭을 자동으로 막아 주지 않습니다. 격리 수준을 올리거나 FOR UPDATE를 쓰면 직렬화 실패(40001)와 데드락이 정상적인 결과로 나오기 시작하므로, 트랜잭션 전체를 다시 실행하는 재시도 로직이 필요하고 그 안에 외부 API 호출이나 메일 발송이 있으면 중복 실행에 대비해야 합니다. 스냅샷을 오래 붙잡는 긴 트랜잭션은 옛 행 버전의 정리를 막아 테이블을 부풀리므로, 트랜잭션은 짧게 유지하고 재시도율과 잠금 대기 시간을 지표로 봅니다.',
    qa: [
      ['트랜잭션 격리 수준들과 각각이 막는 현상을 설명해 보세요.', 'READ UNCOMMITTED는 커밋 안 된 값까지 읽습니다(dirty read). READ COMMITTED는 커밋된 값만 읽지만 같은 행을 다시 읽으면 값이 바뀔 수 있습니다(non-repeatable read). REPEATABLE READ는 트랜잭션 시작 시점의 스냅샷을 유지해 그것을 막습니다. SERIALIZABLE은 차례로 실행한 것과 같은 결과만 허용해 팬텀과 write skew까지 막습니다. 수준이 높을수록 잠금 대기나 직렬화 실패에 따른 재시도가 늘어납니다. 그리고 표준은 최소 보장만 정하므로 실제 동작은 DB마다 다르다는 점을 덧붙입니다.'],
      ['트랜잭션으로 묶었는데 재고가 음수가 됐습니다. 왜 그럴 수 있고 어떻게 막습니까?', '두 트랜잭션이 같은 재고를 읽고 각자 계산해 썼기 때문입니다. 기본 격리 수준(READ COMMITTED)은 읽기에 잠금을 걸지 않아 둘 다 같은 값을 읽습니다. 가장 단순한 해결은 <code>UPDATE ... SET stock = stock - 1 WHERE stock > 0</code>처럼 조건과 계산을 한 문장에 넣고 영향받은 행 수를 확인하는 것입니다. 읽은 값으로 복잡한 판단을 해야 하면 SELECT ... FOR UPDATE로 행을 잠그거나, version 컬럼으로 낙관적 잠금을 쓰거나, 격리 수준을 올리고 직렬화 실패 시 재시도합니다.'],
      ['MVCC가 무엇이고 어떤 장점이 있습니까?', '행을 고칠 때 덮어쓰지 않고 새 버전을 만들어, 각 트랜잭션이 자기 스냅샷에 맞는 버전을 읽게 하는 방식입니다. 읽기가 쓰기를 막지 않고 쓰기도 읽기를 막지 않아 동시 처리량이 높습니다. 대가로 옛 버전이 쌓이므로 이를 정리하는 작업(PostgreSQL의 VACUUM, InnoDB의 undo 정리)이 필요하고, 긴 트랜잭션이 정리를 막으면 테이블과 인덱스가 부풉니다.'],
    ],
    dx: {
      cat: ['wrong', 'flaky', 'data'], concept: '트랜잭션 격리 수준과 갱신 유실',
      symptoms: ['재고·포인트·좌석 수가 가끔 실제와 어긋나는데 에러 로그가 없다', '한 번씩 실행하면 정상이고 동시 요청이나 부하 테스트에서만 재현된다', '트랜잭션으로 묶었는데도 값이 맞지 않는다', '격리 수준을 올린 뒤 "could not serialize access" 오류나 데드락이 간헐적으로 난다'],
      check: 'SELECT로 읽은 값을 애플리케이션에서 계산해 UPDATE하는 코드가 있는지 찾고, DB의 현재 격리 수준을 확인합니다. 같은 행을 고치는 요청 두 개를 동시에 보내 결과가 합쳐지는지 봅니다.',
      fix: '계산을 UPDATE 문 안으로 옮기거나(조건부 원자적 갱신), SELECT ... FOR UPDATE 또는 version 컬럼을 씁니다. 격리 수준을 올렸다면 직렬화 실패를 잡아 트랜잭션 전체를 재시도합니다.',
    },
  });

  /* ---------- UUIDv4 vs UUIDv7 기본 키 ---------- */
  const UCAP = 4, UPOOL = 2;
  const uuidKeys = (n, v7) => {
    if (v7) return Array.from({ length: n }, (_, i) => i + 1);
    const out = [];
    let s = 9;
    while (out.length < n) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      const k = (s >> 8) & 0xff;
      if (!out.includes(k)) out.push(k);
    }
    return out;
  };
  const uuidRun = (v7) => (t, n) => {
    const SPLIT = '페이지 분할 (반으로 쪼갬)', MISS = '디스크에서 읽어 온 페이지', PAGES = '리프 페이지 수';
    t.m[SPLIT] = 0; t.m[MISS] = 0; t.m[PAGES] = 1;
    const pages = [{ id: 1, keys: [] }];
    let pool = [1], nextId = 2;
    const name = (k) => (v7 ? String(k).padStart(2, '0') : k.toString(16).padStart(2, '0'));
    const show = (k) => (v7 ? `<code>…${name(k)}</code>` : `<code>${name(k)}…</code>`);
    const snap = (cur, newKey, miss) => [
      {
        type: 'cells', cols: (UCAP + 1) * 2,
        title: `PK 인덱스의 리프 페이지 (키 순서, 페이지당 ${UCAP}개) — ${v7 ? '칸의 숫자 = id 앞부분의 생성 시각을 순번으로 표시' : '칸의 값 = id의 앞 두 자리(16진수)'}`,
        items: pages.flatMap((p, pi) => [
          { id: `p${p.id}`, v: `P${p.id}`, s: p.id === cur ? (miss ? 'bad' : 'active') : pool.includes(p.id) ? 'cmp' : 'dim' },
          ...Array.from({ length: UCAP }, (_, i) => ({
            ...(i < p.keys.length ? { id: `k${p.keys[i]}`, v: name(p.keys[i]), s: p.keys[i] === newKey ? 'new' : '' } : { id: `h${p.id}-${i}`, v: '', s: 'hole' }),
            gap: i === UCAP - 1 && pi % 2 === 0,
          })),
        ]),
      },
      { type: 'cells', title: `버퍼 풀 — 지금 메모리에 올라와 있는 페이지 (최대 ${UPOOL}개로 가정). 위 그림에서는 이름표가 파란 페이지`, items: pool.map((id) => ({ id: `b${id}`, v: `P${id}`, s: id === cur ? 'active' : 'cmp' })) },
    ];
    const touch = (pid, fresh) => {
      const i = pool.indexOf(pid);
      let miss = false, out = null;
      if (i >= 0) pool.splice(i, 1);
      else {
        if (!fresh) { miss = true; t.m[MISS]++; }
        if (pool.length >= UPOOL) out = pool.shift();
      }
      pool.push(pid);
      return { miss, out };
    };
    t.step(2, v7
      ? `주문 ${n}건을 넣습니다. id의 앞부분이 생성 시각이라 <b>나중에 만든 id가 항상 더 큽니다.</b> 인덱스는 id 순으로 정렬되어 있습니다.`
      : `주문 ${n}건을 넣습니다. id는 무작위라서 <b>정렬 순서상 어디에 들어갈지 매번 다릅니다.</b> 인덱스는 id 순으로 정렬되어 있습니다.`, snap());
    uuidKeys(n, v7).forEach((k, i) => {
      let pi = 0;
      for (let x = 1; x < pages.length; x++) if (pages[x].keys[0] <= k) pi = x;
      const p = pages[pi], last = pi === pages.length - 1;
      const { miss, out } = touch(p.id);
      t.step(3, `${i + 1}번째 id ${show(k)} — ${v7 ? `지금까지의 어떤 id보다 큽니다. <b>맨 오른쪽</b> 페이지 P${p.id}` : `정렬 순서상 <b>P${p.id}</b>`}에 들어가야 합니다. ${miss
        ? `P${p.id}은 메모리에 없어 <b>디스크에서 읽어 옵니다.</b>${out ? ` 자리를 내주느라 P${out}이 메모리에서 밀려납니다.` : ''}`
        : `P${p.id}은 이미 메모리에 있습니다.`}`, snap(p.id, null, miss));
      if (p.keys.length < UCAP) {
        p.keys.push(k); p.keys.sort((a, b) => a - b);
        t.step(4, `P${p.id}에 빈자리가 있어 그대로 넣습니다.`, snap(p.id, k));
        return;
      }
      if (last && k > p.keys[UCAP - 1]) {
        const np = { id: nextId++, keys: [k] };
        pages.push(np); t.m[PAGES]++;
        const ev = touch(np.id, true).out;
        t.step(4, `P${p.id}이 가득 찼습니다. 새 값이 맨 끝이므로 쪼갤 필요 없이 <b>새 페이지 P${np.id}을 오른쪽에 붙이고</b> 거기에 넣습니다. P${p.id}은 가득 찬 채로 남습니다.${ev ? ` 다시 볼 일이 없는 P${ev}은 메모리에서 내려갑니다.` : ''}`, snap(np.id, k));
        return;
      }
      const all = [...p.keys, k].sort((a, b) => a - b), np = { id: nextId++, keys: all.slice(3) };
      p.keys = all.slice(0, 3);
      pages.splice(pi + 1, 0, np); t.m[SPLIT]++; t.m[PAGES]++;
      touch(np.id, true);
      t.step(4, `P${p.id}이 가득 찼는데 새 값은 그 <b>중간</b>에 들어가야 합니다. 페이지를 <b>반으로 쪼개</b> 뒤쪽 절반을 새 페이지 P${np.id}로 옮깁니다. 두 페이지 모두 다시 써야 하고, 둘 다 반쯤 빈 채로 남습니다.`, snap(k >= np.keys[0] ? np.id : p.id, k));
    });
    const fill = Math.round((n / (pages.length * UCAP)) * 100);
    t.step(7, v7
      ? `${n}건을 넣는 동안 쪼갠 페이지도, 디스크에서 다시 읽어 온 페이지도 없습니다. 쓰기는 늘 오른쪽 끝 한 페이지에서만 일어났고, 페이지 ${pages.length}개가 평균 <b>${fill}%</b> 차 있습니다.`
      : `${n}건을 넣는 동안 페이지를 <b>${t.m[SPLIT]}번</b> 쪼갰고, 메모리에 없는 페이지를 <b>${t.m[MISS]}번</b> 디스크에서 읽어 왔습니다. 페이지 ${pages.length}개가 평균 <b>${fill}%</b>만 차 있습니다.`, snap());
  };
  CS.add({
    id: 'uuid-v7', level: 'adv', topic: 'db',
    title: 'UUID 기본 키: 무작위(v4)와 시간순(v7)의 삽입 비용',
    summary: '기본 키 인덱스는 키 순서로 정렬된 B-트리입니다. 무작위 UUID(v4)는 새 행이 인덱스의 아무 페이지에나 들어가고, 시간순 UUID(v7)는 항상 오른쪽 끝에 들어갑니다. 같은 수의 행을 넣으며 건드리는 페이지가 어떻게 다른지 봅니다.',
    param: { label: '삽입할 행 수', options: [12, 16, 20], value: 16 },
    headline: '페이지 분할 (반으로 쪼갬)',
    verdict: '행 16개를 넣는 동안 무작위 키(v4)는 페이지를 5번 쪼개고 메모리에 없는 페이지를 5번 디스크에서 읽어 왔습니다. 시간순 키(v7)는 둘 다 0번이고, 같은 행을 페이지 6개가 아니라 4개에 담았습니다. 차이를 만드는 것은 UUID라는 형식이 아니라 새 키가 정렬 순서의 어디에 떨어지느냐입니다.',
    variants: [
      {
        name: 'UUIDv4: 무작위 키', tone: 'bad', label: '흩어진 삽입', big: { time: '삽입마다 임의의 페이지', space: '페이지가 반쯤 빔' },
        code: `// CREATE TABLE orders (id UUID PRIMARY KEY, ...)
async function createOrder(order) {
  const id = crypto.randomUUID();
  await db.query(
    'INSERT INTO orders (id, item) VALUES ($1, $2)',
    [id, order.item]);
  return id;
}`,
        notes: { 3: 'v4: 122비트가 무작위', 4: '중간 삽입 → 페이지 분할' }, run: uuidRun(false),
      },
      {
        name: 'UUIDv7: 시간순 키', tone: 'good', label: '오른쪽 끝에만 삽입', big: { time: '항상 마지막 페이지', space: '페이지가 가득 참' },
        code: `// CREATE TABLE orders (id UUID PRIMARY KEY, ...)
async function createOrder(order) {
  const id = uuidv7();
  await db.query(
    'INSERT INTO orders (id, item) VALUES ($1, $2)',
    [id, order.item]);
  return id;
}`,
        notes: { 3: 'v7: 앞 48비트가 생성 시각', 4: '항상 맨 끝에 삽입' }, run: uuidRun(true),
      },
    ],
    points: [
      'UUIDv7은 앞 48비트에 Unix 시각(밀리초)을 넣고 나머지를 무작위로 채웁니다. 그래서 값의 크기 순서가 대체로 생성 순서와 같습니다. 2024년 5월에 나온 <b>RFC 9562</b>(기존 RFC 4122를 대체)가 정의합니다.',
      '무작위 키의 비용은 세 가지입니다. 삽입마다 다른 페이지를 건드려 <b>인덱스 전체가 메모리에 있어야</b> 빠르고, 중간 삽입 때문에 <b>페이지 분할</b>이 잦고, 분할된 페이지가 반쯤 빈 채로 남아 <b>인덱스가 커집니다.</b>',
      '2026년 기준 지원 현황: PostgreSQL은 18(2025년 9월)부터 내장 함수 <code>uuidv7()</code>을 제공하고, 그 전 버전에서는 애플리케이션이나 확장에서 만들어 넣습니다. MariaDB 11.7의 <code>UUID_v7()</code>, Python 3.14의 <code>uuid.uuid7()</code>, .NET 9의 <code>Guid.CreateVersion7()</code>도 있습니다.',
      'v7의 대가: id만 보고 <b>생성 시각을 알 수 있습니다.</b> 가입 시점이나 주문량이 드러나면 안 되는 곳에서는 외부에 노출하는 식별자를 따로 두세요.',
    ],
    senior: '영향의 크기는 저장 구조에 따라 다릅니다. MySQL(InnoDB)은 테이블 자체가 기본 키 순서로 저장되고 모든 보조 인덱스가 기본 키를 품으므로 무작위 키의 비용이 가장 크고, UUID를 문자열(36바이트)로 저장하면 그 비용이 인덱스마다 곱해집니다(16바이트 이진 타입을 쓰세요). PostgreSQL은 테이블이 따로 있어 기본 키 인덱스만 영향을 받지만, 체크포인트 뒤 처음 고치는 페이지는 통째로 로그에 남기므로 흩어진 쓰기가 WAL 양을 키웁니다. 증상은 "인덱스가 메모리보다 커진 시점부터 INSERT가 갑자기 느려진다"로 나타나므로 인덱스 크기와 버퍼 캐시 적중률을 함께 봅니다. 반대 방향의 함정도 있습니다. 키 범위로 데이터를 나누는 분산 DB에서는 시간순 키가 모든 쓰기를 마지막 범위 하나에 몰아 병목을 만들 수 있어, 그런 곳에서는 오히려 무작위 키나 해시 접두어가 권장됩니다. 그리고 순서만 필요하다면 8바이트 자동 증가 정수가 더 작고 빠릅니다. UUID를 고르는 이유는 여러 서버가 DB에 묻지 않고 겹치지 않는 id를 만들 수 있다는 점입니다.',
    qa: [
      ['UUID를 기본 키로 쓰면 왜 삽입이 느려질 수 있습니까?', '무작위 UUID(v4)는 값의 순서가 생성 순서와 무관해서, 새 행이 B-트리 인덱스의 임의 위치에 들어갑니다. 삽입마다 다른 리프 페이지를 메모리로 읽어 와야 하고, 가득 찬 페이지 중간에 들어가면 페이지를 쪼개야 하며, 쪼개진 페이지가 반쯤 비어 인덱스가 커집니다. 인덱스가 메모리에 다 들어가는 동안은 티가 안 나다가, 넘어서는 순간 삽입마다 디스크 읽기가 붙어 급격히 느려집니다. 시간순으로 정렬되는 UUIDv7이나 자동 증가 키는 항상 오른쪽 끝 페이지에만 쓰므로 이 문제가 없습니다.'],
      ['UUIDv4와 UUIDv7의 차이, 그리고 v7을 쓸 때 주의할 점은 무엇입니까?', 'v4는 122비트가 무작위이고, v7은 앞 48비트가 밀리초 단위 시각이며 나머지가 무작위입니다(RFC 9562). v7은 생성 순서대로 정렬되어 인덱스 삽입이 한곳에 모입니다. 주의할 점은 id에서 생성 시각이 드러난다는 것, 같은 밀리초 안에서의 순서는 구현에 따라 보장 여부가 다르다는 것, 그리고 키 범위로 샤딩하는 분산 DB에서는 쓰기가 한 범위에 몰릴 수 있다는 것입니다.'],
      ['자동 증가 정수 대신 UUID를 기본 키로 고르는 이유는 무엇입니까?', '여러 서버나 클라이언트가 DB에 물어보지 않고도 겹치지 않는 id를 만들 수 있기 때문입니다. 삽입 전에 id를 알 수 있어 여러 테이블·서비스에 걸친 데이터를 미리 연결할 수 있고, 샤드나 리전을 합칠 때 충돌이 없으며, 정수처럼 다음 값을 추측하기 어렵습니다. 대가는 크기(16바이트 대 8바이트)와, v4일 때의 인덱스 지역성 문제입니다.'],
    ],
    dx: {
      cat: ['slow'], concept: '무작위 기본 키와 B-트리 페이지 분할',
      symptoms: ['테이블이 커질수록 단순한 INSERT가 점점 느려진다', '인덱스 크기가 DB 메모리를 넘어선 무렵부터 쓰기 시 디스크 읽기가 급증했다', '기본 키 인덱스가 데이터 양에 비해 유난히 크다'],
      check: '기본 키가 무작위 UUID(v4)인지, 인덱스 크기가 버퍼 풀(공유 버퍼)보다 큰지, INSERT 구간의 디스크 읽기량과 버퍼 캐시 적중률을 확인합니다.',
      fix: '새로 만드는 id를 시간순(UUIDv7 등)으로 바꾸고 이진 16바이트 타입으로 저장합니다. 이미 부푼 인덱스는 재구성(REINDEX 등)으로 줄입니다.',
    },
  });

  /* ---------- LSM 트리 vs B-트리 ---------- */
  const LSM_W = [41, 7, 88, 23, 65, 12, 41, 90, 34, 77, 5, 58, 19, 70], LSM_GET = 23, MEM_MAX = 4;
  const RW = '무작위 디스크 쓰기', SW = '순차 파일 쓰기', RD = '조회 1번에 확인한 곳';
  const btreeRun = (t) => {
    t.m[RW] = 0; t.m[SW] = 0; t.m[RD] = 0;
    const pages = [[], [], [], []], log = [];
    const snap = (cur, key, s) => [
      {
        type: 'cells', cols: 7, title: '디스크의 리프 페이지 4개 — P1: 0~24 · P2: 25~49 · P3: 50~74 · P4: 75~99',
        items: pages.flatMap((keys, p) => [
          { id: `p${p}`, v: `P${p + 1}`, s: p === cur ? (s || 'bad') : '' },
          ...Array.from({ length: 6 }, (_, i) => (i < keys.length ? { id: `k${keys[i]}`, v: keys[i], s: p === cur && keys[i] === key ? (s || 'new') : '' } : { id: `h${p}-${i}`, v: '', s: 'hole' })),
        ]),
      },
      { type: 'cells', compact: true, title: '디스크에 쓴 위치 (순서대로) — 매번 다른 페이지로 건너뜁니다', items: log.map((p, i) => ({ id: i, v: `P${p + 1}`, s: i === log.length - 1 && !s && cur != null ? 'bad' : '' })) },
    ];
    t.step(1, `쓰기 ${LSM_W.length}건이 들어옵니다. 키는 주문 번호처럼 순서 없이 옵니다. B-트리는 키마다 <b>들어갈 자리가 정해져</b> 있습니다.`, snap());
    LSM_W.forEach((k, i) => {
      const p = Math.floor(k / 25), dup = pages[p].includes(k);
      if (i === 0) {
        t.step(2, `키 ${k} — 트리를 타고 내려가 이 키가 속한 리프 페이지 <b>P${p + 1}</b>을 찾습니다.`, snap(p, null, 'active'));
        pages[p].push(k);
        t.step(3, `페이지 안의 정렬된 위치에 넣습니다. 아직은 메모리의 페이지만 바뀌었습니다.`, snap(p, k, 'active'));
      } else if (!dup) { pages[p].push(k); pages[p].sort((a, b) => a - b); }
      log.push(p); t.m[RW]++;
      t.step(4, i === 0
        ? `바뀐 페이지를 디스크의 <b>원래 위치에 덮어씁니다.</b> 키 하나를 넣었지만 페이지 하나를 통째로 씁니다.`
        : dup
          ? `키 ${k} — 이미 있는 키입니다. P${p + 1}의 <b>같은 자리에서 값만 바꿔</b> 다시 씁니다(제자리 갱신).`
          : `키 ${k} → <b>P${p + 1}</b>. ${log[i - 1] === p ? '이번에는 우연히 같은 페이지입니다.' : `직전에 쓴 P${log[i - 1] + 1}과 다른 위치입니다.`}`, snap(p, k));
    });
    t.m[RD] = 1;
    t.step(7, `조회 <code>get(${LSM_GET})</code> — 트리를 타고 내려가 <b>P1 한 곳</b>만 보면 됩니다. 키마다 자리가 하나뿐이라 읽기는 단순합니다.`, snap(0, LSM_GET, 'hit'));
    t.step(4, `쓰기 ${LSM_W.length}건에 흩어진 페이지를 <b>${t.m[RW]}번</b> 고쳐 썼습니다. 실제 DB는 메모리에 모았다가 쓰지만, 결국 여러 위치의 페이지를 각각 써야 한다는 점은 같습니다.`, snap());
  };
  const lsmRun = (t) => {
    t.m[RW] = 0; t.m[SW] = 0; t.m[RD] = 0;
    let mem = [], files = [], merged = null, fid = 1;
    const snap = (o = {}) => [
      { type: 'cells', title: `memtable — 메모리 (정렬 유지, ${MEM_MAX}개가 차면 파일로 내려씀)`, items: mem.map((k) => ({ id: `m${k}`, v: k, s: o.memS || (k === o.key ? 'new' : '') })) },
      merged
        ? { type: 'cells', compact: true, title: '디스크: 병합한 SSTable 1개 — 전체가 정렬되어 있고 키마다 최신 값만 남음', items: [{ id: 'f4', v: 'F4', s: 'new' }, ...merged.map((k) => ({ id: `g${k}`, v: k, s: o.fileS || '' }))] }
        : {
          type: 'cells', cols: MEM_MAX + 1, title: '디스크: SSTable 파일들 — 각각 정렬됨, 한 번 쓰면 고치지 않음 (위가 최신)',
          items: files.flatMap((f) => [
            { id: `f${f.id}`, v: `F${f.id}`, s: o.file === f.id ? o.fs : o.skip && o.skip.includes(f.id) ? 'dim' : '' },
            ...f.keys.map((k) => ({ id: `f${f.id}-${k}`, v: k, s: o.file === f.id ? (o.fs === 'hit' ? (k === o.key ? 'hit' : '') : o.fs === 'new' ? 'new' : '') : o.skip && o.skip.includes(f.id) ? 'dim' : '' })),
          ]),
        },
    ];
    t.step(1, `같은 쓰기 ${LSM_W.length}건입니다. LSM 트리는 디스크의 기존 데이터를 <b>고치지 않습니다.</b> 일단 메모리에 받아 둡니다.`, snap());
    LSM_W.forEach((k) => {
      mem.push(k); mem.sort((a, b) => a - b);
      t.step(2, files.some((f) => f.keys.includes(k))
        ? `키 ${k} — 이미 F1 파일에 있는 키지만 <b>찾아가서 고치지 않습니다.</b> 새 값을 memtable에 넣을 뿐입니다. 옛 값은 파일에 그대로 남습니다.`
        : `키 ${k} — memtable의 정렬된 위치에 넣습니다. 디스크의 데이터 파일은 건드리지 않습니다(복구용 로그만 끝에 덧붙입니다).`, snap({ key: k }));
      if (mem.length < MEM_MAX) return;
      const f = { id: fid++, keys: mem };
      files.unshift(f); mem = []; t.m[SW]++;
      t.step(4, `memtable이 찼습니다. 이미 정렬된 ${MEM_MAX}개를 <b>새 파일 F${f.id}에 처음부터 끝까지 이어서</b> 씁니다(순차 쓰기 1번). memtable은 비웁니다.`, snap({ file: f.id, fs: 'new' }));
    });
    t.m[RD] = 1;
    t.step(8, `조회 <code>get(${LSM_GET})</code> — 가장 최신 데이터가 있는 memtable부터 봅니다. 없습니다.`, snap({ memS: 'cmp' }));
    const skip = [];
    for (const f of files) {
      t.m[RD]++;
      if (!f.keys.includes(LSM_GET)) {
        t.step(10, `F${f.id} — 파일을 읽기 전에 <b>블룸 필터</b>(메모리에 둔 작은 요약)에 묻습니다. "${LSM_GET}은 이 파일에 <b>확실히 없음</b>". 디스크를 읽지 않고 건너뜁니다.`, snap({ file: f.id, fs: 'cmp', skip: [...skip] }));
        skip.push(f.id);
        continue;
      }
      t.step(11, `F${f.id} — 블룸 필터가 "있을 수 있음"이라고 답합니다. 파일을 읽어 이진 탐색으로 <b>${LSM_GET}을 찾았습니다.</b> 여기까지 ${t.m[RD]}곳을 확인했습니다.`, snap({ file: f.id, fs: 'hit', key: LSM_GET, skip: [...skip] }));
      break;
    }
    const all = new Map();
    for (const f of [...files].reverse()) for (const k of f.keys) all.set(k, f.id);
    const before = files.reduce((n, f) => n + f.keys.length, 0);
    merged = [...all.keys()].sort((a, b) => a - b); t.m[SW]++;
    t.step(14, `파일이 늘수록 조회가 확인할 곳도 늡니다. 그래서 뒤에서 <b>병합(컴팩션)</b>을 합니다. 정렬된 파일 3개를 합쳐 새 파일 하나로 쓰고(순차 쓰기), 두 번 쓰인 41은 최신 값만 남깁니다. 항목 ${before}개가 ${merged.length}개가 됐습니다.`, snap({ fileS: 'new' }));
    t.step(14, `쓰기 ${LSM_W.length}건에 무작위 쓰기는 0번, 순차 쓰기 <b>${t.m[SW]}번</b>(내려쓰기 3 + 병합 1)입니다. 대신 병합은 이미 쓴 데이터를 다시 쓰는 일이고, 조회는 여러 곳을 확인해야 했습니다.`, snap());
  };
  CS.add({
    id: 'lsm-tree', level: 'senior', topic: 'db',
    title: 'LSM 트리: 쓰기가 많은 저장 엔진은 제자리에서 고치지 않는다',
    summary: 'B-트리는 키가 속한 페이지를 찾아 그 자리에서 고칩니다. 쓰기가 몰리면 디스크 여기저기를 고쳐 써야 합니다. LSM 트리는 쓰기를 메모리에 모았다가 정렬된 파일로 한 번에 내려쓰고, 나중에 파일들을 병합합니다. 같은 쓰기 14건과 조회 1건으로 비교합니다.',
    headline: '무작위 디스크 쓰기',
    verdict: 'B-트리는 쓰기 14건에 흩어진 페이지를 14번 고쳐 썼고, LSM 트리는 순차 쓰기 4번(내려쓰기 3 + 병합 1)으로 끝냈습니다. 대신 조회 한 번에 B-트리는 1곳, LSM 트리는 4곳(memtable과 파일 3개)을 확인했습니다. LSM은 쓰기 비용을 읽기와 병합 쪽으로 옮기는 구조입니다.',
    variants: [
      {
        name: 'B-트리: 제자리 갱신', tone: 'bad', label: '무작위 쓰기', big: { time: '쓰기마다 페이지 1개', space: '키마다 자리 하나' },
        code: `function put(key, value) {
  const page = btree.findLeaf(key);
  page.set(key, value);
  disk.writeAt(page.offset, page);
}
function get(key) {
  return btree.findLeaf(key).get(key);
}`,
        notes: { 2: '자리를 먼저 찾음', 4: '원래 위치에 덮어쓰기', 7: '한 곳만 보면 됨' }, run: btreeRun,
      },
      {
        name: 'LSM 트리: 모아서 내려쓰고 병합', tone: 'good', label: '순차 쓰기', big: { time: '쓰기는 메모리에', space: '옛 값이 한동안 남음' },
        code: `function put(key, value) {
  memtable.set(key, value);
  if (memtable.size < LIMIT) return;
  files.unshift(disk.write(memtable.sorted()));
  memtable.clear();
}
function get(key) {
  if (memtable.has(key)) return memtable.get(key);
  for (const f of files) {
    if (!f.bloom.mayHave(key)) continue;
    if (f.has(key)) return f.get(key);
  }
}
const compact = () => { files = [merge(files)]; };`,
        notes: { 2: '메모리의 정렬된 맵에만', 4: '순차 쓰기 1번', 9: '최신 파일부터', 10: '블룸 필터로 건너뜀', 14: '뒤에서 병합' }, run: lsmRun,
      },
    ],
    points: [
      'LSM(Log-Structured Merge) 트리의 세 단계: <b>memtable</b>(메모리의 정렬된 구조)에 쌓고 → 차면 <b>SSTable</b>(정렬된 불변 파일)로 내려쓰고 → 뒤에서 파일들을 <b>병합(컴팩션)</b>합니다. 장애 대비용 로그(WAL)는 두 방식 모두 순차로 씁니다. 차이는 데이터 본체를 어떻게 쓰느냐입니다.',
      '읽기의 대가: 한 키의 값이 여러 파일에 있을 수 있어 최신 파일부터 차례로 확인합니다. <b>블룸 필터</b>는 "이 파일에 그 키가 확실히 없다"를 메모리에서 바로 답해 주어 대부분의 파일을 건너뛰게 합니다. 가끔 없는데 "있을 수 있다"고 답하지만 그 반대는 없습니다.',
      '수정과 삭제도 덧붙이기입니다. 수정은 새 값을, 삭제는 "지워짐" 표시(tombstone)를 씁니다. 옛 값과 표시는 병합 때 비로소 사라지므로 그때까지 디스크를 더 차지합니다.',
      '범위 조회는 여러 파일을 동시에 훑어 합쳐야 하므로 블룸 필터의 도움을 받지 못합니다. 읽기와 범위 조회가 주된 작업이면 B-트리가 유리합니다.',
    ],
    senior: 'RocksDB, Cassandra, HBase 같은 저장소가 LSM 계열이고 PostgreSQL과 MySQL(InnoDB)은 B-트리 계열입니다. 고를 때는 세 가지 증폭을 함께 봅니다. 쓰기 증폭(병합이 같은 데이터를 여러 번 다시 씀), 읽기 증폭(조회 한 번에 확인하는 파일 수), 공간 증폭(아직 병합되지 않은 옛 값). 병합 전략은 이 셋 사이의 거래이며 하나를 줄이면 다른 것이 늡니다. 운영에서 겪는 문제는 대부분 병합입니다. 쓰기가 병합 속도를 앞지르면 파일이 쌓여 읽기가 느려지고, 엔진이 쓰기를 일부러 늦추거나 멈추면서 처리량 그래프가 주기적으로 꺼집니다. 대량 삭제 직후 범위 조회가 느려지는 것도 지워짐 표시를 전부 읽고 건너뛰어야 하기 때문입니다. SSD에서는 무작위 쓰기의 벌점이 디스크 시절보다 작지만, 순차 쓰기는 압축이 잘 되고 기기 수명에도 유리해 쓰기 위주 작업에서는 여전히 LSM이 선택됩니다. 평균이 아니라 p99 지연과 병합 대기량을 지표로 보세요.',
    qa: [
      ['B-트리와 LSM 트리의 차이를 읽기·쓰기 관점에서 설명해 보세요.', 'B-트리는 키마다 자리가 하나라서 읽기는 한 경로만 내려가면 되지만, 쓰기는 그 자리의 페이지를 찾아 고쳐 써야 해서 쓰기가 디스크 여러 곳에 흩어집니다. LSM 트리는 쓰기를 메모리에 모았다가 정렬된 파일로 한 번에 순차 기록하므로 쓰기 처리량이 높습니다. 대신 한 키가 여러 파일에 있을 수 있어 읽기가 여러 곳을 확인해야 하고, 뒤에서 파일을 병합하는 비용이 계속 듭니다. 쓰기가 압도적으로 많으면 LSM, 읽기와 범위 조회가 중심이면 B-트리가 기본 선택입니다.'],
      ['LSM 트리에서 컴팩션은 왜 필요하고 어떤 비용이 있습니까?', '내려쓴 파일이 계속 늘면 조회가 확인할 파일이 늘고, 덮어쓰인 옛 값과 삭제 표시가 공간을 차지합니다. 컴팩션은 정렬된 파일들을 병합해 키마다 최신 값만 남깁니다. 비용은 같은 데이터를 다시 쓰는 쓰기 증폭과, 병합이 쓰는 디스크 I/O·CPU가 일반 요청과 경쟁한다는 점입니다. 병합이 쓰기를 따라가지 못하면 엔진이 쓰기를 늦추므로 지연이 튑니다.'],
      ['블룸 필터는 LSM 트리 조회에서 어떤 역할을 합니까?', '파일마다 들어 있는 키들의 요약을 비트 배열로 메모리에 두고, 조회 키가 그 파일에 있을 가능성을 디스크를 읽기 전에 판단합니다. "없다"는 답은 항상 맞으므로 그 파일은 읽지 않고 건너뜁니다. "있을 수 있다"는 가끔 틀리지만(거짓 양성) 그때는 파일을 한 번 헛읽을 뿐 결과가 틀리지는 않습니다. 특히 없는 키를 조회할 때 모든 파일을 읽는 일을 막아 줍니다.'],
    ],
    dx: {
      cat: ['slow'], concept: 'LSM 트리의 병합(컴팩션)과 읽기 증폭',
      symptoms: ['쓰기 처리량이 주기적으로 뚝 떨어졌다가 회복된다', '데이터 크기에 비해 디스크 사용량이 훨씬 크다', '대량 삭제 뒤에 범위 조회가 오히려 느려졌다', '없는 키를 조회할 때 유난히 느리다'],
      check: '저장 엔진이 LSM 계열인지 확인하고, 병합 대기량과 파일(SSTable) 개수, 쓰기 지연·정지 횟수 지표를 봅니다. 조회 한 번이 읽는 파일 수도 확인합니다.',
      fix: '병합 전략과 처리 한도를 작업 성격에 맞게 조정하고, 블룸 필터 설정을 확인합니다. 대량 삭제는 TTL이나 파티션 단위 삭제로 바꿉니다. 읽기 위주 작업이면 B-트리 계열 엔진을 검토합니다.',
    },
  });

  /* ---------- 복합 인덱스: 왼쪽부터 ---------- */
  const CI = [['부산', 24], ['부산', 31], ['부산', 38], ['부산', 45], ['서울', 22], ['서울', 27], ['서울', 31], ['서울', 36], ['인천', 19], ['인천', 26], ['인천', 31], ['인천', 52]];
  const CI_N = '확인한 인덱스 항목';
  const ciSnap = (st) => [{
    type: 'cells', cols: CI.length, title: '인덱스 (city, age)의 항목 12개 — 윗줄 city, 아랫줄 age. city 순으로 정렬하고 city가 같으면 age 순',
    items: [...CI.map(([c], i) => ({ id: `a${i}`, v: c, s: st(i), gap: i % 4 === 3 && i < CI.length - 1 })), ...CI.map(([, a], i) => ({ id: `b${i}`, v: a, s: st(i), gap: i % 4 === 3 && i < CI.length - 1 }))],
  }];
  const ciBad = (t) => {
    t.m[CI_N] = 0;
    const found = [];
    t.step(1, `복합 인덱스는 <b>첫 컬럼(city)으로 먼저 정렬</b>하고, city가 같은 것끼리 둘째 컬럼(age)으로 정렬한 목록입니다.`, ciSnap(() => ''));
    t.step(4, `조건은 <code>age = 31</code>뿐입니다. 이진 탐색을 하려고 가운데 항목 (서울, 27)을 봅니다. 27 < 31이니 오른쪽으로 가야 할까요? 왼쪽의 (부산, 31)도 답입니다. 아랫줄만 보면 24 31 38 45 22 27 …로 <b>정렬되어 있지 않아</b> 절반을 버릴 수 없습니다.`, ciSnap((i) => (i === 5 ? 'cmp' : '')));
    CI.forEach(([c, a], i) => {
      t.m[CI_N]++;
      if (a === 31) found.push(i);
      t.step(4, a === 31 ? `(${c}, ${a}) — <b>일치.</b> 하지만 다음 일치가 어디 있을지 모르니 계속 읽습니다.` : `(${c}, ${a}) — 아닙니다. 다음 항목.`, ciSnap((k) => (k === i ? (a === 31 ? 'hit' : 'active') : found.includes(k) ? 'hit' : k < i ? 'dim' : '')));
    });
    t.step(6, `<b>${t.m[CI_N]}개</b>를 전부 확인해 3건을 찾았습니다. 답이 부산·서울·인천 구간에 <b>흩어져</b> 있기 때문입니다. 실제 DB는 이럴 때 인덱스를 처음부터 끝까지 읽거나 아예 테이블 전체를 읽습니다.`, ciSnap((k) => (found.includes(k) ? 'hit' : 'dim')));
  };
  const ciGood = (t) => {
    t.m[CI_N] = 0;
    const key = (i) => `${CI[i][0]} ${CI[i][1]}`, target = '서울 31';
    let lo = 0, hi = CI.length;
    const range = (m) => (i) => (i === m ? 'cmp' : i >= lo && i < hi ? '' : 'dim');
    t.step(1, `같은 인덱스입니다. 이번에는 첫 컬럼부터 조건이 있습니다. (서울, 31)은 정렬 순서상 <b>정확히 한 지점</b>이므로 이진 탐색을 쓸 수 있습니다.`, ciSnap(() => ''));
    while (lo < hi) {
      const mid = (lo + hi) >> 1, less = key(mid) < target;
      t.m[CI_N]++;
      t.step(4, `남은 범위의 가운데 (${CI[mid][0]}, ${CI[mid][1]})을 봅니다. 찾는 (서울, 31)보다 ${less ? '<b>앞</b>입니다. 이 항목까지의 왼쪽 절반을 버립니다.' : '<b>앞이 아닙니다.</b> 오른쪽 절반을 버립니다.'}`, ciSnap(range(mid)));
      if (less) lo = mid + 1; else hi = mid;
    }
    const hits = [];
    let i = lo;
    for (; i < CI.length; i++) {
      t.m[CI_N]++;
      const ok = key(i) === target;
      if (ok) hits.push(i);
      t.step(4, ok
        ? `범위가 한 지점으로 좁혀졌습니다. (${CI[i][0]}, ${CI[i][1]}) — <b>일치.</b> 여기서부터 조건이 맞는 동안만 오른쪽으로 읽습니다.`
        : `다음 항목 (${CI[i][0]}, ${CI[i][1]}) — 조건을 벗어났습니다. 정렬되어 있으므로 이 뒤에는 더 없습니다. <b>여기서 멈춥니다.</b>`, ciSnap((k) => (hits.includes(k) ? 'hit' : k === i ? 'active' : 'dim')));
      if (!ok) break;
    }
    t.step(6, `<b>${t.m[CI_N]}개</b>만 확인했습니다. 항목이 100만 개여도 이진 탐색은 약 20번이면 끝납니다. <code>WHERE city = '서울'</code>만 있어도 서울 구간이 한 덩어리로 붙어 있어 같은 방식으로 찾습니다.`, ciSnap((k) => (hits.includes(k) ? 'hit' : CI[k][0] === '서울' ? 'cmp' : 'dim')));
  };
  CS.add({
    id: 'composite-index', level: 'mid', topic: 'db',
    title: '복합 인덱스: 왜 왼쪽 컬럼부터 조건이 있어야 하는가',
    summary: '인덱스 (city, age)는 city로 먼저 정렬하고 그 안에서 age로 정렬한 목록입니다. 그래서 age만으로 찾을 때는 정렬의 도움을 받지 못합니다. 같은 인덱스에 두 가지 조건을 던져 범위가 어떻게 좁혀지는지 봅니다.',
    headline: '확인한 인덱스 항목',
    verdict: '같은 인덱스인데 age만으로 찾으면 12개를 전부 확인하고, city와 age를 함께 주면 5개만 확인합니다. 복합 인덱스는 전화번호부가 성 → 이름 순으로 정렬된 것과 같아서, 이름만으로는 찾을 수 없습니다.',
    variants: [
      {
        name: 'WHERE age = ? (둘째 컬럼만)', tone: 'bad', label: '전부 확인', big: { time: 'O(n)', space: '–' },
        code: `CREATE INDEX idx ON users (city, age);

SELECT name FROM users
WHERE age = 31;
-- 인덱스의 첫 컬럼(city) 조건이 없음
-- → 정렬 순서를 쓸 수 없어 전부 확인`,
        notes: { 1: 'city 먼저, 그 안에서 age', 4: 'age만 보면 뒤섞여 있음' }, run: ciBad,
      },
      {
        name: 'WHERE city = ? AND age = ? (왼쪽부터)', tone: 'good', label: '범위를 좁힘', big: { time: 'O(log n)', space: '–' },
        code: `CREATE INDEX idx ON users (city, age);

SELECT name FROM users
WHERE city = '서울' AND age = 31;
-- 첫 컬럼부터 조건이 있음
-- → 이진 탐색으로 시작점을 찾고, 맞는 동안만 읽음`,
        notes: { 4: '정렬 순서상 한 지점' }, run: ciGood,
      },
    ],
    points: [
      '<b>왼쪽부터 규칙</b>: 인덱스 (a, b, c)는 a / a, b / a, b, c 조건에 쓸 수 있습니다. b만 또는 c만으로는 범위를 좁히지 못합니다. WHERE 절에 적는 순서는 상관없습니다.',
      '<b>범위 조건 뒤의 컬럼은 좁히는 데 쓰이지 않습니다.</b> <code>city = ? AND age > 30</code>은 둘 다 쓰지만, <code>city > ? AND age = 31</code>은 city로만 좁히고 age는 하나씩 걸러 냅니다. 그래서 같다(=) 조건 컬럼을 앞에, 범위 조건 컬럼을 뒤에 둡니다.',
      '정렬에도 같은 규칙이 적용됩니다. (city, age) 인덱스는 <code>WHERE city = ? ORDER BY age</code>를 정렬 작업 없이 처리합니다.',
      '<b>커버링 인덱스</b>: 쿼리에 필요한 컬럼이 전부 인덱스에 있으면 테이블 본문을 읽지 않고 끝납니다. <code>SELECT age FROM users WHERE city = ?</code>는 (city, age)만으로 답할 수 있습니다. PostgreSQL의 <code>INCLUDE</code>는 정렬에는 쓰지 않고 실어만 두는 컬럼을 추가합니다.',
    ],
    senior: '인덱스를 쿼리마다 하나씩 만들면 쓰기가 느려지고 저장 공간이 늘어나므로, 자주 쓰는 조건 조합을 모아 컬럼 순서를 설계합니다. (a, b)가 있으면 (a) 단독 인덱스는 대개 중복입니다. 순서를 정할 때는 "같다 조건 → 정렬 → 범위 조건" 순으로 놓고, 실제 쿼리의 실행 계획에서 조건이 인덱스 탐색 조건으로 쓰였는지 읽은 뒤 걸러 내는 필터로 쓰였는지를 구분해 봅니다. 인덱스를 "탔다"고 표시되어도 대부분을 읽고 버리는 경우가 있기 때문입니다. 최근에는 왼쪽 컬럼 조건이 없어도 인덱스를 쓰는 skip scan이 늘고 있습니다. MySQL은 8.0.13부터, PostgreSQL은 18(2025년 9월)부터 지원하며 첫 컬럼의 값마다 한 번씩 탐색을 반복하는 방식입니다. 다만 첫 컬럼의 값 종류가 적을 때만 이득이므로 설계를 대신해 주지는 않습니다.',
    qa: [
      ['복합 인덱스 (a, b)가 있는데 WHERE b = ? 쿼리가 느립니다. 왜입니까?', '복합 인덱스는 a로 먼저 정렬하고 a가 같은 것끼리 b로 정렬합니다. b만 보면 전체적으로는 정렬되어 있지 않으므로 이진 탐색으로 범위를 좁힐 수 없어, 인덱스 전체나 테이블 전체를 읽게 됩니다. 해결은 b로 시작하는 인덱스를 따로 만들거나, 쿼리에 a 조건을 함께 주는 것입니다. 일부 DB는 a의 값 종류가 적으면 값마다 탐색을 반복하는 skip scan으로 처리하기도 합니다.'],
      ['복합 인덱스의 컬럼 순서는 어떻게 정합니까?', '쿼리가 실제로 쓰는 조건을 기준으로 정합니다. 같다(=) 조건으로 쓰는 컬럼을 앞에, 범위 조건이나 정렬에 쓰는 컬럼을 뒤에 둡니다. 범위 조건을 만난 뒤의 컬럼은 범위를 좁히는 데 쓰이지 않기 때문입니다. 여러 쿼리가 공유할 수 있도록 공통으로 등장하는 컬럼을 앞쪽에 두면 인덱스 개수를 줄일 수 있습니다. "값 종류가 많은 컬럼을 앞에"는 같다 조건끼리 순서를 정할 때의 보조 기준일 뿐입니다.'],
      ['커버링 인덱스가 무엇이고 왜 빠릅니까?', '쿼리가 필요로 하는 컬럼이 모두 인덱스에 들어 있어 테이블 본문을 읽지 않는 경우입니다. 보통의 인덱스 조회는 인덱스에서 위치를 찾은 뒤 행마다 테이블의 다른 페이지를 읽으러 가는데, 이 무작위 읽기가 비용의 대부분입니다. 커버링이면 그 단계가 사라집니다. 대가는 인덱스가 커지고 쓰기가 느려지는 것이므로 자주 실행되는 핵심 쿼리에만 씁니다.'],
    ],
    dx: {
      cat: ['slow'], concept: '복합 인덱스의 컬럼 순서 (왼쪽부터 규칙)',
      symptoms: ['인덱스를 만들었는데도 실행 계획에 전체 스캔(Seq Scan, type: ALL)이 나온다', '같은 테이블인데 조건 컬럼 조합에 따라 어떤 쿼리는 빠르고 어떤 쿼리는 느리다', '인덱스를 탄다고 나오는데 읽은 행 수가 결과 행 수보다 훨씬 많다'],
      check: 'EXPLAIN으로 어떤 인덱스를 썼는지, 각 조건이 인덱스 탐색 조건인지 읽은 뒤의 필터인지, 읽은 행 수와 반환한 행 수의 차이를 확인합니다.',
      fix: '쿼리의 같다 조건 컬럼이 인덱스의 왼쪽에 오도록 순서를 바꾸거나 새 인덱스를 만듭니다. 범위·정렬 컬럼은 뒤에 둡니다.',
    },
  });
})();
