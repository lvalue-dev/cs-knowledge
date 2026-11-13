/* 자료구조 2: 블룸 필터, B-트리(트리 모양과 페이지 읽기), 펜윅 트리, 원형 버퍼 */
(function () {
  const CS = window.CS;

  /* ---------- 블룸 필터 ---------- */
  const BM = 16, DB_MS = 5;
  const hashA = (k) => { let h = 0; for (const c of k) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % BM; };
  const hashB = (k) => { let h = 2166136261; for (const c of k) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return h % BM; };
  const BF_STORED = ['mina', 'sora', 'jisu', 'leo'];
  const BF_REQ = ['dana', 'sora', 'ari', 'eun', 'hoon', 'rin'];
  const bfInit = (t) => { t.m['DB 조회 횟수'] = 0; t.m['결과가 없던 DB 조회'] = 0; t.m['필터가 걸러 낸 요청'] = 0; };
  CS.add({
    id: 'bloom-filter', level: 'mid', topic: 'ds',
    title: '블룸 필터: "확실히 없다"를 메모리만으로 답하기',
    summary: '없는 키를 묻는 요청은 캐시에도 걸리지 않아 매번 DB까지 갑니다. 블룸 필터는 키를 저장하지 않고 비트 몇 개만 켜 두었다가 "확실히 없다" 또는 "아마 있다"를 답합니다. 비트가 겹쳐 생기는 거짓 양성(없는데 있다고 답하는 경우)도 함께 봅니다.',
    headline: 'DB 조회 횟수',
    verdict: '요청 6건 중 DB까지 간 것은 6건에서 2건으로 줄었습니다. 2건 중 1건(hoon)은 다른 키들이 켜 둔 비트가 우연히 겹친 거짓 양성입니다. 필터는 "없다"는 틀리지 않고 "있다"만 가끔 틀리므로, "있다"가 나오면 원본에서 확인하면 됩니다.',
    variants: [
      {
        name: '매번 DB 조회', tone: 'bad', big: { time: '요청마다 디스크 조회', space: 'O(1)' },
        code: `async function find(key) {
  return db.get(key);   // 있든 없든 DB까지 간다
}

for (const key of requests) {
  await find(key);
}`,
        notes: { 2: '없는 키도 조회 비용은 같음' },
        run(t) {
          bfInit(t);
          const out = [];
          const snap = (cur, hit) => [
            { type: 'cells', hot: cur != null, title: `DB(디스크)에 저장된 아이디 — 조회 1번 ≈ ${DB_MS}ms로 가정`, items: BF_STORED.map((k) => ({ id: k, v: k, s: k === hit ? 'done' : cur != null ? 'cmp' : '' })) },
            { type: 'cells', title: '요청한 아이디와 응답', items: out.map((x) => ({ ...x })) },
          ];
          t.step(5, `아이디 ${BF_REQ.length}개가 차례로 조회됩니다. 이 중 실제로 저장된 것은 <b>sora 하나</b>뿐입니다.`, snap());
          for (const key of BF_REQ) {
            const has = BF_STORED.includes(key);
            out.push({ id: key, v: key, sub: '', s: 'active' });
            t.step(6, `<code>find('${key}')</code> — 있는지 없는지 알 방법이 없으니 DB에 물어봅니다.`, snap());
            t.m['DB 조회 횟수']++;
            if (!has) t.m['결과가 없던 DB 조회']++;
            Object.assign(out[out.length - 1], { sub: has ? 'DB 있음' : 'DB 없음', s: has ? 'done' : 'bad' });
            t.step(2, has
              ? `DB를 조회해 <b>${key}</b>를 찾았습니다. 이 조회는 필요한 조회였습니다.`
              : `DB를 조회했지만 <b>없습니다.</b> ${DB_MS}ms를 쓰고 얻은 답이 "없음"입니다. (헛걸음 ${t.m['결과가 없던 DB 조회']}번째)`, snap(key, has ? key : null));
          }
          t.step(7, `DB 조회 <b>${t.m['DB 조회 횟수']}번</b> 중 ${t.m['결과가 없던 DB 조회']}번이 "없음"이었습니다. 없는 키는 캐시에도 남지 않으므로, 같은 요청이 또 오면 또 DB까지 갑니다.`, snap());
        },
      },
      {
        name: '블룸 필터로 먼저 거르기', tone: 'good', big: { time: '해시 k번 + 가끔 DB', space: '키당 비트 몇 개' },
        code: `const bits = new Uint8Array(16);        // 전부 0
const hashes = [hashA, hashB];          // 해시 k = 2개
function add(key) {
  for (const h of hashes) bits[h(key) % 16] = 1;
}
function mightHave(key) {
  return hashes.every((h) => bits[h(key) % 16] === 1);
}
async function find(key) {
  if (!mightHave(key)) return null;     // 확실히 없다
  return db.get(key);                   // 아마 있다 → 확인
}`,
        notes: { 4: '키는 저장하지 않고 비트만 켬', 7: '하나라도 0이면 없는 키', 10: 'DB에 가지 않음' },
        run(t) {
          bfInit(t);
          const bits = Array(BM).fill(0), out = [];
          let added = 0;
          const snap = (probe = {}, fresh = []) => [
            { type: 'cells', compact: true, title: `비트 배열 ${BM}칸 (메모리) — 키는 없고 0과 1만 있습니다`, items: bits.map((b, i) => ({ id: i, v: b, sub: i, ptr: probe[i] || '', s: fresh.includes(i) ? 'new' : probe[i] ? (b ? 'done' : 'bad') : b ? 'cmp' : '' })) },
            out.length
              ? { type: 'cells', title: '요청한 아이디와 응답', items: out.map((x) => ({ ...x })) }
              : { type: 'cells', title: '필터에 넣은 아이디 (아래 숫자는 켠 비트 번호)', items: BF_STORED.slice(0, added).map((k) => ({ id: k, v: k, sub: `${hashA(k)}, ${hashB(k)}` })) },
          ];
          t.step(1, `비트 ${BM}개를 0으로 채웁니다. 아이디 문자열은 어디에도 저장하지 않습니다.`, snap());
          BF_STORED.forEach((key, n) => {
            const a = hashA(key), b = hashB(key);
            added = n + 1;
            if (n === 0) {
              bits[a] = 1;
              t.step(4, `<code>add('${key}')</code> — 첫 번째 해시가 <b>${a}</b>을 냅니다. ${a}번 비트를 켭니다.`, snap({ [a]: 'A' }, [a]));
              bits[b] = 1;
              t.step(4, `두 번째 해시는 <b>${b}</b>. ${b}번 비트도 켭니다. 키 하나가 비트 2개를 남겼습니다.`, snap({ [b]: 'B' }, [b]));
            } else {
              const was = [a, b].filter((x) => bits[x]);
              bits[a] = 1; bits[b] = 1;
              t.step(4, was.length
                ? `<code>add('${key}')</code> → ${a}번, ${b}번. <b>${was.join(', ')}번은 이미 켜져 있었습니다.</b> 비트는 누가 켰는지 기억하지 못하고, 여러 키가 같은 비트를 나눠 씁니다.`
                : `<code>add('${key}')</code> → ${a}번, ${b}번 비트를 켭니다.`, snap({ [a]: 'A', [b]: 'B' }, [a, b].filter((x) => !was.includes(x))));
            }
          });
          for (const key of BF_REQ) {
            const a = hashA(key), b = hashB(key), maybe = bits[a] && bits[b], has = BF_STORED.includes(key);
            out.push({ id: key, v: key, sub: '', s: 'active' });
            const last = out[out.length - 1];
            if (!maybe) {
              const zero = !bits[a] ? a : b;
              t.step(7, `<code>find('${key}')</code> — 비트 ${a}번, ${b}번을 봅니다. <b>${zero}번이 0</b>입니다. 넣은 적이 있다면 반드시 1이어야 하므로 ${bits[a] || bits[b] ? '(다른 하나가 1이어도) ' : ''}이 키는 넣은 적이 없습니다.`, snap({ [a]: 'A', [b]: 'B' }));
              t.m['필터가 걸러 낸 요청']++;
              Object.assign(last, { sub: '걸러 냄', s: 'done' });
              t.step(10, `<b>확실히 없습니다.</b> DB에 가지 않고 메모리 접근 두 번으로 답했습니다.`, snap({ [a]: 'A', [b]: 'B' }));
            } else {
              t.step(7, `<code>find('${key}')</code> — 비트 ${a}번, ${b}번이 <b>둘 다 1</b>입니다. 필터의 답은 "아마 있다"입니다. 확신할 수는 없습니다.`, snap({ [a]: 'A', [b]: 'B' }));
              t.m['DB 조회 횟수']++;
              if (!has) t.m['결과가 없던 DB 조회']++;
              Object.assign(last, { sub: has ? 'DB 있음' : 'DB 없음', s: has ? 'done' : 'bad' });
              t.step(11, has
                ? `DB에서 확인하니 <b>실제로 있습니다.</b> 필요한 조회였습니다.`
                : `DB에서 확인하니 <b>없습니다.</b> ${a}번은 leo가, ${b}번은 jisu가 켠 비트였습니다. 이것이 <b>거짓 양성</b>입니다. 결과는 틀리지 않았고, 조회 한 번을 낭비했을 뿐입니다.`, snap({ [a]: 'A', [b]: 'B' }));
            }
          }
          t.step(12, `요청 ${BF_REQ.length}건 중 ${t.m['필터가 걸러 낸 요청']}건을 메모리에서 끝냈고, DB 조회는 <b>${t.m['DB 조회 횟수']}번</b>(거짓 양성 ${t.m['결과가 없던 DB 조회']}번 포함)입니다.`, snap());
        },
      },
    ],
    points: [
      '답은 두 가지뿐입니다. 비트가 하나라도 0이면 <b>확실히 없다</b>, 전부 1이면 <b>아마 있다</b>. 거짓 음성(있는데 없다고 답함)은 생기지 않습니다.',
      '거짓 양성 비율은 비트 수와 해시 개수로 정합니다. 여기서는 키당 4비트라 높지만, 키당 약 10비트에 해시 7개를 쓰면 1% 안팎입니다. 키 길이와 무관하게 키당 10비트면 됩니다.',
      '비트를 여러 키가 나눠 쓰므로 <b>삭제할 수 없습니다.</b> 한 키의 비트를 끄면 다른 키까지 "없다"가 됩니다. 삭제가 필요하면 카운팅 블룸 필터나 쿠쿠 필터를 씁니다.',
      '넣은 키가 설계한 개수를 넘으면 비트가 대부분 1이 되어 거의 모든 요청에 "아마 있다"라고 답합니다. 예상 키 수로 크기를 정하고, 넘으면 다시 만듭니다.',
    ],
    senior: 'LSM 트리 기반 저장소(RocksDB, Cassandra 등)는 디스크 파일마다 블룸 필터를 두고, 키가 없는 파일은 읽지 않고 건너뜁니다. 애플리케이션에서는 존재하지 않는 ID를 계속 조회해 캐시를 뚫고 DB를 때리는 요청(캐시 관통)을 막는 데 씁니다. 다만 필터는 원본과 따로 관리해야 하는 사본입니다. 키를 추가할 때 필터에도 넣지 않으면 "있는데 없다"고 답하는 진짜 오류가 되고, 삭제가 잦으면 거짓 양성이 계속 늘어납니다. 지표로는 "필터가 통과시킨 요청 중 실제로 없던 비율"을 봅니다. 설계값보다 높으면 필터가 꽉 찬 것입니다. Redis는 8.0(2025년 5월 정식 출시)부터 블룸 필터 자료형을 별도 모듈 없이 기본 포함하므로, 여러 서버가 필터 하나를 공유해야 한다면 직접 구현하기 전에 검토할 만합니다.',
    qa: [
      ['블룸 필터는 왜 "없다"는 확실한데 "있다"는 확실하지 않습니까?', '키를 넣을 때 해시 k개가 가리키는 비트를 전부 1로 켭니다. 조회할 때 그중 하나라도 0이면 그 키를 넣은 적이 없다는 뜻이므로 "없다"는 틀릴 수 없습니다. 반대로 전부 1이어도 그 비트들을 서로 다른 키들이 켰을 수 있어서 "있다"는 추정입니다. 그래서 "아마 있다"가 나오면 원본에서 다시 확인합니다.'],
      ['Set이나 해시 테이블 대신 블룸 필터를 쓰는 이유는 무엇입니까?', '메모리입니다. 해시 테이블은 키 자체를 저장하므로 키가 1억 개면 수 GB가 필요하지만, 블룸 필터는 키 길이와 무관하게 키당 약 10비트(1억 개에 약 120MB)로 거짓 양성 1% 수준을 냅니다. 대신 저장된 키를 꺼내거나 나열할 수 없고, 삭제가 안 되며, 가끔 틀린 "있다"를 감수해야 합니다.'],
      ['거짓 양성 비율을 낮추려면 무엇을 조절합니까?', '비트 배열 크기 m, 해시 개수 k, 넣는 키 수 n의 관계로 정해집니다. 키당 비트 수(m/n)를 늘리면 비율이 내려가고, k는 (m/n)·ln 2 근처가 최적입니다. k를 너무 늘리면 비트가 빨리 채워져 오히려 나빠집니다. 운영 중에는 키 수가 설계값을 넘지 않는지 봐야 합니다.'],
    ],
    dx: {
      cat: ['slow'], concept: '없는 키 조회(캐시 관통)와 블룸 필터',
      symptoms: ['캐시 적중률이 낮은데, DB로 간 조회의 대부분이 결과 0행으로 끝난다', '존재하지 않는 ID를 대량으로 조회하는 트래픽(크롤러, 잘못된 클라이언트)이 올 때 DB 부하가 치솟는다', '키-값 저장소에서 없는 키를 읽을 때만 유독 디스크 읽기가 많다'],
      check: '조회 결과가 없던 요청의 비율과, 그 요청들이 DB까지 갔는지를 셉니다. "DB 조회 중 0행 비율"이 높으면 걸러 낼 대상이 있다는 뜻입니다.',
      fix: '조회 앞에 블룸 필터를 두어 확실히 없는 키를 메모리에서 끝냅니다. 키 수가 적다면 "없음" 결과를 짧은 TTL로 캐시하는 방법이 더 단순합니다.',
    },
  });

  /* ---------- B-트리: 트리 모양과 페이지 읽기 ---------- */
  const BT_N = 24, BT_TARGETS = [9, 22, 13];
  const bst = {}; // key → { left, right, depth }
  const bstBuild = (lo, hi, depth) => {
    if (lo > hi) return null;
    const mid = (lo + hi) >> 1;
    bst[mid] = { depth, left: bstBuild(lo, mid - 1, depth + 1), right: bstBuild(mid + 1, hi, depth + 1) };
    return mid;
  };
  const BST_ROOT = bstBuild(1, BT_N, 0);
  const BST_H = Math.max(...Object.values(bst).map((n) => n.depth)) + 1;
  const bstPos = (k) => ({ x: 17 + (k - 1) * 22, y: 18 + bst[k].depth * 36 });
  const BT_ROOT = { id: 'root', keys: [5, 10, 15, 20], kids: ['l0', 'l1', 'l2', 'l3', 'l4'] };
  const btPages = { root: BT_ROOT };
  BT_ROOT.kids.forEach((id, j) => { btPages[id] = { id, keys: [1, 2, 3, 4].map((x) => j * 5 + x), leaf: true, x: 56 + j * 107 }; });
  const btInit = (t) => { t.m['읽은 페이지 수'] = 0; t.m['키 비교 횟수'] = 0; };
  const ORD = ['첫째', '둘째', '셋째', '넷째', '다섯째'];
  CS.add({
    id: 'b-tree', level: 'adv', topic: 'ds',
    title: 'B-트리: 디스크 색인은 왜 이진 트리가 아닌가',
    summary: '디스크에 저장된 트리는 노드 하나를 볼 때마다 페이지 한 장을 읽어야 합니다. 같은 키 24개를 이진 탐색 트리와 B-트리로 만들어 놓고 같은 키 3개를 찾으면서, 키 비교 횟수와 읽은 페이지 수가 어떻게 달라지는지 봅니다.',
    headline: '읽은 페이지 수',
    verdict: '키 비교는 B-트리가 더 많이 했는데(12 대 18) 읽은 페이지 수는 12 대 6으로 절반입니다. 메모리 안의 비교는 나노초, 디스크 읽기는 그보다 수천~수만 배 느리므로 줄여야 하는 것은 비교가 아니라 페이지 읽기, 곧 트리의 높이입니다. 키가 1억 개면 이진 트리는 높이 약 27, 한 노드에 키 수백 개를 담는 B-트리는 높이 4 정도입니다.',
    variants: [
      {
        name: '이진 탐색 트리', tone: 'bad', label: '키 1개짜리 노드', big: { time: '페이지 읽기 log₂ n', space: 'O(n)' },
        code: `// 노드 하나 = 디스크 페이지 하나 (키 1개)
function find(key) {
  let node = readPage(rootId);
  while (node) {
    if (key === node.key) return node;
    const next = key < node.key ? node.left : node.right;
    node = next && readPage(next);
  }
  return null;
}`,
        notes: { 3: '디스크 읽기', 7: '한 층 내려갈 때마다 디스크 읽기' },
        run(t) {
          btInit(t);
          let path = [], cur = null, found = null, page = null;
          const snap = () => [
            {
              type: 'graph', title: `이진 탐색 트리 — 키 ${BT_N}개, 균형이 완벽해도 높이 ${BST_H}`, w: 540, h: 18 + (BST_H - 1) * 36 + 18, scale: 1.15,
              nodes: Object.keys(bst).map((k) => ({ id: +k, v: k, ...bstPos(+k), w: 21, h: 21, round: true, s: +k === found ? 'done' : +k === cur ? 'active' : path.includes(+k) ? 'cmp' : cur != null ? 'dim' : '' })),
              edges: Object.keys(bst).flatMap((k) => [bst[k].left, bst[k].right].filter((c) => c != null).map((c) => ({ a: +k, b: c, s: path.includes(+k) && (path.includes(c) || c === cur) ? 'active' : cur != null ? 'dim' : '' }))),
            },
            { type: 'cells', title: `방금 읽은 페이지에 든 키 — ${page == null ? '아직 없음' : '1개'}`, items: page == null ? [] : [{ id: 'k', v: page, s: page === found ? 'done' : 'cmp' }] },
          ];
          t.step(1, `키 1~${BT_N}을 균형 잡힌 이진 탐색 트리로 디스크에 저장했습니다. 노드마다 페이지 한 장을 차지하고, 키는 <b>한 장에 1개</b>입니다.`, snap());
          for (const key of BT_TARGETS) {
            path = []; cur = null; found = null; page = null;
            t.step(2, `<code>find(${key})</code> — 루트부터 내려갑니다.`, snap());
            let id = BST_ROOT;
            while (id != null) {
              cur = id; page = id;
              t.m['읽은 페이지 수']++;
              t.step(path.length ? 7 : 3, `페이지 한 장을 디스크에서 읽습니다(${t.m['읽은 페이지 수']}장째). 그 안에 든 키는 <b>${id}</b> 하나입니다.`, snap());
              t.m['키 비교 횟수']++;
              if (key === id) {
                found = id;
                t.step(5, `<b>${key}</b>를 찾았습니다. 비교 ${path.length + 1}번에 페이지도 <b>${path.length + 1}장</b> 읽었습니다. 비교 한 번이 곧 디스크 읽기 한 번입니다.`, snap());
                break;
              }
              path.push(id);
              t.step(6, `${key} ${key < id ? '&lt;' : '&gt;'} ${id} → ${key < id ? '왼쪽' : '오른쪽'} 자식으로 갑니다. 후보는 절반으로 줄었지만, 다음 키를 보려면 또 디스크를 읽어야 합니다.`, snap());
              id = key < id ? bst[id].left : bst[id].right;
            }
          }
          t.step(10, `키 3개를 찾는 데 페이지 <b>${t.m['읽은 페이지 수']}장</b>을 읽었습니다. 이진 트리는 한 번에 둘로만 갈라지므로 높이가 log₂ n으로 자랍니다.`, snap());
        },
      },
      {
        name: 'B-트리', tone: 'good', label: '키 여러 개짜리 노드', big: { time: '페이지 읽기 log_m n', space: 'O(n)' },
        code: `// 노드 하나 = 디스크 페이지 하나 (정렬된 키 여러 개)
function find(key) {
  let node = readPage(rootId);
  while (true) {
    let i = 0;   // 페이지 안의 비교는 메모리에서 끝난다
    while (i < node.keys.length && key > node.keys[i]) i++;
    if (node.keys[i] === key) return node;
    if (node.isLeaf) return null;
    node = readPage(node.children[i]);
  }
}`,
        notes: { 3: '디스크 읽기', 6: '디스크를 읽지 않는 비교', 9: '가지 하나만 골라 디스크 읽기' },
        run(t) {
          btInit(t);
          let path = [], cur = null, found = null, page = null, at = -1;
          const snap = () => [
            {
              type: 'graph', title: `B-트리 — 같은 키 ${BT_N}개, 한 페이지에 키 4개, 높이 2`, w: 540, h: 134, scale: 1.15,
              nodes: [{ ...BT_ROOT, x: 270 }, ...BT_ROOT.kids.map((k) => btPages[k])].map((p) => ({ id: p.id, v: p.keys.join(' '), x: p.x, y: p.leaf ? 104 : 22, w: 94, h: 28, s: p.id === found ? 'done' : p.id === cur ? 'active' : path.includes(p.id) ? 'cmp' : cur ? 'dim' : '' })),
              edges: BT_ROOT.kids.map((k) => ({ a: 'root', b: k, s: k === cur ? 'active' : cur ? 'dim' : '' })),
            },
            {
              type: 'cells', title: `방금 읽은 페이지에 든 키 — ${page ? page.keys.length + '개 (정렬되어 있음)' : '아직 없음'}`,
              items: page ? page.keys.map((k, i) => ({ id: k, v: k, ptr: i === at ? 'i' : '', s: at < 0 ? 'cmp' : i < at ? 'dim' : i === at ? (page.id === found ? 'done' : 'active') : '' })) : [],
            },
          ];
          t.step(1, `같은 키 ${BT_N}개를 B-트리로 저장했습니다. 페이지 한 장에 키를 <b>4개씩</b> 담았더니 페이지 수는 6장, 높이는 2가 됐습니다.`, snap());
          for (const key of BT_TARGETS) {
            path = []; cur = null; found = null; page = null; at = -1;
            t.step(2, `<code>find(${key})</code> — 루트부터 내려갑니다.`, snap());
            let id = 'root';
            for (;;) {
              cur = id; page = btPages[id]; at = -1;
              t.m['읽은 페이지 수']++;
              t.step(path.length ? 9 : 3, `페이지 한 장을 디스크에서 읽습니다(${t.m['읽은 페이지 수']}장째). 이번에는 키 <b>${page.keys.length}개</b>가 한꺼번에 메모리로 올라옵니다.`, snap());
              let i = 0, looked = 0;
              while (i < page.keys.length) { looked++; if (key > page.keys[i]) i++; else break; }
              t.m['키 비교 횟수'] += looked;
              at = Math.min(i, page.keys.length - 1);
              if (page.keys[i] === key) {
                found = id;
                t.step(7, `이 페이지 안에서 키 ${looked}개와 비교해 <b>${key}</b>를 찾았습니다. 비교는 여러 번 했지만 디스크는 다시 읽지 않았습니다.`, snap());
                break;
              }
              path.push(id);
              t.step(6, `페이지 안의 키 ${looked}개와 비교합니다. 이미 메모리에 있으므로 디스크 읽기는 없습니다. ${i < page.keys.length ? `${key} &lt; ${page.keys[i]}에서 멈춥니다` : `${key}은 모든 키보다 큽니다`} → <b>${ORD[i]} 가지</b>로 갑니다. 나머지 네 가지는 읽지 않습니다.`, snap());
              id = page.kids[i];
            }
          }
          t.step(11, `키 3개를 찾는 데 페이지 <b>${t.m['읽은 페이지 수']}장</b>을 읽었습니다. 비교 횟수(${t.m['키 비교 횟수']}번)는 이진 트리보다 많지만, 비싼 것은 비교가 아니라 페이지 읽기입니다.`, snap());
        },
      },
    ],
    points: [
      '디스크는 바이트 단위가 아니라 <b>페이지 단위</b>(보통 4~16KB)로 읽습니다. 키 하나만 필요해도 한 장을 통째로 읽으므로, 한 장에 키를 최대한 많이 담는 쪽이 이득입니다.',
      '한 노드의 자식 수(분기 수)가 m이면 높이는 log_m n입니다. 분기 수가 2에서 수백으로 늘면 높이는 27에서 4로 줄어듭니다.',
      'B-트리는 가득 찬 노드를 둘로 쪼개고 가운데 키를 부모로 올리면서 자랍니다. 위로 자라기 때문에 모든 리프의 깊이가 항상 같고, 어떤 키를 찾아도 읽는 페이지 수가 같습니다.',
      '실제 DB 색인은 대부분 B+트리입니다. 값(행 위치)은 리프에만 두고 리프끼리 연결해서, 범위 조회가 리프를 옆으로 따라가기만 하면 됩니다.',
    ],
    senior: '운영에서 색인이 느려지는 순간은 트리가 높아질 때가 아니라 <b>자주 읽는 페이지가 메모리(버퍼 캐시)에 다 들어가지 않게 될 때</b>입니다. 루트와 중간 노드는 거의 항상 메모리에 있어서 실제 디스크 읽기는 리프 한두 장인데, 색인이 메모리보다 커지면 그 리프 읽기가 전부 디스크로 갑니다. 키의 분포도 영향을 줍니다. 무작위 UUID(v4)를 기본 키로 쓰면 새 행이 리프 전체에 흩어져 들어가면서 페이지 분할이 잦아지고 캐시 효율이 떨어집니다. 시간순으로 정렬되는 키는 오른쪽 끝 리프에만 쌓입니다. 이 때문에 2024년 5월 RFC 9562로 표준화된 UUIDv7(앞부분이 타임스탬프)을 쓰는 곳이 늘었고, PostgreSQL도 18(2025년 9월 출시)부터 <code>uuidv7()</code> 함수를 기본 제공합니다. 쓰기가 읽기보다 훨씬 많은 저장소는 B-트리 대신 LSM 트리를 고르기도 합니다.',
    qa: [
      ['DB 색인에 이진 탐색 트리나 해시 테이블 대신 B-트리를 쓰는 이유는 무엇입니까?', '디스크는 페이지 단위로 읽고, 한 번 읽는 비용이 메모리 비교보다 훨씬 큽니다. 이진 트리는 노드마다 키가 하나라 높이가 log₂ n이고 내려갈 때마다 페이지를 읽습니다. B-트리는 한 페이지에 키 수백 개를 담아 높이를 3~4로 낮춥니다. 해시 테이블은 같은 값 조회는 빠르지만 정렬 순서가 없어 범위 조건과 ORDER BY에 쓸 수 없습니다.'],
      ['B-트리에서 한 노드의 크기는 어떻게 정합니까?', '디스크 페이지 크기에 맞춥니다. 노드 하나가 페이지 하나에 딱 들어가야 한 번의 읽기로 노드 전체를 얻습니다. 그래서 분기 수는 "페이지 크기 ÷ (키 크기 + 자식 주소 크기)"로 정해지고, 키가 짧을수록 한 장에 더 많이 들어가 트리가 낮아집니다. 긴 문자열을 키로 쓰면 색인이 커지고 느려지는 이유입니다.'],
      ['B-트리와 B+트리의 차이는 무엇입니까?', 'B-트리는 중간 노드에도 값을 두지만 B+트리는 값을 리프에만 두고 중간 노드에는 길잡이 키만 둡니다. 중간 노드에 키가 더 많이 들어가 분기 수가 커지고, 리프끼리 연결되어 있어 범위 조회가 리프를 순서대로 읽기만 하면 됩니다. 대부분의 관계형 DB 색인이 B+트리입니다.'],
    ],
    dx: {
      cat: ['slow'], concept: 'B-트리 색인의 페이지 읽기와 키 분포',
      symptoms: ['데이터가 일정 크기를 넘은 뒤부터 색인을 타는 조회도 갑자기 느려진다(색인이 메모리에 다 올라가지 않음)', '무작위 UUID를 기본 키로 쓴 테이블의 INSERT가 행 수가 늘수록 느려지고 색인 크기가 빠르게 커진다', '쿼리는 같은데 디스크 읽기 대기(I/O wait)만 늘었다'],
      check: '실행 계획에서 읽은 페이지(버퍼) 수와 그중 디스크에서 읽은 수를 봅니다(PostgreSQL이라면 EXPLAIN (ANALYZE, BUFFERS)). 색인 크기와 버퍼 캐시 크기, 캐시 적중률을 비교합니다.',
      fix: '색인 키를 짧게 하고 쓰지 않는 색인을 지워 색인이 메모리에 들어가게 합니다. 기본 키는 순차 값이나 시간순 정렬 ID(UUIDv7 등)로 바꿔 삽입이 한쪽 끝에 모이게 합니다.',
    },
  });

  /* ---------- 펜윅 트리 ---------- */
  const FW_N = 16;
  const FW_A = [0, 3, 1, 4, 1, 5, 2, 2, 6, 5, 3, 1, 4, 2, 3, 1, 2]; // a[1..16], a[0]은 쓰지 않음
  const FW_OPS = [['sum', 3, 10], ['add', 5, 4], ['sum', 3, 10], ['add', 1, 2], ['sum', 2, 13], ['add', 11, 3]];
  const lowbit = (i) => i & -i;
  const bin = (i) => i.toString(2).padStart(5, '0');
  const fwInit = (t) => { t.m['칸 접근 횟수'] = 0; t.m['갱신에 쓴 접근'] = 0; t.m['조회에 쓴 접근'] = 0; };
  const FW_CW = 32, FW_ROW = 30;
  CS.add({
    id: 'fenwick-tree', level: 'adv', topic: 'ds',
    title: '펜윅 트리: 값이 바뀌는 배열의 구간 합',
    summary: '누적합 배열은 구간 합을 뺄셈 한 번으로 답하지만, 값 하나가 바뀌면 그 뒤의 누적값을 전부 고쳐야 합니다. 펜윅 트리(BIT)는 구간을 2의 거듭제곱 길이로 나눠 저장해서 갱신과 조회를 모두 O(log n)에 끝냅니다. 갱신 3번과 구간 합 3번을 섞어 실행합니다.',
    headline: '칸 접근 횟수',
    verdict: 'n = 16에서는 40 대 22입니다. 누적합 배열은 조회가 2칸으로 끝나는 대신 갱신 한 번에 최대 n칸을 고치고, 펜윅 트리는 둘 다 많아야 log₂ n + 1칸입니다. n이 100만이면 갱신 한 번이 최대 100만 칸 대 20칸입니다. 갱신과 조회가 섞여 나올 때 쓰는 구조입니다.',
    variants: [
      {
        name: '누적합 배열', tone: 'bad', label: '갱신이 느림', big: { time: '갱신 O(n), 조회 O(1)', space: 'O(n)' },
        code: `// pre[i] = a[1] + ... + a[i]
function add(i, delta) {
  a[i] += delta;
  for (let k = i; k <= n; k++) pre[k] += delta;
}
function rangeSum(l, r) {
  return pre[r] - pre[l - 1];
}`,
        notes: { 4: 'i 뒤의 누적값을 전부 고침', 7: '뺄셈 한 번' },
        run(t) {
          fwInit(t);
          const a = FW_A.slice(), pre = [0], out = [];
          for (let i = 1; i <= FW_N; i++) pre[i] = pre[i - 1] + a[i];
          const idx = Array.from({ length: FW_N }, (_, k) => k + 1);
          const snap = (o = {}) => [
            { type: 'cells', compact: true, title: '배열 a (1번부터)', items: idx.map((i) => ({ id: i, v: a[i], sub: i, s: i === o.hot ? 'active' : o.l && i >= o.l && i <= o.r ? 'cmp' : '' })) },
            { type: 'cells', compact: true, title: 'pre[i] = a[1..i]의 합', items: idx.map((i) => ({ id: i, v: pre[i], sub: i, ptr: i === o.r ? '+' : o.l && i === o.l - 1 ? '−' : '', s: o.w && i >= o.w[0] && i <= o.w[1] ? 'active' : o.from && i >= o.from && i < o.w0 ? 'new' : i === o.r ? 'done' : o.l && i === o.l - 1 ? 'bad' : o.from && i < o.from ? 'dim' : '' })) },
            { type: 'cells', title: '구간 합 결과', items: out.map((v, k) => ({ id: k, v: v[0], sub: v[1], s: 'done' })) },
          ];
          t.step(1, `누적합 배열을 미리 만들어 두었습니다. 조회는 빠릅니다. 문제는 중간에 값이 바뀔 때입니다.`, snap());
          let first = true;
          for (const [op, x, y] of FW_OPS) {
            if (op === 'sum') {
              const s = pre[y] - pre[x - 1];
              out.push([s, `${x}~${y}`]);
              t.m['칸 접근 횟수'] += 2; t.m['조회에 쓴 접근'] += 2;
              t.step(7, `<code>rangeSum(${x}, ${y})</code> = pre[${y}] − pre[${x - 1}] = ${pre[y]} − ${pre[x - 1]} = <b>${s}</b>. 두 칸만 읽습니다.`, snap({ l: x, r: y }));
            } else {
              a[x] += y;
              t.step(3, `<code>add(${x}, +${y})</code> — a[${x}]를 ${a[x] - y}에서 <b>${a[x]}</b>로 바꿉니다. a[${x}]를 포함하는 누적값은 pre[${x}]부터 pre[${FW_N}]까지 <b>${FW_N - x + 1}칸</b>입니다.`, snap({ hot: x, from: x, w0: x }));
              const chunk = first ? 1 : 4;
              for (let k = x; k <= FW_N; k += chunk) {
                const end = Math.min(FW_N, k + chunk - 1);
                for (let j = k; j <= end; j++) { pre[j] += y; t.m['칸 접근 횟수']++; t.m['갱신에 쓴 접근']++; }
                t.step(4, chunk === 1
                  ? `<code>pre[${k}] += ${y}</code> → ${pre[k]}${k === x ? '' : k === FW_N ? ` — 값 하나를 바꾸려고 ${FW_N - x + 1}칸을 고쳤습니다.` : ''}`
                  : `<code>pre[${k}]</code>${end > k ? `~<code>pre[${end}]</code>` : ''}에 ${y}씩 더합니다(${end - k + 1}칸).${end === FW_N ? ` 이번 갱신은 ${FW_N - x + 1}칸을 고쳤습니다.` : ''}`, snap({ hot: x, from: x, w0: k, w: [k, end] }));
              }
              first = false;
            }
          }
          t.step(8, `갱신 3번에 ${t.m['갱신에 쓴 접근']}칸, 조회 3번에 ${t.m['조회에 쓴 접근']}칸, 합계 <b>${t.m['칸 접근 횟수']}칸</b>입니다. 갱신 비용은 배열 길이에 비례합니다.`, snap());
        },
      },
      {
        name: '펜윅 트리 (BIT)', tone: 'good', label: '둘 다 log n', big: { time: '갱신·조회 O(log n)', space: 'O(n)' },
        code: `// tree[i] = i에서 끝나는 길이 lowbit(i) 구간의 합
// lowbit(i) = i & -i  (i의 가장 낮은 1비트)
function add(i, delta) {
  for (; i <= n; i += i & -i) tree[i] += delta;
}
function prefix(i) {             // a[1..i]의 합
  let sum = 0;
  for (; i > 0; i -= i & -i) sum += tree[i];
  return sum;
}
function rangeSum(l, r) {
  return prefix(r) - prefix(l - 1);
}`,
        notes: { 4: '나를 포함하는 더 큰 구간으로', 8: '앞쪽 구간을 이어 붙임' },
        run(t) {
          fwInit(t);
          const a = FW_A.slice(), tree = Array(FW_N + 1).fill(0), out = [];
          for (let i = 1; i <= FW_N; i++) for (let k = i; k <= FW_N; k += lowbit(k)) tree[k] += a[i];
          const lv = (i) => Math.log2(lowbit(i));
          const snap = (o = {}) => {
            const vis = o.vis || [], cover = o.cur ? [o.cur - lowbit(o.cur) + 1, o.cur] : o.cover || [0, -1];
            return [
              {
                type: 'graph', directed: true, title: `tree — 막대 하나가 바로 아래 a 칸들의 합 ([i]는 tree 번호) · 맨 아래 줄은 배열 a${out.length ? ` · 구한 답: ${out.map((v) => v[0]).join(', ')}` : ''}`, w: FW_N * FW_CW + 12, h: 5 * FW_ROW + 50, scale: 1.1,
                nodes: [
                  ...Array.from({ length: FW_N }, (_, k) => k + 1).map((i) => ({ id: 't' + i, v: lv(i) ? `[${i}] ${tree[i]}` : tree[i], x: 6 + (i - lowbit(i) / 2) * FW_CW, y: 14 + (4 - lv(i)) * FW_ROW, w: lowbit(i) * FW_CW - 6, h: 22, s: i === o.cur ? 'active' : vis.includes(i) ? 'done' : '' })),
                  ...Array.from({ length: FW_N }, (_, k) => k + 1).map((i) => ({ id: 'a' + i, v: a[i], sub: i, x: 6 + (i - 0.5) * FW_CW, y: 20 + 5 * FW_ROW, w: FW_CW - 6, h: 22, round: true, s: i === o.hot ? 'new' : i >= cover[0] && i <= cover[1] ? 'cmp' : '' })),
                ],
                edges: vis.slice(1).map((k, j) => ({ a: 't' + vis[j], b: 't' + k, s: 'active' })).concat(o.cur && vis.length ? [{ a: 't' + vis[vis.length - 1], b: 't' + o.cur, s: 'active' }] : []),
              },
            ];
          };
          t.step(1, `펜윅 트리는 길이가 2의 거듭제곱인 구간들의 합을 저장합니다. 예를 들어 <code>tree[12]</code>는 a[9..12] 네 칸의 합입니다. 12 = 01100₂의 가장 낮은 1비트가 4이기 때문입니다.`, snap({ cur: 12 }));
          t.step(2, `<code>tree[16]</code>은 a[1..16] 전체, <code>tree[8]</code>은 a[1..8], 홀수 번호(맨 아랫줄 막대)는 바로 아래 한 칸만 맡습니다. 어떤 a[i]든 그것을 포함하는 막대는 많아야 ${Math.log2(FW_N) + 1}개입니다.`, snap({ cur: 8 }));
          const prefix = (i, vis) => {
            let sum = 0;
            for (; i > 0; i -= lowbit(i)) {
              sum += tree[i];
              t.m['칸 접근 횟수']++; t.m['조회에 쓴 접근']++;
              t.step(8, `<code>sum += tree[${i}]</code> (a[${i - lowbit(i) + 1}..${i}]의 합 ${tree[i]}) → ${sum}. ${i} = ${bin(i)}₂에서 가장 낮은 1비트 ${lowbit(i)}을 빼면 ${i - lowbit(i) ? `<b>${i - lowbit(i)}</b>로 건너뜁니다.` : '0이 되어 끝납니다.'}`, snap({ cur: i, vis }));
              vis.push(i);
            }
            return sum;
          };
          for (const [op, x, y] of FW_OPS) {
            if (op === 'sum') {
              t.step(12, `<code>rangeSum(${x}, ${y})</code> = prefix(${y}) − prefix(${x - 1}). 먼저 a[1..${y}]의 합을 구합니다.`, snap({ cover: [x, y] }));
              const hi = prefix(y, []);
              t.step(6, `prefix(${y}) = ${hi}. 이제 빼야 할 앞부분 a[1..${x - 1}]의 합을 구합니다.`, snap({ cover: [1, x - 1] }));
              const lo = prefix(x - 1, []);
              out.push([hi - lo, `${x}~${y}`]);
              t.step(12, `${hi} − ${lo} = <b>${hi - lo}</b>. 구간 길이가 ${y - x + 1}인데 읽은 칸은 몇 개 되지 않습니다.`, snap({ cover: [x, y] }));
            } else {
              a[x] += y;
              t.step(3, `<code>add(${x}, +${y})</code> — a[${x}]가 ${a[x] - y}에서 <b>${a[x]}</b>가 됩니다. a[${x}]를 포함하는 막대만 고치면 됩니다.`, snap({ hot: x }));
              const vis = [];
              for (let i = x; i <= FW_N; i += lowbit(i)) {
                tree[i] += y;
                t.m['칸 접근 횟수']++; t.m['갱신에 쓴 접근']++;
                const nx = i + lowbit(i);
                t.step(4, `<code>tree[${i}] += ${y}</code> → ${tree[i]}. ${i} = ${bin(i)}₂에 가장 낮은 1비트 ${lowbit(i)}을 더하면 ${nx <= FW_N ? `<b>${nx}</b> — a[${x}]를 포함하는 다음으로 큰 막대입니다.` : `${nx}, 범위를 벗어나 끝납니다. ${vis.length + 1}칸만 고쳤습니다.`}`, snap({ cur: i, vis, hot: x }));
                vis.push(i);
              }
            }
          }
          t.step(13, `갱신 3번에 ${t.m['갱신에 쓴 접근']}칸, 조회 3번에 ${t.m['조회에 쓴 접근']}칸, 합계 <b>${t.m['칸 접근 횟수']}칸</b>입니다. 조회는 누적합 배열보다 조금 더 읽지만, 어느 연산도 log₂ n + 1칸을 넘지 않습니다.`, snap());
        },
      },
    ],
    points: [
      '세 가지 선택지가 있습니다. 원본 배열만 쓰면 갱신 O(1)·조회 O(n), 누적합 배열은 갱신 O(n)·조회 O(1), 펜윅 트리는 둘 다 O(log n)입니다. 갱신이 없으면 누적합 배열이 가장 좋습니다.',
      '<code>i & -i</code>는 i의 가장 낮은 1비트만 남깁니다. 갱신은 이 값을 더해 가며 위로, 조회는 빼 가며 앞으로 이동합니다. 이동할 때마다 비트 하나가 정리되므로 많아야 log₂ n + 1번입니다.',
      '인덱스는 반드시 <b>1부터</b> 씁니다. 0은 가장 낮은 1비트가 없어서 <code>i += i & -i</code>가 제자리에 머뭅니다.',
      '합처럼 "되돌릴 수 있는" 연산에만 맞습니다. 구간 최솟값·최댓값이나 구간 전체에 값을 더하는 갱신이 필요하면 세그먼트 트리를 씁니다.',
    ],
    senior: '실무에서 펜윅 트리를 직접 구현하는 일은 드물지만 같은 고민은 자주 나옵니다. 누적값이나 롤업 테이블을 미리 만들어 두면 조회는 빨라지는데, 과거 데이터가 수정될 때마다 그 뒤의 집계를 전부 다시 써야 합니다. 그래서 집계를 시간 단위 묶음(분 → 시간 → 일)으로 계층화해 두고, 수정이 생기면 해당 묶음과 그 상위 묶음만 고칩니다. 구조가 펜윅 트리·세그먼트 트리와 같습니다. 실시간 순위에서 "내 점수보다 높은 사람 수"를 구하는 문제도 점수 구간별 인원을 이런 트리로 관리하면 갱신과 조회가 모두 로그 시간입니다. 읽기와 쓰기 중 어느 쪽이 더 잦은지를 먼저 재고 구조를 고르세요.',
    qa: [
      ['누적합 배열이 있는데 펜윅 트리가 왜 필요합니까?', '누적합 배열은 값 하나가 바뀌면 그 위치 뒤의 누적값을 전부 고쳐야 해서 갱신이 O(n)입니다. 갱신과 구간 합 조회가 섞여서 각각 10만 번씩 나오면 O(n·q)가 되어 시간 안에 끝나지 않습니다. 펜윅 트리는 구간을 2의 거듭제곱 길이로 나눠 저장해서 갱신과 조회를 모두 O(log n)에 처리합니다.'],
      ['i & -i가 무엇을 계산하고, 왜 그것으로 충분합니까?', '2의 보수 표현에서 -i는 i의 비트를 뒤집고 1을 더한 값이라, i & -i는 i의 가장 낮은 1비트만 남깁니다. tree[i]는 i에서 끝나는 그 길이만큼의 구간 합을 맡습니다. 조회는 i에서 그 길이를 빼며 앞 구간으로 건너뛰고, 갱신은 더하며 자신을 포함하는 더 큰 구간으로 올라갑니다. 매번 1비트 하나가 처리되므로 log n번 안에 끝납니다.'],
      ['펜윅 트리와 세그먼트 트리는 어떻게 골라 씁니까?', '점 갱신과 구간 합처럼 역연산이 있는 연산이면 펜윅 트리가 코드가 짧고 메모리도 배열 하나면 됩니다. 구간 최솟값·최댓값처럼 빼서 되돌릴 수 없는 연산, 구간 전체 갱신(지연 전파), 조건을 만족하는 위치 찾기 같은 복잡한 질의는 세그먼트 트리가 필요합니다.'],
    ],
    ct: {
      signal: '값을 바꾸는 연산과 구간 합 질의가 섞여 있고 둘 다 10만 번 수준',
      how: '펜윅 트리. 갱신은 i += i & -i로 올라가며 더하고, 구간 합은 prefix(r) − prefix(l − 1)',
      big: 'O((n + q) log n)',
      trap: '인덱스를 0부터 쓰면 무한 루프입니다. "값을 x로 바꿔라"는 delta = x − a[i]로 바꿔서 넣고 a[i]도 함께 갱신합니다. 합이 32비트를 넘는지도 확인합니다.',
    },
  });

  /* ---------- 원형 버퍼 ---------- */
  const RB_CAP = 8, RB_INIT = ['A', 'B', 'C', 'D', 'E', 'F'];
  const RB_OPS = [['deq'], ['deq'], ['enq', 'G'], ['enq', 'H'], ['deq'], ['enq', 'I'], ['deq'], ['enq', 'J'], ['deq']];
  const rbInit = (t) => { t.m['요소 이동 횟수'] = 0; t.m['처리한 큐 연산'] = 0; };
  const outPanel = (out) => ({ type: 'cells', title: '꺼낸 순서', items: out.map((v) => ({ id: v, v, s: 'done' })) });
  CS.add({
    id: 'ring-buffer', level: 'basic', topic: 'ds',
    title: '원형 버퍼: 큐에서 shift()가 느린 이유',
    summary: '배열로 큐를 만들면 뒤에 넣는 것은 빠르지만, 앞에서 꺼낼 때마다 남은 요소 전부를 한 칸씩 당겨야 합니다. 원형 버퍼는 데이터를 옮기지 않고 "어디가 맨 앞인지"를 가리키는 번호만 옮깁니다. 같은 순서로 넣고 빼기 9번을 실행합니다.',
    headline: '요소 이동 횟수',
    verdict: '꺼내기 5번에 배열 큐는 요소를 24번 옮겼고 원형 버퍼는 한 번도 옮기지 않았습니다. 큐에 n개가 있으면 배열의 shift()는 n − 1번 이동이고, 원형 버퍼는 n과 무관하게 번호 계산 한 번입니다. 끝에 닿으면 나머지 연산(%)으로 0번 칸으로 돌아가 빈자리를 다시 씁니다.',
    variants: [
      {
        name: '배열 + shift()', tone: 'bad', big: { time: '꺼내기 O(n)', space: 'O(n)' },
        code: `const queue = ['A', 'B', 'C', 'D', 'E', 'F'];
const enqueue = (x) => queue.push(x);

// dequeue = queue.shift()가 안에서 하는 일
function dequeue() {
  const first = queue[0];
  for (let i = 1; i < queue.length; i++) {
    queue[i - 1] = queue[i];   // 한 칸씩 앞으로
  }
  queue.length -= 1;
  return first;
}`,
        notes: { 2: '맨 뒤에 놓기: O(1)', 8: '남은 요소 수만큼 반복' },
        run(t) {
          rbInit(t);
          const slots = RB_INIT.concat(Array(RB_CAP - RB_INIT.length).fill(null)), out = [];
          let len = RB_INIT.length;
          const snap = (hot, gone) => [
            { type: 'cells', title: `배열 queue — 맨 앞은 언제나 0번 칸이어야 합니다 (길이 ${len})`, items: slots.map((v, k) => (v == null ? { id: 'h' + k, v: '', sub: k, s: 'hole' } : { id: v, v, sub: k, s: v === gone ? 'bad' : v === hot ? 'active' : '', ptr: k === 0 && v !== gone ? '맨 앞' : '' })) },
            outPanel(out),
          ];
          t.step(1, `큐에 A~F 6개가 들어 있습니다. 배열에서 "맨 앞"은 0번 칸으로 고정되어 있습니다.`, snap());
          let first = true;
          for (const [op, x] of RB_OPS) {
            t.m['처리한 큐 연산']++;
            if (op === 'enq') {
              slots[len++] = x;
              t.step(2, `<code>enqueue('${x}')</code> — 맨 뒤 빈칸에 놓습니다. 아무것도 옮기지 않습니다.`, snap(x));
              continue;
            }
            const head = slots[0];
            t.step(6, `<code>dequeue()</code> — 0번 칸의 <b>${head}</b>를 꺼냅니다. 그러면 0번 칸이 비는데, 맨 앞은 0번이어야 합니다.`, snap(null, head));
            out.push(head);
            slots[0] = null;
            if (first) {
              for (let i = 1; i < len; i++) {
                slots[i - 1] = slots[i]; slots[i] = null;
                t.m['요소 이동 횟수']++;
                t.step(8, `<code>queue[${i - 1}] = queue[${i}]</code> — ${slots[i - 1]}를 한 칸 앞으로 옮깁니다.${i === len - 1 ? ` 하나를 꺼내려고 <b>${len - 1}개</b>를 옮겼습니다.` : ''}`, snap(slots[i - 1]));
              }
            } else {
              for (let i = 1; i < len; i++) { slots[i - 1] = slots[i]; slots[i] = null; t.m['요소 이동 횟수']++; }
              t.step(8, `남은 ${len - 1}개가 전부 한 칸씩 앞으로 옵니다(이동 +${len - 1}). 큐가 길수록 꺼내기 한 번이 비싸집니다.`, snap());
            }
            first = false;
            len--;
            t.step(10, `길이를 ${len}로 줄이고 ${head}를 돌려줍니다. 지금까지 이동 <b>${t.m['요소 이동 횟수']}번</b>.`, snap());
          }
          t.step(12, `넣기 4번은 이동이 없었고, 꺼내기 5번에 요소를 <b>${t.m['요소 이동 횟수']}번</b> 옮겼습니다. 큐에 10만 개가 있으면 꺼낼 때마다 약 10만 번입니다.`, snap());
        },
      },
      {
        name: '원형 버퍼 (head 번호만 이동)', tone: 'good', big: { time: '넣기·꺼내기 O(1)', space: 'O(용량)' },
        code: `const buf = new Array(8);          // 고정 크기
let head = 0, size = 6;            // A~F가 든 상태

function enqueue(x) {
  const tail = (head + size) % buf.length;
  buf[tail] = x;                   // 끝을 넘으면 0번으로
  size++;
}
function dequeue() {
  const first = buf[head];
  head = (head + 1) % buf.length;  // 번호만 옮긴다
  size--;
  return first;
}`,
        notes: { 5: '다음에 쓸 칸', 11: '데이터는 그대로' },
        run(t) {
          rbInit(t);
          const buf = RB_INIT.concat(Array(RB_CAP - RB_INIT.length).fill(''));
          const out = [];
          let head = 0, size = RB_INIT.length;
          const snap = (hot, wrap) => {
            const tail = (head + size) % RB_CAP;
            const live = (k) => (k - head + RB_CAP) % RB_CAP < size;
            const st = (k) => (k === hot ? 'active' : live(k) ? 'cmp' : buf[k] === '' ? 'hole' : 'dim');
            const tag = (k) => (k === head && k === tail ? 'head·tail' : k === head ? 'head' : k === tail ? 'tail' : '');
            return [
              { type: 'cells', title: `buf — 메모리에서는 일자 배열 (head = ${head}, size = ${size})`, items: buf.map((v, k) => ({ id: k, v, sub: k, ptr: tag(k), s: st(k) })) },
              {
                type: 'graph', directed: true, title: '같은 배열을 끝과 처음을 이어서 본 모습', w: 230, h: 178, scale: 1,
                nodes: buf.map((v, k) => { const ang = (k / RB_CAP) * 2 * Math.PI - Math.PI / 2; return { id: k, v, x: 115 + 64 * Math.cos(ang), y: 80 + 64 * Math.sin(ang), w: 28, h: 24, sub: tag(k) || k, s: st(k) === 'hole' ? '' : st(k) }; }),
                edges: buf.map((_, k) => ({ a: k, b: (k + 1) % RB_CAP, s: wrap && k === RB_CAP - 1 ? 'active' : '' })),
              },
            ];
          };
          t.step(2, `같은 A~F를 8칸짜리 고정 배열에 넣었습니다. <b>head</b>는 맨 앞 요소의 칸 번호, <b>tail</b>은 다음에 넣을 칸입니다.`, snap());
          for (const [op, x] of RB_OPS) {
            t.m['처리한 큐 연산']++;
            if (op === 'enq') {
              const tail = (head + size) % RB_CAP, wrap = head + size >= RB_CAP;
              t.step(5, `<code>enqueue('${x}')</code> — tail = (${head} + ${size}) % ${RB_CAP} = <b>${tail}</b>.${wrap ? ` ${head + size}은 배열 끝을 넘으므로 나머지 연산이 <b>앞쪽 빈칸</b>으로 돌려보냅니다.` : ''}`, snap(null, wrap));
              buf[tail] = x; size++;
              t.step(6, `${tail}번 칸에 <b>${x}</b>를 씁니다. ${wrap ? '앞에서 꺼내고 남은 자리를 다시 쓰는 것입니다. ' : ''}기존 요소는 하나도 옮기지 않았습니다.`, snap(tail, wrap));
            } else {
              const v = buf[head];
              t.step(10, `<code>dequeue()</code> — head가 가리키는 ${head}번 칸에서 <b>${v}</b>를 읽습니다.`, snap(head));
              out.push(v);
              head = (head + 1) % RB_CAP; size--;
              t.step(11, `head를 <b>${head}</b>로 옮깁니다. ${v}는 메모리에 남아 있지만 큐의 범위 밖이라 없는 것으로 칩니다. 나머지 ${size}개는 제자리입니다.`, snap());
            }
          }
          t.step(14, `연산 9번 동안 요소 이동은 <b>0번</b>입니다. 넣기도 꺼내기도 번호 계산 한 번과 칸 접근 한 번으로 끝났습니다.`, snap());
        },
      },
    ],
    points: [
      '배열의 <code>shift()</code>는 맨 앞을 뺀 뒤 나머지를 전부 한 칸씩 당깁니다. 큐 길이가 n이면 한 번에 O(n)이고, n번 꺼내면 O(n²)입니다.',
      '원형 버퍼는 <code>head</code>와 <code>size</code>(또는 <code>tail</code>) 두 숫자로 "지금 큐가 배열의 어느 구간인지"를 나타냅니다. 넣고 빼는 것은 이 숫자를 바꾸는 일입니다.',
      '용량이 정해져 있습니다. 가득 찼을 때는 2배 크기 배열로 옮기거나(동적 큐), 넣기를 거절하거나, 가장 오래된 것을 덮어씁니다(최근 N개 로그).',
      'head를 뒤로도 움직이게 하면 양쪽 끝에서 O(1)로 넣고 빼는 <b>덱</b>(deque)이 됩니다. <code>head = (head − 1 + cap) % cap</code> 한 줄이 추가될 뿐입니다.',
    ],
    senior: '<code>shift()</code>의 비용은 엔진마다 다릅니다. 작은 배열에서는 엔진이 앞부분을 잘라 내는 최적화로 빠르게 처리하기도 하지만 언어 명세가 보장하는 동작이 아니고, 배열이 커지면 통하지 않을 수 있습니다. 그래서 "테스트 데이터에서는 빠르다가 운영 데이터 크기에서 갑자기 느려지는" 형태로 나타납니다. 원형 버퍼는 큐 말고도 여러 곳에 쓰입니다. 최근 N개 로그나 지표를 고정 메모리로 유지하는 버퍼, 오디오·네트워크 I/O 버퍼, 생산자와 소비자 사이의 크기 제한 큐가 전부 이 구조입니다. 메모리를 한 번만 잡고 재사용하므로 할당과 GC 부담이 없고, 연속된 메모리라 CPU 캐시에도 유리합니다. 객체를 담는다면 꺼낸 칸을 비워 두어야(<code>buf[head] = undefined</code>) 다 쓴 객체가 GC되지 않고 붙잡혀 있는 일을 막습니다.',
    qa: [
      ['JavaScript 배열로 큐를 만들 때 shift()가 문제가 되는 이유는 무엇입니까?', '배열은 0번부터 연속으로 채워져 있어야 하므로, 맨 앞을 빼면 나머지 요소를 전부 한 칸씩 앞으로 옮겨야 합니다. 큐 길이에 비례하는 O(n) 연산이라 BFS처럼 큐에서 n번 꺼내는 알고리즘이 O(n²)이 됩니다. 꺼낼 위치를 가리키는 인덱스를 따로 두거나 원형 버퍼, 연결 리스트 기반 큐를 쓰면 꺼내기가 O(1)이 됩니다.'],
      ['원형 버퍼에서 비어 있는 상태와 가득 찬 상태를 어떻게 구분합니까?', 'head와 tail만 두면 두 상태 모두 head === tail이 되어 구분되지 않습니다. 흔한 방법은 세 가지입니다. size를 따로 세거나, 한 칸을 항상 비워 두어 (tail + 1) % cap === head를 가득 참으로 보거나, head와 tail을 나머지 연산 없이 계속 증가시키고 차이로 개수를 구합니다.'],
      ['연결 리스트로도 큐를 O(1)에 만들 수 있는데 원형 버퍼를 쓰는 이유는 무엇입니까?', '연결 리스트는 요소마다 노드를 할당하고 포인터를 따라가야 해서 메모리 할당 비용과 캐시 미스가 큽니다. 원형 버퍼는 배열 하나를 재사용하므로 할당이 없고 메모리가 연속이라 빠릅니다. 대신 용량이 고정이라 가득 찼을 때의 정책(확장, 거절, 덮어쓰기)을 정해야 합니다.'],
    ],
    dx: {
      cat: ['slow'], concept: '배열 큐의 shift() 비용',
      symptoms: ['큐에 쌓인 항목이 많아질수록 처리 속도가 눈에 띄게 떨어진다', '입력이 작을 때는 빠르던 BFS·작업 큐 코드가 큰 입력에서 시간 초과가 난다', 'CPU 프로파일에서 배열의 shift 또는 splice(0, 1)가 대부분을 차지한다'],
      check: '큐 길이를 10배로 늘렸을 때 전체 시간이 10배가 아니라 100배 가까이 늘어나는지 봅니다. 프로파일러에서 shift가 차지하는 비율을 확인합니다.',
      fix: 'shift() 대신 읽을 위치 인덱스를 두고 증가시키거나, 원형 버퍼·덱 구현으로 바꿉니다.',
    },
    ct: {
      signal: 'BFS·시뮬레이션에서 큐 연산이 수십만 번 이상이거나, "최근 k개만 유지"하는 문제',
      how: 'shift() 대신 head 인덱스를 증가시키며 읽거나, 원형 버퍼·덱을 직접 구현',
      big: '연산당 O(1)',
      trap: 'JS에서 queue.shift()를 그대로 쓰면 큰 입력에서 시간 초과가 납니다. 원형 버퍼는 빈 상태와 가득 찬 상태가 모두 head === tail이 되므로 size를 따로 두거나 한 칸을 비워 둡니다.',
    },
  });
})();
