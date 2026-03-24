const TOTAL_LEVELS = 100;
const QUESTIONS_PER_LEVEL = 30;
const QUIZ_TIME_SECONDS = 60 * 60; // 60分鐘

let currentLevel = 1;
let player = "";
let currentSet = [];
let answered = false;

let timer = null;
let timeLeft = QUIZ_TIME_SECONDS;

/* =========================
   本機儲存
========================= */
function getUnlocked() {
  return JSON.parse(localStorage.getItem("zhGameUnlocked") || "1");
}

function setUnlocked(n) {
  localStorage.setItem("zhGameUnlocked", JSON.stringify(n));
}

function getHistory() {
  return JSON.parse(localStorage.getItem("zhGameHistory") || "[]");
}

function setHistory(arr) {
  localStorage.setItem("zhGameHistory", JSON.stringify(arr));
}

function addHistory(record) {
  const history = getHistory();
  history.unshift(record);
  // 只保留最近100筆
  setHistory(history.slice(0, 100));
}

function clearHistory() {
  if (confirm("確定要清除所有歷史成績紀錄？")) {
    localStorage.removeItem("zhGameHistory");
    renderHistory();
    alert("已清除歷史紀錄。");
  }
}

function resetProgress() {
  if (confirm("確定要重設所有解鎖進度？")) {
    setUnlocked(1);
    initLevels();
    alert("已重設為 Lv 1。");
  }
}

/* =========================
   初始化介面
========================= */
document.addEventListener("DOMContentLoaded", () => {
  initLevels();
  ensureExtraPanels();
  renderHistory();
});

function ensureExtraPanels() {
  const startPanel = document.getElementById("startPanel");
  if (startPanel && !document.getElementById("historyPanel")) {
    const div = document.createElement("div");
    div.id = "historyPanel";
    div.className = "panel";
    div.innerHTML = `
      <h2>歷史成績紀錄</h2>
      <div id="historyArea" class="small">尚未有紀錄。</div>
      <div style="margin-top:12px">
        <button class="secondary" onclick="clearHistory()">清除歷史紀錄</button>
      </div>
    `;
    startPanel.parentNode.appendChild(div);
  }

  const gamePanel = document.getElementById("gamePanel");
  if (gamePanel && !document.getElementById("timerBox")) {
    const topbar = gamePanel.querySelector(".topbar");
    if (topbar) {
      const timerStat = document.createElement("div");
      timerStat.className = "stat";
      timerStat.id = "timerBox";
      timerStat.innerHTML = `<div class="k">剩餘時間</div><div class="v" id="timerDisplay">60:00</div>`;
      topbar.querySelector(".row")?.appendChild(timerStat);
    }
  }
}

function initLevels() {
  const sel = document.getElementById("levelSelect");
  if (!sel) return;
  const unlocked = getUnlocked();
  sel.innerHTML = "";

  for (let i = 1; i <= TOTAL_LEVELS; i++) {
    const op = document.createElement("option");
    op.value = i;
    op.textContent = `Lv ${i}${i <= unlocked ? "" : "（未解鎖）"}`;
    if (i > unlocked) op.disabled = true;
    sel.appendChild(op);
  }
  sel.value = 1;
}

/* =========================
   歷史紀錄顯示
========================= */
function renderHistory() {
  const area = document.getElementById("historyArea");
  if (!area) return;

  const history = getHistory();
  if (!history.length) {
    area.innerHTML = "尚未有紀錄。";
    return;
  }

  area.innerHTML = history.slice(0, 15).map((h, i) => {
    return `
      <div style="padding:10px 0;border-bottom:1px solid #334155">
        <strong>${i + 1}. ${escapeHtml(h.player)}</strong>
        ｜Lv ${h.level}
        ｜${h.score}/${h.total}
        ｜${h.passed ? '<span class="correct">過關</span>' : '<span class="wrong">未過關</span>'}
        ｜${escapeHtml(h.timeUsed)}
        <br>
        <span class="small">${escapeHtml(h.date)}</span>
      </div>
    `;
  }).join("");
}

