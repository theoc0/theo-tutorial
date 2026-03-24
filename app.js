const TOTAL_LEVELS = 100;
const QUESTIONS_PER_LEVEL = 30;
const QUIZ_TIME_SECONDS = 60 * 60; // 60分鐘
const TEACHER_PASSWORD = "teacher2026";
const MIN_QUESTION_BANK_SIZE = 50; // 題庫最少需要 50 題才開放

let currentLevel = 1;
let player = "";
let currentSet = [];
let answered = false;
let timer = null;
let timeLeft = QUIZ_TIME_SECONDS;

/* =========================
   題庫管理
========================= */
function getAvailableBanks() {
  return Object.keys(QUESTION_BANKS || {});
}

function getCurrentBankName() {
  return localStorage.getItem("zhCurrentBank") || "中三啟思教科書學生";
}

function setCurrentBankName(name) {
  localStorage.setItem("zhCurrentBank", name);
}

function getCurrentQuestionBank() {
  return QUESTION_BANKS[getCurrentBankName()] || [];
}

// 題庫檢查：只檢查總題數是否大於等於 MIN_QUESTION_BANK_SIZE
function validateBankByName(bankName) {
  const bank = QUESTION_BANKS[bankName] || [];
  if (!Array.isArray(bank) || bank.length < MIN_QUESTION_BANK_SIZE) {
    return {
      ok: false,
      message: `題庫「${bankName}」只有 ${bank.length} 題，少於 ${MIN_QUESTION_BANK_SIZE} 題，暫不可用。`
    };
  }
  return {
    ok: true,
    message: `題庫「${bankName}」可正常使用，共 ${bank.length} 題。`
  };
}

function validateCurrentBank() {
  return validateBankByName(getCurrentBankName());
}

function initBankSelect() {
  const sel = document.getElementById("bankSelect");
  if (!sel) return;

  const banks = getAvailableBanks();
  let current = getCurrentBankName();
  sel.innerHTML = "";

  const usableBanks = [];

  banks.forEach(name => {
    const check = validateBankByName(name);
    if (check.ok) usableBanks.push(name);

    const op = document.createElement("option");
    op.value = name;
    op.textContent = check.ok ? `${name}（可用）` : `${name}（題目不足）`;
    
    // 若題目不足則禁用該選項
    if (!check.ok) op.disabled = true;
    
    // 若是當前題庫且可用，設為預設選中
    if (name === current && check.ok) op.selected = true;
    
    sel.appendChild(op);
  });

  // 如果當前儲存的題庫變成不可用，自動切換到第一個可用的題庫
  if (!usableBanks.includes(current) && usableBanks.length > 0) {
    current = usableBanks[0];
    setCurrentBankName(current);
    sel.value = current;
  }

  updateCurrentBankLabel();
}

function changeQuestionBank() {
  const sel = document.getElementById("bankSelect");
  if (!sel) return;

  setCurrentBankName(sel.value);
  initLevels();
  renderHistory();
  updateCurrentBankLabel();
  renderBankStatus();

  if (isTeacherLoggedIn()) {
    renderTeacherSummary();
    populateTeacherStudentSelect();
    renderTeacherDetail();
  }
}

function updateCurrentBankLabel() {
  const label = document.getElementById("currentBankLabel");
  const stat = document.getElementById("statBank");
  const name = getCurrentBankName();

  if (label) label.textContent = `目前題庫：${name}`;
  if (stat) stat.textContent = name;
}

function renderBankStatus() {
  const box = document.getElementById("bankStatus");
  if (!box) return;

  const result = validateCurrentBank();
  box.innerHTML = result.ok
    ? `題庫狀態：<span class="correct">${escapeHtml(result.message)}</span>`
    : `題庫狀態：<span class="wrong">${escapeHtml(result.message)}</span>`;
}

/* =========================
   Storage Keys (按題庫分開存)
========================= */
function getUnlockedKey() {
  return `zhGameUnlocked_${getCurrentBankName()}`;
}
function getHistoryKey() {
  return `zhGameHistory_${getCurrentBankName()}`;
}

/* =========================
   教師登入
========================= */
function isTeacherLoggedIn() {
  return sessionStorage.getItem("teacherLoggedIn") === "yes";
}

function setTeacherLoggedIn(flag) {
  if (flag) {
    sessionStorage.setItem("teacherLoggedIn", "yes");
  } else {
    sessionStorage.removeItem("teacherLoggedIn");
  }
  updateTeacherStatus();
}

