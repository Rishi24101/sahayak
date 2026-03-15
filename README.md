<div align="center">
  <img src="public/favicon.ico" alt="Sahayak Logo" width="100" />
  <h1>Sahayak (सहायक)</h1>
  <p><strong>AI-Powered Co-Pilot for Common Service Centre (CSC) Operators</strong></p>
  <p><em>Reducing form rejection rates and handling times through predictive AI and automated workflows.</em></p>
</div>

---

## 🚀 The Problem
A Common Service Centre (CSC) operator in rural India processes **70 to 90 government applications** a day (pensions, certificates, corrections) on slow, complex portal UIs. 

Currently, operators face:
1. **High Rejection Rates (up to 30-40%)** due to minor age/income mismatched criteria or missing documents that are only discovered *after* manual submission by government APIs.
2. **Repetitive Manual Entry** tracing data from physical Aadhaar/Income certificates into long web forms.
3. **Complex Policy Rules** where eligibility changes frequently, requiring operators to memorize complex criteria for dozens of schemes.

## 💡 The Solution: Sahayak
Sahayak is an intelligent, agentic co-pilot that sits between the CSC operator and the government portals. It does not replace the operator; it empowers them with AI.

### Core Features:
* 📸 **Smart Document Scanner (OCR):** Upload citizen documents (Aadhaar, Ration Card, Income Certificate). Sahayak automatically detects the document type, extracts key fields (Name, DOB, Income, Father's Name) using Llama Scout AI, and routes the operator to the correct service form.
* 🛡️ **Predictive Rejection Engine:** Before the operator spends 10 minutes filling a portal, Sahayak runs an **XGBoost** ML model against locally entered details to predict the probability of rejection (LOW, MEDIUM, HIGH risk) and flags exact policy violations (e.g., "Age is below 60 for Old Age Pension").
* 🤖 **Context-Aware Voice Chatbot:** A Hindi/English voice-activated assistant powered by Groq/Llama that knows *which* form is open and what errors currently exist. It can answer policy questions ("What documents are needed here?") or perform agentic actions ("Fill the income as 36000").
* 🧩 **Chrome Extension Copilot (SahayakGov):** Once data is validated locally, the Sahayak Chrome Extension injects a floating panel directly into real government portals (e.g., e-District), allowing 1-click auto-fill of the citizen's validated data into the legacy government website.
* 🇮🇳 **Government-Native UI/UX:** Built from the ground up to look like an official Digital India / CSC portal, ensuring zero learning curve for existing VLEs (Village Level Entrepreneurs).

---

## 🛠️ Technology Stack

### Frontend (User Interface & Extension)
* **React 18 + TypeScript:** Robust, type-safe functional components.
* **Vite:** Lightning-fast HMR and build tooling.
* **Tailwind CSS / Vanilla CSS:** Custom Government CSC design system (Navy, Saffron, Green).
* **Chrome Extension APIs (MV3):** `chrome.storage.local`, content script injection, message passing.

### Backend (AI & Validation)
* **FastAPI (Python):** High-performance asynchronous API for ML and OCR workflows.
* **XGBoost & Scikit-Learn:** Machine Learning pipeline for predicting form rejection probabilities based on historical weights.
* **Llama Scout AI + Groq:** Used for highly accurate, Hindi-aware OCR extraction and the generative RAG chatbot.
* **Tesseract.js:** Offline fallback for local OCR if network connectivity drops.

---

## ⚙️ Installation & Running Locally

### 1. Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: .\venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file in the `backend/` directory:
```env
GROQ_API_KEY=your_groq_api_key_here
OPENROUTER_API_KEY=your_openrouter_api_key_here
```

Start the backend server:
```bash
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

### 2. Frontend Setup
```bash
# In the root directory
npm install
npm run dev
```

### 3. Chrome Extension Setup
1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** in the top right.
3. Click **Load unpacked** and select the `chrome-extension` folder in this repository.
4. The SahayakGov copilot will now activate on simulated government portals (like `http://localhost:3001`).

---

## 🖥️ Usage Flow
1. **Login:** Access `http://localhost:5173/login`. Authenticate as a CSC VLE Operator.
2. **Scan Document:** Go to the OCR Scanner, upload a sample certificate. Watch the AI dynamically extract and animate the fields.
3. **Validate:** Sahayak routes you to the matching form. It auto-computes name mismatches and runs the XGBoost validation predicting success/failure.
4. **Chat:** Click the bottom-right Bot icon. Ask in Hindi: *"इस फॉर्म के लिए मेरी उम्र क्या होनी चाहिए?"* or say *"मेरा नाम राहुल सेट करो"*.
5. **Auto-Fill Portal:** Click "पोर्टल पर जाएं". The Chrome extension opens the government portal and allows 1-click data transfer.

---

<div align="center">
  <p>Built for empowering rural digital infrastructure. 🇮🇳</p>
</div>
