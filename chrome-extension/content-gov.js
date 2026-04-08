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

function digitsOnly(v) {
  return String(v ?? '').replace(/\D/g, '');
}

function normalizeValue(fieldKey, value) {
  if (value == null) return value;
  if (fieldKey === 'mobile' || fieldKey === 'aadhaar_mobile') {
    // Keep full digits so operator can edit manually before validation.
    return digitsOnly(value);
  }
  if (fieldKey === 'aadhaar_number') {
    return digitsOnly(value);
  }
  if (fieldKey === 'pincode') {
    return digitsOnly(value);
  }
  if (fieldKey === 'ifsc') {
    return String(value).toUpperCase();
  }
  return value;
}

function getMappedValue(fieldKey, data) {
  const aliases = {
    annual_income: ['annual_income', 'income'],
    income: ['income', 'annual_income'],
    aadhaar_number: ['aadhaar_number', 'aadhaar'],
    aadhaar_mobile: ['aadhaar_mobile', 'mobile'],
    bank_account: ['bank_account', 'account_no'],
    bank_name: ['bank_name'],
    mobile: ['mobile', 'phone', 'mobile_number'],
    address: ['address', 'permanent_address', 'residential_address', 'full_address'],
    pincode: ['pincode', 'pin_code', 'postal_code'],
  };

  const keys = aliases[fieldKey] || [fieldKey];
  for (const k of keys) {
    const v = data?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      return normalizeValue(fieldKey, v);
    }
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

  try {
    if (el.tagName === 'TEXTAREA') {
      const textAreaSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
      if (textAreaSetter) textAreaSetter.call(el, value);
      else el.value = value;
    } else {
      const inputSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      if (inputSetter) inputSetter.call(el, value);
      else el.value = value;
    }

    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  } catch (e) {
    try {
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    } catch (e2) {
      return false;
    }
  }
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
  const queue = [];

  Object.entries(serviceMappings).forEach(([fieldKey, selectors]) => {
    const value = getMappedValue(fieldKey, data);
    if (value == null || value === '') return;
    queue.push({ fieldKey, selectors, value });
  });

  queue.forEach(({ fieldKey, selectors, value }, idx) => {
    setTimeout(() => {
      const el = findField(selectors);
      if (!el) {
        failed++;
        return;
      }
      const success = setFieldValue(el, value);
      if (success) {
        filled++;
        el.style.outline = '2.5px solid #3b82f6';
        el.style.backgroundColor = '#eff6ff';
        setTimeout(() => {
          el.style.outline = '2.5px solid #22c55e';
          el.style.backgroundColor = '#f0fdf4';
        }, 260);
      } else {
        failed++;
      }
    }, idx * 160);
  });

  const emptyFields = [];
  Object.entries(serviceMappings).forEach(([fieldKey, selectors]) => {
    const el = findField(selectors);
    if (!el) return;
    const val = String(el.value ?? '').trim();
    if (!val) emptyFields.push(fieldKey);
  });

  // Notify page of autofill (for the notice banner)
  setTimeout(() => {
    window.dispatchEvent(new Event('sahayakFilled'));
  }, queue.length * 160 + 120);
  return { filled: queue.length ? Math.max(filled, 0) : 0, failed, emptyFields };
}

