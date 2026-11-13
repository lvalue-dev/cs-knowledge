/* 인메모리 · 캐시 2: 파이프라인, 분산 락과 펜싱 토큰, 퇴출 정책(LRU vs LFU)
   시간 값(왕복 1ms, 명령 실행 0.02ms, 락 TTL 30초 등)은 원리를 보이기 위한 가정값이다 */
(function () {
  const CS = window.CS;

  /* ---------- 파이프라인 ---------- */
  const P_RTT = 1, P_EXEC = 0.02;
  const r2 = (x) => Math.round(x * 100) / 100;
  const pipeRun = (piped) => (t, n) => {
    const RT = '네트워크 왕복 수', MS = '걸린 시간 (ms, 가정)';
    t.m[RT] = 0; t.m[MS] = 0;
    const st = Array(n).fill('');
    let exec = 0;
    const total = r2(n * (P_RTT + P_EXEC));
    const mark = (from, to, s) => { for (let i = from; i < to; i++) st[i] = s; };
    const tick = (rounds, cmds) => { t.m[RT] += rounds; exec += cmds; t.m[MS] = r2(t.m[RT] * P_RTT + exec * P_EXEC); };
    const snap = () => [
      {
        type: 'cells', tiny: true, cols: Math.min(n, 20),
        title: piped ? `명령 ${n}개 — 파란 칸: 클라이언트 버퍼에 쌓임 · 초록 칸: 응답 받음` : `명령 ${n}개 — 초록 칸: 응답까지 받은 명령`,
        items: st.map((s, i) => ({ id: i, v: '', s })),
      },
      {
        type: 'timeline', total, title: `시간을 쓴 곳, 누적 (가정: 왕복 1번 ${P_RTT}ms · 명령 1개 실행 ${P_EXEC}ms) — 전체 폭 = ${total}ms`,
        items: [
          { id: 'net', label: '네트워크 왕복', start: 0, len: t.m[RT] * P_RTT, s: piped ? 'done' : 'bad', text: !piped && t.m[RT] ? `${t.m[RT]}번 · ${t.m[RT] * P_RTT}ms` : '' },
          { id: 'exec', label: 'Redis 실행', start: 0, len: exec * P_EXEC, text: '' },
        ],
      },
    ];
    if (!piped) {
      t.step(2, `조회수 키 ${n}개를 1씩 올립니다. 명령 하나를 보내고, 응답이 올 때까지 기다린 뒤, 다음 명령을 보냅니다.`, snap());
      const single = Math.min(3, n);
      for (let i = 0; i < single; i++) {
        mark(0, i, 'done'); mark(i, i + 1, 'active'); tick(1, 1);
        t.step(4, i === 0
          ? `명령 1 — 요청이 Redis까지 가고, Redis가 실행하고(${P_EXEC}ms), 응답이 돌아옵니다. <b>왕복 1번에 ${P_RTT}ms.</b> 그동안 이 함수는 기다리기만 합니다.`
          : `명령 ${i + 1} — 또 왕복 1번. Redis가 일한 시간은 ${P_EXEC}ms뿐이고 나머지는 네트워크를 오가는 시간입니다.`, snap());
      }
      const size = Math.max(1, Math.ceil((n - single) / 7));
      for (let i = single; i < n; i += size) {
        const to = Math.min(n, i + size);
        mark(0, i, 'done'); mark(i, to, 'active'); tick(to - i, to - i);
        t.step(4, to - i > 1
          ? `명령 ${i + 1}~${to} — 같은 일을 ${to - i}번 반복합니다. 지금까지 왕복 <b>${t.m[RT]}번</b>.`
          : `명령 ${to} — 왕복 ${t.m[RT]}번째.`, snap());
      }
      mark(0, n, 'done');
      t.step(6, `왕복 <b>${n}번</b>, 약 <b>${t.m[MS]}ms</b>. 그중 Redis가 실제로 일한 시간은 ${r2(n * P_EXEC)}ms입니다. Redis가 느린 것이 아니라 기다림이 ${n}번 쌓인 것입니다.`, snap());
      return;
    }
    t.step(3, `같은 명령 ${n}개입니다. 이번에는 파이프라인 객체를 만들어, 명령을 <b>바로 보내지 않고</b> 모아 둡니다.`, snap());
    const single = Math.min(2, n);
    for (let i = 0; i < single; i++) {
      mark(i, i + 1, 'cmp');
      t.step(5, `<code>pipe.incr</code> ${i + 1}번째 — 클라이언트 메모리의 버퍼에 적어 둘 뿐입니다. 네트워크를 쓰지 않으므로 기다릴 것도 없습니다.`, snap());
    }
    mark(0, n, 'cmp');
    t.step(5, `나머지도 전부 버퍼에 쌓습니다. 명령 ${n}개가 대기 중이고, 아직 왕복은 0번입니다.`, snap());
    mark(0, n, 'active'); tick(1, 0);
    t.step(7, `<code>exec()</code> — 쌓아 둔 ${n}개를 <b>한 번의 전송</b>으로 보냅니다.`, snap());
    tick(0, n);
    t.step(7, `Redis가 받은 순서대로 ${n}개를 실행합니다(${r2(n * P_EXEC)}ms). 묶어서 보냈을 뿐 하나의 원자적 작업은 아니어서, 사이사이에 <b>다른 클라이언트의 명령이 끼어들 수 있습니다.</b>`, snap());
    mark(0, n, 'done');
    t.step(7, `응답 ${n}개도 한 번에 돌아옵니다. 보낸 순서와 같은 순서의 배열입니다.`, snap());
    t.step(8, `왕복 <b>1번</b>, 약 <b>${t.m[MS]}ms</b>. Redis가 한 일의 양은 같습니다. 줄어든 것은 기다린 횟수입니다.`, snap());
  };
  CS.add({
    id: 'redis-pipeline', level: 'mid', topic: 'mem',
    title: '파이프라인: Redis 명령 100개를 왕복 1번으로',
    summary: 'Redis는 명령 하나를 매우 짧은 시간에 처리합니다. 그런데 명령을 하나씩 보내고 응답을 기다리면, 걸리는 시간의 대부분은 네트워크 왕복이 됩니다. 같은 명령들을 하나씩 보낼 때와 묶어서 보낼 때를 비교합니다.',
    param: { label: '명령 수', options: [10, 50, 100], value: 100 },
    headline: '네트워크 왕복 수',
    verdict: '명령 100개를 하나씩 보내면 왕복 100번에 약 102ms(가정값), 파이프라인으로 묶으면 왕복 1번에 약 3ms입니다. Redis가 한 일은 양쪽 모두 2ms로 같습니다. 줄여야 할 것은 명령 수가 아니라 왕복 수입니다.',
    variants: [
      {
        name: '하나씩 보내고 기다리기', tone: 'bad', label: '왕복 n번', big: { time: '왕복 n번', space: '–' },
        code: `// 게시글 n개의 조회수를 1씩 올린다
async function addViews(ids) {
  for (const id of ids) {
    await redis.incr('views:' + id);
  }
}`,
        notes: { 4: '명령마다 왕복 1번' }, run: pipeRun(false),
      },
      {
        name: '파이프라인으로 묶어 보내기', tone: 'good', label: '왕복 1번', big: { time: '왕복 1번', space: '버퍼 O(n)' },
        code: `// 게시글 n개의 조회수를 1씩 올린다
async function addViews(ids) {
  const pipe = redis.pipeline();
  for (const id of ids) {
    pipe.incr('views:' + id);
  }
  return pipe.exec();
}`,
        notes: { 5: '보내지 않고 쌓기만', 7: '한 번에 보내고 한 번에 받음' }, run: pipeRun(true),
      },
    ],
    points: [
      '파이프라인은 <b>전송 방식</b>입니다. 응답을 기다리지 않고 명령 여러 개를 이어서 보낸 뒤 응답을 한꺼번에 읽습니다. 왕복뿐 아니라 운영체제의 읽기·쓰기 호출 횟수도 줄어 서버 처리량 자체가 올라갑니다.',
      '<b>MGET·MSET 같은 다중 키 명령</b>은 명령 하나입니다. 같은 종류의 작업을 여러 키에 하는 경우에는 이것이 가장 단순하고, 명령 하나이므로 중간에 다른 명령이 끼어들지 않습니다. 파이프라인은 서로 다른 종류의 명령도 묶을 수 있습니다.',
      '<b>트랜잭션(MULTI/EXEC)</b>은 목적이 다릅니다. 묶인 명령들 사이에 다른 클라이언트의 명령이 끼어들지 않게 합니다. 파이프라인은 그것을 보장하지 않습니다. 둘은 함께 쓸 수 있습니다.',
      '파이프라인 안에서는 <b>앞 명령의 결과를 보고 뒤 명령을 정할 수 없습니다.</b> 응답이 마지막에 한꺼번에 오기 때문입니다. "읽고 → 판단하고 → 쓰기"를 왕복 1번에 하려면 서버에서 실행되는 스크립트(Lua)를 씁니다.',
    ],
    senior: 'DB의 N+1 쿼리와 같은 문제입니다. 루프 안에서 Redis 호출을 기다리는 코드는 개발 환경(같은 장비, 왕복 0.1ms)에서는 티가 나지 않다가, 다른 가용 영역이나 관리형 서비스로 옮기는 순간 요청 지연이 수십 배가 됩니다. 요청 하나가 Redis 명령을 몇 개 보내는지를 추적 도구로 세어 보는 것이 출발점입니다. 주의할 점도 있습니다. 서버는 응답을 전부 만들 때까지 메모리에 쌓아 두므로 수십만 개를 한 번에 묶지 말고 수천~만 개 단위로 나눕니다. 클러스터에서는 키가 여러 노드에 흩어져 있어 클라이언트가 노드별로 파이프라인을 나눠 보내고, 다중 키 명령은 키들이 같은 슬롯에 있어야 합니다. 그리고 중간의 명령 하나가 실패해도 나머지는 실행되므로, 응답 배열을 항목별로 확인해야 합니다.',
    qa: [
      ['Redis는 빠르다는데 왜 Redis를 쓰는 API가 느릴 수 있습니까?', 'Redis가 명령을 처리하는 시간은 마이크로초 단위지만, 명령마다 네트워크 왕복이 필요하고 그것이 보통 수백 마이크로초에서 수 밀리초입니다. 루프 안에서 명령을 하나씩 보내고 기다리면 왕복 시간이 명령 수만큼 쌓입니다. 서버의 CPU는 한가하고 느린 명령 로그도 비어 있는데 API만 느리다면 이 경우입니다. 다중 키 명령이나 파이프라인으로 왕복 수를 줄여 해결합니다.'],
      ['파이프라인과 MULTI/EXEC 트랜잭션의 차이는 무엇입니까?', '파이프라인은 여러 명령을 한 번에 보내 왕복을 줄이는 전송 최적화이고, 명령들 사이에 다른 클라이언트의 명령이 끼어들 수 있습니다. MULTI/EXEC는 묶인 명령들이 끊김 없이 연속으로 실행되도록 보장하는 기능입니다. 다만 DB 트랜잭션과 달리 중간 명령이 실패해도 이미 실행된 명령을 되돌리지 않습니다. 보통 MULTI/EXEC를 파이프라인에 실어 보내 두 효과를 함께 얻습니다.'],
      ['파이프라인으로 해결할 수 없는 경우는 언제입니까?', '뒤 명령이 앞 명령의 결과에 의존할 때입니다. 예를 들어 값을 읽어 조건을 확인한 뒤 쓰는 작업은 응답을 받아야 다음을 정할 수 있어 묶을 수 없습니다. 이럴 때는 서버에서 원자적으로 실행되는 Lua 스크립트나 함수를 쓰거나, WATCH로 값이 바뀌지 않았는지 확인하는 낙관적 트랜잭션을 씁니다.'],
    ],
    dx: {
      cat: ['slow'], concept: '명령마다 발생하는 네트워크 왕복 (파이프라인 미사용)',
      symptoms: ['Redis 서버의 CPU는 한가하고 느린 명령 로그도 비어 있는데 API 응답이 느리다', '요청 하나의 추적 기록에 짧은 Redis 호출이 수십~수백 개 줄지어 있다', '로컬에서는 빠른데 배포 환경(다른 영역, 관리형 Redis)에서만 느리다'],
      check: '요청 하나가 보내는 Redis 명령 수와 왕복 1번의 시간을 잽니다. 두 값의 곱이 요청 지연의 대부분이면 이 문제입니다.',
      fix: '같은 종류의 작업은 MGET·MSET 등 다중 키 명령으로, 여러 종류의 명령은 파이프라인으로 묶습니다. 결과에 따라 분기해야 하면 Lua 스크립트로 서버에서 처리합니다.',
    },
  });

  /* ---------- 분산 락과 펜싱 토큰 ---------- */
  const DL_TOTAL = 66, DL_TTL = 30;
  const lockRun = (safe) => (t) => {
    const LATE = '반영된 뒤늦은 쓰기', STOLEN = '남의 락을 지운 횟수', REJ = '저장소가 거부한 쓰기';
    t.m[LATE] = 0; t.m[STOLEN] = 0; t.m[REJ] = 0;
    const rows = [];
    let lockVal = null, ctr = 6, store = '어제 보고서', last = 6, lockS = '', storeS = '';
    const row = (id, label, start, len, s, text) => {
      const r = rows.find((x) => x.id === id);
      if (r) Object.assign(r, { len, s, text }); else rows.push({ id, label, start, len, s, text });
    };
    const snap = () => [
      { type: 'timeline', total: DL_TOTAL, title: `시간 축 → (전체 폭 = ${DL_TOTAL}초, 락의 TTL = ${DL_TTL}초로 가정)`, items: rows.map((x) => ({ ...x })) },
      {
        type: 'cells', title: safe ? 'Redis의 락 키(lock:report)와 토큰 카운터 · 저장소의 값과 지금까지 받은 최대 토큰' : 'Redis의 락 키(lock:report) · 저장소의 값 (누가 쓰든 받아 줍니다)',
        items: [
          { id: 'k', v: lockVal || '없음', sub: '락 키', gap: true, s: lockS },
          ...(safe ? [{ id: 'ctr', v: ctr, sub: '카운터', gap: true }] : []),
          { id: 'v', v: store, sub: '저장소 값', gap: true, s: storeS },
          ...(safe ? [{ id: 'tok', v: last, sub: '최대 토큰' }] : []),
        ],
      },
    ];
    const L = safe ? { acq: 3, fail: 4, work: 5, write: 6, rel: 7 } : { acq: 2, fail: 3, work: 5, write: 6, rel: 7 };
    const A = safe ? 'a1f…' : '1', B = safe ? 'c93…' : '1';

    lockVal = A; lockS = 'new'; if (safe) ctr = 7;
    row('la', 'A의 락', 0, DL_TTL, '', `TTL ${DL_TTL}초`);
    t.step(L.acq, safe
      ? `작업자 A가 락을 잡습니다. 값은 A만 아는 무작위 문자열이고, 같은 스크립트 안에서 카운터를 올려 <b>토큰 7</b>을 받습니다. 토큰은 락을 잡을 때마다 1씩 커지는 번호입니다.`
      : `작업자 A가 <code>SET lock:report 1 NX PX 30000</code>으로 락을 잡습니다. NX는 "키가 없을 때만", PX는 "만료 시간"입니다. A가 죽어도 ${DL_TTL}초 뒤에는 락이 풀립니다.`, snap());
    lockS = '';
    t.step(L.fail, `1초 뒤 작업자 B도 같은 명령을 보냅니다. 키가 이미 있으므로 <b>실패</b>하고 물러납니다. 여기까지는 락이 제 역할을 합니다.`, snap());
    t.step(L.work, `A가 데이터를 읽고 보고서를 계산하기 시작합니다.`, snap());
    row('pa', 'A 멈춤', 8, 36, 'bad', '응답 없음 36초');
    t.step(L.work, `8초 시점에 A가 <b>멈춥니다.</b> 긴 GC, 가상 머신 일시 정지, 응답 없는 외부 호출 등 원인은 여러 가지입니다. A 자신은 멈춘 줄 모릅니다.`, snap());
    lockVal = null; lockS = 'bad';
    t.step(L.work, `30초 시점 — TTL이 끝나 Redis가 락 키를 지웁니다. <b>A는 여전히 멈춰 있고, 자기가 락을 가진 줄 압니다.</b>`, snap());
    lockVal = B; lockS = 'new'; if (safe) ctr = 8;
    row('lb', 'B의 락', 32, DL_TTL, '', `TTL ${DL_TTL}초`);
    t.step(L.acq, safe
      ? `32초 시점 — 키가 없으므로 B가 락을 잡습니다. 정상입니다. 카운터가 올라가 B는 <b>토큰 8</b>을 받습니다.`
      : `32초 시점 — 키가 없으므로 B가 락을 잡습니다. Redis 입장에서는 완전히 정상입니다.`, snap());
    lockS = ''; store = 'B의 결과'; storeS = 'done'; if (safe) last = 8;
    t.step(L.write, safe
      ? `B가 최신 데이터로 계산한 결과를 <b>토큰 8과 함께</b> 씁니다. 저장소는 지금까지 본 최대 토큰(6)보다 크므로 받아들이고, 8을 기억합니다.`
      : `B가 최신 데이터로 계산한 결과를 저장소에 씁니다. B는 이어서 후처리를 계속합니다.`, snap());
    storeS = '';
    if (!safe) {
      row('xa', 'A 뒤늦은 쓰기', 44, 3, 'bad', '');
      store = 'A의 결과'; storeS = 'bad'; t.m[LATE] = 1;
      t.step(L.write, `44초 시점 — A가 깨어나 멈췄던 줄의 다음부터 이어 갑니다. 락을 확인하지 않고, 36초 전 데이터로 만든 결과를 씁니다. <b>B의 결과를 덮어썼습니다.</b> 지금 두 작업자가 동시에 임계 구역 안에 있습니다.`, snap());
      storeS = ''; lockVal = null; lockS = 'bad'; t.m[STOLEN] = 1;
      row('lb', 'B의 락', 32, 15, 'bad', '47초에 삭제됨');
      t.step(L.rel, `47초 시점 — A가 "내 락"을 해제합니다. 그런데 지금 그 키는 <b>B의 락</b>입니다. 값이 누구 것인지 보지 않고 지웠습니다. B는 아직 작업 중입니다.`, snap());
      lockVal = '1'; lockS = 'new';
      row('lc', 'C의 락', 48, DL_TOTAL - 48, 'bad', 'B와 겹침');
      t.step(L.acq, `48초 시점 — 키가 없으니 세 번째 작업자 C도 락을 잡고 시작합니다. B와 C가 또 겹칩니다.`, snap());
      lockS = '';
      t.step(L.rel, `락은 한 번도 오류를 내지 않았습니다. 그런데 뒤늦은 쓰기 1건이 반영됐고, 남의 락이 1번 지워졌습니다. TTL이 있는 락은 "내가 아직 가지고 있다"를 보장하지 못합니다.`, snap());
      return;
    }
    row('xa', 'A 쓰기 → 거부', 44, 3, '', '');
    storeS = 'new'; t.m[REJ] = 1;
    t.step(L.write, `44초 시점 — A가 깨어나 결과를 <b>토큰 7과 함께</b> 씁니다. 저장소는 이미 8을 봤습니다. 7 < 8이므로 <b>거부합니다.</b> A가 얼마나 늦게 깨어나든 결과는 같습니다.`, snap());
    storeS = ''; lockS = 'cmp';
    t.step(L.rel, `47초 시점 — A가 해제 스크립트를 실행합니다. 락의 값(c93…)이 자기 값(a1f…)과 다르므로 <b>지우지 않습니다.</b> B의 락은 그대로입니다.`, snap());
    row('lb', 'B의 락', 32, 20, 'done', '52초에 직접 해제');
    lockVal = null; lockS = '';
    t.step(L.rel, `52초 시점 — B가 작업을 마치고 해제합니다. 값이 자기 것과 같으므로 지워집니다.`, snap());
    t.step(L.write, `A가 멈추고 락이 넘어가는 일은 똑같이 일어났습니다. 달라진 것은 <b>최종 판정을 저장소가 한다</b>는 점입니다. 뒤늦은 쓰기는 0건 반영, 1건 거부됐습니다.`, snap());
  };
  CS.add({
    id: 'distributed-lock', level: 'senior', topic: 'mem',
    title: '분산 락: TTL이 끝난 줄 모르고 계속 일하는 작업자',
    summary: '여러 서버 중 하나만 작업하게 하려고 Redis에 만료 시간이 있는 키를 락으로 씁니다. 그런데 락을 잡은 작업자가 오래 멈췄다 깨어나면, 그사이 락은 다른 작업자에게 넘어가 있습니다. 락만 믿을 때와 저장소가 번호(펜싱 토큰)를 검사할 때를 비교합니다.',
    headline: '반영된 뒤늦은 쓰기',
    verdict: '락만 믿은 쪽은 36초 멈췄던 작업자의 낡은 결과가 최신 결과를 덮어썼고(1건), 남의 락까지 지웠습니다. 펜싱 토큰을 쓴 쪽은 같은 상황에서 저장소가 작은 번호의 쓰기를 거부했습니다(0건 반영). 락은 "아마 나 혼자"까지만 알려 주고, 마지막 확인은 데이터를 받는 쪽이 해야 합니다.',
    variants: [
      {
        name: 'SET NX PX 락만 사용', tone: 'bad', label: '겹쳐 실행',
        code: `const ok = await redis.set(
  'lock:report', '1', 'NX', 'PX', 30000);
if (!ok) return;
const data = await load();
const result = await compute(data);
await storage.write(result);
await redis.del('lock:report');`,
        notes: { 2: '없을 때만 + 30초 뒤 만료', 3: '다른 작업자가 보유 중', 5: '여기서 오래 멈출 수 있음', 6: '락이 아직 내 것인지 모름', 7: '누구의 락이든 지움' }, run: lockRun(false),
      },
      {
        name: '펜싱 토큰 + 자기 락만 해제', tone: 'good', label: '뒤늦은 쓰기 거부',
        code: `const me = randomUUID();
const token = await redis.eval(ACQUIRE,
  1, 'lock:report', me, 30000);
if (!token) return;
const result = await compute(await load());
await storage.write(result, { token });
await redis.eval(RELEASE, 1, 'lock:report', me);`,
        notes: { 1: '나만 아는 값', 3: 'SET NX PX + 번호 발급', 6: '작은 번호면 거부', 7: '내 값일 때만 DEL' }, run: lockRun(true),
      },
    ],
    points: [
      '<code>SET key value NX PX 30000</code>은 "없을 때만 만들기"와 "만료 시간 설정"을 <b>한 명령</b>으로 합니다. 둘을 따로 보내면 그 사이에 작업자가 죽었을 때 락이 영원히 남습니다.',
      'TTL은 작업자가 죽어도 락이 풀리게 하려고 꼭 필요합니다. 그런데 TTL이 있다는 것은 <b>살아 있는 작업자의 락도 만료될 수 있다</b>는 뜻입니다. 멈춘 프로세스는 자기가 멈춘 줄 모르므로 코드에서 시간을 재는 것으로는 막을 수 없습니다.',
      '<b>펜싱 토큰</b>: 락을 잡을 때마다 1씩 커지는 번호를 받고, 쓰기에 그 번호를 실어 보냅니다. 저장소는 이미 본 번호보다 작은 번호의 쓰기를 거부합니다. DB라면 <code>UPDATE ... WHERE last_token < :token</code> 같은 조건부 쓰기가 그 역할을 합니다.',
      '<b>해제는 자기 락만</b>: 락 값에 작업자 고유의 무작위 문자열을 넣고, "값이 내 것과 같으면 삭제"를 Lua 스크립트로 한 번에 실행합니다. GET으로 확인한 뒤 DEL을 따로 보내면 그 사이에 또 만료될 수 있습니다.',
    ],
    senior: '먼저 락이 왜 필요한지를 구분합니다. 같은 작업을 두 번 하면 낭비일 뿐인 경우(효율)에는 Redis 한 대의 락으로 충분하고, 가끔 겹쳐도 됩니다. 두 번 하면 데이터가 틀어지는 경우(정확성)에는 락만으로는 부족합니다. 위의 멈춤 외에도 Redis 복제는 비동기라서 장애 조치 순간 락 키가 새 주 서버에 없을 수 있고, 여러 대의 과반에 락을 잡는 Redlock 알고리즘도 시계와 멈춤 시간에 대한 가정에 기대고 있어 안전성을 두고 오래 논쟁이 있었습니다. 그래서 정확성이 필요하면 저장소 쪽의 검사가 최종 방어선이어야 합니다. 펜싱 토큰, 버전 컬럼을 쓰는 조건부 쓰기, 유니크 제약, 멱등 키가 모두 같은 생각입니다. 이것들이 있으면 락은 중복 작업을 줄이는 최적화가 됩니다. 작업 중 TTL을 주기적으로 늘려 주는 방식은 느린 작업에는 도움이 되지만, 프로세스가 통째로 멈추면 연장도 멈추므로 근본 해결이 아닙니다. 운영에서는 락 보유 시간의 p99가 TTL에 얼마나 가까운지를 봅니다.',
    qa: [
      ['Redis로 분산 락을 어떻게 구현하고, 어떤 한계가 있습니까?', '<code>SET key 무작위값 NX PX 만료시간</code>으로 잡고, 해제는 값이 내 것일 때만 삭제하는 Lua 스크립트로 합니다. 한계는 만료 시간입니다. 락을 잡은 프로세스가 GC나 네트워크 지연으로 TTL보다 오래 멈추면, 락은 다른 프로세스로 넘어갔는데 본인은 모르고 작업을 이어 갑니다. 또 복제가 비동기라 장애 조치 때 락이 사라질 수 있습니다. 그래서 정확성이 중요하면 락 획득 때 증가하는 번호(펜싱 토큰)를 받아 저장소가 검사하게 하거나, 저장소의 조건부 쓰기·유니크 제약으로 최종 판정을 합니다.'],
      ['락을 해제할 때 왜 값을 비교한 뒤에 지워야 합니까?', '내 락이 이미 만료되어 다른 작업자가 같은 키로 락을 잡았을 수 있기 때문입니다. 그냥 DEL을 보내면 남의 락을 지우게 되고, 그러면 세 번째 작업자까지 들어올 수 있습니다. 그래서 락 값에 고유한 무작위 값을 넣고 "값이 같으면 삭제"를 실행합니다. 비교와 삭제 사이에 틈이 있으면 같은 문제가 다시 생기므로 Lua 스크립트로 원자적으로 실행합니다.'],
      ['펜싱 토큰이 무엇이고, 락의 TTL을 길게 잡는 것과 무엇이 다릅니까?', '펜싱 토큰은 락을 잡을 때마다 증가하는 번호이고, 저장소가 이미 본 번호보다 작은 번호의 쓰기를 거부하게 하는 장치입니다. TTL을 늘리는 것은 문제가 일어날 확률을 낮출 뿐이고, 멈춤이 TTL보다 길면 똑같이 깨지며 작업자가 죽었을 때 복구도 그만큼 늦어집니다. 펜싱은 멈춤이 얼마나 길든 낡은 쓰기를 막습니다. 대신 저장소가 번호를 비교하는 조건부 쓰기를 지원해야 합니다.'],
    ],
    dx: {
      cat: ['data', 'flaky', 'wrong'], concept: '분산 락의 만료와 뒤늦은 쓰기 (펜싱 토큰 없음)',
      symptoms: ['락을 걸었는데도 배치나 예약 작업이 가끔 두 번 실행된다', '부하가 높거나 GC가 길었던 시각, 배포 직후에만 중복 처리가 생긴다', '최신 결과가 조금 뒤에 더 오래된 결과로 되돌아가 있다', '작업이 끝나기도 전에 다른 서버가 같은 락을 잡았다는 로그가 있다'],
      check: '락을 잡은 시각, 작업이 끝난 시각, TTL을 로그로 비교합니다. 작업 시간이 TTL을 넘긴 적이 있는지, 해제가 값 비교 없이 DEL인지 확인합니다.',
      fix: '락 값에 고유 값을 넣고 비교 후 삭제(Lua)로 해제합니다. 결과를 받는 저장소에 펜싱 토큰이나 버전 조건부 쓰기, 유니크 제약을 두어 뒤늦은 쓰기를 거부합니다.',
    },
  });

  /* ---------- 퇴출 정책: LRU vs LFU ---------- */
  const EV_REQ = ['A', 'B', 'A', 'B', 1, 2, 3, 'A', 'B', 4, 5, 6, 'A', 'B'], EV_MAX = 3;
  const evRun = (lfu) => (t) => {
    const RATE = '캐시 적중률 (%)', MISS = '캐시 미스 (DB 조회)', HOT = '쫓겨난 인기 키';
    t.m[RATE] = 0; t.m[MISS] = 0; t.m[HOT] = 0;
    let cache = [], hits = 0;
    const res = [], out = [];
    const order = () => [...cache].sort((a, b) => (lfu ? a.cnt - b.cnt : 0) || a.last - b.last);
    const snap = (i, key, s) => [
      {
        type: 'cells', compact: true, title: `요청 ${EV_REQ.length}개 — 글자: 자주 읽는 인기 키 · 숫자: 배치 작업이 한 번씩만 읽는 키`,
        items: EV_REQ.map((v, k) => ({ id: k, v, s: k <= i ? res[k] : '', ptr: k === i ? '지금' : '', gap: [3, 6, 8, 11].includes(k) })),
      },
      {
        type: 'cells', title: `캐시 (최대 ${EV_MAX}개) — 맨 왼쪽이 다음에 버려질 키 · 아래는 ${lfu ? '읽힌 횟수' : '마지막으로 읽힌 요청 번호'}`,
        items: order().map((e) => ({ id: e.k, v: e.k, sub: lfu ? `${e.cnt}회` : `${e.last + 1}번째`, s: e.k === key ? s : '' })),
      },
      { type: 'cells', compact: true, title: '버려진 키 (순서대로) — 붉은 칸은 인기 키', items: out.map((k, x) => ({ id: x, v: k, s: typeof k === 'string' ? 'bad' : 'dim' })) },
    ];
    t.step(1, lfu
      ? `같은 요청입니다. 이번에는 메모리가 찼을 때 <b>읽힌 횟수가 가장 적은</b> 키를 버립니다(LFU).`
      : `인기 키 A·B를 반복해 읽는 중에, 전체 상품을 한 번씩 훑는 배치 작업(1~3, 4~6)이 두 차례 끼어듭니다. 메모리가 찼을 때 <b>가장 오래 안 읽힌</b> 키를 버립니다(LRU).`, snap(-1));
    EV_REQ.forEach((k, i) => {
      const e = cache.find((x) => x.k === k), hot = typeof k === 'string';
      if (e) {
        e.cnt++; e.last = i; hits++; res[i] = 'hit';
        t.m[RATE] = Math.round((hits / (i + 1)) * 100);
        t.step(3, `${k} — <b>적중.</b> ${lfu ? `읽힌 횟수가 ${e.cnt}회가 됩니다.` : '"방금 읽음"으로 표시되어 버려질 순서의 맨 뒤로 갑니다.'}`, snap(i, k, 'hit'));
        return;
      }
      res[i] = 'miss'; t.m[MISS]++;
      t.m[RATE] = Math.round((hits / (i + 1)) * 100);
      let msg = `${k} — 캐시에 없습니다. DB에서 읽어 옵니다.`, line = 7;
      if (cache.length >= EV_MAX) {
        const v = order()[0], vHot = typeof v.k === 'string';
        cache = cache.filter((x) => x !== v); out.push(v.k); line = 6;
        if (vHot) t.m[HOT]++;
        msg = `${k} — 미스. 자리가 없어 ${lfu ? `읽힌 횟수가 가장 적은 <b>${v.k}</b>(${v.cnt}회)` : `가장 오래 안 읽힌 <b>${v.k}</b>`}을 버립니다. ${vHot
          ? `${v.k}은 <b>인기 키</b>인데, 방금 한 번 읽혔을 뿐인 배치의 키들에게 밀려났습니다.`
          : hot ? '배치가 남기고 간 키입니다.' : lfu ? '배치의 키끼리 자리를 바꿀 뿐, 인기 키는 건드리지 않습니다.' : '배치의 키입니다.'}`;
      } else if (hot && i > 3) msg = `${k} — 미스. 조금 전까지 캐시에 있던 인기 키인데 배치에 밀려나서 <b>DB를 다시 읽어야 합니다.</b>`;
      cache.push({ k, cnt: 1, last: i });
      t.step(line, msg, snap(i, k, 'new'));
    });
    t.step(9, lfu
      ? `요청 ${EV_REQ.length}개 중 <b>${hits}개 적중(${t.m[RATE]}%)</b>. 배치가 두 번 지나갔지만 인기 키는 한 번도 버려지지 않았습니다. 배치의 키는 횟수가 1이라 자기들끼리만 자리를 바꿨습니다.`
      : `요청 ${EV_REQ.length}개 중 <b>${hits}개 적중(${t.m[RATE]}%)</b>. 배치가 지나갈 때마다 인기 키가 전부 밀려나 총 <b>${t.m[HOT]}번</b> 버려졌고, 그때마다 DB를 다시 읽었습니다.`, snap(EV_REQ.length));
  };
  CS.add({
    id: 'eviction-policy', level: 'adv', topic: 'mem',
    title: '캐시 퇴출 정책: 메모리가 찼을 때 무엇을 버릴까 (LRU vs LFU)',
    summary: '캐시의 메모리가 가득 차면 무언가를 버려야 새 값을 넣을 수 있습니다. "가장 오래 안 읽힌 것"(LRU)과 "가장 적게 읽힌 것"(LFU) 중 무엇을 버리느냐에 따라, 전체를 한 번씩 훑는 작업이 지나간 뒤의 적중률이 달라집니다.',
    headline: '캐시 적중률 (%)',
    verdict: '같은 요청 14개에 LRU는 2개(14%), LFU는 6개(43%)가 적중했습니다. LRU는 "방금 읽혔다"만 보기 때문에 한 번 훑고 지나가는 작업이 인기 키를 4번 밀어냈고, LFU는 읽힌 횟수를 보기 때문에 인기 키를 지켰습니다. 어느 정책이 맞는지는 접근 패턴에 달려 있습니다.',
    variants: [
      {
        name: 'LRU: 가장 오래 안 읽힌 키를 버림', tone: 'bad', label: '스캔에 취약', big: { time: 'O(1)', space: 'O(캐시 크기)' },
        code: `function get(key) {
  if (cache.has(key)) {
    touch(key);
    return cache.get(key);
  }
  if (cache.size >= MAX) evict(oldest());
  cache.set(key, loadFromDB(key));
  return cache.get(key);
}`,
        notes: { 3: '"방금 읽음"으로 표시', 6: '가장 오래 안 읽힌 키', 7: '새 키는 가장 최근 자리로' }, run: evRun(false),
      },
      {
        name: 'LFU: 가장 적게 읽힌 키를 버림', tone: 'good', label: '인기 키 유지', big: { time: 'O(1)~O(log n)', space: 'O(캐시 크기)' },
        code: `function get(key) {
  if (cache.has(key)) {
    count[key]++;
    return cache.get(key);
  }
  if (cache.size >= MAX) evict(leastUsed());
  cache.set(key, loadFromDB(key)); count[key] = 1;
  return cache.get(key);
}`,
        notes: { 3: '읽힌 횟수 +1', 6: '횟수가 가장 적은 키', 7: '새 키는 1회부터' }, run: evRun(true),
      },
    ],
    points: [
      'Redis는 <code>maxmemory</code>에 도달하면 <code>maxmemory-policy</code>에 따라 키를 버립니다. <b>noeviction</b>(기본값: 버리지 않고 쓰기 명령을 오류로 거부), <b>allkeys-lru</b>, <b>allkeys-lfu</b>, <b>allkeys-random</b>, 그리고 만료 시간이 있는 키만 대상으로 하는 <b>volatile-lru</b>, <b>volatile-lfu</b>, <b>volatile-random</b>, <b>volatile-ttl</b>(만료가 가장 가까운 키부터)이 있습니다.',
      'LRU는 "최근에 읽힌 것은 곧 또 읽힌다"는 가정입니다. 대부분의 서비스에서 잘 맞지만, 전체를 한 번씩 읽는 작업(배치, 크롤러, 전체 내보내기)이 지나가면 캐시가 한 번 쓰고 말 키로 채워집니다.',
      'LFU의 약점은 반대쪽에 있습니다. 예전에 인기 있던 키가 높은 횟수로 계속 남고, 막 인기를 얻기 시작한 새 키는 횟수가 적어 먼저 버려집니다. 그래서 Redis의 LFU는 시간이 지나면 횟수를 깎습니다(<code>lfu-decay-time</code>).',
      'Redis의 LRU·LFU는 <b>근사</b>입니다. 모든 키를 정렬해 두지 않고, 버릴 때 키 몇 개를 무작위로 뽑아(<code>maxmemory-samples</code>, 기본 5) 그중 가장 나쁜 것을 버립니다. 정확도를 조금 내주고 키마다 드는 메모리를 아낍니다.',
    ],
    senior: '정책을 고르기 전에 그 Redis의 용도를 먼저 정합니다. 순수한 캐시라면 allkeys-lru나 allkeys-lfu가 맞고, 세션이나 대기열처럼 사라지면 안 되는 데이터가 함께 있다면 volatile 계열로 "만료 시간을 준 키만 버려도 된다"고 표시하거나 아예 인스턴스를 나눕니다. 기본값 noeviction 그대로 캐시로 쓰다가 메모리가 차는 순간 모든 쓰기가 오류로 바뀌는 장애가 흔합니다. 반대로 volatile 계열인데 만료 시간을 준 키가 없으면 버릴 것이 없어 같은 오류가 납니다. 효과는 정책을 바꾸기 전후의 적중률(keyspace_hits, keyspace_misses)과 버려진 키 수(evicted_keys)로 확인합니다. 스캔성 작업이 원인이라면 정책보다 그 작업이 캐시를 거치지 않고 원본을 직접 읽게 하는 편이 간단합니다. 새 정책도 계속 추가되고 있습니다. Redis 8.6은 가장 오래 수정되지 않은 키를 버리는 allkeys-lrm·volatile-lrm을 넣었습니다. 2024년 라이선스 변경 이후 Redis와 그 포크인 Valkey가 따로 발전하고 있으므로, 설정 이름은 실제로 쓰는 쪽의 문서에서 확인하세요.',
    qa: [
      ['LRU와 LFU의 차이, 그리고 각각 어떤 상황에서 불리한지 설명해 보세요.', 'LRU는 가장 오래 접근되지 않은 것을, LFU는 접근 횟수가 가장 적은 것을 버립니다. LRU는 전체를 한 번씩 훑는 작업이 지나가면 한 번만 읽힌 키들이 자주 읽히는 키를 밀어내는 약점이 있습니다. LFU는 그 상황에 강하지만, 과거에 인기 있던 키가 횟수 덕에 오래 남고 새로 인기를 얻는 키가 자리를 잡기 어렵습니다. 그래서 실제 LFU 구현은 시간이 지나면 횟수를 줄입니다. 접근 패턴이 최근성 위주면 LRU, 인기 분포가 뚜렷하고 스캔이 섞이면 LFU가 낫습니다.'],
      ['Redis 메모리가 가득 차면 어떤 일이 일어납니까?', 'maxmemory-policy 설정에 따릅니다. 기본값 noeviction에서는 아무것도 버리지 않고 메모리를 늘리는 쓰기 명령을 오류로 거부합니다(읽기는 계속 됩니다). allkeys 계열은 모든 키 중에서, volatile 계열은 만료 시간이 있는 키 중에서 LRU·LFU·무작위·TTL 기준으로 골라 버립니다. 캐시 용도라면 allkeys-lru나 allkeys-lfu로 바꿔야 하고, 버려지면 안 되는 데이터가 섞여 있으면 인스턴스를 나누는 것이 안전합니다.'],
      ['Redis의 LRU는 정확한 LRU입니까?', '아닙니다. 정확한 LRU는 모든 키를 접근 순서대로 연결해 두어야 해서 키마다 메모리가 더 듭니다. Redis는 키마다 마지막 접근 시각만 작게 기록해 두고, 버릴 때 키 몇 개를 무작위로 뽑아 그중 가장 오래된 것을 버립니다. 표본 수(maxmemory-samples)를 늘리면 정확한 LRU에 가까워지고 CPU를 더 씁니다. LFU도 같은 방식이며 횟수는 작은 확률적 카운터로 근사합니다.'],
    ],
    dx: {
      cat: ['slow', 'crash'], concept: '캐시 퇴출 정책 (maxmemory-policy)',
      symptoms: ['배치·전체 내보내기·크롤러가 지나간 직후 캐시 적중률이 급락하고 DB 부하가 오른다', '어느 날부터 Redis 쓰기가 "OOM command not allowed when used memory > maxmemory" 오류로 실패한다', '만료 시간을 주지 않은 세션·대기열 키가 사라진다'],
      check: 'maxmemory와 maxmemory-policy 설정, 사용 메모리, evicted_keys와 적중률(keyspace_hits / misses)의 변화를 봅니다. 적중률이 떨어진 시각에 어떤 작업이 돌았는지 맞춰 봅니다.',
      fix: '캐시 용도면 allkeys-lru 또는 allkeys-lfu로 정합니다. 스캔성 작업은 캐시를 채우지 않고 원본을 직접 읽게 합니다. 버려지면 안 되는 데이터는 다른 인스턴스로 분리합니다.',
    },
  });
})();
