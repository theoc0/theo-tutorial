const BANK_MIN_QUESTIONS = 50;
const QUESTIONS_PER_RUN = 30;
const TOTAL_LEVELS = 50;
const AUTO_NEXT_DELAY = 260;

let currentBankName = "";
let currentQuestions = [];
let currentQuestionIndex = 0;
let userAnswers = [];
let started = false;
let submitted = false;
let startTime = null;
let timerInterval = null;
let activeLevel = 1;

const bankSelect = document.getElementById("bankSelect");
const bankStatus = document.getElementById("bankStatus");
const startBtn = document.getElementById("startBtn");
const submitBtn = document.getElementById("submitBtn");
const resetBtn = document.getElementById("resetBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const nextLevelBtn = document.getElementById("nextLevelBtn");
const retryLevelBtn = document.getElementById("retryLevelBtn");

const studentNameInput = document.getElementById("studentName");

const quizTitle = document.getElementById("quizTitle");
const quizMeta = document.getElementById("quizMeta");
const singleQuestionWrap = document.getElementById("singleQuestionWrap");
const timerEl = document.getElementById("timer");

const progressText = document.getElementById("progressText");
const progressFill = document.getElementById("progressFill");
const currentQNo = document.getElementById("currentQNo");
const answeredCountEl = document.getElementById("answeredCount");
const currentLevelText = document.getElementById("currentLevelText");

const resultSection = document.getElementById("resultSection");
const levelUpBox = document.getElementById("levelUpBox");
const levelUpText = document.getElementById("levelUpText");

const currentLvEl = document.getElementById("currentLv");
const bestScoreEl = document.getElementById("bestScore");
const lastScoreEl = document.getElementById("lastScore");
const passedCountEl = document.getElementById("passedCount");
const badgeGrid = document.getElementById("badgeGrid");
const levelScoreList = document.getElementById("levelScoreList");
const levelMap = document.getElementById("levelMap");

const starValue = document.getElementById("starValue");
const starDesc = document.getElementById("starDesc");
const clearConditionText = document.getElementById("clearConditionText");

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function shuffleArray(arr) {
  const clone = [...arr];
  for (let i = clone.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
}

function shuffleQuestionOptions(question) {
  const originalOpts = safeArray(question.opts);
  const optionObjects = originalOpts.map((text, index) => ({
    text,
    originalIndex: index
  }));
  const shuffledOptions = shuffleArray(optionObjects);
  const newAns = shuffledOptions.findIndex(item => item.originalIndex === question.ans);

  return {
    ...question,
    opts: shuffledOptions.map(item => item.text),
    ans: newAns
  };
}

function getStorageKey() {
  return "chinese_game_progress_v3";
}

function defaultProgressData() {
  return {
    bestScore: 0,
    lastScore: 0,
    currentLv: 1,
    levelScores: {},
    clearedLevels: []
  };
}

function loadProgressData() {
  try {
    const data = JSON.parse(localStorage.getItem(getStorageKey()));
    return data || defaultProgressData();
  } catch {
    return defaultProgressData();
  }
}

function saveProgressData(data) {
  localStorage.setItem(getStorageKey(), JSON.stringify(data));
}

function getStars(percentage) {
  const starCount = Math.max(1, Math.ceil(percentage / 20));
  const stars = "★★★★★".slice(0, starCount) + "☆☆☆☆☆".slice(0, 5 - starCount);

  let desc = "再接再厲，下次更進一步！";
  if (starCount === 5) desc = "表現出色！";
  else if (starCount === 4) desc = "表現很好，快要滿星！";
  else if (starCount === 3) desc = "表現不錯，繼續努力！";
  else if (starCount === 2) desc = "已有進步，繼續加油！";

  return { stars, desc, starCount };
}

function renderBadgeGrid(level) {
  if (!badgeGrid) return;

  const badges = [
    { lv: 1, icon: "🌱", name: "起步" },
    { lv: 10, icon: "📘", name: "穩進" },
    { lv: 20, icon: "🧠", name: "進階" },
    { lv: 30, icon: "🏅", name: "高手" },
    { lv: 40, icon: "🚀", name: "衝刺" },
    { lv: 50, icon: "👑", name: "通關王" }
  ];

  badgeGrid.innerHTML = "";
  badges.forEach(badge => {
    const unlocked = level >= badge.lv;
    const div = document.createElement("div");
    div.className = `badge-item ${unlocked ? "unlocked" : "locked"}`;
    div.innerHTML = `
      <div class="badge-icon">${badge.icon}</div>
      <div class="badge-name">LV ${badge.lv}<br>${badge.name}</div>
    `;
    badgeGrid.appendChild(div);
  });
}

function renderLevelScoreList(levelScores) {
  if (!levelScoreList) return;

  levelScoreList.innerHTML = "";
  const entries = Object.entries(levelScores).sort((a, b) => Number(a[0]) - Number(b[0]));

  if (!entries.length) {
    levelScoreList.innerHTML = `<div class="level-score-empty">尚未有通關記錄。</div>`;
    return;
  }

  entries.forEach(([lv, score]) => {
    const div = document.createElement("div");
    div.className = "level-score-item";
    div.innerHTML = `
      <span>第 ${lv} 關</span>
      <strong>${score}%</strong>
    `;
    levelScoreList.appendChild(div);
  });
}

function renderLevelMap(currentLevel, clearedLevels) {
  if (!levelMap) return;

  levelMap.innerHTML = "";

  for (let i = 1; i <= TOTAL_LEVELS; i++) {
    const div = document.createElement("div");
    let state = "locked";

    if (clearedLevels.includes(i)) state = "cleared";
    else if (i === currentLevel) state = "current";
    else if (i < currentLevel) state = "cleared";

    div.className = `map-node ${state}`;
    div.textContent = i;
    levelMap.appendChild(div);
  }
}

function renderProgressData() {
  const data = loadProgressData();
  const lv = data.currentLv || 1;

  if (currentLvEl) currentLvEl.textContent = `LV ${lv}`;
  if (bestScoreEl) bestScoreEl.textContent = data.bestScore || 0;
  if (lastScoreEl) lastScoreEl.textContent = data.lastScore || 0;
  if (passedCountEl) passedCountEl.textContent = safeArray(data.clearedLevels).length;

  renderBadgeGrid(lv);
  renderLevelScoreList(data.levelScores || {});
  renderLevelMap(lv, safeArray(data.clearedLevels));
  if (currentLevelText) currentLevelText.textContent = `${lv} / ${TOTAL_LEVELS}`;
}

function getCurrentLevel() {
  const data = loadProgressData();
  return Math.min(data.currentLv || 1, TOTAL_LEVELS);
}

function updateAfterResult(level, percentage, passed) {
  const data = loadProgressData();
  const oldLevel = data.currentLv || 1;

  data.lastScore = percentage;
  if (percentage > (data.bestScore || 0)) data.bestScore = percentage;
  data.levelScores[level] = percentage;

  if (passed) {
    if (!safeArray(data.clearedLevels).includes(level)) {
      data.clearedLevels.push(level);
    }
    if (level === oldLevel && oldLevel < TOTAL_LEVELS) {
      data.currentLv = oldLevel + 1;
    }
  }

  saveProgressData(data);
  renderProgressData();

  return {
    oldLevel,
    newLevel: data.currentLv,
    percentage,
    passed
  };
}

function getAvailableBanks() {
  if (typeof QUESTION_BANKS !== "object" || !QUESTION_BANKS) return [];
  return Object.entries(QUESTION_BANKS).map(([name, questions]) => ({
    name,
    questions: safeArray(questions),
    enabled: safeArray(questions).length >= BANK_MIN_QUESTIONS
  }));
}

function renderBankOptions() {
  if (!bankSelect) return;

  bankSelect.innerHTML = "";
  const banks = getAvailableBanks();

  if (banks.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "沒有可用題庫";
    bankSelect.appendChild(option);
    if (bankStatus) bankStatus.textContent = "未載入題庫。";
    if (startBtn) startBtn.disabled = true;
    return;
  }

  banks.forEach(bank => {
    const option = document.createElement("option");
    option.value = bank.name;
    option.textContent = `${bank.name}（${bank.questions.length}題）${bank.enabled ? "" : "【未啟用】"}`;
    option.disabled = !bank.enabled;
    bankSelect.appendChild(option);
  });

  const firstEnabled = banks.find(b => b.enabled);
  if (firstEnabled) bankSelect.value = firstEnabled.name;

  updateBankStatus();
}

function updateBankStatus() {
  if (!bankSelect) return;

  const bankName = bankSelect.value;
  const questions = safeArray((QUESTION_BANKS || {})[bankName]);

  if (!bankName) {
    if (bankStatus) bankStatus.textContent = "未選擇題庫。";
    if (startBtn) startBtn.disabled = true;
    return;
  }

  if (questions.length < BANK_MIN_QUESTIONS) {
    if (bankStatus) bankStatus.textContent = `此題庫題目少於 ${BANK_MIN_QUESTIONS} 題，已禁用。`;
    if (startBtn) startBtn.disabled = true;
  } else {
    if (bankStatus) bankStatus.textContent = `此題庫可用，系統將按關卡難度抽取 ${QUESTIONS_PER_RUN} 題。通關條件：全對。`;
    if (startBtn) startBtn.disabled = false;
  }
}

function formatTime(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function startTimer() {
  stopTimer();
  startTime = Date.now();
  if (timerEl) timerEl.textContent = "00:00";

  timerInterval = setInterval(() => {
    const used = Math.floor((Date.now() - startTime) / 1000);
    if (timerEl) timerEl.textContent = formatTime(used);
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function resumeTimer() {
  if (!startTime) {
    startTimer();
    return;
  }

  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  stopTimer();
  startTime = Date.now() - elapsed * 1000;

  timerInterval = setInterval(() => {
    const used = Math.floor((Date.now() - startTime) / 1000);
    if (timerEl) timerEl.textContent = formatTime(used);
  }, 1000);
}

function validateStudentInfo() {
  if (!studentNameInput) {
    alert("找不到學生姓名輸入欄位，請確認 index.html。");
    return false;
  }

  const studentName = studentNameInput.value.trim();
  if (!studentName) {
    alert("請先填寫學生姓名。");
    return false;
  }
  return true;
}

function getAnsweredCount() {
  return userAnswers.filter(v => v !== null && v !== undefined).length;
}

function updateProgress() {
  const answered = getAnsweredCount();
  const total = currentQuestions.length || 0;
  const percent = total > 0 ? (answered / total) * 100 : 0;

  if (progressText) progressText.textContent = `${answered} / ${total}`;
  if (progressFill) progressFill.style.width = `${percent}%`;
  if (currentQNo) currentQNo.textContent = total > 0 ? `${currentQuestionIndex + 1} / ${total}` : "0";
  if (answeredCountEl) answeredCountEl.textContent = answered;
  if (currentLevelText) currentLevelText.textContent = `${activeLevel} / ${TOTAL_LEVELS}`;
}

function updateNavButtons() {
  if (prevBtn) prevBtn.disabled = !started || currentQuestionIndex === 0;
  if (nextBtn) nextBtn.disabled = !started || currentQuestionIndex >= currentQuestions.length - 1;
}

function askSubmitOnLastQuestion() {
  setTimeout(() => {
    const unansweredCount = userAnswers.filter(v => v === null || v === undefined).length;
    const ok = confirm(
      unansweredCount === 0
        ? "你已完成最後一題，是否現在提交試卷？"
        : `你已到最後一題，目前仍有 ${unansweredCount} 題未作答，是否現在提交試卷？`
    );

    if (ok) {
      submitQuiz();
    }
  }, 180);
}

function getDifficultyTarget(level) {
  if (level <= 10) return [1];
  if (level <= 20) return [1, 2];
  if (level <= 30) return [2];
  if (level <= 40) return [2, 3, 4];
  return [3, 4, 5];
}

function buildQuestionsForLevel(allQuestions, level) {
  const targets = getDifficultyTarget(level);
  let pool = allQuestions.filter(q => targets.includes(Number(q.diff || 1)));

  if (pool.length < QUESTIONS_PER_RUN) {
    pool = allQuestions;
  }

  const selected = shuffleArray(pool).slice(0, Math.min(QUESTIONS_PER_RUN, pool.length));
  return selected.map(q => shuffleQuestionOptions(q));
}

function renderSingleQuestion(direction = "right") {
  if (!singleQuestionWrap) return;

  singleQuestionWrap.innerHTML = "";

  if (!started || !currentQuestions.length) {
    singleQuestionWrap.innerHTML = `<div class="empty-state">請先輸入姓名並按「開始闖關」。</div>`;
    updateProgress();
    updateNavButtons();
    return;
  }

  const q = currentQuestions[currentQuestionIndex];
  const savedAnswer = userAnswers[currentQuestionIndex];

  const div = document.createElement("div");
  div.className = `question-card ${direction === "left" ? "slide-in-left" : "slide-in-right"}`;
  div.innerHTML = `
    <h3>第 ${currentQuestionIndex + 1} 題【${q.cat || ""}｜${q.type || ""}｜難度${q.diff ?? ""}】</h3>
    <p>${q.q || ""}</p>
    <div class="options">
      ${safeArray(q.opts).map((opt, i) => `
        <label class="option ${savedAnswer === i ? "selected" : ""}">
          <input type="radio" name="single_question" value="${i}" ${savedAnswer === i ? "checked" : ""}>
          <span>${String.fromCharCode(65 + i)}. ${opt}</span>
        </label>
      `).join("")}
    </div>
  `;
  singleQuestionWrap.appendChild(div);

  const radios = singleQuestionWrap.querySelectorAll('input[name="single_question"]');
  const optionLabels = singleQuestionWrap.querySelectorAll(".option");

  radios.forEach(radio => {
    radio.addEventListener("change", () => {
      userAnswers[currentQuestionIndex] = Number(radio.value);

      optionLabels.forEach(label => label.classList.remove("selected"));
      const parent = radio.closest(".option");
      if (parent) parent.classList.add("selected");

      updateProgress();

      if (currentQuestionIndex < currentQuestions.length - 1) {
        setTimeout(() => {
          currentQuestionIndex++;
          renderSingleQuestion("right");
        }, AUTO_NEXT_DELAY);
      } else {
        askSubmitOnLastQuestion();
      }
    });
  });

  updateProgress();
  updateNavButtons();
}

function startLevel(level) {
  if (!validateStudentInfo()) return;
  if (!bankSelect) return;

  currentBankName = bankSelect.value;
  const allQuestions = safeArray((QUESTION_BANKS || {})[currentBankName]);

  if (!currentBankName || allQuestions.length < BANK_MIN_QUESTIONS) {
    alert("此題庫未啟用或不存在。");
    return;
  }

  activeLevel = level;
  currentQuestions = buildQuestionsForLevel(allQuestions, level);

  started = true;
  submitted = false;
  currentQuestionIndex = 0;
  userAnswers = new Array(currentQuestions.length).fill(null);

  if (quizTitle) quizTitle.textContent = `${currentBankName}｜第 ${level} 關`;
  if (quizMeta) quizMeta.textContent = `共 ${currentQuestions.length} 題｜一題一頁闖關模式`;

  if (resultSection) resultSection.classList.add("hidden");
  if (levelUpBox) levelUpBox.classList.add("hidden");
  if (nextLevelBtn) nextLevelBtn.classList.add("hidden");
  if (retryLevelBtn) retryLevelBtn.classList.add("hidden");
  if (submitBtn) submitBtn.disabled = false;

  renderSingleQuestion("right");
  startTimer();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function startQuiz() {
  startLevel(getCurrentLevel());
}

function goPrev() {
  if (!started || currentQuestionIndex === 0) return;
  currentQuestionIndex--;
  renderSingleQuestion("left");
}

function goNext() {
  if (!started || currentQuestionIndex >= currentQuestions.length - 1) return;
  currentQuestionIndex++;
  renderSingleQuestion("right");
}

function buildResultData() {
  let score = 0;
  const wrongQuestions = [];

  currentQuestions.forEach((q, i) => {
    const studentAns = userAnswers[i];
    const correct = studentAns === q.ans;

    if (correct) {
      score++;
    } else {
        wrongQuestions.push({
        index: i + 1,
        cat: q.cat || "",
        type: q.type || "",
        question: q.q || "",
        studentAnswer: studentAns === null ? "未作答" : (q.opts?.[studentAns] ?? "未作答"),
        correctAnswer: q.opts?.[q.ans] ?? "",
        explanation: q.exp || ""
      });
    }
  });

  const total = currentQuestions.length;
  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
  const timeUsed = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;
  const passed = wrongQuestions.length === 0;

  return {
    studentName: studentNameInput ? studentNameInput.value.trim() : "",
    paper: currentBankName,
    level: activeLevel,
    score,
    total,
    percentage,
    timeUsed,
    wrongQuestions,
    passed
  };
}

function renderResult(result, levelInfo) {
  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  setText("rName", result.studentName);
  setText("rLevel", `第 ${result.level} 關`);
  setText("rPaper", result.paper);
  setText("rScore", `${result.score} / ${result.total}（${result.percentage}%）`);
  setText("rTime", `${result.timeUsed} 秒`);

  const starInfo = getStars(levelInfo.percentage);
  if (starValue) starValue.textContent = starInfo.stars;
  if (starDesc) starDesc.textContent = starInfo.desc;
  setText("rStars", starInfo.stars);

  if (result.passed) {
    if (levelUpText) {
      levelUpText.textContent = result.level < TOTAL_LEVELS
        ? `恭喜通過第 ${result.level} 關！`
        : `恭喜完成最終第 ${result.level} 關！`;
    }
    if (levelUpBox) levelUpBox.classList.remove("hidden");
    if (clearConditionText) clearConditionText.textContent = "本關全對，成功通關！可前往下一關。";
  } else {
    if (levelUpBox) levelUpBox.classList.add("hidden");
    if (clearConditionText) clearConditionText.textContent = "本關未能全對，需重新闖關。重考會重新抽題。";
  }

  if (nextLevelBtn) nextLevelBtn.classList.add("hidden");
  if (retryLevelBtn) retryLevelBtn.classList.add("hidden");

  if (result.passed && result.level < TOTAL_LEVELS && nextLevelBtn) {
    nextLevelBtn.classList.remove("hidden");
  }

  if (!result.passed && retryLevelBtn) {
    retryLevelBtn.classList.remove("hidden");
  }

  const wrongList = document.getElementById("wrongList");
  if (wrongList) {
    wrongList.innerHTML = "";

    if (!result.wrongQuestions.length) {
      wrongList.innerHTML = `<div class="wrong-item">全對，做得很好！</div>`;
    } else {
      result.wrongQuestions.forEach(item => {
        const div = document.createElement("div");
        div.className = "wrong-item";
        div.innerHTML = `
          <strong>第 ${item.index} 題【${item.cat}｜${item.type}】</strong>
          <p>${item.question}</p>
          <p><strong>你的答案：</strong>${item.studentAnswer}</p>
          <p><strong>正確答案：</strong>${item.correctAnswer}</p>
          <p><strong>解說：</strong>${item.explanation}</p>
        `;
        wrongList.appendChild(div);
      });
    }
  }

  if (resultSection) resultSection.classList.remove("hidden");
}

function submitQuiz() {
  if (!started) {
    alert("請先開始作答。");
    return;
  }

  if (submitted) {
    alert("你已提交過本次試卷。");
    return;
  }

  stopTimer();

  const unansweredCount = userAnswers.filter(v => v === null || v === undefined).length;
  if (unansweredCount > 0) {
    const ok = confirm(`你仍有 ${unansweredCount} 題未作答，是否仍要提交？`);
    if (!ok) {
      resumeTimer();
      return;
    }
  }

  const result = buildResultData();
  submitted = true;
  if (submitBtn) submitBtn.disabled = true;

  const levelInfo = updateAfterResult(result.level, result.percentage, result.passed);
  renderResult(result, levelInfo);

  window.scrollTo({
    top: resultSection ? resultSection.offsetTop - 12 : 0,
    behavior: "smooth"
  });
}

function resetAll() {
  stopTimer();

  started = false;
  submitted = false;
  currentBankName = "";
  currentQuestions = [];
  currentQuestionIndex = 0;
  userAnswers = [];
  activeLevel = getCurrentLevel();

  if (quizTitle) quizTitle.textContent = "請先開始作答";
  if (quizMeta) quizMeta.textContent = "選擇題庫後開始";
  if (singleQuestionWrap) {
    singleQuestionWrap.innerHTML = `<div class="empty-state">請先輸入姓名並按「開始闖關」。</div>`;
  }
  if (timerEl) timerEl.textContent = "00:00";

  if (progressText) progressText.textContent = "0 / 0";
  if (progressFill) progressFill.style.width = "0%";
  if (currentQNo) currentQNo.textContent = "0";
  if (answeredCountEl) answeredCountEl.textContent = "0";

  if (submitBtn) submitBtn.disabled = true;
  if (prevBtn) prevBtn.disabled = true;
  if (nextBtn) nextBtn.disabled = true;

  if (resultSection) resultSection.classList.add("hidden");
  if (levelUpBox) levelUpBox.classList.add("hidden");
  if (nextLevelBtn) nextLevelBtn.classList.add("hidden");
  if (retryLevelBtn) retryLevelBtn.classList.add("hidden");
}

function goNextLevel() {
  const nextLevel = Math.min(getCurrentLevel(), TOTAL_LEVELS);
  startLevel(nextLevel);
}

function retryCurrentLevel() {
  startLevel(activeLevel);
}

if (bankSelect) bankSelect.addEventListener("change", updateBankStatus);
if (startBtn) startBtn.addEventListener("click", startQuiz);
if (submitBtn) submitBtn.addEventListener("click", submitQuiz);
if (resetBtn) resetBtn.addEventListener("click", resetAll);
if (prevBtn) prevBtn.addEventListener("click", goPrev);
if (nextBtn) nextBtn.addEventListener("click", goNext);
if (nextLevelBtn) nextLevelBtn.addEventListener("click", goNextLevel);
if (retryLevelBtn) retryLevelBtn.addEventListener("click", retryCurrentLevel);

renderBankOptions();
renderProgressData();
updateProgress();
resetAll();
