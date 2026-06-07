// ─── STATE ───────────────────────────────────────────────────────────────────
const ITEMS_PER_PAGE = 5;
const ITEMS_PER_HIST_PAGE = 10; // History limit

let state = {
  entries: [],
  archived: [],
  currentPage: 1,
  historyPage: 1,
  historyViewMode: "stats", // "list" or "stats"
  historySearchQuery: "",
  theme: "dark",
  viewMode: "split",
  isHistoryOpen: false,
};

// ─── PERSISTENCE ─────────────────────────────────────────────────────────────
function saveState() {
  try {
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.set({ trackerState: state });
    } else {
      localStorage.setItem("trackerState", JSON.stringify(state));
    }
  } catch (e) {}
}

function loadState(cb) {
  try {
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.get("trackerState", (res) => {
        if (res.trackerState) {
          Object.assign(state, res.trackerState);
          if (!state.archived) state.archived = [];
          if (!state.historyPage) state.historyPage = 1;

          // FORCE RESETS ON LOAD (Ignores saved memory)
          state.historyViewMode = "stats"; // Force Stats tab on load
          state.historySearchQuery = ""; // Reset search on load
          state.isHistoryOpen = false; // Force main view on load
        }
        cb();
      });
    } else {
      const saved = localStorage.getItem("trackerState");
      if (saved) {
        Object.assign(state, JSON.parse(saved));
        if (!state.archived) state.archived = [];
        if (!state.historyPage) state.historyPage = 1;

        // FORCE RESETS ON LOAD (Ignores saved memory)
        state.historyViewMode = "stats"; // Force Stats tab on load
        state.historySearchQuery = ""; // Reset search on load
        state.isHistoryOpen = false; // Force main view on load
      }
      cb();
    }
  } catch (e) {
    cb();
  }
}
// ─── HELPERS ─────────────────────────────────────────────────────────────────
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function totalPages() {
  return Math.max(1, Math.ceil(state.entries.length / ITEMS_PER_PAGE));
}

function pageEntries() {
  const start = (state.currentPage - 1) * ITEMS_PER_PAGE;
  return state.entries.slice(start, start + ITEMS_PER_PAGE);
}

