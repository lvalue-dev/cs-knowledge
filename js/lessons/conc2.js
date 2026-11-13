/* 동시성 2: CAS(락 없는 갱신), 배압(backpressure), CPU 작업을 워커로 분리 */
(function () {
  const CS = window.CS;

  /* ---------- CAS: compare-and-swap ---------- */
  const W = '락을 기다리며 멈춘 단계', RETRY = 'CAS 재시도', CNT = 'counter (기대값 4)';
  const MODE = { run: ' ← 지금 실행 중', wait: ' — 락을 기다리며 잠듦', off: ' — CPU를 빼앗겨 멈춤', end: ' — 할 일을 끝냄' };
  // 두 방식이 같은 틀을 쓴다: 공유 메모리 한 줄 + 스레드별 지역 변수
  const casSim = (t, useLock) => {
    const st = { counter: 0, lock: null, cs: '', th: { A: { cur: '–', seen: '–', done: 0, mode: '' }, B: { cur: '–', seen: '–', done: 0, mode: '' } } };
    t.m[W] = 0; t.m[RETRY] = 0; t.m[CNT] = 0;
    const panels = () => [
      {
        type: 'cells', title: '공유 메모리 (두 스레드가 함께 봄)',
        items: [{ id: 'c', v: st.counter, sub: 'counter', s: st.cs }, ...(useLock ? [{ id: 'l', v: st.lock ? `${st.lock}가 잡음` : '열림', sub: 'lock', s: st.lock ? 'new' : '' }] : [])],
      },
      ...['A', 'B'].map((id) => {
        const th = st.th[id], on = th.mode === 'run';
        return {
          type: 'cells', hot: on, title: `스레드 ${id}${MODE[th.mode] || ''}`,
          items: [
            { id: 'cur', v: th.cur, sub: 'cur', s: on ? 'cmp' : th.mode ? 'dim' : '' },
            ...(useLock ? [] : [{ id: 'seen', v: th.seen, sub: 'seen', s: on ? 'cmp' : th.mode ? 'dim' : '' }]),
            { id: 'n', v: `${th.done}/2`, sub: '끝낸 증가', s: th.done === 2 ? 'done' : '' },
          ],
        };
      }),
    ];
    // who: 이번 단계를 실행하는 스레드. 다른 스레드의 상태(wait, off, end)는 그대로 둔다
    const step = (line, who, msg, cs) => {
      for (const id of ['A', 'B']) if (st.th[id].mode === 'run') st.th[id].mode = '';
      if (who && st.th[who].mode !== 'wait') st.th[who].mode = 'run';
      st.cs = cs || '';
      if (st.th.A.mode === 'wait' || st.th.B.mode === 'wait') t.m[W]++;
      t.m[CNT] = st.counter;
      t.step(line, msg, panels());
    };
    return { st, step };
  };
  CS.add({
    id: 'cas-atomic', level: 'senior', topic: 'conc',
    title: 'CAS: 락 없이 안전하게 값 바꾸기',
    summary: '락은 한 번에 한 스레드만 들여보내 값을 지키지만, 락을 쥔 스레드가 멈추면 기다리는 쪽도 함께 멈춥니다. compare-and-swap(CAS)은 "내가 읽은 값 그대로일 때만 바꾼다"를 CPU 명령 하나로 실행하고, 실패하면 다시 읽어 재시도합니다. 스레드 A가 도중에 CPU를 빼앗기는 같은 상황에서 두 방식을 비교합니다.',
    headline: W,
    verdict: '두 방식 모두 최종 값은 4로 정확합니다. 락은 7단계 동안 다른 스레드를 세워 두었고, CAS는 아무도 기다리지 않는 대신 재시도를 1번 치렀습니다. 충돌이 드물면 CAS가 유리합니다. 충돌이 잦거나 여러 값을 한꺼번에 바꿔야 하면 락이 낫습니다.',
    variants: [
      {
        name: '락으로 줄 세우기', tone: 'bad', label: '비관적: 먼저 잠근다', big: { time: '충돌 시 대기(잠듦)', space: '락 1개' },
        code: `function increment() {
  lock.acquire();      // 잠겨 있으면 풀릴 때까지 잠든다
  const cur = counter;
  counter = cur + 1;
  lock.release();
}`,
        notes: { 2: '한 번에 한 스레드만 통과', 5: '기다리던 스레드를 깨움' },
        run(t) {
          const { st, step } = casSim(t, true), A = st.th.A, B = st.th.B;
          step(1, null, `스레드 A와 B가 <code>increment()</code>를 2번씩 호출합니다. 끝나면 counter는 <b>4</b>여야 합니다.`);
          st.lock = 'A';
          step(2, 'A', `<b>A</b>: 락을 잡습니다. 이제 A만 이 구간을 실행할 수 있습니다.`);
          A.cur = st.counter;
          step(3, 'A', `<b>A</b>: <code>cur = counter</code> → 0을 읽습니다.`);
          A.mode = 'off';
          step(0, null, `운영체제가 A의 실행 차례를 끝내고 CPU를 다른 일에 줍니다. A는 <b>락을 쥔 채로</b> 멈췄습니다.`);
          B.mode = 'wait';
          step(2, 'B', `<b>B</b>: 락을 잡으려 하지만 잠겨 있습니다. B는 잠들어 기다립니다.`);
          step(2, 'B', `<b>B</b>: 여전히 기다립니다. 락 주인이 CPU를 받지 못하는 동안에는 B도 한 걸음도 나아가지 못합니다.`);
          A.mode = 'run'; st.counter = A.cur + 1;
          step(4, 'A', `<b>A</b>: 다시 CPU를 받아 <code>counter = 1</code>을 씁니다. 락 덕분에 그 사이 아무도 값을 바꾸지 못했습니다.`, 'done');
          st.lock = null; A.done = 1;
          step(5, 'A', `<b>A</b>: 락을 풉니다. 기다리던 B를 깨웁니다(깨우는 데에도 컨텍스트 전환 비용이 듭니다).`);
          B.mode = 'run'; st.lock = 'B';
          step(2, 'B', `<b>B</b>: 깨어나 락을 잡습니다.`);
          B.cur = st.counter;
          step(3, 'B', `<b>B</b>: <code>cur = counter</code> → 1을 읽습니다.`);
          A.mode = 'wait';
          step(2, 'A', `<b>A</b>: 두 번째 증가를 하려 하지만 이번에는 B가 락을 쥐고 있습니다. A가 잠듭니다.`);
          st.counter = B.cur + 1;
          step(4, 'B', `<b>B</b>: <code>counter = 2</code>를 씁니다.`, 'done');
          st.lock = null; B.done = 1;
          step(5, 'B', `<b>B</b>: 락을 풀고 A를 깨웁니다.`);
          for (const [id, th] of [['A', A], ['B', B]]) {
            th.mode = 'run'; st.lock = id;
            step(2, id, `<b>${id}</b>: 락을 잡습니다.`);
            th.cur = st.counter;
            step(3, id, `<b>${id}</b>: <code>cur = counter</code> → ${th.cur}을 읽습니다.`);
            st.counter = th.cur + 1;
            step(4, id, `<b>${id}</b>: <code>counter = ${st.counter}</code>를 씁니다.`, 'done');
            st.lock = null; th.done = 2; th.mode = 'end';
            step(5, null, `<b>${id}</b>: 락을 풉니다. ${id}는 두 번의 증가를 모두 끝냈습니다.`);
          }
          step(6, null, `최종 counter = <b>4</b>, 정확합니다. 그 대가로 스레드가 락을 기다리며 멈춘 단계가 <b>${t.m[W]}번</b> 있었고, 그중 일부는 락 주인이 일하지도 않는 시간이었습니다.`, 'done');
        },
      },
      {
        name: 'CAS로 낙관적 재시도', tone: 'good', label: '낙관적: 쓸 때 확인한다', big: { time: '충돌 시 재시도', space: '추가 없음' },
        code: `// counter: 공유 메모리 위의 Int32Array
function increment() {
  while (true) {
    const cur = Atomics.load(counter, 0);
    const seen = Atomics.compareExchange(counter, 0, cur, cur + 1);
    if (seen === cur) return;   // 성공: 그 사이 아무도 안 바꿨다
    // 실패: 누군가 먼저 바꿨다 → 다시 읽고 재시도
  }
}`,
        notes: { 5: '비교와 교체가 한 명령', 7: '쓴 것이 없으니 다시 하면 됨' },
        run(t) {
          const { st, step } = casSim(t, false), A = st.th.A, B = st.th.B;
          const read = (id, th) => { th.cur = st.counter; th.seen = '–'; step(4, id, `<b>${id}</b>: <code>cur = load()</code> → ${th.cur}을 읽습니다. 락은 잡지 않습니다.`); };
          const casOk = (id, th, extra) => {
            th.seen = st.counter; st.counter = th.cur + 1;
            step(5, id, `<b>${id}</b>: "counter가 아직 ${th.cur}이면 ${th.cur + 1}로 바꿔라." 지금 값이 ${th.cur}이므로 <b>교체 성공</b>입니다. 확인과 교체는 CPU 명령 하나라 사이에 아무도 끼어들지 못합니다.`, 'done');
            th.done++;
            step(6, id, `<b>${id}</b>: <code>seen(${th.seen}) === cur(${th.cur})</code> → 성공했으므로 돌아갑니다.${extra || ''}`);
          };
          step(2, null, `같은 일을 락 없이 합니다. 스레드 A와 B가 2번씩 증가시키고, 끝나면 counter는 <b>4</b>여야 합니다.`);
          read('A', A);
          A.mode = 'off';
          step(0, null, `같은 지점에서 운영체제가 A를 멈춥니다. 이번에는 A가 <b>쥐고 있는 것이 없습니다.</b>`);
          read('B', B);
          casOk('B', B);
          read('B', B);
          B.mode = 'run';
          casOk('B', B, ' A가 멈춰 있는 동안 B는 자기 일을 전부 끝냈습니다.');
          B.mode = 'end';
          A.mode = 'run'; A.seen = st.counter;
          step(5, 'A', `<b>A</b>: 다시 CPU를 받아 "counter가 아직 0이면 1로 바꿔라"를 실행합니다. 그런데 지금 값은 <b>2</b>입니다. 교체하지 않고 지금 값 2를 돌려줍니다.`, 'bad');
          t.m[RETRY]++;
          step(7, 'A', `<b>A</b>: <code>seen(2) !== cur(0)</code> → 실패입니다. A는 아무것도 쓰지 않았으므로 망가진 것이 없습니다. 처음부터 다시 합니다.`);
          read('A', A);
          casOk('A', A);
          read('A', A);
          casOk('A', A);
          A.mode = 'end';
          step(9, null, `최종 counter = <b>4</b>, 정확합니다. 락을 기다린 단계는 <b>0</b>, 대신 A가 한 번 헛일을 하고 재시도했습니다(${t.m[RETRY]}번).`, 'done');
        },
      },
    ],
    points: [
      'CAS는 "기대한 값과 같으면 새 값으로 바꾸고, 다르면 아무것도 하지 않는다"를 <b>CPU 명령 하나</b>로 실행합니다. 읽기·비교·쓰기 사이에 다른 스레드가 끼어들 틈이 없습니다.',
      '락은 충돌할 것이라 보고 먼저 막는 <b>비관적</b> 방식, CAS는 충돌이 없을 것이라 보고 진행한 뒤 쓰는 순간에 확인하는 <b>낙관적</b> 방식입니다.',
      '한 스레드의 CAS가 실패했다는 것은 다른 스레드가 성공했다는 뜻입니다. 누가 멈추든 전체로는 항상 누군가 전진합니다(lock-free).',
      '단순한 증가라면 CAS 루프를 직접 쓸 필요 없이 원자적 덧셈(<code>Atomics.add</code>, DB의 <code>SET n = n + 1</code>)을 씁니다. CAS 루프는 "읽은 값으로 계산한 결과를 조건부로 저장"할 때 필요합니다.',
    ],
    senior: '같은 원리가 DB에서는 <b>낙관적 락</b>입니다. 행에 version 컬럼을 두고 <code>UPDATE ... SET ..., version = version + 1 WHERE id = ? AND version = ?</code>로 쓴 뒤, 바뀐 행 수가 0이면 그 사이 누가 수정한 것이므로 다시 읽고 재시도하거나 사용자에게 충돌을 알립니다. HTTP의 <code>ETag</code>와 <code>If-Match</code> 헤더, 키-값 저장소의 조건부 쓰기도 같은 구조입니다. 주의할 점이 세 가지 있습니다. 첫째, <b>ABA 문제</b>입니다. 값이 A에서 B로 바뀌었다가 다시 A로 돌아오면 CAS는 변화를 알아채지 못합니다. 카운터에는 무해하지만 포인터를 교체하는 락 없는 자료구조에서는 이미 해제된 노드를 다시 연결하는 버그가 되므로, 값과 함께 단조 증가하는 버전을 비교합니다(version 컬럼이 ABA에 안전한 이유입니다). 둘째, 경합이 심하면 재시도가 재시도를 낳아 CPU만 쓰고 진전이 느려집니다. 충돌률(재시도 횟수)을 지표로 남기고, 재시도 사이에 무작위 지연을 둡니다. 셋째, 임계 구역이 길거나 여러 값을 함께 바꿔야 하면 실패할 때마다 버리는 일이 커지므로 락이 더 쌉니다.',
    qa: [
      ['CAS(compare-and-swap)가 무엇이고, 락과 어떻게 다릅니까?', 'CAS는 메모리의 값이 기대한 값과 같을 때만 새 값으로 바꾸는 원자적 연산입니다. 같지 않으면 아무것도 쓰지 않고 실패를 알립니다. 락은 임계 구역에 들어가기 전에 다른 스레드를 막고 기다리게 하지만, CAS는 막지 않고 진행한 뒤 쓰는 순간에 충돌을 확인하고 실패하면 재시도합니다. 스레드가 잠들지 않으므로 충돌이 드물 때 빠르고, 락을 쥔 스레드가 멈춰 전체가 서는 일이 없습니다.'],
      ['ABA 문제를 설명하고 해결 방법을 말해 보세요.', '스레드 1이 값 A를 읽은 뒤, 다른 스레드가 값을 B로 바꿨다가 다시 A로 되돌리면, 스레드 1의 CAS는 값이 그대로라고 보고 성공합니다. 값은 같아도 그 사이 상태가 달라졌을 수 있어 문제입니다. 예를 들어 락 없는 스택에서 꺼냈다가 해제된 노드의 주소가 재사용되는 경우입니다. 값 옆에 변경할 때마다 증가하는 버전(스탬프)을 두고 둘을 함께 비교하거나, 해제를 미루는 기법(해저드 포인터, 가비지 컬렉션)을 씁니다.'],
      ['DB에서 낙관적 락과 비관적 락을 각각 언제 씁니까?', '낙관적 락은 version 컬럼으로 쓰는 순간에만 충돌을 검사하므로 락을 오래 쥐지 않습니다. 같은 행을 동시에 수정하는 일이 드문 경우(게시글 수정, 설정 변경)에 맞습니다. 충돌이 잦으면 재시도가 몰려 오히려 느려지므로, 재고 차감이나 좌석 예약처럼 한 행에 쓰기가 집중되는 경우에는 SELECT ... FOR UPDATE 같은 비관적 락이나 조건을 건 원자적 UPDATE가 낫습니다.'],
    ],
    dx: {
      cat: ['data', 'flaky', 'slow'], concept: '낙관적 동시성 제어(CAS, version 컬럼)',
      symptoms: ['두 사람이 같은 데이터를 거의 동시에 수정하면 한쪽 변경이 조용히 사라진다(나중에 쓴 쪽이 덮어씀)', '트래픽이 몰릴 때만 낙관적 락 충돌 예외나 HTTP 409·412 응답이 급증한다', '스레드 덤프를 보면 다수의 스레드가 같은 락 하나를 기다리며 BLOCKED 상태다'],
      check: '수정 경로가 "읽기 → 계산 → 쓰기"인지, 쓰는 순간에 읽었던 값(또는 버전)을 조건으로 거는지 봅니다. 충돌·재시도 횟수와 락 대기 시간을 지표로 남겨 어느 쪽 비용이 큰지 확인합니다.',
      fix: '덮어쓰기가 문제면 version 조건을 건 UPDATE(CAS)로 바꾸고 실패 시 재시도합니다. 재시도가 폭증하면 한 행에 쓰기가 몰린 것이므로 원자적 UPDATE, 비관적 락, 쓰기 분산 중에서 고릅니다.',
    },
  });

  /* ---------- 배압(backpressure) ---------- */
  const BP_N = 12, BP_RATE = 3, BP_CAP = 3;
  const QMAX = '큐 길이 최댓값', QWAIT = '큐에서 기다린 최대 시간 (틱)', QDONE = '처리 완료';
  const bpRun = (bounded) => (t) => {
    t.m[QMAX] = 0; t.m[QWAIT] = 0; t.m[QDONE] = 0;
    const queue = [], hist = [];
    let left = BP_N, next = 1, tick = 0, taken = null;
    const snap = (fresh = 0, blocked) => [
      { type: 'cells', compact: true, hot: !!blocked, title: `원본(파일·소켓·브로커)에 남은 메시지 ${left}개${blocked ? ' — 생산자가 기다리는 중' : left ? '' : ' — 전부 읽음'}`, items: Array.from({ length: left }, (_, k) => ({ id: next + k, v: next + k })) },
      {
        type: 'cells', title: `큐(프로세스 메모리) — 지금 ${queue.length}개 / ${bounded ? `최대 ${BP_CAP}개` : '제한 없음'}${taken ? ` · 소비자가 ${taken}번 처리 중` : ''}`,
        items: queue.map((m, k) => ({ id: m.id, v: m.id, sub: `${tick - m.at}틱`, s: k >= queue.length - fresh ? 'new' : bounded || queue.length <= BP_CAP ? 'cmp' : 'bad' })),
      },
      { type: 'cells', bars: true, max: BP_N - BP_RATE, title: '틱마다 큐 길이 (막대 하나 = 1틱)', items: hist.map((v, k) => ({ id: k, v, s: k === hist.length - 1 ? 'active' : v > BP_CAP ? 'bad' : 'done' })) },
    ];
    t.step(1, bounded
      ? `큐의 크기를 <b>${BP_CAP}개</b>로 제한했습니다. 조건은 같습니다. 생산자는 한 틱에 최대 ${BP_RATE}개를 보낼 수 있고, 소비자는 한 틱에 1개만 처리합니다(가정).`
      : `메시지 ${BP_N}개를 읽어 느린 저장소에 써야 합니다. 생산자는 한 틱에 ${BP_RATE}개를 보내고, 소비자는 한 틱에 <b>1개</b>만 처리합니다(가정). 큐에는 크기 제한이 없습니다.`, snap());
    while (t.m[QDONE] < BP_N) {
      tick++; taken = null;
      const room = bounded ? BP_CAP - queue.length : Infinity, n = Math.min(BP_RATE, left, room);
      for (let k = 0; k < n; k++) queue.push({ id: next++, at: tick });
      left -= n;
      hist.push(queue.length);
      t.m[QMAX] = Math.max(t.m[QMAX], queue.length);
      const blocked = bounded && left > 0 && n < BP_RATE;
      if (n || blocked) {
        t.step(bounded ? 4 : 3, bounded
          ? (n === BP_RATE
            ? `${tick}틱 — 빈자리가 ${room}개이므로 ${n}개를 읽어 넣습니다. 큐가 가득 찼습니다.`
            : `${tick}틱 — 빈자리가 ${room}개뿐이라 <b>${n}개만</b> 읽어 넣고 <code>await</code>에서 멈춥니다. 남은 ${left}개는 원본에 그대로 있습니다. 메모리를 차지하지 않습니다.`)
          : `${tick}틱 — 생산자가 ${n}개를 넣습니다. 소비자가 바쁜지 묻지 않습니다. 큐 길이 <b>${queue.length}</b>.`, snap(n, blocked));
      }
      const m = queue.shift();
      taken = m.id;
      t.m[QWAIT] = Math.max(t.m[QWAIT], tick - m.at);
      t.m[QDONE]++;
      const drained = !left && !bounded;
      t.step(bounded ? 9 : 8, drained
        ? `${tick}틱 — 소비자가 ${m.id}번을 꺼냅니다. 이 메시지는 큐에서 <b>${tick - m.at}틱</b>을 기다렸습니다. 생산이 끝난 뒤에도 밀린 것을 치우는 중입니다.`
        : `${tick}틱 — 소비자가 ${m.id}번을 꺼내 처리합니다(큐에서 기다린 시간 ${tick - m.at}틱). ${bounded ? (left ? '자리가 하나 났으므로 생산자가 다음 틱에 하나를 더 넣을 수 있습니다.' : '원본은 이미 다 읽었습니다.') : `들어오는 속도가 나가는 속도의 ${BP_RATE}배라 큐는 계속 자랍니다.`}`, snap(0, bounded && left > 0));
    }
    taken = null;
    t.step(bounded ? 12 : 11, bounded
      ? `${BP_N}개를 ${tick}틱에 끝냈습니다. 걸린 시간은 같고, 큐는 <b>${t.m[QMAX]}개</b>를 넘지 않았으며 가장 오래 기다린 메시지도 ${t.m[QWAIT]}틱입니다. 소비자의 속도가 생산자에게 전달된 것입니다.`
      : `${BP_N}개를 ${tick}틱에 끝냈습니다. 큐는 최대 <b>${t.m[QMAX]}개</b>까지 자랐고, 마지막 메시지는 ${t.m[QWAIT]}틱을 기다렸습니다. 입력이 끝나지 않는 스트림이었다면 큐는 메모리가 바닥날 때까지 자랍니다.`, snap());
  };
  CS.add({
    id: 'backpressure', level: 'senior', topic: 'conc',
    title: '배압: 생산자가 소비자보다 빠를 때',
    summary: '읽는 쪽은 빠르고 쓰는 쪽은 느리면 그 사이의 큐가 차이를 떠안습니다. 큐에 제한이 없으면 메모리와 대기 시간이 함께 불어납니다. 큐 크기를 제한하고 가득 차면 생산자를 기다리게 해서, 느린 쪽의 속도가 앞쪽으로 전달되게 하는 것이 배압(backpressure)입니다.',
    headline: QMAX,
    verdict: '전체 처리 시간은 양쪽 모두 12틱으로 같습니다. 소비자 속도가 한계이기 때문입니다. 달라진 것은 쌓인 양입니다. 제한 없는 큐는 9개까지 자랐고 마지막 메시지는 8틱을 기다렸습니다. 제한한 큐는 3개, 2틱을 넘지 않았습니다. 처리량을 넘는 입력은 어딘가에서 기다려야 하고, 배압은 그 장소를 내 프로세스의 메모리가 아니라 원본 쪽으로 옮깁니다.',
    variants: [
      {
        name: '제한 없는 큐', tone: 'bad', label: '일단 받는다', big: { time: '소비자 속도가 한계', space: '밀린 만큼 증가' },
        code: `const queue = [];                   // 크기 제한 없음
source.on('data', (msg) => {
  queue.push(msg);                  // 소비자가 바빠도 쌓는다
});

async function consume() {
  for (;;) {
    const msg = await take(queue);  // 하나 꺼내서
    await slowWrite(msg);           // 느린 저장소에 쓴다
  }
}`,
        notes: { 3: '들어오는 속도를 아무도 조절하지 않음', 9: '한 틱에 1개' },
        run: bpRun(false),
      },
      {
        name: '크기 제한 큐 + 생산자 대기', tone: 'good', label: '가득 차면 멈춘다', big: { time: '소비자 속도가 한계', space: 'O(큐 크기)' },
        code: `const queue = new BoundedQueue(3);  // 최대 3개
async function produce() {
  for await (const msg of source) { // 필요할 때만 당겨 읽는다
    await queue.push(msg);          // 가득 차면 여기서 대기
  }
}
async function consume() {
  for (;;) {
    const msg = await queue.take(); // 꺼내면 자리가 난다
    await slowWrite(msg);
  }
}`,
        notes: { 4: '빈자리가 날 때까지 다음 것을 읽지 않음', 9: '생산자를 깨움' },
        run: bpRun(true),
      },
    ],
    points: [
      '들어오는 속도가 나가는 속도보다 빠른 상태가 이어지면, 제한 없는 큐의 길이는 시간에 비례해 끝없이 자랍니다. 큐는 순간적인 몰림을 흡수할 뿐, 지속적인 속도 차이는 해결하지 못합니다.',
      '큐가 가득 찼을 때의 선택지는 셋입니다. <b>기다리게 한다</b>(생산자를 멈춤), <b>거절한다</b>(429·503으로 빨리 실패), <b>버린다</b>(오래된 것이나 덜 중요한 것). 생산자를 멈출 수 없는 외부 요청에는 거절이나 버리기를 씁니다.',
      '배압은 한 구간에서만 걸면 소용이 없습니다. 중간에 제한 없는 버퍼가 하나라도 있으면 거기에 다시 쌓입니다.',
      '큐 길이보다 <b>큐에서 기다린 시간</b>이 사용자에게 보이는 지연입니다. 기다린 시간이 타임아웃을 넘으면, 서버는 이미 떠난 요청을 뒤늦게 처리하느라 자원을 씁니다.',
    ],
    senior: '운영에서는 "트래픽이 몰린 뒤 메모리가 계속 오르다 OOM으로 죽고, 재시작하면 밀린 요청이 다시 몰려 또 죽는" 모습으로 나타납니다. 제한 없는 큐는 코드에 잘 보이지 않습니다. 스레드 풀의 작업 대기열 기본값, 이벤트 리스너에서 바로 <code>push</code>하는 배열, <code>await</code> 없이 쌓이는 Promise, 응답을 기다리지 않고 계속 쓰는 소켓이 전부 큐입니다. Node.js 스트림은 <code>write()</code>가 <code>false</code>를 돌려주면 <code>drain</code> 이벤트까지 멈추라는 신호이고, <code>pipeline()</code>이나 <code>for await</code>를 쓰면 이 처리가 자동으로 됩니다. TCP의 수신 윈도, 메시지 브로커의 컨슈머 지연(lag), 리액티브 스트림의 <code>request(n)</code>도 같은 개념입니다. 요청을 받는 서버라면 동시 처리 수와 대기열 길이에 상한을 두고, 넘으면 즉시 거절하는 편이 전체가 느려지는 것보다 낫습니다. 거절당한 클라이언트는 지연을 두고 재시도해야 하며, 그렇지 않으면 재시도가 부하를 더 키웁니다. 지표는 큐 길이, 큐 대기 시간, 유입률과 처리율 네 가지를 남깁니다.',
    qa: [
      ['배압(backpressure)이 무엇이고 왜 필요합니까?', '데이터를 처리하는 쪽이 감당할 수 있는 속도를 데이터를 보내는 쪽에 전달해서 보내는 속도를 늦추게 하는 장치입니다. 없으면 두 속도의 차이가 중간 버퍼에 쌓여 메모리가 늘고, 큐에서 기다리는 시간이 길어져 지연이 폭증합니다. 크기가 제한된 큐와 "가득 차면 대기·거절·버림" 정책으로 구현합니다.'],
      ['큐가 가득 찼을 때 대기, 거절, 버리기 중 무엇을 고릅니까?', '생산자를 멈출 수 있는가와 데이터를 잃어도 되는가로 정합니다. 파일이나 브로커에서 당겨 읽는 경우처럼 생산자를 멈출 수 있으면 대기가 가장 안전합니다. 사용자 요청처럼 멈출 수 없으면 빨리 거절해서 클라이언트가 재시도나 대체 동작을 하게 합니다. 지표나 실시간 위치처럼 최신 값만 의미가 있으면 오래된 것을 버립니다.'],
      ['서버를 늘리지 않고 큐만 크게 잡으면 왜 해결되지 않습니까?', '유입률이 처리율보다 높은 상태가 지속되면 큐는 크기와 상관없이 결국 가득 찹니다. 큐를 키우면 가득 차기까지의 시간만 늘어나고, 그동안 대기 시간은 큐 길이에 비례해 길어집니다. 큐는 짧은 몰림을 평탄하게 하는 용도이고, 지속적인 초과는 처리율을 높이거나 유입을 줄여야 풀립니다.'],
    ],
    dx: {
      cat: ['memory', 'slow', 'crash'], concept: '제한 없는 큐와 배압 부재',
      symptoms: ['트래픽이 몰린 뒤 메모리가 계속 오르다가 OOM으로 프로세스가 죽는다', '큐 길이나 컨슈머 지연(lag)이 줄지 않고 계속 늘어난다', '평균 응답 시간은 괜찮은데 뒤쪽 지연(p99)이 초 단위로 튄다', '클라이언트는 이미 타임아웃으로 떠났는데 서버가 그 요청을 뒤늦게 처리하고 있다'],
      check: '유입률과 처리율을 같은 그래프에 놓고, 큐 길이와 큐 대기 시간을 함께 봅니다. 힙 덤프에서 배열·버퍼·대기 중인 Promise가 대부분을 차지하는지 확인합니다.',
      fix: '모든 큐와 버퍼에 상한을 두고 가득 찼을 때의 동작(대기·거절·버림)을 정합니다. 스트림은 pipeline이나 for await로 연결해 느린 쪽의 속도가 앞으로 전달되게 합니다.',
    },
  });

  /* ---------- CPU 작업을 워커로 분리 ---------- */
  const WK_TOTAL = 80, WK_HEAVY = 60, WK_LIGHT = 5, WK_MSG = 1;
  const WK_REQ = [['B', 10], ['C', 20], ['D', 30]];
  const LMAX = '가벼운 요청의 최대 응답 시간 (ms)', AMS = '무거운 요청 A의 응답 시간 (ms)', BLOCK = '이벤트 루프가 막힌 최장 시간 (ms)';
  const wkInit = (t) => { t.m[LMAX] = 0; t.m[AMS] = 0; t.m[BLOCK] = 0; };
  const wkPanels = (rows, running, waiting) => [
    { type: 'timeline', total: WK_TOTAL, title: `시간 축 → (가정: 무거운 계산 ${WK_HEAVY}ms, 가벼운 요청 ${WK_LIGHT}ms, 전체 폭 ${WK_TOTAL}ms) · 막대 = 도착부터 응답까지`, items: rows.map((x) => ({ ...x })) },
    { type: 'cells', title: '메인 스레드(이벤트 루프)가 지금 실행 중인 것', items: [{ id: 'run', v: running || '한가함 (다음 이벤트 대기)', s: running ? 'active' : '' }] },
    { type: 'cells', title: '도착했지만 실행되지 못하고 기다리는 콜백', items: waiting.map((v) => ({ id: v, v: `요청 ${v}`, s: 'bad' })) },
  ];
  CS.add({
    id: 'worker-offload', level: 'adv', topic: 'conc',
    title: '워커 스레드: 무거운 계산이 서버 전체를 멈출 때',
    summary: '이벤트 루프는 스레드 하나로 모든 요청의 콜백을 차례로 실행합니다. 그중 하나가 CPU를 60ms 동안 붙잡으면 그동안 도착한 다른 요청은 아무리 가벼워도 시작조차 못 합니다. 같은 계산을 워커 스레드로 옮겼을 때 다른 요청의 응답 시간이 어떻게 달라지는지 봅니다.',
    headline: LMAX,
    verdict: '가벼운 요청의 응답 시간이 55ms에서 5ms로 줄었습니다. 무거운 요청 A는 60ms에서 62ms로 오히려 조금 늘었습니다. 워커는 계산을 빠르게 하지 않습니다. 계산하는 동안 이벤트 루프를 비워서, 한 요청의 CPU 작업이 다른 모든 요청의 지연이 되는 것을 막습니다.',
    variants: [
      {
        name: '메인 스레드에서 계산', tone: 'bad', label: '이벤트 루프를 막음', big: { time: '다른 요청이 계산 시간만큼 대기', space: '–' },
        code: `app.get('/report', (req, res) => {
  const result = heavyCompute(req.query);  // CPU를 60ms 붙잡음
  res.json(result);
});
app.get('/health', (req, res) => {
  res.send('ok');                          // 원래 5ms면 끝나는 일
});`,
        notes: { 2: '끝날 때까지 다른 콜백 실행 불가', 6: '차례가 와야 실행됨' },
        run(t) {
          wkInit(t);
          const rows = [{ id: 'A', label: 'A (/report)', start: 0, len: 1, s: 'active', text: '' }], waiting = [];
          const row = (id) => rows.find((x) => x.id === id);
          t.step(1, `요청 A(<code>/report</code>)가 도착했습니다. 이벤트 루프가 이 콜백을 꺼내 실행합니다.`, wkPanels(rows, 'A의 콜백', waiting));
          Object.assign(row('A'), { len: 5, text: '계산 중' });
          t.step(2, `<code>heavyCompute()</code>가 시작됩니다. 동기 코드이므로 끝날 때까지 메인 스레드는 다른 일을 하지 못합니다.`, wkPanels(rows, 'heavyCompute()', waiting));
          for (const [id, at] of WK_REQ) {
            row('A').len = at;
            for (const [o, oat] of WK_REQ) if (oat < at) row(o).len = at - oat;
            rows.push({ id, label: `${id} (${at}ms 도착)`, start: at, len: 1, s: 'active', text: '' });
            waiting.push(id);
            t.step(2, `${at}ms — 가벼운 요청 ${id}가 도착했습니다. 네트워크로는 이미 받았지만, 콜백을 실행할 메인 스레드가 계산 중이라 <b>줄만 섭니다.</b>`, wkPanels(rows, 'heavyCompute()', waiting));
          }
          Object.assign(row('A'), { len: WK_HEAVY, s: 'bad', text: `${WK_HEAVY}ms` });
          for (const [o, oat] of WK_REQ) row(o).len = WK_HEAVY - oat;
          t.m[AMS] = WK_HEAVY; t.m[BLOCK] = WK_HEAVY;
          t.step(3, `${WK_HEAVY}ms — 계산이 끝나 A에 응답합니다. 이벤트 루프가 <b>${WK_HEAVY}ms 동안</b> 막혀 있었습니다. 이제야 기다리던 콜백을 꺼낼 수 있습니다.`, wkPanels(rows, 'res.json()', waiting));
          let now = WK_HEAVY;
          for (const [id, at] of WK_REQ) {
            waiting.shift();
            now += WK_LIGHT;
            for (const [o, oat] of WK_REQ) if (row(o).s === 'active') row(o).len = now - oat;
            Object.assign(row(id), { len: now - at, s: 'bad', text: `${now - at}ms` });
            t.m[LMAX] = Math.max(t.m[LMAX], now - at);
            t.step(6, `${now}ms — 요청 ${id}를 처리해 응답합니다. 일은 ${WK_LIGHT}ms짜리인데 응답까지 <b>${now - at}ms</b> 걸렸습니다. 나머지는 전부 기다린 시간입니다.`, wkPanels(rows, waiting.length ? `요청 ${waiting[0]}의 콜백` : '', waiting));
          }
          t.step(7, `가벼운 요청 셋이 A의 계산 때문에 최대 <b>${t.m[LMAX]}ms</b>를 썼습니다. 헬스 체크가 이 줄에 서면 정상인 서버가 "응답 없음"으로 판정됩니다.`, wkPanels(rows, '', waiting));
        },
      },
      {
        name: '워커 스레드로 분리', tone: 'good', label: '이벤트 루프를 비움', big: { time: '다른 요청은 대기 없음', space: '워커 메모리 + 복사 비용' },
        code: `const worker = new Worker('./heavy.js');   // 미리 띄워 둔 워커
function runInWorker(input) {              // 예시: 한 번에 한 건
  return new Promise((resolve) => {
    worker.once('message', resolve);       // 결과가 오면 이어서
    worker.postMessage(input);             // 입력을 복사해 보냄
  });
}
app.get('/report', async (req, res) => {
  res.json(await runInWorker(req.query));
});
app.get('/health', (req, res) => res.send('ok'));`,
        notes: { 5: '계산은 다른 스레드에서', 8: '기다리는 동안 메인은 다른 요청 처리' },
        run(t) {
          wkInit(t);
          const rows = [{ id: 'A', label: 'A (/report)', start: 0, len: 1, s: 'active', text: '' }];
          const row = (id) => rows.find((x) => x.id === id);
          t.step(7, `같은 요청 A가 도착했습니다. 이번에는 계산을 직접 하지 않고 워커에 맡깁니다.`, wkPanels(rows, 'A의 콜백', []));
          rows.unshift({ id: 'W', label: '워커 스레드', start: WK_MSG, len: 4, s: 'active', text: '계산 중' });
          row('A').len = 5;
          t.m[BLOCK] = WK_MSG;
          t.step(5, `<code>postMessage</code>로 입력을 넘깁니다(복사에 약 ${WK_MSG}ms 가정). 계산은 <b>다른 스레드</b>에서 돌고, 메인 스레드는 <code>await</code>에서 빠져나와 한가해집니다.`, wkPanels(rows, '', []));
          for (const [id, at] of WK_REQ) {
            row('W').len = at - WK_MSG; row('A').len = at;
            rows.push({ id, label: `${id} (${at}ms 도착)`, start: at, len: 1, s: 'active', text: '' });
            t.step(10, `${at}ms — 가벼운 요청 ${id}가 도착했습니다. 메인 스레드가 비어 있으므로 <b>바로 실행</b>합니다. 워커는 옆에서 계속 계산 중입니다.`, wkPanels(rows, `요청 ${id}의 콜백`, []));
            row('W').len = at + WK_LIGHT - WK_MSG; row('A').len = at + WK_LIGHT;
            Object.assign(row(id), { len: WK_LIGHT, s: 'done', text: `${WK_LIGHT}ms` });
            t.m[LMAX] = Math.max(t.m[LMAX], WK_LIGHT); t.m[BLOCK] = Math.max(t.m[BLOCK], WK_LIGHT);
            t.step(10, `${at + WK_LIGHT}ms — 요청 ${id}에 응답했습니다. 걸린 시간은 일한 시간 그대로 <b>${WK_LIGHT}ms</b>입니다.`, wkPanels(rows, '', []));
          }
          Object.assign(row('W'), { len: WK_HEAVY, s: 'done', text: `계산 ${WK_HEAVY}ms` });
          row('A').len = WK_MSG + WK_HEAVY;
          t.step(4, `${WK_MSG + WK_HEAVY}ms — 워커가 계산을 끝내고 결과를 메시지로 보냅니다. 메인 스레드에서 <code>await</code> 뒤의 코드가 이어집니다.`, wkPanels(rows, '결과 수신', []));
          const aEnd = WK_MSG + WK_HEAVY + WK_MSG;
          Object.assign(row('A'), { len: aEnd, s: 'done', text: `${aEnd}ms` });
          t.m[AMS] = aEnd;
          t.step(8, `${aEnd}ms — A에 응답합니다. 계산 ${WK_HEAVY}ms에 주고받는 비용이 붙어 <b>${aEnd}ms</b>입니다. A 자신은 빨라지지 않았습니다.`, wkPanels(rows, 'res.json()', []));
          t.step(10, `가벼운 요청은 모두 <b>${t.m[LMAX]}ms</b>에 끝났고, 이벤트 루프가 한 번에 막힌 시간은 최대 ${t.m[BLOCK]}ms입니다.`, wkPanels(rows, '', []));
        },
      },
    ],
    points: [
      '<code>await</code>가 도움이 되는 것은 <b>기다리는 일</b>(네트워크, 디스크)뿐입니다. CPU를 쓰는 계산은 <code>async</code> 함수 안에 넣어도 그대로 메인 스레드를 붙잡습니다.',
      '워커는 별도의 스레드와 별도의 메모리를 가집니다. 데이터는 메시지로 복사해 주고받으므로, 큰 데이터는 복사 비용이 계산 비용보다 클 수 있습니다. 소유권을 넘기는 전송(transfer)이나 공유 메모리로 줄입니다.',
      '워커를 요청마다 새로 만들면 시작 비용이 큽니다. CPU 코어 수만큼 미리 만들어 두고 돌려 쓰는 <b>워커 풀</b>을 씁니다. 풀의 대기열에도 상한이 필요합니다.',
      '워커로 옮기기 어렵다면 계산을 잘게 쪼개 중간중간 이벤트 루프에 차례를 돌려주는 방법이 있습니다. 전체 시간은 늘지만 다른 요청이 끼어들 수 있습니다.',
    ],
    senior: '증상은 "특정 API가 호출될 때 무관한 API까지 같이 느려지는" 형태입니다. 원인은 흔히 큰 JSON의 파싱·직렬화, 이미지·PDF 처리, 압축, 동기식 암호 해시, 수만 건의 정렬·집계입니다. 평균 응답 시간에는 잘 드러나지 않고 p99와 이벤트 루프 지연에 나타납니다. Node.js에서는 <code>perf_hooks</code>의 <code>monitorEventLoopDelay()</code>로 지연을 지표로 남기고, CPU 프로파일에서 긴 동기 구간을 찾습니다. 처방은 일의 성격에 따라 다릅니다. 수십~수백 ms의 계산은 워커 풀로, 초 단위 이상이거나 실패 시 재시도가 필요한 일은 작업 큐와 별도 프로세스로 뺍니다. 워커 수를 코어 수보다 많이 늘려도 CPU 작업은 빨라지지 않습니다. 브라우저에서도 같은 구조입니다. 50ms를 넘는 작업(long task)은 입력 반응을 늦추고, 2024년 3월부터 핵심 웹 지표가 된 INP(Interaction to Next Paint)에 그대로 반영됩니다. 웹 워커로 옮기거나 작업을 쪼개 양보합니다. 양보용 API인 <code>scheduler.yield()</code>는 2026년 기준 Chrome·Edge·Firefox에서 지원하고 Safari는 지원하지 않으므로, 없을 때는 <code>setTimeout</code>으로 대체하는 분기가 필요합니다.',
    qa: [
      ['Node.js는 비동기인데 왜 요청 하나가 서버 전체를 느리게 만들 수 있습니까?', 'Node.js의 비동기는 I/O를 기다리는 동안 스레드를 놓아주는 것이지, JavaScript 코드를 여러 스레드에서 실행하는 것이 아닙니다. 모든 콜백은 이벤트 루프 스레드 하나에서 차례로 실행됩니다. 한 콜백이 CPU 계산으로 100ms를 쓰면 그동안 다른 요청의 콜백, 타이머, 응답 쓰기가 전부 밀립니다.'],
      ['CPU를 많이 쓰는 작업은 어떻게 처리합니까?', '이벤트 루프 밖으로 뺍니다. 짧은 계산은 워커 스레드 풀에 넘기고 결과를 Promise로 받습니다. 길거나 재시도가 필요한 작업은 큐에 넣고 별도 워커 프로세스가 처리하게 합니다. 옮기기 어려우면 작업을 작은 조각으로 나누어 조각 사이에 이벤트 루프에 양보합니다. 어느 쪽이든 동시에 도는 작업 수와 대기열 길이에 상한을 둡니다.'],
      ['워커 스레드를 쓰면 항상 빨라집니까?', '아닙니다. 계산 자체는 같은 시간이 걸리고, 데이터를 메시지로 복사해 주고받는 비용과 워커 시작 비용이 더해집니다. I/O 위주의 작업은 이미 비동기로 처리되므로 워커로 옮겨도 얻는 것이 없습니다. 워커의 이점은 메인 스레드가 막히지 않는다는 것과 여러 코어를 쓸 수 있다는 것입니다.'],
    ],
    dx: {
      cat: ['hang', 'slow'], concept: 'CPU 바운드 작업의 이벤트 루프 점유',
      symptoms: ['특정 API(리포트 생성, 파일 변환 등)가 호출될 때마다 무관한 다른 API의 응답도 함께 느려진다', 'CPU 한 코어만 100%이고 나머지는 한가한데 처리량이 떨어진다', '헬스 체크가 간헐적으로 타임아웃 나서 정상인 인스턴스가 재시작된다', '브라우저에서 버튼을 눌러도 한참 뒤에 반응하고 스크롤이 끊긴다'],
      check: '이벤트 루프 지연(Node.js의 monitorEventLoopDelay, 브라우저의 long task)을 재고, CPU 프로파일에서 한 번에 수십 ms 이상 이어지는 동기 구간을 찾습니다. 느린 요청의 시각과 무거운 요청의 시각이 겹치는지 봅니다.',
      fix: 'CPU 작업을 워커 스레드 풀이나 별도 프로세스(작업 큐)로 옮깁니다. 옮기기 어렵다면 작업을 쪼개 중간에 이벤트 루프에 양보하고, 입력 크기에 상한을 둡니다.',
    },
  });
})();
