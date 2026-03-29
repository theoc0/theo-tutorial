// app.js
// 中文闖關遊戲：只需姓名、50關、每關抽30題、全對通關、重考重新抽題
// 配合 question-banks.js 使用
// 需要 index.html 內有以下 id：
// studentName, bankSelect, startBtn, submitBtn, resetBtn, prevBtn, nextBtn,
// nextLevelBtn, retryLevelBtn,
// startScreen, quizScreen, resultScreen,
// playerDisplay, levelDisplay, highestScoreDisplay, latestScoreDisplay, clearedLevelsDisplay,
// leftLevelScores, levelMap,
// questionCounter, progressText, timerDisplay, progressFill,
// questionText, optionsWrap,
// resultTitle, scoreText, starText, resultMessage

const STORAGE_KEY = "cn_game_records_v3";
const QUESTIONS_PER_LEVEL = 30;
const MIN_BANK_QUESTIONS = 30;

document.addEventListener("DOMContentLoaded", () => {
  const els = {
    studentName: document.getElementById("studentName"),
    bankSelect: document.getElementById("bankSelect"),
    startBtn: document.getElementById("startBtn"),
    submitBtn: document.getElementById("submitBtn"),
    resetBtn: document.getElementById("resetBtn"),
    prevBtn: document.getElementById("prevBtn"),
    nextBtn: document.getElementById("nextBtn"),
    nextLevelBtn: document.getElementById("nextLevelBtn"),
    retryLevelBtn: document.getElementById("retryLevelBtn"),

    startScreen: document.getElementById("startScreen"),
    quizScreen: document.getElementById("quizScreen"),
    resultScreen: document.getElementById("resultScreen"),

    playerDisplay: document.getElementById("playerDisplay"),
    levelDisplay: document.getElementById("levelDisplay"),
    highestScoreDisplay: document.getElementById("highestScoreDisplay"),
    latestScoreDisplay: document.getElementById("latestScoreDisplay"),
    clearedLevelsDisplay: document.getElementById("clearedLevelsDisplay"),
    leftLevelScores: document.getElementById("leftLevelScores"),
    levelMap: document.getElementById("levelMap"),

    questionCounter: document.getElementById("questionCounter"),
    progressText: document.getElementById("progressText"),
    timerDisplay: document.getElementById("timerDisplay"),
    progressFill: document.getElementById("progressFill"),

    questionText: document.getElementById("questionText"),
    optionsWrap: document.getElementById("optionsWrap"),

    resultTitle: document.getElementById("resultTitle"),
    scoreText: document.getElementById("scoreText"),
    starText: document.getElementById("starText"),
    resultMessage: document.getElementById("resultMessage")
  };

  const state = {
    playerName: "",
    selectedBank: "",
    currentLevel: 1,
    currentQuestions: [],
    currentIndex: 0,
    answers: [],
    score: 0,
    timer: null,
    timeElapsed: 0,
    records: loadRecords()
  };

  init();

  function init() {
    bindEvents();
    populateBankSelect();
    renderStartPanel();
    switchScreen("start");
  }

  function bindEvents() {
    if (els.startBtn) els.startBtn.addEventListener("click", startGame);
    if (els.submitBtn) els.submitBtn.addEventListener("click", submitQuiz);
    if (els.resetBtn) els.resetBtn.addEventListener("click", resetAllData);
    if (els.prevBtn) els.prevBtn.addEventListener("click", goPrevQuestion);
    if (els.nextBtn) els.nextBtn.addEventListener("click", goNextQuestion);
    if (els.nextLevelBtn) els.nextLevelBtn.addEventListener("click", goNextLevel);
    if (els.retryLevelBtn) els.retryLevelBtn.addEventListener("click", retryLevel);
  }

  function populateBankSelect() {
    if (!els.bankSelect) return;
    els.bankSelect.innerHTML = "";

    if (typeof QUESTION_BANKS === "undefined" || !Array.isArray(QUESTION_BANKS)) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "未找到題庫";
      els.bankSelect.appendChild(opt);
      return;
    }

    QUESTION_BANKS.forEach((bank, i) => {
      const opt = document.createElement("option");
      const total = Array.isArray(bank.questions) ? bank.questions.length : 0;
      const available = isBankAvailable(bank);

      opt.value = bank.name;
      opt.textContent = available
        ? bank.name
        : `${bank.name}（未開放）`;

      opt.dataset.available = available ? "1" : "0";

      if (!available) {
        opt.disabled = true;
      }

      if (i === 0 && available) {
        opt.selected = true;
      }

      els.bankSelect.appendChild(opt);
    });

    // 若第一個剛好是 disabled，改選第一個可用題庫
    const firstAvailable = [...els.bankSelect.options].find(opt => !opt.disabled);
    if (firstAvailable) {
      firstAvailable.selected = true;
    }
  }

  function isBankAvailable(bank) {
    return Array.isArray(bank?.questions) && bank.questions.length >= MIN_BANK_QUESTIONS;
  }

  function getBankByName(name) {
    if (typeof QUESTION_BANKS === "undefined" || !Array.isArray(QUESTION_BANKS)) return null;
    return QUESTION_BANKS.find(b => b.name === name) || null;
  }

  function validateStudentInfo() {
    const name = els.studentName ? els.studentName.value.trim() : "";
    const bank = els.bankSelect ? els.bankSelect.value : "";

    if (!name) {
      alert("請先輸入姓名。");
      if (els.studentName) els.studentName.focus();
      return null;
    }

    if (!bank) {
      alert("請先選擇題庫。");
      if (els.bankSelect) els.bankSelect.focus();
      return null;
    }

    const bankObj = getBankByName(bank);
    if (!bankObj) {
      alert("找不到所選題庫。");
      return null;
    }

    if (!isBankAvailable(bankObj)) {
      alert("此題庫題目不足 30 題，暫未開放。");
      if (els.bankSelect) els.bankSelect.focus();
      return null;
    }

    return { name, bank };
  }

  function startGame() {
    const info = validateStudentInfo();
    if (!info) return;

    state.playerName = info.name;
    state.selectedBank = info.bank;

    const playerData = getPlayerData(state.playerName, state.selectedBank);
    state.currentLevel = clampLevel((playerData.clearedLevels || 0) + 1);

    prepareLevel(state.currentLevel);

    if (!state.currentQuestions.length) {
      alert("此題庫目前沒有足夠題目開始本關。");
      return;
    }

    updateLeftPanel();
    switchScreen("quiz");
    startTimer();
    renderQuestion();
  }

  function prepareLevel(level) {
    state.currentLevel = clampLevel(level);
    state.currentIndex = 0;
    state.answers = [];
    state.score = 0;
    state.timeElapsed = 0;
    stopTimer();

    const bankQuestions = getSelectedBankQuestions();
    const allowedDiffs = getDifficultyByLevel(state.currentLevel);

    let pool = bankQuestions.filter(q => allowedDiffs.includes(Number(q.diff)));

    if (pool.length < QUESTIONS_PER_LEVEL) {
      const fallback = bankQuestions.filter(q => Number(q.diff) <= Math.max(...allowedDiffs));
      pool = fallback.length >= QUESTIONS_PER_LEVEL ? fallback : bankQuestions.slice();
    }

    state.currentQuestions = pickRandomQuestions(pool, QUESTIONS_PER_LEVEL).map(q => shuffleQuestionOptions(q));
    state.answers = new Array(state.currentQuestions.length).fill(null);
    updateRightPanel();
  }

  function getSelectedBankQuestions() {
    const bank = getBankByName(state.selectedBank);
    return bank && Array.isArray(bank.questions) ? bank.questions : [];
  }

  function getDifficultyByLevel(level) {
    if (level <= 5) return [1, 2];
    if (level <= 10) return [2, 3];
    if (level <= 15) return [3, 4];
    if (level <= 20) return [4, 5];
    if (level <= 25) return [5, 6];
    if (level <= 30) return [6, 7];
    if (level <= 35) return [7, 8];
    if (level <= 40) return [8, 9];
    if (level <= 45) return [9];
    return [9, 10];
  }

  function pickRandomQuestions(arr, count) {
    const copied = [...arr];
    shuffleArray(copied);
    return copied.slice(0, Math.min(count, copied.length));
  }

  function shuffleQuestionOptions(q) {
    const newQ = JSON.parse(JSON.stringify(q));
    const indexed = newQ.opts.map((opt, idx) => ({ opt, idx }));
    shuffleArray(indexed);
    newQ.opts = indexed.map(x => x.opt);
    newQ.ans = indexed.findIndex(x => x.idx === q.ans);
    return newQ;
  }

  function renderQuestion() {
    const q = state.currentQuestions[state.currentIndex];
    if (!q) return;

    if (els.questionText) {
      els.questionText.classList.remove("fade-in");
      void els.questionText.offsetWidth;
      els.questionText.textContent = q.q;
      els.questionText.classList.add("fade-in");
    }

    if (els.optionsWrap) {
      els.optionsWrap.innerHTML = "";
      q.opts.forEach((opt, idx) => {
        const btn = document.createElement("button");
        btn.className = "option-btn";
        if (state.answers[state.currentIndex] === idx) btn.classList.add("selected");
        btn.innerHTML = `<span class="option-label">${String.fromCharCode(65 + idx)}.</span> ${opt}`;
        btn.addEventListener("click", () => selectAnswer(idx));
        els.optionsWrap.appendChild(btn);
      });
    }

    updateRightPanel();
    updateNavButtons();
  }

  function selectAnswer(idx) {
    state.answers[state.currentIndex] = idx;
    renderQuestion();

    setTimeout(() => {
      if (state.currentIndex < state.currentQuestions.length - 1) {
        state.currentIndex++;
        renderQuestion();
      }
    }, 220);
  }

  function goPrevQuestion() {
    if (state.currentIndex > 0) {
      state.currentIndex--;
      renderQuestion();
    }
  }

  function goNextQuestion() {
    if (state.currentIndex < state.currentQuestions.length - 1) {
      state.currentIndex++;
      renderQuestion();
    }
  }

  function updateNavButtons() {
    if (els.prevBtn) els.prevBtn.disabled = state.currentIndex === 0;
    if (els.nextBtn) els.nextBtn.disabled = state.currentIndex === state.currentQuestions.length - 1;
  }

  function updateRightPanel() {
    const total = state.currentQuestions.length || QUESTIONS_PER_LEVEL;
    const answered = state.answers.filter(a => a !== null).length;
    const currentNo = total ? state.currentIndex + 1 : 0;
    const progress = total ? (answered / total) * 100 : 0;

    if (els.questionCounter) els.questionCounter.textContent = `第 ${currentNo} / ${total} 題`;
    if (els.progressText) els.progressText.textContent = `已作答 ${answered} / ${total}`;
    if (els.progressFill) els.progressFill.style.width = `${progress}%`;
    if (els.levelDisplay) els.levelDisplay.textContent = `LV ${state.currentLevel}`;
    if (els.playerDisplay) els.playerDisplay.textContent = state.playerName || "-";
  }

  function startTimer() {
    stopTimer();
    updateTimerDisplay();
    state.timer = setInterval(() => {
      state.timeElapsed++;
      updateTimerDisplay();
    }, 1000);
  }

  function stopTimer() {
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }
  }

  function updateTimerDisplay() {
    if (!els.timerDisplay) return;
    const min = Math.floor(state.timeElapsed / 60).toString().padStart(2, "0");
    const sec = (state.timeElapsed % 60).toString().padStart(2, "0");
    els.timerDisplay.textContent = `${min}:${sec}`;
  }

  function submitQuiz() {
    if (!state.currentQuestions.length) return;

    const unanswered = state.answers.map((a, i) => (a === null ? i + 1 : null)).filter(Boolean);
    if (unanswered.length) {
      const go = confirm(`尚有 ${unanswered.length} 題未作答，是否仍要交卷？`);
      if (!go) return;
    }

    stopTimer();

    let correct = 0;
    state.currentQuestions.forEach((q, i) => {
      if (state.answers[i] === q.ans) correct++;
    });
    state.score = correct;

    const passed = correct === state.currentQuestions.length;
    saveResult(passed);
    showResult(passed);
  }

  function showResult(passed) {
    switchScreen("result");

    const total = state.currentQuestions.length;
    const percent = total ? Math.round((state.score / total) * 100) : 0;

    if (els.resultTitle) els.resultTitle.textContent = passed ? "恭喜通關！" : "未能通關";
    if (els.scoreText) els.scoreText.textContent = `得分：${state.score} / ${total}（${percent}%）`;
    if (els.starText) els.starText.textContent = getStarText(percent);

    if (els.resultMessage) {
      els.resultMessage.textContent = passed
        ? `你已成功通過第 ${state.currentLevel} 關，可挑戰下一關。`
        : `本關要求全對才可通關，請重闖第 ${state.currentLevel} 關。`;
    }

    if (els.nextLevelBtn) els.nextLevelBtn.style.display = passed && state.currentLevel < 50 ? "inline-block" : "none";
    if (els.retryLevelBtn) els.retryLevelBtn.style.display = passed ? "none" : "inline-block";

    updateLeftPanel();
  }

  function getStarText(percent) {
    if (percent === 100) return "★★★★★";
    if (percent >= 80) return "★★★★☆";
    if (percent >= 60) return "★★★☆☆";
    if (percent >= 40) return "★★☆☆☆";
    return "★☆☆☆☆";
  }

  function goNextLevel() {
    const next = clampLevel(state.currentLevel + 1);
    prepareLevel(next);

    if (!state.currentQuestions.length) {
      alert("下一關目前沒有足夠題目。");
      return;
    }

    switchScreen("quiz");
    startTimer();
    renderQuestion();
    updateLeftPanel();
  }

  function retryLevel() {
    prepareLevel(state.currentLevel);

    if (!state.currentQuestions.length) {
      alert("本關目前沒有足夠題目。");
      return;
    }

    switchScreen("quiz");
    startTimer();
    renderQuestion();
    updateLeftPanel();
  }

  function saveResult(passed) {
    if (!state.playerName || !state.selectedBank) return;

    const key = getPlayerKey(state.playerName, state.selectedBank);
    if (!state.records[key]) {
      state.records[key] = {
        playerName: state.playerName,
        bank: state.selectedBank,
        highestScore: 0,
        latestScore: 0,
        clearedLevels: 0,
        levelScores: {}
      };
    }

    const rec = state.records[key];
    rec.latestScore = state.score;
    rec.highestScore = Math.max(rec.highestScore || 0, state.score);
    rec.levelScores[state.currentLevel] = state.score;

    if (passed && state.currentLevel > (rec.clearedLevels || 0)) {
      rec.clearedLevels = state.currentLevel;
    }

    saveRecords(state.records);
  }

  function renderStartPanel() {
    const name = els.studentName ? els.studentName.value.trim() : "";
    const bank = els.bankSelect ? els.bankSelect.value : "";
    if (!name || !bank) {
      if (els.playerDisplay) els.playerDisplay.textContent = "-";
      if (els.levelDisplay) els.levelDisplay.textContent = "LV 1";
      if (els.highestScoreDisplay) els.highestScoreDisplay.textContent = "0";
      if (els.latestScoreDisplay) els.latestScoreDisplay.textContent = "0";
      if (els.clearedLevelsDisplay) els.clearedLevelsDisplay.textContent = "0";
      renderLevelScores(null);
      renderLevelMap(0);
      return;
    }

    const bankObj = getBankByName(bank);
    if (!bankObj || !isBankAvailable(bankObj)) {
      if (els.playerDisplay) els.playerDisplay.textContent = name || "-";
      if (els.levelDisplay) els.levelDisplay.textContent = "未開放";
      if (els.highestScoreDisplay) els.highestScoreDisplay.textContent = "0";
      if (els.latestScoreDisplay) els.latestScoreDisplay.textContent = "0";
      if (els.clearedLevelsDisplay) els.clearedLevelsDisplay.textContent = "0";
      renderLevelScores(null);
      renderLevelMap(0);
      return;
    }

    const rec = getPlayerData(name, bank);
    if (els.playerDisplay) els.playerDisplay.textContent = name;
    if (els.levelDisplay) els.levelDisplay.textContent = `LV ${clampLevel((rec.clearedLevels || 0) + 1)}`;
    if (els.highestScoreDisplay) els.highestScoreDisplay.textContent = rec.highestScore || 0;
    if (els.latestScoreDisplay) els.latestScoreDisplay.textContent = rec.latestScore || 0;
    if (els.clearedLevelsDisplay) els.clearedLevelsDisplay.textContent = rec.clearedLevels || 0;
    renderLevelScores(rec);
    renderLevelMap(rec.clearedLevels || 0);
  }

  function updateLeftPanel() {
    const rec = getPlayerData(state.playerName, state.selectedBank);

    if (els.playerDisplay) els.playerDisplay.textContent = state.playerName || "-";
    if (els.levelDisplay) els.levelDisplay.textContent = `LV ${state.currentLevel}`;
    if (els.highestScoreDisplay) els.highestScoreDisplay.textContent = rec.highestScore || 0;
    if (els.latestScoreDisplay) els.latestScoreDisplay.textContent = rec.latestScore || 0;
    if (els.clearedLevelsDisplay) els.clearedLevelsDisplay.textContent = rec.clearedLevels || 0;

    renderLevelScores(rec);
    renderLevelMap(rec.clearedLevels || 0);
  }

  function renderLevelScores(rec) {
    if (!els.leftLevelScores) return;
    els.leftLevelScores.innerHTML = "";

    const scores = rec && rec.levelScores ? rec.levelScores : {};
    for (let i = 1; i <= 10; i++) {
      const div = document.createElement("div");
      div.className = "level-score-item";
      div.textContent = `第 ${i} 關：${scores[i] !== undefined ? scores[i] + "/" + QUESTIONS_PER_LEVEL : "-"}`;
      els.leftLevelScores.appendChild(div);
    }
  }

  function renderLevelMap(cleared) {
    if (!els.levelMap) return;
    els.levelMap.innerHTML = "";

    for (let i = 1; i <= 50; i++) {
      const node = document.createElement("div");
      node.className = "level-node";
      node.textContent = i;

      if (i <= cleared) node.classList.add("cleared");
      if (i === clampLevel(cleared + 1)) node.classList.add("current");
      if (i === state.currentLevel) node.classList.add("active");

      els.levelMap.appendChild(node);
    }
  }

  function switchScreen(screen) {
    if (els.startScreen) els.startScreen.style.display = screen === "start" ? "block" : "none";
    if (els.quizScreen) els.quizScreen.style.display = screen === "quiz" ? "grid" : "none";
    if (els.resultScreen) els.resultScreen.style.display = screen === "result" ? "block" : "none";
  }

  function resetAllData() {
    const ok = confirm("確定清除本機所有通關記錄？");
    if (!ok) return;
    localStorage.removeItem(STORAGE_KEY);
    state.records = {};
    renderStartPanel();
    alert("記錄已清除。");
  }

  function getPlayerKey(name, bank) {
    return `${bank}__${name}`;
  }

  function getPlayerData(name, bank) {
    const key = getPlayerKey(name, bank);
    return state.records[key] || {
      playerName: name,
      bank,
      highestScore: 0,
      latestScore: 0,
      clearedLevels: 0,
      levelScores: {}
    };
  }

  function loadRecords() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  function saveRecords(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function clampLevel(level) {
    return Math.max(1, Math.min(50, level));
  }

  function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  if (els.studentName) {
    els.studentName.addEventListener("input", renderStartPanel);
  }

  if (els.bankSelect) {
    els.bankSelect.addEventListener("change", renderStartPanel);
  }
});
