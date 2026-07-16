// ============ TAB SWITCHING ============
document.querySelectorAll(".pit-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".pit-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.panel).classList.add("active");
  });
});

// ============ HELPERS ============
function pct(x) { return (x * 100).toFixed(3) + "%"; }

function resultCard(label, value, sub, cls) {
  return `<div class="result-card ${cls || ''}">
    <span class="label">${label}</span>
    <div class="value">${value}</div>
    <span class="sub">${sub || ''}</span>
  </div>`;
}

// deterministic pseudo-random generator seeded by a number (mulberry32)
function mulberry32(seed) {
  return function() {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ============ BEAD ROAD (Big Road style) RENDERING ============
// Generates a plausible outcome sequence matching given probabilities,
// then lays it out using real casino "Big Road" placement rules:
// same result continues down a column; a different result starts a new
// column; a Tie does not advance the column, it marks a green diagonal
// stripe on the current cell instead.
function generateOutcomeSequence(probs, n, seed) {
  const rand = mulberry32(seed);
  const seq = [];
  for (let i = 0; i < n; i++) {
    const r = rand();
    if (r < probs.Player) seq.push("Player");
    else if (r < probs.Player + probs.Banker) seq.push("Banker");
    else seq.push("Tie");
  }
  return seq;
}

function layoutBigRoad(seq, maxRows) {
  const cols = [];
  let col = [];
  let lastMain = null;
  seq.forEach(res => {
    if (res === "Tie") {
      if (col.length === 0) { col.push({ main: "Tie", ties: 0 }); lastMain = null; }
      else { col[col.length - 1].ties = (col[col.length - 1].ties || 0) + 1; }
      return;
    }
    if (res === lastMain && col.length < maxRows) {
      col.push({ main: res, ties: 0 });
    } else {
      if (col.length) cols.push(col);
      col = [{ main: res, ties: 0 }];
      lastMain = res;
    }
  });
  if (col.length) cols.push(col);
  return cols;
}

const BEAD_COLORS = { Player: "#2E5C8A", Banker: "#A63A34", Tie: "#3F8F5D" };

function renderBeadRoadSVG(probs, opts) {
  const seed = (opts && opts.seed) || 7;
  const rows = (opts && opts.rows) || 6;
  const cols = (opts && opts.cols) || 16;
  const n = (opts && opts.n) || rows * cols * 1.4;
  const cell = 26;
  const w = cols * cell;
  const h = rows * cell;

  const seq = generateOutcomeSequence(probs, Math.floor(n), seed);
  const laidOut = layoutBigRoad(seq, rows).slice(0, cols);

  let circles = "";
  laidOut.forEach((colArr, ci) => {
    colArr.forEach((cellData, ri) => {
      const cx = ci * cell + cell / 2;
      const cy = ri * cell + cell / 2;
      if (cellData.main === "Tie") {
        circles += `<circle cx="${cx}" cy="${cy}" r="9" fill="none" stroke="${BEAD_COLORS.Tie}" stroke-width="2.5"/>`;
      } else {
        circles += `<circle cx="${cx}" cy="${cy}" r="9.5" fill="${BEAD_COLORS[cellData.main]}" opacity="0.92"/>`;
        if (cellData.ties) {
          circles += `<line x1="${cx-7}" y1="${cy+7}" x2="${cx+7}" y2="${cy-7}" stroke="${BEAD_COLORS.Tie}" stroke-width="2"/>`;
        }
      }
    });
  });

  let grid = "";
  for (let c = 0; c <= cols; c++) grid += `<line x1="${c*cell}" y1="0" x2="${c*cell}" y2="${h}" stroke="rgba(201,162,39,0.15)"/>`;
  for (let r = 0; r <= rows; r++) grid += `<line x1="0" y1="${r*cell}" x2="${w}" y2="${r*cell}" stroke="rgba(201,162,39,0.15)"/>`;

  return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">${grid}${circles}</svg>`;
}

// ============ PANEL 1: EXACT ENGINE ============
document.getElementById("exact-run").addEventListener("click", async () => {
  const decks = document.getElementById("exact-decks").value;
  const btn = document.getElementById("exact-run");
  btn.disabled = true; btn.textContent = "Đang tính...";
  try {
    const res = await fetch("/api/exact", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ num_decks: parseInt(decks) })
    });
    const d = await res.json();
    document.getElementById("exact-results").innerHTML =
      resultCard("Banker thắng", pct(d.Banker), "commission 5% khi ăn", "banker") +
      resultCard("Player thắng", pct(d.Player), "", "player") +
      resultCard("Tie (hoà)", pct(d.Tie), "trả 8:1 (tuỳ sòng)", "tie") +
      resultCard("Player Pair", pct(d.PlayerPair), "cặp đôi 2 lá đầu") +
      resultCard("Banker Pair", pct(d.BankerPair), "cặp đôi 2 lá đầu");
    document.getElementById("exact-bead").innerHTML = renderBeadRoadSVG(d, { seed: 11 });
  } finally {
    btn.disabled = false; btn.textContent = "Tính chính xác";
  }
});

