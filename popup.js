// ─── STATE ───────────────────────────────────────────────────────────────────
const ITEMS_PER_PAGE = 5;

let state = {
  entries: [], // { id, text, ig, yt, li, createdAt }
  currentPage: 1,
  theme: "dark",
  viewMode: "split", // 'split' | 'single'
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
        if (res.trackerState) Object.assign(state, res.trackerState);
        cb();
      });
    } else {
      const saved = localStorage.getItem("trackerState");
      if (saved) Object.assign(state, JSON.parse(saved));
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

  // Colors the empty space when opened in a full tab
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
    // Split: 5 left, 5 right
    const leftEntries = entries.slice(0, 5);
    const rightEntries = entries.slice(5, 10);
    leftEntries.forEach((e, i) =>
      colLeft.appendChild(buildCard(e, globalStart + i))
    );
    rightEntries.forEach((e, i) =>
      colRight.appendChild(buildCard(e, globalStart + 5 + i))
    );
  } else {
    // Single column: all in left col
    entries.forEach((e, i) =>
      colLeft.appendChild(buildCard(e, globalStart + i))
    );
  }
}

function buildCard(entry, index) {
  const isDone = entry.ig && entry.yt && entry.li;

  // THIS is the line that was missing!
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
          <span class="dot"></span>IG
          <span class="date-stamp">${entry.igDate || ""}</span>
        </span>
      </label>
      <label class="platform-check yt">
        <input type="checkbox" ${entry.yt ? "checked" : ""} data-platform="yt" />
        <span class="platform-pill">
          <span class="dot"></span>YT
          <span class="date-stamp">${entry.ytDate || ""}</span>
        </span>
      </label>
      <label class="platform-check li">
        <input type="checkbox" ${entry.li ? "checked" : ""} data-platform="li" />
        <span class="platform-pill">
          <span class="dot"></span>LI
          <span class="date-stamp">${entry.liDate || ""}</span>
        </span>
      </label>
    </div>
  `;

  // Delete button
  card.querySelector(".delete-btn").addEventListener("click", () => {
    removeEntry(entry.id, card);
  });

  // Platform checkboxes
  card.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener("change", () => {
      handleCheckboxChange(entry.id, cb.dataset.platform, cb.checked, card);
    });
  });

  return card;
}

function handleCheckboxChange(id, platform, checked, cardEl) {
  const entry = state.entries.find((e) => e.id === id);
  if (!entry) return;

  entry[platform] = checked;

  // Save the date and update the UI
  entry[`${platform}Date`] = checked ? getFormattedDate() : null;
  const dateSpan = cardEl.querySelector(
    `.platform-check.${platform} .date-stamp`
  );
  if (dateSpan) {
    dateSpan.textContent = entry[`${platform}Date`] || "";
  }

  const allDone = entry.ig && entry.yt && entry.li;

  if (allDone) {
    // Animate card out, then delete
    cardEl.classList.add("done");
    setTimeout(() => {
      cardEl.classList.add("removing");
      setTimeout(() => {
        removeEntry(id, null);
      }, 260);
    }, 600);
  } else {
    // Update card style immediately
    if (entry.ig || entry.yt || entry.li) {
      cardEl.classList.remove("done");
    }
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
    igDate: null, // <-- ADDED
    ytDate: null, // <-- ADDED
    liDate: null, // <-- ADDED
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
      // Adjust page if needed
      const pages = totalPages();
      if (state.currentPage > pages) state.currentPage = pages;
      saveState();
      render();
    }, 260);
  } else {
    state.entries = state.entries.filter((e) => e.id !== id);
    const pages = totalPages();
    if (state.currentPage > pages) state.currentPage = pages;
    saveState();
    render();
  }
}

function goToPage(page) {
  state.currentPage = page;
  render();
}

function getFormattedDate() {
  const d = new Date();
  const day = d.getDate();
  const month = d.toLocaleString("default", { month: "short" }); // "May"
  let hours = d.getHours();
  const ampm = hours >= 12 ? "pm" : "am";
  hours = hours % 12;
  hours = hours ? hours : 12; // convert 0 to 12

  return `${day} ${month}, ${hours}${ampm}`;
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
      // Tab exists: focus it
      const existingTab = tabs[0];
      chrome.tabs.update(existingTab.id, { active: true });
      chrome.windows.update(existingTab.windowId, { focused: true });
    } else {
      // Tab does not exist: create it
      chrome.tabs.create({ url: extensionUrl });
    }
  });
});

// ─── INIT ─────────────────────────────────────────────────────────────────────
loadState(() => {
  render();
  document.getElementById("contentInput").focus();
});
