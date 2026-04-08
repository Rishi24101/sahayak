const API_BASE = "http://localhost:8001/api";
let citizenData = null;

function $(id) {
  return document.getElementById(id);
}

function safeText(v) {
  return String(v ?? "").replace(/[&<>\"]/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '\"': "&quot;",
  }[m]));
}

function renderPanel() {
  const rows = $("panelCitizenRows");
  if (!rows) return;

  if (!citizenData) {
    rows.innerHTML = '<div style="font-size:12px;color:#6b7280;text-align:center;padding:10px;">Sahayak से डेटा नहीं मिला।</div>';
    $("panelRiskSection").style.display = "none";
    $("panelErrorSection").style.display = "none";
    return;
  }

  const income = citizenData.annual_income ?? citizenData.income;
  const fields = [
    ["नाम", citizenData.applicant_name],
    ["पिता", citizenData.father_name],
    ["जन्म तिथि", citizenData.dob],
    ["लिंग", citizenData.gender],
    ["आधार", citizenData.aadhaar_number],
    ["मोबाइल", citizenData.mobile],
    ["पता", citizenData.address],
    ["पिनकोड", citizenData.pincode],
    ["वार्षिक आय", income ? `Rs ${income}` : null],
    ["बैंक खाता", citizenData.bank_account],
    ["IFSC", citizenData.ifsc],
  ];

  rows.innerHTML = fields
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "")
    .map(([label, value]) => `
      <div class="citizen-row">
        <span class="citizen-label">${safeText(label)}</span>
        <span class="citizen-value">${safeText(value)}</span>
      </div>
    `)
    .join("");

  const riskSection = $("panelRiskSection");
  const riskBadge = $("panelRiskBadge");
  const risk = citizenData?.risk?.risk;
  if (risk && riskSection && riskBadge) {
    riskSection.style.display = "block";
    riskBadge.className = "risk-badge-sm " + risk;
    riskBadge.textContent = risk === "HIGH" ? "उच्च" : risk === "MEDIUM" ? "मध्यम" : "कम";
  } else if (riskSection) {
    riskSection.style.display = "none";
  }

  const errors = citizenData?.validation?.errors || [];
  const errorSection = $("panelErrorSection");
  const errorBox = $("panelErrors");
  if (errors.length > 0 && errorSection && errorBox) {
    errorSection.style.display = "block";
    errorBox.innerHTML = errors.map((e) => `<div class="factor-item">${safeText(e)}</div>`).join("");
  } else if (errorSection) {
    errorSection.style.display = "none";
  }
}

function loadCitizenData() {
  chrome.runtime.sendMessage({ type: "GET_CITIZEN_DATA" }, (res) => {
    citizenData = res?.data || null;
    renderPanel();
  });
}

function setStatus(text) {
  const status = $("panelStatus");
  if (status) status.textContent = text;
}

$("autofillBtn")?.addEventListener("click", () => {
  setStatus("भर रहे हैं...");
  chrome.runtime.sendMessage({ type: "GET_CITIZEN_DATA" }, (res) => {
    if (!res?.data) {
      setStatus("डेटा नहीं मिला");
      return;
    }

    chrome.runtime.sendMessage({
      type: "AUTOFILL_REQUESTED",
      data: res.data,
    });
  });
});

$("validateBtn")?.addEventListener("click", () => {
  setStatus("जांच रहे हैं...");
  chrome.runtime.sendMessage({ type: "DO_VALIDATE" });
});

$("refreshBtn")?.addEventListener("click", () => {
  setStatus("डेटा रिफ्रेश किया");
  loadCitizenData();
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "AUTOFILL_RESULT") {
    const empty = Array.isArray(message.empty_fields) ? message.empty_fields : [];
    const emptyPart = empty.length ? ` | खाली: ${empty.join(', ')}` : "";
    setStatus(`भरे गए: ${message.filled || 0}${message.failed ? ` | नहीं मिले: ${message.failed}` : ""}${emptyPart} | Validate से पहले digits check करें`);
  }
  if (message.type === "VALIDATION_RESULT") {
    const eCount = Array.isArray(message.errors) ? message.errors.length : 0;
    const wCount = Array.isArray(message.warnings) ? message.warnings.length : 0;
    if (eCount > 0) setStatus(`❌ ${eCount} त्रुटि / ${wCount} चेतावनी`);
    else if (wCount > 0) setStatus(`⚠️ ${wCount} चेतावनी`);
    else setStatus("✅ सभी फ़ील्ड सही हैं");
  }
  if (message.type === "SAHAYAK_DATA_RECEIVED") {
    loadCitizenData();
  }
});

