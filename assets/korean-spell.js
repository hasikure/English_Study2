(() => {
  const dataEl = document.getElementById("korean-spell-data");
  const app = document.getElementById("korean-spell-app");
  if (!dataEl || !app) return;
  const data = JSON.parse(dataEl.textContent);
  const questions = Array.isArray(data.questions) ? data.questions : [];
  const draftKey = `koreanSpellDraft:v1:${data.date}`;

  let answers = [];
  try {
    const saved = JSON.parse(localStorage.getItem(draftKey) || "[]");
    if (Array.isArray(saved)) answers = saved;
  } catch (error) {
    answers = [];
  }
  const persist = () => localStorage.setItem(draftKey, JSON.stringify(answers));
  const norm = (value) => (value || "").replace(/\s+/g, "").trim();
  // Hide any parenthetical that reveals the Korean answer, e.g. "(몸 = 体)".
  const cleanHint = (value) =>
    (value || "")
      .replace(/[（(][^（）()]*[가-힣][^（）()]*[）)]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  questions.forEach((q, index) => {
    const card = document.createElement("section");
    card.className = "spell-item";

    const num = document.createElement("div");
    num.className = "spell-num";
    num.textContent = `Q${index + 1}`;
    card.appendChild(num);

    const input = document.createElement("input");
    input.type = "text";
    input.className = "spell-input";
    input.lang = "ko";
    input.setAttribute("autocomplete", "off");
    input.setAttribute("autocapitalize", "off");
    input.placeholder = "한국어 입력";
    input.value = answers[index] || "";
    input.addEventListener("input", () => {
      answers[index] = input.value;
      persist();
    });

    const sentence = document.createElement("p");
    sentence.className = "spell-sentence";
    sentence.lang = "ko";
    const parts = (q.sentence || "").split(/_{2,}/);
    if (parts.length >= 2) {
      sentence.appendChild(document.createTextNode(parts[0]));
      sentence.appendChild(input);
      sentence.appendChild(document.createTextNode(parts.slice(1).join(" ")));
      card.appendChild(sentence);
    } else {
      sentence.textContent = q.sentence || "";
      card.appendChild(sentence);
      card.appendChild(input);
    }

    const hintText = cleanHint(q.meaning_ja);
    if (hintText) {
      const hint = document.createElement("p");
      hint.className = "spell-hint";
      hint.textContent = hintText;
      card.appendChild(hint);
    }

    const revealBtn = document.createElement("button");
    revealBtn.type = "button";
    revealBtn.className = "spell-reveal";
    revealBtn.textContent = "答えを見る";
    const result = document.createElement("div");
    result.className = "spell-result";
    result.style.display = "none";
    revealBtn.addEventListener("click", () => {
      const ok = norm(input.value) === norm(q.target);
      result.style.display = "block";
      result.classList.toggle("ok", ok);
      result.classList.toggle("ng", !ok);
      const answerText = q.answer ? ` ／ ${q.answer}` : "";
      result.textContent = `${ok ? "○ 正解" : "× もう一度"}　正答: ${q.target}${answerText}`;
    });
    card.appendChild(revealBtn);
    card.appendChild(result);

    app.appendChild(card);
  });

  const actions = document.createElement("div");
  actions.className = "review-actions";
  const allBtn = document.createElement("button");
  allBtn.type = "button";
  allBtn.className = "review-primary";
  allBtn.textContent = "全部の答えを見る";
  allBtn.addEventListener("click", () => {
    app.querySelectorAll(".spell-item .spell-reveal").forEach((button) => button.click());
  });
  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.className = "review-secondary";
  clearBtn.textContent = "入力をクリア";
  clearBtn.addEventListener("click", () => {
    answers = [];
    localStorage.removeItem(draftKey);
    location.reload();
  });
  actions.append(allBtn, clearBtn);
  app.appendChild(actions);
})();
