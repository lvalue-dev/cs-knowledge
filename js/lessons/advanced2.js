/* 심화(실전): 클로저, 정규식 백트래킹, 순차 await vs 병렬 */
(function () {
  const CS = window.CS;

  /* ---------- 클로저 ---------- */
  const closureRun = (perIter) => (t) => {
    t.m['의도와 다른 출력'] = 0;
    const fns = [], out = [];
    let shared = 0;
    const snap = (hot, running) => [
      {
        type: 'graph', directed: true, w: 420, h: 150, scale: 1.5,
        title: perIter ? '반복마다 새 변수 i가 만들어지고, 콜백은 각자 자기 것을 가리킵니다' : '변수 i는 단 하나. 콜백 셋이 모두 같은 변수를 가리킵니다',
        nodes: [
          ...fns.map((k) => ({ id: 'f' + k, v: `콜백 ${k + 1}`, x: 70, y: 26 + k * 48, w: 66, s: running === k ? 'active' : 'cmp' })),
          ...(perIter
            ? fns.map((k) => ({ id: 'i' + k, v: `i = ${k}`, x: 300, y: 26 + k * 48, w: 60, s: hot === k ? 'active' : 'new' }))
            : [{ id: 'i', v: `i = ${shared}`, x: 300, y: 74, w: 60, s: hot != null ? 'active' : 'new' }]),
        ],
        edges: fns.map((k) => ({ a: 'f' + k, b: perIter ? 'i' + k : 'i', s: running === k ? 'active' : '' })),
      },
      { type: 'cells', title: '콘솔 출력', items: out.map((v, k) => ({ id: k, v, s: perIter ? 'done' : 'bad' })) },
    ];
    t.step(1, perIter ? `<code>let</code>은 반복할 때마다 <b>새로운 i</b>를 만듭니다.` : `<code>var</code>로 선언한 i는 루프 전체에서 <b>하나뿐</b>입니다.`, snap(perIter ? null : 0));
    for (let k = 0; k < 3; k++) {
      fns.push(k);
      t.step(2, `i = ${k} — 콜백을 등록합니다. 콜백은 i의 <b>값 ${k}을 복사해 가는 것이 아니라</b> 변수 i를 가리키는 연결만 갖습니다.`, snap(k));
      shared = k + 1;
      t.step(1, perIter ? `<code>i++</code> — 다음 반복용 i가 새로 만들어집니다. 앞의 콜백이 가리키는 i는 그대로 ${k}입니다.` : `<code>i++</code> — 하나뿐인 i가 <b>${shared}</b>이 됩니다. 이미 등록된 콜백들도 이 변수를 보고 있습니다.`, snap(perIter ? null : 0));
    }
    t.step(3, `루프가 끝났습니다. 이제 타이머 콜백들이 차례로 실행됩니다.${perIter ? '' : ' 이 시점의 i는 <b>3</b>입니다.'}`, snap(perIter ? null : 0));
    for (let k = 0; k < 3; k++) {
      const v = perIter ? k : shared;
      out.push(v);
      if (!perIter) t.m['의도와 다른 출력']++;
      t.step(2, perIter ? `콜백 ${k + 1} 실행 — 자기 i를 읽습니다 → <b>${v}</b>` : `콜백 ${k + 1} 실행 — 지금 i를 읽습니다 → <b>${v}</b>. 등록할 때의 ${k}가 아닙니다.`, snap(perIter ? k : 0, k));
    }
    t.step(3, perIter ? `출력: <b>0, 1, 2</b>` : `출력: <b>3, 3, 3</b>. 콜백은 "만들어질 때의 값"이 아니라 "실행될 때의 변수"를 봅니다.`, snap());
  };
  const loopCode = (kw) => `for (${kw} i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0);
}`;
  CS.add({
    id: 'closure', level: 'adv',
    title: '클로저: 콜백이 옛날 값을 본다, 혹은 전부 같은 값을 본다',
    summary: '함수는 바깥 변수의 "값"이 아니라 "변수 자체"를 붙잡습니다. 이 한 가지 사실이 루프 안 콜백 버그와 React의 오래된 상태(stale closure) 버그를 모두 설명합니다.',
    verdict: '콜백이 이상한 값을 본다면 "이 함수가 붙잡은 변수는 언제 만들어진 어떤 변수인가"를 물어야 합니다. 같은 변수를 공유하면 전부 마지막 값을, 오래된 변수를 붙잡고 있으면 옛날 값을 봅니다.',
    variants: [
      { name: 'var: 변수 하나를 공유', tone: 'bad', label: '3, 3, 3 출력', code: loopCode('var'), notes: { 1: 'i는 하나뿐', 2: '값이 아니라 변수를 붙잡음' }, run: closureRun(false) },
      { name: 'let: 반복마다 새 변수', tone: 'good', label: '0, 1, 2 출력', code: loopCode('let'), notes: { 1: '반복마다 새 i' }, run: closureRun(true) },
    ],
    points: [
      '클로저 = 함수 + 그 함수가 만들어진 곳의 변수들. 함수가 살아 있는 한 그 변수들도 살아 있습니다.',
      '비동기 콜백은 <b>나중에</b> 실행됩니다. 그 사이 변수가 바뀌었으면 바뀐 값을 봅니다.',
      'Python의 루프 안 lambda, 예전 Go의 루프 변수 고루틴 캡처도 같은 버그입니다. 언어 공통 개념입니다.',
    ],
    senior: 'React에서는 정반대 방향으로 나타납니다. 렌더링마다 state가 새 변수이므로, <code>useEffect(() => { setInterval(() => setCount(count + 1), 1000) }, [])</code>의 콜백은 첫 렌더의 <code>count</code>(0)를 영원히 붙잡습니다. 그래서 카운터가 1에서 멈춥니다. 의존성 배열을 채우거나 <code>setCount(c => c + 1)</code>처럼 최신 값을 인자로 받는 형태로 바꿉니다. 또 클로저는 누수의 통로이기도 합니다. 이벤트 리스너나 타이머 콜백이 큰 객체를 붙잡고 있으면, 리스너를 해제하기 전까지 그 객체는 GC되지 않습니다.',
  });

  /* ---------- 정규식 백트래킹 ---------- */
  CS.add({
    id: 'regex-backtracking', level: 'adv',
    title: '정규식 백트래킹: 한 줄이 서버를 멈춘다',
    summary: '입력 검증용 정규식 하나가 특정 입력에서 CPU를 100% 붙잡고 끝나지 않는 일이 있습니다. 정규식 엔진이 "가능한 모든 나누는 방법"을 하나씩 시도하기 때문입니다. 글자가 하나 늘 때마다 시도 횟수가 두 배가 됩니다.',
    param: { label: "'a'의 개수 n", options: [4, 6, 8], value: 6 },
    headline: '엔진 내부 시도',
    verdict: '두 정규식은 같은 문자열을 받아들입니다. 차이는 "실패할 때"입니다. 중첩된 반복 (a+)+ 는 실패를 확인하려고 2ⁿ가지 분할을 전부 시도합니다. n = 30이면 10억 번입니다.',
    variants: [
      {
        name: '중첩 반복 (a+)+', tone: 'bad', label: '지수 폭발', big: { time: 'O(2ⁿ)', space: 'O(n)' },
        code: `function isValid(input) {
  return /^(a+)+$/.test(input);
}`,
        notes: { 2: '한 줄이지만 내부에서 2ⁿ번 시도' },
        run(t, n) {
          t.m['엔진 내부 시도'] = 0;
          const groups = [];
          const snap = (fail) => {
            const owner = []; groups.forEach((len, g) => { for (let i = 0; i < len; i++) owner.push(g); });
            return [{
              type: 'cells', title: `입력: 'a' ${n}개 뒤에 '!' — 색이 바뀌는 지점이 그룹 (a+)의 경계`,
              items: [...Array.from({ length: n }, (_, i) => ({ id: i, v: 'a', s: owner[i] === undefined ? '' : owner[i] % 2 ? 'new' : 'cmp' })), { id: 'x', v: '!', s: fail ? 'bad' : '', ptr: fail ? '$ 실패' : '' }],
            }];
          };
          t.step(1, `<code>aaaa…a!</code>를 검사합니다. 끝의 <b>!</b> 때문에 결과는 "불일치"여야 합니다. 문제는 엔진이 그걸 확신하기까지입니다.`, snap());
          const tryFrom = (pos) => {
            for (let len = n - pos; len >= 1; len--) {
              groups.push(len);
              if (pos + len < n) tryFrom(pos + len);
              t.m['엔진 내부 시도']++;
              t.step(2, `시도 #${t.m['엔진 내부 시도']}: <code>${groups.map((g) => '(' + 'a'.repeat(g) + ')').join('')}</code>로 나눠 봄 → 뒤에 <code>$</code>가 와야 하는데 ${pos + len < n ? "'a'" : "'!'"}가 있음. <b>되돌아가서</b> 다른 분할을 시도합니다.`, snap(pos + len === n));
              groups.pop();
            }
          };
          tryFrom(0);
          t.step(3, `<b>${t.m['엔진 내부 시도']}번</b> 시도한 끝에 false. 'a'가 하나 늘면 이 숫자는 두 배가 됩니다.`, snap(true));
        },
      },
      {
        name: '단순 반복 a+', tone: 'good', label: '선형', big: { time: 'O(n)', space: 'O(1)' },
        code: `function isValid(input) {
  return /^a+$/.test(input);
}`,
        notes: { 2: '나누는 방법이 하나뿐' },
        run(t, n) {
          t.m['엔진 내부 시도'] = 0;
          const snap = (taken, fail) => [{
            type: 'cells', title: `입력: 'a' ${n}개 뒤에 '!'`,
            items: [...Array.from({ length: n }, (_, i) => ({ id: i, v: 'a', s: i < taken ? 'cmp' : '' })), { id: 'x', v: '!', s: fail ? 'bad' : '', ptr: fail ? '$ 실패' : '' }],
          }];
          t.step(1, `같은 입력을 검사합니다. 이번에는 반복이 한 겹입니다.`, snap(0));
          t.m['엔진 내부 시도']++;
          t.step(2, `<code>a+</code>가 'a'를 전부 가져갑니다. 뒤에 <code>$</code>가 와야 하는데 '!'가 있습니다.`, snap(n, true));
          for (let k = n - 1; k >= 1; k--) {
            t.m['엔진 내부 시도']++;
            t.step(2, `한 글자 양보해서 ${k}개만 가져가 봅니다. 뒤가 'a'라서 역시 <code>$</code>가 아닙니다.`, snap(k, false));
          }
          t.step(3, `<b>${t.m['엔진 내부 시도']}번</b> 만에 false. 글자 수에 비례할 뿐입니다.`, snap(0, true));
        },
      },
    ],
    points: [
      '위험 신호는 <b>반복 안의 반복</b>(<code>(a+)+</code>, <code>(.*)*</code>)과 <b>겹치는 선택지</b>(<code>(a|a)+</code>, <code>(\\w+\\s?)+</code>)입니다.',
      '정상 입력에서는 빠릅니다. "거의 맞다가 끝에서 틀리는" 입력에서만 폭발해서 테스트로는 잘 안 잡힙니다.',
      'JS는 싱글 스레드라 정규식이 도는 동안 이벤트 루프 전체가 멈춥니다. 요청 하나가 서버 전체를 세웁니다.',
    ],
    senior: '사용자 입력을 정규식에 넣는 모든 곳이 공격 지점(ReDoS)입니다. 이메일·URL 검증, 마크다운 파싱, User-Agent 분석에서 실제 대형 장애들이 났습니다. 방어는 여러 겹으로 합니다: ① 입력 길이를 먼저 제한하고 ② 중첩 수량자를 풀어 쓰고 ③ 가능하면 정규식 대신 전용 파서나 선형 시간 엔진(RE2 계열)을 쓰고 ④ CPU 작업에 타임아웃을 둡니다. 증상은 "CPU 100% + 응답 없음 + 프로파일에서 RegExp 내부 함수가 대부분"입니다.',
  });

  /* ---------- 순차 await vs 병렬 ---------- */
  const CALLS = [['getUser', 30], ['getOrders', 50], ['getCoupons', 20]];
  const SEQ_TOTAL = CALLS.reduce((s, c) => s + c[1], 0);
  CS.add({
    id: 'async-parallel', level: 'adv',
    title: '순차 await vs 병렬: 기다림을 겹치기',
    summary: '서로 상관없는 요청 세 개를 await로 한 줄씩 쓰면, 앞의 것이 끝나야 다음 것을 보냅니다. 응답 시간이 세 요청의 합이 됩니다. 동시에 보내면 가장 느린 것 하나만큼만 걸립니다.',
    headline: '응답 시간 (ms)',
    verdict: '순차 실행은 합(30 + 50 + 20), 병렬 실행은 최댓값(50)입니다. I/O를 기다리는 동안 CPU는 놀고 있으므로, 독립적인 대기는 겹치는 것이 이득입니다.',
    variants: [
      {
        name: '한 줄씩 await', tone: 'bad', big: { time: '각 호출 시간의 합', space: '–' },
        code: `const user = await getUser(id);
const orders = await getOrders(id);
const coupons = await getCoupons(id);
return { user, orders, coupons };`,
        notes: { 1: '끝날 때까지 다음 줄 대기', 2: '앞 호출과 무관한데도 대기' },
        run(t) {
          t.m['응답 시간 (ms)'] = 0;
          const items = [];
          const snap = () => [{ type: 'timeline', total: SEQ_TOTAL, title: `시간 축 → (전체 폭 = ${SEQ_TOTAL}ms)`, items: items.map((x) => ({ ...x })) }];
          let now = 0;
          CALLS.forEach(([name, ms], i) => {
            items.forEach((x) => (x.s = 'done'));
            items.push({ id: name, label: name, start: now, len: ms, s: 'active', text: `${ms}ms` });
            now += ms; t.m['응답 시간 (ms)'] = now;
            t.step(i + 1, `<code>${name}</code> 요청을 보내고 응답을 기다립니다(${ms}ms).${i ? ' 앞 호출 결과가 필요하지도 않은데 끝나기를 기다렸다가 이제야 출발했습니다.' : ''}`, snap());
          });
          items.forEach((x) => (x.s = 'bad'));
          t.step(4, `세 요청이 줄을 서서 <b>${now}ms</b> 걸렸습니다.`, snap());
        },
      },
      {
        name: 'Promise.all로 동시에', tone: 'good', big: { time: '가장 느린 호출 하나', space: '–' },
        code: `const [user, orders, coupons] = await Promise.all([
  getUser(id),
  getOrders(id),
  getCoupons(id),
]);
return { user, orders, coupons };`,
        notes: { 1: '셋 다 끝날 때까지 한 번만 대기' },
        run(t) {
          t.m['응답 시간 (ms)'] = 0;
          const items = [];
          const snap = () => [{ type: 'timeline', total: SEQ_TOTAL, title: `시간 축 → (전체 폭 = ${SEQ_TOTAL}ms)`, items: items.map((x) => ({ ...x })) }];
          CALLS.forEach(([name, ms], i) => {
            items.push({ id: name, label: name, start: 0, len: ms, s: 'active', text: `${ms}ms` });
            t.step(i + 2, `<code>${name}</code> 요청을 보냅니다. <b>기다리지 않고</b> 바로 다음 줄로 넘어갑니다.`, snap());
          });
          t.m['응답 시간 (ms)'] = Math.max(...CALLS.map((c) => c[1]));
          items.forEach((x) => (x.s = 'done'));
          t.step(1, `세 요청이 동시에 진행됩니다. 가장 느린 getOrders가 끝나는 <b>${t.m['응답 시간 (ms)']}ms</b>에 전부 준비됩니다.`, snap());
          t.step(6, `같은 일을 절반 시간에 끝냈습니다. 서버가 한 일의 양은 같고, 기다림을 겹쳤을 뿐입니다.`, snap());
        },
      },
    ],
    points: [
      '<code>await</code>는 "여기서 멈추고 끝나면 이어서"입니다. 한 줄씩 쓰면 순차 실행이 됩니다.',
      '뒤 호출이 앞 호출의 <b>결과를 필요로 할 때만</b> 순차로 둡니다. 독립적이면 묶습니다.',
      '<code>Promise.all</code>은 하나라도 실패하면 즉시 실패합니다. 일부 실패를 허용하려면 <code>Promise.allSettled</code>.',
    ],
    senior: '반대쪽 함정도 있습니다. <code>Promise.all(items.map(fetchOne))</code>에 항목이 5,000개면 요청 5,000개가 한꺼번에 나가서 상대 서버의 레이트 리밋에 걸리거나, 커넥션 풀을 고갈시키거나, 메모리가 치솟습니다. 병렬에는 항상 동시 실행 수 상한(예: 10개씩)이 필요합니다. 분산 트레이싱의 폭포 그래프에서 스팬들이 계단 모양으로 이어지면 순차, 같은 시작점에 쌓이면 병렬입니다. 계단이 보이면 그 호출들이 정말 서로를 필요로 하는지 확인하세요.',
  });
})();
