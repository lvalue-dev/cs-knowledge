/* 분산 시스템 2: 복제 지연, 정족수, 리더 선출, 서킷 브레이커, 요청 제한, CRDT
   시간·지연 값은 원리를 보이기 위한 가정값이다 (복제 지연 300ms, 메시지 전달 10ms 등) */
(function () {
  const CS = window.CS;

  /* ---------- 복제 지연 ---------- */
  const lagRun = (sticky) => (t) => {
    const LAG = 300, STICKY = 500, READS = [60, 200, 400, 600];
    const K = ['방금 쓴 글이 안 보인 조회', '주 서버가 받은 조회', '복제 서버가 받은 조회'];
    K.forEach((k) => (t.m[k] = 0));
    const posts = { pri: 2, rep: 2 }, items = [];
    let edge = null, lagging = false;
    const snap = () => [
      { type: 'graph', directed: true, w: 430, h: 104, scale: 1.15, title: '쓰기는 주 서버로 — 변경 내용은 조금 늦게 복제 서버에 적용됨 (가정: 300ms)',
        nodes: [
          { id: 'app', v: '앱 서버', x: 60, y: 52, w: 80, s: edge ? 'active' : '' },
          { id: 'pri', v: '주 서버', x: 270, y: 20, w: 80, side: true, sub: `내 글 ${posts.pri}개`, s: edge === 'pri' ? 'active' : posts.pri === 3 ? 'new' : '' },
          { id: 'rep', v: '복제 서버', x: 270, y: 84, w: 80, side: true, sub: `내 글 ${posts.rep}개`, s: lagging ? 'bad' : edge === 'rep' ? 'active' : posts.rep === 3 ? 'new' : '' },
        ],
        edges: [{ a: 'pri', b: 'rep', s: lagging ? 'bad' : posts.rep === 3 ? 'done' : '' }, ...(edge ? [{ a: 'app', b: edge, s: 'active' }] : [])] },
      { type: 'timeline', total: 680, title: '시간 축 → (ms, 저장 버튼을 누른 순간 = 0)', items: items.map((x) => ({ ...x })) },
    ];
    t.step(0, `글이 2개 있는 사용자가 세 번째 글을 씁니다. DB는 쓰기를 받는 <b>주 서버</b>(primary)와 그 변경을 따라 적용하는 <b>복제 서버</b>(replica)로 나뉘어 있습니다. 조회가 쓰기보다 훨씬 많아서 조회는 복제 서버로 보냅니다.`, snap());
    edge = 'pri'; posts.pri = 3;
    items.push({ id: 'w', label: '글 저장', start: 0, len: 20, s: 'active', text: '' });
    t.step(2, `INSERT는 주 서버로 갑니다. 주 서버의 글은 <b>3개</b>가 됐습니다. 주 서버는 복제 서버가 적용할 때까지 기다리지 않고 바로 "성공"을 돌려줍니다(비동기 복제).`, snap());
    items[0].s = 'done'; lagging = true;
    items.push({ id: 'lag', label: '복제 지연', start: 20, len: LAG, s: 'bad', text: '복제 서버는 아직 글 2개' });
    if (sticky) t.step(3, `마지막으로 쓴 시각을 세션에 적어 둡니다. 조회할 때 "방금 쓴 사용자인가"를 판단하는 근거가 됩니다.`, snap());
    edge = null;
    t.step(sticky ? 4 : 3, `목록 화면으로 보냅니다. 그동안 변경 내용은 복제 서버로 전송되는 중입니다. 도착해서 적용될 때까지 걸리는 시간이 <b>복제 지연</b>입니다.`, snap());
    READS.forEach((now, i) => {
      if (lagging && now >= 20 + LAG) {
        lagging = false; posts.rep = 3; edge = null;
        items[1].s = 'done'; items[1].text = `${20 + LAG}ms에 적용 완료`;
        t.step(0, `${20 + LAG}ms: 복제 서버가 변경을 적용했습니다. 이제 두 서버의 내용이 같습니다.`, snap());
      }
      const db = sticky && now < STICKY ? 'pri' : 'rep';
      if (sticky) {
        edge = null;
        t.step(8, db === 'pri'
          ? `조회 ${i + 1} (${now}ms): 마지막 쓰기로부터 ${now}ms밖에 안 지났습니다(500ms 미만). 이 사용자의 조회는 <b>주 서버</b>로 보냅니다.`
          : `조회 ${i + 1} (${now}ms): 마지막 쓰기로부터 500ms가 넘었습니다. 복제가 끝났을 시간이므로 다시 <b>복제 서버</b>로 보냅니다.`, snap());
      }
      edge = db;
      t.m[db === 'pri' ? K[1] : K[2]]++;
      const seen = posts[db] === 3;
      if (!seen) t.m[K[0]]++;
      items.push({ id: 'r' + i, label: `조회 ${i + 1} · ${now}ms`, start: now, len: 56, s: seen ? 'done' : 'bad', text: seen ? '보임' : '없음' });
      t.step(sticky ? 9 : 6, seen
        ? (db === 'pri' ? `주 서버에는 방금 쓴 글이 있습니다. 글 3개가 보입니다. 다른 사용자의 조회는 여전히 복제 서버로 갑니다.` : `${sticky ? '' : `조회 ${i + 1} (${now}ms): `}복제 서버에서 읽습니다. 적용이 끝난 뒤이므로 글 3개가 모두 보입니다.`)
        : `조회 ${i + 1} (${now}ms): 복제 서버에서 읽습니다. 아직 적용 전이라 글이 <b>2개</b>뿐입니다. 사용자에게는 "저장이 안 됐다"로 보입니다.${i ? ' 새로고침해도 같습니다.' : ''}`, snap());
    });
    edge = null;
    t.step(0, sticky
      ? `조회 4번 모두 방금 쓴 글이 보였습니다. 대가는 주 서버가 조회 <b>${t.m[K[1]]}번</b>을 대신 받은 것입니다. 쓴 직후의 본인 조회만 옮겼으므로 전체 조회에서는 작은 비율입니다.`
      : `조회 4번 중 <b>${t.m[K[0]]}번</b>은 방금 쓴 글이 없는 화면이었습니다. 데이터는 사라지지 않았고, 300ms 동안 복제 서버가 과거를 보여 준 것입니다.`, snap());
  };
  CS.add({
    id: 'replication-lag', level: 'mid', topic: 'dist',
    title: '복제 지연: 방금 쓴 글이 새로고침하면 안 보인다',
    summary: '조회 부하를 나누려고 쓰기는 주 서버, 읽기는 복제 서버로 보냅니다. 그런데 복제는 조금 늦게 따라오므로, 글을 저장한 직후 목록을 열면 방금 쓴 글이 없습니다. 같은 요청 순서를 두 가지 읽기 규칙으로 돌려 봅니다.',
    headline: '방금 쓴 글이 안 보인 조회',
    verdict: '복제 지연 300ms 동안 복제 서버로 간 조회 2번은 방금 쓴 글을 보지 못했습니다. 쓴 직후 500ms 동안만 본인 조회를 주 서버로 보내면 0번이 되고, 그 대가는 주 서버가 조회 3번을 더 받는 것입니다.',
    variants: [
      {
        name: '조회는 항상 복제 서버', tone: 'bad', label: '쓴 글이 안 보임',
        code: `async function createPost(user, text) {
  await primary.query('INSERT INTO posts ...', [user, text]);
  redirect('/posts');                        // 목록 화면으로
}
async function listPosts(user) {
  return replica.query('SELECT * FROM posts WHERE user = ?', [user]);
}`,
        notes: { 2: '주 서버는 복제를 기다리지 않음', 6: '복제 서버는 과거일 수 있음' }, run: lagRun(false),
      },
      {
        name: '쓴 직후에는 주 서버에서 읽기', tone: 'good', label: '내가 쓴 것은 보임',
        code: `async function createPost(user, text) {
  await primary.query('INSERT INTO posts ...', [user, text]);
  session.lastWriteAt = Date.now();          // 마지막으로 쓴 시각
  redirect('/posts');
}
async function listPosts(user) {
  const justWrote = Date.now() - session.lastWriteAt < 500;
  const db = justWrote ? primary : replica;  // 쓴 직후에만 주 서버
  return db.query('SELECT * FROM posts WHERE user = ?', [user]);
}`,
        notes: { 3: '사용자별로 기록', 8: '본인 조회만, 잠깐만 주 서버로' }, run: lagRun(true),
      },
    ],
    points: [
      '비동기 복제에서 복제 서버는 항상 "조금 전의 주 서버"입니다. 평소에는 수 ms~수백 ms지만, 큰 트랜잭션·배치 작업·복제 서버 과부하 때는 수 초~수 분으로 늘어납니다.',
      '<b>read-your-writes</b>(내가 쓴 것은 내가 읽는다): 모든 사용자에게 최신을 보장하는 것이 아니라, 쓴 본인에게만 자기 변경이 보이도록 하는 약한 보장입니다. 대부분의 화면은 이것으로 충분합니다.',
      '창 길이(여기서는 500ms)는 평소 복제 지연보다 넉넉하게 잡습니다. 지연이 창보다 길어지는 순간에는 같은 문제가 다시 나타납니다.',
      '결제 직후 잔액처럼 틀리면 안 되는 조회는 처음부터 주 서버에서 읽습니다.',
    ],
    senior: '시간 창 방식은 간단하지만 추측입니다. 더 정확하게 하려면 쓰기가 끝났을 때의 로그 위치(PostgreSQL의 LSN, MySQL의 GTID)를 세션에 저장해 두고, 복제 서버가 그 위치까지 적용했는지 확인한 뒤 읽습니다. 복제 서버가 여러 대면 문제가 하나 더 생깁니다. 새로고침할 때마다 지연이 다른 서버에 붙으면 글이 보였다가 사라지는데, 이것은 사용자를 한 복제 서버에 고정해서 막습니다(단조 읽기). 동기 복제로 바꾸면 지연은 없어지지만 쓰기가 복제 서버의 응답 시간만큼 느려지고, 복제 서버 장애가 쓰기 장애가 됩니다. 운영에서는 복제 지연을 지표로 수집하고(PostgreSQL <code>pg_stat_replication</code>의 replay_lag, MySQL <code>SHOW REPLICA STATUS</code>의 Seconds_Behind_Source), 지연이 임계값을 넘은 복제 서버는 읽기 대상에서 빼도록 합니다. DB가 한 대뿐인 로컬과 테스트 환경에서는 이 버그가 재현되지 않는다는 점도 기억해 두세요.',
    qa: [
      ['읽기 복제본을 붙였더니 "저장했는데 안 보인다"는 문의가 들어옵니다. 원인과 대응은?', '비동기 복제라서 복제 서버가 주 서버보다 조금 늦습니다. 쓰기 직후의 조회가 복제 서버로 가면 아직 적용되지 않은 상태를 읽습니다. 대응은 쓴 사용자의 조회를 잠시 주 서버로 보내는 것(read-your-writes)입니다. 시간 창으로 간단히 할 수 있고, 정확히 하려면 쓰기 시점의 로그 위치를 기억해 복제 서버가 거기까지 따라왔는지 확인합니다. 틀리면 안 되는 조회는 항상 주 서버에서 읽습니다.'],
      ['read-your-writes와 강한 일관성은 어떻게 다릅니까?', '강한 일관성은 누가 읽든 가장 최근에 완료된 쓰기가 보이는 것입니다. read-your-writes는 쓴 본인에게만 자기 쓰기가 보이면 됩니다. 다른 사용자는 잠깐 예전 상태를 봐도 괜찮다는 전제입니다. 보장이 약한 만큼 대부분의 조회를 복제 서버에 그대로 둘 수 있어 비용이 적습니다.'],
      ['복제 지연은 왜 갑자기 커집니까?', '복제 서버는 주 서버의 변경을 순서대로 다시 적용합니다. 수백만 행을 바꾸는 트랜잭션이나 스키마 변경이 하나 끼면 그것을 적용하는 동안 뒤의 변경이 전부 밀립니다. 복제 서버에 무거운 분석 쿼리가 돌거나, 디스크·네트워크가 느린 경우도 같습니다. 그래서 지연을 지표로 보고 알람을 걸어야 합니다.'],
    ],
    dx: {
      cat: ['wrong', 'flaky'], concept: '복제 지연 (복제 서버에서 과거 상태를 읽음)',
      symptoms: ['저장 직후 목록·상세 화면에 방금 쓴 내용이 없다가, 잠시 뒤 새로고침하면 보인다', 'DB가 한 대인 로컬·테스트 환경에서는 재현되지 않는다', '"저장 → 바로 조회" 흐름의 E2E 테스트가 가끔 실패한다', '배치 작업이 도는 시간대에 "저장이 안 된다"는 문의가 몰린다'],
      check: '문제의 조회가 어느 DB로 갔는지 로그로 확인하고, 그 시각의 복제 지연 지표(replay_lag, Seconds_Behind_Source)와 맞춰 봅니다. 같은 조회를 주 서버로 보냈을 때 항상 보이면 확정입니다.',
      fix: '쓴 사용자의 직후 조회를 주 서버로 보냅니다(시간 창 또는 로그 위치 비교). 틀리면 안 되는 조회는 주 서버 고정. 복제 지연에 알람을 걸고, 지연이 큰 복제 서버는 읽기 대상에서 제외합니다.',
    },
  });

  /* ---------- 정족수 (R + W > N) ---------- */
  const quorumRun = (strict) => (t, W) => {
    const N = 5, R = strict ? N - W + 1 : N - W, NAMES = 'ABCDE';
    const K = ['읽기가 기다린 응답 수 (R)', '새 값이 없는 읽기 조합', '이번에 읽은 값'];
    t.m[K[0]] = 0; t.m[K[1]] = 0; t.m[K[2]] = '–';
    const ver = Array(N).fill(1), readSet = [], all = [];
    const go = (s, cur) => { if (cur.length === R) { all.push(cur); return; } for (let i = s; i < N; i++) go(i + 1, [...cur, i]); };
    go(0, []);
    const key = (c) => [...c].sort().map((i) => NAMES[i]).join('');
    let phase = '', sent = false, judged = false;
    const snap = () => [
      { type: 'graph', directed: true, w: 420, h: 134, scale: 1.15, title: `복제본 N = 5 · 쓰기 확인 W = ${W} · 읽기 응답 R = ${R} → R + W = ${R + W}`,
        nodes: [
          { id: 'wr', v: '쓰기: x = v2', x: 105, y: 18, w: 104, s: phase === 'write' ? 'active' : '' },
          { id: 'rd', v: '읽기: x ?', x: 320, y: 18, w: 88, s: phase === 'read' ? 'active' : '' },
          ...[...NAMES].map((nm, i) => ({ id: nm, v: 'v' + ver[i], x: 50 + i * 80, y: 98, w: 52, sub: '노드 ' + nm, s: readSet.includes(i) ? (ver[i] === 2 ? 'done' : 'bad') : ver[i] === 2 ? 'new' : '' })),
        ],
        edges: [
          ...(sent ? [...NAMES].map((nm, i) => ({ a: 'wr', b: nm, s: phase !== 'write' ? 'dim' : ver[i] === 2 ? 'done' : 'active' })) : []),
          ...readSet.map((i) => ({ a: 'rd', b: NAMES[i], s: ver[i] === 2 ? 'done' : 'bad' })),
        ] },
      { type: 'cells', title: `읽기에 응답할 수 있는 노드 ${R}개의 조합 — 전부 ${all.length}가지`,
        items: all.map((c) => ({ id: key(c), v: key(c), s: judged ? (c.some((i) => ver[i] === 2) ? 'done' : 'bad') : readSet.length === R && key(c) === key(readSet) ? 'active' : '' })) },
    ];
    t.step(1, `같은 데이터 <code>x</code>를 노드 5개가 나눠 갖고 있습니다. 지금은 전부 <b>v1</b>입니다. 쓰기는 ${W}개가 확인하면 성공으로 치고, 읽기는 ${R}개의 응답을 받으면 돌려주기로 했습니다. R + W = ${R + W}, N = 5.`, snap());
    phase = 'write'; sent = true;
    t.step(3, `<code>x = v2</code> 쓰기를 5개 노드 모두에게 보냅니다. 노드마다 네트워크 사정과 부하가 달라 도착 시각이 다릅니다.`, snap());
    for (let i = 0; i < W; i++) {
      ver[i] = 2;
      t.step(4, i + 1 < W
        ? `노드 ${NAMES[i]}가 v2를 저장하고 확인을 보냈습니다. 확인 ${i + 1} / ${W}.`
        : `노드 ${NAMES[i]}의 확인으로 <b>${W}개</b>가 찼습니다. 클라이언트에게 "쓰기 성공"을 돌려줍니다. ${[...NAMES].slice(W).join(', ')}에는 아직 도착하지 않았습니다.`, snap());
    }
    phase = 'read';
    const order = [...Array.from({ length: N - W }, (_, i) => W + i), ...Array.from({ length: W }, (_, i) => i)].slice(0, R);
    t.step(7, `바로 이어서 다른 클라이언트가 <code>x</code>를 읽습니다. 어느 ${R}개가 먼저 응답할지는 정해져 있지 않습니다. <b>가장 운이 나쁜 경우</b>를 봅니다: 아직 v2를 받지 못한 노드부터 응답합니다.`, snap());
    order.forEach((i, k) => {
      readSet.push(i); t.m[K[0]] = k + 1;
      t.step(7, ver[i] === 2
        ? `응답 ${k + 1} / ${R}: 옛 값만 가진 노드는 ${N - W}개뿐이라, ${R}개를 채우려면 v2를 가진 노드가 <b>반드시</b> 하나는 들어옵니다. 노드 ${NAMES[i]} → v2.`
        : `응답 ${k + 1} / ${R}: 노드 ${NAMES[i]} → <b>v1</b> (아직 쓰기를 받지 못한 노드).`, snap());
    });
    const got = Math.max(...readSet.map((i) => ver[i]));
    t.m[K[2]] = got === 2 ? 'v2 (최신)' : 'v1 (옛 값)';
    t.step(8, got === 2
      ? `받은 응답 중 버전이 가장 높은 것은 <b>v2</b>입니다. 최악의 경우에도 최신 값을 읽었습니다.`
      : `받은 응답이 전부 v1입니다. 성공했다고 응답한 쓰기가 있는데도 <b>옛 값</b>을 돌려줍니다. 이 클라이언트는 그 사실을 알 방법이 없습니다.`, snap());
    judged = true;
    t.m[K[1]] = all.filter((c) => !c.some((i) => ver[i] === 2)).length;
    t.step(8, t.m[K[1]]
      ? `읽기에 응답할 수 있는 조합 ${all.length}가지를 모두 따져 보면, v2를 가진 노드가 하나도 없는 조합이 <b>${t.m[K[1]]}가지</b> 있습니다(${key(order)}). R + W = ${R + W}로 N을 넘지 못해서, 쓴 노드와 읽는 노드가 겹치지 않을 수 있습니다.`
      : `조합 ${all.length}가지를 모두 따져 봐도 v2가 빠진 조합은 <b>0가지</b>입니다. R + W = ${R + W} > 5이므로, 쓴 ${W}개와 읽는 ${R}개는 어떻게 골라도 적어도 한 노드에서 겹칩니다.`, snap());
  };
  CS.add({
    id: 'quorum', level: 'senior', topic: 'dist',
    title: '정족수: R + W > N이면 최신 값을 반드시 읽는다',
    summary: '복제본 5개에 쓰기를 보내고 그중 W개만 확인하면 성공으로 칩니다. 읽을 때는 R개에게 물어 가장 새 값을 고릅니다. W와 R을 어떻게 잡느냐에 따라, 성공한 쓰기를 못 읽는 경우가 생기기도 하고 아예 불가능해지기도 합니다.',
    param: { label: '쓰기 확인 수 W', options: [1, 3, 4], value: 3 },
    headline: '새 값이 없는 읽기 조합',
    verdict: 'R + W = N이면 새 값을 가진 노드가 하나도 없는 읽기 조합이 1가지 남고, 운이 나쁘면 그 조합에 걸려 옛 값을 읽습니다. R을 1만 늘려 R + W > N으로 만들면 그런 조합은 0가지입니다. 쓴 W개와 읽는 R개가 반드시 한 노드 이상 겹치기 때문입니다.',
    variants: [
      {
        name: 'R + W = N (겹침 없음)', tone: 'bad', label: '옛 값을 읽을 수 있음',
        code: `const N = 5, R = N - W;                // R + W = N
async function write(key, value, version) {
  const acks = replicas.map(r => r.put(key, value, version));
  await atLeast(acks, W);              // W개가 확인하면 성공
}
async function read(key) {
  const answers = await atLeast(replicas.map(r => r.get(key)), R);
  return newest(answers);              // 버전이 가장 높은 값
}`,
        notes: { 4: '나머지 N - W개는 아직 옛 값', 7: 'R개 모두 옛 노드일 수 있음' }, run: quorumRun(false),
      },
      {
        name: 'R + W > N (반드시 겹침)', tone: 'good', label: '항상 최신 값',
        code: `const N = 5, R = N - W + 1;            // R + W = N + 1
async function write(key, value, version) {
  const acks = replicas.map(r => r.put(key, value, version));
  await atLeast(acks, W);              // W개가 확인하면 성공
}
async function read(key) {
  const answers = await atLeast(replicas.map(r => r.get(key)), R);
  return newest(answers);              // 버전이 가장 높은 값
}`,
        notes: { 1: '읽기가 응답 1개를 더 기다림', 7: '쓴 노드가 최소 1개 포함됨' }, run: quorumRun(true),
      },
    ],
    points: [
      '정족수(quorum)는 "몇 개가 동의하면 전체의 결정으로 볼 것인가"입니다. 쓴 집합 W와 읽는 집합 R이 겹치려면 R + W > N이어야 합니다(비둘기집 원리).',
      'W와 R은 서로 바꿔 쓸 수 있는 비용입니다. 위의 W를 1, 3, 4로 바꿔 보세요. W가 작으면 쓰기가 빠르고 읽기가 많은 응답을 기다립니다. W가 크면 그 반대입니다.',
      '장애 내성도 여기서 나옵니다. 쓰기는 N - W개, 읽기는 N - R개의 노드가 죽어도 계속됩니다. N = 5, W = 3, R = 3이면 양쪽 모두 2대까지 견딥니다.',
      '응답 시간은 W번째(또는 R번째)로 빠른 노드가 정합니다. 가장 느린 노드를 기다리지 않아도 되는 것이 정족수의 이점입니다.',
    ],
    senior: 'Cassandra·DynamoDB 계열의 일관성 수준(ONE, QUORUM, ALL)이 이 숫자를 고르는 설정입니다. 흔한 구성은 N = 3, W = 2, R = 2입니다. 다만 R + W > N이 곧 강한 일관성은 아닙니다. 두 쓰기가 동시에 들어오면 어느 쪽이 "최신"인지는 버전을 무엇으로 매기느냐에 달려 있고, 벽시계 타임스탬프를 쓰면 시계가 어긋난 노드의 쓰기가 이깁니다. W개를 못 채우고 실패한 쓰기도 일부 노드에는 남아서 나중에 읽힐 수 있습니다. 담당 노드가 죽었을 때 다른 노드가 임시로 받아 주는 느슨한 정족수(sloppy quorum)에서는 겹침 보장 자체가 깨집니다. 그래서 이런 저장소는 읽으면서 뒤처진 노드를 고치는 읽기 복구(read repair)와 주기적인 비교 동기화를 함께 돌립니다. "순서가 반드시 하나여야 하는" 데이터(잔액, 재고 차감, 락)에는 정족수 읽기·쓰기가 아니라 리더를 두는 합의 알고리즘(Raft 등)을 씁니다.',
    qa: [
      ['R + W > N이 왜 최신 값을 보장합니까?', '쓰기가 성공했다면 N개 중 W개가 새 값을 갖고 있습니다. 옛 값만 가진 노드는 많아야 N - W개입니다. 읽기가 R개의 응답을 받는데 R > N - W이면, 옛 노드만으로는 R개를 채울 수 없으니 새 값을 가진 노드가 적어도 하나 포함됩니다. 응답 중 버전이 가장 높은 것을 고르면 그 값입니다.'],
      ['N = 3일 때 W와 R을 어떻게 고르겠습니까?', '보통 W = 2, R = 2입니다. 겹침이 보장되고, 읽기와 쓰기 모두 한 대가 죽어도 계속됩니다. 읽기가 압도적으로 많고 약간 오래된 값이 괜찮으면 R = 1로 낮춰 속도를 얻습니다. W = 3은 읽기를 R = 1로 해도 최신이지만, 한 대만 죽어도 쓰기가 멈추므로 잘 쓰지 않습니다.'],
      ['정족수를 만족해도 옛 값이 읽히는 경우가 있습니까?', '있습니다. 동시에 들어온 쓰기의 승자를 타임스탬프로 정하는데 시계가 어긋난 경우, W개를 못 채워 실패로 응답한 쓰기가 일부 노드에 남은 경우, 장애 중에 담당이 아닌 노드가 임시로 쓰기를 받아 준 경우입니다. 정족수는 "겹친다"만 보장할 뿐 연산의 순서까지 정해 주지는 않습니다.'],
    ],
    dx: {
      cat: ['wrong', 'flaky', 'data'], concept: '정족수 설정 (R + W ≤ N이라 읽기와 쓰기가 겹치지 않음)',
      symptoms: ['성공으로 응답받은 쓰기가 바로 다음 조회에서 예전 값으로 나온다', '같은 키를 연달아 조회하면 새 값과 옛 값이 번갈아 나온다', '노드 한 대가 느리거나 재시작 중일 때만 재현된다', '부하 테스트에서는 괜찮다가 장애 훈련 중에 데이터 불일치가 발견된다'],
      check: '복제 계수 N과 클라이언트의 읽기·쓰기 일관성 수준(R, W)을 확인해 R + W > N인지 계산합니다. 문제 조회에 어느 노드들이 응답했는지 추적 로그로 봅니다.',
      fix: '틀리면 안 되는 키는 읽기·쓰기 모두 QUORUM 수준으로 올립니다. 지연이 중요한 조회만 낮은 수준을 쓰고, 그 화면은 오래된 값을 허용하도록 설계합니다. 순서가 중요한 연산은 합의 기반 저장소로 옮깁니다.',
    },
  });

  /* ---------- Raft 리더 선출 ---------- */
  const raftRun = (random) => (t) => {
    const DELAY = 10, MAJ = 3, K = ['치른 선거', '리더 없이 보낸 시간 (ms)', '새 리더'];
    t.m[K[0]] = 0; t.m[K[1]] = 0; t.m[K[2]] = '없음';
    let seed = 5;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return 150 + ((seed >> 8) % 15) * 10; };
    const nodes = [2, 3, 4, 5].map((i) => ({ id: 'S' + i, term: 1, voted: 'S1', role: 'follower', votes: 0, start: 0, timeout: random ? rnd() : 150 }));
    const P = { S1: [210, 20], S2: [352, 58], S3: [290, 118], S4: [130, 118], S5: [68, 58] };
    let alive = true, edges = [], leader = null, now = 0;
    const roleSub = (n) => `임기 ${n.term}` + (n.role === 'candidate' ? ` · 후보 ${n.votes}표` : n.role === 'leader' ? ' · 리더' : n.role === 'lost' ? ` · ${n.votes}표` : '');
    const snap = () => [
      { type: 'graph', directed: true, w: 420, h: 148, scale: 1.15, title: '서버 5대 — 과반은 3표 (가정: 메시지 전달 10ms)',
        nodes: [
          { id: 'S1', v: 'S1', x: P.S1[0], y: P.S1[1], w: 44, sub: alive ? '임기 1 · 리더' : '죽음', s: alive ? 'done' : 'gone' },
          ...nodes.map((n) => ({ id: n.id, v: n.id, x: P[n.id][0], y: P[n.id][1], w: 44, sub: roleSub(n), s: n.role === 'candidate' ? 'active' : n.role === 'leader' ? 'done' : n.role === 'lost' ? 'bad' : '' })),
        ],
        edges: edges.map((e) => ({ ...e })) },
      { type: 'timeline', total: 620, title: '선거 타이머 → 하트비트 없이 끝까지 가면 후보가 됨 (ms)',
        items: nodes.map((n) => ({ id: n.id, label: `${n.id} · ${n.role === 'leader' ? '리더' : n.timeout + 'ms'}`, start: n.start, len: n.timeout, s: n.role === 'leader' ? 'done' : n.role === 'candidate' || n.role === 'lost' ? 'bad' : '', text: n.role === 'leader' ? '리더: 하트비트 전송' : n.role === 'candidate' ? '끝 → 후보' : '' })) },
    ];
    edges = nodes.map((n) => ({ a: 'S1', b: n.id, s: 'done' }));
    t.step(0, `서버 5대가 같은 로그를 복제합니다. 쓰기 순서를 정하는 <b>리더</b>는 한 번에 한 대(S1)뿐이고, 리더는 하트비트를 계속 보내 살아 있음을 알립니다. 지금은 <b>임기(term) 1</b>입니다.`, snap());
    alive = false; edges = [];
    t.step(1, random
      ? `S1이 죽었습니다. 남은 4대는 각자 <b>선거 타이머</b>를 돌립니다. 하트비트가 오면 되감는 타이머인데, 이제 되감아 줄 리더가 없습니다. 타이머 길이는 노드마다 <b>무작위</b>(150~300ms)입니다.`
      : `S1이 죽었습니다. 남은 4대는 각자 <b>선거 타이머</b>를 돌립니다. 하트비트가 오면 되감는 타이머인데, 이제 되감아 줄 리더가 없습니다. 타이머 길이는 4대 모두 <b>150ms</b>입니다.`, snap());
    while (!leader && t.m[K[0]] < 3) {
      now = Math.min(...nodes.map((n) => n.start + n.timeout));
      const cands = nodes.filter((n) => n.start + n.timeout < now + DELAY);   // 투표 요청이 도착하기 전에 타이머가 끝난 노드
      t.m[K[0]]++; t.m[K[1]] = now;
      for (const c of cands) { c.term++; c.role = 'candidate'; c.voted = c.id; c.votes = 1; }
      const term = cands[0].term, solo = cands.length === 1;
      edges = [];
      t.step(3, solo
        ? `${now}ms: <b>${cands[0].id}</b>의 타이머가 가장 먼저 끝났습니다. ${cands[0].id}만 임기를 ${term}로 올리고 후보가 됩니다. 다른 노드의 타이머는 아직 남아 있습니다.`
        : `${now}ms: 타이머 ${cands.length}개가 <b>동시에</b> 끝났습니다. ${cands.length}대 모두 임기를 ${term}로 올리고 후보가 됩니다.`, snap());
      edges = cands.flatMap((c) => nodes.filter((n) => n !== c).map((n) => ({ a: c.id, b: n.id, s: 'active' })));
      t.step(5, solo
        ? `${cands[0].id}가 자신에게 1표를 주고, 나머지 3대에게 "임기 ${term}의 리더로 나를 뽑아 달라"는 투표 요청을 보냅니다.`
        : `각자 자신에게 1표를 주고, 나머지 3대에게 투표 요청을 보냅니다. 요청 ${edges.length}개가 엇갈려 날아갑니다.`, snap());
      const grants = [];
      for (const n of nodes) for (const c of cands) if (c !== n) {
        if (c.term > n.term) { n.term = c.term; n.voted = null; n.role = 'follower'; }
        if (c.term === n.term && n.voted === null) { n.voted = c.id; n.start = now + DELAY; grants.push([n, c]); }
      }
      if (!grants.length) {
        edges = edges.map((e) => ({ ...e, s: 'bad' }));
        t.step(9, `한 임기에는 한 표만 줄 수 있습니다. 4대 모두 이미 자신에게 투표했으므로, 도착한 요청 ${edges.length}개를 전부 <b>거절</b>합니다.`, snap());
      }
      edges = [];
      for (const [n, c] of grants) {
        c.votes++;
        edges.push({ a: n.id, b: c.id, s: 'done' });
        t.step(10, c.role === 'leader'
          ? `${n.id}도 ${c.id}에게 투표했습니다. 이미 과반이 찼으므로 결과는 바뀌지 않습니다.`
          : `${n.id}: 요청의 임기(${c.term})가 자기 임기보다 높으므로 임기를 올립니다. 이번 임기에 아직 투표하지 않았으므로 <b>${c.id}에게 투표</b>하고 자기 타이머를 되감습니다. ${c.id}는 ${c.votes}표.`, snap());
        if (c.votes >= MAJ && !leader) {
          leader = c; c.role = 'leader'; t.m[K[1]] = now + 2 * DELAY; t.m[K[2]] = `${c.id} (임기 ${c.term})`;
          t.step(13, `${c.id}가 <b>3표</b>를 얻었습니다. 5대 중 과반입니다 → ${c.id}가 <b>임기 ${c.term}의 리더</b>가 됩니다. 과반은 한 임기에 한 후보만 얻을 수 있으므로 리더가 둘이 될 수 없습니다.`, snap());
        }
      }
      if (leader) break;
      t.m[K[1]] = now + 2 * DELAY;
      for (const c of cands) { c.role = 'lost'; c.start = now; if (random) c.timeout = rnd(); }
      t.step(13, `개표: 4대 모두 자기 표 1표뿐입니다. 과반 3표를 얻은 후보가 없어 임기 ${term}에는 <b>리더가 없습니다.</b> 후보들은 타이머를 다시 맞춥니다. 이번에도 똑같이 150ms입니다.`, snap());
    }
    if (leader) {
      edges = nodes.filter((n) => n !== leader).map((n) => ({ a: leader.id, b: n.id, s: 'done' }));
      for (const n of nodes) { n.start = now + 3 * DELAY; if (n !== leader) n.role = 'follower'; }
      leader.start = now + 2 * DELAY; leader.timeout = 620 - leader.start;
      t.step(13, `리더 ${leader.id}가 곧바로 하트비트를 보냅니다. 나머지는 타이머를 되감고 팔로워로 남습니다. 리더가 없던 시간은 <b>${t.m[K[1]]}ms</b>, 선거는 ${t.m[K[0]]}번이었습니다.`, snap());
    } else {
      edges = [];
      t.step(1, `선거 <b>${t.m[K[0]]}번</b>이 모두 무효였고 ${t.m[K[1]]}ms째 리더가 없습니다. 타임아웃이 같은 한 다음 선거도 똑같이 갈립니다. 그동안 이 클러스터는 쓰기를 받지 못합니다.`, snap());
    }
  };
  const RAFT_CODE = (first) => `${first}
onElectionTimeout(() => {                  // 리더의 하트비트가 끊김
  term += 1; role = 'candidate';
  votes = 1; votedFor = me;                // 자신에게 먼저 1표
  peers.forEach(p => p.requestVote(term, me));
});
onRequestVote((t, candidate) => {          // 한 임기에 한 표만
  if (t > term) { term = t; votedFor = null; role = 'follower'; }
  if (t !== term || votedFor !== null) return false;
  votedFor = candidate; resetTimer();
  return true;
});
onVote(() => { if (++votes > N / 2) becomeLeader(); });   // 5대 중 3표`;
  CS.add({
    id: 'raft-election', level: 'senior', topic: 'dist',
    title: 'Raft 리더 선출: 리더가 죽으면 누가 이어받는가',
    summary: '리더 한 대가 쓰기 순서를 정하는 구조에서는 리더가 죽었을 때 새 리더를 "한 대만" 뽑아야 합니다. Raft는 임기 번호, 한 임기에 한 표, 과반 득표로 이것을 보장합니다. 선거 타이머가 모두 같을 때와 무작위일 때 선거가 어떻게 달라지는지 봅니다.',
    headline: '치른 선거',
    verdict: '타임아웃이 모두 같으면 4대가 동시에 후보가 되어 자기 자신에게 투표하고, 선거를 3번 치러도 리더가 없습니다. 타임아웃을 무작위로 흩어 놓으면 먼저 깨어난 한 대가 나머지의 표를 모아 선거 1번, 170ms 만에 리더가 됩니다.',
    variants: [
      {
        name: '타임아웃이 모두 같음', tone: 'bad', label: '표가 갈려 반복',
        code: RAFT_CODE('const timeout = 150;                       // 모든 노드가 같은 값'),
        notes: { 1: '모두 동시에 후보가 됨', 9: '이미 자신에게 투표함 → 거절' }, run: raftRun(false),
      },
      {
        name: '타임아웃을 무작위로', tone: 'good', label: '한 번에 선출',
        code: RAFT_CODE('const timeout = 150 + random(150);         // 노드마다 150~300ms'),
        notes: { 1: '먼저 끝난 한 대만 후보', 10: '투표하면 자기 타이머를 되감음' }, run: raftRun(true),
      },
    ],
    points: [
      '<b>임기(term)</b>는 선거 때마다 1씩 오르는 번호입니다. 더 높은 임기를 본 노드는 즉시 그 임기로 올라가 팔로워가 됩니다. 죽은 줄 알았던 옛 리더가 돌아와도 임기가 낮아 무시됩니다.',
      '<b>과반</b>이 핵심입니다. 두 후보가 같은 임기에 동시에 과반을 얻을 수는 없으므로(한 노드는 한 표), 리더는 임기마다 많아야 한 대입니다.',
      '무작위 타임아웃은 "표가 갈리는 일이 드물게, 갈려도 금방 풀리게" 하는 장치입니다. 정확성이 아니라 진행(언젠가 리더가 뽑힘)을 위한 것입니다.',
      '과반이 필요하므로 5대 중 2대, 3대 중 1대까지 죽어도 동작합니다. 4대는 3대와 똑같이 1대만 견디므로 보통 홀수로 구성합니다.',
    ],
    senior: '위 코드에서 생략한 조건이 하나 있습니다. 실제 Raft는 후보의 로그가 자기 로그만큼 최신일 때만 투표합니다. 이 조건 덕분에 과반에 복제되어 확정된 기록을 갖지 못한 노드는 리더가 될 수 없고, 리더가 바뀌어도 확정된 쓰기가 사라지지 않습니다. 운영에서 보는 문제는 주로 타임아웃 설정입니다. 선거 타임아웃이 네트워크 왕복이나 디스크 fsync 지연보다 충분히 길지 않으면, GC 정지나 느린 디스크만으로 하트비트가 늦어져 멀쩡한 리더를 두고 선거가 반복됩니다(리더 플래핑). 네트워크가 갈렸다 돌아온 노드가 높아진 임기로 리더를 끌어내리는 것을 막으려고 사전 투표(pre-vote)를 켜기도 합니다. 과반을 잃은 쪽은 리더를 뽑지 못해 쓰기가 멈추는데, 이것은 고장이 아니라 양쪽에 리더가 생기는 스플릿 브레인을 막는 의도된 동작입니다. etcd(쿠버네티스의 상태 저장소)와 Consul이 Raft를 쓰고, Apache Kafka도 2025년에 나온 4.0부터 ZooKeeper 없이 Raft 기반의 KRaft로만 동작합니다.',
    qa: [
      ['Raft에서 리더가 동시에 둘이 되지 않는 이유는?', '리더가 되려면 한 임기에서 과반의 표를 얻어야 하고, 각 노드는 한 임기에 한 표만 줍니다. 과반 두 묶음은 반드시 한 노드 이상 겹치므로 같은 임기에 두 후보가 모두 과반을 얻을 수 없습니다. 옛 리더가 살아 돌아와도 임기 번호가 낮아서, 더 높은 임기를 본 순간 팔로워로 내려갑니다.'],
      ['선거 타임아웃을 왜 무작위로 잡습니까?', '모두 같은 값이면 리더가 죽은 뒤 동시에 후보가 되어 각자 자신에게 투표하고, 아무도 과반을 얻지 못합니다. 다시 같은 시간 뒤에 같은 일이 반복됩니다. 무작위로 흩어 놓으면 대부분 한 대가 먼저 깨어나 다른 노드의 타이머가 끝나기 전에 표를 모읍니다. 표가 갈리더라도 다음 타이머가 또 무작위라 금방 풀립니다.'],
      ['5대 클러스터가 3대와 2대로 네트워크가 갈리면 어떻게 됩니까?', '3대 쪽은 과반이므로 리더를 유지하거나 새로 뽑아 계속 쓰기를 받습니다. 2대 쪽은 과반을 얻을 수 없어 리더가 없고 쓰기를 거절합니다. 옛 리더가 2대 쪽에 있었다면 과반의 확인을 받지 못해 새 쓰기를 확정하지 못합니다. 네트워크가 복구되면 2대 쪽이 더 높은 임기의 리더를 따라 로그를 맞춥니다.'],
    ],
    dx: {
      cat: ['hang', 'flaky'], concept: '리더 선출 (과반 상실 또는 선거 반복)',
      symptoms: ['합의 기반 저장소(etcd, Consul 등)에서 쓰기가 수 초간 타임아웃되다가 저절로 풀린다', '로그에 임기 번호가 계속 올라가고 리더가 자주 바뀐다', '노드 절반이 내려간 뒤 읽기는 되는데 쓰기가 전혀 되지 않는다', '디스크가 느리거나 GC가 긴 노드가 있을 때 "leader changed", "no leader" 오류가 간헐적으로 난다'],
      check: '리더 변경 횟수와 임기 번호 지표의 증가 속도를 봅니다. 살아 있는 노드 수가 과반인지, 하트비트 지연(네트워크 왕복, fsync 시간)이 선거 타임아웃에 가까운지 확인합니다.',
      fix: '선거 타임아웃을 하트비트 주기와 디스크·네트워크 지연보다 충분히 크게(보통 10배 안팎) 잡습니다. 느린 디스크를 교체하고 노드 수를 홀수로 맞춥니다. 클라이언트는 리더 교체 중의 실패를 재시도하도록 만듭니다.',
    },
  });

  /* ---------- 서킷 브레이커 ---------- */
  const CB = { POOL: 6, TICKS: 14, SLOW: [3, 9], K: ['응답을 못 받은 요청', '동시에 묶인 스레드 (최대)', '대체 응답으로 처리한 요청'] };
  const cbPanels = (slots, out, title) => [
    { type: 'cells', title: `내 서비스의 작업 스레드 6개 — 사용 중 ${slots.filter((x) => x !== null).length}개`,
      items: slots.map((r, i) => ({ id: 'w' + i, v: r === null ? '·' : '#' + r, s: r === null ? 'hole' : 'bad' })) },
    { type: 'cells', compact: true, title,
      items: Array.from({ length: CB.TICKS }, (_, i) => {
        const o = out[i + 1];
        return { id: 'r' + (i + 1), v: i + 1, sub: o ? o[0] : '', s: o ? o[1] : 'dim' };
      }) },
  ];
  const cbBad = (t) => {
    const { POOL, TICKS, SLOW, K } = CB;
    K.forEach((k) => (t.m[k] = 0));
    const slots = Array(POOL).fill(null), out = {};
    const snap = () => cbPanels(slots, out, '요청 14개 (100ms마다 1개) — 멈춤: 응답 대기 중 · 거절: 빈 스레드 없음');
    t.step(0, `상품 상세 API는 요청마다 <b>추천 서비스</b>를 호출합니다. 내 서비스의 작업 스레드는 6개이고, 요청이 100ms마다 하나씩 들어옵니다. 시간 값은 모두 가정입니다.`, snap());
    for (let r = 1; r <= TICKS; r++) {
      const slow = r >= SLOW[0] && r <= SLOW[1], free = slots.indexOf(null), busy = () => slots.filter((x) => x !== null).length;
      if (free < 0) {
        out[r] = ['거절', 'bad']; t.m[K[0]]++;
        t.step(1, r === SLOW[1] + 1
          ? `요청 #${r}: 추천 서비스는 방금 <b>회복됐습니다.</b> 하지만 내 스레드 6개는 장애 중에 보낸 호출의 응답을 아직 기다리고 있어 새 요청을 받지 못합니다.`
          : r === SLOW[1]
            ? `요청 #${r}: 받을 스레드가 없어 <b>거절</b>됩니다. 추천과 무관한 요청(로그인, 결제)도 같은 스레드를 쓰므로 함께 거절됩니다. 하위 서비스의 장애가 내 서비스의 장애로 번졌습니다.`
            : `요청 #${r}: 거절. 묶인 호출이 풀리는 30초 뒤(또는 재시작)까지 이 상태가 이어집니다.`, snap());
      } else if (slow) {
        slots[free] = r; out[r] = ['멈춤', 'bad']; t.m[K[0]]++; t.m[K[1]] = Math.max(t.m[K[1]], busy());
        t.step(4, r === SLOW[0]
          ? `요청 #${r}: 추천 서비스가 <b>느려졌습니다</b>(응답까지 30초). 타임아웃이 없으므로 이 스레드는 응답이 올 때까지 <code>await</code>에서 기다립니다.`
          : busy() === POOL
            ? `요청 #${r}: 여섯 번째 스레드도 같은 호출에서 묶였습니다. <b>빈 스레드가 없습니다.</b>`
            : `요청 #${r}: 같은 호출에서 또 한 스레드가 묶입니다. 묶인 스레드 ${busy()} / 6.`, snap());
      } else {
        out[r] = ['정상', 'done'];
        t.step(6, `요청 #${r}: 추천 서비스가 20ms 만에 응답합니다. 스레드를 잠깐 쓰고 바로 반납합니다.`, snap());
      }
    }
    t.step(0, `14개 중 <b>${t.m[K[0]]}개</b>가 응답을 받지 못했습니다. 추천 서비스의 장애는 700ms였지만, 내 서비스는 그보다 훨씬 오래 멈춰 있습니다. CPU는 한가한데 스레드만 전부 대기 중인 상태입니다.`, snap());
  };
  const cbGood = (t) => {
    const { POOL, TICKS, SLOW, K } = CB, TIMEOUT = 2, COOLDOWN = 4;
    K.forEach((k) => (t.m[k] = 0));
    const slots = Array(POOL).fill(null), out = {};
    let state = 'closed', failures = 0, openedAt = 0, move = '', tick = 0;
    const busy = () => slots.filter((x) => x !== null).length;
    const snap = () => [
      { type: 'graph', directed: true, w: 420, h: 96, scale: 1.15, title: '회로 상태 — 실패가 쌓이면 열고, 잠시 뒤 한 번 시험해 보고 닫음',
        nodes: [
          { id: 'closed', v: '닫힘: 호출 통과', x: 80, y: 20, w: 116, sub: `연속 실패 ${Math.min(failures, 3)} / 3`, s: state === 'closed' ? 'done' : '' },
          { id: 'open', v: '열림: 즉시 실패', x: 340, y: 20, w: 116, sub: state === 'open' ? `열린 뒤 ${(tick - openedAt) * 100}ms / 400ms` : '', s: state === 'open' ? 'bad' : '' },
          { id: 'half-open', v: '반열림: 시험 호출 1번', x: 210, y: 78, w: 150, s: state === 'half-open' ? 'active' : '' },
        ],
        edges: [['closed', 'open'], ['open', 'half-open'], ['half-open', 'closed']].map(([a, b]) => ({ a, b, s: move === a + b ? 'active' : '' })) },
      ...cbPanels(slots, out, '요청 14개 (100ms마다 1개) — 초과: 200ms 뒤 대체 응답 · 차단: 즉시 대체 응답'),
    ];
    const go = (to) => { move = state + to; state = to; };
    t.step(0, `같은 상황에 두 가지를 더합니다. 호출마다 <b>타임아웃 200ms</b>를 걸고, 실패가 3번 이어지면 호출 자체를 막는 <b>서킷 브레이커</b>를 둡니다. 막힌 동안에는 대체 응답(인기 상품 목록)을 돌려줍니다.`, snap());
    for (tick = 1; tick <= TICKS; tick++) {
      move = '';
      const due = slots.findIndex((x) => x !== null && x + TIMEOUT === tick);
      if (due >= 0) {   // 2틱(200ms) 전에 보낸 호출이 타임아웃
        const r = slots[due];
        slots[due] = null; out[r] = ['초과', 'cmp']; t.m[K[2]]++; failures++;
        const was = state;
        if (failures >= 3 || state === 'half-open') { if (state !== 'open') go('open'); openedAt = tick; }
        t.step(11, was === 'open'
          ? `회로를 열기 전에 보낸 요청 #${r}도 타임아웃됐습니다. 실패가 또 확인됐으므로 대기 시간 400ms를 이 시점부터 다시 셉니다.`
          : state === 'open'
            ? `요청 #${r}도 타임아웃. 연속 실패 <b>3회</b> → 회로를 <b>엽니다.</b> 이제부터 추천 서비스로는 호출을 보내지 않습니다. 요청 #${r}에는 대체 응답을 돌려줍니다.`
            : `요청 #${r}: 200ms가 지나 타임아웃됩니다. 스레드를 반납하고 대체 응답을 돌려줍니다. 연속 실패 ${failures}회.`, snap());
        move = '';
      }
      const r = tick, slow = r >= SLOW[0] && r <= SLOW[1];
      if (state === 'open') {
        if (tick - openedAt < COOLDOWN) {
          out[r] = ['차단', 'new']; t.m[K[2]]++;
          t.step(3, `요청 #${r}: 회로가 열려 있습니다. 네트워크를 타지 않고 <b>즉시</b> 대체 응답을 돌려줍니다. 스레드를 붙잡지 않고, 느려진 추천 서비스에 부하를 더하지도 않습니다.`, snap());
          continue;
        }
        go('half-open');
        t.step(4, `요청 #${r}: 열린 지 400ms가 지났습니다. <b>반열림</b>으로 바꾸고, 이 요청 하나를 시험 삼아 내보냅니다.`, snap());
        move = '';
      }
      if (slow) {
        slots[slots.indexOf(null)] = r; out[r] = ['대기', 'active']; t.m[K[1]] = Math.max(t.m[K[1]], busy());
        t.step(7, r === SLOW[0]
          ? `요청 #${r}: 추천 서비스가 <b>느려졌습니다</b>(응답까지 30초). 호출은 나갔지만 이번에는 200ms 타임아웃이 걸려 있습니다.`
          : `요청 #${r}: 회로가 아직 닫혀 있어 호출이 나갑니다. 응답 대기 중인 스레드 ${busy()}개.`, snap());
      } else {
        const probe = state === 'half-open';
        if (probe) go('closed');
        failures = 0; out[r] = ['정상', 'done'];
        t.step(8, probe
          ? `시험 호출이 <b>성공</b>했습니다. 추천 서비스가 회복된 것입니다 → 회로를 닫고 정상으로 돌아갑니다. 실패했다면 다시 열고 400ms를 더 기다렸을 것입니다.`
          : `요청 #${r}: 회로가 닫힌 상태입니다. 호출이 그대로 나가고 20ms 만에 정상 응답이 옵니다.`, snap());
      }
    }
    move = '';
    t.step(0, `14개 모두 응답을 받았습니다. 그중 <b>${t.m[K[2]]}개</b>는 추천 대신 대체 응답이었습니다. 묶인 스레드는 많아야 ${t.m[K[1]]}개였고, 추천 서비스가 회복되자 400ms 안에 스스로 정상으로 돌아왔습니다.`, snap());
  };
  CS.add({
    id: 'circuit-breaker', level: 'adv', topic: 'dist',
    title: '서킷 브레이커: 느린 서비스 하나가 전체를 멈출 때',
    summary: '내가 호출하는 하위 서비스가 죽으면 오류가 바로 돌아오지만, 느려지면 내 스레드가 응답을 기다리며 하나씩 묶입니다. 스레드가 바닥나면 무관한 요청까지 받지 못합니다. 같은 700ms짜리 장애를 타임아웃 없이 맞았을 때와 서킷 브레이커로 맞았을 때를 비교합니다.',
    headline: '응답을 못 받은 요청',
    verdict: '타임아웃 없이 호출하면 스레드 6개가 전부 묶여 14개 중 12개가 응답을 받지 못하고, 하위 서비스가 회복된 뒤에도 내 서비스는 멈춰 있습니다. 타임아웃과 서킷 브레이커를 두면 묶인 스레드는 많아야 2개이고, 14개 모두 응답을 받습니다(9개는 대체 응답).',
    variants: [
      {
        name: '타임아웃 없이 계속 호출', tone: 'bad', label: '연쇄 장애',
        code: `async function getProduct(id) {
  const product = await db.find(id);
  // 추천 서비스 호출 — 타임아웃 없음
  const res = await fetch(RECS_URL + id);
  const recs = await res.json();
  return { product, recs };
}`,
        notes: { 4: '응답이 올 때까지 스레드를 붙잡음' }, run: cbBad,
      },
      {
        name: '타임아웃 + 서킷 브레이커', tone: 'good', label: '빠르게 실패',
        code: `async function callRecs(id) {
  if (state === 'open') {
    if (now() - openedAt < COOLDOWN) return FALLBACK;   // 즉시 실패
    state = 'half-open';                                // 시험 호출
  }
  try {
    const res = await fetch(RECS_URL + id, { signal: AbortSignal.timeout(200) });
    state = 'closed'; failures = 0;
    return res.json();
  } catch (e) {
    if (++failures >= 3 || state === 'half-open') { state = 'open'; openedAt = now(); }
    return FALLBACK;
  }
}`,
        notes: { 3: '호출하지 않고 바로 반환', 7: '기다리는 시간의 상한', 11: '연속 실패 3회 → 열림' }, run: cbGood,
      },
    ],
    points: [
      '<b>타임아웃이 먼저</b>입니다. 타임아웃이 없으면 "실패"가 발생하지 않으므로 브레이커가 셀 것도 없습니다. 모든 외부 호출(HTTP, DB, 캐시)에 기다리는 시간의 상한을 둡니다.',
      '서킷 브레이커의 세 상태: <b>닫힘</b>(호출 통과, 실패를 셈) → <b>열림</b>(호출하지 않고 즉시 실패) → <b>반열림</b>(시험 호출 몇 개만 통과시켜 회복을 확인). 열림은 나를 보호하는 동시에, 느려진 상대에게 숨 돌릴 틈을 줍니다.',
      '<b>재시도</b>는 일시적인 실패에는 약이지만 과부하에는 독입니다. 느려진 서비스에 모두가 재시도하면 부하가 몇 배가 됩니다. 재시도 간격은 지수 백오프(100ms → 200ms → 400ms)로 늘리고, 여러 클라이언트가 같은 순간에 몰리지 않도록 무작위 값(지터)을 섞고, 횟수에 상한을 둡니다.',
      '재시도는 여러 번 실행해도 안전한(멱등한) 요청에만 겁니다. 브레이커가 열려 있을 때는 재시도하지 않습니다.',
    ],
    senior: '실제 브레이커는 연속 실패 횟수보다 최근 N초의 실패율과 느린 호출 비율로 판단하고, 판단에 필요한 최소 호출 수를 둡니다(호출 2번 중 1번 실패를 50%로 보지 않도록). 반열림에서 내보내는 시험 호출 수도 제한합니다. 서버가 여러 대면 브레이커 상태가 인스턴스마다 따로라서 열리는 시점이 제각각인데, 대개는 그대로 두고 서비스 메시나 로드 밸런서의 이상 인스턴스 제외 기능과 함께 씁니다. 브레이커와 짝이 되는 것이 격벽(bulkhead)입니다. 하위 서비스별로 연결 풀과 동시 호출 수를 나눠 두면 하나가 느려져도 다른 호출의 자원까지 먹지 못합니다. 타임아웃 값은 추측이 아니라 그 호출의 p99 지연에서 정하고, 여러 단계를 거치는 요청은 남은 시간(deadline)을 아래로 전달해 이미 포기한 요청을 하위 서비스가 계속 처리하지 않게 합니다. 대체 응답도 설계 대상입니다. 추천은 기본 목록으로 대신할 수 있지만 결제 승인은 대신할 값이 없으므로 명확한 오류를 돌려줘야 합니다. 브레이커 상태 변화는 반드시 지표와 알람으로 남기세요. 조용히 열려 있는 브레이커는 그 자체가 장애입니다.',
    qa: [
      ['하위 서비스 하나가 느려졌는데 왜 전체 서비스가 멈춥니까?', '죽은 서비스는 연결 오류가 바로 돌아오지만, 느린 서비스는 호출한 쪽의 스레드와 연결을 응답이 올 때까지 붙잡습니다. 요청은 계속 들어오므로 스레드 풀이 금방 바닥나고, 그 풀을 함께 쓰는 무관한 요청까지 받지 못합니다. 이렇게 장애가 호출 방향을 거슬러 번지는 것이 연쇄 장애입니다. 타임아웃, 서킷 브레이커, 풀 분리(격벽)로 막습니다.'],
      ['서킷 브레이커의 세 상태를 설명해 보세요.', '닫힘은 평소 상태로 호출을 통과시키며 실패를 셉니다. 실패가 기준을 넘으면 열림이 되어, 호출을 보내지 않고 즉시 오류나 대체 응답을 돌려줍니다. 일정 시간이 지나면 반열림이 되어 시험 호출 몇 개만 내보냅니다. 성공하면 닫힘으로 돌아가고, 실패하면 다시 열림으로 가서 더 기다립니다.'],
      ['재시도가 장애를 키울 수 있는 이유와 대책은?', '과부하로 느려진 서비스에 실패한 요청을 모두 다시 보내면 부하가 재시도 횟수만큼 곱해집니다. 호출이 여러 단계면 단계마다 곱해집니다. 대책은 지수 백오프로 간격을 늘리고, 지터로 재시도 시각을 흩고, 횟수 상한이나 전체 요청 대비 재시도 비율 상한(재시도 예산)을 두는 것입니다. 브레이커가 열려 있으면 재시도하지 않고, 멱등하지 않은 요청은 재시도하지 않습니다.'],
    ],
    dx: {
      cat: ['hang', 'slow', 'crash'], concept: '연쇄 장애 (타임아웃 없는 하위 호출이 스레드·연결을 점유)',
      symptoms: ['하위 서비스 하나가 느려졌는데 그것과 무관한 API까지 전부 타임아웃된다', '스레드 풀·연결 풀 사용률은 100%인데 CPU는 한가하다', '스레드 덤프를 뜨면 대부분이 같은 외부 호출의 응답 읽기에서 대기 중이다', '하위 서비스가 회복된 뒤에도 내 서비스는 재시작해야 돌아온다'],
      check: '장애 시각의 스레드 덤프(또는 진행 중인 요청 목록)에서 어디서 기다리는지 봅니다. 외부 호출별 지연 p99와 동시 진행 수를 지표로 보고, HTTP·DB 클라이언트의 타임아웃 설정값(기본값이 무제한인 경우가 많음)을 확인합니다.',
      fix: '모든 외부 호출에 연결·응답 타임아웃을 겁니다. 하위 서비스별로 서킷 브레이커와 동시 호출 상한(격벽)을 두고, 열렸을 때의 대체 응답을 정합니다. 재시도는 백오프 + 지터 + 횟수 상한으로 제한합니다.',
    },
  });

  /* ---------- 요청 제한 ---------- */
  const RL = { A: [900, 920, 940, 960, 980], B: [1000, 1020, 1040, 1060, 1080], C: [1200, 1400, 1600, 1800], K: ['0.2초 사이에 통과한 최대 요청 수', '통과', '거절 (429)'] };
  const rlRun = (bucket) => (t) => {
    const { K } = RL, LIMIT = 5, WINDOW = 1000, CAP = 5000, RATE = 5;   // 토큰은 1/1000개 단위 정수로 계산
    K.forEach((k) => (t.m[k] = 0));
    const reqs = [...RL.A.map((at) => [at, 'A']), ...RL.B.map((at) => [at, 'B']), ...RL.C.map((at) => [at, 'C'])];
    const res = {}, counts = {}, passed = [];
    let tokens = CAP, last = 0, cur = -1;
    const sec = (ms) => (ms / 1000).toFixed(2);
    const grp = (g) => { const all = reqs.filter((r) => r[1] === g), seen = all.filter((r) => r[0] in res), ok = seen.filter((r) => res[r[0]]).length; return { n: seen.length, ok, text: seen.length ? `${ok}/${seen.length}` : '', s: !seen.length ? '' : bucket ? 'done' : g === 'B' && ok ? 'bad' : 'done' }; };
    const snap = () => [
      { type: 'timeline', total: 1100, title: '시간 축 → 0.8초 ~ 1.9초 구간 (막대 글자 = 통과 / 도착)',
        items: [
          ...(bucket ? [] : [0, 1].map((w) => ({ id: 'w' + w, label: w ? '창 2 · 1초~' : '창 1 · ~1초', start: w ? 200 : 0, len: w ? 900 : 200, s: cur >= 0 && Math.floor(cur / WINDOW) === w ? 'active' : '', text: `${counts[w] || 0} / 5` }))),
          ...[['A', '묶음 A · 5개', 100, 100], ['B', '묶음 B · 5개', 200, 100], ['C', '이후 · 4개', 400, 620]].map(([g, label, start, len]) => ({ id: g, label, start, len, s: grp(g).s, text: grp(g).text })),
        ] },
      ...(bucket ? [{ type: 'cells', title: `토큰 버킷 — 용량 5개, 200ms마다 1개 충전 · 지금 ${(tokens / 1000).toFixed(1)}개`,
        items: [0, 1, 2, 3, 4].map((i) => ({ id: 'tk' + i, v: tokens >= (i + 1) * 1000 ? '●' : '', s: tokens >= (i + 1) * 1000 ? 'new' : 'hole' })) }] : []),
      { type: 'cells', compact: true, title: '요청 14개 — 숫자는 도착 시각(ms)',
        items: reqs.map(([at, g], i) => ({ id: 'q' + at, v: at, sub: at in res ? (res[at] ? '통과' : '거절') : '', s: at === cur ? 'active' : at in res ? (res[at] ? (!bucket && g === 'B' ? 'bad' : 'done') : 'miss') : 'dim', gap: i === 4 || i === 9 })) },
    ];
    const tally = (at, ok) => {
      res[at] = ok; t.m[ok ? K[1] : K[2]]++;
      if (ok) passed.push(at);
      t.m[K[0]] = Math.max(...passed.map((a) => passed.filter((b) => b >= a && b < a + 200).length), 0);
    };
    t.step(1, bucket
      ? `같은 요청 14개를 <b>토큰 버킷</b>으로 받습니다. 버킷에는 토큰이 최대 5개 들어가고, 200ms마다 1개씩 채워집니다(초당 5개). 요청 하나가 토큰 하나를 씁니다. 처음에는 가득 차 있습니다.`
      : `"1초에 5개까지"를 <b>고정 창</b>으로 구현합니다. 시간을 1초 단위 창으로 자르고, 창마다 통과시킨 수를 셉니다. 한 클라이언트가 요청 14개를 보내는데, 앞의 10개는 1.0초 경계 바로 앞뒤에 몰려 있습니다.`, snap());
    for (const [at, g] of reqs) {
      cur = at;
      if (bucket) {
        const before = tokens;
        tokens = Math.min(CAP, tokens + (at - last) * RATE); last = at;
        const ok = tokens >= 1000;
        if (ok) tokens -= 1000;
        tally(at, ok);
        t.step(ok ? 7 : 6, ok
          ? (g === 'A'
            ? `${sec(at)}초: 토큰이 있습니다. 1개를 쓰고 <b>통과</b>. 버킷에 쌓여 있던 만큼은 연달아 와도 받아 줍니다(허용된 버스트). 남은 토큰 ${(tokens / 1000).toFixed(1)}개.`
            : `${sec(at)}초: 지난 요청 이후 ${((tokens + 1000 - before) / 1000).toFixed(1)}개가 채워져 토큰이 1개를 넘었습니다. <b>통과.</b> 요청이 충전 속도에 맞춰 오면 계속 통과합니다.`)
          : `${sec(at)}초: 토큰이 ${(tokens / 1000).toFixed(1)}개뿐입니다(1개 미만). <b>거절.</b> 창 경계는 없고, 20ms 동안 채워진 0.1개가 전부입니다.`, snap());
      } else {
        const win = Math.floor(at / WINDOW), used = counts[win] || 0, ok = used < LIMIT;
        if (ok) counts[win] = used + 1;
        tally(at, ok);
        t.step(ok ? 7 : 6, ok
          ? (g === 'B'
            ? `${sec(at)}초: <b>창 2</b>에 속합니다. ${at === 1000 ? '새 창이라 카운터가 0부터 시작합니다. ' : ''}${used + 1} / 5 → <b>통과.</b> 0.2초 사이에 통과한 요청이 ${t.m[K[0]]}개째입니다.`
            : `${sec(at)}초: 창 1에 속합니다. ${used + 1} / 5 → 통과.`)
          : `${sec(at)}초: 창 2는 이미 5 / 5입니다. <b>거절.</b> 창 초반에 한도를 다 썼기 때문에, 다음 창이 열리는 2.0초까지는 띄엄띄엄 오는 요청도 전부 거절됩니다.`, snap());
      }
    }
    cur = -1;
    t.step(0, bucket
      ? `한꺼번에 통과한 것은 버킷 용량인 <b>${t.m[K[0]]}개</b>까지였고, 그 뒤로는 충전 속도(초당 5개)만큼만 통과했습니다. 속도에 맞춰 온 뒤쪽 요청 4개는 모두 받아 줬습니다.`
      : `창마다 5개씩만 통과시켰으니 규칙은 지켰습니다. 그런데 경계를 사이에 둔 0.2초 동안 <b>${t.m[K[0]]}개</b>가 통과했습니다. 뒤의 서버가 순간적으로 받은 부하는 한도의 2배입니다.`, snap());
  };
  CS.add({
    id: 'rate-limiter', level: 'mid', topic: 'dist',
    title: '요청 제한: 고정 창의 2배 버스트와 토큰 버킷',
    summary: 'API를 보호하려고 "1초에 5개까지"라는 제한을 겁니다. 가장 쉬운 구현은 1초 단위 창마다 개수를 세는 것인데, 창 경계 앞뒤로 요청이 몰리면 한도의 2배가 한꺼번에 통과합니다. 같은 요청 14개를 고정 창과 토큰 버킷에 넣어 봅니다.',
    headline: '0.2초 사이에 통과한 최대 요청 수',
    verdict: '고정 창은 창 1의 끝과 창 2의 시작에 5개씩, 0.2초 사이에 10개를 통과시켰습니다. 토큰 버킷은 버킷 용량인 5개까지만 한꺼번에 통과시키고, 그 뒤로는 충전 속도만큼만 받았습니다.',
    variants: [
      {
        name: '고정 창 카운터', tone: 'bad', label: '경계에서 2배 통과',
        code: `const LIMIT = 5, WINDOW = 1000;
const counts = new Map();                  // 창 번호 → 통과시킨 수
function allow(now) {
  const win = Math.floor(now / WINDOW);    // 지금이 몇 번째 창인가
  const used = counts.get(win) ?? 0;
  if (used >= LIMIT) return false;         // 429 Too Many Requests
  counts.set(win, used + 1);
  return true;
}`,
        notes: { 4: '경계를 넘으면 0부터 다시', 6: '창이 끝날 때까지 전부 거절' }, run: rlRun(false),
      },
      {
        name: '토큰 버킷', tone: 'good', label: '버스트를 용량으로 제한',
        code: `const CAPACITY = 5, RATE = 5 / 1000;       // 용량 5개, 1ms에 0.005개 충전
let tokens = CAPACITY, last = 0;
function allow(now) {
  tokens = Math.min(CAPACITY, tokens + (now - last) * RATE);
  last = now;
  if (tokens < 1) return false;            // 429 Too Many Requests
  tokens -= 1;
  return true;
}`,
        notes: { 4: '지난 시간만큼 충전, 용량까지만', 7: '요청 1개 = 토큰 1개' }, run: rlRun(true),
      },
    ],
    points: [
      '고정 창은 카운터 하나로 끝나서 싸고 단순합니다. 대신 경계 앞뒤로 최대 <b>한도의 2배</b>가 통과하고, 창 초반에 한도를 다 쓰면 남은 시간 내내 거절됩니다.',
      '토큰 버킷은 숫자 두 개로 정책을 말합니다. <b>충전 속도</b>는 장기 평균, <b>용량</b>은 한꺼번에 허용하는 버스트입니다. t초 동안 통과할 수 있는 양은 최대 "용량 + 속도 × t"입니다.',
      '상태가 토큰 수와 마지막 시각 두 값뿐이라 키(사용자, API 키, IP)마다 따로 둬도 부담이 적습니다. 타이머로 채우는 것이 아니라 요청이 올 때 지난 시간만큼 계산합니다.',
      '거절할 때는 상태 코드 <code>429</code>와 함께 <code>Retry-After</code> 헤더로 언제 다시 시도하면 되는지 알려 줍니다. 그러지 않으면 클라이언트가 즉시 재시도해서 부하가 더 늘어납니다.',
    ],
    senior: '경계 문제를 없애는 다른 방법은 슬라이딩 윈도입니다. 요청 시각을 전부 기록해 "지금부터 과거 1초"를 정확히 세는 방식(로그)은 정확하지만 요청 수만큼 메모리를 쓰고, 이전 창의 카운트에 겹치는 비율을 곱해 더하는 방식(카운터)은 값 두 개로 근사합니다. 서버가 여러 대면 문제가 달라집니다. 각 서버가 메모리에서 따로 세면 실제 한도는 서버 수만큼 곱해지고, 서버를 늘릴 때마다 한도도 늘어납니다. 그래서 카운터를 Redis 같은 중앙 저장소에 두는데, "읽고 → 판단하고 → 줄이기"를 따로 하면 두 서버가 동시에 같은 값을 읽고 둘 다 통과시킵니다. 증가·감소와 판단을 저장소 안에서 원자적으로(단일 명령이나 스크립트 하나로) 실행해야 합니다. 요청마다 저장소를 왕복하는 지연이 부담이면 서버가 토큰을 묶음으로 받아 와 로컬에서 쓰는 식으로 정확도와 맞바꿉니다. 저장소가 죽었을 때 전부 통과시킬지(fail-open) 전부 막을지(fail-closed)도 미리 정해야 합니다. 남은 한도를 알려 주는 응답 헤더는 서비스마다 이름이 다르고, <code>RateLimit</code>·<code>RateLimit-Policy</code> 헤더로 통일하려는 IETF 문서는 2026년 기준 아직 초안 단계입니다.',
    qa: [
      ['고정 창 방식의 문제는 무엇입니까?', '창 경계에서 카운터가 0으로 돌아가므로, 앞 창의 끝과 다음 창의 시작에 요청을 몰아 보내면 짧은 시간에 한도의 2배가 통과합니다. 뒤의 서버가 한도만큼만 견디도록 설계됐다면 그 순간 과부하가 됩니다. 반대로 창 초반에 한도를 다 쓴 정상 사용자는 창이 끝날 때까지 계속 거절됩니다. 매 분·매 시 정각에 부하가 튀는 모양으로 나타납니다.'],
      ['토큰 버킷은 어떻게 동작합니까?', '버킷에 토큰이 일정 속도로 채워지고 용량까지만 쌓입니다. 요청은 토큰 하나를 써야 통과하고, 없으면 거절됩니다. 한동안 조용했던 클라이언트는 쌓인 토큰만큼 한꺼번에 보낼 수 있고(버스트), 계속 보내면 충전 속도로 수렴합니다. 구현은 토큰 수와 마지막 갱신 시각만 저장해 두고, 요청이 올 때 지난 시간에 속도를 곱해 채웁니다.'],
      ['API 서버가 10대일 때 사용자별 요청 제한을 어떻게 구현하겠습니까?', '서버마다 따로 세면 한도가 10배가 되므로 카운터를 Redis 같은 공용 저장소에 둡니다. 읽기와 쓰기를 나누면 경쟁 상태가 생기므로, 충전·판단·차감을 스크립트 하나로 원자적으로 실행합니다. 키에는 만료 시간을 걸어 쓰지 않는 사용자의 상태가 남지 않게 합니다. 저장소 지연과 장애에 대비해 타임아웃과 장애 시 정책(통과 또는 차단)을 정하고, 정확도가 덜 중요하면 로컬 버킷과 주기적 동기화로 왕복을 줄입니다.'],
    ],
    dx: {
      cat: ['flaky', 'slow'], concept: '요청 제한 알고리즘 (고정 창 경계 버스트, 서버별 카운터)',
      symptoms: ['초당 제한을 걸었는데 뒤의 서버에는 순간적으로 그 2배가 들어온다', '매 분·매 시 정각 직후에 부하와 429 응답이 함께 튄다', '정상 사용자가 창 초반에 한도를 다 쓰고 한동안 계속 429를 받는다', '서버를 늘렸더니 실제로 허용되는 요청량도 같이 늘었다'],
      check: '통과한 요청 수를 창 길이보다 훨씬 짧은 단위(100ms 등)로 집계해 경계에서 튀는지 봅니다. 카운터가 서버 메모리에 있는지 공용 저장소에 있는지, 판단과 차감이 원자적인지 코드를 확인합니다.',
      fix: '토큰 버킷이나 슬라이딩 윈도로 바꾸고 버스트 크기를 뒤의 서버가 견디는 양으로 정합니다. 카운터는 공용 저장소에서 원자적으로 갱신합니다. 429에는 Retry-After를 넣고, 클라이언트는 백오프와 지터를 넣어 재시도합니다.',
    },
  });

  /* ---------- CRDT ---------- */
  const crdtRun = (crdt) => (t) => {
    const IDS = ['A', 'B', 'C'], PRESS = { A: [3, 105], B: [2, 108], C: [1, 103] }, K = ['누른 횟수', '사라진 증가 횟수', '최종 값 (정답 16)'];
    t.m[K[0]] = 0; t.m[K[1]] = 0; t.m[K[2]] = 10;
    // has: 그 기기의 상태에 반영되어 있는 "기기별 누른 횟수" (사라진 횟수를 세기 위한 장부)
    const dev = {};
    for (const id of IDS) dev[id] = { value: 10, ts: 100, vec: { A: 4, B: 3, C: 3 }, has: { A: 0, B: 0, C: 0 } };
    const val = (d) => (crdt ? d.vec.A + d.vec.B + d.vec.C : d.value);
    const pressed = { A: 0, B: 0, C: 0 }, hot = new Set(), edges = [];
    let online = true, mark = {};
    const lost = () => IDS.reduce((s, k) => s + pressed[k] - Math.max(...IDS.map((id) => dev[id].has[k])), 0);
    const P = { A: [210, 20], B: [84, 84], C: [336, 84] };
    const snap = () => [
      { type: 'graph', w: 420, h: 112, scale: 1.1, title: online ? '기기 3대 — 선은 동기화' : '기기 3대 — 오프라인 (서로 연결 없음)',
        nodes: IDS.map((id) => ({ id, v: '기기 ' + id, x: P[id][0], y: P[id][1], w: 68, side: id === 'A', sub: crdt ? `합 ${val(dev[id])}` : `값 ${dev[id].value} · 시각 ${dev[id].ts}`, s: hot.has(id) ? 'active' : mark[id] || '' })),
        edges: edges.map((e) => ({ ...e })) },
      crdt
        ? { type: 'cells', cols: 5, compact: true, title: '각 기기가 가진 상태 — 기기별 누적 횟수 칸 3개, 값은 칸의 합',
          items: [['', 'A칸', 'B칸', 'C칸', '합'].map((v, i) => ({ id: 'h' + i, v, s: 'dim' })),
            ...IDS.map((id) => [{ id: id + 'l', v: '기기 ' + id, s: hot.has(id) ? 'active' : '' }, ...IDS.map((k) => ({ id: id + k, v: dev[id].vec[k], s: mark[id + k] || '' })), { id: id + 's', v: val(dev[id]), s: 'cmp' }])].flat() }
        : { type: 'cells', title: '오프라인에서 각 기기가 누른 횟수 — 합친 뒤에도 남아 있는가',
          items: IDS.map((id) => ({ id: 'p' + id, v: pressed[id] ? '+' + pressed[id] : '·', sub: '기기 ' + id, s: !pressed[id] ? 'hole' : pressed[id] > Math.max(...IDS.map((d) => dev[d].has[id])) ? 'bad' : mark.judged ? 'done' : 'new' })) },
    ];
    edges.push({ a: 'A', b: 'B', s: 'done' }, { a: 'B', b: 'C', s: 'done' }, { a: 'A', b: 'C', s: 'done' });
    t.step(1, crdt
      ? `같은 카운터를 <b>G-Counter</b>(증가 전용 카운터)로 저장합니다. 숫자 하나가 아니라 "기기 A가 누른 횟수, B가 누른 횟수, C가 누른 횟수"를 칸으로 나눠 갖습니다. 지금은 세 기기 모두 {4, 3, 3}, 합 10입니다.`
      : `여럿이 함께 쓰는 앱의 카운터(예: 출석 인원)가 기기 3대에 저장되어 있습니다. 지금은 모두 동기화되어 <b>10</b>입니다. 각 기기는 값과 함께 마지막으로 고친 시각을 갖고 있습니다.`, snap());
    online = false; edges.length = 0;
    for (const id of IDS) {
      const [n, ts] = PRESS[id];
      hot.clear(); hot.add(id); mark = {};
      for (let i = 0; i < n; i++) { if (crdt) dev[id].vec[id]++; else { dev[id].value++; dev[id].ts = ts; } pressed[id]++; dev[id].has[id]++; t.m[K[0]]++; }
      if (crdt) mark[id + id] = 'new';
      t.step(3, crdt
        ? `오프라인. 기기 ${id}에서 +1을 ${n}번 누릅니다. <b>자기 칸(${id}칸)만</b> 올립니다: ${dev[id].vec[id] - n} → ${dev[id].vec[id]}. 다른 기기의 칸은 건드리지 않습니다.`
        : `${id === 'A' ? '세 기기가 오프라인이 됩니다. ' : ''}기기 ${id}에서 +1을 ${n}번 누릅니다. 값 10 → <b>${dev[id].value}</b>, 고친 시각 ${ts}. 다른 기기는 이 변경을 모릅니다.`, snap());
    }
    hot.clear(); mark = {}; online = true;
    t.step(0, `세 기기가 다시 온라인이 됩니다. 누른 횟수는 모두 ${t.m[K[0]]}번이므로 합친 결과는 10 + ${t.m[K[0]]} = <b>16</b>이어야 합니다. 이제 둘씩 만나 상태를 합칩니다.`, snap());
    const sync = (a, b) => {
      const x = dev[a], y = dev[b];
      hot.clear(); hot.add(a); hot.add(b); mark = {};
      edges.forEach((e) => (e.s = 'done'));
      edges.push({ a, b, s: 'active' });
      if (crdt) {
        const changed = [];
        for (const k of IDS) {
          const m = Math.max(x.vec[k], y.vec[k]);
          if (x.vec[k] !== m) { changed.push(`${a}의 ${k}칸 ${x.vec[k]} → ${m}`); mark[a + k] = 'new'; }
          if (y.vec[k] !== m) { changed.push(`${b}의 ${k}칸 ${y.vec[k]} → ${m}`); mark[b + k] = 'new'; }
          x.vec[k] = y.vec[k] = m;
          x.has[k] = y.has[k] = Math.max(x.has[k], y.has[k]);
        }
        t.m[K[1]] = lost();
        t.step(7, `${a} ↔ ${b} 동기화: 칸마다 <b>더 큰 값</b>을 가집니다. ${changed.join(', ')}. 서로 다른 칸을 올렸으므로 누구의 변경도 덮어쓰지 않습니다. 두 기기의 합은 ${val(x)}.`, snap());
      } else if (x.ts === y.ts) {
        t.step(7, `${a} ↔ ${b} 동기화: 두 기기의 값과 시각이 이미 같습니다. 바뀌는 것이 없습니다.`, snap());
      } else {
        const [win, lose, wid, lid] = x.ts > y.ts ? [x, y, a, b] : [y, x, b, a], before = lose.value;
        lose.value = win.value; lose.ts = win.ts; lose.has = { ...win.has };
        mark[lid] = 'bad';
        const was = t.m[K[1]];
        t.m[K[1]] = lost();
        t.step(8, `${a} ↔ ${b} 동기화: 시각 ${win.ts}가 더 늦으므로 <b>기기 ${wid}의 값이 이깁니다.</b> 기기 ${lid}의 값 ${before}은 ${win.value}로 덮어써집니다. ${lid}에서 누른 횟수 ${t.m[K[1]] - was}번이 사라졌습니다.`, snap());
      }
    };
    sync('A', 'B'); sync('B', 'C'); sync('C', 'A');
    hot.clear(); mark = { judged: true };
    edges.forEach((e) => (e.s = 'done'));
    if (crdt) {
      hot.add('C'); mark = { judged: true };
      const old = { A: 7, B: 3, C: 3 };   // 기기 A가 오프라인 중에 보냈던 옛 상태가 뒤늦게 도착
      for (const k of IDS) dev.C.vec[k] = Math.max(dev.C.vec[k], old[k]);
      t.step(7, `늦게 도착한 메시지: 기기 A가 예전에 보낸 상태 {7, 3, 3}이 이제야 기기 C에 옵니다. 칸마다 큰 값을 고르면 C는 그대로 {${IDS.map((k) => dev.C.vec[k]).join(', ')}}입니다. 같은 것을 다시 받아도, 순서가 뒤바뀌어도 결과가 같습니다.`, snap());
      hot.clear();
    }
    t.m[K[2]] = val(dev.A);
    t.step(crdt ? 9 : 0, crdt
      ? `세 기기 모두 {${IDS.map((k) => dev.A.vec[k]).join(', ')}}, 합 <b>${val(dev.A)}</b>. 누른 ${t.m[K[0]]}번이 전부 반영됐습니다. 어느 쌍부터 합치든 같은 값에 도달합니다.`
      : `세 기기 모두 <b>${dev.A.value}</b>로 같아지긴 했습니다. 하지만 누른 ${t.m[K[0]]}번 중 <b>${t.m[K[1]]}번</b>이 사라졌습니다. 오류도 경고도 없었습니다.`, snap());
  };
  CS.add({
    id: 'crdt', level: 'senior', topic: 'dist',
    title: 'CRDT: 오프라인에서 각자 고친 데이터를 합치기',
    summary: '기기 여러 대가 같은 데이터를 오프라인에서 각자 고친 뒤 다시 만나면, 어느 쪽 값을 남길지 정해야 합니다. "나중에 쓴 쪽이 이긴다"로 합치면 한쪽의 변경이 조용히 사라집니다. 기기 3대에서 카운터를 6번 올리고 두 방식으로 합쳐 봅니다.',
    headline: '사라진 증가 횟수',
    verdict: '마지막 쓰기 우선(LWW)은 가장 늦은 시각의 값 12만 남겨, 누른 6번 중 4번이 사라졌습니다. 기기별 칸을 따로 두고 칸마다 큰 값을 고르는 G-Counter는 6번을 모두 살려 16이 됩니다.',
    variants: [
      {
        name: '마지막 쓰기 우선 (LWW)', tone: 'bad', label: '변경이 사라짐',
        code: `// 기기마다 { value, ts }를 저장
function increment(local) {
  local.value += 1;
  local.ts = Date.now();             // 고친 시각을 함께 기록
}
function merge(local, remote) {
  if (remote.ts > local.ts) {        // 더 늦게 고친 쪽이 이김
    local.value = remote.value;      // 내 값은 통째로 덮어씀
    local.ts = remote.ts;
  }
}`,
        notes: { 7: '기기의 시계를 믿어야 함', 8: '내가 올린 횟수가 사라짐' }, run: crdtRun(false),
      },
      {
        name: 'CRDT (G-Counter)', tone: 'good', label: '모두 반영',
        code: `// 기기마다 { A: n, B: n, C: n } — 기기별 누적 횟수를 저장
function increment(local, me) {
  local[me] += 1;                    // 자기 칸만 올림
}
function merge(local, remote) {
  for (const id in remote)           // 칸마다 더 큰 값을 가짐
    local[id] = Math.max(local[id], remote[id]);
}
const value = (c) => c.A + c.B + c.C;`,
        notes: { 3: '다른 기기와 같은 칸을 고칠 일이 없음', 7: '순서·중복과 무관한 연산' }, run: crdtRun(true),
      },
    ],
    points: [
      '<b>CRDT</b>(충돌 없는 복제 데이터 타입)는 합치는 연산을 순서를 바꿔도(교환), 묶는 방법을 바꿔도(결합), 같은 것을 두 번 해도(멱등) 결과가 같도록 설계한 자료구조입니다. 그래서 중앙 서버의 조정 없이도 모든 복제본이 같은 값에 도달합니다.',
      'G-Counter의 요령은 "값"이 아니라 <b>누가 무엇을 했는지</b>를 저장하는 것입니다. 각자 자기 칸만 고치므로 동시에 고쳐도 서로 덮어쓸 일이 없습니다.',
      'LWW는 벽시계에 의존합니다. 시계가 몇 분 빠른 기기가 있으면 그 기기의 값이 항상 이깁니다.',
      'LWW가 틀린 방식인 것은 아닙니다. 프로필 이름처럼 "나중 값 하나만 남으면 되는" 필드에는 충분하고 훨씬 쌉니다. 문제는 더해져야 할 변경(카운터, 목록에 추가)을 덮어쓰기로 합칠 때 생깁니다.',
    ],
    senior: 'G-Counter는 가장 단순한 예입니다. 감소가 필요하면 증가용과 감소용 카운터 두 개를 둡니다(PN-Counter). 집합은 "한쪽은 추가, 한쪽은 삭제"가 충돌하므로 추가할 때마다 고유 태그를 붙이고 삭제는 자신이 본 태그만 지워서, 동시에 일어난 추가가 살아남게 합니다(OR-Set). 공동 편집기의 텍스트는 글자마다 고유 ID와 이웃 관계를 저장하는 시퀀스 CRDT로 합칩니다. 비용도 분명합니다. 삭제 흔적과 기기별 메타데이터가 계속 쌓여서, 원본보다 메타데이터가 훨씬 커지는 것이 실무의 주된 문제였습니다. 2025년에 나온 Automerge 3.0은 저장용 압축 형식을 메모리에서도 그대로 쓰도록 바꿔 메모리 사용량을 10배 이상 줄였다고 발표했습니다. 그리고 "수렴한다"와 "의도대로 합쳐진다"는 다릅니다. CRDT는 재고가 0 밑으로 내려가면 안 된다, 한 좌석은 한 사람에게만 같은 불변식을 지켜 주지 못합니다. 그런 규칙은 여전히 서버가 순서를 정해야 합니다. 그래서 2026년 기준 로컬 퍼스트(기기에 먼저 쓰고 나중에 동기화) 앱들은 CRDT를 전부에 쓰기보다 문서 본문·메모 같은 곳에만 쓰고, 나머지는 서버가 순서를 정하는 동기화와 섞는 경우가 많습니다.',
    qa: [
      ['마지막 쓰기 우선(LWW)으로 충돌을 해결할 때의 문제는?', '두 기기가 같은 값을 각자 고치면 타임스탬프가 늦은 쪽만 남고 다른 쪽 변경은 오류 없이 사라집니다. 카운터나 목록처럼 두 변경이 모두 반영되어야 하는 데이터에서는 데이터 유실입니다. 또 기기의 벽시계를 믿어야 해서, 시계가 틀린 기기가 항상 이기거나 항상 집니다. 덮어써도 되는 단일 필드에만 쓰는 것이 맞습니다.'],
      ['CRDT가 순서와 중복에 상관없이 수렴하는 이유는?', '합치는 연산이 교환·결합·멱등 법칙을 만족하도록 설계됐기 때문입니다. G-Counter를 예로 들면 합치기는 칸별 최댓값인데, 최댓값은 어떤 순서로 적용해도, 같은 상태를 여러 번 적용해도 결과가 같습니다. 그래서 메시지가 늦거나 중복되거나 순서가 바뀌어도, 같은 변경을 모두 받은 복제본은 같은 상태가 됩니다.'],
      ['CRDT를 쓰면 안 되는 경우는 언제입니까?', '전체에 걸친 불변식이 있을 때입니다. 재고가 음수가 되면 안 된다, 예약은 한 사람만 성공해야 한다 같은 규칙은 각자 로컬에서 통과한 연산을 합치는 순간 깨질 수 있습니다. 이런 데이터는 서버나 합의 알고리즘이 순서를 정해야 합니다. 메타데이터가 계속 쌓이는 비용도 있어서, 충돌이 거의 없는 데이터에는 과한 선택입니다.'],
    ],
    dx: {
      cat: ['data', 'wrong'], concept: '동시 수정 병합 (마지막 쓰기 우선으로 덮어씀)',
      symptoms: ['두 사람이 비슷한 시각에 고쳤는데 한 사람의 수정이 오류 없이 사라진다', '오프라인에서 작업한 기기가 온라인이 되면 다른 기기의 변경을 덮어쓴다', '카운터·수량이 실제 발생한 이벤트 수보다 적다', '시계가 틀린 기기에서 고친 값이 항상 이기거나 항상 진다'],
      check: '같은 레코드를 두 클라이언트에서 오프라인으로 각각 고친 뒤 동기화해 봅니다. 병합 코드가 타임스탬프 비교로 레코드를 통째로 덮어쓰는지, 변경 이벤트 수와 최종 값이 맞는지 확인합니다.',
      fix: '더해져야 하는 데이터는 값이 아니라 연산(누가 몇 번)을 저장해 합치거나 CRDT 라이브러리를 씁니다. 덮어써도 되는 필드는 필드 단위 LWW로 범위를 좁힙니다. 불변식이 있는 데이터는 서버에서 순서를 정해 검증합니다.',
    },
  });
})();
