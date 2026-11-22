# 🌐 Browser Agent Workspace

Dedicated environment for controlling your real Google Chrome browser via **Google Antigravity**, **Model Context Protocol (MCP)**, and **Open Browser Control**.

---

## 📁 Folder Structure
```
c:\laragon\www\browser-agent\
├── browser-client.js       # Reusable Node module to execute browser commands via MCP
├── start-bridge.bat        # Double-click launcher to start WebSocket bridge (:9334)
├── package.json            # NPM scripts & workspace configuration
├── scripts/
│   ├── check-status.js     # Tests connection to Chrome extension & lists tabs
│   ├── search.js           # Opens a new tab and searches Google
│   └── screenshot.js       # Takes a screenshot of the active tab
└── README.md               # Quick instructions & command cheat sheet
```

---

## 🚀 Quick Start

### 1. Launch the Bridge (Optional background launcher)
Double-click [**`start-bridge.bat`**](start-bridge.bat) or run:
```bash
npm run bridge
```
*(The bridge server listens on `ws://localhost:9334` where your Chrome extension connects).*

### 2. Check Connection & Tabs
```bash
npm run status
```

### 3. Open a Web Search
```bash
node scripts/search.js "your search query here"
```

### 4. Capture Tab Screenshot
```bash
npm run screenshot
```

---

## 🤖 Using in Antigravity Chat
When working in this folder or asking Antigravity to browse, you can say:
- *"Open a new tab and go to `<url>`"*
- *"Fill in this form on my browser"*
- *"Scrape the table from the current tab and save it as JSON"*
- *"Take a screenshot of the checkout page and inspect for layout bugs"*

The tools connect directly to your live Chrome profile without logging you out of your sessions.