// ============ HERO BEAD (decorative, precomputed 8-deck standard odds) ============
(function initHero() {
  const standard = { Player: 0.4463, Banker: 0.4586, Tie: 0.0951 };
  document.getElementById("hero-bead").innerHTML = renderBeadRoadSVG(standard, { seed: 3, cols: 14, rows: 6 });
})();

// ============ PANEL 2: SHOE / CARD COUNTING ENGINE ============
const rankGrid = document.getElementById("shoe-rank-grid");
for (let v = 0; v <= 9; v++) {
  const label = v === 0 ? "10/J/Q/K" : (v === 1 ? "A" : String(v));
  const cellDiv = document.createElement("div");
  cellDiv.className = "rank-cell";
  cellDiv.innerHTML = `<span class="rank-label">${label}</span><input type="number" min="0" value="0" data-rank="${v}">`;
  rankGrid.appendChild(cellDiv);
}

document.getElementById("shoe-reset").addEventListener("click", () => {
  rankGrid.querySelectorAll("input").forEach(inp => inp.value = 0);
});

document.getElementById("shoe-run").addEventListener("click", async () => {
  const decks = document.getElementById("shoe-decks").value;
  const removed = Array.from(rankGrid.querySelectorAll("input")).map(i => parseInt(i.value) || 0);
  const btn = document.getElementById("shoe-run");
  btn.disabled = true; btn.textContent = "Đang tính...";
  try {
    const res = await fetch("/api/shoe", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ num_decks: parseInt(decks), removed_counts: removed })
    });
    const d = await res.json();
    document.getElementById("shoe-results").innerHTML =
      resultCard("Banker thắng", pct(d.Banker), "", "banker") +
      resultCard("Player thắng", pct(d.Player), "", "player") +
      resultCard("Tie (hoà)", pct(d.Tie), "", "tie") +
      resultCard("Player Pair", pct(d.PlayerPair), "") +
      resultCard("Banker Pair", pct(d.BankerPair), "");
  } finally {
    btn.disabled = false; btn.textContent = "Tính xác suất còn lại";
  }
});

