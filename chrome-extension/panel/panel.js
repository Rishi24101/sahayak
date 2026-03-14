/**
 * SahayakGov Panel JS
 * Fetches citizen data from extension storage and renders it.
 * Triggers autofill / highlight on the active govt portal tab.
 */

const FIELD_LABELS = {
  applicant_name: 'आवेदक का नाम',
  father_name: 'पिता/पति का नाम',
  aadhaar_number: 'आधार संख्या',
  dob: 'जन्म तिथि',
  gender: 'लिंग',
  mobile: 'मोबाइल',
  address: 'पता',
  annual_income: 'वार्षिक आय',
  bank_account: 'बैंक खाता',
  ifsc: 'IFSC कोड',
  ration_card_number: 'राशन कार्ड नंबर',
  family_size: 'परिवार के सदस्य',
};

const GENDER_LABELS = { male: 'पुरुष', female: 'महिला' };

function $(id) { return document.getElementById(id); }

function renderCitizenData(data) {
  if (!data) {
    $('noDataState').classList.remove('hidden');
    $('dataCard').classList.add('hidden');
    return;
  }

  $('noDataState').classList.add('hidden');
  $('dataCard').classList.remove('hidden');

  // Service name
  $('serviceName').textContent = data.service_name || data.service_type || 'सेवा';

  // Risk banner
  if (data.risk) {
    const banner = $('riskBanner');
    banner.classList.remove('hidden', 'risk-low', 'risk-medium', 'risk-high');
    const risk = data.risk.risk;
    banner.classList.add(`risk-${risk.toLowerCase()}`);
    $('riskIcon').textContent = risk === 'LOW' ? '✅' : risk === 'MEDIUM' ? '⚠️' : '🔴';
    $('riskLabel').textContent = 'रिजेक्शन जोखिम';
    $('riskHindi').textContent = data.risk.risk_hindi || '';
    $('riskPercent').textContent = `${Math.round(data.risk.probability * 100)}%`;
  }

  // Portal badge
  const host = ''; // can't read tab URL from panel directly; just show generic
  $('portalBadge').textContent = 'Portal';
  $('portalBadge').classList.remove('hidden');

  // Citizen fields
  const grid = $('citizenFields');
  grid.innerHTML = '';
  const fieldOrder = ['applicant_name', 'father_name', 'aadhaar_number', 'dob', 'gender', 'mobile', 'address', 'annual_income', 'bank_account', 'ifsc'];
  fieldOrder.forEach(key => {
    let val = data[key] || data[key.replace('annual_income', 'income')];
    if (!val) return;
    if (key === 'gender') val = GENDER_LABELS[val] || val;
    if (key === 'annual_income' && val) val = `₹${Number(val).toLocaleString('hi-IN')}`;

    const row = document.createElement('div');
    row.className = 'field-row';
    row.innerHTML = `
      <span class="field-label">${FIELD_LABELS[key] || key}</span>
      <span class="field-value">${val}</span>
    `;
    grid.appendChild(row);
  });

  // Validation errors
  const errors = data.validation?.errors || [];
  if (errors.length > 0) {
    $('errorsCard').classList.remove('hidden');
    $('errorsList').innerHTML = errors.map(e => `<li>${e}</li>`).join('');
  } else {
    $('errorsCard').classList.add('hidden');
  }

  // Missing docs
  const missingDocs = data.validation?.missing_docs || [];
  if (missingDocs.length > 0) {
    $('missingDocsCard').classList.remove('hidden');
    $('missingDocsList').innerHTML = missingDocs.map(d => `<li>📄 ${d}</li>`).join('');
  } else {
    $('missingDocsCard').classList.add('hidden');
  }

  // Timestamp
  if (data.timestamp) {
    $('timestamp').textContent = `डेटा समय: ${new Date(data.timestamp).toLocaleTimeString('hi-IN')}`;
  }
}

function loadAndRender() {
  chrome.runtime.sendMessage({ type: 'GET_CITIZEN_DATA' }, (response) => {
    renderCitizenData(response?.data || null);
  });
}

// Button handlers
$('highlightBtn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'HIGHLIGHT_REQUESTED' });
  $('highlightBtn').textContent = '✅ हाइलाइट किया!';
  setTimeout(() => { $('highlightBtn').textContent = '🔵 फ़ील्ड हाइलाइट करें'; }, 2000);
});

$('autofillBtn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'GET_CITIZEN_DATA' }, (response) => {
    if (!response?.data) {
      alert('डेटा नहीं मिला। पहले Sahayak में फॉर्म भरें।');
      return;
    }
    const result = $('autofillResult');
    result.textContent = 'भर रहे हैं...';
    result.classList.remove('hidden', 'result-success', 'result-warn');

    chrome.runtime.sendMessage({
      type: 'AUTOFILL_REQUESTED',
      data: response.data,
    });

    // Listen for result
    chrome.runtime.onMessage.addListener(function handler(msg) {
      if (msg.type === 'AUTOFILL_RESULT') {
        result.textContent = `✅ ${msg.filled} फ़ील्ड भरे गए${msg.failed ? ` | ⚠️ ${msg.failed} नहीं मिले` : ''}`;
        result.classList.add(msg.failed ? 'result-warn' : 'result-success');
        chrome.runtime.onMessage.removeListener(handler);
      }
    });
  });
});

$('refreshBtn').addEventListener('click', loadAndRender);

// Listen for new data arriving
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'GOV_PORTAL_DETECTED' || message.type === 'SAHAYAK_DATA_RECEIVED') {
    loadAndRender();
  }
});

// Initial load
loadAndRender();
// Poll every 5s in case Sahayak sends data after panel opens
setInterval(loadAndRender, 5000);
