/* 심화: CPU 캐시, 이벤트 루프, 가비지 컬렉션 */
(function () {
  const CS = window.CS;

  /* ---------- 8. CPU 캐시와 메모리 지역성 ---------- */
  const N = 8, LINE = 4, CAP = 4, HIT_NS = 1, MISS_NS = 100;
  const cacheRun = (rowMajor) => (t) => {
    const cache = [], seen = new Set();
    t.m['캐시 미스'] = 0; t.m['캐시 히트'] = 0; t.m['추정 시간 (ns)'] = 0;
    const lineOf = (r, c) => r * (N / LINE) + Math.floor(c / LINE);
    const name = (l) => { const r = Math.floor(l / 2), c = (l % 2) * LINE; return `m[${r}][${c}..${c + LINE - 1}]`; };
    const snap = (cr, cc, res) => [
      {
        type: 'cells', cols: N, tiny: true, title: `메모리 속 8×8 행렬 — 가로 ${LINE}칸이 캐시 라인 1개 (한 번에 통째로 읽어 옴)`,
        items: Array.from({ length: N * N }, (_, k) => {
          const r = Math.floor(k / N), c = k % N;
          return { id: k, v: '', gap: c === LINE - 1, s: r === cr && c === cc ? res : cache.includes(lineOf(r, c)) ? 'cmp' : seen.has(k) ? 'dim' : '' };
        }),
      },
      { type: 'cells', title: `CPU 캐시 (라인 ${CAP}개만 들어감) — 파란 칸이 지금 캐시에 있는 데이터`, items: cache.map((l) => ({ id: l, v: name(l), s: 'cmp' })) },
    ];
    const outer = rowMajor ? 'r' : 'c';
    t.step(1, `8×8 행렬의 모든 값을 더합니다. 두 코드는 <b>루프 순서만</b> 다릅니다.`, snap(-1, -1));
    for (let a = 0; a < N; a++) {
      t.step(2, `<code>${outer} = ${a}</code> — ${rowMajor ? '이 행을 왼쪽에서 오른쪽으로 읽습니다. 메모리에 놓인 순서 그대로입니다.' : '이 열을 위에서 아래로 읽습니다. 한 칸 읽을 때마다 메모리를 8칸씩 건너뜁니다.'}`, snap(-1, -1));
      for (let b = 0; b < N; b++) {
        const [r, c] = rowMajor ? [a, b] : [b, a];
        const l = lineOf(r, c), at = cache.indexOf(l);
        seen.add(r * N + c);
        if (at >= 0) {
          cache.splice(at, 1); cache.push(l);
          t.m['캐시 히트']++; t.m['추정 시간 (ns)'] += HIT_NS;
          t.step(4, `<code>m[${r}][${c}]</code> — <b>캐시 히트.</b> 직전에 라인째 읽어 온 덕분에 이미 캐시에 있습니다. (~${HIT_NS}ns)`, snap(r, c, 'hit'));
        } else {
          if (cache.length === CAP) cache.shift();
          cache.push(l);
          t.m['캐시 미스']++; t.m['추정 시간 (ns)'] += MISS_NS;
          t.step(4, `<code>m[${r}][${c}]</code> — <b>캐시 미스.</b> RAM까지 다녀와야 합니다. (~${MISS_NS}ns) ${name(l)} 라인을 통째로 캐시에 올립니다.`, snap(r, c, 'miss'));
        }
      }
    }
    t.step(6, `합계 완료. 덧셈은 똑같이 64번 했지만 추정 시간은 <b>${t.m['추정 시간 (ns)'].toLocaleString()}ns</b>입니다.`, snap(-1, -1));
  };
  const loopCode = (a, b) => `let sum = 0;
for (let ${a} = 0; ${a} < N; ${a}++) {
  for (let ${b} = 0; ${b} < N; ${b}++) {
    sum += m[r][c];
  }
}`;
  CS.add({
    id: 'cache-locality', level: 'adv',
    title: 'CPU 캐시와 메모리 지역성',
    summary: '두 코드는 Big-O가 완전히 같습니다. for문 두 줄의 순서만 다릅니다. 그런데 하드웨어 입장에서는 전혀 다른 프로그램입니다.',
    headline: '추정 시간 (ns)',
    verdict: '같은 O(n²), 같은 64번의 덧셈인데 메모리를 읽는 순서 때문에 몇 배씩 차이가 납니다. Big-O는 "메모리 접근 한 번의 비용이 같다"고 가정하지만 실제 하드웨어는 그렇지 않습니다.',
    variants: [
      {
        name: '열 우선 순회 (세로로 읽기)', tone: 'bad', big: { time: 'O(n²)', space: 'O(1)' },
        code: loopCode('c', 'r'), notes: { 4: '매번 다른 캐시 라인' }, run: cacheRun(false),
      },
      {
        name: '행 우선 순회 (가로로 읽기)', tone: 'good', big: { time: 'O(n²)', space: 'O(1)' },
        code: loopCode('r', 'c'), notes: { 4: '4번 중 3번은 히트' }, run: cacheRun(true),
      },
    ],
    points: [
      'CPU는 메모리를 한 칸씩이 아니라 <b>캐시 라인(보통 64바이트) 단위</b>로 읽어 옵니다. 옆 칸을 곧 쓸 거라고 기대하기 때문입니다.',
      'L1 캐시 히트는 약 1ns, RAM 접근은 약 100ns입니다. 미스 한 번이 덧셈 100번 값입니다.',
      '이 데모는 원리를 보이려고 캐시를 아주 작게 잡았습니다. 실제로는 행렬이 캐시보다 클 때 같은 현상이 납니다.',
    ],
    senior: '연결 리스트가 Big-O는 좋아도 배열에 지는 이유, 객체 배열보다 필드별 배열(Struct of Arrays)이 빠른 이유, 컬럼형 DB가 분석 쿼리에 강한 이유가 전부 이것입니다. 성능이 정말 중요한 경로에서는 "어떤 순서로 메모리를 건드리는가"가 알고리즘 선택만큼 중요합니다. 단, 추측하지 말고 프로파일러로 먼저 재세요.',
  });

  /* ---------- 9. 이벤트 루프 ---------- */
  CS.add({
    id: 'event-loop', level: 'adv',
    title: '이벤트 루프: 코드는 쓰인 순서대로 실행되지 않는다',
    summary: 'JavaScript는 스레드가 하나입니다. setTimeout과 Promise 콜백은 각자 다른 대기열에 들어가고, 이벤트 루프가 정해진 규칙대로 꺼내 실행합니다. 출력 순서를 예측해 보세요.',
    verdict: '출력은 A → E → C → D → B 입니다. 동기 코드가 전부 끝나고, 마이크로태스크를 전부 비운 뒤에야 setTimeout 콜백 차례가 옵니다. 0ms는 "즉시"가 아닙니다.',
    variants: [{
      name: '실행 순서 추적', tone: 'info',
      code: `console.log('A');
setTimeout(() => console.log('B'), 0);
Promise.resolve().then(() => console.log('C'));
queueMicrotask(() => console.log('D'));
console.log('E');`,
      notes: { 2: '태스크 큐로', 3: '마이크로태스크 큐로', 4: '마이크로태스크 큐로' },
      run(t) {
        const stack = [], micro = [], macro = [], out = [];
        t.m['실행한 콜백'] = 0;
        const item = (v, s) => ({ id: v, v, s });
        const snap = () => [
          { type: 'stack', title: '콜 스택 — 지금 실행 중인 코드', items: stack.map((v) => item(v, 'active')) },
          { type: 'cells', title: '마이크로태스크 큐 (Promise.then, queueMicrotask) — 스택이 비면 전부 실행', items: micro.map((v) => item(v, 'new')) },
          { type: 'cells', title: '태스크 큐 (setTimeout, I/O, 클릭) — 한 바퀴에 하나씩', items: macro.map((v) => item(v, 'cmp')) },
          { type: 'cells', title: '콘솔 출력', items: out.map((v) => item(v, 'done')) },
        ];
        stack.push('<script>');
        t.step(0, `스크립트 전체가 하나의 태스크로 콜 스택에 올라갑니다.`, snap());
        stack.push("log('A')"); out.push('A');
        t.step(1, `동기 코드 — 바로 실행됩니다. <b>A</b> 출력.`, snap()); stack.pop();
        stack.push('setTimeout'); macro.push("log('B')");
        t.step(2, `<code>setTimeout</code>은 콜백을 지금 실행하지 않습니다. 타이머(0ms)가 끝나면 콜백이 <b>태스크 큐</b>에 들어갑니다.`, snap()); stack.pop();
        stack.push('then'); micro.push("log('C')");
        t.step(3, `이미 이행된 Promise의 <code>then</code> 콜백은 <b>마이크로태스크 큐</b>에 들어갑니다. 역시 지금 실행하지 않습니다.`, snap()); stack.pop();
        stack.push('queueMicrotask'); micro.push("log('D')");
        t.step(4, `<code>queueMicrotask</code> 콜백도 마이크로태스크 큐 뒤에 줄을 섭니다.`, snap()); stack.pop();
        stack.push("log('E')"); out.push('E');
        t.step(5, `동기 코드 — 바로 실행됩니다. <b>E</b> 출력. B, C, D보다 먼저입니다.`, snap()); stack.pop();
        stack.pop();
        t.step(0, `스크립트가 끝나 콜 스택이 비었습니다. 이벤트 루프는 다음 태스크로 가기 전에 <b>마이크로태스크 큐를 전부</b> 비웁니다.`, snap());
        micro.shift(); stack.push("log('C')"); out.push('C'); t.m['실행한 콜백']++;
        t.step(3, `마이크로태스크 실행 — <b>C</b> 출력.`, snap()); stack.pop();
        micro.shift(); stack.push("log('D')"); out.push('D'); t.m['실행한 콜백']++;
        t.step(4, `마이크로태스크 실행 — <b>D</b> 출력. 큐가 빌 때까지 계속합니다.`, snap()); stack.pop();
        t.step(0, `마이크로태스크 큐가 비었습니다. 브라우저는 여기서 화면을 다시 그릴 기회를 얻고, 그다음 태스크 큐에서 <b>하나</b>를 꺼냅니다.`, snap());
        macro.shift(); stack.push("log('B')"); out.push('B'); t.m['실행한 콜백']++;
        t.step(2, `태스크 실행 — 가장 먼저 등록했던 <b>B</b>가 가장 늦게 출력됩니다.`, snap()); stack.pop();
        t.step(0, `최종 출력: <b>A → E → C → D → B</b>`, snap());
      },
    }],
    points: [
      '우선순위: ① 콜 스택의 동기 코드 → ② 마이크로태스크 전부 → ③ (렌더링) → ④ 태스크 하나 → 다시 ②.',
      '<code>await</code> 뒤의 코드는 <code>then</code> 콜백과 같습니다. 즉 마이크로태스크로 실행됩니다.',
      '콜 스택이 비지 않으면 아무것도 끼어들 수 없습니다. 무거운 동기 루프 하나가 클릭, 렌더링, 타이머를 전부 멈춥니다.',
    ],
    senior: 'Node.js 서버에서 이 구조는 곧 처리량 문제입니다. 요청 하나가 50ms짜리 동기 작업(큰 JSON.parse, 동기 암호화, 정규식 백트래킹)을 하면 그동안 다른 모든 요청이 멈춥니다. 평균은 멀쩡한데 p99 지연이 튀는 원인 1순위입니다. 이벤트 루프 지연(lag)을 지표로 수집하고, CPU 작업은 워커 스레드나 별도 프로세스로 빼세요. 마이크로태스크가 마이크로태스크를 끝없이 만들면 태스크 큐가 굶는다는 점도 기억하세요.',
  });

  /* ---------- 10. 가비지 컬렉션 ---------- */
  CS.add({
    id: 'gc', level: 'adv',
    title: '가비지 컬렉션: Mark & Sweep',
    summary: '안 쓰는 메모리는 누가 치울까요? GC는 "루트에서 따라갈 수 있는 객체"만 살리고 나머지를 해제합니다. 서로를 참조하는 쓰레기도 놓치지 않는 이유, 그리고 메모리 누수가 생기는 이유를 봅니다.',
    verdict: 'GC가 보는 기준은 "쓸 예정인가"가 아니라 "루트에서 닿는가"입니다. 그래서 다시는 쓰지 않을 객체라도 어딘가에서 참조하고 있으면 영원히 해제되지 않습니다. 그것이 GC 언어의 메모리 누수입니다.',
    variants: [{
      name: 'Mark & Sweep 추적', tone: 'info', big: { time: 'O(살아 있는 객체 + 힙 크기)', space: 'O(n)' },
      code: `function gc(roots, heap) {
  const stack = [...roots];
  while (stack.length) {
    const obj = stack.pop();
    if (obj.marked) continue;
    obj.marked = true;
    stack.push(...obj.refs);
  }
  for (const obj of heap) {
    if (!obj.marked) free(obj);
    else obj.marked = false;
  }
}`,
      notes: { 3: 'Mark: 닿는 객체 표시', 9: 'Sweep: 힙 전체 훑기' },
      run(t) {
        const P = { stack: [50, 26], global: [50, 130], A: [150, 26], B: [250, 26], C: [250, 78], D: [150, 130], E: [370, 26], F: [470, 26], G: [370, 104], H: [470, 104] };
        const refs = { stack: ['A'], global: ['D'], A: ['B', 'C'], B: [], C: [], D: ['C'], E: ['F'], F: ['E'], G: ['B'], H: [] };
        const heap = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
        const st = {}, freed = new Set();
        t.m['표시한 객체'] = 0; t.m['해제한 객체'] = 0; t.m['일시 정지 시간 (단계)'] = 0;
        const snap = (cur) => [{
          type: 'graph', directed: true, w: 520, h: 156, scale: 1.5,
          title: '힙의 객체와 참조 — 왼쪽 두 개가 루트(스택 변수, 전역 변수)',
          nodes: Object.keys(P).map((id) => ({
            id, v: id, x: P[id][0], y: P[id][1], w: id.length > 1 ? 52 : 32, round: id.length === 1,
            s: freed.has(id) ? 'gone' : id === cur ? 'active' : id.length > 1 ? 'cmp' : st[id] || '',
          })),
          edges: Object.entries(refs).flatMap(([a, bs]) => bs.map((b) => ({ a, b, s: freed.has(a) ? 'dim' : '' }))),
        }];
        const step = (line, msg, cur) => { t.m['일시 정지 시간 (단계)']++; t.step(line, msg, snap(cur)); };
        t.step(1, `GC 시작. 이 동안 프로그램은 <b>멈춥니다</b>(Stop-the-World). E↔F는 서로를 참조하지만 루트에서 닿지 않습니다.`, snap());
        const stack = ['A', 'D'];
        step(2, `루트(스택, 전역)가 직접 가리키는 객체 A, D에서 출발합니다.`);
        while (stack.length) {
          const obj = stack.pop();
          if (st[obj]) { step(5, `<code>${obj}</code> — 이미 표시했습니다. 건너뜁니다. (순환 참조에서 무한 루프를 막는 장치)`, obj); continue; }
          st[obj] = 'done'; t.m['표시한 객체']++;
          step(6, `<code>${obj}</code>에 <b>도달</b> → 살아 있음으로 표시.`, obj);
          if (refs[obj].length) {
            stack.push(...refs[obj]);
            step(7, `<code>${obj}</code>가 참조하는 ${refs[obj].join(', ')}도 확인 대상에 넣습니다.`, obj);
          }
        }
        step(9, `Mark 끝. 초록색이 아닌 객체는 어떤 루트에서도 닿을 수 없습니다. 이제 힙 전체를 훑습니다.`);
        for (const obj of heap) {
          if (!st[obj]) {
            freed.add(obj); t.m['해제한 객체']++;
            step(10, `<code>${obj}</code> — 표시 없음 → <b>해제.</b>${obj === 'E' || obj === 'F' ? ' 서로 참조하고 있어도 소용없습니다.' : obj === 'G' ? ' 살아 있는 B를 가리키고 있어도 자신은 쓰레기입니다.' : ''}`, obj);
          } else {
            step(11, `<code>${obj}</code> — 표시 있음 → 유지. 다음 GC를 위해 표시를 지웁니다.`, obj);
          }
        }
        t.step(13, `GC 완료. ${t.m['해제한 객체']}개를 해제했고, 프로그램이 다시 실행됩니다.`, snap());
      },
    }],
    points: [
      '참조 카운팅만으로는 E↔F 같은 <b>순환 참조</b>를 해제하지 못합니다. 도달 가능성 기반 GC는 이를 처리합니다.',
      'Mark 비용은 살아 있는 객체 수에 비례합니다. 살아 있는 객체가 많을수록 GC가 느려집니다.',
      '실제 엔진(V8, JVM)은 "대부분의 객체는 금방 죽는다"는 관찰을 이용해 젊은 객체만 자주 검사하는 세대별 GC를 씁니다.',
    ],
    senior: '운영에서 만나는 누수는 대부분 "잊힌 루트"입니다: 해제하지 않은 이벤트 리스너와 타이머, 계속 커지는 모듈 전역 Map 캐시, 큰 객체를 붙잡고 있는 클로저. 힙 스냅샷을 두 번 떠서 늘어난 객체의 retainer 경로를 따라가면 찾을 수 있습니다. 또 GC 일시 정지는 p99 지연으로 나타납니다. 요청마다 임시 객체를 대량으로 만드는 코드는 CPU 프로파일에는 안 보여도 GC 로그에는 보입니다.',
  });
})();