function updateTeacherStatus() {
  const status = document.getElementById("teacherStatus");
  if (!status) return;
  status.textContent = `教師後台狀態：${isTeacherLoggedIn() ? "已登入" : "未登入"}`;
}

function handleTeacherPanelAccess() {
  if (isTeacherLoggedIn()) {
    toggleTeacherPanel(true);
    return;
  }

  const pw = prompt("請輸入教師後台密碼：");
  if (pw === null) return;

  if (pw === TEACHER_PASSWORD) {
    setTeacherLoggedIn(true);
    alert("教師登入成功。");
    toggleTeacherPanel(true);
  } else {
    alert("密碼錯誤。");
  }
}

function teacherLogout() {
  if (!isTeacherLoggedIn()) {
    alert("目前未登入教師後台。");
    return;
  }
  setTeacherLoggedIn(false);
  const panel = document.getElementById("teacherPanel");
  if (panel) panel.classList.add("hidden-admin");
  alert("已登出教師後台。");
}

function toggleTeacherPanel(forceOpen = false) {
  const panel = document.getElementById("teacherPanel");
  if (!panel) return;

  if (!isTeacherLoggedIn()) {
    alert("請先登入教師後台。");
    return;
  }

  if (forceOpen) {
    panel.classList.remove("hidden-admin");
    renderTeacherSummary();
    populateTeacherStudentSelect();
    return;
  }

  if (panel.classList.contains("hidden-admin")) {
    panel.classList.remove("hidden-admin");
    renderTeacherSummary();
    populateTeacherStudentSelect();
  } else {
    panel.classList.add("hidden-admin");
  }
}

function showTeacherTab(tab) {
  if (!isTeacherLoggedIn()) {
    alert("請先登入教師後台。");
    return;
  }

  document.getElementById("teacherSummaryTab").classList.toggle("hidden", tab !== "summary");
  document.getElementById("teacherDetailTab").classList.toggle("hidden", tab !== "detail");
  document.getElementById("tabSummaryBtn").classList.toggle("active", tab === "summary");
  document.getElementById("tabDetailBtn").classList.toggle("active", tab === "detail");

  if (tab === "summary") renderTeacherSummary();
  if (tab === "detail") {
    populateTeacherStudentSelect();
    renderTeacherDetail();
  }
}

/* =========================
   學生資料儲存
========================= */
function getUnlocked() {
  return JSON.parse(localStorage.getItem(getUnlockedKey()) || "1");
}

function setUnlocked(n) {
  localStorage.setItem(getUnlockedKey(), JSON.stringify(n));
}

function getHistory() {
  return JSON.parse(localStorage.getItem(getHistoryKey()) || "[]");
}

function setHistory(arr) {
  localStorage.setItem(getHistoryKey(), JSON.stringify(arr));
}

function addHistory(record) {
  const history = getHistory();
  history.unshift(record);
  setHistory(history.slice(0, 200)); // 保留最近 200 筆
}

function clearHistory() {
  if (confirm(`確定要清除題庫「${getCurrentBankName()}」的所有歷史成績紀錄？`)) {
    localStorage.removeItem(getHistoryKey());
    renderHistory();
    if (isTeacherLoggedIn()) {
      renderTeacherSummary();
      populateTeacherStudentSelect();
      renderTeacherDetail();
    }
    alert("已清除當前題庫歷史紀錄。");
  }
}

function resetProgress() {
  if (confirm(`確定要重設題庫「${getCurrentBankName()}」的解鎖進度？`)) {
    setUnlocked(1);
    initLevels();
    alert("已重設當前題庫進度為 Lv 1。");
  }
}

/* =========================
   初始化
========================= */
document.addEventListener("DOMContentLoaded", () => {
  initBankSelect();
  initLevels();
  renderHistory();
  updateTeacherStatus();
  renderBankStatus();
});

/* =========================
   初始化等級選單
========================= */
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
   首頁歷史紀錄顯示
========================= */
function renderHistory() {
  const area = document.getElementById("historyArea");
  if (!area) return;

  const history = getHistory();
  if (!history.length) {
    area.innerHTML = "尚未有紀錄。";
    return;
  }

  area.innerHTML = history.slice(0, 15).map((h, i) => `
    <div style="padding:10px 0;border-bottom:1px solid #334155">
      <strong>${i + 1}. ${escapeHtml(h.player)}</strong>
      ｜Lv ${h.level}
      ｜${h.score}/${h.total}
      ｜${h.passed ? '<span class="correct">過關</span>' : '<span class="wrong">未過關</span>'}
      ｜${escapeHtml(h.timeUsed || "")}
      <br>
      <span class="small">${escapeHtml(h.date || "")}</span>
    </div>
  `).join("");
}

