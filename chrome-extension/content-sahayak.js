/**
 * content-sahayak.js
 * Injected into the Sahayak web app (localhost:5173).
 * Listens for postMessage from ApplicationForm.tsx when operator clicks
 * "पोर्टल पर जाएं" and relays the citizen data to the extension.
 */

window.addEventListener('message', (event) => {
  // Only accept messages from our own app
  if (event.source !== window) return;
  if (!event.data || event.data.type !== 'SAHAYAK_PORTAL_DATA') return;

  const citizenData = event.data.data;
  console.log('[SahayakGov] Received citizen data from Sahayak app:', citizenData?.applicant_name);

  // Relay to background service worker
  chrome.runtime.sendMessage({
    type: 'SAHAYAK_DATA_RECEIVED',
    data: citizenData,
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.warn('[SahayakGov] Could not relay to background:', chrome.runtime.lastError.message);
    } else {
      console.log('[SahayakGov] Data stored in extension:', response?.ok);
    }
  });
});

console.log('[SahayakGov] Sahayak content script loaded — listening for portal data.');
