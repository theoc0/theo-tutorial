const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzx79_-i9JzU_P6pM-daF26m4ByC5-cx3DxczqZH221ozzi5h75x3_1H4nsiwkvPCOU/exec";
const SUBMIT_TOKEN = "school2026";
const BANK_MIN_QUESTIONS = 50;

let currentBankName = "";
let currentQuestions = [];
let started = false;
let submitted = false;
let startTime = null;
let timerInterval = null;

const bankSelect = document.getElementById("bankSelect");
const bankStatus = document.getElementById("bankStatus");
const startBtn = document.getElementById("startBtn");
const submitBtn = document.getElementById("submitBtn");
const resetBtn = document.getElementById("resetBtn");
const quizSection = document.getElementById("quizSection");
const resultSection = document.getElementById("resultSection");
const questionList = document.getElementById("questionList");
const quizTitle = document.getElementById("quizTitle");
const quizMeta = document.getElementById("quizMeta");
const timerEl = document.getElementById("timer");

const studentNameInput = document.getElementById("studentName");
const classNameInput = document.getElementById("className");
const studentNoInput = document.getElementById("studentNo");

function safeArray(value) {
  return Array.isArray(value) ? value : [];
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
    option.textContent = "沒有可用題庫";
    option.value = "";
    bankSelect.appendChild(option);
    startBtn.disabled = true;
    bankStatus.textContent = "未載入題庫。";
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
  const bankName = bankSelect.value;
  const questions = safeArray((QUESTION_BANKS || {})[bankName]);

  if (!bankName) {
    bankStatus.textContent = "未選擇題庫。";
    startBtn.disabled = true;
    return;
  }

  if (questions.length < BANK_MIN_QUESTIONS) {
    bankStatus.textContent = `此題庫題目少於 ${BANK_MIN_QUESTIONS} 題，已禁用。`;
    startBtn.disabled = true;
  } else {
    bankStatus.textContent = `此題庫可用，共 ${questions.length} 題。`;
    startBtn.disabled = false;
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
  timerEl.textContent = "00:00";
  timerInterval = setInterval(() => {
    const used = Math.floor((Date.now() - startTime) / 1000);
    timerEl.textContent = formatTime(used);
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function validateStudentInfo() {
  const studentName = studentNameInput?.value.trim() || "";
  const className = classNameInput?.value.trim() || "";
  const studentNo = studentNoInput?.value.trim() || "";

  if (!studentName || !className || !studentNo) {
    alert("請先填寫姓名、班別、學號。");
    return false;
  }
  return true;
}

function renderQuestions() {
  questionList.innerHTML = "";

  currentQuestions.forEach((q, index) => {
    const div = document.createElement("div");
    div.className = "question-card";

    const optsHtml = safeArray(q.opts).map((opt, i) => {
      const label = String.fromCharCode(65 + i);
      return `
        <label class="option">
          <input type="radio" name="q_${index}" value="${i}">
          <span>${label}. ${opt}</span>
        </label>
      `;
    }).join("");

    div.innerHTML = `
      <h3>第 ${index + 1} 題【${q.cat || ""}｜${q.type || ""}｜難度${q.diff ?? ""}】</h3>
      <p>${q.q || ""}</p>
      <div class="options">${optsHtml}</div>
    `;

    questionList.appendChild(div);
  });
}

function startQuiz() {
  if (!validateStudentInfo()) return;

  currentBankName = bankSelect.value;
  currentQuestions = safeArray((QUESTION_BANKS || {})[currentBankName]);

  if (!currentBankName || currentQuestions.length < BANK_MIN_QUESTIONS) {
    alert("此題庫未啟用或不存在。");
    return;
  }

  started = true;
  submitted = false;

  quizSection.classList.remove("hidden");
  resultSection.classList.add("hidden");
  submitBtn.disabled = false;

  quizTitle.textContent = currentBankName;
  quizMeta.textContent = `共 ${currentQuestions.length} 題`;
  renderQuestions();
  startTimer();

  window.scrollTo({ top: quizSection.offsetTop - 10, behavior: "smooth" });
}

function collectAnswers() {
  return currentQuestions.map((q, index) => {
    const checked = document.querySelector(`input[name="q_${index}"]:checked`);
    return checked ? Number(checked.value) : null;
  });
}

function buildResultData() {
  const studentName = studentNameInput?.value.trim() || "";
  const className = classNameInput?.value.trim() || "";
  const studentNo = studentNoInput?.value.trim() || "";
  const answers = collectAnswers();

  let score = 0;
  const wrongQuestions = [];

  currentQuestions.forEach((q, i) => {
    const studentAns = answers[i];
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

  return {
    token: SUBMIT_TOKEN,
    studentName,
    className,
    studentNo,
    paper: currentBankName,
    score,
    total,
    percentage,
    timeUsed,
    wrongQuestions,
    submittedAt: new Date().toISOString()
  };
}

function renderResult(result) {
  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  setText("rName", result.studentName);
  setText("rClass", result.className);
  setText("rNo", result.studentNo);
  setText("rPaper", result.paper);
  setText("rScore", `${result.score} / ${result.total}（${result.percentage}%）`);
  setText("rTime", `${result.timeUsed} 秒`);

  const wrongList = document.getElementById("wrongList");
  if (!wrongList) return;

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

  resultSection.classList.remove("hidden");
}

async function submitResultToCloud(resultData) {
  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(resultData)
    });

    const text = await response.text();

    try {
      return JSON.parse(text);
    } catch {
      return { status: "unknown", raw: text };
    }
  } catch (error) {
    console.error("提交失敗：", error);
    return { status: "error", message: error.message };
  }
}

async function submitQuiz() {
  if (!started) {
    alert("請先開始作答。");
    return;
  }

  if (submitted) {
    alert("你已提交過成績。");
    return;
  }

  stopTimer();

  const unansweredCount = collectAnswers().filter(v => v === null).length;
  if (unansweredCount > 0) {
    const ok = confirm(`你仍有 ${unansweredCount} 題未作答，是否仍要提交？`);
    if (!ok) {
      startTimerResume();
      return;
    }
  }

  const result = buildResultData();
  renderResult(result);

  submitBtn.disabled = true;
  submitted = true;

  const response = await submitResultToCloud(result);

  if (response.status === "success" || response.status === "success_raw" || response.status === "unknown") {
    alert("成績已成功提交到雲端。");
  } else {
    alert(`成績已計算，但雲端提交失敗：${response.message || "未知錯誤"}`);
  }

  window.scrollTo({ top: resultSection.offsetTop - 10, behavior: "smooth" });
}

function startTimerResume() {
  if (!startTime) {
    startTimer();
    return;
  }
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  stopTimer();
  const resumedBase = Date.now() - elapsed * 1000;
  startTime = resumedBase;
  timerInterval = setInterval(() => {
    const used = Math.floor((Date.now() - startTime) / 1000);
    timerEl.textContent = formatTime(used);
  }, 1000);
}

function resetAll() {
  stopTimer();
  started = false;
  submitted = false;
  currentBankName = "";
  currentQuestions = [];
  questionList.innerHTML = "";
  quizSection.classList.add("hidden");
  resultSection.classList.add("hidden");
  submitBtn.disabled = true;
  timerEl.textContent = "00:00";
}

if (bankSelect) bankSelect.addEventListener("change", updateBankStatus);
if (startBtn) startBtn.addEventListener("click", startQuiz);
if (submitBtn) submitBtn.addEventListener("click", submitQuiz);
if (resetBtn) resetBtn.addEventListener("click", resetAll);

renderBankOptions();
