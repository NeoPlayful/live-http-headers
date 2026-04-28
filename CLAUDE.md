# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Loading the Extension

No build step. Load directly in Chrome:
1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked** → select `live-http-headers-v3.0/`

To allow the extension via registry policy on Windows, run `google_allow_extension.reg`.

## Architecture

This is a Chrome Extension (Manifest V3) with two execution contexts:

**`background.js` (Service Worker)**
- Stateless; runs only when triggered
- Handles toolbar icon click: closes previous live.html tab, opens a new one
- Persists `viewTabId` via `chrome.storage.session`
- Receives `setViewTabId` messages from live.html

**`live.html` + `js/live.js` (Extension Tab Page)**
- Registers `chrome.webRequest` listeners directly in the tab page (not background)
- All captured traffic is stored in-memory: `headerInfo.request[]` and `headerInfo.response[]`
- Settings persisted to `localStorage.lhhSettings` (JSON)
- `filterTabId` (null = all tabs) controls per-tab filtering; set via the Tab Filter dropdown
- Max 500 records; oldest entry removed when exceeded

**Data flow:**
```
Browser request → onSendHeaders → headerInfo.request.push()
Browser response → onHeadersReceived → headerInfo.response.push() → showHeader()
User clicks row → showInfo() → showNiceInfo() or showRawInfo()
```

## Key Constraints

- `js/general.min.js` is unused — its utilities (`sortHeaders`, `getClassStyle`, `parseURL`) are inlined in `live.js`
- No `webRequestBlocking` — MV3 forbids it for non-enterprise extensions; listeners are read-only
- DOM manipulation in `live.js` uses DOM API (not innerHTML) to avoid XSS