/* =========================
   教師後台：成績總覽
========================= */
function renderTeacherSummary() {
  if (!isTeacherLoggedIn()) return;

  const body = document.getElementById("teacherSummaryBody");
  if (!body) return;

  const search = (document.getElementById("teacherSearchName")?.value || "").trim().toLowerCase();
  const filter = document.getElementById("teacherFilterPass")?.value || "all";
  const history = getHistory();

  let rows = history.filter(h => {
    const matchName = !search || (h.player || "").toLowerCase().includes(search);
    const matchPass =
      filter === "all" ||
      (filter === "pass" && h.passed) ||
      (filter === "fail" && !h.passed);
    return matchName && matchPass;
  });

  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="7">沒有符合條件的紀錄。</td></tr>`;
    return;
  }

  body.innerHTML = rows.map((h, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${escapeHtml(h.player || "")}</td>
      <td>Lv ${h.level}</td>
      <td>${h.score}/${h.total}</td>
      <td>${h.passed ? '<span class="pill-pass">過關</span>' : '<span class="pill-fail">未過關</span>'}</td>
      <td>${escapeHtml(h.timeUsed || "")}</td>
      <td>${escapeHtml(h.date || "")}</td>
    </tr>
  `).join("");
}

/* =========================
   教師後台：錯題詳情
========================= */
function populateTeacherStudentSelect() {
  if (!isTeacherLoggedIn()) return;

  const sel = document.getElementById("teacherStudentSelect");
  if (!sel) return;

  const history = getHistory();
  sel.innerHTML = "";

  if (!history.length) {
    const op = document.createElement("option");
    op.value = "";
    op.textContent = "尚未有學生紀錄";
    sel.appendChild(op);
    return;
  }

  history.forEach((h, i) => {
    const op = document.createElement("option");
    op.value = i;
    op.textContent = `${h.player}｜Lv ${h.level}｜${h.score}/${h.total}｜${h.date}`;
    sel.appendChild(op);
  });
}

function renderTeacherDetail() {
  if (!isTeacherLoggedIn()) return;

  const area = document.getElementById("teacherDetailArea");
  const sel = document.getElementById("teacherStudentSelect");
  if (!area || !sel) return;

  const history = getHistory();

  if (!history.length || sel.value === "") {
    area.innerHTML = "請先選擇一條學生紀錄。";
    return;
  }

  const idx = parseInt(sel.value, 10);
  const h = history[idx];
  if (!h) {
    area.innerHTML = "找不到相關紀錄。";
    return;
  }

  let wrongHtml = "";
  if (h.responses && h.responses.length) {
    const wrongs = h.responses.filter(r => !r.correct);

    if (!wrongs.length) {
      wrongHtml = `<div class="teacher-box"><strong>錯題：</strong>本次全部答對或沒有錯題紀錄。</div>`;
    } else {
      wrongHtml = wrongs.map((r, i) => `
        <div class="wrong-q">
          <strong>錯題 ${i + 1}</strong><br>
          <strong>課文 / 類型：</strong>${escapeHtml(r.cat || "")} / ${escapeHtml(r.type || "")}<br>
          <strong>題目：</strong>${escapeHtml(r.question || "")}<br>
          <strong>學生答案：</strong>${escapeHtml(r.studentAnswer || "未作答")}<br>
          <strong>正確答案：</strong>${escapeHtml(r.correctAnswer || "")}<br>
          <strong>解說：</strong>${escapeHtml(r.explanation || "")}
        </div>
      `).join("");
    }
  } else {
    wrongHtml = `<div class="teacher-box"><strong>提示：</strong>這筆紀錄沒有逐題作答資料。</div>`;
  }

  area.innerHTML = `
    <div class="teacher-meta">
      <strong>題庫：</strong>${escapeHtml(getCurrentBankName())}<br>
      <strong>角色名：</strong>${escapeHtml(h.player || "")}<br>
      <strong>等級：</strong>Lv ${h.level}<br>
      <strong>得分：</strong>${h.score}/${h.total}<br>
      <strong>狀態：</strong>${h.passed ? '<span class="pill-pass">過關</span>' : '<span class="pill-fail">未過關</span>'}<br>
      <strong>作答時間：</strong>${escapeHtml(h.timeUsed || "")}<br>
      <strong>日期：</strong>${escapeHtml(h.date || "")}
    </div>
    <h3>錯題詳情</h3>
    ${wrongHtml}
  `;
}

