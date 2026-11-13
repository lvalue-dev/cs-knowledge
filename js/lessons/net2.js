/* 네트워크 2: HTTP/3와 QUIC, TLS 핸드셰이크, CORS 사전 요청, 로드 밸런싱
   지연 시간과 처리 시간은 원리를 보이기 위한 가정값이다 */
(function () {
  const CS = window.CS;

  /* ---------- HTTP/2 (TCP) vs HTTP/3 (QUIC) ---------- */
  const Q_ORDER = ['A1', 'B1', 'C1', 'A2', 'B2', 'C2', 'A3', 'B3', 'C3'], Q_LOST = 'B1';
  const Q_FILES = { A: 'style.css', B: 'app.js', C: 'hero.jpg' };
  const quicRun = (h3) => (t) => {
    t.m['도착하고도 기다린 패킷 수'] = 0; t.m['유실에 멈춘 스트림 수'] = 0; t.m['연결 수립 왕복 수'] = 0;
    const wire = [], held = [], got = { A: 0, B: 0, C: 0 }, stalled = new Set();
    const snap = () => [
      { type: 'cells', title: '연결 위로 온 패킷 (왼쪽부터 도착 순서) — A1은 스트림 A의 첫 조각', items: wire.map((w) => ({ ...w })) },
      { type: 'cells', title: h3 ? 'QUIC의 스트림별 대기 칸 — 자기 스트림의 빈 번호만 기다림' : 'TCP 수신 버퍼 (운영체제) — 빈 번호가 채워질 때까지 뒤의 것을 전부 붙잡음', items: held.map((v) => ({ id: `h${v}`, v, s: 'cmp' })) },
      { type: 'timeline', total: 3, title: '브라우저가 넘겨받은 양 — 파일마다 조각 3개', items: ['A', 'B', 'C'].map((k) => ({ id: k, label: `${k} ${Q_FILES[k]}`, start: 0, len: got[k], text: `${got[k]}/3`, s: got[k] === 3 ? 'done' : stalled.has(k) ? 'bad' : 'active' })) },
    ];
    const arrive = (p, s, sub) => wire.push({ id: `w${p}`, v: p, s, sub });
    const hold = (p) => { held.push(p); stalled.add(p[0]); t.m['도착하고도 기다린 패킷 수']++; t.m['유실에 멈춘 스트림 수'] = stalled.size; arrive(p, 'cmp', '대기'); };
    const release = () => { wire.forEach((w) => { if (w.sub === '대기') { w.s = 'done'; w.sub = '전달'; } }); };

    if (h3) {
      t.m['연결 수립 왕복 수'] = 1;
      t.step(2, `QUIC은 연결을 맺으면서 <b>TLS 1.3 핸드셰이크를 같은 왕복에</b> 끝냅니다. 요청을 보내기까지 왕복 1번입니다. (전에 접속한 서버라면 0번도 가능합니다.)`, snap());
      t.step(5, `서버가 파일 세 개를 스트림 A, B, C로 나눠 패킷 9개에 번갈아 실어 보냅니다. QUIC 패킷에는 <b>어느 스트림의 몇 번째 조각인지</b>가 적혀 있습니다.`, snap());
    } else {
      t.m['연결 수립 왕복 수'] = 1;
      t.step(2, `먼저 TCP 연결을 맺습니다(3-way 핸드셰이크). 왕복 1번.`, snap());
      t.m['연결 수립 왕복 수'] = 2;
      t.step(3, `그 위에서 TLS 핸드셰이크를 합니다. TLS 1.3 기준으로 왕복 1번 더. 요청을 보내기까지 <b>왕복 2번</b>입니다.`, snap());
      t.step(6, `서버가 파일 세 개를 스트림 A, B, C로 나눠 패킷 9개에 번갈아 실어 보냅니다(멀티플렉싱). 하지만 TCP가 보기에 이것은 <b>1번부터 9번까지 이어진 한 줄의 바이트</b>일 뿐입니다.`, snap());
    }
    Q_ORDER.forEach((p, i) => {
      const k = p[0], no = +p[1];
      if (p === Q_LOST) {
        arrive(p, 'bad', '유실');
        t.step(0, `${p}이 오는 길에 <b>유실됩니다.</b> 혼잡한 라우터가 버렸거나 무선 구간에서 깨졌습니다. 받는 쪽은 아직 모릅니다.`, snap());
        return;
      }
      if (h3) {
        if (no === got[k] + 1) {
          got[k]++; arrive(p, 'done', '전달');
          t.step(9, p === 'A1' ? `A1 도착 — 스트림 A가 기다리던 조각입니다. 바로 브라우저에 넘깁니다.`
            : p === 'C1' ? `C1 도착 — 스트림 C의 첫 조각입니다. 앞에서 B1이 빠졌지만 <b>C와는 상관없는 일</b>이므로 기다리지 않고 넘깁니다.`
            : got[k] === 3 ? `${p} 도착 — <b>${Q_FILES[k]} 완료.</b> 스트림 ${k}는 다른 스트림에서 유실이 있었다는 사실조차 모릅니다.`
            : `${p} 도착 — 스트림 ${k}의 다음 조각입니다. 바로 넘깁니다.`, snap());
        } else {
          hold(p);
          t.step(7, `${p} 도착 — 스트림 B는 아직 B1이 없습니다. <b>B의 조각만</b> 대기 칸에 둡니다.`, snap());
        }
      } else if (i === got.A + got.B + got.C && !held.length) {
        got[k]++; arrive(p, 'done', '전달');
        t.step(9, `${p} 도착 — TCP가 기다리던 ${i + 1}번 조각입니다. 위 계층(HTTP/2)으로 올려 스트림 ${k}에 전달합니다.`, snap());
      } else {
        hold(p);
        t.step(7, p === 'C1' ? `C1 도착 — TCP가 보기에는 3번 조각인데 2번이 비었습니다. C1은 B1과 상관없는 파일이지만 <b>TCP는 스트림을 모릅니다.</b> 순서가 맞을 때까지 버퍼에 붙잡아 둡니다.`
          : p === 'A2' ? `A2 도착 — 역시 2번 뒤이므로 대기합니다. 유실과 무관한 스트림 A까지 멈췄습니다.`
          : `${p} 도착 — 대기. 버퍼에 ${held.length}개가 쌓였고 브라우저는 아무것도 받지 못하고 있습니다.`, snap());
      }
    });
    arrive('B1 ', 'new', '재전송');
    t.step(0, `받는 쪽의 확인 응답에서 구멍을 발견한 서버가 B1을 <b>재전송</b>합니다. (재전송이 도착하기까지 왕복 1번쯤 걸립니다. 그 사이 나머지 패킷이 모두 도착했다고 가정합니다.)`, snap());
    held.length = 0; stalled.clear(); release();
    if (h3) {
      got.B = 3;
      t.step(9, `재전송된 B1 도착 — 빈자리가 채워져 B1, B2, B3을 순서대로 넘깁니다. app.js 완료.`, snap());
      t.step(8, `유실 하나 때문에 기다린 패킷은 <b>${t.m['도착하고도 기다린 패킷 수']}개</b>(B2, B3)뿐입니다. style.css와 hero.jpg는 재전송을 기다리지 않고 먼저 끝났습니다.`, snap());
      t.step(2, `덧붙여, QUIC 연결은 IP 주소가 아니라 <b>연결 ID</b>로 식별됩니다. 휴대폰이 Wi-Fi에서 이동통신망으로 넘어가 IP가 바뀌어도 새 경로를 확인한 뒤 같은 연결을 이어 씁니다(연결 이전).`, snap());
    } else {
      got.A = got.B = got.C = 3;
      t.step(9, `재전송된 B1 도착 — 2번 자리가 채워지자 버퍼에 있던 7개가 한꺼번에 올라갑니다. 세 파일이 <b>동시에</b> 끝납니다.`, snap());
      t.step(8, `패킷 1개가 유실됐을 뿐인데 <b>${t.m['도착하고도 기다린 패킷 수']}개</b>가 도착하고도 기다렸고, 세 스트림이 모두 멈췄습니다. 이것이 TCP 수준의 Head-of-Line Blocking입니다.`, snap());
      t.step(2, `덧붙여, TCP 연결은 (출발 IP, 출발 포트, 도착 IP, 도착 포트)로 식별됩니다. 휴대폰이 Wi-Fi에서 이동통신망으로 넘어가 IP가 바뀌면 연결이 끊어지고 <b>왕복 2번의 핸드셰이크부터 다시</b> 해야 합니다.`, snap());
    }
  };
  CS.add({
    id: 'http3-quic', level: 'senior', topic: 'net',
    title: 'HTTP/2 vs HTTP/3: 패킷 하나가 모든 요청을 멈출 때',
    summary: 'HTTP/2는 TCP 연결 하나에 여러 요청을 섞어 보냅니다. 그런데 TCP는 바이트가 순서대로 도착해야만 위로 올려 주므로, 패킷 하나가 유실되면 상관없는 요청까지 전부 멈춥니다. HTTP/3는 UDP 위의 QUIC으로 옮겨 가 순서 관리를 스트림마다 따로 합니다. 같은 유실 한 번이 두 프로토콜에서 어떻게 다르게 번지는지 봅니다.',
    headline: '도착하고도 기다린 패킷 수',
    verdict: '패킷 9개 중 1개가 유실됐을 때, HTTP/2(TCP)에서는 뒤따라온 7개가 전부 버퍼에서 기다리고 세 파일이 모두 멈춥니다. HTTP/3(QUIC)에서는 같은 스트림의 2개만 기다리고 나머지 두 파일은 먼저 끝납니다. 연결 수립도 왕복 2번에서 1번으로 줄어듭니다.',
    variants: [
      {
        name: 'HTTP/2 — TCP 연결 하나', tone: 'bad', label: '유실 하나에 전부 대기',
        code: `// 스트림 A, B, C를 TCP 연결 하나에 섞어 실음
const sock = await tcp.connect(host, 443);
await tls.handshake(sock);

// 받는 쪽 운영체제의 TCP
function onSegment(seg) {
  buffer[seg.seq] = seg;
  while (buffer[next]) {
    http2.deliver(buffer[next++]);
  }
}`,
        notes: { 2: '왕복 1번', 3: '왕복 1번 더', 8: '연결 전체에서 순서 검사', 9: '순서가 맞을 때만 위로' }, run: quicRun(false),
      },
      {
        name: 'HTTP/3 — QUIC (UDP 위)', tone: 'good', label: '스트림별로 독립',
        code: `// 스트림 A, B, C를 QUIC 연결 하나에 실음
const conn = await quic.connect(host, 443);

// 받는 쪽 QUIC (애플리케이션 안의 라이브러리)
function onPacket(pkt) {
  const s = streams[pkt.streamId];
  s.buffer[pkt.offset] = pkt;
  while (s.buffer[s.next]) {
    s.deliver(s.buffer[s.next++]);
  }
}`,
        notes: { 2: '왕복 1번 (TLS 1.3 포함)', 6: '패킷에 스트림 번호가 있음', 8: '이 스트림 안에서만 순서 검사' }, run: quicRun(true),
      },
    ],
    points: [
      'HTTP/2의 멀티플렉싱은 HTTP/1.1의 "한 연결에 한 번에 한 응답" 문제를 풀었지만, 그 아래 TCP의 순서 보장 때문에 <b>유실이 있을 때는 연결 전체가 멈추는</b> 문제가 남았습니다.',
      'QUIC(RFC 9000, 2021년)은 UDP 위에서 재전송, 혼잡 제어, 암호화를 직접 구현한 전송 프로토콜이고, HTTP/3(RFC 9114, 2022년)는 그 위에서 동작하는 HTTP입니다. 신뢰성을 버린 것이 아니라 <b>순서 보장의 범위를 연결에서 스트림으로 좁힌 것</b>입니다.',
      '연결 수립은 TCP + TLS 1.3의 왕복 2번에서 왕복 1번으로 줄고, 재접속은 0-RTT로 첫 패킷에 요청을 실을 수 있습니다.',
      '연결을 IP·포트가 아닌 <b>연결 ID</b>로 식별하므로, 네트워크가 바뀌어도 연결을 이어 갑니다(연결 이전). 이동 중인 모바일 사용자에게 효과가 큽니다.',
    ],
    senior: '2026년 기준 주요 브라우저는 모두 HTTP/3를 지원하고, W3Techs 집계로 웹사이트의 약 40%가 HTTP/3를 제공합니다. 다만 실제 요청 중 HTTP/3 비중은 Cloudflare 집계로 약 20% 수준에 머뭅니다. 브라우저가 첫 방문에서는 HTTP/2로 접속한 뒤 <code>Alt-Svc</code> 응답 헤더(또는 DNS의 HTTPS 레코드)를 보고서야 HTTP/3를 시도하고, UDP 443이 막힌 사내망·방화벽에서는 조용히 HTTP/2로 되돌아가기 때문입니다. 그래서 HTTP/3는 "교체"가 아니라 "추가"로 운영하고, HTTP/2 경로를 반드시 살려 둡니다. 이득도 고르게 나타나지 않습니다. 손실이 거의 없는 유선망이나 데이터센터 내부에서는 차이가 작고, 손실과 지연이 큰 모바일망에서 꼬리 지연(p95, p99)이 주로 줄어듭니다. 비용도 있습니다. QUIC은 커널이 아닌 사용자 공간에서 패킷마다 암호화를 하므로 같은 트래픽에 CPU를 더 쓰고, 전송 계층 헤더까지 암호화되어 기존 패킷 분석 도구로 보기 어렵습니다(qlog 같은 전용 로그를 씁니다). 도입 효과는 평균이 아니라 망 종류별 분위수로 비교해야 보입니다.',
    qa: [
      ['HTTP/2가 이미 멀티플렉싱을 하는데 HTTP/3가 왜 필요했나요?', 'HTTP/2는 TCP 연결 하나 위에 여러 스트림을 올립니다. TCP는 연결 전체를 하나의 바이트 줄로 보고 순서대로만 전달하므로, 패킷 하나가 유실되면 재전송이 올 때까지 뒤따라온 모든 스트림의 데이터가 커널 버퍼에 묶입니다. HTTP/3는 전송 계층을 QUIC으로 바꿔 스트림마다 순서를 따로 관리하므로 유실의 영향이 그 스트림에만 미칩니다. 여기에 연결 수립 왕복 감소와 연결 이전이 더해집니다.'],
      ['QUIC은 왜 TCP를 개선하지 않고 UDP 위에 새로 만들었나요?', 'TCP는 운영체제 커널과 전 세계의 방화벽·NAT 같은 중간 장비에 구현되어 있어, 동작을 바꾸려면 그 모두가 업데이트되어야 합니다. 사실상 바꿀 수 없습니다. UDP는 어디서나 통과되는 최소한의 프로토콜이라, 그 위에 신뢰성과 혼잡 제어를 애플리케이션 라이브러리로 구현하면 브라우저와 서버 업데이트만으로 배포하고 개선할 수 있습니다. 헤더 대부분을 암호화해 중간 장비가 간섭하지 못하게 한 것도 같은 이유입니다.'],
      ['HTTP/3를 켜면 항상 빨라지나요?', '아닙니다. 이득은 패킷 손실이 있거나 왕복 시간이 긴 망, 네트워크가 자주 바뀌는 모바일 환경에 집중됩니다. 손실이 거의 없는 환경에서는 HTTP/2와 비슷하고, 서버 CPU 사용량은 오히려 늘 수 있습니다. UDP가 차단된 망에서는 HTTP/2로 되돌아가므로 두 경로를 모두 유지해야 하고, 효과는 망 종류별 p95·p99 지연으로 측정합니다.'],
    ],
    dx: {
      cat: ['slow', 'flaky'], concept: 'TCP 수준 Head-of-Line Blocking과 연결 재수립 비용',
      symptoms: ['모바일이나 손실이 있는 망에서만 페이지의 여러 리소스가 동시에 멈칫한다', '평균 응답 시간은 괜찮은데 p99만 유독 길다', 'Wi-Fi와 이동통신망이 바뀌는 순간 진행 중이던 요청이 실패하거나 한참 멈춘다', '개발자 도구의 Protocol 열에 h3가 나오길 기대했는데 h2만 보인다'],
      check: '개발자 도구 Network 탭의 Protocol 열(h2/h3)을 봅니다. 패킷 손실을 1~2% 넣은 조건에서 두 프로토콜의 p95 로딩 시간을 비교하고, 응답의 <code>Alt-Svc</code> 헤더와 UDP 443 차단 여부를 확인합니다.',
      fix: 'CDN·로드 밸런서에서 HTTP/3를 켜고 UDP 443을 엽니다. HTTP/2 폴백은 그대로 둡니다. 근본적으로는 요청 수와 왕복 수 자체를 줄입니다.',
    },
  });

  /* ---------- TLS 핸드셰이크 ---------- */
  const OW = 25, TLS_TOTAL = 150;
  const tlsRun = (v13) => (t) => {
    t.m['첫 접속 왕복 수'] = 0; t.m['재접속 왕복 수'] = undefined;
    let items = [], now = 0, phase = '첫 접속', have = {};
    const snap = () => [
      { type: 'timeline', total: TLS_TOTAL, title: `${phase} — 시간 축 → (가정: 편도 ${OW}ms · TCP 연결은 이미 맺은 상태에서 0ms)`, items: items.map((x) => ({ ...x })) },
      { type: 'cells', title: '이 연결에서 지금까지 확보한 것 (요청을 보내기 전에 셋 다 필요)', items: [
        { id: 'c', v: '암호 방식', sub: have.c ? '합의됨' : '미정', s: have.c ? 'done' : 'hole', gap: true },
        { id: 'k', v: '세션 키', sub: have.k ? '공유됨' : '없음', s: have.k ? 'done' : 'hole', gap: true },
        { id: 'i', v: '서버 신원', sub: have.i ? '확인됨' : '미확인', s: have.i ? 'done' : 'hole' },
      ] },
    ];
    const fly = (id, label, text, kind) => { items.forEach((x) => { if (x.s === 'active') x.s = x.kind; }); items.push({ id, label, start: now, len: OW, s: 'active', kind: kind || '', text: text || '' }); now += OW; };
    const again = () => { items = []; now = 0; have = {}; phase = '재접속'; t.m['재접속 왕복 수'] = 0; };
    const settle = () => items.forEach((x) => { if (x.s === 'active') x.s = x.kind; });

    if (!v13) {
      t.step(1, `HTTPS 연결을 열려면 세 가지가 필요합니다. 어떤 <b>암호 방식</b>을 쓸지 합의하고, 상대가 <b>진짜 서버</b>인지 확인하고, 둘만 아는 <b>세션 키</b>를 만드는 것입니다.`, snap());
      fly('f1', '→ ClientHello');
      t.step(2, `브라우저 → 서버: <code>ClientHello</code>. 쓸 수 있는 TLS 버전과 암호 방식 목록, 그리고 난수를 보냅니다. 아직 암호화되지 않은 평문입니다.`, snap());
      fly('f2', '← ServerHello', '인증서'); have.c = true; t.m['첫 접속 왕복 수'] = 1;
      t.step(3, `서버 → 브라우저: 암호 방식을 하나 골라 답하고, <b>인증서</b>와 키 교환용 공개값(서버의 서명 포함)을 보냅니다. 왕복 1번이 끝났습니다.`, snap());
      have.i = true;
      t.step(4, `브라우저가 인증서를 검증합니다. 신뢰하는 기관이 발급했는지, 도메인이 맞는지, 만료되지 않았는지, 서명이 맞는지 봅니다. 이제 상대가 진짜 서버임을 압니다.`, snap());
      fly('f3', '→ 키 교환'); have.k = true;
      t.step(5, `브라우저 → 서버: 자기 쪽 공개값을 보냅니다. 양쪽이 서로의 공개값으로 <b>같은 세션 키</b>를 계산합니다. 키 자체는 한 번도 전선을 지나가지 않습니다.`, snap());
      fly('f4', '← Finished'); t.m['첫 접속 왕복 수'] = 2;
      t.step(6, `서버의 <code>Finished</code>를 기다립니다. 지금까지 주고받은 내용이 중간에 바뀌지 않았음을 서로 확인하는 절차입니다. 왕복 2번이 끝났습니다.`, snap());
      fly('f5', '→ GET /', '요청', 'done');
      t.step(7, `<b>${now - OW}ms</b>가 지나서야 첫 HTTP 요청이 출발합니다. TCP 핸드셰이크까지 합치면 요청 전에 왕복 3번입니다.`, snap());
      again();
      t.step(9, `잠시 뒤 연결이 끊겨 다시 접속합니다. 브라우저는 지난 연결에서 받은 <b>세션 티켓</b>을 갖고 있습니다.`, snap());
      fly('r1', '→ Hello+티켓');
      t.step(10, `<code>ClientHello</code>에 티켓을 실어 보냅니다. 인증서 전송과 키 교환 계산을 건너뛰자는 제안입니다.`, snap());
      fly('r2', '← Finished'); have = { c: true, k: true, i: true }; t.m['재접속 왕복 수'] = 1;
      t.step(11, `서버가 티켓을 확인하고 지난 세션의 키 재료로 연결을 재개합니다. 계산은 줄었지만 <b>서버의 답을 기다려야</b> 하므로 왕복 1번은 그대로 듭니다.`, snap());
      fly('r3', '→ GET', '요청', 'done');
      t.step(12, `재접속에서는 ${now - OW}ms에 요청이 출발합니다.`, snap());
      settle();
      t.step(12, `TLS 1.2는 첫 접속에 왕복 <b>2번</b>, 재접속에 왕복 <b>1번</b>을 요청 전에 씁니다. 왕복 시간이 200ms인 해외 사용자에게는 각각 400ms, 200ms의 빈 화면입니다.`, snap());
      return;
    }
    t.step(1, `TLS 1.3이 하는 일은 같습니다. 달라진 것은 순서입니다. 서버의 답을 듣고 나서 키 교환을 시작하는 대신, <b>첫 메시지에 키 교환 값을 미리</b> 실어 보냅니다.`, snap());
    fly('f1', '→ Hello+키');
    t.step(2, `브라우저 → 서버: <code>ClientHello</code>에 암호 방식 목록과 함께 <b>키 교환 공개값(key_share)</b>을 넣습니다. 서버가 고를 방식을 예상해 미리 보내는 것입니다.`, snap());
    fly('f2', '← Hello+키', '인증서'); have.c = true; have.k = true; t.m['첫 접속 왕복 수'] = 1;
    t.step(3, `서버 → 브라우저: 암호 방식을 고르고 자기 공개값을 보냅니다. 이 시점에 양쪽 모두 <b>세션 키를 계산</b>할 수 있습니다.`, snap());
    t.step(4, `같은 응답에 인증서와 <code>Finished</code>가 <b>이미 암호화된 채로</b> 함께 옵니다. TLS 1.2에서는 인증서가 평문으로 지나갔습니다. 왕복 1번이 끝났습니다.`, snap());
    have.i = true;
    t.step(5, `브라우저가 인증서와 서명을 검증합니다. 세 가지가 모두 갖춰졌습니다.`, snap());
    fly('f3', '→ GET /', '요청', 'done');
    t.step(6, `브라우저의 <code>Finished</code>와 <b>첫 HTTP 요청을 함께</b> 보냅니다. ${now - OW}ms에 요청이 출발했습니다. TLS 1.2의 절반입니다.`, snap());
    again();
    t.step(8, `다시 접속합니다. 지난 연결에서 서버가 준 티켓으로부터 <b>미리 공유된 키(PSK)</b>를 만들 수 있습니다.`, snap());
    fly('r1', '→ Hello+GET', '0-RTT', 'done'); have = { c: true, k: true };
    t.step(10, `<code>ClientHello</code>와 함께, PSK로 암호화한 HTTP 요청을 <b>답을 기다리지 않고</b> 보냅니다. 요청 전 왕복이 0번입니다(0-RTT).`, snap());
    fly('r2', '← 응답'); have.i = true;
    t.step(11, `서버가 핸드셰이크를 마치면서 응답을 돌려줍니다. 첫 왕복에 응답까지 받았습니다.`, snap());
    settle();
    items.push({ id: 'x', label: '공격자: 복사본', start: 3 * OW, len: OW, s: 'bad', text: '재전송' });
    t.step(10, `주의할 점이 있습니다. 0-RTT 데이터는 이번 연결에서 서버가 새로 낸 값 없이 만든 키로 암호화됩니다. 누군가 이 첫 패킷을 가로채 <b>그대로 다시 보내면</b> 서버는 정상 요청과 구별하기 어렵습니다(재전송 공격).`, snap());
    t.step(13, `상품 조회는 두 번 실행되어도 괜찮지만 결제라면 두 번 결제됩니다. 그래서 0-RTT에는 여러 번 실행해도 결과가 같은 요청만 싣고, 서버는 그렇지 않은 요청에 <code>425 Too Early</code>로 "핸드셰이크가 끝난 뒤 다시 보내라"고 답합니다.`, snap());
    t.step(13, `TLS 1.3은 첫 접속에 왕복 <b>1번</b>, 재접속에 <b>0번</b>입니다. 빨라진 만큼 0-RTT에 무엇을 실을지는 애플리케이션이 책임져야 합니다.`, snap());
  };
  CS.add({
    id: 'tls-handshake', level: 'adv', topic: 'net',
    title: 'TLS 핸드셰이크: HTTPS 첫 요청 전에 오가는 것',
    summary: 'HTTPS 연결은 첫 요청을 보내기 전에 암호 방식을 합의하고, 인증서로 서버를 확인하고, 세션 키를 만듭니다. TLS 1.2는 이 과정에 왕복 2번이 들고, TLS 1.3은 메시지 순서를 바꿔 1번으로, 재접속은 0번으로 줄였습니다. 무엇이 오가는지와 줄어든 왕복의 대가를 따라가 봅니다.',
    headline: '첫 접속 왕복 수',
    verdict: '요청 전 왕복 수는 TLS 1.2가 첫 접속 2번·재접속 1번, TLS 1.3이 첫 접속 1번·재접속 0번입니다. 편도 25ms 가정에서 첫 요청이 100ms가 아닌 50ms에 출발합니다. 다만 0-RTT로 보낸 요청은 재전송 공격에 노출되므로 여러 번 실행해도 안전한 요청에만 써야 합니다.',
    variants: [
      {
        name: 'TLS 1.2', tone: 'bad', label: '왕복 2번',
        code: `// TLS 1.2 (ECDHE) — TCP 연결은 이미 맺은 상태
send(ClientHello, { ciphers, random });
recv(ServerHello, Certificate, ServerKeyExchange);
verify(certificate, signature);
send(ClientKeyExchange, Finished);
recv(Finished);
send(encrypt('GET / HTTP/1.1'));

// 재접속: 지난 세션의 티켓으로 재개
send(ClientHello, { sessionTicket });
recv(ServerHello, Finished);
send(Finished, encrypt('GET /products'));`,
        notes: { 3: '왕복 1번째 끝', 4: '서버 신원 확인', 6: '왕복 2번째 끝', 11: '재개도 왕복 1번' }, run: tlsRun(false),
      },
      {
        name: 'TLS 1.3', tone: 'good', label: '왕복 1번 · 재접속 0번',
        code: `// TLS 1.3 — 키 교환 값을 첫 메시지에 실어 보냄
send(ClientHello, { ciphers, random, keyShare });
recv(ServerHello, { keyShare });
recv(encrypted(Certificate, Finished));
verify(certificate, signature);
send(Finished, encrypt('GET / HTTP/1.1'));

// 재접속: 티켓에서 만든 키로 요청부터 보냄 (0-RTT)
send(ClientHello, { keyShare, psk },
     earlyData('GET /products'));
recv(ServerHello, Finished, response);
// 서버: 반복 실행되면 안 되는 요청은 거절
if (req.isEarlyData && !isSafe(req)) reply(425);`,
        notes: { 2: '키 교환을 미리 시작', 4: '인증서도 암호화', 6: '왕복 1번 뒤 요청', 10: '답을 기다리지 않음' }, run: tlsRun(true),
      },
    ],
    points: [
      '핸드셰이크가 하는 일은 셋입니다. <b>암호 방식 합의</b>, <b>키 교환</b>(양쪽이 공개값만 주고받아 같은 세션 키를 계산), <b>인증서 검증</b>(상대가 그 도메인의 진짜 주인인지 확인).',
      '비대칭 암호는 느리기 때문에 핸드셰이크에서 신원 확인과 키 합의에만 쓰고, 실제 데이터는 합의한 세션 키(대칭 키)로 암호화합니다.',
      'TLS 1.3(RFC 8446, 2018년. 2026년 7월 RFC 9846으로 개정됐고 버전 번호는 그대로입니다)은 왕복을 줄였을 뿐 아니라, 연결마다 새 임시 키를 쓰는 방식만 남겨 <b>서버의 개인 키가 나중에 유출돼도 과거 통신을 풀 수 없게</b> 했습니다(순방향 비밀성).',
      '가장 싼 핸드셰이크는 하지 않는 핸드셰이크입니다. 연결을 재사용하면(keep-alive, HTTP/2) 이 비용은 처음 한 번뿐입니다.',
    ],
    senior: '실무에서 TLS 비용은 대부분 암호 연산이 아니라 왕복 시간입니다. 사용자와 서버가 멀수록 커지므로, 사용자 가까이에서 TLS를 끝내는 CDN·엣지가 효과적입니다. TLS 1.3에서도 왕복이 늘어나는 경우가 있습니다. 클라이언트가 미리 보낸 키 교환 방식을 서버가 지원하지 않으면 다시 요청하느라(HelloRetryRequest) 1번이 더 들고, 인증서 체인이 너무 크면 한 번에 보낼 수 있는 양을 넘겨 추가 왕복이 생깁니다. 0-RTT는 CDN 설정에서 켤 수 있지만, 켜기 전에 "두 번 실행되면 안 되는 요청"이 무엇인지부터 정리하고 서버가 <code>Early-Data</code> 헤더를 보고 425로 거절할 수 있어야 합니다(RFC 8470). 2026년의 큰 변화는 양자 내성 키 교환입니다. 기존 X25519에 ML-KEM을 결합한 하이브리드 방식(X25519MLKEM768)이 2026년 8월 RFC 10024로 표준화됐고, 주요 브라우저가 기본으로 사용합니다. 지금 가로챈 암호문을 나중에 양자 컴퓨터로 푸는 공격에 대비하는 것으로, 왕복 수는 그대로지만 ClientHello가 1KB 넘게 커져 패킷 하나에 들어가지 않으므로 오래된 방화벽·프록시에서 연결이 실패하는 사례가 있습니다. 인증서 서명은 아직 기존 알고리즘입니다. 측정은 <code>curl -w "%{time_connect} %{time_appconnect}"</code>로 TCP와 TLS 구간을 나눠 봅니다.',
    qa: [
      ['TLS 핸드셰이크에서 어떤 일이 일어나는지 설명해 보세요.', '클라이언트가 지원하는 암호 방식과 난수를 보내고, 서버가 방식을 골라 인증서와 키 교환용 공개값을 보냅니다. 클라이언트는 인증서의 발급 기관·도메인·유효 기간·서명을 검증해 서버의 신원을 확인하고, 자기 공개값을 보냅니다. 양쪽은 서로의 공개값으로 같은 세션 키를 계산하고, Finished 메시지로 지금까지의 대화가 변조되지 않았음을 확인한 뒤 그 키로 데이터를 암호화합니다.'],
      ['TLS 1.3은 1.2보다 왜 빠르고, 0-RTT의 위험은 무엇인가요?', 'TLS 1.2는 서버가 암호 방식을 고른 뒤에야 키 교환을 시작해 왕복 2번이 듭니다. TLS 1.3은 클라이언트가 첫 메시지에 키 교환 값을 미리 넣어 왕복 1번으로 끝냅니다. 재접속 때는 이전 세션에서 받은 키로 첫 패킷에 요청을 실을 수 있는데(0-RTT), 이 데이터는 공격자가 복사해 다시 보내도 서버가 구별하기 어렵습니다. 그래서 조회처럼 반복 실행해도 안전한 요청에만 쓰고, 서버는 그 외 요청을 425 Too Early로 거절합니다.'],
      ['HTTPS는 왜 대칭 키와 비대칭 키를 함께 쓰나요?', '비대칭 암호는 키를 미리 공유하지 않아도 되고 신원 증명(서명)이 가능하지만 느립니다. 대칭 암호는 빠르지만 양쪽이 같은 키를 안전하게 나눠 가져야 합니다. 그래서 핸드셰이크에서 비대칭 방식으로 서버를 인증하고 세션 키를 합의한 다음, 실제 데이터는 대칭 키로 암호화합니다.'],
    ],
    dx: {
      cat: ['slow', 'data'], concept: 'TLS 핸드셰이크 왕복 비용과 0-RTT 재전송',
      symptoms: ['첫 요청만 유독 느리고 같은 연결의 다음 요청은 빠르다', '개발자 도구 Timing의 SSL 구간이 왕복 시간의 2배쯤 된다', '서버에서 먼 지역의 사용자만 연결 수립이 수백 ms 걸린다', '0-RTT를 켠 뒤 같은 요청이 드물게 두 번 처리된다'],
      check: '<code>curl -w</code>의 time_connect와 time_appconnect 차이로 TLS 구간을 재고, <code>openssl s_client</code>나 개발자 도구 Security 탭에서 협상된 TLS 버전을 확인합니다. 중복 처리는 서버 로그에서 <code>Early-Data: 1</code> 헤더가 붙은 요청을 찾습니다.',
      fix: 'TLS 1.3을 켜고 연결을 재사용합니다. 먼 사용자는 CDN에서 TLS를 끝냅니다. 0-RTT는 멱등한 요청에만 허용하고 나머지는 425로 거절합니다.',
    },
  });

  /* ---------- CORS와 사전 요청 ---------- */
  const corsRun = (maxAge) => (t) => {
    t.m['OPTIONS 요청 수'] = 0; t.m['네트워크 왕복 수'] = 0; t.m['브라우저가 막은 응답'] = 0;
    const rows = [];
    let cache = null;
    const SEND = maxAge ? 12 : 11;
    const snap = () => [
      { type: 'timeline', total: 8, title: '브라우저 ↔ api.example.com — 한 줄이 왕복 1번, 막대 글자는 응답과 JS 전달 여부 (가로 간격은 실제 시간과 무관)', items: rows.map((r) => ({ ...r })) },
      { type: 'cells', title: '브라우저의 사전 요청 캐시', items: cache ? [{ id: 'c', v: 'PUT /api/cart 허용', ...cache }] : [] },
    ];
    const trip = (label, text, kind) => { rows.forEach((r) => { if (r.s === 'active') r.s = r.kind; }); rows.push({ id: rows.length, label, start: rows.length, len: 1, s: 'active', kind, text }); t.m['네트워크 왕복 수']++; };

    t.step(1, `페이지는 <code>https://app.example.com</code>, API는 <code>https://api.example.com</code>에 있습니다. 스킴·호스트·포트 중 하나라도 다르면 <b>다른 출처</b>입니다. 브라우저는 기본적으로 다른 출처의 응답을 JS가 읽지 못하게 막고(동일 출처 정책), 서버가 헤더로 허락한 경우만 풀어 줍니다. 그 허락의 규칙이 CORS입니다.`, snap());
    trip('evil: GET', '200', 'bad');
    t.step(8, `먼저 엉뚱한 사이트 <code>evil.example</code>의 스크립트가 이 API에 GET을 보냅니다. GET은 "단순 요청"이라 브라우저가 <b>묻지 않고 바로 보냅니다.</b> 서버는 허용 목록에 없는 출처라 헤더를 붙이지 않지만, 요청 자체는 정상 처리해 200으로 응답합니다.`, snap());
    rows[0].text = '200 → 차단'; t.m['브라우저가 막은 응답']++;
    t.step(5, `응답이 브라우저에 도착했습니다. <code>Access-Control-Allow-Origin</code> 헤더가 없으므로 브라우저가 응답을 <b>JS에 넘기지 않고 버립니다.</b> 서버 로그에는 200 성공, 브라우저 콘솔에는 CORS 오류가 남습니다. 막은 쪽은 서버가 아니라 브라우저입니다.`, snap());
    trip('GET /products', '200 → JS', 'done');
    t.step(6, `이번에는 우리 페이지가 상품 목록을 GET합니다. 역시 단순 요청이라 바로 갑니다. 서버가 <code>Access-Control-Allow-Origin: https://app.example.com</code>을 붙였고, 브라우저가 페이지의 출처와 대조한 뒤 응답을 JS에 전달합니다.`, snap());
    for (let i = 1; i <= 3; i++) {
      const cached = maxAge && i > 1;
      if (i > 1 && !maxAge) cache = { sub: '만료됨 (5초 경과)', s: 'hole' };
      if (cached) cache = { sub: `${maxAge - (i - 1) * 30}초 남음`, s: 'done' };
      if (!cached) {
        trip('OPTIONS /cart', '204', i > 1 ? 'bad' : ''); t.m['OPTIONS 요청 수']++;
        t.step(9, i === 1 ? `장바구니 수정은 <code>PUT</code>에 <code>Content-Type: application/json</code>입니다. 단순 요청의 조건(GET·HEAD·POST, 폼 형식의 Content-Type)을 벗어나므로, 브라우저가 본 요청 전에 <code>OPTIONS</code>로 "이 출처가 이 메서드와 헤더로 보내도 됩니까"를 먼저 묻습니다. 코드에 없는 요청을 <b>브라우저가 스스로</b> 보내는 것입니다(사전 요청).`
          : `30초 뒤 ${i}번째 수정 — 허락을 기억한 시간이 지났으므로 브라우저가 <b>똑같은 OPTIONS를 또</b> 보냅니다.`, snap());
        if (i === 1) {
          cache = maxAge ? { sub: `${maxAge}초 동안 유효`, s: 'new' } : { sub: '5초 뒤 만료 (기본값)', s: 'new' };
          t.step(maxAge ? 11 : 10, maxAge ? `서버가 허용하는 메서드와 헤더를 답하면서 <code>Access-Control-Max-Age: ${maxAge}</code>을 붙입니다. 브라우저가 이 허락을 <b>${maxAge / 60}분 동안 기억</b>합니다.`
            : `서버가 허용하는 메서드와 헤더를 답합니다. <code>Access-Control-Max-Age</code>가 없으므로 브라우저는 이 허락을 <b>기본값인 5초 동안만</b> 기억합니다.`, snap());
        }
      }
      trip('PUT /cart', '200 → JS', 'done');
      t.step(cached ? 8 : SEND, cached ? `30초 뒤 ${i}번째 수정 — 캐시에 허락이 남아 있습니다. <b>OPTIONS 없이</b> PUT만 보냅니다. 왕복 1번.`
        : i === 1 ? `허락을 받았으므로 이제 본 요청 PUT을 보냅니다. 수정 한 번에 왕복이 2번 들었습니다.` : `그다음에야 PUT이 갑니다. 이번에도 왕복 2번입니다.`, snap());
    }
    rows.forEach((r) => { if (r.s === 'active') r.s = r.kind; });
    t.step(8, maxAge ? `요청 5건에 왕복 <b>${t.m['네트워크 왕복 수']}번</b>, 사전 요청은 처음 한 번뿐입니다. 서버 코드 한 줄로 수정 요청의 지연이 절반이 됐습니다.`
      : `요청 5건에 왕복 <b>${t.m['네트워크 왕복 수']}번</b>. 그중 ${t.m['OPTIONS 요청 수']}번이 사전 요청입니다. 수정 요청은 매번 왕복 시간의 2배가 걸립니다.`, snap());
  };
  const CORS_HEAD = `const ALLOWED = ['https://app.example.com'];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (ALLOWED.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
  }
  if (req.method !== 'OPTIONS') return next();
  res.set('Access-Control-Allow-Methods', 'GET, PUT');
  res.set('Access-Control-Allow-Headers', 'Content-Type');`;
  CS.add({
    id: 'cors-preflight', level: 'mid', topic: 'net',
    title: 'CORS와 사전 요청: 서버는 응답했는데 브라우저가 막는다',
    summary: '브라우저는 페이지와 출처가 다른 서버의 응답을 JS가 읽지 못하게 막습니다. 서버가 응답 헤더로 허락하면 풀리고, 이 규칙이 CORS입니다. 요청의 종류에 따라 브라우저가 본 요청 전에 OPTIONS로 먼저 물어보는데, 이 사전 요청을 캐시하지 않으면 모든 수정 요청의 왕복이 2배가 됩니다.',
    headline: 'OPTIONS 요청 수',
    verdict: '같은 요청 5건에 Max-Age가 없으면 사전 요청 3번을 포함해 왕복 8번, Access-Control-Max-Age: 600을 주면 사전 요청 1번에 왕복 6번입니다. 그리고 두 경우 모두 허용되지 않은 출처의 GET은 서버가 200으로 처리했고, 응답을 버린 것은 브라우저였습니다. CORS는 서버를 지키는 방화벽이 아니라 브라우저가 응답을 넘겨줄지 정하는 규칙입니다.',
    variants: [
      {
        name: '사전 요청을 매번', tone: 'bad', label: 'Max-Age 없음',
        code: `${CORS_HEAD}
  res.sendStatus(204);
});`,
        notes: { 5: '허용한 출처에만 헤더', 8: '본 요청은 그대로 처리', 11: '기억 시간 지정 없음 → 5초' }, run: corsRun(0),
      },
      {
        name: '사전 요청 캐시', tone: 'good', label: 'Max-Age: 600',
        code: `${CORS_HEAD}
  res.set('Access-Control-Max-Age', '600');
  res.sendStatus(204);
});`,
        notes: { 5: '허용한 출처에만 헤더', 8: '본 요청은 그대로 처리', 11: '10분 동안 다시 묻지 않음' }, run: corsRun(600),
      },
    ],
    points: [
      '<b>출처</b>는 스킴 + 호스트 + 포트입니다. <code>app.example.com</code>과 <code>api.example.com</code>, <code>localhost:3000</code>과 <code>localhost:8080</code>은 서로 다른 출처입니다.',
      '동일 출처 정책은 <b>브라우저만의 규칙</b>입니다. curl, Postman, 서버 간 호출에는 없습니다. "Postman에서는 되는데 브라우저에서만 안 된다"의 이유입니다.',
      '<b>단순 요청</b>(GET·HEAD·POST이면서 Content-Type이 폼 형식이거나 text/plain이고 사용자 정의 헤더가 없음)은 바로 보내고 응답만 검사합니다. JSON 본문, PUT·DELETE, <code>Authorization</code> 같은 헤더가 붙으면 <b>사전 요청</b>이 먼저 갑니다.',
      '<code>Access-Control-Max-Age</code>가 없으면 사전 요청 결과는 5초만 기억됩니다. 값을 줘도 브라우저마다 상한이 있습니다(Chromium 계열 2시간, Firefox 24시간).',
    ],
    senior: 'CORS 오류의 절반은 CORS 문제가 아닙니다. 게이트웨이나 프록시가 낸 401·502·504 응답에는 CORS 헤더가 없어서, 브라우저 콘솔에는 진짜 원인 대신 "blocked by CORS policy"만 보입니다. Network 탭에서 실제 상태 코드를 먼저 확인하세요. 보안 쪽으로는 CORS를 방어 수단으로 착각하지 않는 것이 중요합니다. 단순 요청은 서버에 도착해 실행된 뒤에 응답만 가려지므로, 상태를 바꾸는 요청을 CORS로 막을 수는 없고 SameSite 쿠키나 CSRF 토큰이 따로 필요합니다. 쿠키를 함께 보내는 요청(<code>credentials: "include"</code>)에는 <code>Access-Control-Allow-Origin: *</code>를 쓸 수 없고, 그렇다고 요청의 Origin을 검사 없이 그대로 돌려주면 모든 사이트에 사용자 권한을 내주는 취약점이 됩니다. 허용 목록과 대조하고, 출처에 따라 응답 헤더가 달라지면 <code>Vary: Origin</code>을 붙여 CDN이 다른 출처의 응답을 재사용하지 않게 합니다. 성능 쪽에서는 사전 요청 캐시가 <b>URL마다 따로</b>라는 점이 함정입니다. <code>/cart/1</code>, <code>/cart/2</code>처럼 경로에 id가 들어가면 Max-Age를 줘도 URL마다 사전 요청이 나갑니다. 사전 요청을 아예 없애려면 API를 같은 출처의 경로(<code>/api</code>)로 리버스 프록시하는 방법이 가장 확실합니다.',
    qa: [
      ['CORS가 무엇이고, 왜 Postman에서는 되는 요청이 브라우저에서는 막히나요?', '브라우저는 동일 출처 정책에 따라 다른 출처에서 온 응답을 JS가 읽지 못하게 합니다. 로그인된 사용자의 브라우저를 이용해 악성 페이지가 다른 사이트의 데이터를 읽어 가는 것을 막기 위해서입니다. CORS는 서버가 응답 헤더로 "이 출처는 읽어도 된다"고 알려 그 제한을 푸는 규칙입니다. 이 검사는 브라우저가 하는 것이므로 Postman이나 서버 간 호출에는 적용되지 않습니다. 서버는 요청을 정상 처리했고 브라우저가 응답 전달을 막은 것입니다.'],
      ['사전 요청(preflight)은 언제 발생하고, 줄이려면 어떻게 하나요?', '단순 요청의 조건을 벗어날 때 발생합니다. PUT·DELETE 같은 메서드, application/json 같은 Content-Type, Authorization 같은 사용자 지정 헤더가 대표적입니다. 브라우저가 OPTIONS로 메서드와 헤더의 허용 여부를 먼저 묻고, 허락되면 본 요청을 보냅니다. 줄이려면 Access-Control-Max-Age로 결과를 캐시하거나, API를 같은 출처로 프록시해 교차 출처 요청 자체를 없앱니다.'],
      ['CORS를 설정하면 CSRF 공격을 막을 수 있나요?', '막지 못합니다. 폼 전송 같은 단순 요청은 사전 요청 없이 서버에 도착해 실행되고, CORS는 그 응답을 스크립트가 읽는 것만 막습니다. 송금 같은 상태 변경은 이미 일어난 뒤입니다. CSRF는 SameSite 쿠키, CSRF 토큰, Origin 헤더 검증처럼 서버가 요청을 거부하는 장치로 막아야 합니다.'],
    ],
    dx: {
      cat: ['crash', 'slow'], concept: '동일 출처 정책과 CORS 사전 요청',
      symptoms: ['Postman이나 curl로는 되는 API가 브라우저에서만 실패한다', '콘솔에 "blocked by CORS policy"가 뜨는데 서버 로그에는 200이 찍혀 있다', 'Network 탭에 API 호출마다 OPTIONS 요청이 짝으로 붙어 있다', '로컬에서는 되던 호출이 도메인을 나눠 배포한 뒤부터 실패한다'],
      check: 'Network 탭에서 실패한 요청의 실제 상태 코드와 응답 헤더(<code>Access-Control-Allow-Origin</code>)를 봅니다. OPTIONS 요청이 몇 번 나가는지, 그 응답에 <code>Access-Control-Max-Age</code>가 있는지 확인합니다.',
      fix: '서버가 허용 목록의 출처에 CORS 헤더를 붙이게 하고(오류 응답 포함), 사전 요청 응답에 Max-Age를 줍니다. 가능하면 API를 같은 출처로 프록시합니다.',
    },
  });

  /* ---------- 로드 밸런싱 ---------- */
  const LB_REQS = [7, 1, 1, 7, 1, 1, 7, 1, 1];
  const lbRun = (lc) => (t) => {
    t.m['가장 긴 응답 시간 (틱)'] = 0; t.m['대기 시간 합계 (틱)'] = 0; t.m['한 서버의 최대 연결 수'] = 0;
    const srv = [[], [], []], freeAt = [0, 0, 0], done = [];
    let tick = 0, cur = -1, pick = null, rr = 0;
    const sweep = () => srv.forEach((q, s) => { srv[s] = q.filter((r) => { if (r.end > tick) return true; done.push(r); return false; }); });
    const snap = () => [
      { type: 'cells', title: '들어오는 요청 (1틱에 하나씩) — 아래 숫자는 처리에 걸리는 시간', items: LB_REQS.map((d, i) => ({ id: i, v: `#${i + 1}`, sub: `${d}틱`, s: i === cur ? 'active' : i < cur || cur < 0 && tick ? 'dim' : d > 1 ? 'cmp' : '' })) },
      { type: 'buckets', active: pick, title: `서버 0 ~ 2에 걸려 있는 연결 (지금 ${tick}틱) — 노란 칸은 처리 중, 붉은 칸은 앞 요청이 끝나기를 기다리는 중`,
        buckets: srv.map((q) => q.map((r) => ({ id: r.id, v: `#${r.id} · ${r.d}틱`, s: r.start <= tick ? 'active' : 'bad' }))) },
      { type: 'cells', title: '끝난 요청의 응답 시간 (도착부터 완료까지)', items: done.map((r) => ({ id: r.id, v: `${r.end - r.at}틱`, sub: `#${r.id}`, s: r.start > r.at ? 'bad' : 'done' })) },
    ];
    t.step(lc ? 1 : 2, lc ? `서버 3대, 서버 하나는 한 번에 요청 하나를 처리합니다. 로드 밸런서가 서버마다 <b>지금 처리 중인 연결 수</b>를 세어 둡니다. 같은 요청 9개가 들어옵니다.`
      : `서버 3대, 서버 하나는 한 번에 요청 하나를 처리합니다. 요청 9개가 1틱에 하나씩 들어오는데, 대부분은 1틱이면 끝나고 <b>세 번에 한 번은 7틱짜리 무거운 요청</b>입니다(원리를 보이기 위해 맞춘 입력입니다).`, snap());
    LB_REQS.forEach((d, i) => {
      tick = i; cur = i; sweep();
      const load = srv.map((q) => q.length);
      const s = lc ? load.indexOf(Math.min(...load)) : rr++ % 3;
      const start = Math.max(tick, freeAt[s]), r = { id: i + 1, d, at: tick, start, end: start + d };
      freeAt[s] = r.end; srv[s].push(r); pick = s;
      t.m['대기 시간 합계 (틱)'] += start - tick;
      t.m['가장 긴 응답 시간 (틱)'] = Math.max(t.m['가장 긴 응답 시간 (틱)'], r.end - tick);
      t.m['한 서버의 최대 연결 수'] = Math.max(t.m['한 서버의 최대 연결 수'], srv[s].length);
      const wait = start - tick, heavy = d > 1;
      if (lc) t.step(4, `${tick}틱 — #${r.id}(${d}틱) 도착. 연결 수는 서버 0: ${load[0]}, 서버 1: ${load[1]}, 서버 2: ${load[2]}. ${heavy && i ? `가장 한가한 <b>서버 ${s}</b>로 보냅니다. 무거운 요청이 서로 다른 서버로 흩어집니다.` : `가장 적은 <b>서버 ${s}</b>로 보냅니다.${i === 1 ? ' 서버 0은 아직 #1을 처리 중이라 피했습니다.' : ''}`}`, snap());
      else t.step(5, `${tick}틱 — #${r.id}(${d}틱) 도착. 순서대로 <b>서버 ${s}</b> 차례입니다. ${wait ? `서버 ${s}은 아직 무거운 요청을 처리 중이라 <b>${wait}틱을 기다려야</b> 합니다. 옆 서버들은 비어 있습니다.` : heavy ? '서버가 비어 있어 바로 처리를 시작합니다.' : '바로 처리하고 1틱 뒤에 끝납니다.'}`, snap());
    });
    cur = -1; pick = null;
    const ends = [...new Set(srv.flat().map((r) => r.end))].sort((a, b) => a - b);
    for (const e of ends) {
      const fin = srv.flat().filter((r) => r.end === e);
      tick = e; sweep();
      t.step(lc ? 11 : 0, `${e}틱 — ${fin.map((r) => `#${r.id}`).join(', ')} 완료${fin.some((r) => r.start > r.at) ? ` (도착부터 ${fin[0].end - fin[0].at}틱. 그중 ${fin[0].start - fin[0].at}틱은 줄 서서 기다린 시간)` : ''}.${srv.flat().length ? ' 남은 요청은 아직 처리 중입니다.' : ''}`, snap());
    }
    t.step(lc ? 4 : 6, lc ? `어떤 요청도 기다리지 않았고 가장 긴 응답이 <b>${t.m['가장 긴 응답 시간 (틱)']}틱</b>(처리 시간 그대로)입니다. 요청의 무게는 몰라도, "아직 안 끝난 연결이 많은 서버는 바쁘다"는 신호만으로 고르게 나뉘었습니다.`
      : `요청 <b>수</b>는 서버마다 3개씩 똑같이 나눴지만 무거운 요청 3개가 전부 서버 0에 걸렸습니다. 가장 긴 응답이 <b>${t.m['가장 긴 응답 시간 (틱)']}틱</b>, 기다린 시간이 모두 ${t.m['대기 시간 합계 (틱)']}틱입니다. 그동안 나머지 두 서버는 놀고 있었습니다.`, snap());
  };
  CS.add({
    id: 'load-balancing', level: 'mid', topic: 'net',
    title: '로드 밸런싱: 라운드 로빈 vs 최소 연결',
    summary: '서버를 여러 대 두면 누군가는 요청을 나눠 줘야 합니다. 차례대로 돌아가며 주는 라운드 로빈은 요청 수를 똑같이 나누지만, 요청마다 처리 시간이 다르면 한 서버에만 일이 쌓일 수 있습니다. 지금 처리 중인 연결이 가장 적은 서버를 고르는 방식과 같은 입력으로 비교합니다.',
    headline: '가장 긴 응답 시간 (틱)',
    verdict: '같은 요청 9개에서 라운드 로빈은 무거운 요청 셋을 한 서버에 몰아 가장 긴 응답이 15틱, 대기 합계가 12틱입니다. 최소 연결은 무거운 요청을 서버마다 하나씩 흩어 대기 0틱, 가장 긴 응답이 처리 시간 그대로인 7틱입니다. 평균 부하는 같아도 분배 방식이 꼬리 지연을 결정합니다.',
    variants: [
      {
        name: '라운드 로빈', tone: 'bad', label: '차례대로',
        code: `const servers = ['s0', 's1', 's2'];
let i = 0;

function pick() {
  const server = servers[i];
  i = (i + 1) % servers.length;
  return server;
}

proxy.on('request', (req) => {
  forward(req, pick());
});`,
        notes: { 5: '서버 상태를 보지 않음', 6: '다음 차례로' }, run: lbRun(false),
      },
      {
        name: '최소 연결 (least connections)', tone: 'good', label: '덜 바쁜 서버로',
        code: `const active = { s0: 0, s1: 0, s2: 0 };

function pick() {
  return minBy(servers, (s) => active[s]);
}

proxy.on('request', async (req) => {
  const server = pick();
  active[server]++;
  await forward(req, server);
  active[server]--;
});`,
        notes: { 4: '처리 중인 연결이 가장 적은 서버', 9: '보낼 때 +1', 11: '응답이 끝나면 −1' }, run: lbRun(true),
      },
    ],
    points: [
      '<b>라운드 로빈</b>은 요청 "수"를 고르게 나눕니다. 요청의 무게가 비슷하고 서버 성능이 같으면 이것으로 충분하고, 가장 단순합니다. 성능이 다른 서버가 섞이면 가중치를 줍니다.',
      '<b>최소 연결</b>은 진행 중인 연결 수를 부하의 근삿값으로 씁니다. 처리 시간이 들쭉날쭉하거나 웹소켓처럼 오래 유지되는 연결이 섞일 때 유리합니다.',
      '<b>헬스 체크</b>: 로드 밸런서가 주기적으로 각 서버를 찔러 보고(능동), 실제 응답의 실패율도 관찰해(수동) 죽은 서버를 분배 대상에서 뺍니다. 이것이 없으면 서버 한 대가 죽었을 때 요청의 3분의 1이 계속 실패합니다.',
      '<b>L4 vs L7</b>: L4 로드 밸런서는 IP와 포트만 보고 TCP 연결 단위로 나눕니다. 빠르지만 내용을 모릅니다. L7은 HTTP를 이해해 경로·헤더·쿠키로 라우팅하고 요청 단위로 나누며, TLS 종료와 재시도도 맡습니다.',
    ],
    senior: '최소 연결에도 함정이 있습니다. 첫째, 오류를 즉시 돌려주는 고장 난 서버는 연결이 금방 끝나 "가장 한가한 서버"로 보이고, 트래픽을 빨아들여 장애를 키웁니다. 헬스 체크와 오류율 기반 제외가 함께 있어야 합니다. 둘째, 새로 투입된 서버는 연결이 0이라 요청이 한꺼번에 몰리는데, 캐시와 커넥션 풀이 덜 준비된 상태라 타임아웃이 납니다. 트래픽을 서서히 올리는 설정(slow start)을 씁니다. 셋째, 로드 밸런서가 여러 대면 각자 자기가 보낸 연결만 알기 때문에 전체 그림과 어긋납니다. 그래서 큰 시스템은 "무작위로 두 대를 뽑아 덜 바쁜 쪽"을 고르는 방식을 많이 씁니다. 계층도 중요합니다. HTTP/2나 gRPC는 연결 하나를 오래 열어 두고 요청 수천 개를 싣기 때문에, 연결 단위로 나누는 L4에서는 한 번 붙은 서버에 부하가 고정됩니다. 요청 단위로 나누는 L7 분배나 클라이언트 쪽 분배가 필요합니다. 헬스 체크의 깊이도 설계 대상입니다. 프로세스가 살아 있는지만 보면 DB에 못 붙는 서버로 계속 요청이 가고, DB까지 확인하게 만들면 DB가 잠깐 느려졌을 때 모든 서버가 동시에 빠져 전체가 멈춥니다. 관측은 평균이 아니라 서버별 연결 수·지연 분포와 p99로 합니다.',
    qa: [
      ['로드 밸런싱 알고리즘을 아는 대로 설명하고, 각각 언제 쓰는지 말해 보세요.', '라운드 로빈은 차례대로 나누며 요청의 무게가 비슷할 때 충분합니다. 가중 라운드 로빈은 서버 성능이 다를 때 씁니다. 최소 연결은 진행 중인 연결이 가장 적은 서버로 보내며 처리 시간 편차가 크거나 긴 연결이 있을 때 유리합니다. 해시 기반(IP 해시, 일관 해싱)은 같은 사용자나 같은 키를 항상 같은 서버로 보내야 할 때(세션, 캐시 적중률) 씁니다. 어떤 방식이든 헬스 체크로 죽은 서버를 빼는 것이 전제입니다.'],
      ['L4 로드 밸런서와 L7 로드 밸런서의 차이는 무엇인가요?', 'L4는 전송 계층에서 IP와 포트만 보고 TCP 연결(또는 UDP 흐름) 단위로 분배합니다. 패킷 내용을 해석하지 않아 빠르고 프로토콜에 상관없이 쓸 수 있습니다. L7은 HTTP를 해석해 URL 경로, 헤더, 쿠키에 따라 라우팅하고 요청 단위로 분배하며, TLS 종료, 재시도, 압축, 인증 같은 기능을 넣을 수 있습니다. 대신 연산이 더 듭니다. 긴 연결에 요청이 많이 실리는 HTTP/2·gRPC는 L7에서 나눠야 고르게 퍼집니다.'],
      ['서버 대수는 충분한데 특정 서버만 느립니다. 무엇을 확인하나요?', '서버별 연결 수와 요청 수, 지연 분포를 비교해 분배가 치우쳤는지 봅니다. 원인 후보는 처리 시간 편차를 무시하는 분배 방식, 오래 유지되는 연결(웹소켓·gRPC)의 쏠림, 세션 고정이나 해시 키의 편중, 방금 투입되어 준비가 덜 된 서버입니다. 분배 방식을 최소 연결 계열로 바꾸거나, 요청 단위 분배가 되는 계층으로 옮기거나, 무거운 요청을 별도 서버 풀이나 큐로 분리합니다.'],
    ],
    dx: {
      cat: ['slow', 'flaky'], concept: '요청 수는 고르지만 부하는 치우친 분배 (라운드 로빈의 한계, 헬스 체크 누락)',
      symptoms: ['서버 전체 평균 CPU는 낮은데 p99 응답 시간만 튄다', '서버 한 대만 연결 수와 CPU가 높고 나머지는 한가하다', '요청의 일정 비율(서버 수 분의 1)이 꾸준히 502·504로 실패한다', '배포나 서버 추가 직후 새 서버에서만 타임아웃이 난다'],
      check: '로드 밸런서 지표를 서버별로 쪼개 연결 수, 요청 수, 지연 분위수를 비교합니다. 실패가 특정 서버에만 몰리는지, 헬스 체크가 그 서버를 정상으로 보고 있는지 확인합니다.',
      fix: '처리 시간 편차가 크면 최소 연결 계열로 바꾸고, 헬스 체크와 느린 시작을 설정합니다. 긴 연결 프로토콜은 요청 단위(L7) 분배를 쓰고, 무거운 작업은 별도 풀이나 큐로 분리합니다.',
    },
  });
})();
