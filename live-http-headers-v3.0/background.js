chrome.action.onClicked.addListener(async () => {
  const result = await chrome.storage.session.get('viewTabId');
  const viewTabId = result.viewTabId;

  if (viewTabId) {
    try { await chrome.tabs.remove(viewTabId); } catch (_) {}
  }

  const tab = await chrome.tabs.create({ url: chrome.runtime.getURL('live.html') });
  await chrome.storage.session.set({ viewTabId: tab.id });
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'setViewTabId') {
    chrome.storage.session.set({ viewTabId: msg.tabId });
    sendResponse({ ok: true });
  }
});
