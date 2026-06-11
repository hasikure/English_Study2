(() => {
  const STORE_KEY = "englishStudyMarkedWords:v1";
  const WORD_CHARS = /[A-Za-z'’-]/;

  const loadMarks = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  };
  const saveMarks = (marks) => localStorage.setItem(STORE_KEY, JSON.stringify(marks));
  const activeMarks = () => loadMarks().filter((mark) => !mark.submittedAt);
  const dictUrl = (word) => `https://ejje.weblio.jp/content/${encodeURIComponent(word)}`;

  window.EnglishStudyMarks = { STORE_KEY, loadMarks, saveMarks, activeMarks, dictUrl };

  const content = document.querySelector(".material-content");
  const main = document.querySelector("main.shell");
  if (!content || !main) return;
  const pageDate = main.dataset.studyDate || "";
  const pageMode = main.dataset.studyMode || "";

  function clearHighlights() {
    content.querySelectorAll("mark.study-mark").forEach((mark) => {
      const parent = mark.parentNode;
      while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
      mark.remove();
      parent.normalize();
    });
  }

  function matchRanges(text, targets) {
    const lower = text.toLowerCase();
    const ranges = [];
    for (const target of targets) {
      let from = 0;
      let index;
      while ((index = lower.indexOf(target, from)) !== -1) {
        const before = text[index - 1];
        const after = text[index + target.length];
        if (!(before && WORD_CHARS.test(before)) && !(after && WORD_CHARS.test(after))) {
          ranges.push([index, index + target.length]);
        }
        from = index + target.length;
      }
    }
    ranges.sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const range of ranges) {
      if (!merged.length || range[0] >= merged[merged.length - 1][1]) merged.push(range);
    }
    return merged;
  }

  function highlightNode(node, targets) {
    const text = node.textContent;
    const ranges = matchRanges(text, targets);
    if (!ranges.length) return;
    const fragment = document.createDocumentFragment();
    let position = 0;
    for (const [start, end] of ranges) {
      if (start > position) fragment.appendChild(document.createTextNode(text.slice(position, start)));
      const mark = document.createElement("mark");
      mark.className = "study-mark";
      mark.textContent = text.slice(start, end);
      fragment.appendChild(mark);
      position = end;
    }
    if (position < text.length) fragment.appendChild(document.createTextNode(text.slice(position)));
    node.parentNode.replaceChild(fragment, node);
  }

  function refreshHighlights() {
    clearHighlights();
    const targets = [...new Set(activeMarks().map((mark) => mark.word.toLowerCase()))];
    if (targets.length) {
      const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) =>
          node.parentElement && node.parentElement.closest("script, style")
            ? NodeFilter.FILTER_REJECT
            : NodeFilter.FILTER_ACCEPT,
      });
      const textNodes = [];
      while (walker.nextNode()) textNodes.push(walker.currentNode);
      textNodes.forEach((node) => highlightNode(node, targets));
    }
    renderPanel();
  }

  function wordAtPoint(x, y) {
    let node = null;
    let offset = 0;
    if (document.caretPositionFromPoint) {
      const position = document.caretPositionFromPoint(x, y);
      if (!position) return null;
      node = position.offsetNode;
      offset = position.offset;
    } else if (document.caretRangeFromPoint) {
      const range = document.caretRangeFromPoint(x, y);
      if (!range) return null;
      node = range.startContainer;
      offset = range.startOffset;
    } else {
      return null;
    }
    if (!node || node.nodeType !== Node.TEXT_NODE) return null;
    const text = node.textContent;
    if (!WORD_CHARS.test(text[offset] || "") && !WORD_CHARS.test(text[offset - 1] || "")) return null;
    let start = offset;
    let end = offset;
    while (start > 0 && WORD_CHARS.test(text[start - 1])) start -= 1;
    while (end < text.length && WORD_CHARS.test(text[end])) end += 1;
    const word = text.slice(start, end).replace(/^['’-]+|['’-]+$/g, "");
    return /[A-Za-z]/.test(word) ? word : null;
  }

  function toggleMark(word) {
    const key = word.toLowerCase();
    const marks = loadMarks();
    const existing = marks.findIndex((mark) => !mark.submittedAt && mark.word.toLowerCase() === key);
    if (existing !== -1) {
      marks.splice(existing, 1);
    } else {
      marks.push({ word, date: pageDate, mode: pageMode, addedAt: new Date().toISOString() });
    }
    saveMarks(marks);
    refreshHighlights();
  }

  let marking = false;
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "mark-toggle";
  const updateToggle = () => {
    toggle.textContent = marking ? "✍ マーク中" : "✎ マーク";
    toggle.classList.toggle("active", marking);
  };
  toggle.addEventListener("click", () => {
    marking = !marking;
    updateToggle();
  });
  updateToggle();
  document.body.appendChild(toggle);

  content.addEventListener("click", (event) => {
    if (!marking) return;
    if (event.target.closest("a, audio, button, input, textarea, details > summary")) return;
    const markElement = event.target.closest("mark.study-mark");
    const word = markElement ? markElement.textContent.trim() : wordAtPoint(event.clientX, event.clientY);
    if (!word) return;
    event.preventDefault();
    toggleMark(word);
  });

  const panel = document.createElement("details");
  panel.className = "marked-panel";
  panel.open = true;
  panel.innerHTML =
    '<summary>Marked Words (<span class="marked-count">0</span>)</summary>' +
    '<div class="marked-list"></div>' +
    '<p class="marked-help">マークボタンをONにして本文の単語をタップすると追加されます。もう一度タップすると解除。Review ページの New Items に自動で並びます。</p>';
  main.appendChild(panel);

  function renderPanel() {
    const marks = activeMarks();
    panel.querySelector(".marked-count").textContent = String(marks.length);
    const list = panel.querySelector(".marked-list");
    list.textContent = "";
    for (const mark of marks) {
      const row = document.createElement("div");
      row.className = "marked-row";
      const word = document.createElement("span");
      word.className = "marked-word";
      word.textContent = mark.word;
      const meta = document.createElement("span");
      meta.className = "marked-meta";
      meta.textContent = `${mark.date || ""} ${mark.mode || ""}`.trim();
      const dict = document.createElement("a");
      dict.className = "marked-dict";
      dict.href = dictUrl(mark.word);
      dict.target = "_blank";
      dict.rel = "noopener";
      dict.textContent = "辞書";
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "marked-remove";
      remove.textContent = "×";
      remove.addEventListener("click", () => toggleMark(mark.word));
      row.append(word, meta, dict, remove);
      list.appendChild(row);
    }
  }

  refreshHighlights();
})();
