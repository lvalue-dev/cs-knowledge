/* 레슨 등록 + 실행 추적(trace) 도구. 레슨은 실제 알고리즘을 돌리면서 t.step()으로 매 줄의 상태를 기록한다. */
(function () {
  const CS = (window.CS = { lessons: [] });

  CS.add = (lesson) => CS.lessons.push(lesson);

  // variant.run(t, n)을 실행해 단계 목록을 만든다. 각 단계는 실행 줄, 설명, 시각화 패널, 누적 지표, 줄별 실행 횟수를 담는다.
  CS.trace = (variant, n) => {
    const steps = [], m = {}, hits = {};
    const t = {
      m,
      step(line, msg, panels) {
        if (line) hits[line] = (hits[line] || 0) + 1;
        steps.push({ line, msg, panels, m: { ...m }, hits: { ...hits } });
      },
    };
    variant.run(t, n);
    return steps;
  };

  // 시드 고정 셔플: 1..n 순열 (매번 같은 결과)
  CS.perm = (n, seed = 7) => {
    const a = Array.from({ length: n }, (_, i) => i + 1);
    let s = seed;
    for (let i = n - 1; i > 0; i--) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      const j = s % (i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  // 트리 배치: nodes = [{id, parent}] (생성 순서) → { pos: {id: {x, y}}, w, h }
  CS.layoutTree = (nodes, dx = 40, dy = 54) => {
    const kids = {}, pos = {};
    let root = null, leaf = 0, maxD = 0;
    for (const n of nodes) {
      if (n.parent == null) root = n.id;
      else (kids[n.parent] = kids[n.parent] || []).push(n.id);
    }
    const walk = (id, d) => {
      maxD = Math.max(maxD, d);
      const ch = kids[id] || [];
      let x;
      if (!ch.length) x = leaf++ * dx;
      else {
        const xs = ch.map((c) => walk(c, d + 1));
        x = (xs[0] + xs[xs.length - 1]) / 2;
      }
      pos[id] = { x: x + dx / 2 + 6, y: d * dy + 24 };
      return x;
    };
    if (root != null) walk(root, 0);
    return { pos, w: leaf * dx + 12, h: maxD * dy + 62 };
  };
})();
