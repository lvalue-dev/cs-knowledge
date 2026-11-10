/* 기초(실전): 값과 참조, 부동소수점, 유니코드 문자열 */
(function () {
  const CS = window.CS;

  /* ---------- 값과 참조: 얕은 복사 ---------- */
  const copyRun = (deep) => (t) => {
    t.m['오염된 원본 필드'] = 0; t.m['새로 만든 객체'] = 0;
    const v = { name: 'Kim', city: 'Seoul', cname: 'Kim', ccity: 'Seoul' };
    const snap = (stage, hot) => [{
      type: 'graph', directed: true, w: 470, h: 150, scale: 1.5,
      title: '왼쪽: 변수(스택) · 오른쪽: 객체(힙). 변수에는 객체가 아니라 "주소"가 들어 있습니다',
      nodes: [
        { id: 'user', v: 'user', x: 44, y: 34, w: 52, s: 'cmp' },
        { id: 'o1', v: `name: '${v.name}'`, x: 190, y: 34, w: 118, sub: 'addr →', s: hot === 'o1' ? 'active' : '' },
        { id: 'a1', v: `city: '${v.city}'`, x: 380, y: 34, w: 124, s: hot === 'a1' ? 'bad' : '' },
        ...(stage >= 1 ? [
          { id: 'copy', v: 'copy', x: 44, y: 112, w: 52, s: 'cmp' },
          { id: 'o2', v: `name: '${v.cname}'`, x: 190, y: 112, w: 118, sub: 'addr →', s: hot === 'o2' ? 'active' : 'new' },
        ] : []),
        ...(stage >= 1 && deep ? [{ id: 'a2', v: `city: '${v.ccity}'`, x: 380, y: 112, w: 124, s: hot === 'a2' ? 'active' : 'new' }] : []),
      ],
      edges: [
        { a: 'user', b: 'o1' }, { a: 'o1', b: 'a1' },
        ...(stage >= 1 ? [{ a: 'copy', b: 'o2' }, deep ? { a: 'o2', b: 'a2' } : { a: 'o2', b: 'a1', s: 'bad' }] : []),
      ],
    }];
    t.step(1, `<code>user</code> 객체 안에 <code>addr</code> 객체가 또 들어 있습니다. 실제로는 객체 두 개가 주소로 연결된 구조입니다.`, snap(0));
    t.m['새로 만든 객체'] = deep ? 2 : 1;
    t.step(2, deep
      ? `<code>structuredClone</code>은 안쪽 객체까지 <b>전부 새로</b> 만듭니다. 두 객체는 완전히 분리됩니다.`
      : `<code>{ ...user }</code>는 <b>바깥 한 겹만</b> 새로 만듭니다. <code>addr</code>는 주소만 복사되어 원본과 <b>같은 객체</b>를 가리킵니다.`, snap(1));
    v.cname = 'Lee';
    t.step(3, `<code>copy.name</code> 변경 — 바깥 객체는 따로 있으므로 원본은 그대로입니다. 여기까지는 문제가 없어 보입니다.`, snap(1, 'o2'));
    if (deep) v.ccity = 'Busan'; else { v.city = 'Busan'; t.m['오염된 원본 필드'] = 1; }
    t.step(4, deep
      ? `<code>copy.addr.city</code> 변경 — 복사본의 addr만 바뀝니다.`
      : `<code>copy.addr.city</code> 변경 — 그런데 이 addr는 <b>원본과 공유</b>하는 객체입니다. 원본도 함께 바뀌었습니다.`, snap(1, deep ? 'a2' : 'a1'));
    t.step(5, deep
      ? `<code>user.addr.city</code> → <b>'Seoul'</b>. 원본은 안전합니다.`
      : `<code>user.addr.city</code> → <b>'Busan'</b>. 복사본만 고쳤는데 원본이 바뀌었습니다.`, snap(1, deep ? '' : 'a1'));
  };
  const copyCode = (how) => `const user = { name: 'Kim', addr: { city: 'Seoul' } };
const copy = ${how};
copy.name = 'Lee';
copy.addr.city = 'Busan';
console.log(user.addr.city);`;
  CS.add({
    id: 'reference-copy', level: 'basic',
    title: '값과 참조: 복사했는데 원본이 바뀐다',
    summary: '객체를 변수에 담으면 객체 자체가 아니라 주소가 담깁니다. 그래서 "복사"가 어디까지 복사하는지 모르면, 고친 적 없는 데이터가 바뀌는 버그를 만나게 됩니다.',
    verdict: '스프레드와 Object.assign은 한 겹만 복사합니다. 중첩된 객체·배열은 주소가 복사되어 원본과 공유됩니다. "고친 적 없는 값이 바뀌었다"면 누가 같은 객체를 가리키는지부터 찾으세요.',
    variants: [
      { name: '얕은 복사 { ...user }', tone: 'bad', label: '원본 오염', code: copyCode('{ ...user }'), notes: { 2: '한 겹만 복사', 4: '공유 객체를 수정' }, run: copyRun(false) },
      { name: '깊은 복사 structuredClone', tone: 'good', label: '원본 안전', code: copyCode('structuredClone(user)'), notes: { 2: '전체를 새로 생성' }, run: copyRun(true) },
    ],
    points: [
      '숫자·문자열·불리언은 <b>값</b>이 복사되고, 객체·배열·함수는 <b>주소(참조)</b>가 복사됩니다.',
      '함수에 객체를 넘기는 것도 주소를 넘기는 것입니다. 함수 안에서 인자를 수정하면 호출한 쪽 데이터가 바뀝니다.',
      '<code>===</code>도 주소를 비교합니다. 내용이 같아도 다른 객체면 <code>false</code>입니다.',
    ],
    senior: 'React·Redux가 "상태를 직접 수정하지 말라"고 하는 이유가 이것입니다. 변경 감지를 주소 비교(<code>===</code>)로 하기 때문에, 객체를 그 자리에서 고치면 주소가 같아 화면이 갱신되지 않습니다. 반대로 매번 깊은 복사를 하면 객체 크기만큼 비용이 듭니다. 실무의 답은 "바뀐 경로만 새로 만들고 나머지는 공유"하는 구조적 공유이고, Immer 같은 도구가 이를 대신해 줍니다. 기본값 객체를 모듈 전역에 두고 요청마다 수정하는 코드도 같은 버그입니다(요청 간 데이터가 섞임).',
  });

  /* ---------- 부동소수점 ---------- */
  const bits = '0.00011001100110011001100110011'.split('');
  const floatRun = (cents) => (t) => {
    t.m['누적 오차 (×10⁻¹⁷)'] = 0;
    let total = 0;
    const snap = (i, s) => [
      { type: 'stack', down: true, title: cents ? '정수(원, 센트 단위)로 계산' : 'JS number = 64비트 부동소수점', items: [
        { id: 'v', v: cents ? `cents = ${total}  →  ${total / 100}` : `total = ${total}`, s },
        { id: 'e', v: `기대값 = ${i / 10}`, s: 'dim' },
      ] },
      ...(cents ? [] : [{ type: 'cells', compact: true, title: '0.1을 2진수로 쓰면 0011이 끝없이 반복됩니다 → 64비트에 넣으려면 어딘가에서 잘라야 합니다', items: [...bits.map((b, k) => ({ id: k, v: b, s: k > 5 && ((k - 6) >> 2) % 2 === 0 ? 'cmp' : '' })), { id: 'x', v: '…', s: 'bad' }] }]),
    ];
    t.step(1, cents ? `금액을 소수가 아니라 <b>가장 작은 단위의 정수</b>로 다룹니다. 0.1 대신 10.` : `0.1을 10번 더해 1이 되는지 확인합니다.`, snap(0));
    for (let i = 1; i <= 10; i++) {
      total += cents ? 10 : 0.1;
      const err = cents ? 0 : Math.round(Math.abs(total - i / 10) * 1e17);
      t.m['누적 오차 (×10⁻¹⁷)'] = err;
      t.step(3, cents
        ? `<code>cents += 10</code> → ${total}. 정수 덧셈은 정확합니다.`
        : err ? `<code>total += 0.1</code> → <b>${total}</b>. 잘려 나간 자리의 오차가 쌓여 드러났습니다.` : `<code>total += 0.1</code> → ${total}. 아직은 반올림이 우연히 맞아떨어집니다.`, snap(i, err ? 'bad' : 'active'));
    }
    const ok = cents ? total / 100 === 1 : total === 1;
    t.step(5, ok ? `<code>cents / 100 === 1</code> → <b>true</b>. 표시할 때만 100으로 나눕니다.` : `<code>total === 1</code> → <b>false</b>. total은 ${total}입니다. 조건문이 조용히 빗나갑니다.`, snap(10, ok ? 'done' : 'bad'));
  };
  CS.add({
    id: 'floating-point', level: 'basic',
    title: '부동소수점: 0.1을 열 번 더해도 1이 아니다',
    summary: '컴퓨터는 소수를 2진수로 저장합니다. 0.1은 2진수로 딱 떨어지지 않아서 저장하는 순간 이미 근삿값입니다. 금액·비율 계산에서 1원이 안 맞는 버그의 출처입니다.',
    verdict: '버그가 아니라 IEEE 754 표준대로 동작한 결과이고, 거의 모든 언어가 같습니다. 정확해야 하는 값은 정수나 Decimal로 다루고, 소수끼리는 === 로 비교하지 않습니다.',
    variants: [
      {
        name: '소수로 누적', tone: 'bad', label: '오차 발생',
        code: `let total = 0;
for (let i = 0; i < 10; i++) {
  total += 0.1;
}
console.log(total === 1);`,
        notes: { 3: '더할 때마다 오차 누적' }, run: floatRun(false),
      },
      {
        name: '정수 단위로 누적', tone: 'good', label: '정확',
        code: `let cents = 0;
for (let i = 0; i < 10; i++) {
  cents += 10;
}
console.log(cents / 100 === 1);`,
        notes: { 3: '정수 연산은 정확' }, run: floatRun(true),
      },
    ],
    points: [
      '<code>0.1 + 0.2</code>는 <code>0.30000000000000004</code>입니다. 10진수 1/3 = 0.333…을 유한 자리로 못 쓰는 것과 같은 현상입니다.',
      '소수 비교는 <code>Math.abs(a - b) &lt; 허용오차</code>로 합니다.',
      'JS의 number는 정수도 2⁵³(약 9천조)까지만 정확합니다. 그보다 큰 ID는 끝자리가 바뀝니다.',
    ],
    senior: '돈은 정수(최소 화폐 단위) 또는 DB의 <code>DECIMAL</code>·언어의 Decimal 타입으로 다루고, <code>FLOAT/DOUBLE</code> 컬럼에 금액을 넣지 않습니다. 또 하나 자주 터지는 곳이 ID입니다. 서버가 64비트 정수 ID(스노우플레이크 등)를 JSON 숫자로 내려 주면 JS가 파싱하는 순간 끝자리가 바뀌어 "없는 ID로 조회"가 됩니다. 큰 정수는 문자열로 주고받으세요. 통계·정산처럼 많은 값을 더할 때는 더하는 순서에 따라 결과가 달라질 수 있다는 점도 기억해 둘 만합니다.',
  });

  /* ---------- 유니코드 문자열 ---------- */
  const NAME = '김👨‍👩‍👧Z';
  const GRAPHEMES = ['김', '👨‍👩‍👧', 'Z'];
  const unitGroup = [0, 1, 1, 1, 1, 1, 1, 1, 1, 2]; // 각 UTF-16 코드 유닛이 속한 "보이는 글자" 번호
  CS.add({
    id: 'unicode', level: 'basic',
    title: '문자열 길이: 이모지는 한 글자가 아니다',
    summary: '사용자 눈에는 3글자인데 코드는 10이라고 답합니다. 문자열은 "글자의 배열"이 아니라 "코드 유닛의 배열"이기 때문입니다. 글자 수 제한, 자르기, 뒤집기에서 깨진 글자가 나오는 원인입니다.',
    verdict: 'length와 slice는 사람이 보는 글자가 아니라 내부 저장 단위(UTF-16 코드 유닛)를 셉니다. 사용자에게 보이는 글자 단위로 다루려면 Intl.Segmenter 같은 그래핌 분할을 써야 합니다.',
    variants: [
      {
        name: 'length와 slice를 그대로 사용', tone: 'bad', label: '글자 깨짐',
        code: `const name = '김👨‍👩‍👧Z';
name.length;
name.slice(0, 2);`,
        notes: { 2: '코드 유닛 수를 반환', 3: '글자 중간을 자름' },
        run(t) {
          t.m['코드가 센 글자 수'] = 0; t.m['깨진 글자'] = 0;
          const units = Array.from({ length: NAME.length }, (_, i) => NAME.charCodeAt(i).toString(16).toUpperCase().padStart(4, '0'));
          const snap = (state, out) => [
            { type: 'cells', title: `사용자가 보는 모습: ${NAME}  (3글자)`, items: GRAPHEMES.map((g, i) => ({ id: i, v: g, sub: ['한글', '가족 이모지', '영문'][i], s: 'done' })) },
            { type: 'cells', compact: true, title: '메모리에 저장된 모습: UTF-16 코드 유닛 10개 (가운데 8개가 이모지 하나)', items: units.map((u, i) => ({ id: i, v: u, sub: i, s: state(i), gap: i === 0 || i === 8 })) },
            ...(out ? [{ type: 'cells', title: '결과', items: out }] : []),
          ];
          t.step(1, `화면에는 3글자로 보입니다. 하지만 가족 이모지는 사람 이모지 3개를 "연결 문자(ZWJ)"로 이어 붙인 것입니다.`, snap((i) => (unitGroup[i] === 1 ? 'cmp' : '')));
          t.m['코드가 센 글자 수'] = NAME.length;
          t.step(2, `<code>name.length</code> → <b>${NAME.length}</b>. 저장 단위 개수를 셉니다. "최대 5자" 검증이면 3글자 이름이 거부됩니다.`, snap(() => 'active'));
          t.m['깨진 글자'] = 1;
          t.step(3, `<code>name.slice(0, 2)</code> — 2번째 칸은 이모지의 <b>앞쪽 절반</b>입니다. 반쪽짜리 글자는 화면에 <b>�</b>로 나옵니다.`,
            snap((i) => (i === 0 ? 'done' : i === 1 ? 'bad' : 'dim'), [{ id: 'a', v: '김', s: 'done' }, { id: 'b', v: '�', s: 'bad', sub: '깨짐' }]));
        },
      },
      {
        name: '보이는 글자(그래핌) 단위로 분할', tone: 'good', label: '정확',
        code: `const seg = new Intl.Segmenter('ko', { granularity: 'grapheme' });
const chars = [...seg.segment(name)].map(s => s.segment);
chars.length;
chars.slice(0, 2).join('');`,
        notes: { 2: '보이는 글자 단위 배열' },
        run(t) {
          t.m['코드가 센 글자 수'] = 0; t.m['깨진 글자'] = 0;
          const snap = (state, out) => [
            { type: 'cells', title: 'chars — 사용자가 보는 글자 단위', items: GRAPHEMES.map((g, i) => ({ id: i, v: g, sub: i, s: state(i) })) },
            ...(out ? [{ type: 'cells', title: '결과', items: out }] : []),
          ];
          t.step(1, `<code>Intl.Segmenter</code>는 유니코드 규칙에 따라 "사람이 한 글자로 인식하는 단위"를 찾아 줍니다.`, snap(() => ''));
          t.step(2, `문자열을 보이는 글자 단위 배열로 바꿉니다. 이모지 하나가 배열 원소 하나입니다.`, snap(() => 'cmp'));
          t.m['코드가 센 글자 수'] = 3;
          t.step(3, `<code>chars.length</code> → <b>3</b>. 사용자가 보는 것과 일치합니다.`, snap(() => 'active'));
          t.step(4, `앞 2글자를 잘라도 이모지가 통째로 유지됩니다.`, snap((i) => (i < 2 ? 'done' : 'dim'), GRAPHEMES.slice(0, 2).map((g, i) => ({ id: i, v: g, s: 'done' }))));
        },
      },
    ],
    points: [
      '문자열에는 층이 세 개 있습니다: <b>바이트</b>(UTF-8 저장·전송) → <b>코드 포인트</b>(유니코드 번호) → <b>그래핌</b>(보이는 글자). 어느 층을 세는지에 따라 길이가 다릅니다.',
      '한글 한 글자는 UTF-8로 3바이트, 이모지는 4바이트 이상입니다. "100바이트 제한"과 "100자 제한"은 다른 말입니다.',
      '<code>split(\'\').reverse()</code>, 글자 수 말줄임, 커서 이동, 정규식 <code>.</code>이 모두 같은 함정을 가집니다.',
    ],
    senior: 'DB에서도 같은 문제가 납니다. MySQL의 옛 <code>utf8</code>은 3바이트까지만 저장해서 이모지가 들어오면 "Incorrect string value" 에러가 나거나 뒤가 잘립니다(<code>utf8mb4</code>를 써야 합니다). 또 한글은 "한" 한 글자(NFC)와 "ㅎ+ㅏ+ㄴ" 조합(NFD)이 화면에서는 똑같이 보이지만 바이트가 달라 <code>===</code>와 유니크 제약, 검색에서 다른 값으로 취급됩니다. 맥에서 올린 파일명이 대표적입니다. 저장·비교 전에 <code>normalize(\'NFC\')</code>로 통일하세요.',
  });
})();
