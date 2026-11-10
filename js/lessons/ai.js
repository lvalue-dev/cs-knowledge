/* AI: 토큰화(BPE), 다음 토큰 고르기(temperature), 경사 하강법, 벡터 검색, RAG
   모델 내부를 단순화한 장난감 예제다. 수치(확률, 토큰 수 등)는 원리를 보이기 위한 값이며 특정 모델의 실제 값이 아니다 */
(function () {
  const CS = window.CS;

  /* ---------- 토큰화: BPE ---------- */
  const CORPUS = [['low', 5], ['lower', 2], ['newest', 6], ['widest', 3]], MERGES = 5;
  CS.add({
    id: 'tokenization', level: 'basic',
    title: '토큰화: 언어 모델은 글자가 아니라 토큰을 본다',
    summary: 'LLM의 입력 한도와 요금은 글자 수가 아니라 토큰 수로 셉니다. 토큰은 "자주 함께 나오는 글자 묶음"이고, 그 묶음을 정하는 대표적인 방법이 BPE입니다. 가장 흔한 이웃 쌍을 반복해서 합치는 과정을 봅니다.',
    verdict: '자주 나오는 조각(est, low)은 토큰 하나가 되고, 드문 단어는 여러 조각으로 쪼개집니다. 그래서 같은 글자 수라도 흔한 영어 단어는 토큰이 적고, 드문 단어·한글·코드·숫자는 토큰이 많아지는 경향이 있습니다.',
    variants: [{
      name: 'BPE 학습 과정', tone: 'info', big: { time: 'O(병합 횟수 × 말뭉치 크기)', space: 'O(어휘 크기)' },
      code: `function trainBPE(words, merges) {
  let tokens = words.map(w => [...w]);
  for (let i = 0; i < merges; i++) {
    const pairs = countPairs(tokens);
    const best = mostFrequent(pairs);
    tokens = tokens.map(t => merge(t, best));
    vocab.push(best.join(''));
  }
}`,
      notes: { 2: '처음에는 글자 하나가 토큰', 5: '가장 흔한 이웃 쌍', 6: '그 쌍을 한 토큰으로' },
      run(t) {
        let words = CORPUS.map(([w, n]) => ({ w, n, tok: [...w] }));
        const vocab = [];
        const total = () => words.reduce((s, x) => s + x.tok.length * x.n, 0);
        t.m['말뭉치의 토큰 수'] = total(); t.m['합쳐 만든 토큰 수'] = 0;
        const snap = (best, top) => [
          { type: 'cells', title: '말뭉치의 단어들 (오른쪽 숫자는 등장 횟수) — 칸 하나가 토큰 하나', items: words.flatMap((x, wi) => [...x.tok.map((tk, i) => ({ id: `${wi}-${i}-${tk}`, v: tk, s: best && ((tk === best[0] && x.tok[i + 1] === best[1]) || (tk === best[1] && x.tok[i - 1] === best[0])) ? 'active' : tk.length > 1 ? 'new' : '' })), { id: `n${wi}`, v: `×${x.n}`, s: 'dim', gap: true }]) },
          ...(top ? [{ type: 'cells', title: '이웃한 쌍의 등장 횟수 (상위)', items: top.map(([p, n], k) => ({ id: p, v: `${p.replace(' ', '+')}  ${n}회`, s: k === 0 ? 'active' : '' })) }] : []),
          { type: 'cells', title: '새로 만든 토큰 (어휘에 추가됨)', items: vocab.map((v) => ({ id: v, v, s: 'new' })) },
        ];
        t.step(2, `처음에는 모든 글자가 각각 토큰입니다. 말뭉치 전체는 토큰 <b>${total()}개</b>입니다.`, snap());
        for (let m = 0; m < MERGES; m++) {
          const count = new Map();
          for (const x of words) for (let i = 0; i + 1 < x.tok.length; i++) { const k = `${x.tok[i]} ${x.tok[i + 1]}`; count.set(k, (count.get(k) || 0) + x.n); }
          const top = [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
          const best = top[0][0].split(' ');
          t.step(4, `${m + 1}번째 병합 — 붙어 있는 토큰 쌍이 몇 번 나오는지 셉니다.`, snap(null, top));
          t.step(5, `가장 흔한 쌍은 <b>${best[0]} + ${best[1]}</b> (${top[0][1]}회)입니다.`, snap(best, top));
          words = words.map((x) => { const out = []; for (let i = 0; i < x.tok.length; i++) { if (x.tok[i] === best[0] && x.tok[i + 1] === best[1]) { out.push(best.join('')); i++; } else out.push(x.tok[i]); } return { ...x, tok: out }; });
          vocab.push(best.join(''));
          t.m['말뭉치의 토큰 수'] = total(); t.m['합쳐 만든 토큰 수'] = vocab.length;
          t.step(6, `이 쌍을 전부 <b>${best.join('')}</b> 하나로 합칩니다. 말뭉치가 토큰 ${total()}개로 줄었습니다.`, snap());
        }
        t.step(9, `병합 ${MERGES}번 만에 자주 쓰는 조각이 토큰 하나가 됐습니다. 실제 토크나이저는 이 과정을 수만 번 반복해 어휘를 만듭니다.`, snap());
      },
    }],
    points: [
      '토큰은 단어도 글자도 아닌 그 사이의 조각(subword)입니다. 처음 보는 단어도 아는 조각들로 쪼개 표현할 수 있습니다.',
      '<b>컨텍스트 윈도</b>(한 번에 넣을 수 있는 양), <b>요금</b>, <b>응답 속도</b>가 모두 토큰 수에 비례합니다.',
      '글자 수로 토큰 수를 정확히 알 수는 없습니다. 모델마다 토크나이저가 다르므로, 정확한 값은 해당 모델의 토큰 계산 도구로 셉니다.',
    ],
    senior: '운영 비용과 한도 초과 오류는 대부분 토큰 계산을 글자 수로 어림해서 생깁니다. 입력을 자를 때는 반드시 실제 토크나이저 기준으로 자르고, 긴 대화는 요약하거나 오래된 부분을 덜어냅니다. 또 모델이 "문자 단위" 작업(글자 수 세기, 거꾸로 쓰기, 특정 위치의 글자 찾기)에 약한 것은 애초에 글자를 보지 못하기 때문입니다. 그런 작업은 코드로 처리하고 모델에는 맡기지 않는 편이 안전합니다.',
  });

  /* ---------- 다음 토큰 고르기: temperature ---------- */
  const NEXT = {
    '서버가': [['느려졌습니다', 2.2], ['멈췄습니다', 1.6], ['춤을', 0.2]],
    '느려졌습니다': [['원인은', 2.4], ['다행히', 1.2], ['그래서', 1.0]],
    '멈췄습니다': [['원인은', 2.0], ['재시작이', 1.5], ['모두가', 0.6]],
    '원인은': [['인덱스', 1.9], ['캐시', 1.7], ['달빛', 0.1]],
    '다행히': [['복구', 2.0], ['아무도', 1.2], ['캐시', 0.9]],
    '재시작이': [['필요합니다', 2.2], ['두렵습니다', 0.8], ['캐시', 0.3]],
  };
  const softmax = (logits, T) => { const e = logits.map((l) => Math.exp(l / T)), s = e.reduce((a, b) => a + b, 0); return e.map((x) => x / s); };
  const sampleRun = (T, rolls) => (t) => {
    t.m['1순위가 아닌 토큰을 고른 횟수'] = 0;
    const out = ['서버가'];
    const snap = (cands, probs, pick, roll) => [
      { type: 'cells', title: '지금까지 만든 문장', items: out.map((v, k) => ({ id: k, v, s: k === out.length - 1 && pick == null ? 'active' : 'done' })) },
      ...(cands ? [{ type: 'timeline', total: 1, title: `다음 토큰 후보의 확률 (temperature = ${T})${roll != null ? ` · 뽑은 난수 ${roll}` : ''}`, items: cands.map(([w], k) => ({ id: w, label: w, start: 0, len: probs[k], s: k === pick ? 'active' : '', text: `${Math.round(probs[k] * 100)}%` })) }] : []),
    ];
    t.step(1, `모델은 한 번에 문장 전체를 쓰지 않습니다. <b>다음 토큰 하나</b>의 확률을 계산하고, 하나를 고르고, 그것을 붙여 다시 계산합니다.`, snap());
    for (let i = 0; i < 3; i++) {
      const cands = NEXT[out[out.length - 1]];
      if (T === 0) {
        const p1 = softmax(cands.map((c) => c[1]), 1);
        t.step(2, `"${out[out.length - 1]}" 다음 후보의 확률입니다. temperature 0은 <b>항상 가장 높은 것</b>을 고릅니다.`, snap(cands, p1, 0));
        out.push(cands[0][0]);
        continue;
      }
      const probs = softmax(cands.map((c) => c[1]), T);
      t.step(3, `"${out[out.length - 1]}" 다음 후보. 점수를 temperature(${T})로 나눈 뒤 확률로 바꿉니다. 값이 클수록 <b>확률이 평평해져</b> 낮은 후보에도 기회가 갑니다.`, snap(cands, probs));
      const roll = rolls[i];
      let acc = 0, pick = cands.length - 1;
      for (let k = 0; k < probs.length; k++) { acc += probs[k]; if (roll < acc) { pick = k; break; } }
      if (pick) t.m['1순위가 아닌 토큰을 고른 횟수']++;
      t.step(4, `확률에 따라 <b>주사위를 굴립니다.</b> 이번에는 "${cands[pick][0]}"${pick ? ' — 1순위가 아닌 후보가 뽑혔습니다.' : ' — 1순위가 뽑혔습니다.'}`, snap(cands, probs, pick, roll));
      out.push(cands[pick][0]);
    }
    t.step(5, T === 0
      ? `결과: <b>${out.join(' ')}</b>. 같은 입력이면 매번 같은 문장이 나옵니다.`
      : `결과: <b>${out.join(' ')}</b>. 다시 실행하면 다른 문장이 나옵니다. 가끔은 엉뚱한 토큰도 뽑힙니다.`, snap());
  };
  const SAMPLE_CODE = `function next(logits, temperature) {
  if (temperature === 0) return argmax(logits);
  const probs = softmax(logits.map(l => l / temperature));
  return sample(probs);
}`;
  CS.add({
    id: 'sampling', level: 'mid',
    title: '다음 토큰 고르기: 같은 질문에 답이 달라지는 이유',
    summary: '언어 모델은 "다음에 올 토큰의 확률"을 계산할 뿐이고, 그중 무엇을 고를지는 별도의 규칙입니다. temperature는 그 고르는 방식을 조절하는 값으로, 낮으면 일관되고 높으면 다양해집니다.',
    verdict: '어느 쪽이 더 좋은 것이 아닙니다. 분류·추출·코드 생성처럼 재현성이 필요하면 낮게, 아이디어·문장 다듬기처럼 다양성이 필요하면 높게 둡니다. 모델이 "틀릴 수 있는" 이유 중 하나가 이 확률적 선택입니다.',
    variants: [
      { name: 'temperature 0 — 항상 1순위', tone: 'info', label: '일관됨', code: SAMPLE_CODE, notes: { 2: '가장 확률 높은 토큰' }, run: sampleRun(0) },
      { name: 'temperature 1.5 — 확률대로 뽑기', tone: 'info', label: '다양함', code: SAMPLE_CODE, notes: { 3: '나누는 값이 클수록 평평', 4: '확률에 따라 무작위' }, run: sampleRun(1.5, [0.2, 0.75, 0.3]) },
    ],
    points: [
      '모델의 출력은 <b>확률 분포</b>이고, 생성은 "예측 → 선택 → 붙이기"의 반복(자기회귀)입니다. 그래서 응답이 토큰 단위로 스트리밍됩니다.',
      '한 번 고른 토큰은 되돌리지 않습니다. 초반에 어긋난 토큰이 뒤의 내용을 끌고 가므로, 긴 출력일수록 어긋남이 쌓일 수 있습니다.',
      'top-p, top-k도 같은 계열입니다. 확률이 낮은 꼬리를 잘라낸 뒤 남은 후보 안에서 뽑습니다.',
    ],
    senior: 'LLM을 서비스에 넣을 때 "같은 입력 = 같은 출력"을 가정한 코드는 깨집니다. 테스트는 정확한 문자열 비교 대신 구조 검증(JSON 스키마)과 평가 기준으로 짜고, 출력을 코드가 파싱해야 하면 구조화된 출력 기능이나 재시도·검증 로직을 둡니다. temperature를 0으로 해도 완전한 재현이 보장되지 않는 경우가 있으므로(하드웨어·배치·모델 버전 차이), 결과를 다시 쓸 일이 있으면 생성 결과 자체를 저장해 두는 편이 안전합니다.',
  });

  /* ---------- 경사 하강법 ---------- */
  const gdRun = (lr) => (t) => {
    t.m['손실'] = 9;
    let w = 0;
    const hist = [9];
    const r1 = (x) => Math.round(x * 10) / 10;
    const snap = (grad) => [
      { type: 'cells', bars: true, max: 45, title: '단계별 손실 (w − 3)² — 낮을수록 정답에 가까움', items: hist.map((v, k) => ({ id: k, v: Math.min(45, r1(v)), s: k === hist.length - 1 ? (v > hist[0] ? 'bad' : 'active') : k && v > hist[k - 1] ? 'bad' : 'done' })) },
      { type: 'cells', title: '현재 값 (정답은 w = 3)', items: [{ id: 'w', v: r1(w), sub: 'w', s: 'active' }, { id: 'g', v: grad == null ? '–' : r1(grad), sub: '기울기' }, { id: 'lr', v: lr, sub: '학습률' }] },
    ];
    t.step(2, `<code>w = 0</code>에서 시작합니다. 목표는 손실 <code>(w − 3)²</code>이 가장 작아지는 w를 찾는 것입니다. 모델은 정답이 3이라는 것을 모르고, <b>기울기만</b> 볼 수 있습니다.`, snap());
    for (let s = 0; s < 8; s++) {
      const grad = 2 * (w - 3);
      t.step(4, `기울기 = 2 × (${r1(w)} − 3) = <b>${r1(grad)}</b>. ${grad < 0 ? '음수이므로 w를 키워야 손실이 줄어듭니다.' : '양수이므로 w를 줄여야 손실이 줄어듭니다.'}`, snap(grad));
      const prev = (w - 3) ** 2;
      w -= lr * grad;
      const loss = (w - 3) ** 2;
      hist.push(loss); t.m['손실'] = r1(loss);
      t.step(5, `기울기 반대 방향으로 <code>학습률 × 기울기</code>만큼 이동 → w = <b>${r1(w)}</b>, 손실 ${r1(loss)}. ${loss > prev ? '정답을 <b>지나쳐서 더 멀어졌습니다.</b>' : '정답에 가까워졌습니다.'}`, snap(grad));
    }
    t.step(6, lr > 1
      ? `8번 만에 손실이 ${r1(hist[hist.length - 1])}까지 <b>커졌습니다.</b> 보폭이 너무 커서 매번 골짜기 반대편으로 더 높이 튀어 오릅니다(발산).`
      : `8번 만에 손실이 거의 0이 됐습니다. w는 ${r1(w)}로 정답 3에 도달했습니다(수렴).`, snap());
  };
  const gdCode = (lr) => `const LR = ${lr};
let w = 0;
for (let step = 0; step < 8; step++) {
  const grad = 2 * (w - 3);
  w = w - LR * grad;
}`;
  CS.add({
    id: 'gradient-descent', level: 'mid',
    title: '경사 하강법: 모델은 어떻게 "학습"하는가',
    summary: '학습이란 손실(틀린 정도)을 줄이는 방향으로 숫자들을 조금씩 고치는 일입니다. 어느 방향으로 고칠지는 기울기가, 얼마나 고칠지는 학습률이 정합니다. 학습률 하나로 수렴과 발산이 갈립니다.',
    headline: '손실',
    verdict: '두 코드는 숫자 하나만 다릅니다. 보폭이 적당하면 골짜기 바닥으로 내려가고, 너무 크면 매번 반대편으로 더 높이 튀어 올라 발산합니다. 실제 모델은 이 w가 수십억 개일 뿐 원리는 같습니다.',
    variants: [
      { name: '학습률 1.05 — 보폭이 너무 큼', tone: 'bad', label: '발산', code: gdCode(1.05), notes: { 5: '정답을 지나쳐 더 멀리' }, run: gdRun(1.05) },
      { name: '학습률 0.3 — 적당한 보폭', tone: 'good', label: '수렴', code: gdCode(0.3), notes: { 5: '조금씩 정답 쪽으로' }, run: gdRun(0.3) },
    ],
    points: [
      '기울기는 "지금 위치에서 w를 조금 키우면 손실이 얼마나 변하는가"입니다. 그 <b>반대 방향</b>으로 가면 손실이 줄어듭니다.',
      '학습률이 너무 작으면 발산하지는 않지만 한없이 느립니다. 그래서 학습 도중 학습률을 조절하는 스케줄과 Adam 같은 최적화 기법을 씁니다.',
      '신경망에서는 <b>역전파</b>가 모든 가중치의 기울기를 한 번에 계산해 줍니다. 연쇄 법칙을 뒤에서부터 적용하는 것입니다.',
    ],
    senior: '학습 로그에서 손실이 NaN이나 inf가 됐다면 대부분 이 그림입니다. 학습률이 너무 크거나, 입력 값의 크기가 제각각이라 기울기가 폭주한 경우입니다. 처방은 학습률 낮추기, 입력 정규화, 기울기 크기 제한(gradient clipping), 워밍업입니다. 모델을 직접 학습시키지 않는 개발자에게도 이 개념은 쓸모가 있습니다. "모델이 안다"는 것은 규칙을 저장한 것이 아니라 손실을 줄이는 방향으로 숫자가 맞춰진 결과일 뿐이라는 점이, 모델이 왜 그럴듯하게 틀리는지를 설명해 줍니다.',
  });

  /* ---------- 벡터 검색 ---------- */
  const CENTERS = [[70, 48], [236, 44], [74, 150], [240, 150]];
  const OFFS = [[-22, -14], [16, -20], [26, 8], [-8, 22], [-30, 12], [6, -2]];
  const VECS = CENTERS.flatMap(([cx, cy], c) => OFFS.map(([dx, dy], k) => ({ id: `v${c}${k}`, x: cx + dx * (c % 2 ? 1 : -1), y: cy + dy * (c > 1 ? 1 : -1), c })));
  const QUERY = { x: 204, y: 116 };
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const vecPanel = (state, edges, showCenters) => ({
    type: 'graph', w: 320, h: 204, scale: 1.5, title: '점 하나가 문서 하나의 임베딩 — 뜻이 비슷할수록 가까이 놓임 (실제로는 수백~수천 차원)',
    nodes: [
      ...VECS.map((v) => ({ id: v.id, v: '', x: v.x, y: v.y, w: 13, h: 13, round: true, s: state(v) })),
      ...(showCenters ? CENTERS.map(([x, y], c) => ({ id: `c${c}`, v: `C${c + 1}`, x, y, w: 26, h: 20, s: showCenters(c) })) : []),
      { id: 'q', v: 'Q', x: QUERY.x, y: QUERY.y, w: 22, h: 22, round: true, s: 'active' },
    ],
    edges,
  });
  CS.add({
    id: 'vector-search', level: 'adv',
    title: '벡터 검색: 뜻이 비슷한 문서를 찾는 방법',
    summary: '임베딩은 문장을 숫자 목록(벡터)으로 바꿔, 뜻이 비슷한 것끼리 가까이 놓습니다. 검색은 "질문 벡터와 가장 가까운 점 찾기"가 되는데, 문서가 수백만 개면 전부와 거리를 잴 수 없습니다. 근사 검색 인덱스가 필요한 이유입니다.',
    headline: '거리 계산 횟수',
    verdict: '인덱스는 점들을 미리 묶어 두고, 질문과 가까운 묶음만 살펴봅니다. 계산이 크게 줄어드는 대신 "정확히 가장 가까운 점"을 놓칠 수 있습니다. 그래서 근사(Approximate) 최근접 이웃 검색이라고 부릅니다.',
    variants: [
      {
        name: '전수 비교', tone: 'bad', big: { time: 'O(n × 차원)', space: 'O(1)' },
        code: `function nearest(query, vectors) {
  let best = null, bestDist = Infinity;
  for (const v of vectors) {
    const d = distance(query, v);
    if (d < bestDist) { best = v; bestDist = d; }
  }
  return best;
}`,
        notes: { 4: '모든 문서와 거리 계산' },
        run(t) {
          t.m['거리 계산 횟수'] = 0;
          let best = null;
          const seen = new Set();
          const snap = (cur) => [vecPanel((v) => (v === best ? 'done' : v === cur ? 'cmp' : seen.has(v.id) ? 'dim' : ''), [...(cur ? [{ a: 'q', b: cur.id, s: 'active' }] : []), ...(best && best !== cur ? [{ a: 'q', b: best.id, s: 'done' }] : [])])];
          t.step(2, `질문 Q와 가장 가까운 문서를 찾습니다. 인덱스가 없으니 ${VECS.length}개 전부와 거리를 잽니다.`, snap());
          for (const v of VECS) {
            t.m['거리 계산 횟수']++; seen.add(v.id);
            const better = !best || dist(QUERY, v) < dist(QUERY, best);
            if (better) best = v;
            t.step(better ? 5 : 4, better ? `거리 ${Math.round(dist(QUERY, v))} — 지금까지 중 <b>가장 가깝습니다.</b>` : `거리 ${Math.round(dist(QUERY, v))} — 더 멀어서 넘어갑니다. 반대편 구석의 점까지 전부 계산합니다.`, snap(v));
          }
          t.step(7, `${VECS.length}번 계산해 가장 가까운 문서를 찾았습니다. 문서가 100만 개면 질문 하나에 100만 번입니다.`, snap());
        },
      },
      {
        name: '근사 검색 인덱스 (묶음 단위)', tone: 'good', big: { time: 'O(묶음 수 + 묶음 크기)', space: 'O(n)' },
        code: `function nearest(query, index) {
  const cluster = closest(query, index.centroids);
  let best = null, bestDist = Infinity;
  for (const v of cluster.vectors) {
    const d = distance(query, v);
    if (d < bestDist) { best = v; bestDist = d; }
  }
  return best;
}`,
        notes: { 2: '묶음의 대표점과만 비교', 4: '가까운 묶음 안에서만' },
        run(t) {
          t.m['거리 계산 횟수'] = 0;
          let best = null, pick = -1, probing = -1;
          const seen = new Set();
          const snap = (cur) => [vecPanel((v) => (pick >= 0 && v.c !== pick ? 'dim' : v === best ? 'done' : v === cur ? 'cmp' : seen.has(v.id) ? 'dim' : ''),
            [...(probing >= 0 ? [{ a: 'q', b: `c${probing}`, s: 'active' }] : []), ...(cur ? [{ a: 'q', b: cur.id, s: 'active' }] : []), ...(best && best !== cur ? [{ a: 'q', b: best.id, s: 'done' }] : [])],
            (c) => (c === pick ? 'new' : c === probing ? 'cmp' : pick >= 0 ? 'dim' : ''))];
          t.step(1, `미리 비슷한 문서끼리 4개 묶음으로 나누고, 묶음마다 <b>대표점</b>(C1~C4)을 계산해 두었습니다.`, snap());
          let bd = Infinity;
          CENTERS.forEach(([x, y], c) => { probing = c; t.m['거리 계산 횟수']++; const d = dist(QUERY, { x, y }); if (d < bd) { bd = d; } t.step(2, `대표점 C${c + 1}까지의 거리 ${Math.round(d)}.`, snap()); });
          probing = -1;
          pick = CENTERS.map(([x, y]) => dist(QUERY, { x, y })).reduce((bi, d, i, a) => (d < a[bi] ? i : bi), 0);
          t.step(2, `가장 가까운 묶음은 <b>C${pick + 1}</b>입니다. 나머지 세 묶음의 문서 ${VECS.length - VECS.filter((v) => v.c === pick).length}개는 <b>거리를 재지도 않고</b> 제외합니다.`, snap());
          for (const v of VECS.filter((x) => x.c === pick)) {
            t.m['거리 계산 횟수']++; seen.add(v.id);
            const better = !best || dist(QUERY, v) < dist(QUERY, best);
            if (better) best = v;
            t.step(better ? 6 : 5, better ? `거리 ${Math.round(dist(QUERY, v))} — 지금까지 중 가장 가깝습니다.` : `거리 ${Math.round(dist(QUERY, v))} — 더 멉니다.`, snap(v));
          }
          t.step(8, `<b>${t.m['거리 계산 횟수']}번</b> 계산으로 같은 문서를 찾았습니다. 다만 질문이 묶음 경계 근처였다면 옆 묶음의 더 가까운 점을 놓쳤을 수 있습니다.`, snap());
        },
      },
    ],
    points: [
      '키워드 검색은 <b>같은 단어</b>가 있어야 찾고, 벡터 검색은 단어가 달라도 <b>뜻이 가까우면</b> 찾습니다("환불" ↔ "돈을 돌려받기").',
      '정확도(재현율)와 속도는 맞바꾸는 관계입니다. 살펴볼 묶음 수를 늘리면 더 정확하고 더 느려집니다.',
      '묶음 방식(IVF) 외에 가까운 점끼리 연결한 그래프를 따라가는 방식(HNSW)이 널리 쓰입니다.',
    ],
    senior: '벡터 검색만으로는 부족한 경우가 많습니다. 제품 코드, 오류 번호, 사람 이름처럼 정확히 일치해야 하는 검색은 키워드가 더 잘 찾으므로, 실무에서는 둘을 합치는 하이브리드 검색과 상위 결과를 다시 정렬하는 재순위(rerank)를 함께 씁니다. 운영에서 놓치기 쉬운 것은 "임베딩 모델을 바꾸면 기존 벡터와 호환되지 않아 전부 다시 만들어야 한다"는 점과, 검색 결과에 접근 권한 필터가 반드시 적용되어야 한다는 점입니다.',
  });

  /* ---------- RAG ---------- */
  const DOCS = ['환불 정책 §3.2: 구매 후 30일 이내 전액 환불', '배송 안내 §1.1: 평일 오후 2시 이전 주문은 당일 출고', '환불 정책 §3.4: 개봉한 소프트웨어는 환불 불가', '회원 등급 §2.1: 연 구매액 기준 3단계'];
  const Q = '우리 회사 환불 기한이 며칠이야?';
  const ragRun = (rag) => (t) => {
    t.m['프롬프트에 넣은 근거 문서'] = 0; t.m['답의 근거'] = 0;
    const prompt = [], pick = [];
    let answer = null;
    const snap = (stage) => [
      ...(rag && !prompt.length ? [{ type: 'stack', down: true, title: '사내 문서 저장소 (모델은 학습한 적 없는 내용)', items: DOCS.map((d, k) => ({ id: `d${k}`, v: d, s: pick.includes(k) ? 'done' : stage === 'search' ? 'cmp' : stage ? 'dim' : '' })) }] : []),
      { type: 'stack', down: true, title: '모델에게 전달되는 프롬프트', items: prompt.map((p, k) => ({ id: `p${k}`, v: p.v, s: p.s })) },
      { type: 'stack', down: true, title: '모델의 답', items: answer ? [{ id: 'a', v: answer.v, s: answer.s }] : [] },
    ];
    t.step(1, `사용자가 묻습니다: <b>"${Q}"</b> 이 회사의 환불 규정은 사내 문서에만 있습니다.`, snap());
    if (!rag) {
      prompt.push({ v: `질문: ${Q}`, s: 'active' });
      t.step(2, `질문을 그대로 모델에 보냅니다. 모델이 가진 것은 <b>학습 때 본 일반 지식</b>뿐입니다.`, snap());
      answer = { v: '"일반적으로 구매 후 14일 이내입니다."', s: 'bad' };
      t.step(2, `모델은 "모른다"고 하는 대신, 환불 정책이라면 <b>흔히 나올 법한 문장</b>을 만들어 냅니다. 그럴듯하지만 이 회사의 규정(30일)과 다릅니다.`, snap());
      t.step(3, `근거 없이 지어낸 답입니다(환각). 문장은 자연스러워서 틀렸다는 것을 알아차리기 어렵습니다.`, snap());
      return;
    }
    t.step(2, `질문을 임베딩 벡터로 바꿉니다. "환불", "기한"과 뜻이 가까운 문서를 찾기 위해서입니다.`, snap());
    t.step(3, `벡터 검색으로 사내 문서 중 질문과 가장 가까운 조각을 찾습니다.`, snap('search'));
    pick.push(0, 2);
    t.step(3, `상위 2개가 선택됐습니다. 배송·회원 등급 문서는 관련이 없어 제외됩니다.`, snap('picked'));
    prompt.push({ v: '지시: 아래 근거만 사용해 답하고, 근거에 없으면 모른다고 답할 것', s: 'new' });
    prompt.push({ v: `근거 1: ${DOCS[0]}`, s: 'done' }, { v: `근거 2: ${DOCS[2]}`, s: 'done' });
    prompt.push({ v: `질문: ${Q}`, s: 'active' });
    t.m['프롬프트에 넣은 근거 문서'] = 2;
    t.step(4, `찾은 조각을 질문과 함께 프롬프트에 넣습니다. 모델을 다시 학습시킨 것이 아니라, <b>답에 필요한 자료를 시험지에 같이 준 것</b>입니다.`, snap('picked'));
    answer = { v: '"구매 후 30일 이내 전액 환불됩니다. 단, 개봉한 소프트웨어는 제외입니다. (환불 정책 §3.2, §3.4)"', s: 'done' };
    t.m['답의 근거'] = 2;
    t.step(5, `모델이 근거를 읽고 답합니다. 내용이 정확하고, <b>출처를 확인할 수 있습니다.</b>`, snap('picked'));
  };
  CS.add({
    id: 'rag', level: 'adv',
    title: 'RAG: 모델이 모르는 것을 답하게 하는 방법',
    summary: '언어 모델은 학습한 시점까지의 공개된 지식만 압니다. 사내 문서나 어제 바뀐 규정을 물으면 그럴듯한 말을 지어냅니다. RAG는 질문과 관련된 문서를 먼저 찾아 프롬프트에 함께 넣어 주는 방식입니다.',
    headline: '답의 근거',
    verdict: 'RAG는 모델을 바꾸지 않습니다. 검색으로 근거를 찾아 "이것을 보고 답하라"고 주는 것입니다. 그래서 답의 품질은 검색의 품질을 넘지 못합니다. 틀린 문서를 찾으면 틀린 답이 근거까지 달고 나옵니다.',
    variants: [
      {
        name: '모델에게 바로 질문', tone: 'bad', label: '지어낸 답',
        code: `async function answer(question) {
  return llm.generate(question);
}`,
        notes: { 2: '모델이 아는 것만으로 답함' }, run: ragRun(false),
      },
      {
        name: '검색해서 근거와 함께 질문 (RAG)', tone: 'good', label: '근거 있는 답',
        code: `async function answer(question) {
  const qVec = await embed(question);
  const chunks = await vectorDB.search(qVec, { topK: 2 });
  const prompt = buildPrompt(question, chunks);
  return llm.generate(prompt);
}`,
        notes: { 3: '관련 문서 조각 검색', 4: '근거 + 질문을 한 프롬프트로' }, run: ragRun(true),
      },
    ],
    points: [
      'RAG = <b>검색(Retrieval)</b>으로 <b>보강한(Augmented)</b> <b>생성(Generation)</b>. 준비 단계에서 문서를 조각내 임베딩해 두고, 질문 때 검색합니다.',
      '모델을 다시 학습시키는 것(파인튜닝)과 다릅니다. 문서를 고치면 바로 반영되고, 답의 출처를 보여 줄 수 있습니다.',
      '프롬프트에 넣을 수 있는 양(컨텍스트 윈도)과 비용에 한계가 있으므로, "가장 관련 있는 몇 조각"을 고르는 것이 핵심입니다.',
    ],
    senior: '운영에서 문제가 되는 지점은 대개 생성이 아니라 검색입니다. 문서를 어떻게 자를지(너무 작으면 맥락이 끊기고 너무 크면 잡음이 섞임), 표·코드·PDF를 어떻게 읽을지, 오래된 문서와 최신 문서 중 무엇을 우선할지가 품질을 정합니다. 보안도 설계에 포함해야 합니다. 검색 결과에 사용자의 접근 권한이 적용되지 않으면 남의 문서 내용이 답에 섞여 나가고, 검색된 문서 안에 "이전 지시를 무시하라" 같은 문장이 있으면 모델이 따를 수 있습니다(프롬프트 인젝션). 마지막으로, 질문-정답 쌍으로 된 평가 세트 없이 RAG를 개선하는 것은 감에 의존하는 일입니다.',
  });
})();
