/* 증상 사전: 디버깅 중 관찰한 현상 → 의심할 CS 개념 → 확인 방법(근거) → 고치는 방향.
   키는 레슨 id. 레슨 화면의 "이런 현상을 봤다면" 상자와 "증상으로 찾기" 페이지가 함께 사용한다.
   cat: slow | hang | memory | wrong | flaky | data | crash */
(function () {
  const CS = window.CS;

  CS.method = [
    ['현상을 숫자로 적는다.', '"느리다"가 아니라 "주문 목록 API가 평소 80ms인데 3초". 무엇이, 언제부터, 얼마나, 항상인지 가끔인지.'],
    ['입력 크기와의 관계를 본다.', '데이터가 2배일 때 시간이 2배면 O(n), 4배면 O(n²), 거의 그대로면 알고리즘이 아니라 I/O·대기 쪽입니다.'],
    ['어떤 자원이 바쁜지 본다.', 'CPU가 높으면 계산(알고리즘·정규식·GC), CPU가 낮은데 느리면 대기(DB·네트워크·락·풀), 메모리가 계속 오르면 누수입니다.'],
    ['가설을 하나 세우고 재현한다.', '아래 표에서 후보를 고르고, "확인 방법"대로 측정해 맞는지 봅니다. 추측으로 고치지 않습니다.'],
    ['고친 뒤 같은 숫자를 다시 잰다.', '1번에서 적은 숫자가 실제로 바뀌었는지 확인해야 끝난 것입니다.'],
  ];

  CS.triage = [
    { see: '데이터가 늘수록 급격히 느려진다', suspect: '시간 복잡도. 루프 안에 숨은 탐색(<code>includes</code>, <code>find</code>, <code>unshift</code>)이나 전체 재계산.', lessons: ['big-o', 'array-vs-list', 'heap', 'sliding-window', 'memoization'] },
    { see: 'CPU 100%, 요청 하나가 끝나지 않는다', suspect: '지수적으로 커지는 계산, 무한 루프, 이벤트 루프를 막는 동기 작업.', lessons: ['regex-backtracking', 'event-loop', 'bfs-dfs', 'call-stack'] },
    { see: 'CPU는 낮은데 응답이 느리다', suspect: '계산이 아니라 기다림. DB 풀 스캔, 왕복 횟수, 줄 서서 기다리는 I/O.', lessons: ['n-plus-one', 'async-parallel', 'db-index', 'pagination'] },
    { see: 'CPU도 낮고 아예 멈춘다 (타임아웃)', suspect: '무언가를 영원히 기다리는 중. 락의 고리, 돌아오지 않는 자원.', lessons: ['deadlock', 'connection-pool'] },
    { see: '메모리가 계속 오르다 재시작하면 내려간다', suspect: '어딘가에서 참조를 놓지 않는 중. 지우는 규칙 없는 캐시, 해제 안 한 리스너·타이머.', lessons: ['lru-cache', 'gc', 'closure'] },
    { see: '같은 입력에서 항상 틀린 값이 나온다', suspect: '데이터의 표현 방식 문제. 공유된 참조, 소수 표현, 문자 인코딩, 붙잡은 변수.', lessons: ['reference-copy', 'floating-point', 'unicode', 'closure'] },
    { see: '가끔만 틀리고 로컬에서는 재현이 안 된다', suspect: '실행 순서(타이밍)에 따라 결과가 달라지는 동시성 문제.', lessons: ['race-condition', 'idempotency', 'event-loop'] },
    { see: '데이터가 두 번 생기거나 사라진다', suspect: '재시도·동시 요청·페이지 경계. "한 번만 실행된다"는 가정이 깨진 곳.', lessons: ['idempotency', 'race-condition', 'pagination'] },
    { see: '주기적으로, 또는 배포·증설 직후에 부하가 튄다', suspect: '캐시가 비는 순간. 만료 시점 동시 조회, 키 재배치, GC 일시 정지.', lessons: ['cache-stampede', 'consistent-hashing', 'gc'] },
    { see: '에러 메시지와 함께 죽는다', suspect: '스택 오버플로, 순환 의존, 메모리 부족은 메시지가 원인을 알려 줍니다.', lessons: ['call-stack', 'topo-sort', 'lru-cache'] },
  ];

  CS.diagnose = {
    'search': {
      cat: ['slow'], concept: '선형 탐색 O(n) → 이진 탐색·인덱스 O(log n)',
      symptoms: ['목록에서 값 하나 찾는 코드가 데이터가 늘수록 비례해서 느려진다', '정렬된 데이터인데 처음부터 끝까지 훑고 있다'],
      check: '프로파일에서 <code>find</code>/<code>indexOf</code>/<code>filter</code>의 비중을 봅니다. 데이터를 2배로 늘렸을 때 시간도 2배면 선형 탐색입니다.',
      fix: '자주 찾는 키라면 Map/객체로 색인하고, 정렬되어 있고 범위·근삿값을 찾는다면 이진 탐색을 씁니다. DB라면 인덱스입니다.',
    },
    'array-vs-list': {
      cat: ['slow'], concept: '배열 앞쪽 삽입·삭제 O(n)',
      symptoms: ['<code>unshift</code>, <code>shift</code>, <code>splice(0, …)</code>, <code>[x, ...arr]</code>를 루프에서 쓰는 코드가 느리다', '큐로 쓰는 배열이 길어질수록 처리 속도가 떨어진다'],
      check: '배열 길이를 10배로 늘려 보세요. 전체 시간이 100배 가까이 늘면 루프 안의 O(n) 연산입니다.',
      fix: '뒤에 넣고(<code>push</code>) 마지막에 한 번 뒤집거나, 읽기 위치 인덱스를 따로 둡니다. 양쪽 끝 삽입·삭제가 잦으면 덱(링 버퍼)을 씁니다.',
    },
    'call-stack': {
      cat: ['crash'], concept: '콜 스택 깊이 = 재귀 깊이',
      symptoms: ['<code>RangeError: Maximum call stack size exceeded</code> (Java: StackOverflowError)', '작은 데이터에서는 되는데 깊게 중첩된 데이터에서만 죽는다'],
      check: '스택 트레이스에 같은 함수가 끝없이 반복되는지 봅니다. 기저 조건이 없으면 무한 재귀, 있으면 입력 깊이가 스택 한도를 넘은 것입니다.',
      fix: '기저 조건을 바로잡거나, 명시적 스택(배열)을 쓰는 반복문으로 바꿉니다. 외부 입력이 깊이를 정한다면 깊이 제한을 둡니다.',
    },
    'big-o': {
      cat: ['slow'], concept: '숨은 이중 루프 O(n²) → 해시 조회 O(n)',
      symptoms: ['100건일 때는 순식간이었는데 1만 건이 되자 몇 초씩 걸린다', '"A 목록에 있는 것 중 B 목록에도 있는 것" 같은 대조 작업이 느리다'],
      check: '입력을 2배로 늘렸을 때 시간이 <b>4배</b>가 되면 O(n²)입니다. 루프나 <code>map/filter</code> 안에서 <code>includes/find/indexOf/some</code>을 부르는 곳을 찾습니다.',
      fix: '안쪽 목록을 먼저 <code>Set</code>/<code>Map</code>으로 바꾼 뒤 조회합니다. 메모리를 O(n) 더 쓰는 대신 시간이 O(n)이 됩니다.',
    },
    'reference-copy': {
      cat: ['wrong'], concept: '참조 공유와 얕은 복사',
      symptoms: ['고친 적 없는 객체의 값이 바뀌어 있다', '복사본을 수정했는데 원본도 같이 바뀐다', 'React에서 상태를 바꿨는데 화면이 갱신되지 않는다', '한 요청의 데이터가 다른 요청에 섞여 나온다'],
      check: '두 변수를 <code>===</code>로 비교해 같은 객체인지 확인합니다. 중첩된 필드까지 내려가며 비교해 보세요. <code>Object.freeze</code>를 걸어 두면 누가 수정하는지 에러로 잡힙니다.',
      fix: '바꾸려는 경로의 객체를 모두 새로 만듭니다(중첩 스프레드, Immer). 완전히 독립된 사본이 필요하면 <code>structuredClone</code>. 모듈 전역의 기본값 객체는 매번 새로 만들어 반환합니다.',
    },
    'floating-point': {
      cat: ['wrong'], concept: '부동소수점 표현 오차 / 정수 정밀도 한계(2⁵³)',
      symptoms: ['합계가 <code>0.30000000000000004</code>처럼 나온다', '금액 합이 1원씩 안 맞는다', '<code>===</code> 비교나 <code>if (total === 1)</code>이 가끔 실패한다', '서버가 준 큰 숫자 ID의 끝자리가 바뀌어 조회가 안 된다'],
      check: '값을 소수점 20자리까지 출력해 봅니다(<code>toFixed(20)</code>). ID 문제라면 응답 원문(Network 탭의 Raw)과 파싱된 값을 비교합니다.',
      fix: '금액은 최소 단위 정수나 Decimal로 계산합니다. 소수 비교는 허용 오차를 둡니다. 2⁵³을 넘는 ID는 문자열로 주고받습니다.',
    },
    'unicode': {
      cat: ['wrong'], concept: '문자 인코딩: 바이트 · 코드 포인트 · 그래핌',
      symptoms: ['글자가 <b>�</b>나 깨진 문자로 보인다', '글자 수 제한이 이모지·한글에서 맞지 않는다', '이모지가 들어간 데이터 저장이 실패한다 (Incorrect string value)', '화면에서 똑같아 보이는 두 문자열이 같지 않다고 나온다'],
      check: '<code>[...str].map(c => c.codePointAt(0).toString(16))</code>으로 실제 코드 포인트를 찍어 봅니다. 길이를 <code>length</code>, <code>[...str].length</code>, 바이트 수 세 가지로 비교합니다.',
      fix: '사용자에게 보이는 글자 단위는 <code>Intl.Segmenter</code>, 비교·저장 전에는 <code>normalize(\'NFC\')</code>, DB는 <code>utf8mb4</code>. 제한이 바이트인지 글자인지 명확히 합니다.',
    },
    'hash-table': {
      cat: ['slow'], concept: '해시 충돌과 리사이즈',
      symptoms: ['Map/딕셔너리 조회가 기대만큼 빠르지 않다', '특정한 형태의 키가 몰릴 때만 느려진다', '대량 삽입 중 가끔씩 튀는 지연이 있다'],
      check: '키의 분포를 봅니다. 직접 만든 해시·<code>hashCode</code>라면 서로 다른 키가 같은 값을 내는 비율을 세어 봅니다. 주기적 지연은 리사이즈 시점과 맞는지 확인합니다.',
      fix: '키의 모든 부분을 반영하는 해시를 쓰고, 객체를 키로 쓸 때 동등성 규칙을 맞춥니다. 크기를 알면 초기 용량을 미리 잡습니다.',
    },
    'sorting': {
      cat: ['slow'], concept: '정렬 비용 O(n log n)과 최악의 경우',
      symptoms: ['정렬이 포함된 화면·API가 데이터가 늘며 느려진다', '렌더링이나 요청마다 같은 목록을 다시 정렬하고 있다', '이미 거의 정렬된 데이터에서 오히려 더 느리다'],
      check: '프로파일에서 <code>sort</code>와 비교 함수의 시간을 봅니다. 비교 함수가 몇 번 불리는지 세어 보면 규모가 보입니다.',
      fix: '정렬 결과를 재사용(메모이제이션)하고, 비교 함수 안의 무거운 계산은 미리 해 둡니다. 가능하면 DB의 <code>ORDER BY</code> + 인덱스에 맡깁니다. 상위 몇 개만 필요하면 힙을 씁니다.',
    },
    'memoization': {
      cat: ['slow'], concept: '겹치는 하위 문제의 반복 계산',
      symptoms: ['재귀 함수가 입력이 조금만 커져도 끝나지 않는다', '같은 인자로 같은 함수가 수없이 다시 호출된다', '리렌더링마다 같은 무거운 계산을 반복한다'],
      check: '함수 진입부에 인자별 호출 횟수를 세는 카운터를 넣어 봅니다. 같은 인자가 여러 번 나오면 메모이제이션 대상입니다.',
      fix: '결과를 인자를 키로 저장해 재사용합니다. 단, 순수 함수여야 하고 캐시 크기 상한을 함께 둡니다.',
    },
    'heap': {
      cat: ['slow'], concept: '우선순위 큐: 배열 O(n) → 힙 O(log n)',
      symptoms: ['대기 작업이 쌓일수록 "다음 작업 고르기"가 느려진다', '상위 10개만 필요한데 전체를 정렬하고 있다', '삽입할 때마다 배열을 다시 정렬한다'],
      check: '큐 길이와 한 건 처리 시간을 함께 기록합니다. 길이에 비례해 느려지면 꺼낼 때마다 전체를 보는 중입니다.',
      fix: '최소/최대 힙을 씁니다. 상위 K개는 크기 K짜리 힙으로 유지합니다. DB에서는 <code>ORDER BY … LIMIT</code>에 인덱스를 붙입니다.',
    },
    'bfs-dfs': {
      cat: ['wrong', 'hang'], concept: '그래프 탐색 순서와 방문 표시',
      symptoms: ['경로는 찾는데 최단 경로가 아니다', '트리·그래프를 따라가는 코드가 끝나지 않거나 스택이 넘친다', '같은 노드를 여러 번 처리한다'],
      check: '방문 순서를 로그로 찍어 봅니다. 같은 노드가 반복되면 방문 표시 누락(또는 데이터에 순환), 먼 곳을 먼저 가면 DFS입니다.',
      fix: '최단 거리가 필요하면 큐를 쓰는 BFS(가중치가 있으면 다익스트라). 방문 집합을 반드시 두고, 넣을 때 표시합니다.',
    },
    'trie': {
      cat: ['slow'], concept: '접두사 검색: 전체 스캔 → 트리·범위 스캔',
      symptoms: ['자동완성이 단어 수가 늘수록 버벅인다', '키 입력마다 전체 목록에 <code>filter(startsWith)</code>를 돌린다', '<code>LIKE \'%검색어%\'</code> 쿼리가 느리다'],
      check: '입력 한 번에 비교가 몇 번 일어나는지 셉니다. DB라면 <code>EXPLAIN</code>에서 인덱스를 타는지 봅니다(앞에 %가 있으면 못 탑니다).',
      fix: '접두사 검색은 Trie나 정렬 인덱스의 범위 스캔으로, 부분 일치 검색은 전문 검색(역색인)으로 바꿉니다. 입력에는 디바운스를 둡니다.',
    },
    'lru-cache': {
      cat: ['memory', 'crash'], concept: '상한 없는 캐시 = 메모리 누수',
      symptoms: ['서버 메모리가 시간이 갈수록 오르고, 재시작하면 내려간다', '며칠에 한 번 OOM으로 프로세스가 죽는다 (heap out of memory)', '트래픽이 많을수록 메모리 증가가 빨라진다'],
      check: '시간 간격을 두고 힙 스냅샷을 두 번 떠서 비교합니다. 늘어난 객체의 보유자(retainer)가 모듈 전역 Map·객체·배열이면 확정입니다.',
      fix: '캐시에 크기 상한(LRU)과 만료 시간(TTL)을 둡니다. 키에 사용자 입력이 그대로 들어가지 않게 합니다.',
    },
    'sliding-window': {
      cat: ['slow'], concept: '증분 계산: 겹치는 구간을 다시 계산하지 않기',
      symptoms: ['이동 평균·최근 N분 집계가 구간이 길어질수록 느려진다', '요청마다 최근 기록 전체를 다시 센다', '날짜별로 서브쿼리를 반복하는 통계 쿼리가 느리다'],
      check: '윈도 크기를 2배로 늘려 시간이 2배가 되는지 봅니다. 그렇다면 위치마다 구간 전체를 다시 계산하는 중입니다.',
      fix: '직전 결과에서 빠진 값은 빼고 들어온 값은 더합니다. SQL은 윈도 함수를 씁니다.',
    },
    'topo-sort': {
      cat: ['crash', 'wrong'], concept: '의존성 그래프의 순환',
      symptoms: ['import한 값이 <code>undefined</code>이거나 "is not a function"', '<code>ReferenceError: Cannot access \'X\' before initialization</code>', 'import 순서를 바꾸면 에러가 생겼다 사라진다', '"Circular dependency" 경고, DI 컨테이너의 순환 의존 에러'],
      check: '에러가 난 모듈에서 import를 거슬러 올라가 자기 자신으로 돌아오는 고리를 찾습니다. <code>madge --circular</code> 같은 도구나 번들러 경고가 바로 알려 줍니다.',
      fix: '순서를 맞추지 말고 고리를 끊습니다. 공통 부분을 별도 모듈로 분리하거나, 한쪽 의존을 인터페이스·이벤트·지연 참조로 바꿉니다.',
    },
    'cache-locality': {
      cat: ['slow'], concept: 'CPU 캐시 미스와 메모리 접근 순서',
      symptoms: ['Big-O가 같은 두 구현의 속도가 몇 배씩 차이 난다', '루프 순서만 바꿨는데 빨라졌다', '큰 배열·행렬 처리에서 CPU는 100%인데 처리량이 낮다'],
      check: '데이터 크기를 캐시보다 작게 줄였을 때 차이가 사라지는지 봅니다. <code>perf stat</code>의 cache-misses 수치를 비교합니다.',
      fix: '메모리에 놓인 순서대로 읽습니다. 포인터를 따라가는 구조보다 연속 배열을, 큰 객체 배열보다 필드별 배열을 고려합니다.',
    },
    'event-loop': {
      cat: ['hang', 'slow', 'wrong'], concept: '싱글 스레드 이벤트 루프와 태스크 순서',
      symptoms: ['코드 순서와 실행 순서가 다르다 (로그가 뒤바뀌어 찍힌다)', '무거운 작업 중에 화면이 얼거나 클릭이 먹지 않는다', 'Node 서버에서 요청 하나가 느리면 다른 요청도 전부 느려진다', '<code>setTimeout(fn, 0)</code>이 바로 실행되지 않는다'],
      check: '브라우저는 Performance 탭의 Long Task, Node는 이벤트 루프 지연(<code>monitorEventLoopDelay</code>)을 봅니다. 프로파일에서 긴 동기 함수를 찾습니다.',
      fix: 'CPU 작업은 워커로 옮기거나 잘게 쪼개 중간에 양보합니다. 순서에 의존하는 코드는 <code>await</code>로 명시적으로 잇습니다.',
    },
    'gc': {
      cat: ['memory', 'slow'], concept: '도달 가능성 기반 GC와 누수',
      symptoms: ['페이지를 오래 쓰거나 화면을 오갈수록 메모리가 늘고 느려진다', '응답 시간이 평균은 괜찮은데 가끔 크게 튄다 (p99)', '컴포넌트를 제거했는데 메모리가 줄지 않는다'],
      check: '힙 스냅샷에서 사라졌어야 할 객체를 검색해 보유 경로(retainers)를 따라갑니다. 지연 스파이크는 GC 로그의 일시 정지 시각과 맞춰 봅니다.',
      fix: '리스너·타이머·구독을 해제하고, 전역 컬렉션에서 참조를 지웁니다. 요청마다 만드는 임시 객체를 줄입니다.',
    },
    'closure': {
      cat: ['wrong', 'memory'], concept: '클로저는 값이 아니라 변수를 붙잡는다',
      symptoms: ['루프에서 만든 콜백들이 전부 마지막 값을 출력한다', 'React에서 타이머·이벤트 핸들러가 예전 state를 본다 (카운터가 1에서 멈춘다)', '콜백 안의 변수가 "등록할 때"가 아니라 "실행될 때" 값이다'],
      check: '콜백 안에서 변수를 로그로 찍고, 그 콜백이 <b>언제 만들어졌는지</b>를 확인합니다. React라면 effect의 의존성 배열에서 빠진 값을 찾습니다(lint 규칙 exhaustive-deps).',
      fix: '반복마다 새 변수를 쓰고(<code>let</code>), React는 의존성을 채우거나 함수형 업데이트·ref를 씁니다. 필요 없어진 콜백은 해제합니다.',
    },
    'regex-backtracking': {
      cat: ['hang', 'slow'], concept: '정규식 백트래킹의 지수 폭발 (ReDoS)',
      symptoms: ['특정 입력 하나에서만 CPU가 100%가 되고 응답이 없다', '입력이 조금 길어지면 검증이 몇 초~몇 분 걸린다', '서버가 간헐적으로 통째로 멈췄다가 돌아온다'],
      check: '문제 입력의 길이를 한 글자씩 늘려 시간을 잽니다. 한 글자마다 약 2배가 되면 백트래킹입니다. 프로파일에 RegExp 실행이 대부분으로 나옵니다.',
      fix: '반복 안의 반복·겹치는 선택지를 없앱니다. 입력 길이를 먼저 제한하고, 가능하면 선형 시간 엔진이나 전용 파서를 씁니다.',
    },
    'async-parallel': {
      cat: ['slow'], concept: '독립적인 I/O 대기를 순차로 실행',
      symptoms: ['API 응답 시간이 내부 호출 시간들의 합과 같다', '트레이스에서 스팬이 계단 모양으로 이어진다', '<code>for</code> 루프 안에 <code>await</code>가 있다'],
      check: '각 호출의 시작·종료 시각을 로그로 남깁니다. 앞 호출이 끝난 직후 다음 호출이 시작되고, 뒤 호출이 앞 결과를 쓰지 않으면 대상입니다.',
      fix: '<code>Promise.all</code>로 묶되 동시 실행 수에 상한을 둡니다. 일부 실패를 허용하려면 <code>allSettled</code>.',
    },
    'db-index': {
      cat: ['slow'], concept: '풀 스캔 O(n) → B-Tree 인덱스 O(log n)',
      symptoms: ['테이블이 커지면서 특정 쿼리가 점점 느려진다', '슬로우 쿼리 로그에 같은 쿼리가 계속 올라온다', '인덱스를 만들었는데도 느리다'],
      check: '<code>EXPLAIN</code>(가능하면 <code>EXPLAIN ANALYZE</code>)으로 실행 계획을 봅니다. Seq Scan / type=ALL이고 읽은 행 수가 반환 행 수보다 훨씬 많으면 인덱스 문제입니다.',
      fix: '조건·정렬 컬럼에 맞는 인덱스를 만듭니다. 컬럼에 함수를 씌우지 않고, 복합 인덱스는 컬럼 순서를 조건에 맞춥니다. 추가 후 실행 계획이 바뀌었는지 확인합니다.',
    },
    'race-condition': {
      cat: ['flaky', 'data'], concept: '경쟁 상태: 읽기 → 판단 → 쓰기 사이의 끼어들기',
      symptoms: ['재고가 음수가 되거나 쿠폰이 한도보다 많이 발급된다', '카운터·잔액이 가끔 실제보다 적다', '부하 테스트나 운영에서만 나오고 로컬에서는 재현되지 않는다', '동시에 저장하면 한쪽 변경이 사라진다'],
      check: '같은 요청을 동시에 수십 개 보내 봅니다(부하 도구, <code>Promise.all</code>). 결과가 요청 수와 다르면 확정입니다. 코드에서 "SELECT 후 계산해서 UPDATE" 패턴을 찾습니다.',
      fix: '판정을 한 번의 원자적 연산으로 만듭니다: 조건부 UPDATE, 유니크 제약, 낙관적 락(version), <code>SELECT … FOR UPDATE</code>, 원자적 증가.',
    },
    'n-plus-one': {
      cat: ['slow'], concept: 'N+1 쿼리: 루프 안의 I/O',
      symptoms: ['목록 API가 항목 수에 비례해 느려진다', '요청 하나에 SQL 로그가 수십~수백 줄 찍힌다', '슬로우 쿼리는 하나도 없는데 API는 느리다', '로컬에서는 빠른데 운영에서 느리다'],
      check: '요청 하나의 쿼리 수를 셉니다(ORM 쿼리 로그, APM). 모양이 같고 id만 다른 쿼리가 줄줄이 나오면 N+1입니다.',
      fix: 'id를 모아 <code>IN</code>으로 한 번에 조회하거나 JOIN·eager loading을 씁니다. GraphQL은 DataLoader로 묶습니다.',
    },
    'deadlock': {
      cat: ['hang', 'flaky'], concept: '데드락: 락 획득 순서의 순환',
      symptoms: ['요청이 멈추고 타임아웃이 나는데 CPU는 거의 0%다', 'DB 에러: "Deadlock found when trying to get lock"', '동시 요청이 많을 때만 가끔 발생한다'],
      check: '스레드 덤프에서 서로의 락을 기다리는 BLOCKED 스레드를 찾습니다. DB는 데드락 로그(<code>SHOW ENGINE INNODB STATUS</code>, pg_locks)에서 두 트랜잭션이 잡은 락과 기다린 락을 봅니다.',
      fix: '여러 자원을 잠글 때 항상 같은 순서로 잡습니다. 트랜잭션을 짧게 하고, 락 타임아웃과 재시도를 둡니다.',
    },
    'pagination': {
      cat: ['slow', 'data'], concept: 'OFFSET의 읽고 버리기 / 커서 페이지네이션',
      symptoms: ['목록의 뒤 페이지로 갈수록 느려진다', '스크롤하다 보면 같은 항목이 두 번 나오거나 빠진다', '전체 데이터를 페이지 단위로 내려받는 배치가 갈수록 느려진다'],
      check: '1페이지와 1,000페이지의 쿼리 시간을 비교합니다. <code>EXPLAIN ANALYZE</code>에서 읽은 행 수가 OFFSET만큼 늘어나는지 봅니다.',
      fix: '마지막으로 본 정렬 키를 조건으로 거는 커서 방식으로 바꿉니다. 정렬 키는 유일하게(예: <code>(created_at, id)</code>) 만듭니다.',
    },
    'cache-stampede': {
      cat: ['slow', 'flaky'], concept: '캐시 스탬피드: 만료 시점의 동시 재생성',
      symptoms: ['DB 부하가 일정한 주기로 튄다 (캐시 TTL과 같은 간격)', '배포 직후나 캐시 서버 재시작 직후에 장애가 난다', '같은 무거운 쿼리가 동시에 여러 개 실행 중이다'],
      check: 'DB에서 실행 중인 쿼리 목록에 같은 쿼리가 여러 개 떠 있는지 봅니다. 스파이크 간격과 TTL을 비교합니다.',
      fix: '진행 중인 재생성을 공유하고(single-flight, 분산 락), TTL에 지터를 넣고, 만료된 값을 주면서 뒤에서 갱신합니다.',
    },
    'connection-pool': {
      cat: ['hang', 'flaky'], concept: '한정된 자원의 반환 누락 (풀 고갈)',
      symptoms: ['시간이 지나면 모든 요청이 타임아웃되고, 재시작하면 한동안 정상이다', '에러: "Timeout acquiring connection", "too many connections"', 'DB는 한가한데 애플리케이션만 멈춘다', '"Too many open files"'],
      check: '풀 지표(사용 중·유휴·대기)를 봅니다. 사용 중인 수가 트래픽과 무관하게 계단식으로 올라 내려오지 않으면 누수입니다. 에러율이 오른 시점과 맞춰 봅니다.',
      fix: '획득 직후 try, 반환은 finally에 둡니다. 커넥션을 쥔 채 외부 API를 부르지 않습니다. 획득 타임아웃과 누수 감지 옵션을 켭니다.',
    },
    'consistent-hashing': {
      cat: ['slow', 'flaky'], concept: '노드 수 변경 시 키 재배치 (modulo vs 일관 해싱)',
      symptoms: ['캐시 서버를 늘리거나 한 대가 죽은 직후 적중률이 급락한다', '증설했는데 오히려 DB 부하가 폭증한다', '샤드를 추가하려니 거의 모든 데이터를 옮겨야 한다'],
      check: '캐시 적중률 그래프와 노드 변경 시각을 겹쳐 봅니다. 클라이언트의 키 분배 방식이 modulo인지 확인합니다.',
      fix: '일관 해싱이나 고정 슬롯 매핑을 씁니다. 노드 변경은 트래픽이 적을 때, 캐시를 데우면서 점진적으로 합니다.',
    },
    'idempotency': {
      cat: ['data', 'flaky'], concept: '재시도와 멱등성',
      symptoms: ['결제·주문·포인트가 가끔 두 번 처리된다', '알림이나 메일이 중복으로 간다', '타임아웃이 난 요청이 사실은 성공해 있었다', '메시지 큐 컨슈머가 같은 메시지를 두 번 처리한다'],
      check: '중복된 두 건의 시각 차이를 봅니다. 클라이언트 타임아웃·재시도 간격과 같으면 재시도입니다. 게이트웨이·프록시의 자동 재시도 설정도 확인합니다.',
      fix: '요청에 멱등 키를 싣고 서버가 유니크 제약으로 중복을 판정합니다. 연산 자체를 "더하기"가 아닌 "상태 설정"으로 설계합니다.',
    },
  };
})();