/* =========================
   難度設定
========================= */
function getDifficultyProfile(level) {
  if (level <= 20) {
    return { preferred: [1, 2], fallback: [3], label: "基礎（1-2）" };
  } else if (level <= 40) {
    return { preferred: [2, 3], fallback: [1, 4], label: "基礎至中階（2-3）" };
  } else if (level <= 60) {
    return { preferred: [3, 4], fallback: [2, 5], label: "中階（3-4）" };
  } else if (level <= 80) {
    return { preferred: [4, 5], fallback: [3], label: "中高階（4-5）" };
  } else {
    return { preferred: [4, 5], fallback: [3], label: "高階（4-5）" };
  }
}

/* =========================
   工具函數
========================= */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function questionKey(q) {
  return `${q.cat}|${q.type}|${q.q}`;
}

function uniqueQuestions(arr) {
  const seen = new Set();
  return arr.filter(q => {
    const key = questionKey(q);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function filterByDifficulty(pool, preferred, fallback = []) {
  const p = pool.filter(q => preferred.includes(q.diff));
  if (p.length > 0) return p;
  return pool.filter(q => fallback.includes(q.diff));
}

function takeQuestions(pool, count, usedKeys) {
  const result = [];
  for (const q of shuffle(uniqueQuestions(pool))) {
    const key = questionKey(q);
    if (!usedKeys.has(key)) {
      usedKeys.add(key);
      result.push(q);
    }
    if (result.length >= count) break;
  }
  return result;
}

/* =========================
   題目生成
========================= */
function buildQuestionSet(level) {
  const profile = getDifficultyProfile(level);
  const usedKeys = new Set();
  let result = [];

  const categoryPlan = [
    { cat: "水調歌頭", min: 5 },
    { cat: "孔明借箭", min: 6 },
    { cat: "最苦與最樂", min: 5 },
    { cat: "人間有情", min: 5 },
    { cat: "語文運用", min: 9 }
  ];

  const requiredTypes = ["體裁", "文言字詞", "閱讀理解"];
  const languageTypes = ["單元五", "單元六", "單元七"];

  categoryPlan.forEach(item => {
    const allCat = QUESTION_BANK.filter(q => q.cat === item.cat);
    const preferredPool = filterByDifficulty(allCat, profile.preferred, profile.fallback);
    let selected = takeQuestions(preferredPool, item.min, usedKeys);

    if (selected.length < item.min) {
      const remain = item.min - selected.length;
      selected = selected.concat(takeQuestions(allCat, remain, usedKeys));
    }

    result = result.concat(selected);
  });

  ["水調歌頭", "孔明借箭", "最苦與最樂", "人間有情"].forEach(cat => {
    requiredTypes.forEach(type => {
      const exists = result.some(q => q.cat === cat && q.type === type);
      if (!exists) {
        const candidates = QUESTION_BANK.filter(q =>
          q.cat === cat &&
          q.type === type &&
          (profile.preferred.includes(q.diff) || profile.fallback.includes(q.diff))
        );
        result = result.concat(takeQuestions(candidates, 1, usedKeys));
      }
    });
  });

  languageTypes.forEach(type => {
    const exists = result.some(q => q.cat === "語文運用" && q.type === type);
    if (!exists) {
      const candidates = QUESTION_BANK.filter(q =>
        q.cat === "語文運用" &&
        q.type === type &&
        (profile.preferred.includes(q.diff) || profile.fallback.includes(q.diff))
      );
      result = result.concat(takeQuestions(candidates, 1, usedKeys));
    }
  });

  if (result.length > QUESTIONS_PER_LEVEL) {
    result = shuffle(result).slice(0, QUESTIONS_PER_LEVEL);
  }

  if (result.length < QUESTIONS_PER_LEVEL) {
    const supplementPool = QUESTION_BANK.filter(q =>
      profile.preferred.includes(q.diff) || profile.fallback.includes(q.diff)
    );
    result = result.concat(
      takeQuestions(supplementPool, QUESTIONS_PER_LEVEL - result.length, usedKeys)
    );
  }

  if (result.length < QUESTIONS_PER_LEVEL) {
    result = result.concat(
      takeQuestions(QUESTION_BANK, QUESTIONS_PER_LEVEL - result.length, usedKeys)
    );
  }

  return shuffle(result).slice(0, QUESTIONS_PER_LEVEL);
}

/* =========================
   計時器
========================= */
function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function startTimer() {
  stopTimer();
  timeLeft = QUIZ_TIME_SECONDS;
  updateTimerDisplay();

  timer = setInterval(() => {
    timeLeft--;
    updateTimerDisplay();

    if (timeLeft <= 0) {
      stopTimer();
      alert("時間到，系統將自動交卷。");
      submitLevel(true);
    }
  }, 1000);
}

function stopTimer() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

function updateTimerDisplay() {
  const el = document.getElementById("timerDisplay");
  if (el) {
    el.textContent = formatTime(timeLeft);
    if (timeLeft <= 300) {
      el.style.color = "#ef4444";
    } else if (timeLeft <= 900) {
      el.style.color = "#f59e0b";
    } else {
      el.style.color = "";
    }
  }
}

function getUsedTimeText() {
  const used = QUIZ_TIME_SECONDS - timeLeft;
  return formatTime(used);
}

/* =========================
   開始遊戲
========================= */
function startGame() {
  const nameInput = document.getElementById("playerName");
  const levelSelect = document.getElementById("levelSelect");

  const name = nameInput ? nameInput.value.trim() : "";
  const level = levelSelect ? parseInt(levelSelect.value, 10) : 1;
  const unlocked = getUnlocked();

  if (!name) {
    alert("請先輸入角色名。");
    return;
  }

  if (level > unlocked) {
    alert("此等級尚未解鎖。");
    return;
  }

  player = name;
  currentLevel = level;
  currentSet = buildQuestionSet(level);
  answered = false;

  document.getElementById("startPanel").classList.add("hidden");
  document.getElementById("gamePanel").classList.remove("hidden");

  const profile = getDifficultyProfile(level);

  document.getElementById("gameTitle").textContent = `${player} 的闖關試煉：Lv ${currentLevel}`;
  document.getElementById("gameSub").innerHTML =
    `本關包含 <span class="pill">${currentSet.length} 題</span>　` +
    `<span class="pill">難度：${profile.label}</span>　` +
    `<span class="pill">覆蓋所有範圍</span>`;

  document.getElementById("statLevel").textContent = currentLevel;
  document.getElementById("statCount").textContent = currentSet.length;

  renderQuiz();
  updateProgress();

  const resultPanel = document.getElementById("resultPanel");
  resultPanel.classList.add("hidden");
  resultPanel.innerHTML = "";

  startTimer();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* =========================
   返回主頁
========================= */
function backHome() {
  stopTimer();
  document.getElementById("gamePanel").classList.add("hidden");
  document.getElementById("startPanel").classList.remove("hidden");
  initLevels();
  renderHistory();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* =========================
   顯示題目
========================= */
function renderQuiz() {
  const area = document.getElementById("quizArea");
  area.innerHTML = "";

  currentSet.forEach((q, idx) => {
    const div = document.createElement("div");
    div.className = "question";

    div.innerHTML = `
      <div class="q-meta">第 ${idx + 1} 題 ・ ${q.cat} ・ ${q.type} ・ 難度 ${q.diff}</div>
      <div class="q-title">${q.q}</div>
      <div class="options">
        ${q.opts.map((opt, i) => `
          <label class="option">
            <input type="radio" name="q${idx}" value="${i}" onchange="updateProgress()">
            ${String.fromCharCode(65 + i)}. ${opt}
          </label>
        `).join("")}
      </div>
      <div id="feedback-${idx}" class="answer-box hidden"></div>
    `;
    area.appendChild(div);
  });
}

/* =========================
   進度條
========================= */
function updateProgress() {
  const total = currentSet.length;
  let done = 0;

  for (let i = 0; i < total; i++) {
    const checked = document.querySelector(`input[name="q${i}"]:checked`);
    if (checked) done++;
  }

  const progress = document.getElementById("progressBar");
  if (progress) {
    progress.style.width = `${(done / total) * 100}%`;
  }
}

/* =========================
   提交答案
========================= */
function submitLevel(autoSubmit = false) {
  if (answered) return;
  answered = true;
  stopTimer();

  let score = 0;

  currentSet.forEach((q, idx) => {
    const selected = document.querySelector(`input[name="q${idx}"]:checked`);
    const fb = document.getElementById(`feedback-${idx}`);

    // 禁用作答
    document.querySelectorAll(`input[name="q${idx}"]`).forEach(el => el.disabled = true);

    if (selected) {
      const val = parseInt(selected.value, 10);
      if (val === q.ans) {
        score++;
        fb.innerHTML = `
          <span class="correct">✓ 你答對了</span><br>
          <strong>正確答案：</strong>${String.fromCharCode(65 + q.ans)}. ${q.opts[q.ans]}<br>
          <strong>說明：</strong>${q.exp}
        `;
      } else {
        fb.innerHTML = `
          <span class="wrong">✗ 你答錯了</span><br>
          <strong>你的答案：</strong>${String.fromCharCode(65 + val)}. ${q.opts[val]}<br>
          <strong>正確答案：</strong>${String.fromCharCode(65 + q.ans)}. ${q.opts[q.ans]}<br>
          <strong>說明：</strong>${q.exp}
        `;
      }
    } else {
      fb.innerHTML = `
        <span class="wrong">✗ 你未作答</span><br>
        <strong>正確答案：</strong>${String.fromCharCode(65 + q.ans)}. ${q.opts[q.ans]}<br>
        <strong>說明：</strong>${q.exp}
      `;
    }

    fb.classList.remove("hidden");
  });

  const passLine = Math.ceil(currentSet.length * 0.6);
  let unlocked = getUnlocked();
  const passed = score >= passLine;

  if (passed && currentLevel >= unlocked && currentLevel < TOTAL_LEVELS) {
    unlocked = currentLevel + 1;
    setUnlocked(unlocked);
  }

  // 寫入歷史
  addHistory({
    player,
    level: currentLevel,
    score,
    total: currentSet.length,
    passed,
    timeUsed: getUsedTimeText(),
    date: new Date().toLocaleString("zh-Hant-HK")
  });

  const rp = document.getElementById("resultPanel");
  rp.classList.remove("hidden");
  rp.innerHTML = `
    <h3>本關結果 ${autoSubmit ? "（時間到自動交卷）" : ""}</h3>
    <div>角色名：<strong>${escapeHtml(player)}</strong></div>
    <div>等級：<strong>Lv ${currentLevel}</strong></div>
    <div>得分：<strong>${score} / ${currentSet.length}</strong></div>
    <div>過關線：<strong>${passLine}</strong></div>
    <div>作答時間：<strong>${getUsedTimeText()}</strong></div>
    <div style="margin-top:8px">
      ${passed
        ? `<span class="correct">恭喜過關，已解鎖下一關。</span>`
        : `<span class="wrong">未達過關線，可重玩本關再挑戰。</span>`}
    </div>
    <div style="margin-top:10px">
      <button class="success" onclick="goNextLevel()" ${passed && currentLevel < TOTAL_LEVELS ? "" : "disabled"}>前往下一關</button>
      <button class="secondary" onclick="startGame()">重玩本關</button>
      <button class="secondary" onclick="downloadAnswerSheetWithResponses()">下載本關作答PDF內容</button>
      <button class="secondary" onclick="backHome()">返回主頁</button>
    </div>
    <div class="footer">你可向下查看每一題的正確答案與解析。</div>
  `;

  initLevels();
  renderHistory();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* =========================
   前往下一關
========================= */
function goNextLevel() {
  const unlocked = getUnlocked();
  if (currentLevel + 1 <= unlocked) {
    document.getElementById("levelSelect").value = currentLevel + 1;
    document.getElementById("startPanel").classList.remove("hidden");
    document.getElementById("gamePanel").classList.add("hidden");
    startGame();
  }
}

/* =========================
   PDF / 列印
========================= */
function openPrintWindow(html) {
  const w = window.open("", "_blank");
  w.document.write(html);
  w.document.close();
  w.focus();
}

function basePrintCSS() {
  return `
    <style>
      body{font-family:"Microsoft JhengHei",sans-serif;color:#000;padding:28px;line-height:1.8}
      h1,h2,h3{margin:0 0 10px}
      .meta{margin-bottom:16px}
      .q{margin:16px 0;padding:12px;border:1px solid #999;border-radius:8px}
      .opt{margin-left:18px}
      .space{height:26px;border-bottom:1px dashed #aaa;margin-top:8px}
      .small{font-size:12px;color:#444}
      @media print { button{display:none} }
    </style>
  `;
}

function downloadBlankPDFLike() {
  const nameInput = document.getElementById("playerName");
  const levelSelect = document.getElementById("levelSelect");

  const name = (nameInput && nameInput.value.trim()) || player || "________________";
  const level = (levelSelect && parseInt(levelSelect.value, 10)) || currentLevel || 1;
  const set = buildQuestionSet(level);

  const html = `
    <html>
      <head>
        <title>學生作答紙</title>
        ${basePrintCSS()}
      </head>
      <body>
        <h1>中三中文闖關王 — 學生作答紙</h1>
        <div class="meta">
          角色名：${escapeHtml(name)}<br>
          等級：Lv ${level}<br>
          題數：${set.length}<br>
          建議時間：60分鐘
        </div>
        ${set.map((q, idx) => `
          <div class="q">
            <strong>第 ${idx + 1} 題</strong>（${q.cat}｜${q.type}）<br>
            ${escapeHtml(q.q)}
            ${q.opts.map((o, i) => `<div class="opt">${String.fromCharCode(65 + i)}. ${escapeHtml(o)}</div>`).join("")}
            <div class="space"></div>
          </div>
        `).join("")}
        <div class="small">請在瀏覽器中選擇「列印」→「另存為 PDF」。</div>
        <button onclick="window.print()">列印 / 另存為 PDF</button>
      </body>
    </html>
  `;
  openPrintWindow(html);
}

function downloadAnswerSheetWithResponses() {
  if (!currentSet.length) return;

  const html = `
    <html>
      <head>
        <title>本關作答與答案</title>
        ${basePrintCSS()}
      </head>
      <body>
        <h1>中三中文闖關王 — 本關作答與答案</h1>
        <div class="meta">
          角色名：${escapeHtml(player)}<br>
          等級：Lv ${currentLevel}<br>
          題數：${currentSet.length}<br>
          作答時間：${getUsedTimeText()}
        </div>
        ${currentSet.map((q, idx) => {
          const selected = document.querySelector(`input[name="q${idx}"]:checked`);
          const val = selected ? parseInt(selected.value, 10) : null;
          return `
            <div class="q">
              <strong>第 ${idx + 1} 題</strong>（${q.cat}｜${q.type}）<br>
              ${escapeHtml(q.q)}
              ${q.opts.map((o, i) => `<div class="opt">${String.fromCharCode(65 + i)}. ${escapeHtml(o)}</div>`).join("")}
              <div><strong>你的答案：</strong>${val === null ? "未作答" : `${String.fromCharCode(65 + val)}. ${escapeHtml(q.opts[val])}`}</div>
              <div><strong>正確答案：</strong>${String.fromCharCode(65 + q.ans)}. ${escapeHtml(q.opts[q.ans])}</div>
              <div><strong>說明：</strong>${escapeHtml(q.exp)}</div>
            </div>
          `;
        }).join("")}
        <div class="small">請在瀏覽器中選擇「列印」→「另存為 PDF」。</div>
        <button onclick="window.print()">列印 / 另存為 PDF</button>
      </body>
    </html>
  `;
  openPrintWindow(html);
}

/* =========================
   HTML 安全處理
========================= */
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
