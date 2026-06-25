(() => {
  const dataElement = document.getElementById("review-data");
  const app = document.getElementById("review-app");
  if (!dataElement || !app) return;
  const data = JSON.parse(dataElement.textContent);
  const store = window.EnglishStudyMarks;
  const draftKey = `englishStudyReviewDraft:v1:${data.date}`;

  let state = { items: {}, newItems: {}, manual: [] };
  try {
    const saved = JSON.parse(localStorage.getItem(draftKey) || "null");
    if (saved && typeof saved === "object") {
      state = Object.assign(state, saved);
    }
  } catch (error) {
    /* start fresh */
  }
  const persist = () => localStorage.setItem(draftKey, JSON.stringify(state));

  const itemState = (id) => {
    if (!state.items[id]) state.items[id] = { r: null, p: null, pr: null, memo: "" };
    return state.items[id];
  };
  const newItemState = (key) => {
    if (!state.newItems[key]) {
      state.newItems[key] = { meaning: "", itemType: "word", r: 0, p: 0, pr: 1, memo: "" };
    }
    return state.newItems[key];
  };

  function scoreGroup(labelText, getValue, setValue, max) {
    const wrapper = document.createElement("div");
    wrapper.className = "score-group";
    const label = document.createElement("span");
    label.className = "score-label";
    label.textContent = labelText;
    wrapper.appendChild(label);
    const buttons = [];
    for (let score = 0; score <= max; score += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "score-btn";
      button.textContent = String(score);
      button.addEventListener("click", () => {
        setValue(getValue() === score ? null : score);
        persist();
        repaint();
      });
      buttons.push(button);
      wrapper.appendChild(button);
    }
    const repaint = () => {
      buttons.forEach((button, score) => button.classList.toggle("selected", getValue() === score));
    };
    repaint();
    return wrapper;
  }

  function priorityButton(getValue, setValue) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "priority-btn";
    const repaint = () => {
      button.textContent = getValue() === 1 ? "★ また出す" : "☆ priority";
      button.classList.toggle("selected", getValue() === 1);
    };
    button.addEventListener("click", () => {
      setValue(getValue() === 1 ? null : 1);
      persist();
      repaint();
    });
    repaint();
    return button;
  }

  function textInput(placeholder, getValue, setValue) {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "review-text-input";
    input.placeholder = placeholder;
    input.value = getValue() || "";
    input.addEventListener("input", () => {
      setValue(input.value);
      persist();
    });
    return input;
  }

  // --- Today's Items sections (accordion per mode, compact rows) ---
  data.modes.forEach((section, sectionIndex) => {
    const block = document.createElement("details");
    block.className = "review-mode";
    if (sectionIndex === 0) block.open = true;
    const summary = document.createElement("summary");
    summary.textContent = `${section.label} (${section.items.length})`;
    block.appendChild(summary);
    for (const item of section.items) {
      const row = document.createElement("div");
      row.className = "review-item";
      const s = itemState(item.id);

      const head = document.createElement("div");
      head.className = "review-item-head";
      const expression = document.createElement("span");
      expression.className = "review-expression";
      expression.textContent = item.expression;
      const meaning = document.createElement("span");
      meaning.className = "review-meaning";
      meaning.textContent = item.meaning;
      const idBadge = document.createElement("span");
      idBadge.className = "review-id";
      idBadge.textContent = `#${item.id}`;
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "review-item-toggle";
      toggle.textContent = "priority/memo";
      head.append(expression, meaning, idBadge, toggle);
      row.appendChild(head);

      const scoreRow = document.createElement("div");
      scoreRow.className = "score-row";
      scoreRow.appendChild(scoreGroup("わかる", () => s.r, (v) => { s.r = v; }, 4));
      scoreRow.appendChild(scoreGroup("使える", () => s.p, (v) => { s.p = v; }, 4));
      row.appendChild(scoreRow);

      const advanced = document.createElement("div");
      advanced.className = "review-advanced";
      advanced.hidden = true;
      advanced.appendChild(priorityButton(() => s.pr, (v) => { s.pr = v; }));
      advanced.appendChild(textInput("memo", () => s.memo, (v) => { s.memo = v; }));
      row.appendChild(advanced);

      toggle.addEventListener("click", () => {
        advanced.hidden = !advanced.hidden;
        toggle.classList.toggle("open", !advanced.hidden);
      });

      block.appendChild(row);
    }
    app.appendChild(block);
  });

  // --- New Items (marked words + manual rows) ---
  const newSection = document.createElement("section");
  newSection.className = "review-section";
  const newHeading = document.createElement("h2");
  newHeading.textContent = "New Items(マークした単語)";
  newSection.appendChild(newHeading);
  const newHelp = document.createElement("p");
  newHelp.className = "review-note";
  newHelp.textContent = "意味(meaning_ja)を入れた単語だけ送信されます。空のままの単語はマークとして残ります。";
  newSection.appendChild(newHelp);
  const newList = document.createElement("div");
  newSection.appendChild(newList);

  const markedWords = store ? store.activeMarks() : [];

  function newItemRow(key, expressionLabel, options) {
    const row = document.createElement("div");
    row.className = "review-item";
    const s = newItemState(key);
    const head = document.createElement("div");
    const isMark = Boolean(options.markWord);
    if (isMark && !s.expression) s.expression = options.markWord;

    if (options.editableExpression || isMark) {
      const exprInput = document.createElement("input");
      exprInput.type = "text";
      exprInput.className = "review-text-input";
      exprInput.placeholder = isMark ? "expression(原形に直せます)" : "expression(英語)";
      exprInput.value = s.expression || "";
      head.appendChild(exprInput);

      let dict = null;
      if (store && isMark) {
        dict = document.createElement("a");
        dict.className = "review-id";
        dict.target = "_blank";
        dict.rel = "noopener";
        dict.textContent = "辞書";
        dict.href = store.dictUrl(s.expression || options.markWord);
        head.appendChild(dict);
      }
      exprInput.addEventListener("input", () => {
        s.expression = exprInput.value;
        if (dict) dict.href = store.dictUrl(exprInput.value || options.markWord);
        persist();
      });
      if (options.meta) {
        const meta = document.createElement("span");
        meta.className = "review-id";
        meta.textContent = options.meta;
        head.appendChild(meta);
      }
    } else {
      const expression = document.createElement("span");
      expression.className = "review-expression";
      expression.textContent = expressionLabel;
      head.appendChild(expression);
    }
    row.appendChild(head);
    row.appendChild(textInput("meaning_ja(必須)", () => s.meaning, (v) => { s.meaning = v; }));
    const typeSelect = document.createElement("select");
    typeSelect.className = "review-text-input";
    for (const itemType of ["word", "idiom", "usage", "pattern"]) {
      const option = document.createElement("option");
      option.value = itemType;
      option.textContent = `item_type: ${itemType}`;
      typeSelect.appendChild(option);
    }
    typeSelect.value = s.itemType || "word";
    typeSelect.addEventListener("change", () => {
      s.itemType = typeSelect.value;
      persist();
    });
    row.appendChild(typeSelect);
    row.appendChild(scoreGroup("わかる", () => s.r, (v) => { s.r = v; }, 4));
    row.appendChild(priorityButton(() => s.pr, (v) => { s.pr = v; }));
    row.appendChild(textInput("memo", () => s.memo, (v) => { s.memo = v; }));
    return row;
  }

  for (const mark of markedWords) {
    const key = `mark:${mark.word.toLowerCase()}`;
    newList.appendChild(
      newItemRow(key, mark.word, {
        markWord: mark.word,
        meta: `${mark.date || ""} ${mark.mode || ""}`.trim(),
      })
    );
  }

  let manualCount = 0;
  const addManualRow = () => {
    manualCount += 1;
    const key = `manual:${manualCount}`;
    newItemState(key);
    newList.appendChild(newItemRow(key, "", { editableExpression: true }));
  };
  const existingManualKeys = Object.keys(state.newItems).filter((key) => key.startsWith("manual:"));
  for (const key of existingManualKeys) {
    const s = state.newItems[key];
    if (s && ((s.expression || "").trim() || (s.meaning || "").trim())) {
      manualCount = Math.max(manualCount, Number(key.split(":")[1]) || 0);
      newList.appendChild(newItemRow(key, "", { editableExpression: true }));
    }
  }
  const addButton = document.createElement("button");
  addButton.type = "button";
  addButton.className = "review-secondary new-item-add";
  addButton.textContent = "+ 手動で単語を追加";
  addButton.addEventListener("click", addManualRow);
  newSection.appendChild(addButton);
  app.appendChild(newSection);

  // --- submit / copy ---
  const cleanText = (value) => (value || "").replace(/\r?\n/g, " ").trim();

  function buildBody() {
    const lines = ["# Review Session", "", "## Today's Items", ""];
    let included = 0;
    let skippedNoScore = 0;
    const usedMarkWords = [];
    let index = 0;
    for (const section of data.modes) {
      for (const item of section.items) {
        const s = state.items[item.id];
        if (!s) continue;
        const touched = s.r !== null || s.p !== null || s.pr !== null || cleanText(s.memo);
        if (!touched) continue;
        if (s.r === null && s.p === null) {
          skippedNoScore += 1;
          continue;
        }
        index += 1;
        included += 1;
        lines.push(
          `### Item ${index}`,
          `- id: ${item.id}`,
          `- expression: ${item.expression}`,
          `- receptive_score: ${s.r === null ? "" : s.r}`,
          `- productive_score: ${s.p === null ? "" : s.p}`,
          `- manual_priority: ${s.pr === null ? "" : s.pr}`,
          `- memo: ${cleanText(s.memo)}`,
          ""
        );
      }
    }
    lines.push("## New Items You Want To Add", "");
    let newIndex = 0;
    for (const [key, s] of Object.entries(state.newItems)) {
      const isMark = key.startsWith("mark:");
      const markWord = isMark
        ? (markedWords.find((mark) => `mark:${mark.word.toLowerCase()}` === key) || {}).word
        : null;
      const expression = isMark
        ? cleanText(s.expression || markWord || "")
        : cleanText(s.expression);
      if (!expression || !cleanText(s.meaning)) continue;
      newIndex += 1;
      included += 1;
      if (isMark && markWord) usedMarkWords.push(markWord.toLowerCase());
      lines.push(
        `### New Item ${newIndex}`,
        `- expression: ${expression}`,
        `- meaning_ja: ${cleanText(s.meaning)}`,
        `- item_type: ${s.itemType || "word"}`,
        `- receptive_score: ${s.r === null ? 0 : s.r}`,
        `- manual_priority: ${s.pr === null ? "" : s.pr}`,
        `- memo: ${cleanText(s.memo)}`,
        ""
      );
    }
    return { text: lines.join("\n"), included, skippedNoScore, usedMarkWords };
  }

  const actions = document.createElement("section");
  actions.className = "review-section";
  const submitButton = document.createElement("button");
  submitButton.type = "button";
  submitButton.className = "review-primary";
  submitButton.textContent = "GitHub に issue として送信";
  const copyButton = document.createElement("button");
  copyButton.type = "button";
  copyButton.className = "review-secondary";
  copyButton.textContent = "本文をコピー(手書き反映用)";
  const actionRow = document.createElement("div");
  actionRow.className = "review-actions";
  actionRow.append(submitButton, copyButton);
  const status = document.createElement("div");
  status.className = "review-status";
  const note = document.createElement("p");
  note.className = "review-note";
  note.textContent = "送信すると GitHub の issue 作成画面が開きます(要ログイン)。「Submit new issue」を押して完了。あとはローカルの pull-reviews が反映します。スコア(わかる/使える)が未入力の項目は送信されません。";
  actions.append(actionRow, status, note);

  const clearButton = document.createElement("button");
  clearButton.type = "button";
  clearButton.className = "review-secondary";
  clearButton.textContent = "送信が済んだらタップ → 下書きとマークをクリア";
  clearButton.style.display = "none";
  actions.appendChild(clearButton);
  app.appendChild(actions);

  let lastUsedMarkWords = [];

  submitButton.addEventListener("click", () => {
    const body = buildBody();
    if (!body.included) {
      status.textContent = "送信できる項目がありません(スコアか New Items の意味を入力してください)。";
      return;
    }
    const title = `${data.titlePrefix} ${data.date}`;
    const url = `https://github.com/${data.repo}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body.text)}`;
    lastUsedMarkWords = body.usedMarkWords;
    if (url.length > 7500) {
      status.textContent = "内容が長いため URL で送れません。「本文をコピー」して issue に貼り付けてください。";
      return;
    }
    window.open(url, "_blank");
    const skipped = body.skippedNoScore ? `(スコア未入力で送信されない項目: ${body.skippedNoScore}件)` : "";
    status.textContent = `issue 作成画面を開きました: ${body.included}件 ${skipped}`;
    clearButton.style.display = "inline-block";
  });

  copyButton.addEventListener("click", async () => {
    const body = buildBody();
    lastUsedMarkWords = body.usedMarkWords;
    try {
      await navigator.clipboard.writeText(body.text);
      status.textContent = `本文をコピーしました(${body.included}件)。review md に貼り付けて反映できます。`;
      clearButton.style.display = "inline-block";
    } catch (error) {
      status.textContent = "コピーに失敗しました。ブラウザの権限を確認してください。";
    }
  });

  clearButton.addEventListener("click", () => {
    if (store) {
      const marks = store.loadMarks();
      const now = new Date().toISOString();
      for (const mark of marks) {
        if (!mark.submittedAt) {
          mark.submittedAt = now;
        }
      }
      store.saveMarks(marks);
    }
    localStorage.removeItem(draftKey);
    location.reload();
  });
})();
