// ─── STATE ───────────────────────────────────────────────────────────────────
const ITEMS_PER_PAGE = 5;

let state = {
  entries: [], // Active items
  archived: [], // Completed items saved for history
  currentPage: 1,
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
          // Ensure archived array exists for older installs
          if (!state.archived) state.archived = [];
        }
        cb();
      });
    } else {
      const saved = localStorage.getItem("trackerState");
      if (saved) {
        Object.assign(state, JSON.parse(saved));
        if (!state.archived) state.archived = [];
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
  return dateString.split(",")[0].trim(); // Converts "29 May, 6pm" to "29 May"
}

// Calculate stats for all uploads
function calculateStats() {
  const allItems = [...state.entries, ...state.archived];
  const stats = {};

  allItems.forEach((item) => {
    if (item.ig && item.igDate) {
      const d = getJustDate(item.igDate);
      if (!stats[d]) stats[d] = { ig: 0, yt: 0, li: 0 };
      stats[d].ig++;
    }
    if (item.yt && item.ytDate) {
      const d = getJustDate(item.ytDate);
      if (!stats[d]) stats[d] = { ig: 0, yt: 0, li: 0 };
      stats[d].yt++;
    }
    if (item.li && item.liDate) {
      const d = getJustDate(item.liDate);
      if (!stats[d]) stats[d] = { ig: 0, yt: 0, li: 0 };
      stats[d].li++;
    }
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
  // Update Main Stats
  const total = state.entries.length;
  const done = state.entries.filter((e) => e.ig && e.yt && e.li).length;
  document.getElementById("totalCount").textContent = total;
  document.getElementById("doneCount").textContent = done;
  document.getElementById("currentPage").textContent = state.currentPage;
  document.getElementById("totalPages").textContent = totalPages();

  // Update Daily Stats Bar
  const stats = calculateStats();
  const todayString = getJustDate(getFormattedDate());
  const todayStats = stats[todayString] || { ig: 0, yt: 0, li: 0 };

  document.getElementById("today-ig").textContent = todayStats.ig;
  document.getElementById("today-yt").textContent = todayStats.yt;
  document.getElementById("today-li").textContent = todayStats.li;

  // Render History UI
  renderHistoryView(stats);
}

function renderHistoryView(stats) {
  const historyList = document.getElementById("historyList");
  historyList.innerHTML = "";

  // Sort dates newest to oldest (Basic string map for current year)
  const sortedDates = Object.keys(stats).sort(
    (a, b) => new Date(`${b} 2026`) - new Date(`${a} 2026`)
  );

  if (sortedDates.length === 0) {
    historyList.innerHTML = `<div class="empty-state show"><p>No uploads recorded yet.</p></div>`;
    return;
  }

  // Mini SVGs for the History Cards
  const igIcon = `<svg width="14" height="14" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.5" cy="6.5" r="1.5" fill="currentColor"/></svg>`;
  const ytIcon = `<svg width="14" height="14" viewBox="0 0 24 24"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z" fill="currentColor"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="var(--bg-card)"/></svg>`;
  const liIcon = `<svg width="14" height="14" viewBox="0 0 24 24"><rect width="24" height="24" rx="4" fill="currentColor"/><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" fill="var(--bg-card)"/><rect x="2" y="9" width="4" height="12" fill="var(--bg-card)"/><circle cx="4" cy="4" r="2" fill="var(--bg-card)"/></svg>`;

  sortedDates.forEach((date) => {
    const s = stats[date];
    const card = document.createElement("div");
    card.className = "history-card";
    card.innerHTML = `
      <div class="history-date">${date}</div>
      <div class="history-stats">
        <span class="stat-pill ig">${s.ig} ${igIcon}</span>
        <span class="stat-pill yt">${s.yt} ${ytIcon}</span>
        <span class="stat-pill li">${s.li} ${liIcon}</span>
      </div>
    `;
    historyList.appendChild(card);
  });
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
  const isDone = entry.ig && entry.yt && entry.li;
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
        <input type="checkbox" ${entry.ig ? "checked" : ""} data-platform="ig" />
        <span class="platform-pill">
          <span class="dot"></span>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"><defs><radialGradient id="ig-grad" cx="30%" cy="107%" r="150%"><stop offset="0%" stop-color="#fdf497"/><stop offset="10%" stop-color="#fdf497"/><stop offset="30%" stop-color="#fd5949"/><stop offset="60%" stop-color="#d6249f"/><stop offset="90%" stop-color="#285AEB"/></radialGradient></defs><rect x="2" y="2" width="20" height="20" rx="5" ry="5" fill="url(#ig-grad)"/><rect x="2" y="2" width="20" height="20" rx="5" ry="5" fill="none" stroke="url(#ig-grad)" stroke-width="0"/><circle cx="12" cy="12" r="4" fill="none" stroke="white" stroke-width="2"/><circle cx="17.5" cy="6.5" r="1" fill="white"/></svg>
          IG
          <span class="date-stamp">${entry.igDate || ""}</span>
        </span>
      </label>

      <label class="platform-check yt">
        <input type="checkbox" ${entry.yt ? "checked" : ""} data-platform="yt" />
        <span class="platform-pill">
          <span class="dot"></span>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z" fill="#FF0000"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="white"/></svg>
          YT
          <span class="date-stamp">${entry.ytDate || ""}</span>
        </span>
      </label>

      <label class="platform-check li">
        <input type="checkbox" ${entry.li ? "checked" : ""} data-platform="li" />
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
      // Save original icon
      const originalIcon = copyBtn.innerHTML;

      // Swap to a green checkmark
      copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
      copyBtn.style.color = "#10b981";
      copyBtn.style.borderColor = "rgba(16, 185, 129, 0.3)";
      copyBtn.style.background = "rgba(16, 185, 129, 0.1)";

      // Reset back to original copy icon after 1.5 seconds
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
        // MOVE TO ARCHIVE INSTEAD OF DELETING
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
    renderStats(); // Update UI counters dynamically
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