function getFormattedDate() {
  const d = new Date();
  const day = d.getDate();
  const month = d.toLocaleString("default", { month: "short" });
  let hours = d.getHours();
  const ampm = hours >= 12 ? "pm" : "am";
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${day} ${month}, ${hours}${ampm}`;
}

function getJustDate(dateString) {
  if (!dateString) return null;
  return dateString.split(",")[0].trim();
}

// Calculate stats for a given array of items
function calculateStatsFor(items) {
  const stats = {};
  items.forEach((item) => {
    ["ig", "yt", "li"].forEach((platform) => {
      if (item[platform] && item[`${platform}Date`]) {
        const d = getJustDate(item[`${platform}Date`]);
        if (!stats[d]) stats[d] = { ig: 0, yt: 0, li: 0 };
        stats[d][platform]++;
      }
    });
  });
  return stats;
}

// ─── RENDER ──────────────────────────────────────────────────────────────────
function render() {
  applyTheme();
  applyViewMode();
  renderStats();
  renderEntries();
  renderPagination();
}

function applyTheme() {
  document.body.className = state.theme;
  if (state.isHistoryOpen) document.body.classList.add("viewing-history");

  document.documentElement.style.backgroundColor =
    state.theme === "dark" ? "#0f0f13" : "#f0f0f5";
  document.getElementById("themeIcon").textContent =
    state.theme === "dark" ? "☀" : "☾";
}

function applyViewMode() {
  const container = document.getElementById("entriesContainer");
  if (state.viewMode === "single") {
    container.classList.add("single-view");
    document.getElementById("viewIcon").textContent = "⊟";
  } else {
    container.classList.remove("single-view");
    document.getElementById("viewIcon").textContent = "⊞";
  }
}

function renderStats() {
  const total = state.entries.length;
  const done = state.entries.filter((e) => e.ig && e.yt && e.li).length;
  document.getElementById("totalCount").textContent = total;
  document.getElementById("doneCount").textContent = done;
  document.getElementById("currentPage").textContent = state.currentPage;
  document.getElementById("totalPages").textContent = totalPages();

  const stats = calculateStatsFor([...state.entries, ...state.archived]);
  const todayString = getJustDate(getFormattedDate());
  const todayStats = stats[todayString] || { ig: 0, yt: 0, li: 0 };

  document.getElementById("today-ig").textContent = todayStats.ig;
  document.getElementById("today-yt").textContent = todayStats.yt;
  document.getElementById("today-li").textContent = todayStats.li;

  renderHistoryView();
}

function renderHistoryView() {
  const historyList = document.getElementById("historyList");
  const paginationUI = document.getElementById("historyPagination");

  // Update Tabs Active State
  document
    .getElementById("tabList")
    .classList.toggle("active", state.historyViewMode === "list");
  document
    .getElementById("tabStats")
    .classList.toggle("active", state.historyViewMode === "stats");

  // Filter archived items by Search Query
  const query = state.historySearchQuery.toLowerCase();
  const filteredArchive = state.archived.filter((e) =>
    e.text.toLowerCase().includes(query)
  );

  historyList.innerHTML = "";

  if (filteredArchive.length === 0) {
    historyList.innerHTML = `<div class="empty-state show"><p>No items found.</p></div>`;
    paginationUI.style.display = "none";
    return;
  }

  // ==== STATS VIEW ====
  if (state.historyViewMode === "stats") {
    paginationUI.style.display = "none";

    const stats = calculateStatsFor(filteredArchive);
    const sortedDates = Object.keys(stats).sort(
      (a, b) => new Date(`${b} 2026`) - new Date(`${a} 2026`)
    );

    const igIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5"></rect><circle cx="12" cy="12" r="4"></circle><circle cx="17.5" cy="6.5" r="1.5" fill="currentColor"/></svg>`;
    const ytIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"></path><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="currentColor"></polygon></svg>`;
    const liIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="4"></rect><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"/></svg>`;

    sortedDates.forEach((date) => {
      const s = stats[date];
      const row = document.createElement("div");
      row.className = "stats-dashboard-row";

      row.innerHTML = `
        <div class="stats-timeline-meta">
          <span class="stats-marker-dot"></span>
          <span class="stats-display-date">${date}</span>
        </div>
        <div class="stats-matrix-grid">
          <div class="matrix-cell ig ${s.ig > 0 ? "active" : "muted"}">
            <span class="matrix-icon">${igIcon}</span>
            <span class="matrix-count">${s.ig}</span>
          </div>
          <div class="matrix-cell yt ${s.yt > 0 ? "active" : "muted"}">
            <span class="matrix-icon">${ytIcon}</span>
            <span class="matrix-count">${s.yt}</span>
          </div>
          <div class="matrix-cell li ${s.li > 0 ? "active" : "muted"}">
            <span class="matrix-icon">${liIcon}</span>
            <span class="matrix-count">${s.li}</span>
          </div>
        </div>
      `;
      historyList.appendChild(row);
    });
  }
  // ==== LIST VIEW ====
  else {
    const reversedArchive = [...filteredArchive].reverse();
    const totalHistPages = Math.ceil(
      reversedArchive.length / ITEMS_PER_HIST_PAGE
    );

    if (state.historyPage > totalHistPages) state.historyPage = totalHistPages;
    if (state.historyPage < 1) state.historyPage = 1;

    const start = (state.historyPage - 1) * ITEMS_PER_HIST_PAGE;
    const pageItems = reversedArchive.slice(start, start + ITEMS_PER_HIST_PAGE);

    pageItems.forEach((entry) => {
      const card = document.createElement("div");
      card.className = "history-card flex-col archive-caption-card";

      card.innerHTML = `
        <div class="history-card-header" style="display: flex; align-items: flex-start; justify-content: space-between; width: 100%; gap: 12px;">
          <div class="entry-text" style="flex: 1; font-size: 13px; line-height: 1.4;">${escapeHtml(entry.text)}</div>
          <button class="copy-btn archive-copy-btn" title="Copy content text">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </button>
        </div>
        <div class="platforms" style="flex-wrap: wrap; gap: 8px; margin-top: 4px; width: 100%;">
          <span class="platform-pill" style="color: var(--ig); border-color: var(--ig); background: rgba(225,48,108,0.05)">IG: ${entry.igDate || "N/A"}</span>
          <span class="platform-pill" style="color: var(--yt); border-color: var(--yt); background: rgba(255,0,0,0.05)">YT: ${entry.ytDate || "N/A"}</span>
          <span class="platform-pill" style="color: var(--li); border-color: var(--li); background: rgba(0,119,181,0.05)">LI: ${entry.liDate || "N/A"}</span>
        </div>
      `;

      // Copy Button Event Listener Configuration
      const copyBtn = card.querySelector(".archive-copy-btn");
      copyBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(entry.text).then(() => {
          const originalIcon = copyBtn.innerHTML;
          copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
          copyBtn.style.color = "#10b981";
          copyBtn.style.borderColor = "rgba(16, 185, 129, 0.3)";
          copyBtn.style.background = "rgba(16, 185, 129, 0.1)";
          setTimeout(() => {
            copyBtn.innerHTML = originalIcon;
            copyBtn.style.color = "";
            copyBtn.style.borderColor = "";
            copyBtn.style.background = "";
          }, 1500);
        });
      });

      historyList.appendChild(card);
    });

    paginationUI.style.display = totalHistPages > 1 ? "flex" : "none";
    document.getElementById("histPageInfo").textContent =
      `Page ${state.historyPage} / ${totalHistPages}`;
    document.getElementById("histPrevBtn").disabled = state.historyPage === 1;
    document.getElementById("histNextBtn").disabled =
      state.historyPage === totalHistPages;
  }
}

