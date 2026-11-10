/* 네트워크: URL을 입력하면, TCP vs UDP, 연결 재사용, HTTP 캐시, 폴링 vs 웹소켓
   지연 시간은 원리를 보이기 위한 가정값이다 (왕복 1번 = 20ms 등) */
(function () {
  const CS = window.CS;

  /* ---------- URL을 입력하면 ---------- */
  CS.add({
    id: 'url-journey', level: 'basic',
    title: '주소창에 URL을 입력하면 일어나는 일',
    summary: '면접 단골 질문이자 웹 성능의 지도입니다. 엔터를 누른 뒤 화면이 그려지기까지, 요청은 이름 풀이 → 연결 → 암호화 → 요청·응답 → 렌더링의 다섯 구간을 지납니다. 각 구간이 왜 필요한지 따라가 봅니다.',
    verdict: '첫 바이트가 도착하기 전에 이미 여러 번의 왕복이 필요합니다(DNS, TCP, TLS). 그래서 "서버 처리 시간"만 줄여서는 체감 속도가 잘 안 바뀝니다. 연결 재사용, 캐시, CDN이 이 앞 구간을 줄이는 기술입니다.',
    variants: [{
      name: 'https://shop.example.com/products 요청', tone: 'info',
      code: `const ip = await dns.resolve('shop.example.com');
const socket = await tcp.connect(ip, 443);
const secure = await tls.handshake(socket);
secure.write('GET /products HTTP/1.1 ...');
const response = await secure.read();
render(parse(response.body));`,
      notes: { 1: '이름 → IP 주소', 2: '왕복 1번', 3: '왕복 1번 (TLS 1.3)', 5: '서버 처리 + 전송' },
      run(t) {
        t.m['누적 시간 (ms)'] = 0; t.m['네트워크 왕복'] = 0;
        const items = [];
        let now = 0;
        const hops = { b: ['브라우저', 56, 40], d: ['DNS', 210, 40], s: ['서버', 364, 40] };
        const snap = (edge, back) => [
          { type: 'graph', directed: true, w: 420, h: 84, scale: 1.5, title: '누가 누구와 이야기하는가',
            nodes: Object.entries(hops).map(([id, [v, x, y]]) => ({ id, v, x, y, w: 76, s: edge && (edge[0] === id || edge[1] === id) ? 'active' : '' })),
            edges: edge ? [{ a: back ? edge[1] : edge[0], b: back ? edge[0] : edge[1], s: 'active' }] : [] },
          { type: 'timeline', total: 170, title: '시간 축 → (가정: 왕복 1번 = 20ms)', items: items.map((x) => ({ ...x })) },
        ];
        const phase = (id, label, len, rt) => { items.forEach((x) => (x.s = 'done')); items.push({ id, label, start: now, len, s: 'active', text: `${len}ms` }); now += len; t.m['누적 시간 (ms)'] = now; t.m['네트워크 왕복'] += rt; };
        t.step(0, `엔터를 누릅니다. 브라우저는 먼저 주소를 해석합니다: 프로토콜 <code>https</code>, 호스트 <code>shop.example.com</code>, 경로 <code>/products</code>.`, snap());
        t.step(1, `컴퓨터는 이름이 아니라 IP 주소로 통신합니다. 먼저 <b>캐시</b>를 봅니다: 브라우저 → 운영체제 → 공유기. 없으면 DNS 서버에 묻습니다.`, snap(['b', 'd']));
        phase('dns', 'DNS 조회', 20, 1);
        t.step(1, `DNS 서버가 루트 → <code>.com</code> → <code>example.com</code> 담당 서버 순으로 물어 <b>IP 주소</b>를 돌려줍니다. 결과는 TTL 동안 캐시됩니다.`, snap(['b', 'd'], true));
        t.step(2, `이제 서버와 <b>TCP 연결</b>을 맺습니다. ① 브라우저: SYN ("연결하고 싶습니다")`, snap(['b', 's']));
        phase('tcp', 'TCP 연결', 20, 1);
        t.step(2, `② 서버: SYN-ACK ("좋습니다, 저도요") ③ 브라우저: ACK. 이 <b>3-way 핸드셰이크</b>로 양쪽이 서로 보내고 받을 수 있음을 확인합니다.`, snap(['b', 's'], true));
        phase('tls', 'TLS 핸드셰이크', 20, 1);
        t.step(3, `HTTPS이므로 암호화 통로를 만듭니다. 서버가 <b>인증서</b>를 보여 주면 브라우저가 "진짜 shop.example.com이 맞는지" 검증하고, 양쪽이 이번 연결에 쓸 <b>대칭 키</b>를 합의합니다.`, snap(['b', 's']));
        t.step(4, `이제야 HTTP 요청을 보냅니다: 메서드 <code>GET</code>, 경로, 헤더(쿠키, 받을 수 있는 형식 등). 전부 암호화되어 전송됩니다.`, snap(['b', 's']));
        phase('ttfb', '요청 → 첫 바이트', 50, 1);
        t.step(5, `서버가 요청을 처리합니다(라우팅, DB 조회, HTML 생성). 첫 바이트가 돌아오기까지의 시간이 <b>TTFB</b>입니다.`, snap(['b', 's'], true));
        phase('dl', '본문 다운로드', 25, 0);
        t.step(5, `상태 코드 <code>200</code>, 헤더, 본문이 도착합니다. 큰 응답은 여러 TCP 조각으로 나뉘어 옵니다.`, snap(['b', 's'], true));
        phase('render', '렌더링', 35, 0);
        t.step(6, `HTML을 파싱해 <b>DOM</b>을, CSS로 <b>CSSOM</b>을 만들고, 둘을 합쳐 배치(layout)와 그리기(paint)를 합니다. 도중에 만난 CSS·JS·이미지는 또 요청합니다.`, snap());
        items.forEach((x) => (x.s = 'done'));
        t.step(6, `화면이 보이기까지 <b>${now}ms</b>. 그중 실제 서버 처리는 일부이고, 앞의 60ms는 "요청을 보낼 준비"에 쓰였습니다.`, snap());
      },
    }],
    points: [
      '순서를 외우기보다 <b>각 단계가 푸는 문제</b>를 기억하세요: DNS(이름 → 주소), TCP(믿을 수 있는 통로), TLS(엿듣기·위조 방지), HTTP(무엇을 달라는 약속).',
      '개발자 도구 Network 탭의 Timing이 이 구간들을 그대로 보여 줍니다: DNS Lookup, Initial connection, SSL, Waiting(TTFB), Content Download.',
      '두 번째 요청부터는 DNS 캐시와 연결 재사용 덕에 앞 구간이 사라집니다.',
    ],
    senior: '면접에서는 깊이를 조절해 답하는 것이 좋습니다. 큰 줄기를 먼저 말하고, 질문자가 파고드는 곳(DNS 계층, TCP 혼잡 제어, TLS 인증서 체인, 브라우저 렌더링 파이프라인, 로드 밸런서·CDN)을 더 설명합니다. 실무에서는 이 지도가 곧 장애 분석 순서입니다. "사이트가 안 열린다"면 DNS가 풀리는지 → 포트에 연결되는지 → 인증서가 유효한지 → HTTP 상태 코드가 무엇인지 순으로 확인합니다(<code>dig</code>, <code>nc</code>, <code>openssl s_client</code>, <code>curl -v</code>).',
  });

  /* ---------- TCP vs UDP ---------- */
  const tcpRun = (tcp) => (t) => {
    t.m['앱이 받은 조각 (5개 중)'] = 0; t.m['보낸 패킷 수'] = 0; t.m['걸린 시간 (단위)'] = 0;
    const sent = [], wire = [], buf = [], app = [];
    const cell = (v, s, sub) => ({ id: v, v, s, sub });
    const snap = () => [
      { type: 'cells', title: '보낸 쪽 — 조각 1~5', items: [1, 2, 3, 4, 5].map((v) => cell(v, sent.includes(v) ? 'dim' : '')) },
      { type: 'cells', title: '네트워크 — 유실되거나 순서가 바뀔 수 있음', items: wire.map((w) => ({ ...w })) },
      ...(tcp ? [{ type: 'cells', title: '받는 쪽 TCP 버퍼 — 빈 번호가 채워질 때까지 뒤의 것을 붙잡아 둠', items: buf.map((v) => cell(v, 'cmp')) }] : []),
      { type: 'cells', title: '애플리케이션이 받은 데이터', items: app.map((v, k) => ({ id: `a${v}`, v, s: tcp || k < 2 ? 'done' : 'bad' })) },
    ];
    const tick = () => { t.m['걸린 시간 (단위)']++; };
    const deliver = (v) => { app.push(v); t.m['앱이 받은 조각 (5개 중)'] = app.length; };
    t.step(2, `조각 5개를 보냅니다. 이번 전송에서는 <b>3번이 유실</b>되고 <b>4번과 5번의 순서가 바뀌어</b> 도착합니다.`, snap());
    for (const v of [1, 2, 3, 5, 4]) {
      sent.push(v); t.m['보낸 패킷 수']++; tick();
      if (v === 3) { wire.push({ id: 'w3', v: 3, s: 'bad', sub: '유실' }); t.step(2, `3번 전송 — 중간 라우터가 혼잡해서 <b>버려졌습니다.</b> 보낸 쪽은 아직 모릅니다.`, snap()); continue; }
      wire.push({ id: `w${v}`, v, s: 'active', sub: '도착' });
      if (!tcp) { deliver(v); t.step(5, `${v}번 도착 → 온 순서 그대로 앱에 전달합니다.${v === 5 ? ' 3번이 빠졌고 5번이 4번보다 먼저 왔지만 <b>UDP는 관여하지 않습니다.</b>' : ''}`, snap()); continue; }
      if (v === app.length + 1) { deliver(v); t.step(8, `${v}번 도착 — 기다리던 번호입니다. 앱에 전달하고 <code>ACK ${v + 1}</code> ("다음은 ${v + 1}번을 주세요")을 보냅니다.`, snap()); }
      else { buf.push(v); buf.sort(); t.step(7, `${v}번 도착 — 하지만 아직 3번이 없습니다. <b>앱에 주지 않고 버퍼에 보관</b>하고, 다시 <code>ACK 3</code>을 보냅니다.`, snap()); }
    }
    if (!tcp) { t.step(5, `끝. 앱은 <b>1, 2, 5, 4</b>를 받았습니다. 4개뿐이고 순서도 틀립니다. 대신 기다림 없이 가장 빨리 끝났습니다.`, snap()); return; }
    tick(); tick();
    t.step(3, `보낸 쪽: 3번에 대한 ACK가 오지 않고 <code>ACK 3</code>만 반복됩니다. <b>3번이 유실됐다</b>고 판단합니다.`, snap());
    t.m['보낸 패킷 수']++; tick();
    wire.push({ id: 'w3r', v: 3, s: 'new', sub: '재전송' });
    t.step(3, `3번을 <b>재전송</b>합니다.`, snap());
    deliver(3);
    t.step(8, `3번 도착 — 빈자리가 채워졌습니다. 앱에 전달합니다.`, snap());
    buf.length = 0; deliver(4); deliver(5);
    t.step(8, `버퍼에 있던 4, 5번도 이제 <b>순서대로</b> 전달합니다. 앱은 1, 2, 3, 4, 5를 빠짐없이 받았습니다. 대신 3번을 기다리는 동안 4, 5번도 함께 늦어졌습니다.`, snap());
  };
  CS.add({
    id: 'tcp-udp', level: 'mid',
    title: 'TCP vs UDP: 패킷이 사라졌을 때',
    summary: '인터넷은 패킷을 "최선을 다해" 전달할 뿐, 도착도 순서도 보장하지 않습니다. 그 위에서 TCP는 번호를 붙이고 확인하고 다시 보내서 신뢰성을 만들고, UDP는 아무것도 하지 않는 대신 빠릅니다.',
    headline: '앱이 받은 조각 (5개 중)',
    verdict: '어느 쪽이 더 좋은 것이 아니라 비용을 어디에 내느냐의 선택입니다. 파일·웹·DB처럼 한 바이트도 틀리면 안 되는 곳은 TCP, 실시간 음성·게임처럼 늦게 온 데이터가 쓸모없는 곳은 UDP가 맞습니다.',
    variants: [
      {
        name: 'UDP — 보내고 잊는다', tone: 'bad', label: '유실·순서 그대로',
        code: `// 보내는 쪽
for (const chunk of chunks) socket.send(chunk);

// 받는 쪽
socket.on('message', (chunk) => app.deliver(chunk));`,
        notes: { 2: '확인도 재전송도 없음', 5: '온 순서 그대로 전달' }, run: tcpRun(false),
      },
      {
        name: 'TCP — 확인하고 다시 보낸다', tone: 'good', label: '순서·전달 보장',
        code: `// 보내는 쪽 (운영체제의 TCP가 해 주는 일)
for (const seg of segments) send(seg);
onMissingAck((seq) => send(segments[seq]));

// 받는 쪽
onSegment((seg) => {
  buffer[seg.seq] = seg;
  while (buffer[next]) app.deliver(buffer[next++]);
  ack(next);
});`,
        notes: { 3: 'ACK가 안 오면 재전송', 8: '순서대로만 앱에 전달' }, run: tcpRun(true),
      },
    ],
    points: [
      'TCP가 보장하는 것: <b>전달, 순서, 중복 제거, 흐름·혼잡 제어.</b> 이를 위해 연결 수립(3-way 핸드셰이크)과 ACK가 필요합니다.',
      '유실 하나가 뒤의 데이터까지 붙잡는 현상을 <b>Head-of-Line Blocking</b>이라고 합니다.',
      'UDP는 헤더 8바이트에 포트와 길이, 체크섬뿐입니다. 신뢰성이 필요하면 애플리케이션이 직접 만듭니다.',
    ],
    senior: 'HTTP/3가 TCP를 버리고 UDP 위의 QUIC으로 간 이유가 Head-of-Line Blocking입니다. HTTP/2는 한 TCP 연결에 여러 요청을 실었는데, 패킷 하나가 유실되면 상관없는 요청까지 전부 멈췄습니다. QUIC은 스트림별로 순서를 관리해 이를 풉니다. 운영에서는 TCP의 신뢰성이 "응답이 온다"를 뜻하지 않는다는 점이 중요합니다. 상대가 죽으면 TCP는 한참 뒤에야 알려 주므로, 애플리케이션 레벨의 타임아웃과 헬스 체크가 반드시 필요합니다.',
  });

  /* ---------- 연결 재사용 (keep-alive) ---------- */
  const RTT = 20, REQS = 4, KA_TOTAL = REQS * RTT * 3;
  const kaRun = (reuse) => (t) => {
    t.m['총 소요 시간 (ms)'] = 0; t.m['핸드셰이크 횟수'] = 0;
    const items = [];
    let now = 0;
    const snap = () => [{ type: 'timeline', total: KA_TOTAL, title: `시간 축 → (가정: 왕복 1번 = ${RTT}ms, 전체 폭 = ${KA_TOTAL}ms)`, items: items.map((x) => ({ ...x })) }];
    const add = (label, len, s, text) => { items.forEach((x) => { if (x.s === 'active') x.s = x.kind; }); items.push({ id: items.length, label, start: now, len, s: 'active', kind: s, text }); now += len; t.m['총 소요 시간 (ms)'] = now; };
    const connect = (line, msg) => { add('연결 수립', RTT * 2, 'bad', 'TCP + TLS'); t.m['핸드셰이크 횟수']++; t.step(line, msg, snap()); };
    if (reuse) connect(1, `요청을 보내기 전에 연결을 <b>한 번</b> 맺습니다. TCP 핸드셰이크와 TLS 핸드셰이크에 왕복 2번(${RTT * 2}ms)이 듭니다.`);
    for (let i = 1; i <= REQS; i++) {
      if (!reuse) connect(2, i === 1 ? `요청 1 — 먼저 연결부터 맺어야 합니다. 왕복 2번(${RTT * 2}ms).` : `요청 ${i} — 방금 연결을 닫았으므로 <b>똑같은 핸드셰이크를 또</b> 합니다.`);
      add(`요청 ${i}`, RTT, 'done', 'HTTP');
      t.step(3, reuse ? `요청 ${i} — 열려 있는 연결로 바로 보냅니다. 왕복 1번(${RTT}ms).` : `요청 ${i} — 실제 요청·응답은 왕복 1번(${RTT}ms)뿐입니다.`, snap());
      if (!reuse) t.step(4, `연결을 닫습니다. 다음 요청은 다시 처음부터입니다.`, snap());
    }
    items.forEach((x) => (x.s = x.kind));
    t.step(reuse ? 5 : 5, reuse
      ? `총 <b>${now}ms</b>. 핸드셰이크는 한 번만 냈습니다.`
      : `총 <b>${now}ms</b>. 그중 ${REQS * RTT * 2}ms(붉은 구간)가 연결을 맺는 데만 쓰였습니다.`, snap());
  };
  CS.add({
    id: 'keep-alive', level: 'mid',
    title: '연결 재사용: 요청마다 새 연결을 맺는 비용',
    summary: '요청 하나를 보내기 전에 TCP와 TLS 핸드셰이크로 왕복이 여러 번 필요합니다. 요청마다 연결을 새로 맺으면 실제 요청보다 준비에 더 많은 시간을 씁니다.',
    headline: '총 소요 시간 (ms)',
    verdict: '같은 서버로 가는 요청은 연결을 열어 두고 재사용합니다. 요청이 많고 서버가 멀수록(왕복 시간이 길수록) 차이가 커집니다. DB 커넥션 풀도 정확히 같은 이유로 존재합니다.',
    variants: [
      {
        name: '요청마다 새 연결', tone: 'bad', big: { time: '요청당 왕복 3번', space: '–' },
        code: `for (const url of urls) {
  const conn = await connect(host);
  await conn.request(url);
  conn.close();
}`,
        notes: { 2: 'TCP + TLS 핸드셰이크', 4: '닫으면 다음엔 처음부터' }, run: kaRun(false),
      },
      {
        name: '연결 재사용 (keep-alive)', tone: 'good', big: { time: '첫 요청만 왕복 3번', space: '–' },
        code: `const conn = await connect(host);
for (const url of urls) {
  await conn.request(url);
}
conn.close();`,
        notes: { 1: '핸드셰이크는 한 번', 3: '열린 연결로 바로 전송' }, run: kaRun(true),
      },
    ],
    points: [
      'HTTP/1.1은 기본이 keep-alive입니다. 문제는 대개 <b>클라이언트 코드가 연결을 재사용하지 않게</b> 짜인 경우입니다.',
      'HTTP/2는 연결 하나에 여러 요청을 동시에 실어 보냅니다(멀티플렉싱). 연결을 여러 개 열 필요가 줄어듭니다.',
      '유휴 연결은 양쪽의 타임아웃으로 정리됩니다. 한쪽만 끊으면 다음 요청이 "connection reset"으로 실패합니다.',
    ],
    senior: '서버 간 호출에서 자주 나오는 실수는 요청마다 HTTP 클라이언트(또는 Agent)를 새로 만드는 것입니다. 연결 풀이 매번 버려져 모든 호출이 핸드셰이크를 치르고, 트래픽이 몰리면 임시 포트가 고갈되어 "EADDRNOTAVAIL"이 납니다. 클라이언트는 프로세스에서 하나를 만들어 공유하세요. 로드 밸런서의 유휴 타임아웃이 클라이언트의 keep-alive 타임아웃보다 짧으면 간헐적 502·ECONNRESET이 나는데, 클라이언트 쪽 타임아웃을 더 짧게 맞추는 것이 해법입니다.',
  });

  /* ---------- HTTP 캐시 ---------- */
  const SIZE = 200, VISITS = ['첫 방문', '5분 뒤 재방문', '다음 날 (파일 변경 없음)', '10분 뒤 재방문'];
  CS.add({
    id: 'http-cache', level: 'mid',
    title: 'HTTP 캐시: 가장 빠른 요청은 보내지 않는 요청',
    summary: '같은 파일을 방문할 때마다 통째로 내려받을 필요는 없습니다. 서버가 응답 헤더로 "얼마 동안은 다시 묻지 마라", "바뀌었는지만 물어봐라"를 알려 주면 브라우저가 알아서 재사용합니다.',
    headline: '내려받은 양 (KB)',
    verdict: '<code>Cache-Control: max-age</code>는 요청 자체를 없애고, <code>ETag</code>는 요청은 하되 본문 전송을 없앱니다(304). 두 헤더로 전송량과 대기 시간을 함께 줄입니다.',
    variants: [
      {
        name: '캐시 헤더 없음', tone: 'bad',
        code: `app.get('/app.js', (req, res) => {
  res.sendFile('app.js');
});`,
        notes: { 2: '매번 200 + 본문 전체' },
        run(t) {
          t.m['내려받은 양 (KB)'] = 0; t.m['네트워크 요청 수'] = 0;
          const log = [];
          const snap = () => [{ type: 'stack', down: true, title: '방문 기록 — 브라우저가 한 일', items: log.map((x) => ({ ...x })) }];
          t.step(1, `<code>app.js</code>(${SIZE}KB)를 내려 주는 서버입니다. 캐시에 대한 지시가 없습니다.`, snap());
          VISITS.forEach((v, i) => {
            t.m['내려받은 양 (KB)'] += SIZE; t.m['네트워크 요청 수']++;
            log.push({ id: i, v: `${v} → 200 OK, ${SIZE}KB 다운로드`, s: i ? 'bad' : 'cmp' });
            t.step(2, i ? `${v} — 파일은 그대로인데 <b>${SIZE}KB를 또</b> 내려받습니다.` : `${v} — 당연히 전체를 내려받습니다.`, snap());
          });
          t.step(3, `4번 방문에 <b>${t.m['내려받은 양 (KB)']}KB</b>. 같은 파일을 네 번 받았습니다.`, snap());
        },
      },
      {
        name: 'Cache-Control + ETag', tone: 'good',
        code: `app.get('/app.js', (req, res) => {
  res.set('Cache-Control', 'max-age=3600');
  res.set('ETag', hash(file));
  if (req.headers['if-none-match'] === hash(file)) {
    return res.status(304).end();
  }
  res.sendFile('app.js');
});`,
        notes: { 2: '1시간 동안은 묻지도 말 것', 3: '내용의 지문', 5: '안 바뀌었으면 본문 생략' },
        run(t) {
          t.m['내려받은 양 (KB)'] = 0; t.m['네트워크 요청 수'] = 0;
          const log = [];
          const snap = () => [{ type: 'stack', down: true, title: '방문 기록 — 브라우저가 한 일', items: log.map((x) => ({ ...x })) }];
          t.step(2, `서버가 두 가지를 알려 줍니다: "1시간 동안 유효하다"(<code>max-age</code>)와 "이 내용의 지문은 abc123이다"(<code>ETag</code>).`, snap());
          t.m['내려받은 양 (KB)'] += SIZE; t.m['네트워크 요청 수']++;
          log.push({ id: 0, v: `${VISITS[0]} → 200 OK, ${SIZE}KB 다운로드 + 캐시에 저장`, s: 'cmp' });
          t.step(7, `${VISITS[0]} — 전체를 내려받고, 브라우저가 헤더와 함께 캐시에 저장합니다.`, snap());
          log.push({ id: 1, v: `${VISITS[1]} → 요청 없음 (캐시에서 즉시)`, s: 'done' });
          t.step(2, `${VISITS[1]} — 아직 1시간이 안 지났습니다. <b>서버에 묻지도 않고</b> 캐시에서 바로 씁니다. 0KB, 0ms.`, snap());
          t.m['네트워크 요청 수']++; t.m['내려받은 양 (KB)'] += 1;
          log.push({ id: 2, v: `${VISITS[2]} → 304 Not Modified, 본문 없음`, s: 'new' });
          t.step(5, `${VISITS[2]} — 유효 기간이 지났습니다. "내가 가진 건 abc123인데 바뀌었나요?"(<code>If-None-Match</code>)라고 묻고, 서버는 <b>304</b>로 "그대로다"만 답합니다. 헤더뿐이라 1KB 미만.`, snap());
          log.push({ id: 3, v: `${VISITS[3]} → 요청 없음 (캐시에서 즉시)`, s: 'done' });
          t.step(2, `${VISITS[3]} — 304를 받으면서 유효 기간이 다시 1시간으로 갱신됐습니다. 또 캐시에서 씁니다.`, snap());
          t.step(8, `4번 방문에 <b>${t.m['내려받은 양 (KB)']}KB</b>, 요청은 ${t.m['네트워크 요청 수']}번뿐입니다.`, snap());
        },
      },
    ],
    points: [
      '<code>max-age</code> 안에서는 <b>서버가 파일을 바꿔도 브라우저는 모릅니다.</b> 그래서 긴 캐시는 파일명에 내용 해시를 넣는 방식(<code>app.3f9a.js</code>)과 함께 씁니다.',
      'HTML은 짧게(또는 <code>no-cache</code>로 매번 검증), 해시가 붙은 정적 파일은 길게(<code>max-age=31536000, immutable</code>)가 표준 조합입니다.',
      '<code>no-cache</code>는 "캐시하지 마라"가 아니라 "쓰기 전에 검증하라"입니다. 저장 자체를 막는 것은 <code>no-store</code>.',
    ],
    senior: '"배포했는데 사용자에게 옛 화면이 보인다"는 거의 항상 캐시 설정 문제입니다. HTML이 길게 캐시되어 옛 JS 파일명을 가리키거나, CDN이 옛 응답을 들고 있는 경우입니다. 반대로 사용자별 응답(내 정보, 장바구니)에 <code>public</code> 캐시가 붙으면 CDN이 한 사람의 응답을 다른 사람에게 주는 사고가 납니다. 개인화된 응답에는 <code>private</code> 또는 <code>no-store</code>를, 캐시 키가 달라져야 하는 헤더에는 <code>Vary</code>를 명시하세요.',
  });

  /* ---------- 폴링 vs 웹소켓 ---------- */
  const ARRIVE = [2.4, 7.7];
  CS.add({
    id: 'polling-websocket', level: 'mid',
    title: '폴링 vs 웹소켓: 서버가 먼저 말해야 할 때',
    summary: 'HTTP는 클라이언트가 물어야 서버가 답하는 구조입니다. 채팅·알림처럼 서버 쪽에서 일이 생기는 기능은 "계속 물어보기"로 흉내 내거나, 연결을 열어 두고 서버가 밀어 주게 만들어야 합니다.',
    headline: 'HTTP 요청 수',
    verdict: '폴링은 구현이 쉽지만 대부분의 요청이 "새 소식 없음"으로 끝나고, 전달이 주기만큼 늦습니다. 웹소켓은 연결 하나를 유지하면서 일이 생긴 순간에만 데이터를 보냅니다.',
    variants: [
      {
        name: '1초마다 폴링', tone: 'bad', label: '빈 요청 다수',
        code: `setInterval(async () => {
  const res = await fetch('/messages?after=' + lastId);
  const news = await res.json();
  if (news.length) render(news);
}, 1000);`,
        notes: { 2: '소식이 없어도 매초 요청', 5: '최대 1초 지연' },
        run(t) {
          t.m['HTTP 요청 수'] = 0; t.m['빈 응답'] = 0; t.m['평균 전달 지연 (ms)'] = 0;
          const polls = [], shown = [];
          let delay = 0;
          const snap = () => [
            { type: 'cells', title: '10초 동안의 요청 (1초에 한 번) — 흐린 칸은 "새 메시지 없음"', items: polls.map((p) => ({ ...p })) },
            { type: 'cells', title: '화면에 표시된 메시지', items: shown.map((v, k) => ({ id: k, v, s: 'done' })) },
          ];
          t.step(1, `10초 동안 메시지 2개가 도착할 예정입니다(2.4초, 7.7초). 클라이언트는 1초마다 서버에 묻습니다.`, snap());
          for (let s = 1; s <= 10; s++) {
            t.m['HTTP 요청 수']++;
            const got = ARRIVE.filter((a) => a > s - 1 && a <= s);
            if (got.length) {
              delay += Math.round((s - got[0]) * 1000);
              t.m['평균 전달 지연 (ms)'] = Math.round(delay / (shown.length + 1));
              shown.push(`메시지 ${shown.length + 1}`);
              polls.push({ id: s, v: `${s}초`, s: 'done', sub: '메시지!' });
              t.step(4, `${s}초 — 새 메시지가 있습니다. 실제 도착은 ${got[0]}초였으므로 <b>${Math.round((s - got[0]) * 1000)}ms 늦게</b> 보여 줍니다.`, snap());
            } else {
              t.m['빈 응답']++;
              polls.push({ id: s, v: `${s}초`, s: 'dim', sub: '없음' });
              t.step(2, `${s}초 — "새 메시지 있나요?" → "없습니다." 요청·응답 헤더만 오갔습니다.`, snap());
            }
          }
          t.step(5, `요청 10번 중 <b>${t.m['빈 응답']}번이 빈 응답</b>입니다. 사용자가 1만 명이면 초당 1만 건의 요청이 대부분 헛수고입니다.`, snap());
        },
      },
      {
        name: '웹소켓', tone: 'good', label: '올 때만 전송',
        code: `const ws = new WebSocket('wss://chat.example.com');
ws.onmessage = (event) => {
  render(JSON.parse(event.data));
};`,
        notes: { 1: '연결 1번, 계속 열어 둠', 2: '서버가 보낼 때만 호출' },
        run(t) {
          t.m['HTTP 요청 수'] = 0; t.m['빈 응답'] = 0; t.m['평균 전달 지연 (ms)'] = 0;
          const frames = [], shown = [];
          const snap = () => [
            { type: 'cells', title: '연결 위로 오간 것', items: frames.map((p) => ({ ...p })) },
            { type: 'cells', title: '화면에 표시된 메시지', items: shown.map((v, k) => ({ id: k, v, s: 'done' })) },
          ];
          t.m['HTTP 요청 수'] = 1;
          frames.push({ id: 'up', v: '연결 수립', s: 'new', sub: '0초' });
          t.step(1, `HTTP 요청 한 번으로 연결을 맺고 <b>웹소켓으로 전환(Upgrade)</b>합니다. 이후 이 연결은 양방향으로 열려 있습니다.`, snap());
          t.step(2, `메시지 핸들러를 등록합니다. 아무 일도 없으면 <b>아무것도 오가지 않습니다.</b>`, snap());
          ARRIVE.forEach((a, i) => {
            frames.push({ id: `m${i}`, v: `메시지 ${i + 1}`, s: 'done', sub: `${a}초` });
            shown.push(`메시지 ${i + 1}`);
            t.step(3, `${a}초 — 서버에 메시지가 생긴 <b>그 순간</b> 서버가 밀어 줍니다. 지연은 네트워크 전송 시간뿐입니다.`, snap());
          });
          t.step(4, `10초 동안 HTTP 요청 1번, 데이터 프레임 2개. 빈 응답은 없습니다.`, snap());
        },
      },
    ],
    points: [
      '중간 단계도 있습니다. <b>롱 폴링</b>(서버가 소식이 생길 때까지 응답을 미룸), <b>SSE</b>(서버 → 클라이언트 단방향 스트림, 일반 HTTP 위에서 동작).',
      '서버에서 클라이언트로만 보내면 되는 알림·진행률·AI 응답 스트리밍은 SSE가 더 단순합니다. 양방향이 필요할 때 웹소켓.',
      '폴링이 나쁜 것만은 아닙니다. 변화가 드물고 몇 초 지연이 괜찮으면 가장 단순하고 장애에 강합니다.',
    ],
    senior: '웹소켓은 서버를 "상태를 가진" 존재로 만듭니다. 연결이 특정 서버에 붙어 있으므로 서버가 여러 대면 "A 서버에 붙은 사용자에게 B 서버에서 생긴 메시지를 어떻게 전달할 것인가"가 문제가 되고, 보통 Redis Pub/Sub 같은 메시지 버스를 사이에 둡니다. 배포할 때는 수만 개의 연결이 한꺼번에 끊겼다가 동시에 재접속하므로, 클라이언트 재연결에 지수 백오프와 지터를 넣어야 합니다. 프록시·로드 밸런서의 유휴 타임아웃에 걸리지 않게 주기적인 ping도 필요합니다.',
  });
})();
