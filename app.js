const TOTAL_LEVELS = 100;
const QUESTIONS_PER_LEVEL = 30;

let currentLevel = 1;
let player = "";
let currentSet = [];
let answered = false;

function getUnlocked(){
  return JSON.parse(localStorage.getItem("zhGameUnlocked") || "1");
}

function setUnlocked(n){
  localStorage.setItem("zhGameUnlocked", JSON.stringify(n));
}

function initLevels(){
  const sel = document.getElementById("levelSelect");
  const unlocked = getUnlocked();
  sel.innerHTML = "";
  for(let i=1;i<=TOTAL_LEVELS;i++){
    const op = document.createElement("option");
    op.value = i;
    op.textContent = `Lv ${i}${i<=unlocked ? "" : "（未解鎖）"}`;
    if(i>unlocked) op.disabled = true;
    sel.appendChild(op);
  }
  sel.value = 1;
}
initLevels();

function resetProgress(){
  if(confirm("確定要重設所有解鎖進度？")){
    setUnlocked(1);
    initLevels();
    alert("已重設為 Lv 1。");
  }
}

function getDifficultyBand(level){
  if(level <= 20){
    return {must:[1,2], main:[1,2], extra:[3]};
  }else if(level <= 40){
    return {must:[1,2,3], main:[2,3], extra:[4]};
  }else if(level <= 60){
    return {must:[2,3,4], main:[3,4], extra:[5]};
  }else if(level <= 80){
    return {must:[3,4,5], main:[4,5], extra:[5]};
  }else{
    return {must:[4,5], main:[4,5], extra:[3]};
  }
}

function shuffle(arr){
  const a = [...arr];
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}