function renderEntries() {
  const colLeft = document.getElementById("colLeft");
  const colRight = document.getElementById("colRight");
  const emptyState = document.getElementById("emptyState");
  const container = document.getElementById("entriesContainer");

  const entries = pageEntries();
  colLeft.innerHTML = "";
  colRight.innerHTML = "";

  if (entries.length === 0) {
    emptyState.classList.add("show");
    container.style.display = "none";
    return;
  }

  emptyState.classList.remove("show");
  container.style.display = "flex";

  const globalStart = (state.currentPage - 1) * ITEMS_PER_PAGE;

  if (state.viewMode === "split") {
    const leftEntries = entries.slice(0, 5);
    const rightEntries = entries.slice(5, 10);
    leftEntries.forEach((e, i) =>
      colLeft.appendChild(buildCard(e, globalStart + i))
    );
    rightEntries.forEach((e, i) =>
      colRight.appendChild(buildCard(e, globalStart + 5 + i))
    );
  } else {
    entries.forEach((e, i) =>
      colLeft.appendChild(buildCard(e, globalStart + i))
    );
  }
}

function buildCard(entry, index) {
  const igState = entry.ig || false;
  const ytState = entry.yt || false;
  const liState = entry.li || false;
  const isDone = igState && ytState && liState;

  const card = document.createElement("div");
  card.className = "entry-card" + (isDone ? " done" : "");
  card.dataset.id = entry.id;

  card.innerHTML = `
    <div class="card-top">
      <span class="entry-num">#${String(index + 1).padStart(2, "0")}</span>
      <span class="entry-text">${escapeHtml(entry.text)}</span>
      <button class="delete-btn" title="Remove entry">✕</button>
    </div>
    <div class="platforms">
      <label class="platform-check ig">
        <input type="checkbox" ${igState ? "checked" : ""} data-platform="ig" />
        <span class="platform-pill">
          <span class="dot"></span>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"><defs><radialGradient id="ig-grad" cx="30%" cy="107%" r="150%"><stop offset="0%" stop-color="#fdf497"/><stop offset="10%" stop-color="#fdf497"/><stop offset="30%" stop-color="#fd5949"/><stop offset="60%" stop-color="#d6249f"/><stop offset="90%" stop-color="#285AEB"/></radialGradient></defs><rect x="2" y="2" width="20" height="20" rx="5" ry="5" fill="url(#ig-grad)"/><rect x="2" y="2" width="20" height="20" rx="5" ry="5" fill="none" stroke="url(#ig-grad)" stroke-width="0"/><circle cx="12" cy="12" r="4" fill="none" stroke="white" stroke-width="2"/><circle cx="17.5" cy="6.5" r="1" fill="white"/></svg>
          IG
          <span class="date-stamp">${entry.igDate || ""}</span>
        </span>
      </label>

      <label class="platform-check yt">
        <input type="checkbox" ${ytState ? "checked" : ""} data-platform="yt" />
        <span class="platform-pill">
          <span class="dot"></span>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z" fill="#FF0000"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="white"/></svg>
          YT
          <span class="date-stamp">${entry.ytDate || ""}</span>
        </span>
      </label>

      <label class="platform-check li">
        <input type="checkbox" ${liState ? "checked" : ""} data-platform="li" />
        <span class="platform-pill">
          <span class="dot"></span>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"><rect width="24" height="24" rx="4" fill="#0A66C2"/><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" fill="white"/><rect x="2" y="9" width="4" height="12" fill="white"/><circle cx="4" cy="4" r="2" fill="white"/></svg>
          LI
          <span class="date-stamp">${entry.liDate || ""}</span>
        </span>
      </label>

      <button class="copy-btn" title="Copy content text">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
      </button>
    </div>
  `;

  card
    .querySelector(".delete-btn")
    .addEventListener("click", () => removeEntry(entry.id, card));

  card.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener("change", () =>
      handleCheckboxChange(entry.id, cb.dataset.platform, cb.checked, card)
    );
  });

  const copyBtn = card.querySelector(".copy-btn");
  copyBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(entry.text).then(() => {
      const originalIcon = copyBtn.innerHTML;
      copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
      copyBtn.style.color = "#10b981";
      copyBtn.style.borderColor = "rgba(16, 185, 129, 0.3)";
      copyBtn.style.background = "rgba(16, 185, 129, 0.1)";
      setTimeout(() => {
        copyBtn.innerHTML = originalIcon;
        copyBtn.style.color = "";
        copyBtn.style.borderColor = "";
        copyBtn.style.background = "";
      }, 1500);
    });
  });

  return card;
}

