(() => {
  const dataEl = document.getElementById("stats-data");
  const app = document.getElementById("stats-app");
  if (!dataEl || !app) return;
  const data = JSON.parse(dataEl.textContent);

  async function sha256Hex(text) {
    const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  function pct(n, d) {
    return d ? `${Math.round((n / d) * 100)}%` : "0%";
  }

  function renderTable(headers, rows) {
    const wrap = document.createElement("div");
    wrap.className = "table-wrap";
    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    headers.forEach((text) => {
      const th = document.createElement("th");
      th.textContent = text;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);
    const tbody = document.createElement("tbody");
    rows.forEach((row) => {
      const tr = document.createElement("tr");
      row.forEach((cell) => {
        const td = document.createElement("td");
        td.textContent = cell;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  }

  function section(heading, note) {
    const box = document.createElement("section");
    box.className = "review-section";
    const h2 = document.createElement("h2");
    h2.textContent = heading;
    box.appendChild(h2);
    if (note) {
      const p = document.createElement("p");
      p.className = "review-note";
      p.textContent = note;
      box.appendChild(p);
    }
    return box;
  }

  function buildApp() {
    app.textContent = "";

    const updated = document.createElement("p");
    updated.className = "review-note";
    updated.textContent = `Updated: ${data.updated}`;
    app.appendChild(updated);

    const overview = section("Overview");
    overview.appendChild(renderTable(
      ["Category", "Count"],
      [
        ["Total items", data.total],
        ["High priority", data.highPriority],
        ["Never studied", data.neverStudied],
        ["Not seen in 14+ days", data.stale14],
      ],
    ));
    app.appendChild(overview);

    const receptive = section("Receptive Score Distribution");
    receptive.appendChild(renderTable(
      ["Score", "Label", "Count", "%"],
      data.receptive.map((row) => [row.score, row.label, row.count, pct(row.count, data.total)]),
    ));
    app.appendChild(receptive);

    const productive = section(
      "Productive Score Distribution",
      `Items with a recorded productive score: ${data.productiveTotal}/${data.total}`,
    );
    productive.appendChild(renderTable(
      ["Score", "Label", "Count", "%"],
      [
        ["—", "not recorded (null)", data.productiveNull, pct(data.productiveNull, data.total)],
        ...data.productive.map((row) => [row.score, row.label, row.count, pct(row.count, data.productiveTotal)]),
      ],
    ));
    app.appendChild(productive);

    const types = section("Breakdown by Item Type");
    types.appendChild(renderTable(
      ["Type", "Total", "r≤1 (weak)", "r≥3 (strong)"],
      data.types.map((row) => [row.type, row.total, row.rLow, row.rHigh]),
    ));
    app.appendChild(types);
  }

  // --- Optional password gate (hash embedded; plaintext stays in local .env) ---
  const unlockKey = data.passwordHash ? `englishStudyStatsUnlocked:${data.passwordHash}` : null;

  function renderLock() {
    const box = document.createElement("section");
    box.className = "review-section";
    const heading = document.createElement("h2");
    heading.textContent = "🔒 パスワード";
    const note = document.createElement("p");
    note.className = "review-note";
    note.textContent = "この統計ページはパスワードで保護されています。パスワードを入力してください。";
    const input = document.createElement("input");
    input.type = "password";
    input.className = "review-text-input";
    input.placeholder = "パスワード";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "review-primary";
    button.textContent = "ロック解除";
    const message = document.createElement("div");
    message.className = "review-status";

    const unlock = () => {
      try { sessionStorage.setItem(unlockKey, "1"); } catch (error) { /* ignore */ }
      app.textContent = "";
      buildApp();
    };
    const attempt = async () => {
      try {
        const hex = await sha256Hex((data.passwordSalt || "") + input.value);
        if (hex === data.passwordHash) unlock();
        else message.textContent = "パスワードが違います。";
      } catch (error) {
        message.textContent = "この環境では解錠できません(HTTPSで開いてください)。";
      }
    };
    button.addEventListener("click", attempt);
    input.addEventListener("keydown", (event) => { if (event.key === "Enter") attempt(); });
    box.append(heading, note, input, button, message);
    app.appendChild(box);
    input.focus();
  }

  if (data.passwordHash && window.crypto && window.crypto.subtle) {
    if (sessionStorage.getItem(unlockKey) === "1") buildApp();
    else renderLock();
  } else {
    buildApp();
  }
})();
