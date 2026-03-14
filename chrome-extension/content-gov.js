/**
 * content-gov.js
 * Injected into government portal pages (edistrict.cgstate.gov.in, sim localhost:3001, etc.)
 * Reads citizen data from chrome.storage, highlights form fields, and fills them.
 */

let citizenData = null;
let currentMappings = null;

// ─── Detect which portal + service we're on ────────────────────────────────

function detectPortalKey() {
  const host = window.location.hostname;
  const port = window.location.port;
  if (host === 'localhost' && port === '3001') return 'localhost';
  if (host.includes('edistrict.cgstate.gov.in')) return 'edistrict';
  if (host.includes('khadya.cg.nic.in')) return 'khadya';
  if (host.includes('pmjay.gov.in') || host.includes('beneficiary.nha.gov.in')) return 'pmjay';
  return null;
}

// ─── Field Finder: tries multiple selectors ────────────────────────────────

function findField(selectors) {
  for (const sel of selectors) {
    try {
      const el = document.querySelector(sel);
      if (el && el.offsetParent !== null) return el; // visible element only
    } catch (e) {}
  }
  return null;
}

function setFieldValue(el, value) {
  if (!el || value == null || value === '') return false;

  if (el.tagName === 'SELECT') {
    // For select dropdowns, try to match option value or text
    const val = String(value).toLowerCase();
    for (const opt of el.options) {
      if (opt.value.toLowerCase() === val || opt.text.toLowerCase().includes(val)) {
        el.value = opt.value;
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
    }
    return false;
  }

  if (el.type === 'date') {
    // Convert DD/MM/YYYY → YYYY-MM-DD
    let dateVal = value;
    const dm = String(value).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (dm) dateVal = `${dm[3]}-${dm[2]}-${dm[1]}`;
    el.value = dateVal;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
    || Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    el.value = value;
  }
  return true;
}

// ─── Highlight Fields ──────────────────────────────────────────────────────

function highlightFields(mappings, serviceType) {
  if (!mappings) return;
  // Try service-specific, then _all_services fallback
  const serviceMappings = mappings[serviceType] || mappings['_all_services'] || {};

  Object.entries(serviceMappings).forEach(([fieldKey, selectors]) => {
    const el = findField(selectors);
    if (el) {
      el.style.outline = '2.5px solid #3b82f6';
      el.style.outlineOffset = '2px';
      el.style.backgroundColor = '#eff6ff';
      el.style.borderRadius = '4px';
      el.style.transition = 'all 0.3s ease';
      el.title = `SahayakGov: ${fieldKey}`;
    }
  });
}

// ─── Auto-Fill Fields ─────────────────────────────────────────────────────

function autofillFields(mappings, serviceType, data) {
  if (!mappings || !data) return { filled: 0, failed: 0 };

  // Try service-specific, then _all_services fallback
  const serviceMappings = mappings[serviceType] || mappings['_all_services'] || {};
  let filled = 0, failed = 0;

  Object.entries(serviceMappings).forEach(([fieldKey, selectors]) => {
    const el = findField(selectors);
    // Try both exact key and common alternates
    const value = data[fieldKey]
      ?? data[fieldKey.replace('annual_income', 'income')]
      ?? data[fieldKey.replace('aadhaar_number', 'aadhaar')];

    if (el) {
      const success = setFieldValue(el, value);
      if (success && value) {
        filled++;
        // Flash green to indicate success
        el.style.outline = '2.5px solid #22c55e';
        el.style.backgroundColor = '#f0fdf4';
        setTimeout(() => {
          el.style.outline = '2px solid #3b82f6';
          el.style.backgroundColor = '#eff6ff';
        }, 1500);
      }
    } else {
      if (value) failed++;
    }
  });

  // Notify page of autofill (for the notice banner)
  window.dispatchEvent(new Event('sahayakFilled'));
  return { filled, failed };
}

// ─── Main: load data and listen for commands ──────────────────────────────

async function init() {
  const portalKey = detectPortalKey();
  if (!portalKey) return;
  console.log('[SahayakGov] Portal detected:', portalKey);

  // Load field mappings
  try {
    const mappingsUrl = chrome.runtime.getURL('mappings.json');
    const resp = await fetch(mappingsUrl);
    const allMappings = await resp.json();
    currentMappings = allMappings[portalKey] || {};
    console.log('[SahayakGov] Mappings loaded for:', portalKey);
  } catch (e) {
    console.warn('[SahayakGov] Could not load mappings.json:', e);
  }

  // Load citizen data
  chrome.runtime.sendMessage({ type: 'GET_CITIZEN_DATA' }, (response) => {
    if (response?.data) {
      citizenData = response.data;
      console.log('[SahayakGov] Citizen data loaded:', citizenData?.applicant_name);
      // Auto-highlight fields
      const serviceType = citizenData.service_type;
      if (currentMappings) {
        // Wait a moment for dynamic content to render
        setTimeout(() => highlightFields(currentMappings, serviceType), 800);
      }
    }
  });
}

// Listen for commands from background / panel
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'DO_AUTOFILL') {
    const data = message.data || citizenData;
    if (!data) return;
    const serviceType = data.service_type;
    const result = autofillFields(currentMappings, serviceType, data);
    chrome.runtime.sendMessage({
      type: 'AUTOFILL_RESULT',
      filled: result.filled,
      failed: result.failed,
    });
  }

  if (message.type === 'DO_HIGHLIGHT') {
    const serviceType = citizenData?.service_type;
    highlightFields(currentMappings, serviceType);
  }
});

// MutationObserver to re-highlight when dynamic content loads
const observer = new MutationObserver(() => {
  if (citizenData && currentMappings) {
    highlightFields(currentMappings, citizenData?.service_type);
  }
});
observer.observe(document.body, { childList: true, subtree: true });

init();
console.log('[SahayakGov] Govt portal content script active.');