function handleCheckboxChange(id, platform, checked, cardEl) {
  const entry = state.entries.find((e) => e.id === id);
  if (!entry) return;

  entry[platform] = checked;
  entry[`${platform}Date`] = checked ? getFormattedDate() : null;

  const dateSpan = cardEl.querySelector(
    `.platform-check.${platform} .date-stamp`
  );
  if (dateSpan) dateSpan.textContent = entry[`${platform}Date`] || "";

  const allDone = entry.ig && entry.yt && entry.li;

  if (allDone) {
    cardEl.classList.add("done");
    setTimeout(() => {
      cardEl.classList.add("removing");
      setTimeout(() => {
        state.entries = state.entries.filter((e) => e.id !== id);
        state.archived.push(entry);

        const pages = totalPages();
        if (state.currentPage > pages) state.currentPage = Math.max(1, pages);
        saveState();
        render();
      }, 260);
    }, 600);
  } else {
    if (entry.ig || entry.yt || entry.li) cardEl.classList.remove("done");
    saveState();
    renderStats();
  }
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderPagination() {
  const pages = totalPages();
  const pagination = document.getElementById("pagination");
  const pageDots = document.getElementById("pageDots");
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");

  if (pages <= 1) {
    pagination.classList.add("hidden");
    return;
  }
  pagination.classList.remove("hidden");
  prevBtn.disabled = state.currentPage === 1;
  nextBtn.disabled = state.currentPage === pages;

  pageDots.innerHTML = "";
  for (let i = 1; i <= pages; i++) {
    const dot = document.createElement("button");
    dot.className = "page-dot" + (i === state.currentPage ? " active" : "");
    dot.title = `Page ${i}`;
    dot.addEventListener("click", () => goToPage(i));
    pageDots.appendChild(dot);
  }
}

// ─── ACTIONS ─────────────────────────────────────────────────────────────────
function addEntry(text) {
  const trimmed = text.trim();
  if (!trimmed) return;

  const entry = {
    id: genId(),
    text: trimmed,
    ig: false,
    yt: false,
    li: false,
    igDate: null,
    ytDate: null,
    liDate: null,
    createdAt: Date.now(),
  };

  state.entries.unshift(entry);
  state.currentPage = 1;
  saveState();
  render();
}

function removeEntry(id, cardEl) {
  if (cardEl) {
    cardEl.classList.add("removing");
    setTimeout(() => {
      state.entries = state.entries.filter((e) => e.id !== id);
      const pages = totalPages();
      if (state.currentPage > pages) state.currentPage = Math.max(1, pages);
      saveState();
      render();
    }, 260);
  } else {
    state.entries = state.entries.filter((e) => e.id !== id);
    const pages = totalPages();
    if (state.currentPage > pages) state.currentPage = Math.max(1, pages);
    saveState();
    render();
  }
}

function goToPage(page) {
  state.currentPage = page;
  render();
}

// ─── EVENT LISTENERS ─────────────────────────────────────────────────────────
document.getElementById("contentInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    addEntry(e.target.value);
    e.target.value = "";
  }
});

