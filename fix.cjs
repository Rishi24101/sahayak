const fs = require('fs');
let html = fs.readFileSync('chrome-extension/panel/panel.html', 'utf8');

// replace the actions div
const newActions = `<div class="actions">
      <button id="validateBtn" class="btn" style="background:#f0fdf4; color:#15803d; border:1.5px solid #86efac; border-radius:4px; padding:9px; width:100%;">
        🔍 फॉर्म जांचें / Validate
      </button>
      <button id="autofillBtn" class="btn" style="background:#3b82f6; color:white; border-radius:4px; padding:9px; border:none; width:100%;">
        ⚡ Auto-Fill करें
      </button>
    </div>`;

html = html.replace(/<div class="actions">[\s\S]*?<\/div>/, newActions);
fs.writeFileSync('chrome-extension/panel/panel.html', html);

let js = fs.readFileSync('chrome-extension/panel/panel.js', 'utf8');
js = js.replace(/\$\('highlightBtn'\)\.addEventListener\('click', \(\) => {[\s\S]*?}\);/, `$('validateBtn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'DO_VALIDATE' });
});`);
fs.writeFileSync('chrome-extension/panel/panel.js', js);