// ============ PANEL 3: MONTE CARLO ============
document.getElementById("mc-run").addEventListener("click", async () => {
  const decks = document.getElementById("mc-decks").value;
  const hands = document.getElementById("mc-hands").value;
  const btn = document.getElementById("mc-run");
  const status = document.getElementById("mc-status");
  btn.disabled = true; btn.textContent = "Đang mô phỏng...";
  status.textContent = `Đang xáo bài và chơi ${parseInt(hands).toLocaleString('vi-VN')} ván...`;
  try {
    const res = await fetch("/api/montecarlo", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ num_decks: parseInt(decks), num_hands: parseInt(hands) })
    });
    const d = await res.json();
    status.textContent = `Hoàn tất ${d.num_hands.toLocaleString('vi-VN')} ván. Khoảng tin cậy 95% hiển thị bên dưới.`;
    document.getElementById("mc-results").innerHTML =
      resultCard("Banker thắng", pct(d.Banker.prob), `KTC: ${pct(d.Banker.ci_low)} – ${pct(d.Banker.ci_high)}`, "banker") +
      resultCard("Player thắng", pct(d.Player.prob), `KTC: ${pct(d.Player.ci_low)} – ${pct(d.Player.ci_high)}`, "player") +
      resultCard("Tie (hoà)", pct(d.Tie.prob), `KTC: ${pct(d.Tie.ci_low)} – ${pct(d.Tie.ci_high)}`, "tie") +
      resultCard("Player Pair", pct(d.PlayerPair.prob), `n=${d.PlayerPair.count}`) +
      resultCard("Banker Pair", pct(d.BankerPair.prob), `n=${d.BankerPair.count}`);
  } finally {
    btn.disabled = false; btn.textContent = "Chạy mô phỏng";
  }
});

// ============ PANEL 4: BETTING STRATEGY LAB ============
let bankrollChart = null;

function drawBankrollChart(history, startingBankroll) {
  const ctx = document.getElementById("bankroll-chart").getContext("2d");
  if (bankrollChart) bankrollChart.destroy();
  bankrollChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: history.map((_, i) => i),
      datasets: [{
        label: "Vốn (bankroll)",
        data: history,
        borderColor: "#C9A227",
        backgroundColor: "rgba(201,162,39,0.1)",
        pointRadius: 0,
        borderWidth: 1.6,
        tension: 0.1,
        fill: true,
      }]
    },
    options: {
      responsive: true,
      animation: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { display: false },
        y: {
          grid: { color: "rgba(201,162,39,0.1)" },
          ticks: { color: "#EDE6D6", font: { family: "IBM Plex Mono" } }
        }
      }
    }
  });
}

