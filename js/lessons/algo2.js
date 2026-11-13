/* 코딩 테스트 유형 2: 파라메트릭 서치, 0/1 배낭, 최소 신장 트리(크루스칼), KMP, 비트마스크 */
(function () {
  const CS = window.CS;

  /* ---------- 파라메트릭 서치 ---------- */
  const PS_K = 6;
  const psWoods = (n) => [16, 11, 14, 9].map((v) => (v * n) / 16);
  const psPieces = (woods, x) => woods.map((w) => Math.floor(w / x));
  const psRun = (binary) => (t, n) => {
    const woods = psWoods(n), known = {};
    t.m['판별 함수 호출 횟수'] = 0; t.m['나눗셈 횟수'] = 0;
    let lo = 1, hi = n, best = 0, shown = 1;
    const canCut = (x) => {
      t.m['판별 함수 호출 횟수']++; t.m['나눗셈 횟수'] += woods.length;
      const sum = psPieces(woods, x).reduce((a, b) => a + b, 0);
      known[x] = sum >= PS_K;
      return sum;
    };
    const snap = (cur, ptrs) => {
      const pcs = psPieces(woods, shown), sum = pcs.reduce((a, b) => a + b, 0);
      return [
        {
          type: 'cells', title: `후보 길이 x = 1 ~ ${n}cm — 초록: 가능, 붉은색: 불가능${binary ? ', 흐린 칸: 호출 없이 판정됨' : ''}`,
          items: Array.from({ length: n }, (_, k) => k + 1).map((x) => ({
            id: x, v: x,
            s: x === cur && !(x in known) ? 'active' : x in known ? (known[x] ? 'done' : 'bad') : binary && (x < lo || x > hi) ? 'dim' : '',
            ptr: ptrs ? [x === lo && 'lo', x === cur && 'mid', x === hi && 'hi'].filter(Boolean).join('·') : x === cur ? 'x' : '',
          })),
        },
        {
          type: 'cells', title: `canCut(x = ${shown}) — 목재별로 ${shown}cm 조각이 몇 개 나오는가 (필요: ${PS_K}개)`,
          items: [
            ...woods.map((w, k) => ({ id: `w${k}`, v: `${w}cm`, sub: `${pcs[k]}개`, gap: k === woods.length - 1 })),
            { id: 'sum', v: `합 ${sum}개`, sub: sum >= PS_K ? '가능' : '불가능', s: sum >= PS_K ? 'done' : 'bad' },
          ],
        },
      ];
    };
    const expr = (x) => psPieces(woods, x).join(' + ');
    if (!binary) {
      t.step(5, `목재 4개를 <b>같은 길이 x</b>로 잘라 받침 ${PS_K}개를 만들려고 합니다. 가능한 가장 긴 x를 찾기 위해 1cm부터 하나씩 올려 봅니다.`, snap(0));
      for (let x = 1; x <= n; x++) {
        shown = x;
        if (x === 1) t.step(2, `<code>canCut(1)</code> — 판별 함수는 목재마다 <code>길이 ÷ x</code>의 몫을 더합니다. 나눗셈 ${woods.length}번이면 끝나는 쉬운 질문입니다.`, snap(x));
        const sum = canCut(x);
        if (sum < PS_K) {
          t.step(7, `x = ${x}: ${expr(x)} = ${sum}개 — <b>처음으로 모자랍니다.</b> 더 길게 자르면 조각은 줄기만 하므로 여기서 멈춥니다.`, snap(x));
          break;
        }
        best = x;
        t.step(8, `x = ${x}: ${expr(x)} = ${sum}개 ≥ ${PS_K}개 — 가능. 한 칸 올립니다.`, snap(x));
      }
      t.step(10, `답은 <b>${best}cm</b>. 가능이 이어지다가 한 번 불가능해진 뒤로는 다시 가능해지지 않습니다. 이 경계를 찾느라 판별 함수를 <b>${t.m['판별 함수 호출 횟수']}번</b> 불렀습니다.`, snap(0));
      return;
    }
    t.step(5, `같은 문제입니다. 답은 1 ~ ${n}cm 어딘가에 있습니다. 배열은 없지만 <b>"x로 가능한가?"</b>의 답이 어느 지점에서 한 번만 바뀐다는 것을 이용합니다.`, snap(0, true));
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      shown = mid;
      t.step(7, `남은 후보 ${lo} ~ ${hi}cm의 가운데 <b>${mid}cm</b>로 물어봅니다.`, snap(mid, true));
      const sum = canCut(mid);
      if (sum >= PS_K) {
        const cut = mid - lo + 1;
        best = mid; lo = mid + 1;
        t.step(8, `x = ${mid}: ${expr(mid)} = ${sum}개 — 가능. 더 짧게 자르면 조각은 늘기만 하므로 <b>${mid}cm 이하 ${cut}개 후보는 확인하지 않아도 가능</b>입니다. 더 긴 쪽만 남깁니다.`, snap(mid, true));
      } else {
        const cut = hi - mid + 1;
        hi = mid - 1;
        t.step(9, `x = ${mid}: ${expr(mid)} = ${sum}개 — 불가능. 더 길게 자르면 조각은 줄기만 하므로 <b>${mid}cm 이상 ${cut}개 후보는 전부 불가능</b>입니다.`, snap(mid, true));
      }
    }
    shown = best;
    t.step(11, `후보가 남지 않았습니다. 마지막으로 가능했던 <b>${best}cm</b>가 답입니다. 판별 함수 호출은 <b>${t.m['판별 함수 호출 횟수']}번</b>입니다.`, snap(0));
  };
  const PS_CHECK = `const canCut = (x) =>
  woods.reduce((sum, w) => sum + Math.floor(w / x), 0) >= K;
`;
  CS.add({
    id: 'parametric-search', level: 'mid', topic: 'algo',
    title: '파라메트릭 서치: 답을 이진 탐색하기',
    summary: '"가능한 가장 긴 길이를 구하라"처럼 최댓값·최솟값을 묻는 문제를 "길이 x로 가능한가?"라는 예/아니오 질문으로 바꿉니다. 그 답이 어느 지점을 경계로 한 번만 바뀐다면(단조성), 정렬된 배열이 없어도 답의 범위를 절반씩 줄일 수 있습니다.',
    param: { label: '가장 긴 목재의 길이 (답의 범위)', options: [16, 32, 64], value: 32 },
    headline: '판별 함수 호출 횟수',
    verdict: '답의 범위가 16 → 32 → 64로 2배씩 커질 때 하나씩 올려 보는 쪽은 판별 함수를 8 → 15 → 29번, 절반씩 줄이는 쪽은 4 → 5 → 6번 부릅니다. 정렬된 배열은 어디에도 없습니다. "x가 가능하면 x보다 짧은 길이도 전부 가능하다"는 단조성이 정렬을 대신합니다.',
    variants: [
      {
        name: '후보를 하나씩 올려 보기', tone: 'bad', big: { time: 'O(n × 답의 범위)', space: 'O(1)' },
        code: `${PS_CHECK}
function maxLength() {
  let best = 0;
  for (let x = 1; x <= longest; x++) {
    if (!canCut(x)) break;
    best = x;
  }
  return best;
}`,
        notes: { 1: '길이 x로 K개 이상 나오는가 · O(n)', 6: '답의 범위만큼 반복' },
        run: psRun(false),
      },
      {
        name: '답의 범위를 절반씩 줄이기', tone: 'good', big: { time: 'O(n × log 답의 범위)', space: 'O(1)' },
        code: `${PS_CHECK}
function maxLength() {
  let lo = 1, hi = longest, best = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (canCut(mid)) { best = mid; lo = mid + 1; }
    else hi = mid - 1;
  }
  return best;
}`,
        notes: { 1: '길이 x로 K개 이상 나오는가 · O(n)', 8: '가능 → 더 긴 쪽', 9: '불가능 → 더 짧은 쪽' },
        run: psRun(true),
      },
    ],
    points: [
      '"최적값을 구하라"를 <b>"x로 가능한가?"</b>로 바꾸는 것이 전부입니다. 판별 함수는 보통 단순 계산이나 그리디 한 번(O(n))으로 끝납니다.',
      '<b>단조성</b>이 조건입니다. 가능·불가능이 ○○○○×××처럼 한 번만 바뀌어야 가운데 하나를 보고 절반을 버릴 수 있습니다. ○×○×처럼 섞이는 문제에는 쓸 수 없습니다.',
      '답의 범위가 10억이어도 호출은 약 30번입니다. log가 데이터 개수가 아니라 <b>답의 크기</b>에 붙는다는 점이 배열에서의 이진 탐색과 다릅니다.',
      '답이 실수인 문제는 <code>lo &lt;= hi</code> 대신 정해진 횟수(50~100번)만큼 구간을 반으로 줄이는 방식으로 풉니다.',
    ],
    senior: '실무에서도 같은 형태가 자주 나옵니다. "p99 지연이 200ms를 넘지 않는 최대 동시 접속 수"를 부하 테스트로 찾기, 어느 커밋부터 테스트가 깨졌는지 찾는 <code>git bisect</code>, 타임아웃이 나지 않는 최소 서버 대수 산정이 모두 "예/아니오로 답하는 실험 + 단조성"입니다. 판별 한 번이 비쌀수록(부하 테스트 한 번에 10분) 호출 횟수를 log로 줄이는 효과가 큽니다. 주의할 것은 단조성이 깨지는 경우입니다. 간헐적으로 실패하는 테스트나 잡음이 큰 측정에서는 잘못된 판정 한 번이 탐색을 엉뚱한 절반으로 보냅니다. 판정을 여러 번 반복해 확인하거나, 찾은 경계 근처를 선형으로 다시 확인합니다.',
    qa: [
      ['파라메트릭 서치(매개 변수 탐색)가 무엇이고, 어떤 조건에서 쓸 수 있나요?', '최적화 문제를 "값 x로 가능한가"라는 결정 문제로 바꾸고, 그 답이 바뀌는 경계를 이진 탐색으로 찾는 기법입니다. 조건은 두 가지입니다. 판별 결과가 x에 대해 단조여야 하고(가능하다가 한 번 불가능해지면 다시 가능해지지 않음), 판별 자체를 충분히 빨리 할 수 있어야 합니다. 전체 비용은 판별 비용 × log(답의 범위)입니다.'],
      ['배열에서의 이진 탐색과 무엇이 다른가요?', '배열에서의 이진 탐색은 정렬된 배열의 인덱스 범위를 줄이고, 파라메트릭 서치는 답이 될 수 있는 값의 범위를 줄입니다. 배열 원소와 비교하는 대신 판별 함수를 호출합니다. 그래서 복잡도의 log는 데이터 개수가 아니라 답의 범위에 붙고, 정렬 대신 판별 결과의 단조성이 전제가 됩니다.'],
      ['이진 탐색 구현에서 무한 루프나 한 칸 차이 오류를 어떻게 피하나요?', '구간의 의미를 하나로 정해 끝까지 지킵니다. 예를 들어 "<code>lo</code> ~ <code>hi</code>는 아직 확인하지 않은 후보"로 정하면 조건은 <code>lo &lt;= hi</code>, 이동은 <code>mid + 1</code>과 <code>mid - 1</code>이고, 가능했던 값은 별도 변수에 기록합니다. 최댓값을 찾을 때는 가능하면 큰 쪽으로, 최솟값을 찾을 때는 가능하면 작은 쪽으로 갑니다. 작은 입력에서 하나씩 올려 보는 방식의 결과와 비교해 검증합니다.'],
    ],
    ct: { signal: '"~할 수 있는 최댓값/최솟값", 답의 범위가 매우 큼(10억 이상), x를 정하면 가능 여부는 쉽게 검사됨', how: '답 x를 정해 놓고 가능한지 판정하는 함수를 만든 뒤, 가능과 불가능이 갈리는 경계를 이진 탐색합니다.', big: 'O(판별 비용 × log 범위)', trap: '판별 결과가 단조인지 먼저 확인합니다. 최댓값을 찾을 때와 최솟값을 찾을 때 <code>lo</code>, <code>hi</code>를 옮기는 방향이 반대입니다. 판별 함수 안의 합계가 정수 범위를 넘는지도 봅니다.' },
  });

  /* ---------- 0/1 배낭 ---------- */
  const KN_W = 7;
  const KN_ITEMS = [['A', 3, 4], ['B', 4, 5], ['C', 2, 3], ['D', 5, 8], ['E', 1, 1], ['F', 2, 4], ['G', 2, 2], ['H', 3, 7]].map(([name, kg, val]) => ({ name, kg, val }));
  const knItems = (items, state) => ({
    type: 'cells', title: `물건 ${items.length}개 (아래: 무게 · 가치) — 배낭 용량 ${KN_W}kg`,
    items: items.map((it, k) => ({ id: it.name, v: it.name, sub: `${it.kg}kg·${it.val}`, s: state(k) })),
  });
  CS.add({
    id: 'knapsack', level: 'adv', topic: 'algo',
    title: '0/1 배낭: 모든 조합 대신 표를 채운다',
    summary: '무게 제한이 있는 배낭에 가치의 합이 가장 크도록 물건을 담습니다. 물건마다 "넣는다/안 넣는다" 두 갈래라 조합은 2ⁿ가지입니다. DP는 "앞의 i개만 보고 용량이 w일 때의 최대 가치"를 표로 채워, 같은 상황을 한 번만 계산합니다.',
    param: { label: '물건 수 n', options: [4, 6, 8], value: 6 },
    headline: '계산한 경우 수',
    verdict: `용량 ${KN_W}kg에서 물건이 4개일 때는 16 대 32로 완전 탐색이 오히려 적게 계산합니다. 6개에서 64 대 48로 뒤집히고, 8개에서는 256 대 64입니다. 물건이 하나 늘 때마다 완전 탐색은 2배가 되고, DP는 표 한 줄(${KN_W + 1}칸)이 늘 뿐입니다.`,
    variants: [
      {
        name: '완전 탐색 (모든 부분집합)', tone: 'bad', big: { time: 'O(2ⁿ × n)', space: 'O(n)' },
        code: `function knapsack(items, W) {
  let best = 0;
  for (const subset of allSubsets(items)) {
    let kg = 0, val = 0;
    for (const it of subset) { kg += it.kg; val += it.val; }
    if (kg <= W) best = Math.max(best, val);
  }
  return best;
}`,
        notes: { 3: '2ⁿ가지', 6: '용량을 넘으면 버림' },
        run(t, n) {
          const items = KN_ITEMS.slice(0, n), total = 1 << n;
          t.m['계산한 경우 수'] = 0;
          let best = 0, bestMask = 0;
          const names = (mask) => items.filter((_, k) => mask >> k & 1).map((it) => it.name).join(', ') || '없음';
          const calc = (mask) => {
            let kg = 0, value = 0;
            items.forEach((it, k) => { if (mask >> k & 1) { kg += it.kg; value += it.val; } });
            t.m['계산한 경우 수']++;
            const up = kg <= KN_W && value > best;
            if (up) { best = value; bestMask = mask; }
            return { kg, value, up };
          };
          const weigh = (mask) => items.reduce((r, it, k) => (mask >> k & 1 ? { kg: r.kg + it.kg, value: r.value + it.val } : r), { kg: 0, value: 0 });
          const snap = (mask, r, isBest) => [
            knItems(items, (k) => (mask >> k & 1 ? (isBest ? 'done' : r && r.kg > KN_W ? 'bad' : 'active') : '')),
            {
              type: 'cells', title: isBest ? '지금까지의 최고 조합' : '이번 조합',
              items: [
                { id: 'n', v: `확인 ${t.m['계산한 경우 수']} / ${total}` },
                { id: 'kg', v: `무게 ${r ? r.kg : '–'}kg`, s: r && r.kg > KN_W ? 'bad' : '' },
                { id: 'v', v: `가치 ${r ? r.value : '–'}` },
                { id: 'b', v: `최고 가치 ${best}`, s: 'done' },
              ],
            },
          ];
          t.step(3, `물건 ${n}개마다 "넣는다/안 넣는다"를 정하면 조합은 2<sup>${n}</sup> = <b>${total}가지</b>입니다. 전부 만들어 무게와 가치를 더해 봅니다.`, snap(0));
          const single = n <= 4 ? total : 8, chunk = n <= 6 ? 8 : 16;
          for (let mask = 0; mask < single; mask++) {
            const r = calc(mask);
            t.step(r.kg > KN_W ? 6 : 5, `[${names(mask)}] — ${r.kg}kg, 가치 ${r.value}.${r.kg > KN_W ? ` <b>${KN_W}kg을 넘어</b> 버립니다.` : r.up ? ` 지금까지 최고입니다.` : ' 최고 기록에는 못 미칩니다.'}`, snap(mask, r));
          }
          for (let from = single; from < total; from += chunk) {
            let over = 0;
            for (let mask = from; mask < from + chunk; mask++) if (calc(mask).kg > KN_W) over++;
            t.step(6, `조합 ${from + 1} ~ ${from + chunk}번째를 같은 방식으로 확인합니다. ${chunk}개 중 <b>${over}개</b>는 용량 초과였습니다. 지금까지 최고는 [${names(bestMask)}], 가치 <b>${best}</b>.`, snap(bestMask, weigh(bestMask), true));
          }
          t.step(8, `${total}가지를 전부 확인했습니다. 최고는 [${names(bestMask)}], 가치 <b>${best}</b>. 물건이 하나 늘면 이 과정이 통째로 2배가 됩니다.`, snap(bestMask, weigh(bestMask), true));
        },
      },
      {
        name: 'DP (표 채우기)', tone: 'good', big: { time: 'O(n × W)', space: 'O(n × W)' },
        code: `function knapsack(items, W) {
  const dp = [Array(W + 1).fill(0)];
  for (let i = 1; i <= items.length; i++) {
    const { kg, val } = items[i - 1]; dp[i] = [];
    for (let w = 0; w <= W; w++) {
      dp[i][w] = dp[i - 1][w];
      if (w < kg) continue;
      const put = dp[i - 1][w - kg] + val;
      dp[i][w] = Math.max(dp[i][w], put);
    }
  }
  return dp[items.length][W];
}`,
        notes: { 6: '안 넣는 경우 = 바로 윗칸', 8: '넣는 경우 = 남은 용량의 답 + 가치' },
        run(t, n) {
          const items = KN_ITEMS.slice(0, n);
          t.m['계산한 경우 수'] = 0;
          const dp = [Array(KN_W + 1).fill(0)];
          const table = (hot, deps, path) => ({
            type: 'cells', cols: KN_W + 2, compact: true, title: 'dp[i][w] — 세로: 어디까지의 물건을 고려했는가, 가로: 배낭 용량 w(kg)',
            items: [
              { id: 'c', v: 'w →', s: 'hole' },
              ...Array.from({ length: KN_W + 1 }, (_, w) => ({ id: `h${w}`, v: w, s: 'hole' })),
              ...Array.from({ length: n + 1 }, (_, i) => [
                { id: `r${i}`, v: i ? `~${items[i - 1].name}` : '없음', s: 'hole' },
                ...Array.from({ length: KN_W + 1 }, (_, w) => {
                  const key = `${i}-${w}`, has = dp[i] && dp[i][w] !== undefined;
                  return { id: key, v: has ? dp[i][w] : '', s: path && path.includes(key) ? 'done' : hot && hot.includes(key) ? 'active' : deps && deps.includes(key) ? 'cmp' : has ? '' : 'dim' };
                }),
              ]).flat(),
            ],
          });
          t.step(2, `표의 한 칸은 "여기까지의 물건으로, 용량이 w일 때의 최대 가치"입니다. 물건이 없는 첫 줄은 전부 0입니다.`, [knItems(items, () => ''), table()]);
          for (let i = 1; i <= n; i++) {
            const { name, kg, val: value } = items[i - 1];
            dp[i] = [];
            const skip = [];
            for (let w = 0; w < kg && w <= KN_W; w++) { dp[i][w] = dp[i - 1][w]; t.m['계산한 경우 수']++; skip.push(`${i}-${w}`); }
            t.step(7, `${name}(${kg}kg, 가치 ${value})를 고려하는 줄입니다. 용량 ${kg - 1}kg 이하 칸에는 ${name}가 들어가지 않으므로 <b>윗줄 값을 그대로</b> 가져옵니다.`, [knItems(items, (k) => (k === i - 1 ? 'active' : k < i - 1 ? 'dim' : '')), table(skip, skip.map((key) => `${i - 1}-${key.split('-')[1]}`))]);
            for (let w = kg; w <= KN_W; w++) {
              const no = dp[i - 1][w], yes = dp[i - 1][w - kg] + value;
              dp[i][w] = Math.max(no, yes); t.m['계산한 경우 수']++;
              t.step(9, `용량 ${w}kg: ${name}를 안 넣으면 윗칸 <b>${no}</b>, 넣으면 남는 ${w - kg}kg의 답 ${dp[i - 1][w - kg]} + ${value} = <b>${yes}</b>. 큰 쪽 <b>${dp[i][w]}</b>${yes > no ? `, ${name}를 넣습니다.` : '.'}`, [knItems(items, (k) => (k === i - 1 ? 'active' : k < i - 1 ? 'dim' : '')), table([`${i}-${w}`], [`${i - 1}-${w}`, `${i - 1}-${w - kg}`])]);
            }
          }
          const path = [], chosen = [];
          for (let i = n, w = KN_W; i >= 1; i--) {
            path.push(`${i}-${w}`);
            if (dp[i][w] !== dp[i - 1][w]) { chosen.unshift(i - 1); w -= items[i - 1].kg; }
            if (i === 1) path.push(`0-${w}`);
          }
          t.step(12, `오른쪽 아래 칸이 답입니다. 최대 가치 <b>${dp[n][KN_W]}</b>. 윗칸과 값이 달라진 줄의 물건이 담긴 것이므로, 거꾸로 따라가면 [${chosen.map((k) => items[k].name).join(', ')}]입니다. 계산한 칸은 ${n} × ${KN_W + 1} = <b>${t.m['계산한 경우 수']}칸</b>입니다.`, [knItems(items, (k) => (chosen.includes(k) ? 'done' : '')), table(null, null, path)]);
        },
      },
    ],
    points: [
      '<code>dp[i][w]</code>의 뜻: "앞의 i개 물건만 고려하고, 배낭 용량이 w일 때 얻을 수 있는 최대 가치". 각 칸은 <b>바로 윗줄의 두 칸</b>만 봅니다.',
      '완전 탐색이 느린 이유는 "남은 물건과 남은 용량이 같은 상황"을 여러 번 다시 계산하기 때문입니다. 표의 한 칸이 그 상황 하나를 대표합니다.',
      '가치 ÷ 무게가 높은 것부터 담는 그리디는 물건을 쪼갤 수 있을 때만 맞습니다. 쪼갤 수 없으면 남는 공간 때문에 틀릴 수 있습니다.',
      'O(n × W)는 용량 W라는 <b>숫자의 크기</b>에 비례합니다. 용량이 10억이면 표를 만들 수 없습니다. n이 작으면 완전 탐색, 가치가 작으면 "가치별 최소 무게"로 표를 뒤집습니다.',
    ],
    senior: '배낭은 "한정된 예산 안에서 무엇을 고를 것인가"의 원형입니다. 스프린트 용량 안에서 가치가 큰 작업 고르기, 광고 예산 배분, 한정된 메모리에 올릴 캐시 항목 선택이 같은 구조입니다. 다만 실무 데이터는 용량이 실수이거나 매우 커서 표를 그대로 만들 수 없는 경우가 많습니다. 그때는 단위를 묶어 용량을 줄이거나(정밀도와 맞바꿉니다), 비율 기준 그리디로 근사하고 오차를 받아들이거나, 정수 계획법 해결기를 씁니다. O(n × W)는 입력의 자릿수 기준으로는 다항 시간이 아니어서 "의사 다항 시간"이라고 부릅니다. 배낭 문제가 NP-난해인데도 DP로 풀리는 것처럼 보이는 이유입니다.',
    qa: [
      ['0/1 배낭 문제의 점화식을 설명해 주세요.', '<code>dp[i][w]</code>를 앞의 i개 물건으로 용량 w를 넘지 않게 담을 때의 최대 가치로 정의합니다. i번째 물건을 안 넣으면 <code>dp[i-1][w]</code>, 넣으면 <code>dp[i-1][w - 무게] + 가치</code>이고 둘 중 큰 값을 고릅니다. 무게가 w보다 크면 안 넣는 경우만 가능합니다. 시간과 공간은 O(n × W)이고, 윗줄만 보므로 1차원 배열로 줄일 수 있습니다.'],
      ['1차원 배열로 줄일 때 용량을 왜 큰 쪽부터 순회하나요?', '<code>dp[w] = max(dp[w], dp[w - 무게] + 가치)</code>에서 <code>dp[w - 무게]</code>는 이 물건을 아직 고려하지 않은 값이어야 합니다. 작은 w부터 갱신하면 이미 이 물건을 넣은 값을 다시 참조해 같은 물건을 두 번 넣게 됩니다. 큰 w부터 내려오면 참조하는 칸이 아직 갱신 전이라 윗줄 값을 보는 것과 같습니다. 반대로 같은 물건을 여러 번 써도 되는 문제는 작은 쪽부터 돕니다.'],
      ['배낭 문제에 그리디를 쓰면 안 되는 이유는 무엇인가요?', '가치 ÷ 무게 비율이 높은 순으로 담으면, 물건을 쪼갤 수 없을 때 남는 공간이 생겨 최적이 아닐 수 있습니다. 용량 7에 (5kg, 가치 8), (4kg, 5), (3kg, 4)가 있으면 비율 1위인 5kg짜리를 담은 뒤 아무것도 못 넣어 8이지만, 4kg과 3kg을 담으면 9입니다. 물건을 쪼갤 수 있는 분할 배낭에서는 비율 그리디가 최적입니다.'],
    ],
    ct: { signal: '"무게·비용 한도 안에서 가치의 합 최대", 물건은 쪼갤 수 없고 각각 한 번만 사용', how: '<code>dp[i][w]</code> = 앞의 i개로 용량 w일 때의 최대 가치. 넣는 경우와 안 넣는 경우 중 큰 값을 고릅니다.', big: 'O(n × W)', trap: '1차원 배열로 줄일 때 용량을 <b>큰 쪽에서 작은 쪽으로</b> 돌아야 합니다. 작은 쪽부터 돌면 같은 물건을 여러 번 넣게 됩니다(그것은 개수 제한이 없는 배낭의 풀이입니다).' },
  });

  /* ---------- 최소 신장 트리 (크루스칼) ---------- */
  const MST_POS = { A: [40, 30], B: [180, 22], C: [320, 30], D: [320, 116], E: [180, 124], F: [40, 116] };
  const MST_EDGES = [['A', 'B', 4], ['B', 'C', 8], ['C', 'D', 7], ['D', 'E', 9], ['E', 'F', 2], ['A', 'F', 1], ['B', 'E', 5], ['B', 'F', 3], ['C', 'E', 6]];
  const MST_N = Object.keys(MST_POS).length;
  const mstGraph = (title, nodeState, edgeState) => ({
    type: 'graph', w: 360, h: 146, scale: 1, title,
    nodes: [
      ...Object.keys(MST_POS).map((id) => ({ id, v: id, x: MST_POS[id][0], y: MST_POS[id][1], round: true, s: nodeState(id) })),
      ...MST_EDGES.map(([a, b, c]) => ({ id: `w${a}${b}`, v: c, bare: true, w: 16, h: 16, x: (MST_POS[a][0] + MST_POS[b][0]) / 2, y: (MST_POS[a][1] + MST_POS[b][1]) / 2 })),
    ],
    edges: MST_EDGES.map(([a, b], k) => ({ a, b, s: edgeState(k) })),
  });
  const mstSpans = (idx) => {
    const p = {};
    const find = (x) => (p[x] === undefined || p[x] === x ? x : (p[x] = find(p[x])));
    let merged = 0;
    for (const k of idx) { const ra = find(MST_EDGES[k][0]), rb = find(MST_EDGES[k][1]); if (ra !== rb) { p[ra] = rb; merged++; } }
    return merged === MST_N - 1;
  };
  const mstCombos = () => {
    const out = [], cur = [];
    const go = (from) => {
      if (cur.length === MST_N - 1) { out.push([...cur]); return; }
      for (let k = from; k < MST_EDGES.length; k++) { cur.push(k); go(k + 1); cur.pop(); }
    };
    go(0);
    return out;
  };
  CS.add({
    id: 'mst-kruskal', level: 'adv', topic: 'algo',
    title: '최소 신장 트리(크루스칼): 싼 간선부터, 사이클만 피해서',
    summary: '지점 6곳을 케이블로 모두 잇되 총비용을 가장 작게 하려면 어떤 간선을 골라야 할까요? 간선 조합을 전부 만들어 보는 방법과, 싼 간선부터 보면서 "이미 이어진 두 곳을 또 잇는 간선"만 버리는 방법을 비교합니다. 이미 이어졌는지는 유니온 파인드로 판정합니다.',
    headline: '살펴본 후보 수',
    verdict: '간선 9개에서 5개를 고르는 조합 126가지를 전부 검사한 결과와, 싼 간선부터 7개만 본 결과가 같은 비용 19입니다. 크루스칼은 "지금 가장 싼 간선을 골라도 나중에 손해 보지 않는다"는 것이 증명된 그리디입니다. 사이클 판정을 유니온 파인드에 맡기면 전체 비용은 간선 정렬 O(E log E)가 좌우합니다.',
    variants: [
      {
        name: '완전 탐색 (간선 조합 전부)', tone: 'bad', big: { time: 'O(C(E, V-1) × V)', space: 'O(V)' },
        code: `function mst(n, edges) {
  let best = Infinity;
  for (const combo of combinations(edges, n - 1)) {
    if (!connectsAll(n, combo)) continue;
    best = Math.min(best, sumCost(combo));
  }
  return best;
}`,
        notes: { 3: '모든 조합', 4: '사이클이 있으면 어딘가 끊김' },
        run(t) {
          t.m['살펴본 후보 수'] = 0; t.m['찾은 최소 비용'] = 0;
          const combos = mstCombos();
          let best = Infinity, bestC = null, trees = 0;
          const label = (c) => c.map((k) => `${MST_EDGES[k][0]}–${MST_EDGES[k][1]}`).join(', ');
          const check = (c) => {
            t.m['살펴본 후보 수']++;
            if (!mstSpans(c)) return null;
            trees++;
            const cost = c.reduce((s, k) => s + MST_EDGES[k][2], 0);
            if (cost < best) { best = cost; bestC = c; t.m['찾은 최소 비용'] = best; }
            return cost;
          };
          const snap = (c, s, cost) => [
            mstGraph('지점 6곳과 놓을 수 있는 케이블 9개 — 숫자는 설치 비용', () => '', (k) => (c && c.includes(k) ? s : c ? 'dim' : '')),
            {
              type: 'cells', title: '검사 현황',
              items: [
                { id: 'n', v: `검사 ${t.m['살펴본 후보 수']} / ${combos.length}` },
                { id: 't', v: `신장 트리 ${trees}개` },
                { id: 'c', v: `이번 비용 ${cost == null ? '–' : cost}` },
                { id: 'b', v: `최소 비용 ${best === Infinity ? '–' : best}`, s: best === Infinity ? '' : 'done' },
              ],
            },
          ];
          t.step(3, `노드 ${MST_N}개를 사이클 없이 전부 이으려면 간선이 정확히 ${MST_N - 1}개 필요합니다. 간선 ${MST_EDGES.length}개 중 ${MST_N - 1}개를 고르는 방법은 <b>${combos.length}가지</b>입니다. 전부 검사합니다.`, snap());
          const single = 5, chunk = 11;
          for (let k = 0; k < single; k++) {
            const cost = check(combos[k]);
            t.step(cost == null ? 4 : 5, cost == null ? `조합 ${k + 1}: ${label(combos[k])} — 한쪽에서 사이클이 생기고 다른 쪽이 끊깁니다. 탈락.` : `조합 ${k + 1}: ${label(combos[k])} — 전부 이어집니다. 비용 <b>${cost}</b>.${cost === best ? ' 지금까지 최소입니다.' : ''}`, snap(combos[k], cost == null ? 'bad' : 'new', cost));
          }
          for (let from = single; from < combos.length; from += chunk) {
            const to = Math.min(combos.length, from + chunk), before = trees;
            for (let k = from; k < to; k++) check(combos[k]);
            t.step(5, `조합 ${from + 1} ~ ${to}: 전부 이어진 것은 ${to - from}개 중 ${trees - before}개입니다. 지금까지 최소 비용은 <b>${best}</b> (${label(bestC)}).`, snap(bestC, 'done', best));
          }
          t.step(7, `${combos.length}가지를 전부 검사했습니다. 그중 ${trees}가지가 신장 트리였고, 최소 비용은 <b>${best}</b>입니다. 간선이 조금만 늘어도 조합 수는 감당할 수 없게 커집니다.`, snap(bestC, 'done', best));
        },
      },
      {
        name: '크루스칼 (싼 간선부터 + 유니온 파인드)', tone: 'good', big: { time: 'O(E log E)', space: 'O(V)' },
        code: `function mst(n, edges) {
  edges.sort((x, y) => x.cost - y.cost);
  let total = 0, picked = 0;
  for (const { a, b, cost } of edges) {
    const ra = find(a), rb = find(b);
    if (ra === rb) continue;
    parent[ra] = rb; total += cost;
    if (++picked === n - 1) break;
  }
  return total;
}`,
        notes: { 2: '전체에서 가장 비싼 단계', 6: '대표가 같다 = 이미 이어짐 → 사이클', 7: '두 그룹을 하나로 (union)' },
        run(t) {
          t.m['살펴본 후보 수'] = 0; t.m['찾은 최소 비용'] = 0;
          const order = MST_EDGES.map((_, k) => k).sort((x, y) => MST_EDGES[x][2] - MST_EDGES[y][2]);
          const parent = {}, st = {};
          for (const id of Object.keys(MST_POS)) parent[id] = id;
          const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
          let picked = 0, total = 0;
          const snap = (cur, changed) => [
            mstGraph('초록: 고른 간선 · 흐린 선: 버렸거나 보지 않은 간선', (id) => (cur != null && MST_EDGES[cur].slice(0, 2).includes(id) ? 'active' : order.some((k) => st[k] === 'done' && MST_EDGES[k].slice(0, 2).includes(id)) ? 'done' : ''), (k) => st[k] || ''),
            { type: 'cells', compact: true, title: '비용순으로 정렬한 간선 (아래: 비용)', items: order.map((k) => ({ id: k, v: `${MST_EDGES[k][0]}–${MST_EDGES[k][1]}`, sub: MST_EDGES[k][2], s: st[k] === 'active' ? 'active' : st[k] === 'done' ? 'done' : st[k] === 'bad' ? 'bad' : st[k] === 'dim' ? 'dim' : '' })) },
            { type: 'cells', compact: true, title: 'parent (아래: 노드) — 자기 자신을 가리키면 그룹의 대표', items: Object.keys(MST_POS).map((id) => ({ id, v: parent[id], sub: id, s: id === changed ? 'new' : '' })) },
          ];
          t.step(2, `간선 ${MST_EDGES.length}개를 비용이 싼 순서로 정렬합니다. 처음에는 모든 노드가 혼자인 그룹이고, 각자 자기 자신이 대표입니다.`, snap());
          for (const k of order) {
            const [a, b, cost] = MST_EDGES[k];
            t.m['살펴본 후보 수']++;
            const ra = find(a), rb = find(b);
            st[k] = 'active';
            if (ra === rb) {
              st[k] = 'bad';
              t.step(6, `${a}–${b} (비용 ${cost}): <code>find(${a})</code>와 <code>find(${b})</code>가 둘 다 <b>${ra}</b>입니다. 이미 다른 길로 이어져 있어, 이 간선을 넣으면 <b>사이클</b>이 생깁니다. 버립니다.`, snap(k));
              st[k] = 'dim';
              continue;
            }
            t.step(5, `${a}–${b} (비용 ${cost}): <code>find(${a})</code> = ${ra}, <code>find(${b})</code> = ${rb}. 대표가 다르므로 아직 이어지지 않은 두 그룹입니다.`, snap(k));
            parent[ra] = rb; picked++; total += cost; st[k] = 'done';
            t.m['찾은 최소 비용'] = total;
            t.step(7, `이 간선을 고르고 <code>parent[${ra}] = ${rb}</code>로 두 그룹을 합칩니다. 고른 간선 ${picked}개, 비용 합 <b>${total}</b>.`, snap(k, ra));
            if (picked === MST_N - 1) break;
          }
          const rest = order.filter((k) => !st[k]);
          for (const k of rest) st[k] = 'dim';
          t.step(10, `간선 ${MST_N - 1}개로 ${MST_N}곳이 모두 이어졌습니다. 최소 비용 <b>${total}</b>. 더 비싼 간선 ${rest.length}개는 볼 필요도 없었습니다. 살펴본 간선은 <b>${t.m['살펴본 후보 수']}개</b>입니다.`, snap());
        },
      },
    ],
    points: [
      '신장 트리는 모든 노드를 잇되 사이클이 없는 간선 n-1개입니다. 그중 비용 합이 가장 작은 것이 최소 신장 트리(MST)입니다.',
      '사이클 판정이 <code>find(a) === find(b)</code> 한 줄입니다. 간선마다 DFS로 "이미 이어져 있나"를 탐색하면 간선당 O(V)지만, 유니온 파인드는 거의 O(1)입니다.',
      '그리디가 맞는 이유(컷 성질): 노드를 두 무리로 어떻게 나누든, 두 무리를 잇는 간선 중 가장 싼 것을 포함하는 최소 신장 트리가 반드시 존재합니다.',
      '프림 알고리즘은 한 노드에서 시작해 "지금 트리에 붙일 수 있는 가장 싼 간선"을 힙에서 꺼냅니다. 간선이 매우 많은 그래프에서 유리합니다.',
    ],
    senior: '실무에서 MST를 직접 구현할 일은 드물지만 같은 사고는 여러 곳에 있습니다. 가까운 점부터 묶어 가는 단일 연결 군집화는 크루스칼과 같은 순서로 진행되고, 유니온 파인드로 구현합니다. 네트워크 스위치의 스패닝 트리 프로토콜도 루프 없는 연결을 만들지만, 그것은 총비용 최소가 아니라 루트 스위치까지의 경로를 기준으로 고른 트리라는 점이 다릅니다. 설계할 때 기억할 것은 MST가 줄여 주는 것이 "전체 설치 비용"뿐이라는 점입니다. 두 지점 사이의 경로 길이는 보장하지 않고, 간선 하나가 끊기면 망이 둘로 갈라집니다. 그래서 실제 망은 MST를 뼈대로 삼고 이중화 간선을 더합니다.',
    qa: [
      ['크루스칼 알고리즘을 설명하고 시간 복잡도를 말해 주세요.', '간선을 비용 오름차순으로 정렬한 뒤 하나씩 보면서, 두 끝이 아직 다른 그룹이면 고르고 두 그룹을 합칩니다. 이미 같은 그룹이면 사이클이 생기므로 버립니다. n-1개를 고르면 끝입니다. 그룹 판정은 유니온 파인드로 거의 O(1)이라 전체는 정렬 비용인 O(E log E)입니다.'],
      ['싼 간선부터 고르는 그리디가 왜 최적을 보장하나요?', '컷 성질 때문입니다. 노드를 두 무리로 나누면 신장 트리는 두 무리를 적어도 한 번은 이어야 합니다. 그 사이의 가장 싼 간선을 쓰지 않은 트리가 있다면, 두 무리를 잇던 더 비싼 간선을 그것으로 바꿔도 여전히 신장 트리이고 비용은 늘지 않습니다. 크루스칼이 고르는 간선은 항상 서로 다른 두 그룹을 잇는 가장 싼 간선이므로 이 성질을 만족합니다.'],
      ['크루스칼과 프림은 어떻게 다르고 언제 무엇을 쓰나요?', '크루스칼은 간선 중심으로, 전체 간선을 정렬해 여러 조각을 합쳐 갑니다. 프림은 정점 중심으로, 한 트리를 키우며 인접 간선을 힙에서 꺼냅니다. 간선이 적은 희소 그래프나 입력이 간선 목록으로 주어지면 크루스칼이 간단하고, 간선이 매우 많은 밀집 그래프는 프림(인접 행렬이면 O(V²))이 유리합니다. 결과 비용은 같습니다.'],
    ],
    ct: { signal: '"모든 지점을 연결하는 최소 비용", 도로·케이블·다리 놓기, 간선 n-1개로 전부 잇기', how: '간선을 비용순으로 정렬하고, 두 끝의 대표가 다를 때만 고르고 합칩니다(크루스칼 + 유니온 파인드).', big: 'O(E log E)', trap: '끝까지 돌았는데 고른 간선이 n-1개가 안 되면 그래프가 처음부터 끊겨 있는 것입니다. 이 확인을 빠뜨리지 않습니다. 최단 경로 문제와 혼동하지 않습니다. MST 위의 경로가 두 지점 사이의 최단 경로는 아닙니다.' },
  });

  /* ---------- KMP ---------- */
  const KMP_T = 'ABABABABABABABAC', KMP_P = 'ABABAC';
  const kmpPanels = (o) => {
    const { shift, j, st, textPtr, fail, mark } = o;
    const at = shift + j;
    return [
      {
        type: 'cells', compact: true, title: `텍스트 (${KMP_T.length}글자) — 아래 숫자는 위치`,
        items: [...KMP_T].map((ch, k) => ({ id: `t${k}`, v: ch, sub: k, s: o.build ? 'dim' : k < shift ? 'dim' : k < at ? 'done' : k === at ? st || '' : '', ptr: !o.build && k === at && textPtr ? textPtr : '' })),
      },
      {
        type: 'cells', compact: true, title: fail ? '패턴 — 아래 숫자는 실패 함수 fail (불일치 때 j가 돌아갈 곳)' : '패턴 — 텍스트의 어느 위치에 대고 있는가',
        items: [
          ...Array.from({ length: shift }, (_, k) => ({ id: `sp${k}`, v: '', s: 'hole' })),
          ...[...KMP_P].map((ch, k) => ({ id: `p${k}`, v: ch, sub: fail ? (fail[k] === undefined ? '' : fail[k]) : '', s: mark ? mark(k) : k < j ? 'done' : k === j ? st || '' : '', ptr: !o.build && k === j ? 'j' : '' })),
        ],
      },
    ];
  };
  CS.add({
    id: 'kmp', level: 'senior', topic: 'algo',
    title: 'KMP: 문자열 검색에서 되돌아가지 않기',
    summary: '긴 텍스트에서 패턴을 찾을 때 가장 단순한 방법은, 글자가 어긋나면 패턴을 한 칸 옮기고 처음부터 다시 비교하는 것입니다. 하지만 방금 맞춰 본 글자들은 이미 아는 정보입니다. KMP는 패턴 자신의 겹침을 미리 계산해 두고(실패 함수), 텍스트를 다시 읽지 않고 패턴만 건너뜁니다.',
    headline: '글자 비교 횟수',
    verdict: '같은 텍스트에서 단순한 방법은 글자를 41번 비교했고, KMP는 실패 함수를 만드는 7번을 포함해 28번 비교했습니다. 단순한 방법은 텍스트를 20칸 되돌아가 다시 읽었지만 KMP는 한 칸도 되돌아가지 않았습니다. 패턴이 길고 반복이 많을수록 차이는 O(n × m) 대 O(n + m)으로 벌어집니다.',
    variants: [
      {
        name: '한 칸 옮기고 처음부터', tone: 'bad', big: { time: 'O(n × m)', space: 'O(1)' },
        code: `function search(text, pat) {
  const n = text.length, m = pat.length;
  for (let s = 0; s + m <= n; s++) {
    let j = 0;
    while (j < m && text[s + j] === pat[j]) j++;
    if (j === m) return s;
  }
  return -1;
}`,
        notes: { 3: '어긋나면 한 칸만 이동', 4: '맞춘 것을 전부 잊음', 5: '시작 위치마다 최대 m번' },
        run(t) {
          t.m['글자 비교 횟수'] = 0; t.m['텍스트를 되돌아간 칸 수'] = 0;
          const n = KMP_T.length, m = KMP_P.length;
          t.step(1, `텍스트에서 패턴 <code>${KMP_P}</code>가 처음 나오는 위치를 찾습니다. 패턴을 텍스트 맨 앞에 대고 한 글자씩 비교합니다.`, kmpPanels({ shift: 0, j: 0 }));
          let lastJ = 0;
          for (let s = 0; s + m <= n; s++) {
            let j = 0;
            if (s > 0) {
              const back = Math.max(0, lastJ - 1);
              t.m['텍스트를 되돌아간 칸 수'] += back;
              if (s <= 2) t.step(4, `패턴을 한 칸 옮기고 <code>j = 0</code>부터 다시 비교합니다.${back ? ` 텍스트 ${s} ~ ${s + back - 1}번은 방금 읽은 글자인데 <b>${back}칸 되돌아가</b> 또 읽습니다.` : ''}`, kmpPanels({ shift: s, j: 0, st: 'cmp', textPtr: 's+j' }));
            }
            const detail = s === 0;
            while (j < m) {
              t.m['글자 비교 횟수']++;
              if (KMP_T[s + j] !== KMP_P[j]) break;
              if (detail) t.step(5, `텍스트 ${s + j}번 <code>${KMP_T[s + j]}</code> = 패턴 ${j}번 <code>${KMP_P[j]}</code>. 일치하므로 다음 글자로 갑니다.`, kmpPanels({ shift: s, j, st: 'done', textPtr: 's+j' }));
              j++;
            }
            if (j === m) {
              t.step(6, `시작 위치 ${s}: 패턴 ${m}글자가 전부 일치합니다. <b>${s}번 위치</b>에서 찾았습니다. 비교는 모두 <b>${t.m['글자 비교 횟수']}번</b>, 되돌아가 다시 읽은 칸은 ${t.m['텍스트를 되돌아간 칸 수']}칸입니다.`, kmpPanels({ shift: s, j: m }));
              return;
            }
            t.step(5, j === 0 ? `시작 위치 ${s}: 첫 글자부터 <code>${KMP_T[s]}</code> ≠ <code>${KMP_P[0]}</code>. 비교 1번으로 끝났습니다.` : `시작 위치 ${s}: ${j}글자가 맞다가 텍스트 ${s + j}번 <code>${KMP_T[s + j]}</code> ≠ 패턴 ${j}번 <code>${KMP_P[j]}</code>에서 어긋났습니다. ${detail ? '' : `비교 ${j + 1}번. `}맞춘 ${j}글자는 버려집니다.`, kmpPanels({ shift: s, j, st: 'bad', textPtr: 's+j' }));
            lastJ = j;
          }
        },
      },
      {
        name: 'KMP (실패 함수로 건너뛰기)', tone: 'good', big: { time: 'O(n + m)', space: 'O(m)' },
        code: `function search(text, pat) {
  const fail = buildFail(pat);
  let i = 0, j = 0;
  while (i < text.length) {
    if (text[i] === pat[j]) {
      i++; j++;
      if (j === pat.length) return i - j;
    } else if (j > 0) j = fail[j - 1];
    else i++;
  }
  return -1;
}`,
        notes: { 2: '패턴만 보고 미리 계산: O(m)', 6: 'i는 앞으로만 감', 8: '패턴만 건너뜀, i는 그대로' },
        run(t) {
          t.m['글자 비교 횟수'] = 0; t.m['텍스트를 되돌아간 칸 수'] = 0;
          const n = KMP_T.length, m = KMP_P.length, fail = [0];
          const pre = (k) => KMP_P.slice(0, k);
          t.step(2, `검색 전에 패턴만 보고 <b>실패 함수</b>를 만듭니다. <code>fail[k]</code>는 패턴의 앞 k+1글자에서 "앞부분과 뒷부분이 똑같이 겹치는 가장 긴 길이"입니다. 한 글자는 겹칠 것이 없어 0입니다.`, kmpPanels({ shift: 0, j: 0, build: true, fail: [...fail], mark: (k) => (k === 0 ? 'active' : '') }));
          for (let i = 1, j = 0; i < m; i++) {
            let cmp = 0;
            while (true) {
              cmp++; t.m['글자 비교 횟수']++;
              if (KMP_P[i] === KMP_P[j]) { j++; break; }
              if (j === 0) break;
              j = fail[j - 1];
            }
            fail[i] = j;
            const L = j, cur = i;
            t.step(2, L ? `<code>${pre(cur + 1)}</code>: 앞 ${L}글자 <code>${pre(L)}</code>와 뒤 ${L}글자 <code>${KMP_P.slice(cur + 1 - L, cur + 1)}</code>가 같습니다. <code>fail[${cur}] = ${L}</code>.` : `<code>${pre(cur + 1)}</code>: 앞부분과 뒷부분이 겹치는 곳이 없습니다. <code>fail[${cur}] = 0</code>. (비교 ${cmp}번)`, kmpPanels({ shift: 0, j: 0, build: true, fail: [...fail], mark: (k) => (k > cur ? 'dim' : L && k > cur - L ? 'active' : k < L ? 'cmp' : '') }));
          }
          const built = t.m['글자 비교 횟수'];
          let i = 0, j = 0, run = 0;
          t.step(3, `실패 함수 준비에 비교 ${built}번이 들었습니다. 이제 검색합니다. <code>i</code>는 텍스트 위치, <code>j</code>는 패턴 위치입니다.`, kmpPanels({ shift: 0, j: 0, fail, textPtr: 'i' }));
          while (i < n) {
            t.m['글자 비교 횟수']++;
            if (KMP_T[i] === KMP_P[j]) {
              const detail = i < 8;
              i++; j++; run++;
              if (j === m) {
                t.step(7, `${run > 1 ? `${run}글자가 연속으로 일치해 ` : ''}패턴 끝까지 맞았습니다. <b>${i - j}번 위치</b>에서 찾았습니다. 비교는 준비 ${built}번을 포함해 <b>${t.m['글자 비교 횟수']}번</b>, <code>i</code>는 한 번도 뒤로 가지 않았습니다.`, kmpPanels({ shift: i - j, j: m, fail }));
                return;
              }
              if (detail) { t.step(6, `텍스트 ${i - 1}번 <code>${KMP_T[i - 1]}</code> = 패턴 ${j - 1}번 <code>${KMP_P[j - 1]}</code>. 둘 다 한 칸 전진합니다.`, kmpPanels({ shift: i - j, j, st: 'cmp', fail, textPtr: 'i' })); run = 0; }
            } else if (j > 0) {
              const from = j, was = run;
              j = fail[j - 1]; run = 0;
              t.step(8, `${was > 1 ? `${was}글자가 일치한 뒤 ` : ''}텍스트 ${i}번 <code>${KMP_T[i]}</code> ≠ 패턴 ${from}번 <code>${KMP_P[from]}</code>. 방금 맞춘 <code>${pre(from)}</code>의 끝 ${j}글자는 패턴의 앞 ${j}글자와 같으므로 <b>이미 맞춘 셈</b>입니다. <code>j = fail[${from - 1}] = ${j}</code>, 패턴만 ${from - j}칸 건너뛰고 <code>i</code>는 그대로입니다.`, kmpPanels({ shift: i - j, j, st: 'cmp', fail, textPtr: 'i' }));
            } else {
              i++;
              t.step(9, `패턴의 첫 글자부터 다릅니다. <code>i</code>만 한 칸 전진합니다.`, kmpPanels({ shift: i, j: 0, st: 'cmp', fail, textPtr: 'i' }));
            }
          }
        },
      },
    ],
    points: [
      '<code>fail[k]</code>는 패턴의 앞 k+1글자에서 <b>접두사이면서 접미사</b>인 가장 긴 길이입니다(자기 전체는 제외). <code>ABABA</code>라면 <code>ABA</code>, 즉 3입니다.',
      '어긋났을 때, 지금까지 맞춘 부분의 끝이 패턴의 시작과 겹치는 만큼은 다시 비교할 필요가 없습니다. 그래서 텍스트 위치 <code>i</code>는 <b>뒤로 가지 않습니다.</b>',
      '실패 함수를 만드는 과정도 같은 방식입니다. 패턴을 패턴 자신에 대고 검색합니다. 준비 O(m), 검색 O(n)입니다.',
      '단순한 방법의 최악 O(n × m)은 반복이 많은 입력에서 나옵니다. 평범한 글에서는 대부분 첫 글자에서 어긋나 거의 O(n)에 끝납니다.',
    ],
    senior: 'KMP를 직접 구현해 서비스에 넣을 일은 드뭅니다. 언어와 표준 라이브러리의 검색 함수는 보통 투웨이(Two-Way)나 보이어-무어 계열처럼 평범한 입력에서 더 빠른 알고리즘을 쓰고, 첫 글자 후보를 벡터 명령으로 걸러 냅니다. KMP 계열의 가치는 <b>최악의 경우에도 선형</b>이라는 보장과 입력을 되돌아가 읽지 않는다는 성질에 있습니다. 사용자가 보낸 입력 때문에 검색 시간이 폭증하면 안 되는 서버(정규식 백트래킹과 같은 종류의 위험입니다), 네트워크에서 조각조각 들어오는 스트림에서 구분자를 찾는 파서가 그런 경우입니다. 여러 패턴을 한 번에 찾는 아호-코라식은 실패 함수를 트라이 위로 확장한 것으로, 금칙어 필터나 침입 탐지 시그니처 매칭에 쓰입니다.',
    qa: [
      ['KMP 알고리즘의 원리와 시간 복잡도를 설명해 주세요.', '불일치가 났을 때 이미 맞춘 부분의 정보를 버리지 않는 것이 핵심입니다. 패턴의 각 위치에 대해 접두사이면서 접미사인 최대 길이(실패 함수)를 미리 구해 두고, 불일치 때 패턴의 비교 위치만 그 값으로 옮깁니다. 텍스트 위치는 뒤로 가지 않으므로 검색 O(n), 실패 함수 준비 O(m), 합쳐 O(n + m)입니다. 단순한 방법은 최악 O(n × m)입니다.'],
      ['불일치 때 j가 여러 번 연달아 되돌아갈 수 있는데 왜 전체가 O(n)인가요?', '분할 상환으로 설명합니다. j는 글자가 일치할 때만 1씩 늘고, 늘어난 만큼만 줄어들 수 있습니다. i는 최대 n번 전진하므로 j가 늘어나는 횟수도 최대 n번, 따라서 되돌아가는 횟수의 합도 최대 n번입니다. 비교 횟수는 전체 2n을 넘지 않습니다.'],
      ['실무에서 문자열 검색에 KMP를 직접 쓰나요?', '대부분은 내장 검색 함수를 씁니다. 내장 구현은 투웨이나 보이어-무어 계열처럼 평균적으로 더 빠른 방법을 쓰는 경우가 많습니다. KMP의 발상이 필요한 것은 최악의 경우에도 선형이어야 할 때, 입력을 되돌려 읽을 수 없는 스트림일 때, 여러 패턴을 동시에 찾을 때(아호-코라식)입니다.'],
    ],
    ct: { signal: '긴 문자열에서 패턴 찾기(길이의 곱이 1억을 넘음), "접두사이면서 접미사", 문자열의 반복 주기', how: '패턴의 실패 함수(각 위치까지의 접두사 = 접미사 최대 길이)를 만들고, 불일치 때 그 값으로 패턴 위치만 되돌립니다.', big: 'O(n + m)', trap: '불일치 때 <code>j = fail[j - 1]</code>입니다(<code>fail[j]</code>가 아닙니다). 모든 위치를 찾을 때는 일치한 직후에도 <code>j = fail[j - 1]</code>로 이어 가야 겹쳐서 나오는 일치를 놓치지 않습니다.' },
  });

  /* ---------- 비트마스크 ---------- */
  const BM_PEOPLE = ['가', '나', '다', '라'], BM_DAYS = ['월', '화', '수', '목', '금'];
  const BM_AVAIL = [['월', '수', '금'], ['월', '화', '수'], ['수', '목', '금'], ['화', '목']];
  const BM_MASKS = BM_AVAIL.map((days) => days.reduce((m, d) => m | (1 << BM_DAYS.indexOf(d)), 0));
  const bmNames = (g) => BM_PEOPLE.filter((_, i) => g >> i & 1).join('·');
  const bmCount = (g) => BM_PEOPLE.filter((_, i) => g >> i & 1).length;
  CS.add({
    id: 'bitmask', level: 'mid', topic: 'algo',
    title: '비트마스크: 집합을 정수 하나로',
    summary: '원소가 서른 개 이하인 집합은 "i번째 비트가 1이면 i번 원소가 있다"는 약속으로 정수 하나에 담을 수 있습니다. 네 사람 중 "모두 함께 가능한 요일이 있는 가장 큰 모임"을 찾는 문제를, 배열로 집합을 들고 다니는 코드와 AND 연산 한 번으로 교집합을 구하는 코드로 풀어 봅니다.',
    headline: '기본 연산 횟수',
    verdict: '같은 모임 15가지를 검사하는 데 배열 쪽은 원소 비교와 복사를 302번 하고, 배열 63개를 만들었다가 버렸습니다. 비트마스크 쪽은 <code>&amp;</code> 연산 92번이 전부이고 새로 만든 배열은 없습니다. 요일 5개의 교집합이 AND 한 번으로 끝나고, 모든 부분집합은 정수를 1씩 올리는 것만으로 지나갑니다.',
    variants: [
      {
        name: '배열로 집합 표현', tone: 'bad', big: { time: 'O(2ⁿ × n × d²)', space: 'O(2ⁿ × n)' },
        code: `function bestGroup(people) {
  let best = [];
  for (const group of allSubsets(people)) {
    let common = ['월', '화', '수', '목', '금'];
    for (const p of group)
      common = common.filter((d) => p.includes(d));
    if (common.length && group.length > best.length)
      best = group;
  }
  return best;
}`,
        notes: { 1: "people[i] = ['월', '수', '금']", 3: '부분집합마다 새 배열', 6: '훑기 + 새 배열' },
        run(t) {
          t.m['기본 연산 횟수'] = 0; t.m['새로 만든 배열 수'] = 0;
          let best = 0, bestCommon = [];
          const grid = (g, cur, common) => ({
            type: 'cells', cols: 6, compact: true, title: '사람별 가능한 요일 배열 — 맨 아래는 지금까지의 공통 요일',
            items: [
              ...BM_PEOPLE.map((p, i) => [
                { id: `n${i}`, v: p, s: i === cur ? 'active' : g >> i & 1 ? 'new' : 'hole' },
                ...BM_DAYS.map((_, k) => ({ id: `a${i}-${k}`, v: BM_AVAIL[i][k] || '', s: !(g >> i & 1) ? 'dim' : BM_AVAIL[i][k] ? (i === cur ? 'cmp' : '') : 'dim' })),
              ]).flat(),
              { id: 'nc', v: '공통', s: 'hole' },
              ...BM_DAYS.map((_, k) => ({ id: `c${k}`, v: common[k] || '', s: common[k] ? 'done' : common.length ? 'dim' : k === 0 ? 'bad' : 'dim' })),
            ],
          });
          const snap = (g, cur, common) => [
            { type: 'cells', title: `group — allSubsets가 만든 배열 중 ${g + 1}번째`, items: BM_PEOPLE.map((p, i) => ({ id: p, v: p, s: g >> i & 1 ? 'active' : '' })).filter((x) => x.s) },
            grid(g, cur, common),
          ];
          t.m['새로 만든 배열 수'] = 1 << BM_PEOPLE.length;
          for (let g = 0; g < 1 << BM_PEOPLE.length; g++) t.m['기본 연산 횟수'] += bmCount(g);
          t.step(3, `네 사람의 모든 부분집합을 배열로 만듭니다. 배열 <b>${t.m['새로 만든 배열 수']}개</b>가 생기고, 사람을 옮겨 담는 복사가 ${t.m['기본 연산 횟수']}번 일어납니다. (이 변형은 원소 복사와 원소 비교를 각각 연산 1번으로 셉니다.)`, [{ type: 'cells', title: 'group', items: [] }, grid(15, -1, [...BM_DAYS])]);
          for (let g = 1; g < 1 << BM_PEOPLE.length; g++) {
            let common = [...BM_DAYS], cmpAll = 0;
            t.m['새로 만든 배열 수']++;
            const detail = g <= 3;
            for (let i = 0; i < BM_PEOPLE.length; i++) {
              if (!(g >> i & 1)) continue;
              let cmp = 0;
              const next = common.filter((d) => { const at = BM_AVAIL[i].indexOf(d); cmp += at < 0 ? BM_AVAIL[i].length : at + 1; return at >= 0; });
              t.m['기본 연산 횟수'] += cmp; t.m['새로 만든 배열 수']++; cmpAll += cmp;
              if (detail) t.step(6, `<code>common</code>의 요일 ${common.length}개마다 ${BM_PEOPLE[i]}의 배열을 앞에서부터 훑어 있는지 확인합니다. 문자열 비교 <b>${cmp}번</b>, 결과를 담을 새 배열 1개.`, snap(g, i, next));
              common = next;
            }
            const size = bmCount(g), up = common.length > 0 && size > bmCount(best);
            if (up) { best = g; bestCommon = common; }
            t.step(up ? 8 : 7, `[${bmNames(g)}]${detail ? '' : ` — 문자열 비교 ${cmpAll}번.`} 공통 요일은 ${common.length ? `<b>${common.join(', ')}</b>` : '<b>없습니다</b>'}.${up ? ` ${size}명으로 지금까지 가장 큰 모임입니다.` : ''}`, snap(g, -1, common));
          }
          t.step(10, `가장 큰 모임은 <b>[${bmNames(best)}]</b>, 공통 요일은 ${bestCommon.join(', ')}요일입니다. 원소 비교와 복사가 <b>${t.m['기본 연산 횟수']}번</b>, 중간에 만들고 버린 배열이 ${t.m['새로 만든 배열 수']}개입니다.`, snap(best, -1, bestCommon));
        },
      },
      {
        name: '비트마스크', tone: 'good', big: { time: 'O(2ⁿ × n)', space: 'O(1)' },
        code: `function bestGroup(masks, n) {
  let best = 0;
  for (let g = 1; g < (1 << n); g++) {
    let common = 0b11111;
    for (let i = 0; i < n; i++)
      if (g & (1 << i)) common &= masks[i];
    if (common && bitCount(g) > bitCount(best))
      best = g;
  }
  return best;
}`,
        notes: { 1: 'masks[i]의 비트 = 요일', 3: 'g의 비트 = 사람 · 1씩 더하면 모든 부분집합', 6: '교집합 = AND 한 번' },
        run(t) {
          t.m['기본 연산 횟수'] = 0; t.m['새로 만든 배열 수'] = 0;
          const n = BM_PEOPLE.length;
          let best = 0, bestCommon = 0;
          const dayNames = (m) => BM_DAYS.filter((_, k) => m >> k & 1).join(', ');
          const grid = (g, cur, common) => ({
            type: 'cells', cols: 6, compact: true, title: '사람별 가능한 요일 — 정수 하나의 비트 5개 (월 화 수 목 금). 맨 아래는 AND 결과',
            items: [
              { id: 'h', v: '', s: 'hole' }, ...BM_DAYS.map((d, k) => ({ id: `h${k}`, v: d, s: 'hole' })),
              ...BM_PEOPLE.map((p, i) => [
                { id: `n${i}`, v: p, s: i === cur ? 'active' : g >> i & 1 ? 'new' : 'hole' },
                ...BM_DAYS.map((_, k) => ({ id: `a${i}-${k}`, v: BM_MASKS[i] >> k & 1, s: !(g >> i & 1) ? 'dim' : BM_MASKS[i] >> k & 1 ? (i === cur ? 'cmp' : 'new') : '' })),
              ]).flat(),
              { id: 'nc', v: 'AND', s: common ? 'hole' : 'bad' },
              ...BM_DAYS.map((_, k) => ({ id: `c${k}`, v: common >> k & 1, s: common >> k & 1 ? 'done' : '' })),
            ],
          });
          const snap = (g, cur, common) => [
            { type: 'cells', title: `g = ${g} — 이진수로 ${g.toString(2).padStart(n, '0')}. 비트가 1인 사람이 이번 모임`, items: BM_PEOPLE.map((p, i) => ({ id: p, v: g >> i & 1, sub: p, s: g >> i & 1 ? 'active' : '' })).reverse() },
            grid(g, cur, common),
          ];
          t.step(1, `각 사람의 가능한 요일을 <b>정수 하나</b>로 받습니다. 비트 하나가 요일 하나이고, 1이면 가능하다는 뜻입니다. 배열은 만들지 않습니다. (이 변형은 <code>&amp;</code> 연산을 연산 1번으로 셉니다.)`, [{ type: 'cells', title: 'g — 비트 하나가 사람 한 명 (오른쪽 끝이 0번 비트)', items: BM_PEOPLE.map((p) => ({ id: p, v: 0, sub: p })).reverse() }, grid(15, -1, 31)]);
          for (let g = 1; g < 1 << n; g++) {
            let common = 31;
            const detail = g <= 3;
            if (detail) t.step(3, `<code>g = ${g}</code>, 이진수로 ${g.toString(2).padStart(n, '0')}입니다. 1인 자리의 사람 [${bmNames(g)}]가 이번 모임입니다. g에 1을 더해 가면 모든 부분집합이 한 번씩 나옵니다.`, snap(g, -1, common));
            for (let i = 0; i < n; i++) {
              t.m['기본 연산 횟수']++;
              if (!(g >> i & 1)) continue;
              common &= BM_MASKS[i]; t.m['기본 연산 횟수']++;
              if (detail) t.step(6, `<code>common &amp;= masks[${i}]</code> — ${BM_PEOPLE[i]}의 비트와 자리끼리 AND 합니다. 둘 다 1인 자리만 남습니다. 요일 5개를 <b>연산 한 번</b>에 비교했습니다.`, snap(g, i, common));
            }
            const size = bmCount(g), up = common !== 0 && size > bmCount(best);
            if (up) { best = g; bestCommon = common; }
            t.step(up ? 8 : 7, `g = ${g} [${bmNames(g)}]: AND 결과는 ${common ? `<b>${dayNames(common)}</b>` : '<b>0</b> — 공통 요일이 없습니다'}.${up ? ` ${size}명으로 지금까지 가장 큰 모임입니다.` : ''}`, snap(g, -1, common));
          }
          t.step(10, `가장 큰 모임은 <code>best = ${best}</code>, 즉 <b>[${bmNames(best)}]</b>이고 공통 요일은 ${dayNames(bestCommon)}요일입니다. <code>&amp;</code> 연산 <b>${t.m['기본 연산 횟수']}번</b>, 새로 만든 배열은 없습니다.`, snap(best, -1, bestCommon));
        },
      },
    ],
    points: [
      '넣기 <code>mask | (1 &lt;&lt; i)</code>, 있는지 <code>mask &amp; (1 &lt;&lt; i)</code>, 빼기 <code>mask &amp; ~(1 &lt;&lt; i)</code>, 뒤집기 <code>mask ^ (1 &lt;&lt; i)</code>. 합집합은 <code>a | b</code>, 교집합은 <code>a &amp; b</code>입니다.',
      '0부터 2ⁿ - 1까지 세는 것만으로 모든 부분집합을 빠짐없이 한 번씩 지납니다. 재귀도 배열 복사도 필요 없습니다.',
      '<b>n ≤ 20</b>이 신호입니다. 2²⁰은 약 100만이라 모든 부분집합을 볼 수 있고, 집합을 그대로 배열 인덱스로 써서 <code>dp[mask]</code>(방문한 도시 집합별 최소 비용 등)를 만들 수 있습니다.',
      'JS의 비트 연산은 32비트 정수로 동작합니다. 원소가 31개를 넘으면 <code>BigInt</code>를 쓰거나 숫자 여러 개에 나눠 담습니다.',
    ],
    senior: '비트마스크는 코딩 테스트 기법이기 전에 시스템 곳곳의 기본 표현입니다. 유닉스 파일 권한(읽기·쓰기·실행 3비트씩), 기능 플래그, TCP 헤더의 플래그, DB의 비트맵 인덱스, 블룸 필터가 모두 "비트 하나 = 예/아니오 하나"입니다. CPU는 예/아니오 64개를 명령 하나로 처리하고 캐시 라인 하나(64바이트)에 512개가 들어가므로, Set이나 boolean 배열보다 메모리와 속도 모두 크게 유리합니다. 대가는 가독성입니다. 플래그에 이름을 붙이고(<code>const CAN_WRITE = 1 &lt;&lt; 1</code>) 넣기·빼기·확인을 작은 함수로 감싸 두지 않으면 매직 넘버가 됩니다. DB 컬럼에 비트 필드로 저장하면 특정 플래그로 조회할 때 일반 인덱스를 쓰기 어렵다는 점도 설계 때 따져 봅니다.',
    qa: [
      ['비트마스크로 집합을 표현하면 무엇이 좋고, 한계는 무엇인가요?', '원소 i의 포함 여부를 i번째 비트로 나타내면 집합이 정수 하나가 됩니다. 합집합·교집합·포함 확인이 OR·AND 한 번이라 빠르고, 메모리를 거의 쓰지 않으며, 정수라서 배열 인덱스나 해시 키로 바로 쓸 수 있습니다. 한계는 원소 종류가 워드 크기(32 또는 64) 이하로 작아야 한다는 것과 코드가 읽기 어려워진다는 것입니다.'],
      ['n개 원소의 모든 부분집합을 순회하는 방법을 설명해 주세요.', '0부터 2ⁿ - 1까지의 정수를 차례로 봅니다. 각 정수의 이진수 표현에서 i번째 비트가 1이면 i번 원소를 고른 것으로 해석하면 모든 부분집합이 정확히 한 번씩 나옵니다. 전체는 O(2ⁿ × n)이라 n이 20 안팎일 때까지만 가능합니다. 재귀 백트래킹과 달리 중간에 가지를 치기는 어렵지만, 구현이 짧고 상태를 정수로 저장하기 쉽습니다.'],
      ['비트마스크 DP는 어떤 문제에 쓰나요?', '"지금까지 무엇을 골랐는가(방문했는가)"가 답에 영향을 주고 그 대상이 20개 안팎일 때 씁니다. 모든 도시를 한 번씩 도는 최소 비용(외판원 문제)은 <code>dp[방문 집합][현재 도시]</code>로 O(2ⁿ × n²)에 풉니다. 순열을 전부 시도하는 O(n!)과 달리, 방문 순서는 달라도 방문 집합과 현재 위치가 같은 경우를 하나로 합치는 것이 핵심입니다.'],
    ],
    ct: { signal: 'n ≤ 20, "고른 것들의 집합"이 곧 상태, 모든 부분집합 시도, 방문한 곳의 집합을 들고 다니는 최단 경로', how: '집합을 정수의 비트로 표현합니다. <code>0</code>부터 <code>(1 &lt;&lt; n) - 1</code>까지 세면 모든 부분집합을 지나고, <code>dp[mask]</code>처럼 집합을 배열 인덱스로 씁니다.', big: 'O(2ⁿ × n)', trap: '연산자 우선순위에 주의합니다. <code>mask &amp; 1 &lt;&lt; i === 0</code>은 <code>===</code>가 <code>&amp;</code>보다 먼저 계산됩니다. 괄호를 칩니다. JS에서 <code>1 &lt;&lt; 31</code>은 음수이고 <code>1 &lt;&lt; 32</code>는 1입니다.' },
  });
})();
