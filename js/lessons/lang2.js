/* 언어 · 런타임 2: 지연 평가 이터레이터, 루프 안의 스프레드, 디바운스와 스로틀
   시간 값(ms)은 원리를 보이기 위한 가정값이다 */
(function () {
  const CS = window.CS;

  /* ---------- 배열 체인 vs 지연 평가 이터레이터 ---------- */
  const LZ_TAKE = 3;
  const square = (x) => x * x, isOdd = (x) => x % 2 === 1;
  const lzInit = (t) => { t.m['콜백 호출 횟수'] = 0; t.m['만든 중간 배열 수'] = 0; t.m['읽은 입력 원소 수'] = 0; };
  CS.add({
    id: 'lazy-iterator', level: 'mid', topic: 'lang',
    title: '배열 메서드 체인 vs 이터레이터: 필요한 만큼만 계산하기',
    summary: 'map().filter().slice(0, 3) 같은 배열 메서드 체인은 읽기 좋지만, 단계마다 배열 전체를 끝까지 처리해 새 배열을 만듭니다. 결과로 3개만 필요해도 그렇습니다. 이터레이터 체인은 원소를 하나씩 끝 단계까지 통과시키고, 필요한 개수가 차면 멈춥니다.',
    param: { label: '배열 길이 n', options: [8, 12, 16], value: 12 },
    headline: '콜백 호출 횟수',
    verdict: '배열 체인의 비용은 배열 길이에 비례합니다(콜백 2n번, 중간 배열 2개). 이터레이터 체인은 결과 3개를 채우는 데 필요한 앞의 5개만 읽어, n이 얼마든 콜백 10번에서 멈추고 중간 배열을 만들지 않습니다.',
    variants: [
      {
        name: '배열 메서드 체인', tone: 'bad', label: '단계마다 전체 처리', big: { time: 'O(n)', space: 'O(n) 중간 배열' },
        code: `const square = (x) => x * x;
const isOdd = (x) => x % 2 === 1;

const result = nums
  .map(square)
  .filter(isOdd)
  .slice(0, 3);`,
        notes: { 5: '전체를 돌고 새 배열', 6: '또 전체를 돌고 새 배열', 7: '앞의 3개만 사용' },
        run(t, n) {
          lzInit(t);
          const nums = Array.from({ length: n }, (_, i) => i + 1), mapped = [], kept = [];
          let cut = false;
          const snap = (phase, i) => [
            { type: 'cells', compact: n > 12, title: `nums (${n}개)`, items: nums.map((v, k) => ({ id: k, v, s: phase === 'map' ? (k === i ? 'active' : k < i ? 'dim' : '') : 'dim' })) },
            { type: 'cells', compact: n > 12, title: '중간 배열 ① — map이 만든 새 배열', items: mapped.map((v, k) => ({ id: k, v, s: phase === 'map' ? (k === i ? 'new' : '') : phase === 'filter' ? (k === i ? 'active' : k < i ? 'dim' : '') : 'dim' })) },
            { type: 'cells', compact: n > 12, title: cut ? `중간 배열 ② — 앞의 ${LZ_TAKE}개만 result로 복사되고 나머지는 버려짐` : '중간 배열 ② — filter가 만든 새 배열', items: kept.map((v, k) => ({ id: v, v, s: cut ? (k < LZ_TAKE ? 'done' : 'bad') : k === kept.length - 1 && phase === 'filter' && mapped[i] === v ? 'new' : '' })) },
          ];
          t.step(4, `숫자 ${n}개에서 "제곱이 홀수인 것"을 앞에서부터 <b>${LZ_TAKE}개만</b> 구합니다. 배열 메서드는 한 단계가 완전히 끝나야 다음 단계로 넘어갑니다.`, snap());
          t.m['만든 중간 배열 수']++;
          nums.forEach((x, i) => {
            mapped.push(square(x)); t.m['콜백 호출 횟수']++; t.m['읽은 입력 원소 수']++;
            t.step(5, i === 0 ? `<code>map</code>이 새 배열을 만들고 nums를 처음부터 돕니다. <code>square(1) = 1</code>.`
              : i === n - 1 ? `<code>square(${x}) = ${x * x}</code>. map 끝 — 콜백 ${n}번에 원소 ${n}개짜리 배열이 생겼습니다. 이 배열은 다음 단계의 입력으로만 쓰이고 버려집니다.`
              : i === 5 ? `<code>square(${x}) = ${x * x}</code>. 결과에 필요한 원소는 사실 앞의 5개로 충분하지만, <b>map은 뒤에 slice가 있다는 것을 모릅니다.</b>`
              : `<code>square(${x}) = ${x * x}</code> → 중간 배열 ①에 담습니다.`, snap('map', i));
          });
          t.m['만든 중간 배열 수']++;
          mapped.forEach((v, i) => {
            t.m['콜백 호출 횟수']++;
            const ok = isOdd(v);
            if (ok) kept.push(v);
            t.step(6, i === 0 ? `<code>filter</code>가 또 새 배열을 만들고 중간 배열 ①을 처음부터 돕니다. <code>isOdd(1)</code> → 통과.`
              : `<code>isOdd(${v})</code> → ${ok ? '<b>통과.</b> 중간 배열 ②에 담습니다.' : '탈락.'}${ok && kept.length === LZ_TAKE ? ` 이미 ${LZ_TAKE}개가 모였지만 filter는 끝까지 돕니다.` : ''}`, snap('filter', i));
          });
          cut = true;
          t.step(7, `<code>slice(0, ${LZ_TAKE})</code>이 앞의 ${LZ_TAKE}개를 복사해 result를 만듭니다. 중간 배열 ②의 나머지 ${kept.length - LZ_TAKE}개는 계산만 하고 쓰지 않았습니다.`, snap('slice'));
          t.step(4, `result = [${kept.slice(0, LZ_TAKE).join(', ')}]. 3개를 얻으려고 콜백을 <b>${t.m['콜백 호출 횟수']}번</b> 부르고 중간 배열을 <b>2개</b> 만들었습니다. n이 100만이면 콜백 200만 번입니다.`, snap('slice'));
        },
      },
      {
        name: '이터레이터 체인 (지연 평가)', tone: 'good', label: '한 원소씩 끝까지', big: { time: 'O(필요한 만큼)', space: 'O(1)' },
        code: `const square = (x) => x * x;
const isOdd = (x) => x % 2 === 1;

const result = nums.values()
  .map(square)
  .filter(isOdd)
  .take(3)
  .toArray();`,
        notes: { 4: '이터레이터 생성, 실행은 아직', 5: '원소가 지나갈 때 호출', 7: '3개가 차면 중단', 8: '여기서 실제로 당겨 옴' },
        run(t, n) {
          lzInit(t);
          const nums = Array.from({ length: n }, (_, i) => i + 1), out = [];
          let cur = -1, stage = null, val = null, stopped = false;
          const snap = () => [
            { type: 'cells', compact: n > 12, title: `nums (${n}개) — 흐린 칸은 읽고 지나간 원소`, items: nums.map((v, k) => ({ id: k, v, s: k === cur && !stopped ? 'active' : k <= cur ? 'dim' : stopped ? 'hole' : '', ptr: k === cur && !stopped ? '지금' : '' })) },
            { type: 'cells', title: '파이프라인 — 원소 하나가 세 단계를 차례로 지남', items: [
              { id: 'm', v: stage ? val.m : '–', sub: 'map', s: stage === 'm' ? 'active' : '' },
              { id: 'f', v: stage === 'f' || stage === 't' ? val.f : '–', sub: 'filter', s: stage === 'f' ? (val.f === '통과' ? 'done' : 'bad') : '' },
              { id: 't', v: `${out.length}/${LZ_TAKE}`, sub: 'take', s: stage === 't' ? 'done' : '' },
            ] },
            { type: 'cells', title: 'result — toArray가 모으는 최종 배열', items: out.map((v) => ({ id: v, v, s: 'done' })) },
          ];
          t.step(4, `<code>nums.values()</code>는 배열을 복사하지 않습니다. "다음 원소를 달라"고 할 때마다 하나씩 내주는 <b>이터레이터</b>를 돌려줍니다. 아직 아무것도 읽지 않았습니다.`, snap());
          t.step(4, `이어지는 <code>.map(square)</code>, <code>.filter(isOdd)</code>, <code>.take(${LZ_TAKE})</code>는 "원소가 지나갈 때 이렇게 하겠다"고 <b>등록만</b> 합니다. 여기까지 콜백 0번, 새 배열 0개입니다.`, snap());
          t.step(8, `<code>toArray()</code>가 결과를 요구하는 순간 실행이 시작됩니다. "하나 줘"라는 요청이 take → filter → map → nums 순으로 거슬러 올라갑니다.`, snap());
          for (const x of nums) {
            cur = x - 1; t.m['읽은 입력 원소 수']++;
            t.m['콜백 호출 횟수']++; stage = 'm'; val = { m: square(x) };
            t.step(5, `nums의 다음 원소는 ${x}. <code>square(${x}) = ${val.m}</code>을 배열에 담지 않고 <b>바로 다음 단계로</b> 넘깁니다.`, snap());
            t.m['콜백 호출 횟수']++; stage = 'f'; val.f = isOdd(val.m) ? '통과' : '탈락';
            if (!isOdd(val.m)) { t.step(6, `<code>isOdd(${val.m})</code> → 탈락. 버리고 nums에 다음 원소를 요청합니다.`, snap()); continue; }
            t.step(6, `<code>isOdd(${val.m})</code> → 통과. take로 넘깁니다.`, snap());
            out.push(val.m); stage = 't';
            t.step(7, `take가 ${out.length}번째 결과로 ${val.m}을 받아 result에 내보냅니다. (${out.length}/${LZ_TAKE})`, snap());
            if (out.length === LZ_TAKE) break;
          }
          stopped = true; stage = null;
          t.step(8, `${LZ_TAKE}개가 찼습니다. take가 "끝"을 알리고 <b>더 이상 위 단계에 요청하지 않습니다.</b> nums의 ${cur + 2}번째부터 ${n}번째까지는 읽지도 않았습니다.`, snap());
          t.step(8, `result = [${out.join(', ')}]. 콜백 <b>${t.m['콜백 호출 횟수']}번</b>, 중간 배열 <b>0개</b>. nums가 100만 개여도 이 숫자는 그대로입니다.`, snap());
        },
      },
    ],
    points: [
      '배열 메서드는 <b>즉시 평가</b>(단계별로 전체를 처리), 이터레이터 헬퍼는 <b>지연 평가</b>(원소별로 끝까지 통과)입니다. 실행 순서가 "가로 한 줄씩"에서 "세로 한 칸씩"으로 바뀝니다.',
      '이터레이터의 <code>map · filter · take · drop · flatMap · toArray</code>는 ECMAScript 2025(2025년 6월 승인)에 표준으로 들어갔습니다. 주요 브라우저 최신 버전에서는 2025년 3월부터 모두 쓸 수 있고, Node.js는 22부터 지원합니다.',
      '<code>take</code>, <code>find</code>, <code>some</code>처럼 <b>일찍 끝날 수 있는 연산</b>이 뒤에 있을 때 이득이 큽니다. 전체를 다 소비한다면 콜백 호출 수는 같고, 줄어드는 것은 중간 배열뿐입니다.',
      '이터레이터는 <b>한 번만</b> 소비할 수 있습니다. 두 번 순회하려면 다시 만들거나 <code>toArray()</code>로 배열로 바꿔 둡니다.',
    ],
    senior: '지연 평가가 항상 더 빠른 것은 아닙니다. 원소 수백 개짜리 배열을 끝까지 처리한다면, 엔진이 오래 최적화해 온 배열 메서드가 원소마다 <code>next()</code> 호출을 거치는 이터레이터보다 빠른 경우가 많습니다. 이터레이터가 확실히 이기는 곳은 ① 입력이 크고 앞부분만 필요할 때 ② 중간 배열이 수십 MB라 GC 부담이 문제일 때 ③ 제너레이터, 파일의 줄, 페이지 단위 API처럼 입력이 끝없이 이어지거나 메모리에 한 번에 올릴 수 없을 때입니다. 한 가지 더 주의할 점은 부수 효과입니다. 지연 평가에서는 <code>map</code>의 콜백이 "체인을 쓴 줄"이 아니라 "결과를 소비하는 줄"에서 실행되므로, 콜백 안에서 로그를 찍거나 외부 상태를 바꾸면 순서가 직관과 달라집니다. 비동기 이터레이터용 헬퍼는 2026년 기준 별도 제안으로 아직 표준이 아니므로, 스트림 처리에는 <code>for await</code>나 라이브러리를 씁니다.',
    qa: [
      ['<code>arr.map().filter().slice(0, 10)</code>의 문제점과 개선 방법을 설명해 보세요.', 'map과 filter가 각각 배열 전체를 돌며 새 배열을 만들기 때문에, 10개만 필요해도 n개를 두 번 처리하고 중간 배열 2개를 할당합니다. 개선은 지연 평가입니다. <code>arr.values().map().filter().take(10).toArray()</code>처럼 이터레이터 헬퍼를 쓰면 원소가 하나씩 끝까지 통과하고 10개가 차면 멈춥니다. 헬퍼를 쓸 수 없는 환경에서는 조건이 찰 때 <code>break</code>하는 for 루프가 같은 일을 합니다.'],
      ['즉시 평가와 지연 평가의 차이는 무엇이고, 지연 평가는 언제 손해인가요?', '즉시 평가는 호출한 순간 전체 결과를 계산하고, 지연 평가는 값을 요구받을 때 필요한 만큼만 계산합니다. 지연 평가는 조기 종료와 무한 수열, 메모리 절약에 유리합니다. 반대로 작은 배열을 끝까지 소비하면 원소당 호출 비용 때문에 더 느릴 수 있고, 한 번만 순회할 수 있으며, 콜백의 실행 시점이 뒤로 밀려 디버깅이 어려워집니다.'],
      ['이터레이터와 이터러블은 어떻게 다른가요?', '이터러블은 <code>[Symbol.iterator]()</code>로 이터레이터를 만들어 줄 수 있는 객체(배열, Map, Set, 문자열)이고, 이터레이터는 <code>next()</code>를 부를 때마다 <code>{ value, done }</code>을 돌려주며 현재 위치를 기억하는 객체입니다. 이터러블은 여러 번 순회할 수 있지만 이터레이터는 소비하면 끝입니다. 제너레이터 함수는 이터레이터를 쉽게 만드는 문법입니다.'],
    ],
    dx: {
      cat: ['slow', 'memory'], concept: '즉시 평가로 인한 불필요한 전체 처리와 중간 배열',
      symptoms: ['큰 배열에서 앞의 몇 개만 쓰는데 변환 체인이 배열 크기에 비례해 느려진다', '힙 프로파일에 수명이 짧은 큰 배열이 반복해서 잡히고 GC가 잦다', '<code>find</code>나 <code>slice</code>가 맨 뒤에 있는데도 앞 단계의 콜백이 전부 실행된다'],
      check: '체인의 각 콜백에 카운터를 넣어 호출 횟수가 n에 비례하는지, 실제로 쓰는 결과 수에 비례하는지 봅니다. 메모리는 힙 스냅숏의 Array 할당량으로 확인합니다.',
      fix: '조기 종료가 가능한 연산을 앞에 두거나, 이터레이터 헬퍼(<code>values().map().filter().take()</code>) 또는 <code>break</code>가 있는 루프로 바꿉니다.',
    },
  });

  /* ---------- 루프 안의 스프레드 ---------- */
  const SP_INIT = (t) => { t.m['복사한 키 수'] = 0; t.m['만든 객체 수'] = 1; };
  CS.add({
    id: 'spread-in-loop', level: 'mid', topic: 'lang',
    title: '루프 안의 스프레드: 불변 갱신에 숨은 O(n²)',
    summary: '{ ...acc, [key]: value }는 한 줄이지만 acc의 모든 키를 새 객체로 복사합니다. 이것이 reduce 안에 있으면 반복할 때마다 지금까지 쌓은 것을 전부 다시 복사하게 됩니다. 사용자 목록을 id로 찾는 객체로 바꾸는 흔한 코드에서 복사 횟수를 세어 봅니다.',
    param: { label: '사용자 수 n', options: [6, 12, 18], value: 12 },
    headline: '복사한 키 수',
    verdict: '스프레드 방식은 i번째 반복에서 키 i개를 복사하므로 합계가 n(n−1)/2입니다. n = 12이면 66번, n = 18이면 153번, n = 10,000이면 약 5천만 번입니다. 같은 객체에 키를 추가하면 복사는 0번이고 결과는 똑같습니다.',
    variants: [
      {
        name: '매번 스프레드로 새 객체', tone: 'bad', label: '전체 복사 × n', big: { time: 'O(n²)', space: 'O(n²) 쓰레기' },
        code: `const byId = users.reduce((acc, u) => {
  return {
    ...acc,
    [u.id]: u,
  };
}, {});`,
        notes: { 3: '지금까지의 키를 전부 복사', 4: '그리고 하나 추가' },
        run(t, n) {
          SP_INIT(t);
          const keys = [], trash = [];
          const snap = (i, copying) => [
            { type: 'cells', compact: n > 12, title: `users (${n}명)`, items: Array.from({ length: n }, (_, k) => ({ id: k, v: `u${k + 1}`, s: k === i ? 'active' : k < i ? 'dim' : '' })) },
            { type: 'cells', compact: n > 12, title: copying ? `acc — 새 객체를 만들고 기존 키 ${keys.length}개를 하나씩 복사하는 중` : 'acc — 이번 반복이 돌려준 객체', items: keys.map((k, j) => ({ id: k, v: k, s: copying ? 'cmp' : j === keys.length - 1 ? 'new' : '' })) },
            { type: 'cells', compact: true, title: '버려진 이전 객체들 — 숫자는 들어 있던 키 수. 가비지 컬렉터가 치워야 함', items: trash.map((c, j) => ({ id: j, v: c, s: 'bad' })) },
          ];
          t.step(1, `사용자 배열을 <code>{ u1: {...}, u2: {...} }</code> 형태로 바꿉니다. 빈 객체 <code>{}</code>에서 출발합니다.`, snap(-1));
          for (let i = 0; i < n; i++) {
            t.m['만든 객체 수']++; t.m['복사한 키 수'] += i; trash.push(i);
            if (i) t.step(3, i === 1 ? `u2 차례 — <code>...acc</code>가 <b>새 객체</b>를 만들고 기존 키 1개를 복사합니다. 방금 전의 객체는 버려집니다.`
              : `u${i + 1} 차례 — 또 새 객체를 만들고 기존 키 <b>${i}개를 전부 복사</b>합니다. (누적 복사 ${t.m['복사한 키 수']}번)`, snap(i, true));
            keys.push(`u${i + 1}`);
            t.step(4, i === 0 ? `u1 차례 — acc가 비어 있어 복사할 것이 없습니다. 새 객체에 <code>u1</code>만 넣어 돌려줍니다.` : `그 뒤에 <code>u${i + 1}</code> 하나를 추가합니다. 실제로 필요했던 일은 이 한 줄뿐입니다.`, snap(i));
          }
          t.step(6, `키 ${n}개짜리 객체를 만드는 데 객체를 <b>${t.m['만든 객체 수']}개</b> 만들고 키를 <b>${t.m['복사한 키 수']}번</b> 복사했습니다. n이 2배가 되면 복사는 약 4배가 됩니다.`, snap(n));
        },
      },
      {
        name: '같은 객체에 추가', tone: 'good', label: '복사 없음', big: { time: 'O(n)', space: 'O(n)' },
        code: `const byId = users.reduce((acc, u) => {
  acc[u.id] = u;
  return acc;
}, {});

// 같은 일: Object.fromEntries(users.map((u) => [u.id, u]))`,
        notes: { 2: '키 하나만 추가', 3: '같은 객체를 다시 넘김' },
        run(t, n) {
          SP_INIT(t);
          const keys = [];
          const snap = (i) => [
            { type: 'cells', compact: n > 12, title: `users (${n}명)`, items: Array.from({ length: n }, (_, k) => ({ id: k, v: `u${k + 1}`, s: k === i ? 'active' : k < i ? 'dim' : '' })) },
            { type: 'cells', compact: n > 12, title: 'acc — 처음 만든 객체 하나를 끝까지 사용', items: keys.map((k, j) => ({ id: k, v: k, s: j === keys.length - 1 && i < n ? 'new' : '' })) },
            { type: 'cells', compact: true, title: '버려진 이전 객체들', items: [] },
          ];
          t.step(1, `같은 변환입니다. 빈 객체 <code>{}</code>는 방금 이 자리에서 만든 것이라 <b>다른 코드가 참조하고 있지 않습니다.</b>`, snap(-1));
          for (let i = 0; i < n; i++) {
            keys.push(`u${i + 1}`);
            t.step(2, i === 0 ? `u1 차례 — acc에 <code>u1</code> 키를 추가합니다.` : i === 1 ? `u2 차례 — <b>같은 객체</b>에 키 하나를 더합니다. 기존 키는 건드리지 않습니다.` : `u${i + 1} 차례 — 키 하나 추가. 객체 크기와 상관없이 일의 양이 같습니다.`, snap(i));
          }
          t.step(4, `객체 <b>1개</b>, 복사 <b>0번</b>. 결과는 스프레드 방식과 완전히 같고, 바깥에서 보면 이 함수는 여전히 입력을 바꾸지 않습니다.`, snap(n));
        },
      },
    ],
    points: [
      '스프레드(<code>...</code>)는 문법이 짧을 뿐 <b>크기만큼의 복사</b>입니다. <code>[...acc, x]</code>, <code>{ ...acc, k: v }</code>, <code>acc.concat(x)</code>, <code>arr.toSpliced()</code> · <code>arr.with()</code>가 모두 같습니다. 한 번은 O(n), 루프 안에서는 O(n²).',
      '불변성이 필요한 것은 <b>다른 코드와 공유하는 값</b>입니다. 함수 안에서 방금 만든 지역 객체·배열은 바꿔도 밖에서 알 수 없으므로 안전합니다.',
      '만들고 싶은 모양에 맞는 내장 기능이 있습니다. 키-값 쌍은 <code>Object.fromEntries</code>나 <code>new Map(pairs)</code>, 그룹 묶기는 <code>Object.groupBy</code> · <code>Map.groupBy</code>(ES2024), 이어 붙이기는 <code>flatMap</code>.',
      '문제는 <code>reduce</code>가 아니라 누적값을 매번 복사하는 것입니다. <code>for</code> 루프 안의 <code>result = [...result, x]</code>도 똑같이 O(n²)입니다.',
    ],
    senior: '이 패턴은 데이터가 작을 때는 전혀 보이지 않다가, 고객사 하나가 수만 건을 올리는 날 타임아웃으로 나타납니다. 프로파일에서는 reduce 콜백 한 줄에 시간이 몰리고 GC 비중이 높게 나옵니다. 리액트나 리덕스 상태처럼 참조가 바뀌어야 변경을 알아채는 곳에서는 불변 갱신이 맞습니다. 다만 그때도 "갱신 한 번에 복사 한 번"이면 충분하므로, 루프로 결과를 다 만든 뒤 마지막에 한 번 새 참조로 내보냅니다. 큰 컬렉션을 자주 불변 갱신해야 한다면 바뀐 부분만 새로 만들고 나머지는 공유하는 구조(구조적 공유, 예: Immer나 영속 자료구조)를 씁니다. 사람이 리뷰로 잡기는 어려우므로 린터에 맡기는 편이 낫습니다. Biome의 <code>noAccumulatingSpread</code>, Oxlint의 <code>no-accumulating-spread</code>가 reduce 안의 누적 스프레드를 잡아 줍니다.',
    qa: [
      ['<code>arr.reduce((acc, x) => [...acc, f(x)], [])</code>의 시간 복잡도는 얼마이고 왜 그런가요?', 'O(n²)입니다. 스프레드는 acc의 원소를 전부 새 배열로 복사하므로 i번째 반복의 비용이 i이고, 합이 0 + 1 + … + (n−1) = n(n−1)/2가 됩니다. 반복마다 버려지는 배열도 n개 생겨 GC 부담까지 더해집니다. <code>acc.push(f(x)); return acc;</code>로 같은 배열에 추가하거나 처음부터 <code>arr.map(f)</code>를 쓰면 O(n)입니다.'],
      ['불변성을 지키면서 성능도 지키려면 어떻게 해야 하나요?', '불변성의 경계를 함수 단위로 봅니다. 입력으로 받은 값은 바꾸지 않되, 함수 안에서 새로 만든 값은 완성될 때까지 자유롭게 바꾸고 완성된 것을 돌려줍니다. 큰 상태를 자주 조금씩 갱신해야 하면 구조적 공유를 쓰는 라이브러리로 바뀐 경로만 복사합니다. 핵심은 복사 횟수를 "원소 수"가 아니라 "갱신 횟수"에 비례하게 만드는 것입니다.'],
      ['입력이 2배가 될 때 실행 시간이 4배가 된다면 무엇을 의심하나요?', '이차 시간(O(n²))입니다. 눈에 보이는 이중 루프가 없다면 루프 안에 숨은 선형 연산을 찾습니다. 누적값 스프레드, <code>includes</code> · <code>indexOf</code> · <code>find</code>, 배열 맨 앞 삽입(<code>unshift</code>), 문자열·배열 전체 복사가 대표적입니다. 입력 크기를 1천, 2천, 4천으로 바꿔 가며 시간을 재면 바로 확인됩니다.'],
    ],
    dx: {
      cat: ['slow', 'memory'], concept: '루프 안의 전체 복사(누적 스프레드)로 인한 O(n²)',
      symptoms: ['데이터가 수백 건일 때는 멀쩡하던 변환이 수만 건에서 몇 초~몇십 초 걸린다', '입력이 2배가 되면 시간이 4배가 된다', 'CPU 프로파일에서 reduce 콜백 한 줄과 GC가 대부분을 차지한다'],
      check: '입력 크기를 2배씩 늘리며 시간을 잽니다. 4배씩 늘면 이차 시간입니다. 프로파일에서 시간이 몰린 줄에 <code>...acc</code>, <code>concat</code>, <code>Object.assign({}, acc)</code>가 있는지 봅니다.',
      fix: '누적값을 새로 만들지 말고 같은 배열·객체에 추가합니다(<code>push</code>, <code>acc[k] = v</code>). 가능하면 <code>map</code>, <code>Object.fromEntries</code>, <code>Object.groupBy</code> 같은 내장 기능으로 바꿉니다.',
    },
  });


  /* ---------- 디바운스와 스로틀 ---------- */
  const DT_WORD = 'espresso', DT_KEYS = [0, 80, 160, 240, 320, 700, 780, 860], DT_WAIT = 200, DT_TOTAL = 1200;
  const dtInit = (t) => { t.m['서버 요청 수'] = 0; t.m['입력 이벤트 수'] = 0; t.m['첫 요청 시점 (ms)'] = undefined; };
  const dtSnap = (rows, calls, bar) => [
    { type: 'timeline', total: DT_TOTAL, title: `가로축 = 시간 (0 ~ ${DT_TOTAL}ms) · 한 줄 = 키 입력 한 번 · ${bar}`, items: rows.map((r) => ({ ...r })) },
    { type: 'cells', title: '서버로 실제 보낸 검색 요청 (아래는 보낸 시각)', items: calls.map((c) => ({ ...c })) },
  ];
  const dtCall = (t, calls, i, at) => {
    t.m['서버 요청 수']++;
    if (t.m['첫 요청 시점 (ms)'] === undefined) t.m['첫 요청 시점 (ms)'] = at;
    calls.forEach((c) => (c.s = 'dim'));
    calls.push({ id: i, v: DT_WORD.slice(0, i + 1), sub: `${at}ms`, s: 'new' });
  };
  const dtWord = (i) => DT_WORD.slice(0, i + 1);
  const DT_INTRO = `사용자가 검색창에 <code>${DT_WORD}</code>를 칩니다. 다섯 글자를 80ms 간격으로 치고, 잠깐 멈췄다가 세 글자를 더 칩니다. <code>search</code>를 그대로 연결하면 입력 8번에 <b>요청 8번</b>이 나가고, 앞의 7번은 응답이 오기도 전에 쓸모없어집니다.`;
  CS.add({
    id: 'debounce-throttle', level: 'mid', topic: 'lang',
    title: '디바운스와 스로틀: 이벤트마다 일하지 않기',
    summary: '키 입력, 스크롤, 창 크기 변경은 1초에 수십 번씩 발생합니다. 그때마다 서버에 요청을 보내면 대부분은 곧바로 쓸모없어집니다. 디바운스는 입력이 멈출 때까지 기다렸다가 한 번, 스로틀은 일정 간격마다 한 번만 실행합니다. 같은 키 입력 8번에 실제 요청이 몇 번, 언제 나가는지 비교합니다.',
    headline: '서버 요청 수',
    verdict: '아무 제어 없이 연결하면 키 입력 8번에 요청 8번입니다. 디바운스는 2번, 스로틀은 3번으로 줄입니다. 디바운스는 마지막 값을 반드시 보내는 대신 첫 요청이 520ms로 늦고, 스로틀은 0ms에 바로 반응하는 대신 (이 구현에서는) 마지막 입력 <code>espresso</code>를 버렸습니다. 최종 값이 중요한 검색창에는 디바운스, 진행 중에도 반응해야 하는 스크롤·드래그에는 스로틀이 맞습니다.',
    variants: [
      {
        name: '디바운스 200ms', tone: 'good', label: '멈춘 뒤 한 번',
        code: `function debounce(fn, wait) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

const onInput = debounce(search, 200);
input.addEventListener('input',
  (e) => onInput(e.target.value));`,
        notes: { 4: '앞의 예약을 취소', 5: '200ms 뒤로 다시 예약', 9: '감싼 함수는 한 번만 만듦' },
        run(t) {
          dtInit(t);
          const rows = [], calls = [];
          const snap = () => dtSnap(rows, calls, `막대 = 그 입력이 건 ${DT_WAIT}ms 타이머`);
          t.step(11, DT_INTRO, snap());
          t.step(9, `<code>debounce</code>는 search를 감싸 "마지막 호출 뒤 ${DT_WAIT}ms 동안 조용하면 실행"하는 새 함수를 만듭니다. 타이머 변수는 이 함수의 클로저에 들어 있습니다.`, snap());
          DT_KEYS.forEach((at, i) => {
            t.m['입력 이벤트 수']++;
            const prev = rows[rows.length - 1];
            if (prev && prev.s === 'active') {
              prev.len = at - prev.start; prev.s = ''; prev.text = '취소';
              t.step(4, i === 1 ? `80ms — <code>es</code> 입력. 먼저 <code>clearTimeout</code>으로 <b>앞 입력이 걸어 둔 타이머를 취소</b>합니다. "e" 검색은 영영 실행되지 않습니다.` : `${at}ms — <code>${dtWord(i)}</code> 입력. 앞의 타이머를 취소합니다.`, snap());
            } else if (i) rows.forEach((r) => { if (r.s === 'active') r.s = 'done'; });
            rows.push({ id: i, label: dtWord(i), start: at, len: DT_WAIT, s: 'active', text: `${DT_WAIT}ms 대기` });
            t.step(5, i === 0 ? `0ms — <code>e</code> 입력. 바로 요청하지 않고 <b>${DT_WAIT}ms 뒤에 실행</b>하도록 타이머만 겁니다.`
              : prev.text === '취소' ? `그리고 ${DT_WAIT}ms 타이머를 새로 겁니다. 입력이 이어지는 한 실행은 계속 뒤로 밀립니다.`
              : `${at}ms — 다시 입력이 시작됩니다. <code>${dtWord(i)}</code>에 대한 타이머를 겁니다.`, snap());
            const next = DT_KEYS[i + 1];
            if (next === undefined || next - at >= DT_WAIT) {
              const cur = rows[rows.length - 1];
              cur.s = 'done'; cur.text = '→ 호출';
              dtCall(t, calls, i, at + DT_WAIT);
              t.step(5, `${at + DT_WAIT}ms — ${DT_WAIT}ms 동안 새 입력이 없었습니다. 타이머가 끝까지 가서 <code>search('${dtWord(i)}')</code>를 <b>한 번</b> 호출합니다.`, snap());
            }
          });
          t.step(11, `입력 8번에 요청 <b>2번</b>. 사용자가 멈춘 시점의 값만 보냈고, 마지막 값 <code>${DT_WORD}</code>도 빠지지 않았습니다. 대가는 지연입니다. 첫 요청이 520ms에야 출발했습니다.`, snap());
        },
      },
      {
        name: '스로틀 200ms', tone: 'info', label: '간격마다 한 번',
        code: `function throttle(fn, wait) {
  let last = -Infinity;
  return (...args) => {
    const now = Date.now();
    if (now - last < wait) return;
    last = now;
    fn(...args);
  };
}

const onInput = throttle(search, 200);
input.addEventListener('input',
  (e) => onInput(e.target.value));`,
        notes: { 5: '잠금 중이면 버림', 6: '실행 시각 기록', 7: '바로 실행' },
        run(t) {
          dtInit(t);
          const rows = [], calls = [];
          const snap = () => dtSnap(rows, calls, `긴 막대 = 호출 뒤 ${DT_WAIT}ms 잠금, 짧은 막대 = 버려진 입력`);
          t.step(13, DT_INTRO, snap());
          t.step(11, `<code>throttle</code>은 search를 감싸 "한 번 실행하면 ${DT_WAIT}ms 동안은 다시 실행하지 않는" 새 함수를 만듭니다. 마지막 실행 시각이 클로저에 들어 있습니다.`, snap());
          let last = -Infinity;
          DT_KEYS.forEach((at, i) => {
            t.m['입력 이벤트 수']++;
            rows.forEach((r) => { if (r.s === 'active') r.s = 'done'; });
            if (at - last < DT_WAIT) {
              rows.push({ id: i, label: dtWord(i), start: at, len: 14, s: 'bad', text: '' });
              t.step(5, `${at}ms — <code>${dtWord(i)}</code> 입력. 마지막 실행(${last}ms)에서 ${at - last}ms밖에 지나지 않았습니다. <b>아무것도 하지 않고 버립니다.</b>`, snap());
              return;
            }
            last = at;
            rows.push({ id: i, label: dtWord(i), start: at, len: DT_WAIT, s: 'active', text: '호출 + 잠금' });
            dtCall(t, calls, i, at);
            t.step(7, i === 0 ? `0ms — <code>e</code> 입력. 첫 호출은 기다리지 않고 <b>즉시 실행</b>하고, 실행 시각을 기록합니다.` : `${at}ms — <code>${dtWord(i)}</code> 입력. 마지막 실행에서 ${DT_WAIT}ms 이상 지났으므로 <b>실행</b>하고 다시 ${DT_WAIT}ms 잠급니다.`, snap());
          });
          rows.forEach((r) => { if (r.s === 'active') r.s = 'done'; });
          t.step(5, `입력 8번에 요청 <b>3번</b>, 첫 요청은 0ms에 나갔습니다. 하지만 마지막 입력 <code>${DT_WORD}</code>는 잠금 구간에 걸려 버려졌고, 화면에는 <code>espres</code>의 결과가 남습니다.`, snap());
          t.step(13, `그래서 검색창에 쓰려면 "잠금이 풀릴 때 마지막 호출을 한 번 더 실행"하는 trailing 옵션이 있는 구현을 씁니다. 스크롤 위치처럼 중간 값 하나쯤 빠져도 되는 곳에서는 이 단순한 구현으로 충분합니다.`, snap());
        },
      },
    ],
    points: [
      '<b>디바운스</b>: 이벤트가 멈춘 뒤 한 번. "최종 값"만 의미 있을 때 씁니다(검색어 자동완성, 입력 검증, 창 크기 변경 후 재배치, 자동 저장).',
      '<b>스로틀</b>: 일정 간격마다 한 번. "진행 중에도 주기적으로" 반응해야 할 때 씁니다(스크롤 위치 추적, 드래그, 마우스 이동, 진행률 전송).',
      '둘 다 원래 함수를 <b>클로저로 감싼 새 함수</b>를 돌려줍니다. 타이머나 마지막 실행 시각이 그 클로저 안에 살아 있어야 하므로, 이벤트마다 새로 만들면 아무 효과가 없습니다.',
      '화면을 그리는 작업의 간격은 직접 정하지 말고 <code>requestAnimationFrame</code>에 맡기면 화면 주사율에 맞춰집니다.',
    ],
    senior: '호출 횟수를 줄이는 것과 결과의 순서를 지키는 것은 별개의 문제입니다. 디바운스를 걸어도 요청 두 개가 겹치면 늦게 온 옛 응답이 새 결과를 덮을 수 있으므로, 새 요청을 보낼 때 <code>AbortController</code>로 앞 요청을 취소하거나 요청에 번호를 붙여 최신 것만 반영합니다. 대기 시간은 감으로 정하지 말고 측정합니다. 너무 짧으면 줄어드는 요청이 없고, 너무 길면 "느린 검색창"이 됩니다. 입력을 멈추지 않는 사용자에게 디바운스는 끝없이 미뤄질 수 있으므로 최대 대기 시간(maxWait)을 함께 두는 구현이 실용적입니다. 리액트에서는 컴포넌트가 다시 그려질 때마다 디바운스 함수가 새로 만들어져 타이머가 끊기는 버그가 흔합니다. 함수를 <code>useMemo</code>나 ref에 보관하고, 컴포넌트가 사라질 때 남은 타이머를 취소해야 합니다. 그리고 이 둘은 클라이언트 쪽의 절약일 뿐 서버 보호 수단이 아닙니다. 서버에는 따로 레이트 리밋이 있어야 합니다.',
    qa: [
      ['디바운스와 스로틀의 차이를 설명하고, 각각 어디에 쓰는지 말해 보세요.', '디바운스는 마지막 이벤트 이후 일정 시간 조용해야 한 번 실행합니다. 이벤트가 이어지는 동안에는 실행되지 않고, 최종 값만 처리합니다. 스로틀은 이벤트가 아무리 많아도 일정 간격에 한 번씩은 실행합니다. 검색 자동완성이나 자동 저장처럼 결과만 중요하면 디바운스, 스크롤·드래그처럼 중간 과정에도 반응해야 하면 스로틀을 씁니다.'],
      ['debounce 함수를 직접 구현해 보세요. 핵심은 무엇인가요?', '클로저에 타이머 id를 보관하는 것입니다. 호출될 때마다 <code>clearTimeout</code>으로 이전 예약을 취소하고 <code>setTimeout</code>으로 새로 예약합니다. 구현할 때 확인할 점은 세 가지입니다. 마지막 호출의 인자와 <code>this</code>를 전달하는가, 취소(cancel) 수단을 주는가, 첫 호출을 즉시 실행하는 leading 옵션이 필요한가.'],
      ['검색창에 디바운스를 걸었는데도 가끔 이전 검색어의 결과가 보입니다. 원인과 해법은 무엇인가요?', '디바운스는 요청 수만 줄일 뿐 응답 순서를 보장하지 않습니다. 먼저 보낸 요청이 더 늦게 도착하면 옛 결과가 화면을 덮습니다. 새 요청을 보낼 때 이전 요청을 <code>AbortController</code>로 취소하거나, 요청마다 번호를 매겨 가장 최근 번호의 응답만 반영합니다.'],
    ],
    dx: {
      cat: ['slow', 'wrong'], concept: '고빈도 이벤트에 제어 없이 연결된 무거운 작업 (디바운스·스로틀 누락)',
      symptoms: ['검색창에 글자를 칠 때마다 Network 탭에 요청이 한 줄씩 생긴다', '입력 도중 결과 목록이 깜빡이거나 이전 검색어의 결과로 바뀐다', '스크롤·리사이즈 중 화면이 끊기고 핸들러가 초당 수십 번 이상 호출된다', '자동 저장이 API 레이트 리밋(429)에 걸린다'],
      check: '핸들러에 <code>console.count</code>를 넣어 초당 호출 수를 봅니다. Network 탭에서 한 번의 입력 동작에 요청이 몇 개 나가고 어떤 순서로 끝나는지 확인합니다.',
      fix: '최종 값만 필요하면 디바운스, 주기적 반응이 필요하면 스로틀(화면 갱신은 requestAnimationFrame)을 겁니다. 겹친 요청은 AbortController로 취소합니다.',
    },
  });
})();