function uniqueByQuestion(arr){
  const seen = new Set();
  return arr.filter(q=>{
    const key = q.cat + "|" + q.type + "|" + q.q;
    if(seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function takeFromPool(pool, count, usedSet){
  const out = [];
  for(const q of shuffle(pool)){
    const key = q.cat + "|" + q.type + "|" + q.q;
    if(!usedSet.has(key)){
      usedSet.add(key);
      out.push(q);
    }
    if(out.length >= count) break;
  }
  return out;
}

function buildQuestionSet(level){
  const band = getDifficultyBand(level);
  const used = new Set();
  let set = [];

  const lessonNeeds = [
    {cat:"水調歌頭", count:5},
    {cat:"孔明借箭", count:6},
    {cat:"最苦與最樂", count:5},
    {cat:"人間有情", count:5},
    {cat:"語文運用", count:9}
  ];

  // 每類先按主要難度抽題
  lessonNeeds.forEach(item=>{
    const poolMain = QUESTION_BANK.filter(q=>q.cat===item.cat && band.main.includes(q.diff));
    const poolMust = QUESTION_BANK.filter(q=>q.cat===item.cat && band.must.includes(q.diff));
    let selected = takeFromPool(uniqueByQuestion(poolMain), item.count, used);

    if(selected.length < item.count){
      const remainCount = item.count - selected.length;
      const extra = takeFromPool(uniqueByQuestion(poolMust), remainCount, used);
      selected = selected.concat(extra);
    }

    if(selected.length < item.count){
      const fallback = QUESTION_BANK.filter(q=>q.cat===item.cat);
      const extra2 = takeFromPool(uniqueByQuestion(fallback), item.count - selected.length, used);
      selected = selected.concat(extra2);
    }

    set = set.concat(selected);
  });

  // 若不足 30 題，按全題庫難度補足
  if(set.length < QUESTIONS_PER_LEVEL){
    const supplementPool = QUESTION_BANK.filter(q =>
      band.main.includes(q.diff) || band.extra.includes(q.diff)
    );
    set = set.concat(takeFromPool(uniqueByQuestion(supplementPool), QUESTIONS_PER_LEVEL - set.length, used));
  }

  // 若仍不足，最後全庫補足
  if(set.length < QUESTIONS_PER_LEVEL){
    set = set.concat(takeFromPool(uniqueByQuestion(QUESTION_BANK), QUESTIONS_PER_LEVEL - set.length, used));
  }

  // 超過則隨機裁切
  set = shuffle(set).slice(0, QUESTIONS_PER_LEVEL);

  return set;
}

function startGame(){
  const name = document.getElementById("playerName").value.trim();
  const level = parseInt(document.getElementById("levelSelect").value,10);
  const unlocked = getUnlocked();

  if(!name){
    alert("請先輸入角色名。");
    return;
  }
  if(level > unlocked){
    alert("此等級尚未解鎖。");
    return;
  }

  player = name;
  currentLevel = level;
  currentSet = buildQuestionSet(level);
  answered = false;

  document.getElementById("startPanel").classList.add("hidden");
  document.getElementById("gamePanel").classList.remove("hidden");
  document.getElementById("gameTitle").textContent = `${player} 的闖關試煉：Lv ${currentLevel}`;
  document.getElementById("gameSub").innerHTML =
    `本關包含 <span class="pill">${currentSet.length} 題</span>　` +
    `<span class="pill">難度範圍：${getDifficultyBandText(currentLevel)}</span>　` +
    `<span class="pill">覆蓋所有範圍</span>`;
  document.getElementById("statLevel").textContent = currentLevel;
  document.getElementById("statCount").textContent = currentSet.length;

  renderQuiz();
  updateProgress();
  document.getElementById("resultPanel").classList.add("hidden");
  window.scrollTo({top:0, behavior:"smooth"});
}

function getDifficultyBandText(level){
  const band = getDifficultyBand(level);
  return `Lv題難度 ${band.main.join(" / ")}`;
}

function backHome(){
  document.getElementById("gamePanel").classList.add("hidden");
  document.getElementById("startPanel").classList.remove("hidden");
  initLevels();
  window.scrollTo({top:0, behavior:"smooth"});
}

function renderQuiz(){
  const area = document.getElementById("quizArea");
  area.innerHTML = "";
  currentSet.forEach((q, idx)=>{
    const div = document.createElement("div");
    div.className = "question";
    div.innerHTML = `
      <div class="q-meta">第 ${idx+1} 題 ・ ${q.cat} ・ ${q.type} ・ 難度 ${q.diff}</div>
      <div class="q-title">${q.q}</div>
      <div class="options">
        ${q.opts.map((opt,i)=>`
          <label class="option">
            <input type="radio" name="q${idx}" value="${i}" onchange="updateProgress()">
            ${String.fromCharCode(65+i)}. ${opt}
          </label>
        `).join("")}
      </div>
      <div id="feedback-${idx}" class="answer-box hidden"></div>
    `;
    area.appendChild(div);
  });
}

function updateProgress(){
  const total = currentSet.length;
  let done = 0;
  for(let i=0;i<total;i++){
    const checked = document.querySelector(`input[name="q${i}"]:checked`);
    if(checked) done++;
  }
  document.getElementById("progressBar").style.width = `${done/total*100}%`;
}

function submitLevel(){
  if(answered) return;
  answered = true;

  let score = 0;
  currentSet.forEach((q, idx)=>{
    const selected = document.querySelector(`input[name="q${idx}"]:checked`);
    const fb = document.getElementById(`feedback-${idx}`);
    if(selected){
      const val = parseInt(selected.value,10);
      if(val === q.ans){
        score++;
        fb.innerHTML = `<span class="correct">✓ 你答對了</span><br><strong>正確答案：</strong>${String.fromCharCode(65+q.ans)}. ${q.opts[q.ans]}<br><strong>說明：</strong>${q.exp}`;
      } else {
        fb.innerHTML = `<span class="wrong">✗ 你答錯了</span><br><strong>你的答案：</strong>${String.fromCharCode(65+val)}. ${q.opts[val]}<br><strong>正確答案：</strong>${String.fromCharCode(65+q.ans)}. ${q.opts[q.ans]}<br><strong>說明：</strong>${q.exp}`;
      }
    } else {
      fb.innerHTML = `<span class="wrong">✗ 你未作答</span><br><strong>正確答案：</strong>${String.fromCharCode(65+q.ans)}. ${q.opts[q.ans]}<br><strong>說明：</strong>${q.exp}`;
    }
    fb.classList.remove("hidden");
  });

  const passLine = Math.ceil(currentSet.length * 0.6);
  let unlocked = getUnlocked();
  const passed = score >= passLine;

  if(passed && currentLevel >= unlocked && currentLevel < TOTAL_LEVELS){
    unlocked = currentLevel + 1;
    setUnlocked(unlocked);
  }

  const rp = document.getElementById("resultPanel");
  rp.classList.remove("hidden");
  rp.innerHTML = `
    <h3>本關結果</h3>
    <div>角色名：<strong>${escapeHtml(player)}</strong></div>
    <div>等級：<strong>Lv ${currentLevel}</strong></div>
    <div>得分：<strong>${score} / ${currentSet.length}</strong></div>
    <div>過關線：<strong>${passLine}</strong></div>
    <div style="margin-top:8px">${passed ? `<span class="correct">恭喜過關，已解鎖下一關。</span>` : `<span class="wrong">未達過關線，可重玩本關再挑戰。</span>`}</div>
    <div style="margin-top:10px">
      <button class="success" onclick="goNextLevel()" ${passed && currentLevel < TOTAL_LEVELS ? "" : "disabled"}>前往下一關</button>
      <button class="secondary" onclick="startGame()">重玩本關</button>
      <button class="secondary" onclick="downloadAnswerSheetWithResponses()">下載本關作答PDF內容</button>
    </div>
    <div class="footer">你可向下查看每一題的正確答案與解析。</div>
  `;
  initLevels();
  window.scrollTo({top:0, behavior:"smooth"});
}

function goNextLevel(){
  const unlocked = getUnlocked();
  if(currentLevel + 1 <= unlocked){
    document.getElementById("levelSelect").value = currentLevel + 1;
    document.getElementById("startPanel").classList.remove("hidden");
    document.getElementById("gamePanel").classList.add("hidden");
    startGame();
  }
}

function openPrintWindow(html){
  const w = window.open("", "_blank");
  w.document.write(html);
  w.document.close();
  w.focus();
}

function basePrintCSS(){
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

function downloadBlankPDFLike(){
  const name = document.getElementById("playerName").value.trim() || player || "________________";
  const level = parseInt(document.getElementById("levelSelect").value,10) || currentLevel || 1;
  const set = buildQuestionSet(level);
  const html = `
    <html><head><title>學生作答紙</title>${basePrintCSS()}</head><body>
      <h1>中三中文闖關王 — 學生作答紙</h1>
      <div class="meta">
        角色名：${escapeHtml(name)}<br>
        等級：Lv ${level}<br>
        題數：${set.length}<br>
        建議時間：60分鐘
      </div>
      ${set.map((q,idx)=>`
        <div class="q">
          <strong>第 ${idx+1} 題</strong>（${q.cat}｜${q.type}）<br>
          ${escapeHtml(q.q)}
          ${q.opts.map((o,i)=>`<div class="opt">${String.fromCharCode(65+i)}. ${escapeHtml(o)}</div>`).join("")}
          <div class="space"></div>
        </div>
      `).join("")}
      <div class="small">請在瀏覽器中選擇「列印」→「另存為 PDF」。</div>
      <button onclick="window.print()">列印 / 另存為 PDF</button>
    </body></html>
  `;
  openPrintWindow(html);
}

function downloadAnswerSheetWithResponses(){
  if(!currentSet.length) return;
  const html = `
    <html><head><title>本關作答與答案</title>${basePrintCSS()}</head><body>
      <h1>中三中文闖關王 — 本關作答與答案</h1>
      <div class="meta">
        角色名：${escapeHtml(player)}<br>
        等級：Lv ${currentLevel}<br>
        題數：${currentSet.length}
      </div>
      ${currentSet.map((q,idx)=>{
        const selected = document.querySelector(`input[name="q${idx}"]:checked`);
        const val = selected ? parseInt(selected.value,10) : null;
        return `
          <div class="q">
            <strong>第 ${idx+1} 題</strong>（${q.cat}｜${q.type}）<br>
            ${escapeHtml(q.q)}
            ${q.opts.map((o,i)=>`<div class="opt">${String.fromCharCode(65+i)}. ${escapeHtml(o)}</div>`).join("")}
            <div><strong>你的答案：</strong>${val===null ? "未作答" : `${String.fromCharCode(65+val)}. ${escapeHtml(q.opts[val])}`}</div>
            <div><strong>正確答案：</strong>${String.fromCharCode(65+q.ans)}. ${escapeHtml(q.opts[q.ans])}</div>
            <div><strong>說明：</strong>${escapeHtml(q.exp)}</div>
          </div>
        `;
      }).join("")}
      <div class="small">請在瀏覽器中選擇「列印」→「另存為 PDF」。</div>
      <button onclick="window.print()">列印 / 另存為 PDF</button>
    </body></html>
  `;
  openPrintWindow(html);
}

function escapeHtml(str){
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;");
}