function printTeacherSummary() {
  if (!isTeacherLoggedIn()) return;

  const body = document.getElementById("teacherSummaryBody")?.innerHTML || "";
  const html = `
    <html>
    <head>
      <title>教師成績總覽</title>
      <style>
        body{font-family:"Microsoft JhengHei",sans-serif;padding:24px;line-height:1.8}
        table{width:100%;border-collapse:collapse}
        th,td{border:1px solid #666;padding:8px;text-align:left}
        th{background:#eee}
        @media print { button{display:none} }
      </style>
    </head>
    <body>
      <h1>教師成績總覽</h1>
      <div>題庫：${escapeHtml(getCurrentBankName())}</div>
      <table>
        <thead>
          <tr>
            <th>#</th><th>角色名</th><th>等級</th><th>得分</th><th>狀態</th><th>作答時間</th><th>日期</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
      <button onclick="window.print()">列印 / 另存為 PDF</button>
    </body>
    </html>
  `;
  const w = window.open("", "_blank");
  w.document.write(html);
  w.document.close();
  w.focus();
}

function printTeacherDetail() {
  if (!isTeacherLoggedIn()) return;

  const detail = document.getElementById("teacherDetailArea")?.innerHTML || "";
  const html = `
    <html>
    <head>
      <title>教師查看學生錯題</title>
      <style>
        body{font-family:"Microsoft JhengHei",sans-serif;padding:24px;line-height:1.8}
        .box{border:1px solid #666;padding:12px;margin:12px 0;border-radius:8px}
        @media print { button{display:none} }
      </style>
    </head>
    <body>
      <h1>教師查看學生錯題</h1>
      <div>題庫：${escapeHtml(getCurrentBankName())}</div>
      <div class="box">${detail}</div>
      <button onclick="window.print()">列印 / 另存為 PDF</button>
    </body>
    </html>
  `;
  const w = window.open("", "_blank");
  w.document.write(html);
  w.document.close();
  w.focus();
}

/* =========================
   難度與抽題
========================= */
function getDifficultyProfile(level) {
  if (level <= 20) return { preferred: [1, 2], fallback: [3], label: "基礎（1-2）" };
  if (level <= 40) return { preferred: [2, 3], fallback: [1, 4], label: "基礎至中階（2-3）" };
  if (level <= 60) return { preferred: [3, 4], fallback: [2, 5], label: "中階（3-4）" };
  if (level <= 80) return { preferred: [4, 5], fallback: [3], label: "中高階（4-5）" };
  return { preferred: [4, 5], fallback: [3], label: "高階（4-5）" };
}

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

