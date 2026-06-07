// Helper to generate unique IDs matching popup.js format
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// Create the context menu item when the extension initializes
chrome.runtime.onInstalled.addListener(() => {
  // Retain your existing alarm setup call here if applicable
  if (typeof setupAlarms === "function") setupAlarms();
  
  chrome.contextMenus.create({
    id: "save-as-caption",
    title: "Save as caption",
    contexts: ["selection"] // Only displays when text is highlighted
  });
});

// Handle the context menu click event execution
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "save-as-caption" && info.selectionText) {
    const trimmedText = info.selectionText.trim();
    if (!trimmedText) return;

    // Fetch the existing state from storage
    chrome.storage.local.get("trackerState", (res) => {
      let localState = res.trackerState || { entries: [], archived: [], currentPage: 1 };
      
      // Construct a new entry matching your popup's data structure
      const entry = {
        id: genId(),
        text: trimmedText,
        ig: false,
        yt: false,
        li: false,
        tw: false,
        igDate: null,
        ytDate: null,
        liDate: null,
        twDate: null,
        createdAt: Date.now(),
      };

      if (!localState.entries) localState.entries = [];
      
      // Inject the entry at the top of the active array stack
      localState.entries.unshift(entry);
      localState.currentPage = 1; 

      // Save the updated tracking state back to Chrome storage
      chrome.storage.local.set({ trackerState: localState });
    });
  }
});