function addChatMessage(text, sender) {
  const container = $("chatMessages");
  if (!container) return;
  const el = document.createElement("div");
  el.className = `chat-msg ${sender}`;
  el.textContent = text;
  container.appendChild(el);
  container.scrollTop = container.scrollHeight;
}

function getCitizenDataSafe() {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ type: "GET_CITIZEN_DATA" }, (response) => {
        if (chrome.runtime.lastError) {
          resolve(null);
          return;
        }
        resolve(response?.data || null);
      });
    } catch {
      resolve(null);
    }
  });
}

async function handleSendMessage(text) {
  if (!text || !text.trim()) return;
  addChatMessage(text.trim(), "user");
  $("chatInput").value = "";

  const typingId = Date.now();
  const container = $("chatMessages");
  const typingDiv = document.createElement("div");
  typingDiv.className = "chat-msg bot";
  typingDiv.id = `typing-${typingId}`;
  typingDiv.textContent = "सोच रहा हूं...";
  container.appendChild(typingDiv);

  try {
    const citizen = await getCitizenDataSafe();
    const res = await fetch(`${API_BASE}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: text,
        scheme_context: citizen?.service_name || citizen?.service_type || "",
        form_context: citizen || {},
      }),
    });

    const t = $(`typing-${typingId}`);
    if (!res.ok) {
      if (t) t.textContent = `सर्वर त्रुटि (${res.status})।`;
      return;
    }

    const data = await res.json();
    if (t) t.textContent = data.answer || "माफ करें, मुझे समझ नहीं आया।";
    container.scrollTop = container.scrollHeight;
  } catch (err) {
    const t = $(`typing-${typingId}`);
    if (t) t.textContent = "सर्वर से कनेक्ट नहीं हो सका (Query failed)।";
  }
}

$("chatSendBtn")?.addEventListener("click", () => handleSendMessage($("chatInput")?.value || ""));
$("chatInput")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleSendMessage($("chatInput")?.value || "");
});

let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

$("chatMicBtn")?.addEventListener("mousedown", async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
    audioChunks = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
      if (audioBlob.size < 1000) {
        addChatMessage("रिकॉर्डिंग बहुत छोटी थी, दोबारा बोलें।", "bot");
        return;
      }

      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");

      const input = $("chatInput");
      if (input) input.placeholder = "आवाज प्रोसेस हो रही है...";

      try {
        const res = await fetch(`${API_BASE}/voice/transcribe`, {
          method: "POST",
          body: formData,
        });
        if (!res.ok) {
          addChatMessage(`Voice API त्रुटि (${res.status})`, "bot");
          return;
        }
        const data = await res.json();
        if (data.text && data.text.trim()) {
          handleSendMessage(data.text);
        } else {
          addChatMessage("आवाज़ मिली, लेकिन टेक्स्ट नहीं बन पाया। फिर से साफ बोलें।", "bot");
        }
      } catch {
        addChatMessage("आवाज पहचानने में त्रुटि।", "bot");
      }

      if (input) input.placeholder = "पूछें...";
    };

    mediaRecorder.start();
    isRecording = true;
    $("chatMicBtn").classList.add("recording");
  } catch {
    addChatMessage("माइक्रोफोन एक्सेस नहीं मिला।", "bot");
  }
});

function stopRecording() {
  if (isRecording && mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
    isRecording = false;
    $("chatMicBtn")?.classList.remove("recording");
    mediaRecorder.stream.getTracks().forEach((track) => track.stop());
  }
}

$("chatMicBtn")?.addEventListener("mouseup", stopRecording);
$("chatMicBtn")?.addEventListener("mouseleave", stopRecording);

setTimeout(() => {
  addChatMessage("नमस्ते! मैं SahayakGov हूं।", "bot");
}, 400);

loadCitizenData();