// 抽題邏輯精簡版：優先按難度抽，不夠就從整個題庫補足
function buildQuestionSet(level) {
  const QUESTION_BANK = getCurrentQuestionBank();
  const profile = getDifficultyProfile(level);
  const usedKeys = new Set();
  let result = [];

  // 1. 先從偏好難度抽
  const preferredPool = QUESTION_BANK.filter(q => profile.preferred.includes(q.diff));
  result = result.concat(takeQuestions(preferredPool, QUESTIONS_PER_LEVEL, usedKeys));

  // 2. 如果不夠 30 題，從備用難度抽
  if (result.length < QUESTIONS_PER_LEVEL) {
    const fallbackPool = QUESTION_BANK.filter(q => profile.fallback.includes(q.diff));
    result = result.concat(takeQuestions(fallbackPool, QUESTIONS_PER_LEVEL - result.length, usedKeys));
  }

  // 3. 還是不夠，就從整個題庫隨機抽
  if (result.length < QUESTIONS_PER_LEVEL) {
    result = result.concat(takeQuestions(QUESTION_BANK, QUESTIONS_PER_LEVEL - result.length, usedKeys));
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
  if (!el) return;

  el.textContent = formatTime(timeLeft);
  if (timeLeft <= 300) el.style.color = "#ef4444";
  else if (timeLeft <= 900) el.style.color = "#f59e0b";
  else el.style.color = "";
}

function getUsedTimeText() {
  return formatTime(QUIZ_TIME_SECONDS - timeLeft);
}

/* =========================
   遊戲流程控制
========================= */
function startGame() {
  const validation = validateCurrentBank();
  if (!validation.ok) {
    alert(validation.message);
    renderBankStatus();
    return;
  }

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

  if (!currentSet.length || currentSet.length < QUESTIONS_PER_LEVEL) {
    alert("題庫題目異常，無法正常開始。請更換題庫。");
    return;
  }

  document.getElementById("startPanel").classList.add("hidden");
  document.getElementById("gamePanel").classList.remove("hidden");

  const profile = getDifficultyProfile(level);

  document.getElementById("gameTitle").textContent = `${player} 的中文闖關遊戲：Lv ${currentLevel}`;
  document.getElementById("gameSub").innerHTML =
    `本關包含 <span class="pill">${currentSet.length} 題</span>　` +
    `<span class="pill">難度：${profile.label}</span>　` +
    `<span class="pill">題庫：${escapeHtml(getCurrentBankName())}</span>`;

  document.getElementById("statLevel").textContent = currentLevel;
  document.getElementById("statCount").textContent = currentSet.length;
  updateCurrentBankLabel();

  renderQuiz();
  updateProgress();

  const resultPanel = document.getElementById("resultPanel");
  resultPanel.classList.add("hidden");
  resultPanel.innerHTML = "";

  startTimer();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function backHome() {
  stopTimer();
  document.getElementById("gamePanel").classList.add("hidden");
  document.getElementById("startPanel").classList.remove("hidden");
  initLevels();
  renderHistory();
  updateCurrentBankLabel();
  renderBankStatus();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

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

function updateProgress() {
  const total = currentSet.length;
  let done = 0;
  for (let i = 0; i < total; i++) {
    const checked = document.querySelector(`input[name="q${i}"]:checked`);
    if (checked) done++;
  }
  const progress = document.getElementById("progressBar");
  if (progress) progress.style.width = `${(done / total) * 100}%`;
}

function submitLevel(autoSubmit = false) {
  if (answered) return;
  answered = true;
  stopTimer();

  let score = 0;
  let responseLog = [];

  currentSet.forEach((q, idx) => {
    const selected = document.querySelector(`input[name="q${idx}"]:checked`);
    const fb = document.getElementById(`feedback-${idx}`);

    document.querySelectorAll(`input[name="q${idx}"]`).forEach(el => el.disabled = true);

    let studentAnswerText = "未作答";
    let correct = false;

    if (selected) {
      const val = parseInt(selected.value, 10);
      studentAnswerText = `${String.fromCharCode(65 + val)}. ${q.opts[val]}`;

      if (val === q.ans) {
        score++;
        correct = true;
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

    responseLog.push({
      cat: q.cat,
      type: q.type,
      question: q.q,
      studentAnswer: studentAnswerText,
      correctAnswer: `${String.fromCharCode(65 + q.ans)}. ${q.opts[q.ans]}`,
      explanation: q.exp,
      correct: correct
    });
  });

  const passLine = Math.ceil(currentSet.length * 0.6);
  let unlocked = getUnlocked();
  const passed = score >= passLine;

  if (passed && currentLevel >= unlocked && currentLevel < TOTAL_LEVELS) {
    unlocked = currentLevel + 1;
    setUnlocked(unlocked);
  }

  addHistory({
    bank: getCurrentBankName(),
    player,
    level: currentLevel,
    score,
    total: currentSet.length,
    passed,
    timeUsed: getUsedTimeText(),
    date: new Date().toLocaleString("zh-Hant-HK"),
    responses: responseLog
  });

  const rp = document.getElementById("resultPanel");
  rp.classList.remove("hidden");
  rp.innerHTML = `
    <h3>本關結果 ${autoSubmit ? "（時間到自動交卷）" : ""}</h3>
    <div>題庫：<strong>${escapeHtml(getCurrentBankName())}</strong></div>
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
  if (isTeacherLoggedIn()) {
    renderTeacherSummary();
    populateTeacherStudentSelect();
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

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
  const validation = validateCurrentBank();
  if (!validation.ok) {
    alert(validation.message);
    return;
  }

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
        <h1>中文闖關遊戲 — 學生作答紙</h1>
        <div class="meta">
          題庫：${escapeHtml(getCurrentBankName())}<br>
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
        <h1>中文闖關遊戲 — 本關作答與答案</h1>
        <div class="meta">
          題庫：${escapeHtml(getCurrentBankName())}<br>
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
   HTML安全
========================= */
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
