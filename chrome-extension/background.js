/**
 * SahayakGov — background.js (Service Worker)
 * Orchestrates data relay between Sahayak app and govt portal pages.
 * Opens the side panel when operator navigates to a known govt portal.
 */

const GOV_PORTAL_PATTERNS = [
  'edistrict.cgstate.gov.in',
  'khadya.cg.nic.in',
  'pmjay.gov.in',
  'beneficiary.nha.gov.in',
  'localhost:3001',
];

// Ensure side panel opens when the extension icon is clicked
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);

// Open side panel when on a govt portal
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) return;

  const isGovPortal = GOV_PORTAL_PATTERNS.some(p => tab.url.includes(p));
  if (isGovPortal) {
    chrome.sidePanel.open({ tabId }).catch(() => {
      // Side panel may already be open — ignore
    });
    // Notify panel that we're on a govt portal
    chrome.runtime.sendMessage({
      type: 'GOV_PORTAL_DETECTED',
      url: tab.url,
      tabId,
    }).catch(() => {});
  }
});

// Relay messages between content scripts and side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SAHAYAK_DATA_RECEIVED') {
    // Sahayak content script relayed citizen data — store it
    chrome.storage.local.set({ sahayakPortalData: message.data }, () => {
      console.log('[SahayakGov BG] Citizen data stored:', message.data?.applicant_name);
      sendResponse({ ok: true });
    });
    return true; // Keep message channel open for async
  }

  if (message.type === 'GET_CITIZEN_DATA') {
    // Panel or content-gov requesting the stored citizen data
    chrome.storage.local.get('sahayakPortalData', (result) => {
      sendResponse({ data: result.sahayakPortalData || null });
    });
    return true;
  }

  if (message.type === 'AUTOFILL_REQUESTED') {
    // Panel tells content-gov to fill the form in the active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'DO_AUTOFILL',
          data: message.data,
        });
      }
    });
  }

  if (message.type === 'HIGHLIGHT_REQUESTED') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'DO_HIGHLIGHT' });
      }
    });
    return;
  }

  if (message.type === 'DO_VALIDATE') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'DO_VALIDATE' });
      }
    });
    return;
  }
});