document.getElementById("bet-run").addEventListener("click", async () => {
  const payload = {
    strategy: document.getElementById("bet-strategy").value,
    bet_on: document.getElementById("bet-on").value,
    base_bet: parseFloat(document.getElementById("bet-base").value),
    starting_bankroll: parseFloat(document.getElementById("bet-bankroll").value),
    num_hands: parseInt(document.getElementById("bet-hands").value),
  };
  const btn = document.getElementById("bet-run");
  btn.disabled = true; btn.textContent = "Đang mô phỏng...";
  try {
    const res = await fetch("/api/betting/simulate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const d = await res.json();
    const netCls = d.net_result >= 0 ? "player" : "banker";
    document.getElementById("bet-summary").innerHTML =
      resultCard("Vốn cuối cùng", d.final_bankroll.toFixed(2), `${d.hands_played} ván đã chơi`, netCls) +
      resultCard("Lãi / Lỗ ròng", (d.net_result >= 0 ? "+" : "") + d.net_result.toFixed(2), "", netCls) +
      resultCard("Trạng thái", d.busted ? "Cháy vốn" : (d.hit_stop_win ? "Đạt mục tiêu" : "Chơi hết ván"), "");
    drawBankrollChart(d.history, payload.starting_bankroll);
  } finally {
    btn.disabled = false; btn.textContent = "Mô phỏng 1 lượt";
  }
});

document.getElementById("risk-run").addEventListener("click", async () => {
  const payload = {
    strategy: document.getElementById("bet-strategy").value,
    bet_on: document.getElementById("bet-on").value,
    base_bet: parseFloat(document.getElementById("bet-base").value),
    starting_bankroll: parseFloat(document.getElementById("bet-bankroll").value),
    num_hands: parseInt(document.getElementById("bet-hands").value),
    trials: 300,
  };
  const btn = document.getElementById("risk-run");
  btn.disabled = true; btn.textContent = "Đang chạy 300 lượt...";
  try {
    const res = await fetch("/api/betting/risk", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const d = await res.json();
    const box = document.getElementById("risk-summary");
    box.classList.add("show");
    box.innerHTML = `Trên ${d.trials} lượt mô phỏng độc lập (mỗi lượt ${payload.num_hands} ván):<br>
      · Xác suất cháy hết vốn: <strong>${pct(d.bust_probability)}</strong><br>
      · Vốn cuối trung bình: <strong>${d.avg_final_bankroll.toFixed(2)}</strong><br>
      · Lãi/lỗ ròng trung bình: <strong>${d.avg_net_result.toFixed(2)}</strong>`;
  } finally {
    btn.disabled = false; btn.textContent = "Ước lượng nguy cơ cháy vốn (300 lượt)";
  }
});

// ============ PANEL 5: LIVE TRACKER (Bead/Big Road + derived roads) ============
let liveEntries = []; // { result: 'Player'|'Banker'|'Tie', pp: bool, bp: bool }

// --- Big Road built from ACTUAL entered results (streak-column layout) ---
function buildBigRoadFromEntries(entries, maxRows) {
  const cols = [];
  let col = [];
  let lastMain = null;
  entries.forEach(e => {
    if (e.result === "Tie") {
      if (col.length === 0) {
        col.push({ main: "Tie", ties: 0, pp: e.pp, bp: e.bp });
        lastMain = null;
      } else {
        const last = col[col.length - 1];
        last.ties = (last.ties || 0) + 1;
        if (e.pp) last.pp = true;
        if (e.bp) last.bp = true;
      }
      return;
    }
    if (e.result === lastMain && col.length < maxRows) {
      col.push({ main: e.result, ties: 0, pp: e.pp, bp: e.bp });
    } else {
      if (col.length) cols.push(col);
      col = [{ main: e.result, ties: 0, pp: e.pp, bp: e.bp }];
      lastMain = e.result;
    }
  });
  if (col.length) cols.push(col);
  return cols;
}

// --- Bead Road: strictly chronological, one bead per hand, top-to-bottom then next column ---
function buildBeadGrid(entries, rows) {
  return entries.map((e, i) => ({
    col: Math.floor(i / rows), row: i % rows,
    type: e.result, pp: e.pp, bp: e.bp,
  }));
}

// --- Derived roads: Big Eye Boy (n=1), Small Road (n=2), Cockroach Road (n=3) ---
// Standard casino rule: compare the length of the column n+1 back to the
// column n back (new column started), or check whether the column n back
// has an entry at the same row (continuing a column). Red = matches
// pattern, Blue = breaks pattern. Ties are skipped entirely.
function deriveMarkSequence(cols, n) {
  const marks = [];
  for (let i = 0; i < cols.length; i++) {
    const col = cols[i];
    for (let j = 0; j < col.length; j++) {
      if (col[j].main === "Tie") continue;
      let mark = null;
      if (j === 0) {
        if (i >= n + 1) {
          const refA = cols[i - n - 1].length;
          const refB = cols[i - n].length;
          mark = (refA === refB) ? "red" : "blue";
        }
      } else {
        if (i >= n) {
          mark = (cols[i - n].length > j) ? "red" : "blue";
        }
      }
      if (mark) marks.push(mark);
    }
  }
  return marks;
}

function layoutSimpleRoad(markSeq, maxRows) {
  const cols = [];
  let col = [];
  let last = null;
  markSeq.forEach(m => {
    if (m === last && col.length < maxRows) {
      col.push(m);
    } else {
      if (col.length) cols.push(col);
      col = [m];
      last = m;
    }
  });
  if (col.length) cols.push(col);
  return cols;
}

// --- Rendering ---
function renderBigRoadFromCols(cols, cell) {
  cell = cell || 24;
  const rows = 6;
  const visCols = cols.slice(-40); // hien thi toi da 40 cot gan nhat
  const w = Math.max(visCols.length, 1) * cell;
  const h = rows * cell;
  let marks = "";
  visCols.forEach((colArr, ci) => {
    colArr.forEach((c, ri) => {
      const cx = ci * cell + cell / 2, cy = ri * cell + cell / 2;
      if (c.main === "Tie") {
        marks += `<circle cx="${cx}" cy="${cy}" r="${cell*0.34}" fill="none" stroke="${BEAD_COLORS.Tie}" stroke-width="2.2"/>`;
      } else {
        marks += `<circle cx="${cx}" cy="${cy}" r="${cell*0.36}" fill="${BEAD_COLORS[c.main]}" opacity="0.92"/>`;
        if (c.ties) marks += `<line x1="${cx-cell*0.27}" y1="${cy+cell*0.27}" x2="${cx+cell*0.27}" y2="${cy-cell*0.27}" stroke="${BEAD_COLORS.Tie}" stroke-width="2"/>`;
      }
      if (c.pp) marks += `<circle cx="${cx - cell*0.32}" cy="${cy - cell*0.32}" r="${cell*0.11}" fill="${BEAD_COLORS.Player}" stroke="#fff" stroke-width="0.6"/>`;
      if (c.bp) marks += `<circle cx="${cx + cell*0.32}" cy="${cy + cell*0.32}" r="${cell*0.11}" fill="${BEAD_COLORS.Banker}" stroke="#fff" stroke-width="0.6"/>`;
    });
  });
  let grid = "";
  for (let c = 0; c <= visCols.length; c++) grid += `<line x1="${c*cell}" y1="0" x2="${c*cell}" y2="${h}" stroke="rgba(201,162,39,0.15)"/>`;
  for (let r = 0; r <= rows; r++) grid += `<line x1="0" y1="${r*cell}" x2="${w}" y2="${r*cell}" stroke="rgba(201,162,39,0.15)"/>`;
  return `<svg viewBox="0 0 ${Math.max(w,cell)} ${h}" xmlns="http://www.w3.org/2000/svg">${grid}${marks}</svg>`;
}

function renderBeadGridSVG(entries, cell) {
  cell = cell || 22;
  const rows = 6;
  const grid = buildBeadGrid(entries, rows);
  const numCols = grid.length ? Math.max(...grid.map(g => g.col)) + 1 : 1;
  const visible = grid.filter(g => g.col >= numCols - 40);
  const minCol = visible.length ? Math.min(...visible.map(g => g.col)) : 0;
  const w = Math.max(numCols - minCol, 1) * cell;
  const h = rows * cell;
  let marks = "";
  visible.forEach(g => {
    const ci = g.col - minCol;
    const cx = ci * cell + cell / 2, cy = g.row * cell + cell / 2;
    if (g.type === "Tie") {
      marks += `<circle cx="${cx}" cy="${cy}" r="${cell*0.36}" fill="${BEAD_COLORS.Tie}" opacity="0.92"/>`;
    } else {
      marks += `<circle cx="${cx}" cy="${cy}" r="${cell*0.36}" fill="${BEAD_COLORS[g.type]}" opacity="0.92"/>`;
    }
    if (g.pp) marks += `<circle cx="${cx - cell*0.3}" cy="${cy - cell*0.3}" r="${cell*0.1}" fill="${BEAD_COLORS.Player}" stroke="#fff" stroke-width="0.6"/>`;
    if (g.bp) marks += `<circle cx="${cx + cell*0.3}" cy="${cy + cell*0.3}" r="${cell*0.1}" fill="${BEAD_COLORS.Banker}" stroke="#fff" stroke-width="0.6"/>`;
  });
  let gridLines = "";
  for (let c = 0; c <= (w/cell); c++) gridLines += `<line x1="${c*cell}" y1="0" x2="${c*cell}" y2="${h}" stroke="rgba(201,162,39,0.15)"/>`;
  for (let r = 0; r <= rows; r++) gridLines += `<line x1="0" y1="${r*cell}" x2="${w}" y2="${r*cell}" stroke="rgba(201,162,39,0.15)"/>`;
  return `<svg viewBox="0 0 ${Math.max(w,cell)} ${h}" xmlns="http://www.w3.org/2000/svg">${gridLines}${marks}</svg>`;
}

function renderSimpleRoadSVG(markCols, cell) {
  cell = cell || 16;
  const rows = 6;
  const visCols = markCols.slice(-50);
  const w = Math.max(visCols.length, 1) * cell;
  const h = rows * cell;
  let marks = "";
  visCols.forEach((colArr, ci) => {
    colArr.forEach((m, ri) => {
      const cx = ci * cell + cell / 2, cy = ri * cell + cell / 2;
      const color = m === "red" ? BEAD_COLORS.Banker : BEAD_COLORS.Player;
      marks += `<circle cx="${cx}" cy="${cy}" r="${cell*0.3}" fill="none" stroke="${color}" stroke-width="2"/>`;
    });
  });
  let gridLines = "";
  for (let c = 0; c <= visCols.length; c++) gridLines += `<line x1="${c*cell}" y1="0" x2="${c*cell}" y2="${h}" stroke="rgba(201,162,39,0.12)"/>`;
  for (let r = 0; r <= rows; r++) gridLines += `<line x1="0" y1="${r*cell}" x2="${w}" y2="${r*cell}" stroke="rgba(201,162,39,0.12)"/>`;
  return `<svg viewBox="0 0 ${Math.max(w,cell)} ${h}" xmlns="http://www.w3.org/2000/svg">${gridLines}${marks}</svg>`;
}

function renderLiveStats() {
  const counts = { Player: 0, Banker: 0, Tie: 0 };
  let pp = 0, bp = 0;
  liveEntries.forEach(e => {
    counts[e.result]++;
    if (e.pp) pp++;
    if (e.bp) bp++;
  });
  // cau hien tai (current non-tie streak)
  let streakSide = null, streakLen = 0;
  for (let i = liveEntries.length - 1; i >= 0; i--) {
    const r = liveEntries[i].result;
    if (r === "Tie") continue;
    if (streakSide === null) { streakSide = r; streakLen = 1; }
    else if (r === streakSide) { streakLen++; }
    else break;
  }
  const total = liveEntries.length;
  document.getElementById("live-stats").innerHTML =
    resultCard("Banker", counts.Banker, total ? pct(counts.Banker/total) : "", "banker") +
    resultCard("Player", counts.Player, total ? pct(counts.Player/total) : "", "player") +
    resultCard("Tie", counts.Tie, total ? pct(counts.Tie/total) : "", "tie") +
    resultCard("Player Pair", pp, `${total} ván`) +
    resultCard("Banker Pair", bp, `${total} ván`) +
    resultCard("Cầu hiện tại", streakSide ? `${streakLen} ${streakSide === "Banker" ? "Banker" : "Player"}` : "—", "", streakSide ? streakSide.toLowerCase() : "");
}

function getPredictionInsight(entries) {
  const baseline = { Player: 0.4463, Banker: 0.4586, Tie: 0.0951 };
  const scores = { ...baseline };
  if (!entries.length) {
    return {
      result: "Banker",
      probability: baseline.Banker,
      reason: "Mặc định theo xác suất chuẩn của baccarat: Banker vẫn là lựa chọn có lợi thế nhất."
    };
  }

  const recent = entries.slice(-8);
  const recentCounts = { Player: 0, Banker: 0, Tie: 0 };
  recent.forEach(e => recentCounts[e.result]++);
  const last = recent[recent.length - 1];

  // ưu tiên xu hướng gần đây
  if (last) {
    const prev = recent[recent.length - 2];
    if (prev && prev.result === last.result) {
      scores[last.result] += 0.07;
    } else {
      scores[last.result] += 0.03;
    }
  }

  // nếu 3 ván gần nhất giống nhau thì tiếp tục xu hướng đó
  if (recent.length >= 3) {
    const tail = recent.slice(-3).map(e => e.result);
    if (tail[0] === tail[1] && tail[1] === tail[2]) {
      scores[tail[0]] += 0.08;
    } else if (tail[0] !== tail[1] && tail[1] !== tail[2] && tail[0] !== tail[2]) {
      scores[tail[tail.length - 1]] += 0.04;
    }
  }

  // nếu tie xuất hiện nhiều thì tăng trọng số tie nhẹ
  const tieShare = recentCounts.Tie / recent.length;
  if (tieShare >= 0.25) {
    scores.Tie += 0.05;
  } else if (tieShare >= 0.15) {
    scores.Tie += 0.03;
  }

  // tăng thêm nếu đang có chuỗi liên tiếp cùng một bên
  let streakSide = null;
  let streakLen = 0;
  for (let i = recent.length - 1; i >= 0; i--) {
    const r = recent[i].result;
    if (r === "Tie") break;
    if (streakSide === null) { streakSide = r; streakLen = 1; }
    else if (r === streakSide) { streakLen++; }
    else break;
  }
  if (streakLen >= 2 && streakSide) {
    scores[streakSide] += 0.06 * Math.min(streakLen, 3);
  }

  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  const probs = {
    Player: scores.Player / total,
    Banker: scores.Banker / total,
    Tie: scores.Tie / total,
  };

  const ranked = Object.entries(probs).sort((a, b) => b[1] - a[1]);
  const [result, probability] = ranked[0];

  let reason = `Dựa theo ${recent.length} ván gần nhất và xác suất chuẩn, ${result} đang có ưu thế.`;
  if (streakLen >= 2 && streakSide) {
    reason += ` Hiện có chuỗi ${streakLen} ván ${streakSide} liên tiếp.`;
  }
  if (recentCounts.Tie >= 2) {
    reason += ` Tie xuất hiện khá thường xuyên, nên cần giữ mắt đến cú bật tie.`;
  }

  return { result, probability, reason };
}

function renderPrediction() {
  const prediction = getPredictionInsight(liveEntries);
  const label = prediction.result === "Banker" ? "Banker" : prediction.result === "Player" ? "Player" : "Tie";
  const confidence = pct(prediction.probability);
  document.getElementById("live-prediction").innerHTML = `
    <div class="prediction-pill ${prediction.result.toLowerCase()}">${label}</div>
    <div class="prediction-text">
      <strong>${confidence}</strong> khả năng xảy ra cho ván tiếp theo.<br>
      ${prediction.reason}
    </div>`;
}

function renderLiveAll() {
  renderLiveStats();
  renderPrediction();
  const bigRoadCols = buildBigRoadFromEntries(liveEntries, 6);
  document.getElementById("live-bead").innerHTML = renderBeadGridSVG(liveEntries, 22);
  document.getElementById("live-bigroad").innerHTML = renderBigRoadFromCols(bigRoadCols, 24);
  document.getElementById("live-bigeye").innerHTML = renderSimpleRoadSVG(layoutSimpleRoad(deriveMarkSequence(bigRoadCols, 1), 6), 16);
  document.getElementById("live-smallroad").innerHTML = renderSimpleRoadSVG(layoutSimpleRoad(deriveMarkSequence(bigRoadCols, 2), 6), 16);
  document.getElementById("live-cockroach").innerHTML = renderSimpleRoadSVG(layoutSimpleRoad(deriveMarkSequence(bigRoadCols, 3), 6), 16);
}

function addLiveEntry(result) {
  const pp = document.getElementById("live-pp").checked;
  const bp = document.getElementById("live-bp").checked;
  liveEntries.push({ result, pp, bp });
  document.getElementById("live-pp").checked = false;
  document.getElementById("live-bp").checked = false;
  renderLiveAll();
}

document.getElementById("live-add-player").addEventListener("click", () => addLiveEntry("Player"));
document.getElementById("live-add-banker").addEventListener("click", () => addLiveEntry("Banker"));
document.getElementById("live-add-tie").addEventListener("click", () => addLiveEntry("Tie"));
document.getElementById("live-undo").addEventListener("click", () => { liveEntries.pop(); renderLiveAll(); });
document.getElementById("live-reset").addEventListener("click", () => { liveEntries = []; renderLiveAll(); });
document.getElementById("live-predict").addEventListener("click", () => renderPrediction());

renderLiveAll();

// auto-run exact engine once on load for immediate content
document.getElementById("exact-run").click();