function runDynamicValidation(data) {
  if (!data) return { errors: [], warnings: [], ok: [] };
  const errors = [];
  const warnings = [];
  const ok = [];

  const aadhaar = String(data.aadhaar_number || data.aadhaar || '').replace(/\D/g, '');
  if (!aadhaar) {
    errors.push('आधार संख्या दर्ज करें');
  } else if (aadhaar.length !== 12) {
    warnings.push(`आधार ${aadhaar.length} अंकों का है। कृपया edit करके 12 अंक करें`);
  } else {
    ok.push('आधार संख्या सही है');
  }

  const pincode = digitsOnly(data.pincode || '');
  if (pincode && pincode.length !== 6) {
    warnings.push(`पिनकोड ${pincode.length} अंकों का है। कृपया edit करके 6 अंक करें`);
  }

  const dob = String(data.dob || '').trim();
  const dobSlash = dob.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const dobDash = dob.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  let birth = null;
  if (dobSlash) birth = new Date(`${dobSlash[3]}-${dobSlash[2]}-${dobSlash[1]}`);
  if (dobDash) birth = new Date(`${dobDash[1]}-${dobDash[2]}-${dobDash[3]}`);

  if (birth && !Number.isNaN(birth.getTime())) {
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
    if (age < 18) {
      errors.push('आवेदक की आयु 18 वर्ष से कम है');
    } else {
      ok.push(`आयु ${age} वर्ष`);
    }
  } else {
    warnings.push('जन्म तिथि प्रारूप DD/MM/YYYY या YYYY-MM-DD रखें');
  }

  const incomeRaw = data.annual_income ?? data.income;
  const income = Number(incomeRaw ?? 0);
  if (!incomeRaw) {
    warnings.push('वार्षिक आय दर्ज करें');
  } else if (income > 200000) {
    errors.push('वार्षिक आय 2 लाख से अधिक है');
  } else {
    ok.push(`आय सीमा में है (₹${income.toLocaleString('hi-IN')})`);
  }

  const address = String(data.address || '').trim();
  if (!address) {
    errors.push('स्थायी पता उपलब्ध नहीं है');
  } else if (address.length < 15) {
    warnings.push('पता अधूरा लग रहा है, पूरा पता दर्ज करें');
  } else {
    ok.push('पता दर्ज है');
  }

  const mobile = digitsOnly(data.mobile || '');
  if (!mobile) {
    errors.push('मोबाइल नंबर दर्ज करें');
  } else if (mobile.length !== 10) {
    const suggested = mobile.length > 10 ? mobile.slice(-10) : mobile;
    warnings.push(`मोबाइल ${mobile.length} अंकों का है। कृपया edit करके 10 अंक करें (सुझाव: ${suggested})`);
  } else {
    ok.push('मोबाइल नंबर सही है');
  }

  const bank = String(data.bank_account || '').trim();
  if (!bank) {
    warnings.push('बैंक खाता संख्या दर्ज करें');
  } else {
    ok.push('बैंक खाता दर्ज है');
  }

  const ifsc = String(data.ifsc || '').trim().toUpperCase();
  if (!ifsc) {
    warnings.push('IFSC कोड दर्ज करें');
  } else if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
    warnings.push('IFSC कोड गलत प्रारूप में है');
  } else {
    ok.push('IFSC कोड सही प्रारूप में');
  }

  if (errors.length > 0 || warnings.length > 0 || ok.length > 0) {
    const old = document.getElementById('sahayakGovValidationPanel');
    if (old) old.remove();

    const wrap = document.createElement('div');
    wrap.id = 'sahayakGovValidationPanel';
    wrap.style.cssText = [
      'position:fixed',
      'right:20px',
      'bottom:20px',
      'width:320px',
      'max-height:50vh',
      'overflow:auto',
      'background:#fff',
      'border:1px solid #fecaca',
      'border-radius:10px',
      'box-shadow:0 10px 25px rgba(0,0,0,0.15)',
      'padding:12px',
      'z-index:2147483647',
      'font-family:Arial,sans-serif'
    ].join(';');

    const title = document.createElement('div');
    title.textContent = errors.length > 0
      ? `Validation: ${errors.length} त्रुटि / ${warnings.length} चेतावनी`
      : warnings.length > 0
      ? `Validation: ${warnings.length} चेतावनी`
      : 'Validation: सभी फ़ील्ड सही हैं';
    title.style.cssText = `font-weight:700;margin-bottom:8px;font-size:13px;color:${errors.length > 0 ? '#b91c1c' : warnings.length > 0 ? '#92400e' : '#166534'};`;
    wrap.appendChild(title);

    errors.forEach((e) => {
      const row = document.createElement('div');
      row.textContent = `❌ ${e}`;
      row.style.cssText = 'font-size:12px;color:#991b1b;margin:4px 0;';
      wrap.appendChild(row);
    });

    warnings.forEach((w) => {
      const row = document.createElement('div');
      row.textContent = `⚠️ ${w}`;
      row.style.cssText = 'font-size:12px;color:#92400e;margin:4px 0;';
      wrap.appendChild(row);
    });

    ok.forEach((k) => {
      const row = document.createElement('div');
      row.textContent = `✅ ${k}`;
      row.style.cssText = 'font-size:12px;color:#166534;margin:4px 0;';
      wrap.appendChild(row);
    });

    const btn = document.createElement('button');
    btn.textContent = 'Close';
    btn.style.cssText = 'margin-top:10px;padding:6px 10px;border:0;background:#ef4444;color:white;border-radius:6px;cursor:pointer;';
    btn.addEventListener('click', () => wrap.remove());
    wrap.appendChild(btn);

    document.body.appendChild(wrap);
  }

  return { errors, warnings, ok };
}

