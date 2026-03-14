# SahayakGov — Chrome Extension

> **AI Co-Pilot for CSC Operators** — automatically fills government portal forms from Sahayak's collected citizen data, with real-time risk warnings.

## 🚀 Installation (Development Mode)

1. Open Chrome → go to `chrome://extensions`
2. Enable **"Developer Mode"** (top-right toggle)
3. Click **"Load unpacked"**
4. Select this `chrome-extension/` folder
5. The extension appears in your toolbar → pin it (puzzle icon → pin "SahayakGov")

## 📋 How to Use

### Step 1 — Collect Citizen Data in Sahayak
1. Open `http://localhost:5173`
2. Scan documents via **OCR Scanner** → auto-fill fields
3. Open any service form (e.g., Old Age Pension)
4. Fill / verify the form + click **"AI से जांचें"**
5. Click **"पोर्टल पर जाएं"** ← this sends data to the extension

### Step 2 — Fill the Government Portal
1. Browser opens the govt portal (e-district, khadya, pmjay)
2. **SahayakGov side panel opens automatically** on the right
3. Side panel shows:
   - 🔴/⚠️/✅ XGBoost rejection risk badge
   - Citizen's name, Aadhaar, DOB, address, income
   - Missing documents list
   - Validation errors
4. Click **"Auto-Fill करें"** → extension fills all matching form fields
5. Fields highlight with blue outline → verify → submit

## 🗂️ File Structure

```
chrome-extension/
├── manifest.json          # MV3 manifest (permissions, content scripts)
├── background.js          # Service worker — data relay + side panel open
├── content-sahayak.js     # Injected into Sahayak app — captures postMessage
├── content-gov.js         # Injected into govt portals — fills fields
├── mappings.json          # Field selector mappings per portal + service
├── panel/
│   ├── panel.html         # Side panel UI
│   ├── panel.js           # Panel logic
│   └── panel.css          # Panel styles
└── icons/
    └── icon-48.png
```

## 🌐 Supported Portals

| Portal | Domain | Services |
|--------|--------|----------|
| e-District CG | `edistrict.cgstate.gov.in` | Pension, Caste, Income, Domicile Certificates |
| Khadya (Ration) | `khadya.cg.nic.in` | Ration Card |
| PM-JAY | `pmjay.gov.in` | Ayushman Bharat |

## 🔧 Field Mappings

Edit `mappings.json` to add/fix CSS selectors for govt portals.
Format:
```json
{
  "portal_key": {
    "service_id": {
      "sahayak_field": ["#selector1", "[name='field']", "input[placeholder*='Name']"]
    }
  }
}
```
Selectors are tried in order — first visible match wins.

## ⚠️ Notes

- The extension can only auto-fill simple HTML input/textarea fields.
- Govt portals using CAPTCHA need manual submission.
- If the portal uses heavy JavaScript rendering, the MutationObserver in `content-gov.js` will wait for dynamic fields to appear.
- For production deployment, update `host_permissions` in `manifest.json` to your production Sahayak domain.
