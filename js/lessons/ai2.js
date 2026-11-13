/* AI 2: 셀프 어텐션, KV 캐시, 프롬프트 캐싱, 에이전트 루프, 구조화된 출력(제약 디코딩), 양자화
   모델 내부를 단순화한 장난감 예제다. 벡터·확률·토큰 수는 원리를 보이기 위한 가정값이며 특정 모델의 실제 값이 아니다 */
(function () {
  const CS = window.CS;
  const num = (v) => v.toLocaleString('ko-KR');
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  /* ---------- 셀프 어텐션 ---------- */
  const AT = [
    { w: '서버', k: [2, 1], v: [4, 0] },
    { w: '가', k: [0, 0.2], v: [0, 1] },
    { w: '멈춰서', k: [0.5, 1], v: [1, 3] },
    { w: '내가', k: [1, -1], v: [0, 2] },
    { w: '그것', k: [0.5, 0.5], v: [1, 1] },
  ];
  const AT_Q = [1.5, 1], AT_I = 4;
  CS.add({
    id: 'attention', level: 'adv', topic: 'ai',
    title: '셀프 어텐션: 토큰이 문맥을 참고하는 방법',
    summary: '"그것"이 무엇을 가리키는지는 그 단어만 봐서는 알 수 없습니다. 셀프 어텐션은 한 토큰이 문장의 다른 토큰들을 각각 얼마나 참고할지 가중치를 계산하고, 그 비율대로 정보를 섞어 오는 연산입니다. 토큰 하나의 계산을 따라간 뒤, 문장이 길어지면 계산량이 어떻게 느는지 봅니다.',
    verdict: '"그것"은 가중치의 67%를 "서버"에 주고 그 정보를 섞어 왔습니다. 이 계산을 모든 토큰이 각자 하므로 5토큰 문장에서 점수 계산은 5 × 5 = 25번입니다. 토큰 수가 10배가 되면 쌍의 수는 100배가 됩니다.',
    variants: [{
      name: '토큰 하나의 어텐션, 그리고 문장 전체', tone: 'info', big: { time: 'O(n²) — 토큰 쌍마다 점수', space: 'O(n²)' },
      code: `function attend(tokens, i) {
  const q = tokens[i].query;
  const scores = tokens.map(t => dot(q, t.key) / Math.sqrt(D));
  const weights = softmax(scores);
  return mix(tokens.map(t => t.value), weights);
}
function layer(tokens) {
  return tokens.map((_, i) => attend(tokens, i));
}`,
      notes: { 3: '모든 토큰과 점수 계산', 4: '합이 1인 가중치로', 5: '가중치 비율로 섞기', 8: '토큰마다 반복 → n²' },
      run(t) {
        const n = AT.length;
        t.m['점수를 계산한 토큰 쌍'] = 0; t.m['문장 길이 (토큰)'] = n;
        const scores = [];
        let weights = null, out = null, grid = 0, cur = -1;
        const pct = (j) => Math.round(weights[j] * 100);
        const snap = () => [
          { type: 'cells', title: '문장의 토큰 — 아래 숫자는 각 토큰의 키 벡터 (가정값)', items: AT.map((x, j) => ({ id: j, v: x.w, sub: x.k.join(', '), gap: true, ptr: j === AT_I ? `질의 ${AT_Q.join(', ')}` : '', s: j === cur ? 'cmp' : j === AT_I ? 'active' : '' })) },
          weights
            ? { type: 'cells', bars: true, max: 80, title: '"그것"의 어텐션 가중치 (%) — 합하면 100', items: AT.map((x, j) => ({ id: j, v: pct(j), sub: x.w, gap: true, s: pct(j) >= 50 ? 'done' : '' })) }
            : { type: 'cells', bars: true, max: 3.4, title: '"그것"의 질의와 각 토큰의 키가 얼마나 맞는가 (점수)', items: scores.map((v, j) => ({ id: j, v: Math.round(v * 100) / 100, sub: AT[j].w, gap: true, s: j === cur ? 'cmp' : '' })) },
          ...(grid ? [{ type: 'cells', cols: n, compact: true, title: '행 = 참고하는 토큰, 열 = 참고되는 토큰 — 칸 하나가 점수 계산 한 번', items: AT.flatMap((_, i) => AT.map((__, j) => ({ id: `${i}-${j}`, v: i === AT_I ? pct(j) : '', s: i === AT_I ? 'done' : grid === 2 ? 'cmp' : '' }))) }]
            : out ? [{ type: 'cells', title: '값 벡터(가정값)를 가중치 비율로 섞기', items: [...AT.map((x, j) => ({ id: j, v: `[${x.v.join(', ')}]`, sub: `${x.w} × ${pct(j)}%`, gap: true, s: pct(j) >= 50 ? 'done' : '' })), { id: 'out', v: `[${out.join(', ')}]`, sub: '"그것"의 새 벡터', s: 'new' }] }] : []),
        ];
        t.step(1, `문장 "서버 가 멈춰서 내가 <b>그것</b>" 다음에 올 토큰을 예측하려면 "그것"이 무엇을 가리키는지 알아야 합니다. 그런데 토큰의 벡터에는 처음에 <b>자기 자신에 대한 정보만</b> 들어 있습니다.`, snap());
        t.step(2, `"그것"이 <b>질의(query) 벡터</b>를 냅니다. "나는 이런 정보를 찾는다"는 뜻입니다. 다른 토큰들은 각자 "나는 이런 토큰이다"를 나타내는 <b>키(key) 벡터</b>를 가집니다. 둘 다 학습으로 정해지는 값이고, 여기서는 2차원 가정값입니다.`, snap());
        AT.forEach((x, j) => {
          cur = j;
          const d = AT_Q[0] * x.k[0] + AT_Q[1] * x.k[1], s = d / Math.sqrt(2);
          scores.push(s); t.m['점수를 계산한 토큰 쌍']++;
          t.step(3, `"그것" → "${x.w}": 질의와 키를 내적하면 ${Math.round(d * 100) / 100}, 차원 수의 제곱근(√2)으로 나눠 점수 <b>${Math.round(s * 100) / 100}</b>. ${j === 0 ? '방향이 잘 맞을수록 점수가 큽니다.' : j === AT_I ? '자기 자신도 후보에 포함됩니다.' : s < 0.5 ? '거의 관련이 없다는 뜻입니다.' : ''}`, snap());
        });
        cur = -1;
        const e = scores.map((s) => Math.exp(s)), sum = e.reduce((a, b) => a + b, 0);
        weights = e.map((x) => x / sum);
        t.step(4, `점수를 softmax로 <b>합이 100%인 가중치</b>로 바꿉니다. "서버"가 ${pct(0)}%를 차지하고, 조사 "가"는 ${pct(1)}%뿐입니다. 큰 점수는 더 크게, 작은 점수는 더 작게 벌어집니다.`, snap());
        out = [0, 1].map((k) => Math.round(AT.reduce((a, x, j) => a + weights[j] * x.v[k], 0) * 100) / 100);
        t.step(5, `각 토큰이 내어 주는 <b>값(value) 벡터</b>를 가중치 비율로 더합니다. 결과 [${out.join(', ')}]가 "그것"의 새 벡터입니다.`, snap());
        t.step(5, `섞기 전 "그것"의 값은 [1, 1]이었는데, 이제 "서버"의 값 [4, 0] 쪽으로 크게 끌려갔습니다. <b>"그것 = 서버"라는 문맥이 벡터 안에 들어온 것</b>입니다. 검색처럼 하나를 고르는 것이 아니라 전부를 비율대로 섞습니다.`, snap());
        grid = 1;
        t.step(8, `지금까지는 "그것" 한 토큰의 계산이었습니다. 표에서 맨 아래 한 줄, 점수 계산 ${n}번에 해당합니다.`, snap());
        grid = 2;
        for (let i = 0; i < n; i++) if (i !== AT_I) for (let j = 0; j < n; j++) t.m['점수를 계산한 토큰 쌍']++;
        t.step(8, `나머지 토큰도 <b>각자 같은 계산</b>을 합니다(값은 생략). 토큰 ${n}개면 ${n} × ${n} = <b>${n * n}쌍</b>입니다. 이것이 층마다, 여러 벌(헤드)로 반복됩니다.`, snap());
        t.step(8, `쌍의 수는 토큰 수의 제곱입니다. 100토큰이면 10,000쌍, 10만 토큰이면 100억 쌍입니다. <b>컨텍스트가 길수록 계산과 메모리가 길이보다 빠르게 느는</b> 이유입니다.`, snap());
      },
    }],
    points: [
      '어텐션은 <b>질의·키·값</b> 세 벡터로 이뤄집니다. 질의와 키의 내적으로 "얼마나 관련 있는가"를 재고, 그 가중치로 값을 섞습니다. 세 벡터를 만드는 행렬이 학습되는 대상입니다.',
      '하나를 골라 가져오는 것이 아니라 <b>전부를 비율대로 섞습니다.</b> 그래서 미분이 가능하고, 경사 하강법으로 "무엇을 참고할지"를 학습할 수 있습니다.',
      '글을 생성하는 모델은 각 토큰이 <b>자기보다 앞쪽 토큰만</b> 참고하도록 뒤쪽을 가립니다. 그래도 쌍의 수는 n(n+1)/2로, 여전히 n²에 비례합니다.',
      '어텐션에는 순서 개념이 없으므로 위치 정보를 따로 넣어 줍니다. 실제 모델은 이 연산을 수십 층, 층마다 여러 헤드로 쌓습니다.',
    ],
    senior: '이 n² 구조가 API를 쓰는 쪽의 비용 감각과 이어집니다. 입력이 길수록 느려지고 비싸지며, 컨텍스트 윈도에 상한이 있는 근본 이유가 여기에 있습니다. 또 긴 컨텍스트를 넣을 수 있다는 것과 그 안의 정보를 고르게 잘 쓴다는 것은 다른 이야기입니다. 가중치의 합은 항상 100%이므로 관련 없는 내용이 많아지면 필요한 토큰에 돌아갈 몫이 줄어듭니다. 그래서 "일단 전부 넣기"보다 필요한 것만 골라 넣는 편(검색, 요약, 오래된 대화 정리)이 비용과 정확도 양쪽에서 유리한 경우가 많습니다. 다만 어텐션 가중치를 "모델이 그렇게 판단한 이유"로 읽는 것은 조심해야 합니다. 층과 헤드가 수없이 겹쳐 있어 한 층의 가중치만으로는 설명이 되지 않습니다.',
    qa: [
      ['셀프 어텐션이 하는 일을 설명해 주세요.', '각 토큰이 문장의 다른 토큰들을 얼마나 참고할지 가중치를 계산해, 그 비율대로 정보를 섞어 자기 벡터를 갱신하는 연산입니다. 토큰마다 질의·키·값 벡터를 만들고, 질의와 키의 내적을 softmax로 가중치로 바꾼 뒤 값 벡터의 가중 합을 구합니다. 이 과정을 거치면 "그것" 같은 토큰의 벡터에 가리키는 대상의 정보가 들어옵니다.'],
      ['입력이 길어지면 왜 비용이 길이에 비례하는 것보다 빠르게 늘어나나요?', '모든 토큰이 다른 모든 토큰과 점수를 계산하므로 쌍의 수가 n²이기 때문입니다. 토큰이 10배면 쌍은 100배입니다. 생성 모델은 뒤쪽을 가려 절반만 쓰지만 여전히 n²에 비례하고, 이것이 층과 헤드 수만큼 반복됩니다.'],
      ['컨텍스트 윈도가 충분히 큰데도 필요한 것만 골라 넣으라고 하는 이유는 무엇인가요?', '비용과 지연이 토큰 수에 따라 늘어나는 것이 첫째 이유입니다. 둘째로 어텐션 가중치는 합이 1이라 무관한 내용이 많으면 필요한 정보에 돌아갈 몫이 줄어, 긴 입력의 일부를 놓치는 일이 생깁니다. 그래서 검색이나 요약으로 관련 있는 부분만 넣는 편이 대체로 안전합니다.'],
    ],
  });

  /* ---------- KV 캐시 ---------- */
  const KV_P = ['로그', '를', '요약', '해줘'];
  const KV_OUT = ['디스크', '가', '가득', '찼고', '쓰기', '가', '실패', '했으며', '재시작', '으로', '복구', '했습니다'];
  const kvRun = (cached) => (t, n) => {
    const P = KV_P.length, K = '처리한 토큰-단계 수', C = 'KV 캐시에 보관한 토큰';
    t.m[K] = 0; t.m[C] = 0;
    const gen = [], per = [];
    let busy = [], fresh = -1, held = 0;
    const st = (i) => (busy.includes(i) ? 'cmp' : i === fresh ? 'new' : i < held ? 'done' : '');
    const snap = () => [
      { type: 'cells', compact: true, title: cached ? '프롬프트 4개 + 생성한 토큰 — 색이 남아 있는 칸은 키·값이 캐시에 있어 다시 계산하지 않음' : '프롬프트 4개 + 생성한 토큰 — 색이 켜진 칸이 이번 단계에 계산하는 토큰', items: [...KV_P.map((v, k) => ({ id: `p${k}`, v, s: st(k), gap: k === P - 1 })), ...gen.map((v, k) => ({ id: `g${k}`, v, s: st(P + k) }))] },
      { type: 'cells', bars: true, max: P + n - 1, title: '토큰 하나를 만들 때마다 모델이 처리한 토큰 수', items: per.map((v, k) => ({ id: k, v, sub: `${k + 1}번째`, s: k === per.length - 1 && busy.length ? 'active' : cached ? 'done' : 'bad' })) },
    ];
    const all = (len) => Array.from({ length: len }, (_, i) => i);
    if (!cached) {
      t.step(2, `프롬프트는 토큰 ${P}개이고, 답을 ${n}토큰 생성합니다. 모델은 한 번에 <b>다음 토큰 하나</b>만 내놓으므로 ${n}번 실행해야 합니다.`, snap());
      for (let i = 0; i < n; i++) {
        busy = all(P + i); per.push(P + i); t.m[K] += P + i;
        t.step(4, i === 0
          ? `1번째 토큰을 만들기 위해 프롬프트 ${P}개를 모든 층에 통과시킵니다.`
          : `${i + 1}번째 토큰을 만들려고 앞의 토큰 ${P + i}개를 <b>처음부터 전부</b> 다시 계산합니다. 그중 ${P + i - 1}개는 직전 단계에서 이미 계산했던 것입니다.`, snap());
        busy = []; gen.push(KV_OUT[i]); fresh = P + i;
        t.step(5, i === 0
          ? `맨 끝 위치의 결과로 다음 토큰 "<b>${KV_OUT[i]}</b>"를 고릅니다. 나머지 위치의 계산 결과는 버려집니다.`
          : `"<b>${KV_OUT[i]}</b>"를 붙입니다. 누적 ${num(t.m[K])} 토큰-단계. 단계마다 한 칸씩 더 길어집니다.`, snap());
      }
      fresh = -1;
      t.step(7, `${n}토큰을 만드는 데 <b>${num(t.m[K])} 토큰-단계</b>가 들었습니다. 앞쪽 토큰은 바뀌지 않았는데도 매번 다시 계산했습니다. 출력이 2배 길어지면 일은 약 4배가 됩니다.`, snap());
      return;
    }
    t.step(2, `같은 프롬프트, 같은 출력입니다. 이번에는 각 토큰이 어텐션에 내놓는 <b>키·값 벡터</b>를 층마다 저장해 둘 캐시를 준비합니다.`, snap());
    for (let i = 0; i < n; i++) {
      if (i === 0) {
        busy = all(P); per.push(P); t.m[K] += P; held = P; t.m[C] = held;
        t.step(6, `처음 한 번은 프롬프트 ${P}개를 전부 처리합니다(프리필). 이때 계산한 키·값을 캐시에 넣습니다. <b>첫 토큰이 나오기까지의 시간(TTFT)</b>은 이 단계, 즉 프롬프트 길이에 좌우됩니다.`, snap());
      } else {
        busy = [P + i - 1]; per.push(1); t.m[K] += 1; held = P + i; t.m[C] = held;
        t.step(6, i === 1
          ? `방금 만든 토큰 <b>1개만</b> 계산합니다. 앞의 ${P + i - 1}개는 다시 계산하지 않고, 캐시에 있는 키·값을 어텐션에서 <b>읽기만</b> 합니다.`
          : `새 토큰 1개만 계산하고 캐시에 추가합니다. 캐시에는 이제 ${held}개의 키·값이 있습니다.`, snap());
      }
      busy = []; gen.push(KV_OUT[i]); fresh = P + i;
      t.step(8, i === 0
        ? `첫 토큰 "<b>${KV_OUT[i]}</b>"가 나왔습니다. 다음 입력은 프롬프트 전체가 아니라 이 토큰 하나입니다.`
        : `"<b>${KV_OUT[i]}</b>"를 붙입니다. 누적 ${num(t.m[K])} 토큰-단계. 토큰 사이의 간격이 거의 일정합니다.`, snap());
    }
    fresh = -1;
    t.step(11, `<b>${num(t.m[K])} 토큰-단계</b>로 같은 결과를 냈습니다. 프리필 ${P} + 이후 토큰당 1입니다. 대가는 메모리입니다. 캐시는 토큰 수 × 층 수만큼 커지고, 요청이 끝날 때까지 잡고 있어야 합니다.`, snap());
  };
  CS.add({
    id: 'kv-cache', level: 'senior', topic: 'ai',
    title: 'KV 캐시: 토큰을 만들 때마다 처음부터 다시 계산하지 않기',
    summary: '언어 모델은 토큰을 하나 만들 때마다 실행됩니다. 단순하게 구현하면 매번 앞의 모든 토큰을 다시 계산하게 됩니다. 추론 엔진은 이미 계산한 토큰의 키·값을 저장해 두고(KV 캐시) 새 토큰만 계산합니다. 없을 때와 나란히 놓아야 응답 속도의 생김새가 이해됩니다.',
    param: { label: '생성할 토큰 수', options: [4, 8, 12], value: 8 },
    headline: '처리한 토큰-단계 수',
    verdict: '프롬프트 4토큰에 출력 8토큰이면 캐시 없이 60, 캐시가 있으면 11 토큰-단계입니다. 출력이 길수록 차이는 제곱으로 벌어집니다. 첫 토큰은 프롬프트 전체를 처리한 뒤에 나오고 그다음부터는 토큰당 한 번씩만 계산하므로, 첫 토큰까지의 시간과 이후 토큰 속도는 서로 다른 값입니다.',
    variants: [
      {
        name: '매번 전체를 다시 계산', tone: 'bad', big: { time: 'O(n²) 토큰-단계', space: '캐시 없음' },
        code: `function generate(prompt, maxNew) {
  const tokens = [...prompt];
  for (let i = 0; i < maxNew; i++) {
    const hidden = model.forward(tokens);
    tokens.push(pickNext(hidden.at(-1)));
  }
  return tokens;
}`,
        notes: { 4: '앞의 토큰을 전부 다시 계산', 5: '맨 끝 결과만 사용' }, run: kvRun(false),
      },
      {
        name: 'KV 캐시: 새 토큰만 계산', tone: 'good', big: { time: 'O(n) 토큰-단계', space: 'O(n × 층 수)' },
        code: `function generate(prompt, maxNew) {
  const cache = new KVCache();
  const tokens = [...prompt];
  let input = prompt;
  for (let i = 0; i < maxNew; i++) {
    const hidden = model.forward(input, cache);
    const next = pickNext(hidden.at(-1));
    tokens.push(next);
    input = [next];
  }
  return tokens;
}`,
        notes: { 4: '처음에는 프롬프트 전체', 6: '입력만 계산, 나머지는 캐시에서 읽기', 9: '다음부터는 새 토큰 하나' }, run: kvRun(true),
      },
    ],
    points: [
      '생성 모델에서 한 토큰의 계산 결과는 <b>자기보다 앞에 있는 토큰</b>에만 달려 있습니다. 뒤에 토큰이 붙어도 앞쪽의 키·값은 바뀌지 않으므로 저장해 두고 다시 쓸 수 있습니다.',
      '<b>TTFT</b>(첫 토큰까지의 시간)는 프롬프트 전체를 처리하는 프리필 시간이고, 그 뒤의 <b>토큰당 속도</b>는 새 토큰 하나를 처리하는 시간입니다. 입력이 길면 앞의 것이, 출력이 길면 뒤의 것이 전체 지연을 정합니다.',
      '입력 토큰은 한꺼번에 병렬로 처리할 수 있지만 출력 토큰은 하나씩 순서대로 만들어야 합니다. 출력 토큰이 입력 토큰보다 느리고 대체로 더 비싼 이유입니다.',
      'KV 캐시가 있어도 새 토큰은 앞의 모든 키·값을 읽어야 합니다. 컨텍스트가 길수록 토큰 하나의 비용과 캐시 메모리가 함께 커집니다.',
    ],
    senior: '실제 추론 엔진은 거의 예외 없이 KV 캐시를 쓰므로, 왼쪽 방식을 직접 볼 일은 드뭅니다. 알아 둘 것은 그 결과로 생기는 운영 특성입니다. 지연을 볼 때는 전체 응답 시간 하나가 아니라 TTFT와 초당 출력 토큰 수를 따로 재야 원인이 갈립니다. TTFT가 길면 입력 길이나 대기열을, 토큰 속도가 느리면 모델 크기나 서버 부하를 의심합니다. 모델을 직접 서빙한다면 동시 요청 수를 제한하는 것은 연산보다 KV 캐시 메모리인 경우가 많습니다. 요청마다 "컨텍스트 길이 × 층 수"만큼의 메모리를 응답이 끝날 때까지 점유하기 때문입니다. 이 캐시를 요청이 끝난 뒤에도 보관했다가 같은 접두사로 시작하는 다음 요청에 다시 쓰는 것이 API의 프롬프트 캐싱입니다.',
    qa: [
      ['KV 캐시가 무엇이고 왜 가능한가요?', '토큰을 하나 생성할 때마다 앞의 토큰 전체를 다시 계산하지 않도록, 각 토큰이 어텐션에 내놓는 키·값 벡터를 층마다 저장해 두는 것입니다. 생성 모델은 각 토큰이 앞쪽만 참고하므로 뒤에 토큰이 붙어도 앞 토큰의 키·값이 변하지 않습니다. 그래서 새 토큰 하나만 계산하고 나머지는 캐시에서 읽으면 됩니다.'],
      ['첫 토큰까지의 시간(TTFT)과 그 이후의 토큰 속도가 왜 다른가요?', '첫 토큰은 프롬프트 전체를 처리하는 프리필이 끝나야 나오므로 입력 길이에 좌우됩니다. 그 뒤로는 KV 캐시 덕분에 새 토큰 하나씩만 계산하므로 간격이 거의 일정합니다. 그래서 입력이 긴 요청은 TTFT가, 출력이 긴 요청은 토큰 속도가 전체 지연을 정합니다.'],
      ['KV 캐시의 비용은 무엇인가요?', '메모리입니다. 캐시 크기는 컨텍스트 토큰 수 × 층 수 × 벡터 크기에 비례하고, 요청이 끝날 때까지 유지해야 합니다. 긴 컨텍스트 요청이 동시에 많으면 연산보다 메모리가 먼저 한계에 닿습니다.'],
    ],
  });

  /* ---------- 프롬프트 캐싱 ---------- */
  const PC_FIX = [{ id: 'sys', v: '시스템 지침', n: 500 }, { id: 'tools', v: '도구 정의', n: 700 }, { id: 'doc', v: '참고 문서', n: 1800 }];
  const PC_REQ = [['14:03:07', '환불 기한은?'], ['14:03:41', '교환도 되나요?'], ['14:04:15', '배송비는요?'], ['14:05:02', '영수증 재발급?']];
  const pcRun = (stableFirst) => (t) => {
    const K = '새로 처리한 입력 토큰', H = '캐시에서 읽은 토큰';
    t.m[K] = 0; t.m[H] = 0;
    const LINE = stableFirst ? { sys: 3, tools: 4, doc: 5, time: 6, q: 7 } : { time: 3, sys: 4, tools: 5, doc: 6, q: 7 };
    const build = (r) => {
      const time = { id: 'time', v: `시각 ${PC_REQ[r][0]}`, n: 10 }, q = { id: 'q', v: `질문: ${PC_REQ[r][1]}`, n: 40 };
      return stableFirst ? [...PC_FIX, time, q] : [time, ...PC_FIX, q];
    };
    const TOTAL = build(0).reduce((a, b) => a + b.n, 0);
    let cache = [], cur = [], marks = {}, r = 0;
    const log = [];
    const snap = () => [
      { type: 'cells', title: '캐시 — 직전 요청에서 계산해 둔 프롬프트 (앞에서부터 순서대로)', items: cache.map((b) => ({ id: b.id, v: b.v, sub: `${num(b.n)} 토큰`, gap: true })) },
      { type: 'cells', title: `요청 ${r + 1}의 프롬프트 — 앞에서부터 캐시와 비교`, items: cur.map((b) => ({ id: b.id, v: b.v, sub: `${num(b.n)} 토큰`, gap: true, s: marks[b.id] || '' })) },
      { type: 'timeline', total: TOTAL, title: '요청별로 새로 처리한 입력 토큰', items: log.map((x, k) => ({ id: k, label: `요청 ${k + 1} · ${num(x)}`, start: 0, len: x, s: x > 1000 ? 'bad' : 'done', text: `${num(x)} 토큰` })) },
    ];
    const finish = (hit) => {
      const read = cur.slice(0, hit).reduce((a, b) => a + b.n, 0);
      t.m[H] += read; t.m[K] += TOTAL - read; log.push(TOTAL - read);
      return read;
    };
    for (r = 0; r < PC_REQ.length; r++) {
      cur = build(r); marks = {};
      let hit = 0;
      while (hit < cur.length && cache[hit] && cache[hit].v === cur[hit].v) hit++;
      if (r === 0) {
        t.step(2, `첫 요청입니다. 프롬프트는 ${cur.map((b) => b.v.split(' ')[0].replace(':', '')).join(' → ')} 순서로 ${num(TOTAL)}토큰이고, 캐시는 비어 있습니다.`, snap());
        cur.forEach((b) => { marks[b.id] = 'cmp'; });
        finish(0);
        t.step(7, `${num(TOTAL)}토큰을 전부 처리합니다. 처리하면서 만든 계산 결과를 <b>캐시에 남겨 둡니다.</b> 다음 요청이 같은 내용으로 시작하면 다시 쓰기 위해서입니다.`, snap());
        cache = cur;
        continue;
      }
      if (r === 1) {
        t.step(2, `두 번째 요청이 왔습니다. 질문과 시각만 달라졌고 지침·도구·문서 ${num(3000)}토큰은 그대로입니다. 캐시와 <b>맨 앞에서부터</b> 비교합니다.`, snap());
        for (let k = 0; k < hit; k++) {
          marks[cur[k].id] = 'done';
          t.step(LINE[cur[k].id], `"${cur[k].v}" — 캐시와 같습니다. ${num(cur[k].n)}토큰은 계산을 건너뛰고 저장된 결과를 씁니다.`, snap());
        }
        marks[cur[hit].id] = 'bad';
        t.step(LINE[cur[hit].id], hit === 0
          ? `<b>첫 블록부터 다릅니다.</b> 시각이 <code>${PC_REQ[0][0]}</code>에서 <code>${PC_REQ[1][0]}</code>로 바뀌었습니다. 캐시는 앞에서부터 같은 부분까지만 쓸 수 있으므로 비교는 여기서 끝납니다.`
          : `"${cur[hit].v}" — 여기서 처음 달라집니다. 캐시를 쓸 수 있는 것은 이 앞까지입니다.`, snap());
        cur.slice(hit + 1).forEach((b) => { marks[b.id] = 'cmp'; });
        const read = finish(hit);
        t.step(7, hit === 0
          ? `뒤의 지침·도구·문서는 <b>한 글자도 바뀌지 않았지만 전부 다시 계산</b>합니다. 각 토큰의 계산 결과는 앞에 놓인 모든 토큰에 따라 달라지기 때문입니다. 캐시에서 읽은 것 0, 새로 처리 ${num(TOTAL)}토큰.`
          : `달라진 지점부터 끝까지 ${num(TOTAL - read)}토큰만 새로 처리합니다. 앞의 <b>${num(read)}토큰은 캐시에서 읽었습니다.</b>`, snap());
        cache = cur;
        continue;
      }
      cur.forEach((b, k) => { marks[b.id] = k < hit ? 'done' : k === hit ? 'bad' : 'cmp'; });
      const read = finish(hit);
      t.step(LINE[cur[hit].id], hit === 0
        ? `요청 ${r + 1}도 같습니다. 맨 앞의 시각이 또 바뀌어 ${num(TOTAL)}토큰을 전부 다시 처리합니다. 캐시에 쓰기만 하고 한 번도 읽지 못합니다.`
        : `요청 ${r + 1}: 앞의 ${num(read)}토큰은 캐시에서 읽고, 시각과 질문 ${num(TOTAL - read)}토큰만 새로 처리합니다.`, snap());
      cache = cur;
    }
    t.step(stableFirst ? 5 : 3, stableFirst
      ? `요청 4번에 새로 처리한 입력은 <b>${num(t.m[K])}토큰</b>, 캐시에서 읽은 것은 ${num(t.m[H])}토큰입니다. 바뀌지 않는 내용이 앞에 모여 있어 긴 접두사가 그대로 재사용됐습니다.`
      : `요청 4번에 <b>${num(t.m[K])}토큰</b>을 전부 새로 처리했습니다. 캐싱 기능은 켜져 있었지만 맨 앞 10토큰이 매번 달라 캐시 적중이 0입니다.`, snap());
  };
  CS.add({
    id: 'prompt-caching', level: 'mid', topic: 'ai',
    title: '프롬프트 캐싱: 바뀌는 내용을 앞에 두면 캐시가 깨진다',
    summary: 'LLM API는 요청마다 프롬프트 전체를 다시 처리합니다. 긴 시스템 지침이나 문서가 매번 똑같다면, 그 부분의 계산 결과를 재사용하게 해 주는 것이 프롬프트 캐싱입니다. 다만 캐시는 "앞에서부터 똑같은 부분"까지만 적용되므로 프롬프트를 조립하는 순서가 결과를 가릅니다.',
    headline: '새로 처리한 입력 토큰',
    verdict: '같은 내용, 같은 요청 4번인데 새로 처리한 입력이 12,200토큰과 3,200토큰으로 갈렸습니다. 차이는 매번 바뀌는 "현재 시각" 한 줄의 위치뿐입니다. 고정된 내용은 앞에, 바뀌는 내용은 뒤에 둡니다.',
    variants: [
      {
        name: '바뀌는 값(시각)이 맨 앞', tone: 'bad', label: '캐시 적중 0',
        code: `function buildPrompt(question) {
  return [
    \`현재 시각: \${now()}\`,
    SYSTEM_RULES,
    TOOL_DEFINITIONS,
    REFERENCE_DOC,
    question,
  ];
}`,
        notes: { 3: '요청마다 바뀜 → 뒤가 전부 무효', 6: '내용은 같지만 다시 계산' }, run: pcRun(false),
      },
      {
        name: '고정 내용을 앞에, 바뀌는 값은 뒤에', tone: 'good', label: '접두사 재사용',
        code: `function buildPrompt(question) {
  return [
    SYSTEM_RULES,
    TOOL_DEFINITIONS,
    REFERENCE_DOC,
    \`현재 시각: \${now()}\`,
    question,
  ];
}`,
        notes: { 5: '여기까지 매번 동일 → 캐시 적중', 6: '여기부터만 새로 계산' }, run: pcRun(true),
      },
    ],
    points: [
      '캐시가 맞는 조건은 "비슷하다"가 아니라 <b>맨 앞부터 완전히 같다</b>입니다. 한 글자라도 달라지면 그 지점부터 뒤는 전부 다시 계산합니다. 토큰의 계산 결과가 앞의 모든 토큰에 달려 있기 때문입니다(KV 캐시와 같은 원리).',
      '재사용되는 것은 <b>입력을 처리한 계산</b>이지 답이 아닙니다. 캐시가 맞아도 출력은 매번 새로 생성되므로, 같은 요청의 응답을 통째로 저장하는 응답 캐시와는 다른 것입니다.',
      '캐시된 입력 토큰은 보통 더 싸게 과금되고 첫 토큰까지의 시간도 줄어듭니다. 캐시는 일정 시간 쓰이지 않으면 사라집니다. 최소 길이, 유지 시간, 캐시 지점을 직접 표시해야 하는지는 제공자마다 다르므로 문서를 확인합니다.',
      '순서의 원칙은 <b>덜 바뀌는 것부터</b>입니다. 시스템 지침 → 도구 정의 → 공통 문서 → 대화 기록 → 이번 질문과 시각·사용자 정보 순으로 놓습니다.',
    ],
    senior: '캐시가 깨지는 원인은 대개 눈에 잘 띄지 않는 곳에 있습니다. 시스템 프롬프트에 끼워 넣은 타임스탬프나 요청 id, 사용자 이름이 대표적이고, 도구 목록이나 JSON 키의 직렬화 순서가 실행마다 달라지는 경우(정렬하지 않은 맵을 그대로 직렬화), 사용자마다 도구 구성이 조금씩 다른 경우도 흔합니다. 대화 기록 중간을 고치거나 오래된 메시지를 앞에서 잘라 내는 것도 그 뒤를 전부 무효로 만듭니다. 그래서 긴 대화나 에이전트는 기록을 "뒤에 덧붙이기만" 하도록 설계하고, 줄여야 할 때는 한 번에 크게 정리합니다. 확인 방법은 간단합니다. API 응답의 사용량 정보에 캐시에서 읽은 토큰 수가 따로 나오므로 이것을 지표로 남기고, 적중률이 떨어지면 연속한 두 요청의 프롬프트를 비교해 처음으로 달라지는 위치를 찾습니다. 시각이 꼭 필요하면 날짜 단위로 낮추거나 맨 뒤로 보냅니다.',
    qa: [
      ['프롬프트 캐싱은 어떻게 동작하고, 무엇을 아껴 주나요?', '요청의 앞부분이 이전 요청과 완전히 같으면 그 부분을 처리한 계산 결과를 다시 쓰는 기능입니다. 긴 시스템 프롬프트나 문서를 매번 다시 처리하지 않으므로 입력 비용과 첫 토큰까지의 시간이 줄어듭니다. 출력은 매번 새로 생성되므로 응답을 저장해 돌려주는 캐시와는 다릅니다.'],
      ['캐싱을 켰는데 비용이 줄지 않습니다. 어디부터 보시겠습니까?', '응답의 사용량 정보에서 캐시에서 읽은 토큰 수를 먼저 봅니다. 0에 가깝다면 접두사가 요청마다 달라지고 있는 것입니다. 연속한 두 요청의 프롬프트를 비교해 처음 달라지는 위치를 찾으면 대개 시각, 요청 id, 순서가 불안정한 직렬화 같은 것이 앞쪽에 있습니다. 그것을 뒤로 옮기거나 고정합니다.'],
      ['왜 접두사가 같아야만 하나요? 중간의 같은 문서만 재사용할 수는 없나요?', '모델 안에서 각 토큰의 계산 결과는 그 앞에 놓인 모든 토큰의 영향을 받습니다. 앞쪽이 한 토큰이라도 바뀌면 뒤 토큰들의 계산 결과도 달라지므로, 문서 내용이 같더라도 저장해 둔 값은 더 이상 맞지 않습니다. 그래서 재사용 단위가 "같은 조각"이 아니라 "같은 접두사"입니다.'],
    ],
    dx: {
      cat: ['slow'], concept: '프롬프트 캐시의 접두사 불일치',
      symptoms: ['프롬프트 캐싱을 켰는데 요금과 첫 토큰까지의 시간이 그대로다', '응답의 사용량에서 캐시에서 읽은 토큰이 0이거나 매우 적다', '배포 뒤 갑자기 LLM 비용이 올랐는데 요청 수와 프롬프트 길이는 그대로다'],
      check: '응답 사용량의 캐시 읽기 토큰 수를 요청마다 기록합니다. 낮다면 연속한 두 요청의 프롬프트를 나란히 비교해 처음으로 달라지는 위치를 찾습니다.',
      fix: '바뀌지 않는 내용(지침, 도구 정의, 공통 문서)을 앞에 모으고 시각·사용자 입력은 뒤로 보냅니다. 도구 목록과 JSON 직렬화 순서를 고정하고, 대화 기록은 뒤에 덧붙이기만 합니다.',
    },
  });

  /* ---------- 에이전트 루프 ---------- */
  CS.add({
    id: 'agent-loop', level: 'basic', topic: 'ai',
    title: '도구 호출과 에이전트 루프: 모델은 실행하지 않고 요청만 한다',
    summary: '언어 모델이 할 수 있는 일은 텍스트를 출력하는 것뿐입니다. 로그를 조회하거나 파일을 고치는 "에이전트"는, 모델이 "이 도구를 이 인자로 불러 달라"고 출력하면 프로그램이 대신 실행하고 그 결과를 다시 모델에게 보여 주는 반복문입니다. 그 루프 한 번을 끝까지 따라갑니다.',
    verdict: '질문 하나에 모델을 3번 불렀고, 대화는 1,110토큰인데 입력으로 보낸 토큰은 누적 2,100입니다. 호출할 때마다 그때까지의 대화 전체를 다시 보내기 때문입니다. 루프가 길어질수록 비용은 단계 수보다 빠르게 늘어납니다.',
    variants: [{
      name: '에이전트 루프', tone: 'info',
      code: `async function runAgent(messages, tools, maxSteps = 5) {
  for (let step = 0; step < maxSteps; step++) {
    const reply = await llm.generate({ messages, tools });
    messages.push(reply);
    if (!reply.toolCalls.length) return reply.text;
    for (const call of reply.toolCalls) {
      const result = await tools[call.name](call.args);
      messages.push({ role: 'tool', id: call.id, content: result });
    }
  }
  throw new Error('최대 반복 수 초과');
}`,
      notes: { 2: '반복 횟수에 상한', 3: '대화 전체를 매번 다시 보냄', 5: '도구 요청이 없으면 끝', 7: '실행은 프로그램이 함', 8: '결과를 대화에 덧붙임' },
      run(t) {
        const C = '모델 호출 횟수', X = '도구 실행 횟수', I = '누적 입력 토큰', L = '대화 길이 (토큰)';
        t.m[C] = 0; t.m[X] = 0; t.m[I] = 0; t.m[L] = 320;
        const msgs = [
          { id: 'sys', n: 300, v: '시스템 지침 + 도구 정의 (300토큰): search_logs(query, since), get_deploy(version)' },
          { id: 'user', n: 20, v: '사용자 (20토큰): 어젯밤 결제 오류가 왜 늘었어?' },
        ];
        const calls = [];
        let hot = null, sending = false;
        const snap = () => [
          { type: 'stack', down: true, title: 'messages — 모델을 부를 때마다 이 전체가 입력으로 들어갑니다 (토큰 수는 가정값)', items: msgs.map((x) => ({ id: x.id, v: x.v, s: x.id === hot ? (x.tool ? 'done' : x.final ? 'hit' : 'new') : sending ? 'cmp' : '' })) },
          { type: 'timeline', total: 1100, title: '모델 호출마다 보낸 입력 토큰', items: calls.map((n, k) => ({ id: k, label: `호출 ${k + 1}`, start: 0, len: n, s: k === calls.length - 1 && sending ? 'active' : '', text: `${num(n)} 토큰` })) },
        ];
        const callModel = () => {
          const n = msgs.reduce((a, x) => a + x.n, 0);
          calls.push(n); t.m[C]++; t.m[I] += n; sending = true; hot = null;
          return n;
        };
        const push = (m) => { msgs.push(m); hot = m.id; sending = false; t.m[L] += m.n; };
        t.step(1, `사용자가 묻습니다. 모델은 어젯밤 로그를 본 적이 없고 조회할 수단도 없습니다. 대신 프로그램이 <b>쓸 수 있는 도구의 목록</b>(이름, 설명, 인자 형식)을 지침과 함께 넘겨줍니다.`, snap());
        t.step(2, `루프를 시작합니다. 반복 횟수에 <b>상한(maxSteps)</b>을 둡니다. 언제 끝낼지는 모델의 출력이 정하므로, 상한이 없으면 끝나지 않는 실행이 생길 수 있습니다.`, snap());
        let n = callModel();
        t.step(3, `모델 호출 1 — 지침, 도구 정의, 질문 <b>${num(n)}토큰</b>을 보냅니다.`, snap());
        push({ id: 'a1', n: 30, v: '모델 → 도구 요청 (30토큰): search_logs({ query: "payment error", since: "어제 18:00" })' });
        t.step(4, `모델의 출력은 답이 아니라 <b>도구 요청</b>입니다. 모델이 로그를 조회한 것이 아닙니다. "이 함수를 이 인자로 불러 달라"는 형식을 갖춘 텍스트를 썼을 뿐입니다.`, snap());
        t.step(5, `도구 요청이 들어 있으므로 아직 끝나지 않았습니다.`, snap());
        t.m[X]++;
        t.step(7, `<b>프로그램이</b> 요청에 적힌 이름으로 실제 함수를 찾아 실행합니다. 권한 확인, 인자 검증, 시간 제한은 모두 이 자리에서 프로그램이 책임집니다.`, snap());
        push({ id: 't1', n: 400, tool: true, v: '도구 결과 (400토큰): 21:10부터 TimeoutError 312건, 모두 v2.4.0 서버에서 발생 …' });
        t.step(8, `실행 결과를 대화에 덧붙입니다. 로그 발췌라 400토큰으로 큽니다. 이 텍스트는 다음 호출에서 모델이 읽는 <b>입력</b>이 됩니다.`, snap());
        n = callModel();
        t.step(3, `모델 호출 2 — 모델은 이전 호출을 기억하지 못하므로 <b>대화 전체 ${num(n)}토큰</b>을 다시 보냅니다. 처음의 320토큰도 또 들어갑니다. 누적 입력 ${num(t.m[I])}토큰.`, snap());
        push({ id: 'a2', n: 30, v: '모델 → 도구 요청 (30토큰): get_deploy({ version: "v2.4.0" })' });
        t.step(4, `모델이 로그에서 v2.4.0을 읽고, 그 배포 내용을 확인하려고 <b>두 번째 도구</b>를 요청합니다. 다음에 무엇을 할지는 코드에 적혀 있지 않고 모델이 매번 정합니다.`, snap());
        t.m[X]++;
        t.step(7, `프로그램이 <code>get_deploy</code>를 실행합니다.`, snap());
        push({ id: 't2', n: 250, tool: true, v: '도구 결과 (250토큰): 21:05 배포. 변경: 결제 API 타임아웃 30초 → 3초 …' });
        t.step(8, `결과를 덧붙입니다. 대화가 ${num(t.m[L])}토큰이 됐습니다.`, snap());
        n = callModel();
        t.step(3, `모델 호출 3 — 이번에는 <b>${num(n)}토큰</b>을 보냅니다. 호출마다 입력이 길어져 누적 입력은 ${num(t.m[I])}토큰입니다.`, snap());
        push({ id: 'a3', n: 80, final: true, v: '모델 → 답 (80토큰): 21:05에 배포된 v2.4.0이 결제 API 타임아웃을 3초로 줄였고, 그 직후부터 TimeoutError가 늘었습니다.' });
        t.step(4, `이번 출력에는 도구 요청이 없고 <b>사용자에게 줄 답</b>만 있습니다.`, snap());
        t.step(5, `도구 요청이 비어 있으므로 루프를 끝내고 답을 돌려줍니다. 대화는 ${num(t.m[L])}토큰인데 입력으로 보낸 것은 누적 <b>${num(t.m[I])}토큰</b>입니다. 단계가 늘수록 이 차이가 커집니다.`, snap());
      },
    }],
    points: [
      '모델은 아무것도 실행하지 않습니다. <b>도구 이름과 인자를 적은 요청</b>을 출력할 뿐이고, 실행과 그 결과에 대한 책임은 호출한 프로그램에 있습니다.',
      '에이전트는 "모델 호출 → 도구 실행 → 결과를 대화에 덧붙임"을 <b>모델이 도구를 더 요청하지 않을 때까지</b> 반복하는 루프입니다. 다음에 무엇을 할지를 코드가 아니라 모델이 정한다는 점이 일반 프로그램과 다릅니다.',
      '호출마다 대화 전체를 다시 보내므로 누적 입력 토큰은 단계 수의 제곱에 가깝게 늡니다. 도구 결과가 클수록 심해집니다. 앞부분이 매번 같으므로 프롬프트 캐싱의 효과가 큰 구조이기도 합니다.',
      '도구를 연결하는 방식은 표준화되는 중입니다. <b>MCP</b>(Model Context Protocol)는 도구·데이터를 제공하는 서버와 AI 애플리케이션 사이의 공개 규약으로, 2026년 기준 리눅스 재단 산하 Agentic AI Foundation이 관리합니다. 도구를 MCP 서버로 한 번 만들어 두면 이를 지원하는 여러 애플리케이션에서 같은 방식으로 쓸 수 있습니다.',
    ],
    senior: '운영에서 먼저 정할 것은 루프가 끝나는 조건입니다. 모델이 도구를 그만 요청할 때까지 기다리는 것만으로는 부족하므로 최대 반복 수, 토큰·비용 예산, 전체 시간 제한을 함께 두고, 같은 도구를 같은 인자로 되풀이 호출하는지도 감지합니다. 도구가 실패했을 때는 예외로 루프를 깨기보다 오류 내용을 결과로 돌려주어 모델이 다른 방법을 고르게 하는 편이 낫습니다. 컨텍스트는 방치하면 계속 쌓이므로 큰 도구 결과는 잘라서 넣고, 오래된 결과는 요약으로 바꿉니다. 보안에서 중요한 원칙은 도구 결과를 신뢰하지 않는 것입니다. 웹 페이지, 문서, 이슈 본문처럼 남이 쓴 텍스트가 결과로 들어오면 그 안의 "이전 지시를 무시하고 …" 같은 문장을 모델이 지시로 받아들일 수 있습니다(간접 프롬프트 인젝션). 모델이 이를 완전히 구별해 낸다고 가정하지 말고, 도구에 최소 권한만 주고, 삭제·결제·외부 전송처럼 되돌릴 수 없는 동작은 사람의 확인을 거치게 하며, 모델이 만든 인자는 일반 사용자 입력처럼 검증합니다. MCP로 외부 서버의 도구를 붙일 때는 도구 설명 자체도 남이 쓴 텍스트라는 점까지 포함해 같은 기준을 적용합니다. MCP 규격은 계속 개정되고 있으므로(2026년 7월 개정판은 세션 없이 요청마다 독립적으로 처리하는 방식으로 바뀌었습니다) 쓰는 SDK가 어느 개정판을 따르는지 확인합니다.',
    qa: [
      ['도구 호출(tool calling)은 어떻게 동작하나요?', '요청에 도구의 이름, 설명, 인자 스키마를 함께 보내면 모델이 답 대신 "어떤 도구를 어떤 인자로 호출해 달라"는 구조화된 출력을 낼 수 있습니다. 실제 실행은 애플리케이션이 하고, 그 결과를 대화에 붙여 모델을 다시 호출합니다. 모델이 도구를 더 요청하지 않고 답을 내면 끝납니다.'],
      ['에이전트가 끝나지 않거나 비용이 폭증하는 것을 어떻게 막습니까?', '최대 반복 수와 토큰·시간 예산을 코드에서 강제하고, 같은 도구·같은 인자의 반복 호출을 감지해 중단합니다. 호출마다 대화 전체를 다시 보내므로 큰 도구 결과는 잘라서 넣고 오래된 결과는 요약하며, 변하지 않는 앞부분에는 프롬프트 캐싱을 적용합니다. 작업당 모델 호출 수와 호출별 입력 토큰을 로그로 남겨 두어야 원인을 찾을 수 있습니다.'],
      ['도구 결과를 왜 신뢰하면 안 되나요?', '도구 결과는 모델의 입력으로 들어가는데, 모델은 그 안의 문장이 데이터인지 지시인지 확실히 구별하지 못합니다. 외부에서 온 텍스트에 지시문을 심어 두면 에이전트가 가진 권한으로 엉뚱한 동작을 하게 만들 수 있습니다. 그래서 도구 권한을 최소로 하고, 위험한 동작에는 사람의 승인을 두고, 모델이 만든 인자를 검증합니다.'],
    ],
    dx: {
      cat: ['hang', 'slow'], concept: '에이전트 루프의 종료 조건과 컨텍스트 누적',
      symptoms: ['에이전트가 같은 도구를 같은 인자로 계속 부르며 끝나지 않는다', '작업 하나의 토큰 비용이 예상의 수십 배로 나온다', '단계가 진행될수록 응답이 느려지다가 컨텍스트 한도 초과 오류로 끝난다'],
      check: '작업마다 모델 호출 횟수와 호출별 입력 토큰 수를 기록합니다. 입력 토큰이 호출마다 계단식으로 커지는지, 같은 (도구, 인자) 조합이 반복되는지 봅니다.',
      fix: '최대 반복 수와 토큰·시간 예산을 강제하고 반복 호출을 감지해 끊습니다. 큰 도구 결과는 자르거나 요약해 넣고, 도구 오류는 모델이 읽을 수 있는 결과로 돌려줍니다.',
    },
  });

  /* ---------- 구조화된 출력: 제약 디코딩 ---------- */
  const SO_N = 20, SO_END = '<끝>', SO_SEED = 890;
  const SO_ROLLS = (() => { let s = SO_SEED; return Array.from({ length: SO_N }, () => Array.from({ length: 8 }, () => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return (s >>> 8) / 0x800000; })); })();
  // 지금까지의 출력을 보고 다음 토큰 후보와 확률을 돌려준다 (가정한 확률)
  const soNext = (out) => {
    const last = out[out.length - 1], fenced = out.includes('```json');
    if (!out.length) return [['{', 0.94], ['```json', 0.04], ['네,', 0.02]];
    if (last === '네,') return [['{', 0.9], ['```json', 0.1]];
    if (last === '```json') return [['{', 1]];
    if (last === '{') return [['"level":', 0.98], ['"lvl":', 0.015], ['level:', 0.005]];
    if (last === '```' || last === '참고:') return [[SO_END, 1]];
    if (last.endsWith(':')) return [['"high"', 0.72], ['"low"', 0.22], ['"urgent"', 0.05], ['high', 0.01]];
    if (last === '}' || last === ',}') return fenced ? [['```', 0.98], [SO_END, 0.02]] : [[SO_END, 0.97], ['참고:', 0.03]];
    return [['}', 0.97], [',}', 0.03]];
  };
  // 스키마 { "level": "high" | "low" } 가 지금 위치에서 허용하는 토큰
  const soAllowed = (out) => {
    const last = out[out.length - 1];
    if (!out.length) return ['{'];
    if (last === '{') return ['"level":'];
    if (last === '"level":') return ['"high"', '"low"'];
    if (last === '}') return [SO_END];
    return ['}'];
  };
  const soText = (out) => out.map((x) => (x === '```json' ? x + '\n' : x === '```' ? '\n' + x : x)).join('');
  const soCheck = (text) => {
    let data;
    try { data = JSON.parse(text); } catch (e) { return 'syntax'; }
    return data && Object.keys(data).join() === 'level' && ['high', 'low'].includes(data.level) ? 'ok' : 'schema';
  };
  const soGen = (r, constrained) => {
    const out = [], picks = [];
    for (let k = 0; k < 8; k++) {
      const raw = soNext(out), allow = constrained ? soAllowed(out) : null;
      const kept = raw.map(([w, p]) => (allow && !allow.includes(w) ? 0 : p)), sum = kept.reduce((a, b) => a + b, 0);
      const probs = kept.map((p) => p / sum), roll = SO_ROLLS[r][k];
      let acc = 0, pick = probs.length - 1;
      for (let i = 0; i < probs.length; i++) { acc += probs[i]; if (roll < acc) { pick = i; break; } }
      picks.push({ before: out.slice(), raw, probs, pick, roll, legal: soAllowed(out.filter((x) => !['```json', '```', '네,'].includes(x))).includes(raw[pick][0]) });
      if (raw[pick][0] === SO_END) break;
      out.push(raw[pick][0]);
    }
    const text = soText(out);
    return { out, picks, text, res: soCheck(text) };
  };
  const SO_FIRST_BAD = Array.from({ length: SO_N }, (_, r) => soGen(r, false).res).findIndex((x) => x !== 'ok');
  const soRun = (constrained) => (t) => {
    const F = '검증에 실패한 응답', S = 'JSON.parse 예외', V = '스키마 위반 (파싱은 됨)';
    t.m[F] = 0; t.m[S] = 0; t.m[V] = 0;
    const f = SO_FIRST_BAD, results = [];
    let out = [], cand = null;
    const pc = (p) => Math.round(p * 1000) / 10;
    const snap = () => [
      { type: 'cells', title: `요청 ${f + 1}의 출력 — 지금까지 고른 토큰`, items: out.map((x, k) => ({ id: k, v: x.w, s: x.bad ? 'bad' : 'done' })) },
      ...(cand ? [{ type: 'cells', bars: true, max: 100, title: cand.title, items: cand.items }] : []),
      { type: 'cells', compact: true, title: `같은 프롬프트로 보낸 요청 ${SO_N}건의 검증 결과`, items: Array.from({ length: SO_N }, (_, r) => ({ id: r, v: results[r] == null ? r + 1 : results[r] === 'ok' ? '✓' : '✗', s: results[r] == null ? '' : results[r] === 'ok' ? 'done' : 'bad' })) },
    ];
    const tally = (r, res) => { results[r] = res; if (res !== 'ok') { t.m[F]++; t.m[res === 'syntax' ? S : V]++; } };
    const bars = (p, probs, pick, masked) => p.raw.map(([w], i) => ({ id: w, v: pc(probs[i]), sub: w, gap: true, s: masked && probs[i] === 0 ? 'dim' : i === pick ? (p.legal || masked ? 'active' : 'bad') : '' }));
    const g = soGen(f, constrained);
    if (!constrained) {
      t.step(5, `로그 한 줄의 심각도를 <code>{"level": "high" | "low"}</code> 형식으로 받으려 합니다. 프롬프트에 "JSON으로만 답하세요"라고 적었습니다. 같은 요청을 ${SO_N}건 보냅니다.`, snap());
      for (let r = 0; r < f; r++) tally(r, soGen(r, false).res);
      if (f > 0) t.step(6, `앞의 요청 ${f}건은 올바른 JSON이 나와 <code>JSON.parse</code>를 통과했습니다. 부탁은 대부분 통합니다. 그다음 요청을 토큰 단위로 봅니다.`, snap());
      g.picks.forEach((p) => {
        const w = p.raw[p.pick][0];
        cand = { title: `다음 토큰 후보의 확률 (%, 가정값) · 뽑은 난수 ${p.roll.toFixed(2)}`, items: bars(p, p.probs, p.pick, false) };
        if (w !== SO_END) out = [...out, { w, bad: !p.legal }];
        t.step(3, w === SO_END ? `생성을 끝내는 토큰 <b>${esc(w)}</b>이 뽑혀 출력이 여기서 끝납니다.`
          : w === '```'
          ? `코드 블록을 열었으니 닫는 기호 <b>${esc(w)}</b>가 높은 확률로 따라옵니다. JSON 뒤에도 글자가 붙었습니다.`
          : !p.legal ? `난수 ${p.roll.toFixed(2)}가 확률 ${pc(p.probs[p.pick])}%짜리 후보 <b>${esc(w)}</b>에 떨어졌습니다. 답을 코드 블록으로 감싸는 것은 모델에게 자연스러운 글쓰기이고, 이 후보가 뽑히는 것을 <b>막는 장치가 없습니다.</b>`
          : p.raw.length === 1 ? `다음 후보는 <b>${esc(w)}</b> 하나뿐입니다.`
          : `난수 ${p.roll.toFixed(2)} — 뽑힌 토큰은 <b>${esc(w)}</b> (확률 ${pc(p.probs[p.pick])}%)입니다.`, snap());
      });
      cand = null; tally(f, g.res);
      t.step(6, g.res === 'syntax'
        ? `받은 문자열은 JSON 앞뒤에 다른 글자가 붙어 있어 <code>JSON.parse</code>가 <b>예외를 던집니다.</b> 내용은 맞았지만 프로그램은 읽지 못합니다.`
        : `<code>JSON.parse</code>는 통과하지만 <b>스키마에 없는 값</b>입니다. 뒤따르는 코드가 조용히 잘못된 분기를 탑니다.`, snap());
      for (let r = f + 1; r < SO_N; r++) tally(r, soGen(r, false).res);
      t.step(5, `나머지 요청도 같은 방식으로 생성했습니다. ${SO_N}건 중 <b>${t.m[F]}건</b>이 검증에 실패했습니다. 문법 오류 ${t.m[S]}건, 문법은 맞지만 허용하지 않는 값 ${t.m[V]}건입니다.`, snap());
      t.step(6, `매번 실패하는 것이 아니라 <b>가끔</b> 실패한다는 점이 문제입니다. 테스트에서는 통과하고 운영에서 낮은 비율로 터집니다. (가정한 확률이라 실제 모델보다 실패가 잦습니다.)`, snap());
      return;
    }
    t.step(10, `같은 요청 ${SO_N}건, 같은 난수입니다. 이번에는 스키마 <code>{"level": "high" | "low"}</code>를 문법으로 바꿔 생성기에 넘깁니다. 왼쪽에서 실패했던 ${f + 1}번째 요청을 봅니다.`, snap());
    g.picks.forEach((p, k) => {
      const w = p.raw[p.pick][0], allow = soAllowed(p.before), multi = k === 0 || p.raw.length > 3;
      const blocked = p.raw.filter(([x]) => !allow.includes(x)).map(([x]) => esc(x));
      if (multi) {
        cand = { title: '모델이 계산한 다음 토큰 후보의 확률 (%, 가정값)', items: bars(p, p.raw.map((x) => x[1]), -1, false) };
        t.step(1, k === 0
          ? `모델이 계산한 확률은 왼쪽과 <b>똑같습니다.</b> 모델을 바꾼 것이 아닙니다. 코드 블록(${esc('```json')})이나 "네,"로 시작할 가능성이 그대로 있습니다.`
          : `값 자리입니다. 모델은 스키마에 없는 <b>"urgent"</b>에도 ${pc(p.raw[2][1])}%를 주고 있습니다.`, snap());
        cand = { title: '문법이 허용하지 않는 후보는 확률 0 — 남은 후보의 합이 다시 100%', items: bars(p, p.probs, -1, true) };
        t.step(4, k === 0
          ? `이 문법에서 첫 토큰이 될 수 있는 것은 <b>{</b> 하나입니다. 나머지 후보의 점수를 −∞로 바꿔 <b>뽑힐 수 없게 가립니다.</b>`
          : `이 자리에 올 수 있는 것은 <b>"high"</b>와 <b>"low"</b>뿐입니다. 나머지 후보(${blocked.join(' , ')})는 가리고, 남은 둘의 확률을 다시 합 100%로 맞춥니다.`, snap());
      }
      cand = { title: `허용된 후보 안에서 뽑기 · 뽑은 난수 ${p.roll.toFixed(2)}`, items: bars(p, p.probs, p.pick, true) };
      if (w !== SO_END) out = [...out, { w, bad: false }];
      t.step(6, k === 0
        ? `난수는 왼쪽과 같은 ${p.roll.toFixed(2)}이지만, 고를 수 있는 후보가 하나라 <b>{</b>가 나옵니다.`
        : multi ? `남은 후보 안에서 난수 ${p.roll.toFixed(2)}로 뽑은 토큰은 <b>${esc(w)}</b>입니다. 둘 중 무엇을 고를지는 여전히 모델의 확률이 정합니다.`
        : `이 자리에 허용되는 토큰은 <b>${esc(w)}</b> 하나입니다.${blocked.length ? ` 다른 후보(${blocked.join(' , ')})는 가려집니다.` : ''}`, snap());
    });
    cand = null; tally(f, g.res);
    t.step(11, `출력은 <code>${esc(g.text)}</code>입니다. 문법을 벗어난 토큰을 고를 수 없었으므로 <code>JSON.parse</code>가 <b>반드시</b> 통과합니다.`, snap());
    for (let r = 0; r < SO_N; r++) if (r !== f) tally(r, soGen(r, true).res);
    t.step(10, `나머지 요청도 같은 방식으로 생성했습니다. ${SO_N}건 모두 스키마를 만족합니다. 검증 실패 <b>${t.m[F]}건</b>.`, snap());
    t.step(11, `보장되는 것은 <b>형식</b>입니다. "high"인지 "low"인지가 옳은지는 여전히 모델의 판단이고, 틀릴 수 있습니다.`, snap());
  };
  CS.add({
    id: 'structured-output', level: 'adv', topic: 'ai',
    title: '구조화된 출력: JSON을 부탁하기 vs 틀릴 수 없게 막기',
    summary: '모델의 답을 코드가 읽으려면 형식이 정확해야 합니다. 프롬프트로 "JSON으로만 답하라"고 부탁하면 대부분 지켜지지만, 다음 토큰은 확률에서 뽑히므로 가끔 깨진 출력이 섞입니다. 제약 디코딩은 스키마상 지금 올 수 없는 토큰의 확률을 0으로 만든 뒤에 뽑습니다.',
    headline: '검증에 실패한 응답',
    verdict: '같은 모델, 같은 난수로 20건을 생성했을 때 부탁만 한 쪽은 3건이 검증에 실패했고, 제약 디코딩은 0건입니다. 모델의 확률은 그대로 두고 고를 수 있는 후보만 문법으로 좁힌 결과입니다. 단, 보장되는 것은 형식이지 값의 옳고 그름이 아닙니다.',
    variants: [
      {
        name: '프롬프트로 부탁하기', tone: 'bad', label: '가끔 깨짐',
        code: `function nextToken(logits) {
  const probs = softmax(logits);
  return sample(probs);
}
const text = generate(prompt + ' JSON으로만 답하세요.', nextToken);
const data = JSON.parse(text);`,
        notes: { 3: '어떤 토큰이든 뽑힐 수 있음', 6: '가끔 예외' }, run: soRun(false),
      },
      {
        name: '제약 디코딩 (스키마 강제)', tone: 'good', label: '항상 유효',
        code: `function nextToken(logits, grammar) {
  const allowed = grammar.allowedTokens();
  for (const id of logits.keys())
    if (!allowed.has(id)) logits[id] = -Infinity;
  const probs = softmax(logits);
  const token = sample(probs);
  grammar.advance(token);
  return token;
}
const text = generate(prompt, nextToken, schemaToGrammar(SCHEMA));
const data = JSON.parse(text);`,
        notes: { 2: '지금 위치에서 올 수 있는 토큰', 4: '나머지는 확률 0', 6: '허용된 후보 안에서만 뽑기', 7: '문법 상태를 한 칸 전진' }, run: soRun(true),
      },
    ],
    points: [
      '프롬프트는 확률을 <b>기울일</b> 뿐 0으로 만들지 못합니다. 코드 블록으로 감싸기, 앞뒤에 설명 붙이기, 스키마에 없는 값 쓰기 같은 후보는 낮은 확률로 계속 남아 있습니다.',
      '제약 디코딩은 스키마를 문법(상태 기계)으로 바꾸고, 토큰을 뽑을 때마다 <b>지금 상태에서 허용되지 않는 토큰을 가린 뒤</b> 남은 후보에서 고릅니다. 모델은 그대로이고 "다음 토큰 고르기" 단계만 바뀝니다.',
      '보장 범위는 <b>문법과 스키마</b>까지입니다. 값이 사실인지, 필드의 의미가 맞는지는 보장하지 않습니다. 출력 길이 제한에 걸려 중간에 끊기면 JSON이 닫히지 않은 채 끝날 수도 있습니다.',
      'API에서는 보통 "구조화된 출력"이나 스키마를 엄격히 따르는 도구 호출 옵션으로 제공됩니다. 지원하는 스키마 기능에 제한이 있는 경우가 많으므로 문서를 확인합니다.',
    ],
    senior: '제약 디코딩을 쓸 수 있다면 "파싱 실패 시 재시도" 코드는 대부분 필요 없어지지만, 검증까지 없애면 안 됩니다. 형식이 맞는 틀린 값은 예외 없이 지나가므로 오히려 더 조용한 오류가 됩니다. 값의 범위와 필드 간 관계는 여전히 코드에서 확인하고, 응답이 길이 제한으로 끊겼는지와 모델이 답을 거부했는지는 응답의 종료 사유로 따로 구분합니다. 스키마 설계가 품질에 영향을 준다는 점도 기억할 만합니다. 토큰은 앞에서부터 순서대로 정해지므로 결론 필드를 맨 앞에 두면 모델은 근거를 쓰기 전에 답부터 확정하게 됩니다. 근거나 중간 계산 필드를 앞에, 결론을 뒤에 두는 편이 낫습니다. 또 모델이 가고 싶던 방향을 문법이 막으면(예: "판단할 수 없다"고 말하고 싶은데 enum에 그런 값이 없음) 남은 후보 중에서 억지로 고르게 되므로, "unknown" 같은 탈출구를 스키마에 넣어 둡니다. 제약 디코딩을 쓸 수 없는 환경이라면 스키마 검증 → 오류 내용을 붙여 재요청하는 루프와 재시도 횟수 상한이 차선입니다.',
    qa: [
      ['"JSON으로만 답하라"고 했는데도 왜 가끔 파싱 오류가 납니까?', '모델은 다음 토큰의 확률을 계산하고 그 안에서 뽑을 뿐이어서, 지시는 확률을 높여 줄 뿐 다른 토큰을 금지하지 못합니다. 코드 블록 기호나 설명 문장으로 시작하는 후보가 낮은 확률로 남아 있다가 요청이 많아지면 그만큼 뽑힙니다. 그래서 테스트에서는 안 보이고 운영에서 낮은 비율로 나타납니다.'],
      ['제약 디코딩(구조화된 출력)은 어떻게 형식을 보장합니까?', 'JSON 스키마를 문법으로 바꿔 두고, 토큰을 고를 때마다 현재 문법 상태에서 올 수 없는 토큰의 점수를 −∞로 만든 뒤 남은 후보에서 뽑습니다. 문법을 벗어나는 토큰은 선택될 수 없으므로 완성된 출력은 항상 스키마에 맞습니다. 모델의 가중치는 바뀌지 않고 샘플링 단계에만 필터가 들어갑니다.'],
      ['구조화된 출력을 쓰면 검증 코드는 없어도 됩니까?', '형식 검증은 줄일 수 있지만 값 검증은 남겨야 합니다. 스키마에 맞는 틀린 값은 그대로 통과하고, 길이 제한으로 끊긴 응답이나 거부 응답은 별도로 처리해야 합니다. 판단이 어려운 입력에 대비해 스키마에 "모름"에 해당하는 값을 넣어 두는 것도 필요합니다.'],
    ],
    dx: {
      cat: ['flaky', 'crash'], concept: 'LLM 출력 형식의 확률적 이탈',
      symptoms: ['LLM 응답을 JSON.parse 하는 코드가 낮은 비율로 SyntaxError를 낸다', '응답이 ```json 코드 블록이나 "다음은 결과입니다" 같은 문장으로 시작하는 경우가 섞여 있다', '파싱은 되는데 enum에 없는 값이나 빠진 필드 때문에 뒤쪽 코드가 실패한다'],
      check: '실패한 요청의 원문 응답을 그대로 저장해 봅니다. 같은 입력으로 수십 번 반복했을 때 실패 비율이 일정하게 나오면 형식을 부탁에만 맡기고 있는 것입니다.',
      fix: 'API의 구조화된 출력(스키마 강제) 기능을 씁니다. 쓸 수 없으면 스키마 검증 뒤 오류를 붙여 재요청하되 횟수를 제한합니다. 어느 쪽이든 값 검증은 유지합니다.',
    },
  });

  /* ---------- 양자화 ---------- */
  const QW = [0.817, -1.274, 0.053, 0.402, -0.631, 1.096, -0.018, 0.305];
  const QX = [1, 0.5, 2, -1, 1, 1, -2, 0.5];
  const r3 = (x) => Math.round(x * 1000) / 1000;
  const qDot = (w) => w.reduce((a, v, i) => a + v * QX[i], 0);
  const QM = '가중치 메모리 (바이트)', QE = '최대 복원 오차', QY = '뉴런 출력';
  CS.add({
    id: 'quantization', level: 'mid', topic: 'ai',
    title: '양자화: 가중치를 적은 비트로 줄여 담기',
    summary: '모델의 가중치는 보통 32비트(또는 16비트) 실수로 저장됩니다. 양자화는 이 값을 8비트나 4비트 정수로 바꿔 담는 일입니다. 메모리가 그만큼 줄어드는 대신 값마다 반올림 오차가 생깁니다. 작은 배열을 실제로 양자화하고 복원해 오차가 얼마나 되는지 봅니다.',
    param: { label: '양자화 비트 수', options: [8, 4], value: 8 },
    headline: QM,
    verdict: '8비트로 줄이면 메모리는 32바이트에서 8바이트로 1/4이 되고, 복원 오차는 최대 0.004, 뉴런 출력은 0.538에서 0.527로 조금 달라집니다. 4비트로 바꿔 보면 메모리는 1/8이 되지만 작은 가중치가 0으로 뭉개지는 것이 보입니다. 수십 GB짜리 모델이 노트북 메모리에 들어가는 것은 이 맞바꿈 덕분입니다.',
    variants: [
      {
        name: '32비트 실수 그대로', tone: 'bad', label: '원본',
        code: `const weights = new Float32Array(W);
function neuron(x) {
  let sum = 0;
  for (let i = 0; i < weights.length; i++)
    sum += weights[i] * x[i];
  return sum;
}`,
        notes: { 1: '값 하나에 4바이트' },
        run(t) {
          t.m[QM] = 0; t.m[QE] = 0; t.m[QY] = 0;
          let y = null;
          const snap = (on) => [
            { type: 'cells', title: '가중치 8개 (float32) — 값 하나에 4바이트', items: QW.map((v, k) => ({ id: k, v, sub: '4바이트', gap: true, s: on ? 'active' : '' })) },
            { type: 'cells', title: '입력 x와 뉴런 출력 Σ w × x', items: [...QX.map((v, k) => ({ id: k, v, s: 'dim' })), { id: 'y', v: y == null ? '?' : r3(y), sub: '출력', s: y == null ? '' : 'done' }] },
          ];
          t.step(1, `신경망의 한 뉴런이 가진 가중치 8개입니다. 학습으로 정해진 값이고, 모델 파일의 대부분은 이런 숫자입니다.`, snap());
          t.m[QM] = QW.length * 4;
          t.step(1, `32비트 실수는 값 하나에 4바이트입니다. 8개면 <b>${t.m[QM]}바이트</b>입니다.`, snap(true));
          y = qDot(QW); t.m[QY] = r3(y);
          t.step(5, `입력과 곱해 더한 뉴런 출력은 <b>${r3(y)}</b>입니다. 이 값을 기준으로 삼습니다.`, snap());
          t.step(6, `가중치가 70억 개인 모델이라면 4바이트 × 70억 = <b>28GB</b>입니다. 계산하려면 이것이 전부 메모리(또는 GPU 메모리)에 올라가야 합니다.`, snap());
        },
      },
      {
        name: '정수로 양자화', tone: 'good', label: '줄여 담기',
        code: `const QMAX = 2 ** (BITS - 1) - 1;
const scale = Math.max(...W.map(Math.abs)) / QMAX;
const q = W.map(w => Math.round(w / scale));
function neuron(x) {
  let sum = 0;
  for (let i = 0; i < q.length; i++)
    sum += q[i] * scale * x[i];
  return sum;
}`,
        notes: { 1: '8비트 → 127, 4비트 → 7', 2: '가장 큰 값이 QMAX에 오도록', 3: '나누고 반올림 → 오차 발생', 7: '정수 × scale로 복원' },
        run(t, bits) {
          t.m[QM] = 0; t.m[QE] = 0; t.m[QY] = 0;
          const qmax = 2 ** (bits - 1) - 1, scale = Math.max(...QW.map(Math.abs)) / qmax;
          const q = [], back = [];
          let cur = -1, y = null;
          const err = (k) => Math.abs(QW[k] - back[k]);
          const snap = () => [
            { type: 'cells', title: '원본 가중치 (float32)', items: QW.map((v, k) => ({ id: k, v, gap: true, s: k === cur ? 'active' : '' })) },
            { type: 'cells', title: `${bits}비트 정수로 저장 (−${qmax} ~ ${qmax}) — 아래는 복원한 값 = 정수 × scale`, items: q.map((v, k) => ({ id: k, v, sub: r3(back[k]), gap: true, s: k === cur ? 'new' : v === 0 ? 'bad' : 'done' })) },
            { type: 'cells', bars: true, max: 100, title: `복원 오차 × 1000 (막대 높이의 기준은 100 = 오차 0.1)${y == null ? '' : ` · 뉴런 출력 ${r3(y)}`}`, items: back.map((_, k) => ({ id: k, v: Math.round(err(k) * 10000) / 10, gap: true, s: k === cur ? 'active' : err(k) > 0.05 ? 'bad' : '' })) },
          ];
          t.step(1, `${bits}비트 정수는 −${qmax}부터 ${qmax}까지 <b>${2 * qmax + 1}가지 값</b>만 담을 수 있습니다. 실수 8개를 이 눈금 위로 옮깁니다.`, snap());
          t.step(2, `가장 큰 절댓값 1.274가 ${qmax}에 오도록 눈금 간격을 정합니다. scale = 1.274 ÷ ${qmax} = <b>${scale.toFixed(4)}</b>. 반올림 오차는 최대 이 값의 절반입니다.`, snap());
          QW.forEach((w, k) => {
            cur = k;
            const v = Math.round(w / scale) + 0;
            q.push(v); back.push(v * scale);
            t.m[QE] = r3(Math.max(...back.map((_, i) => err(i))));
            t.step(3, `${w} ÷ scale = ${(w / scale).toFixed(2)} → 반올림해 <b>${v}</b>. 복원하면 ${r3(v * scale)}, 오차 ${r3(err(k))}.${v === 0 ? ' 눈금 하나보다 작은 값이라 <b>0이 됐습니다.</b>' : k === 1 ? ' 가장 큰 값은 눈금 끝에 정확히 맞습니다.' : ''}`, snap());
          });
          cur = -1;
          t.m[QM] = QW.length * bits / 8;
          t.step(3, bits === 8
            ? `정수 하나에 1바이트, 8개면 <b>${t.m[QM]}바이트</b>입니다. 32바이트의 1/4입니다. scale 값 하나는 배열 전체가 함께 씁니다.`
            : `4비트 값은 두 개를 1바이트에 묶어 저장합니다. 8개면 <b>${t.m[QM]}바이트</b>, 32바이트의 1/8입니다. scale 값 하나는 배열 전체가 함께 씁니다.`, snap());
          y = qDot(back); t.m[QY] = r3(y);
          const base = qDot(QW);
          t.step(7, `복원한 가중치로 계산한 뉴런 출력은 <b>${r3(y)}</b>입니다. 원본은 ${r3(base)}이었으니 ${r3(Math.abs(y - base))}만큼 달라졌습니다. ${bits === 8 ? '오차들이 서로 상쇄되기도 해 결과는 거의 같습니다.' : '오차가 커서 결과가 눈에 띄게 달라졌습니다.'}`, snap());
          t.step(8, `같은 비율이면 가중치 70억 개 모델은 28GB에서 <b>${bits === 8 ? '7GB' : '3.5GB'}</b>가 됩니다. ${bits === 8 ? '비트 수를 4로 바꿔 오차가 어떻게 커지는지 비교해 보세요.' : '메모리는 가장 작지만 최대 오차가 8비트 때의 약 20배입니다. 실제 4비트 양자화는 구역마다 scale을 따로 두는 등의 기법으로 이 손실을 줄입니다.'}`, snap());
        },
      },
    ],
    points: [
      '양자화는 실수를 <b>정해진 개수의 눈금</b>에 맞춰 반올림하는 일입니다. 8비트는 눈금이 255개, 4비트는 15개입니다. 눈금이 성길수록 오차가 커집니다.',
      '메모리는 비트 수에 비례합니다. 가중치 70억 개 기준으로 32비트 28GB, 16비트 14GB, 8비트 7GB, 4비트 3.5GB입니다. 모델이 메모리에 올라가느냐가 <b>실행 가능 여부</b>를 정합니다.',
      '작아지면 빨라지기도 합니다. 토큰 하나를 만들 때마다 가중치 전체를 메모리에서 읽어야 하므로, 읽을 양이 줄면 속도가 오릅니다.',
      '신경망은 작은 오차에 꽤 강해서 8비트까지는 품질 저하가 거의 없는 경우가 많고, 비트를 더 줄일수록 저하가 뚜렷해집니다. 얼마나 나빠지는지는 모델과 작업에 따라 다르므로 직접 재야 합니다.',
    ],
    senior: '실제 양자화는 이 예제보다 정교합니다. 배열 전체에 scale 하나를 쓰면 유난히 큰 값 하나가 눈금 간격을 벌려 나머지 값의 정밀도를 깎으므로, 채널이나 작은 블록 단위로 scale을 따로 두고, 민감한 층은 더 많은 비트로 남겨 둡니다. 학습이 끝난 가중치를 바꾸는 방식(학습 후 양자화)이 간편하고, 양자화된 상태를 흉내 내며 학습하는 방식(양자화 인식 학습)은 비용이 들지만 낮은 비트에서 품질이 더 좋습니다. 선택의 기준은 벤치마크 점수가 아니라 자기 작업의 평가 세트입니다. 요약은 멀쩡한데 긴 코드 생성이나 형식을 엄격히 지켜야 하는 출력에서만 무너지는 식으로, 저하는 고르게 나타나지 않습니다. 같은 메모리라면 "작은 모델을 높은 정밀도로"보다 "큰 모델을 낮은 비트로" 쓰는 편이 나은 경우가 많다고 알려져 있지만 이것도 측정으로 확인할 일입니다. API로만 모델을 쓰는 경우에도 관련이 있습니다. 공개 가중치 모델은 제공하는 곳마다 양자화 수준이 다를 수 있어, 이름이 같은 모델인데 품질이 다르게 나올 수 있습니다.',
    qa: [
      ['모델 양자화가 무엇이고 무엇을 맞바꿉니까?', '가중치를 32비트나 16비트 실수 대신 8비트, 4비트 같은 적은 비트의 정수로 저장하는 것입니다. 값의 범위를 정해진 개수의 눈금으로 나누고 가장 가까운 눈금으로 반올림합니다. 메모리와 읽는 양이 비트 수만큼 줄어드는 대신 값마다 반올림 오차가 생겨 품질이 조금 떨어질 수 있습니다.'],
      ['큰 모델을 노트북에서 돌릴 수 있는 이유는 무엇입니까?', '실행하려면 가중치 전체가 메모리에 올라가야 하는데, 양자화로 그 크기를 몇 분의 일로 줄이기 때문입니다. 가중치 70억 개 모델은 32비트로 28GB이지만 4비트면 3.5GB 정도입니다. 토큰마다 읽어야 하는 메모리 양도 줄어 속도에도 도움이 됩니다.'],
      ['양자화한 모델의 품질은 어떻게 판단합니까?', '원본과 양자화본을 같은 평가 세트로 비교합니다. 일반 벤치마크보다 실제로 시킬 작업의 입력과 채점 기준을 쓰는 것이 중요합니다. 저하는 작업마다 다르게 나타나고, 긴 출력이나 형식이 엄격한 작업에서 먼저 드러나는 경우가 많기 때문입니다.'],
    ],
  });
})();
