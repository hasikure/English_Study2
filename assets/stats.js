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

  // Ordinal ramp, one hue (blue), light -> dark as score 0 (unknown) -> 4 (mastered).
  // Steps 300/400/500/600/700 of the documented sequential ramp, validated against
  // the .bar-track surface (--soft #e7f3ef): contrast, monotone L, and step gaps all pass.
  const SCORE_COLORS = ["#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"];
  const NULL_COLOR = "rgba(101, 115, 109, 0.32)";
  const STATUS_GOOD = "#0ca30c";
  const STATUS_CRITICAL = "#d03b3b";

  function renderStatTiles(tiles) {
    const grid = document.createElement("div");
    grid.className = "stat-tiles";
    tiles.forEach(({ label, value }) => {
      const tile = document.createElement("div");
      tile.className = "stat-tile";
      const labelEl = document.createElement("div");
      labelEl.className = "stat-tile-label";
      labelEl.textContent = label;
      const valueEl = document.createElement("div");
      valueEl.className = "stat-tile-value";
      valueEl.textContent = value;
      tile.append(labelEl, valueEl);
      grid.appendChild(tile);
    });
    return grid;
  }

  // rows: [{ label, count, pct, color }] - pct is 0-100, already computed by the caller.
  function renderBarChart(rows) {
    const chart = document.createElement("div");
    chart.className = "bar-chart";
    rows.forEach(({ label, count, pct: percent, color }) => {
      const row = document.createElement("div");
      row.className = "bar-row";

      const rowLabel = document.createElement("div");
      rowLabel.className = "bar-row-label";
      rowLabel.textContent = label;

      const track = document.createElement("div");
      track.className = "bar-track";
      const fill = document.createElement("div");
      fill.className = "bar-fill";
      fill.style.width = `${Math.max(percent, percent > 0 ? 1.5 : 0)}%`;
      fill.style.background = color;
      track.appendChild(fill);

      const value = document.createElement("div");
      value.className = "bar-row-value";
      value.textContent = `${count} (${Math.round(percent)}%)`;

      row.append(rowLabel, track, value);
      chart.appendChild(row);
    });
    return chart;
  }

  function renderLegend(items) {
    const legend = document.createElement("div");
    legend.className = "chart-legend";
    items.forEach(({ label, color }) => {
      const entry = document.createElement("span");
      entry.className = "legend-entry";
      const dot = document.createElement("span");
      dot.className = "legend-dot";
      dot.style.background = color;
      entry.append(dot, document.createTextNode(label));
      legend.appendChild(entry);
    });
    return legend;
  }

  // groups: [{ label, bars: [{ key, count, pct, color, icon }] }]
  // `icon` is a secondary (non-color) encoding: red/green fails the colorblind
  // separation check outright (deutan ΔE 4.1, below the 6 floor), so identity
  // here must not rest on hue alone - see the icon + legend text pairing below.
  function renderGroupedBarChart(groups) {
    const chart = document.createElement("div");
    chart.className = "bar-chart";
    groups.forEach(({ label, bars }) => {
      const group = document.createElement("div");
      group.className = "bar-group";
      const groupLabel = document.createElement("div");
      groupLabel.className = "bar-group-label";
      groupLabel.textContent = label;
      const groupBars = document.createElement("div");
      groupBars.className = "bar-group-bars";
      bars.forEach(({ count, pct: percent, color, icon }) => {
        const row = document.createElement("div");
        row.className = "bar-row bar-row-compact";
        const track = document.createElement("div");
        track.className = "bar-track";
        const fill = document.createElement("div");
        fill.className = "bar-fill";
        fill.style.width = `${Math.max(percent, percent > 0 ? 1.5 : 0)}%`;
        fill.style.background = color;
        track.appendChild(fill);
        const value = document.createElement("div");
        value.className = "bar-row-value";
        value.textContent = `${icon ? icon + " " : ""}${count}`;
        row.append(track, value);
        groupBars.appendChild(row);
      });
      group.append(groupLabel, groupBars);
      chart.appendChild(group);
    });
    return chart;
  }

  // points: [{ label, count, isCurrent }] - a column chart for a short, discrete
  // time series (months). Bar height is relative to the max count shown.
  function renderColumnChart(points) {
    const chart = document.createElement("div");
    chart.className = "column-chart";
    const max = Math.max(1, ...points.map((p) => p.count));
    points.forEach(({ label, count, isCurrent }) => {
      const column = document.createElement("div");
      column.className = isCurrent ? "column is-current" : "column";
      const value = document.createElement("div");
      value.className = "column-value";
      value.textContent = `${count}`;
      const bar = document.createElement("div");
      bar.className = "column-bar";
      bar.style.height = `${Math.max((count / max) * 100, count > 0 ? 3 : 1)}%`;
      const colLabel = document.createElement("div");
      colLabel.className = "column-label";
      colLabel.textContent = label;
      column.append(value, bar, colLabel);
      chart.appendChild(column);
    });
    return chart;
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
    overview.appendChild(renderStatTiles([
      { label: "Total items", value: data.total },
      { label: "High priority", value: data.highPriority },
      { label: "Never studied", value: data.neverStudied },
      { label: "Not seen in 14+ days", value: data.stale14 },
    ]));
    app.appendChild(overview);

    const activity = section(
      "Recent Activity",
      "Items last studied, by month (today's month is highlighted)",
    );
    const lastIndex = data.monthlyActivity.length - 1;
    activity.appendChild(renderColumnChart(
      data.monthlyActivity.map((row, index) => ({
        label: `${parseInt(row.month.split("-")[1], 10)}月`,
        count: row.count,
        isCurrent: index === lastIndex,
      })),
    ));
    activity.appendChild(renderTable(
      ["Month", "Items"],
      data.monthlyActivity.map((row) => [row.month, row.count]),
    ));
    app.appendChild(activity);

    const receptive = section("Receptive Score Distribution");
    receptive.appendChild(renderBarChart(
      data.receptive.map((row) => ({
        label: `${row.score} ${row.label}`,
        count: row.count,
        pct: data.total ? (row.count / data.total) * 100 : 0,
        color: SCORE_COLORS[row.score],
      })),
    ));
    receptive.appendChild(renderTable(
      ["Score", "Label", "Count", "%"],
      data.receptive.map((row) => [row.score, row.label, row.count, pct(row.count, data.total)]),
    ));
    app.appendChild(receptive);

    const productive = section(
      "Productive Score Distribution",
      `Items with a recorded productive score: ${data.productiveTotal}/${data.total}`,
    );
    productive.appendChild(renderBarChart([
      {
        label: "— not recorded",
        count: data.productiveNull,
        pct: data.total ? (data.productiveNull / data.total) * 100 : 0,
        color: NULL_COLOR,
      },
      ...data.productive.map((row) => ({
        label: `${row.score} ${row.label}`,
        count: row.count,
        pct: data.total ? (row.count / data.total) * 100 : 0,
        color: SCORE_COLORS[row.score],
      })),
    ]));
    productive.appendChild(renderTable(
      ["Score", "Label", "Count", "%"],
      [
        ["—", "not recorded (null)", data.productiveNull, pct(data.productiveNull, data.total)],
        ...data.productive.map((row) => [row.score, row.label, row.count, pct(row.count, data.productiveTotal)]),
      ],
    ));
    app.appendChild(productive);

    const types = section("Breakdown by Item Type");
    types.appendChild(renderLegend([
      { label: "▼ r≤1 weak", color: STATUS_CRITICAL },
      { label: "▲ r≥3 strong", color: STATUS_GOOD },
    ]));
    types.appendChild(renderGroupedBarChart(
      data.types.map((row) => ({
        label: row.type,
        bars: [
          { key: "weak", count: row.rLow, pct: row.total ? (row.rLow / row.total) * 100 : 0, color: STATUS_CRITICAL, icon: "▼" },
          { key: "strong", count: row.rHigh, pct: row.total ? (row.rHigh / row.total) * 100 : 0, color: STATUS_GOOD, icon: "▲" },
        ],
      })),
    ));
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