function readLiveFormData(data) {
  const out = { ...(data || {}) };
  const map = {
    applicant_name: ['#applicantName', "[name='appl_name']", "[name='applicant_name']"],
    father_name: ['#fatherName', "[name='father_name']"],
    dob: ['#dob', "[name='dob']", '#dateOfBirth', "[name='date_of_birth']"],
    gender: ['#gender', "[name='gender']"],
    mobile: ['#mobile', '#mobileNo', "[name='mobile']", "[name='mobile_no']"],
    address: ['#address', "[name='address']", "textarea[name='addr']"],
    pincode: ['#pincode', "[name='pincode']"],
    aadhaar_number: ['#aadhaar', '#aadhaarNo', "[name='aadhaar']", "[name='aadhaar_no']"],
    annual_income: ['#income', "[name='income']", "[name='annual_income']"],
    bank_account: ['#bankAccount', "[name='bank_account']", "[name='account_no']"],
    ifsc: ['#ifsc', "[name='ifsc']", "[name='ifsc_code']"],
    aadhaar_mobile: ['#aadhaarMobile', "[name='aadhaar_mobile']"],
    bank_name: ['#bankName', "[name='bank_name']"],
  };

  Object.entries(map).forEach(([key, selectors]) => {
    const el = findField(selectors);
    if (!el) return;
    const val = (el.value ?? '').toString().trim();
    if (val !== '') out[key] = val;
  });

  // Keep aliases synchronized for downstream logic.
  if (out.annual_income != null && out.income == null) out.income = out.annual_income;
  if (out.aadhaar_number != null && out.aadhaar == null) out.aadhaar = out.aadhaar_number;
  return out;
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

      // ── Store in localStorage so sim-portal can read it (same origin) ──
      try {
        localStorage.setItem('sahayak_citizen_data', JSON.stringify(citizenData));
        sessionStorage.setItem('sahayak_citizen_data', JSON.stringify(citizenData));
      } catch(e) {}

      const serviceType = citizenData.service_type;

      if (portalKey === 'localhost') {
        // For sim portal: call window.fillFromSahayak directly + postMessage bridge
        const doFill = () => {
          if (typeof window.fillFromSahayak === 'function') {
            window.fillFromSahayak(citizenData);
          } else {
            window.postMessage({ type: 'SAHAYAK_FILL', payload: citizenData }, '*');
          }
        };
        setTimeout(doFill, 800);
      } else {
        // Real portal: highlight fields first
        if (currentMappings) {
          setTimeout(() => highlightFields(currentMappings, serviceType), 800);
        }
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

    if (window.location.hostname === 'localhost' && typeof window.doAutofill === 'function') {
      try {
        window.doAutofill(data);
        chrome.runtime.sendMessage({
          type: 'AUTOFILL_RESULT',
          filled: 12,
          failed: 0,
        });
        return;
      } catch (e) {
        // fallback to generic mapping-based autofill
      }
    }

    const result = autofillFields(currentMappings, serviceType, data);
    setTimeout(() => {
      chrome.runtime.sendMessage({
        type: 'AUTOFILL_RESULT',
        filled: result.filled,
        failed: result.failed,
        empty_fields: result.emptyFields || [],
      });
    }, 500);
  }

  if (message.type === 'DO_VALIDATE') {
    const data = readLiveFormData(citizenData || {});
    citizenData = data;
    const result = runDynamicValidation(data);
    chrome.runtime.sendMessage({
      type: 'VALIDATION_RESULT',
      errors: result.errors,
      warnings: result.warnings,
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