document.getElementById("themeToggle").addEventListener("click", () => {
  state.theme = state.theme === "dark" ? "light" : "dark";
  saveState();
  applyTheme();
});

document.getElementById("viewToggle").addEventListener("click", () => {
  state.viewMode = state.viewMode === "split" ? "single" : "split";
  saveState();
  render();
});

document.getElementById("historyToggle").addEventListener("click", () => {
  state.isHistoryOpen = !state.isHistoryOpen;
  const container = document.getElementById("historyContainer");
  const btn = document.getElementById("historyToggle");

  if (state.isHistoryOpen) {
    document.body.classList.add("viewing-history");
    container.classList.add("show");
    btn.style.color = "var(--accent)";
  } else {
    document.body.classList.remove("viewing-history");
    container.classList.remove("show");
    btn.style.color = "";
  }
});

document.getElementById("prevBtn").addEventListener("click", () => {
  if (state.currentPage > 1) {
    state.currentPage--;
    render();
  }
});

document.getElementById("nextBtn").addEventListener("click", () => {
  if (state.currentPage < totalPages()) {
    state.currentPage++;
    render();
  }
});

// History Pagination controls
document.getElementById("histPrevBtn").addEventListener("click", () => {
  if (state.historyPage > 1) {
    state.historyPage--;
    renderHistoryView();
    saveState();
  }
});

document.getElementById("histNextBtn").addEventListener("click", () => {
  // Use dynamically calculated pages for search filtering
  const query = state.historySearchQuery.toLowerCase();
  const filteredArchive = state.archived.filter((e) =>
    e.text.toLowerCase().includes(query)
  );
  const max = Math.ceil(filteredArchive.length / ITEMS_PER_HIST_PAGE);

  if (state.historyPage < max) {
    state.historyPage++;
    renderHistoryView();
    saveState();
  }
});

// History Tabs
document.getElementById("tabList").addEventListener("click", () => {
  state.historyViewMode = "list";
  state.historyPage = 1;
  saveState();
  renderHistoryView();
});
document.getElementById("tabStats").addEventListener("click", () => {
  state.historyViewMode = "stats";
  state.historyPage = 1;
  saveState();
  renderHistoryView();
});

// History Search
document.getElementById("historySearch").addEventListener("input", (e) => {
  state.historySearchQuery = e.target.value;
  state.historyPage = 1;
  renderHistoryView();
});

document.getElementById("open-tab-btn").addEventListener("click", () => {
  const extensionUrl = chrome.runtime.getURL("popup.html");
  chrome.tabs.query({ url: extensionUrl }, (tabs) => {
    if (tabs.length > 0) {
      const existingTab = tabs[0];
      chrome.tabs.update(existingTab.id, { active: true });
      chrome.windows.update(existingTab.windowId, { focused: true });
    } else {
      chrome.tabs.create({ url: extensionUrl });
    }
  });
});

// ─── INIT ─────────────────────────────────────────────────────────────────────
loadState(() => {
  render();
  document.getElementById("contentInput").focus();
});

// Listen for external storage changes (like context menu entries)
if (typeof chrome !== "undefined" && chrome.storage) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes.trackerState) {
      const newState = changes.trackerState.newValue;
      if (newState) {
        // Synchronize active arrays seamlessly
        state.entries = newState.entries || [];
        state.archived = newState.archived || [];

        // Prevent jarring layout shifts if you are browsing history
        if (!state.isHistoryOpen) {
          state.currentPage = newState.currentPage || 1;
        }

        // Repaint the active interface layers instantly
        render();
      }
    }
  });
}
