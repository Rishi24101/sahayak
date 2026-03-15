"""
Auto-correct & Auto-fill Logic
Suggests corrections and fills form fields from OCR data.
Document-type-aware extraction:
  - Aadhaar: labeled 'Name:' / 'नाम:' / ALL-CAPS-line
  - Income Certificate: "यह प्रमाणित किया जाता है कि NAME, धर्मपत्नी HUSBAND"
  - Ration Card: account-holder row, head-of-family column
  - Caste / Domicile: similar certificate format to income cert
"""
from fastapi import APIRouter, UploadFile, File
from pydantic import BaseModel
from typing import Optional
import re

router = APIRouter()

# Common corrections for Hindi names
NAME_CORRECTIONS = {
    'kumr': 'kumar', 'kumari': 'kumari', 'shrama': 'sharma', 'gupt': 'gupta',
    'sigh': 'singh', 'signgh': 'singh', 'prsad': 'prasad', 'pradhan': 'pradhan',
    'verma': 'verma', 'vishwakarma': 'vishwakarma',
}

# Words that cannot be someone's name (skip these)
SKIP_WORDS = [
    'government', 'india', 'aadhaar', 'unique', 'authority', 'uid',
    'digilocker', 'digital', 'locker', 'male', 'female', 'address',
    'dob', 'date', 'birth', 'पता', 'जन्म', 'पुरुष', 'महिला',
    'download', 'verify', 'uidai', 'vid', 'enrolment', 'specimen',
    'tay', 'onan', 'sample', 'chhattisgarh', 'छत्तीसगढ़', 'government',
    'shasan', 'शासन', 'tehsil', 'तहसील', 'office', 'karyalay', 'कार्यालय',
    'certificate', 'प्रमाण', 'pension', 'prabandh', 'khadya', 'खाद्य',
    'rajnandgaon', 'राजनांदगाँव', 'ward', 'district', 'block', 'state',
    'income', 'आय', 'ration', 'राशन', 'domicile', 'caste', 'जाति',
    'supply', 'आपूर्ति', 'vibhag', 'विभाग', 'collector', 'tahsildar',
    'patwari', 'revenue', 'rajya', 'rajaswa',
]


def correct_name(name: str) -> str:
    """Simple spelling correction for common surnames"""
    parts = name.strip().split()
    corrected = []
    for part in parts:
        lower_part = part.lower()
        if lower_part in NAME_CORRECTIONS:
            corrected.append(NAME_CORRECTIONS[lower_part].title())
        else:
            corrected.append(part.title())
    return ' '.join(corrected)


def _clean_name(raw: str) -> Optional[str]:
    """Clean a raw name string: remove non-alpha, validate length."""
    cleaned = re.sub(r'^[^a-zA-Z\u0900-\u097F]*', '', raw)
    cleaned = re.sub(r'[^a-zA-Z\u0900-\u097F\s]', '', cleaned).strip()
    cleaned = re.sub(r'\s+', ' ', cleaned)
    lower = cleaned.lower()
    if not (3 <= len(cleaned) <= 60):
        return None
    if re.match(r'^\d+$', cleaned):
        return None
    # Reject if it's a known non-name word
    for sw in SKIP_WORDS:
        if sw in lower:
            return None
    return cleaned.title()


def detect_document_type(text: str) -> str:
    """Detect what document type this OCR text is from."""
    tl = text.lower()
    if 'aadhaar' in tl or 'uidai' in tl or 'unique identification' in tl or 'आधार' in tl:
        return 'aadhaar'
    if ('income' in tl and ('certificate' in tl or 'प्रमाण' in tl)) or 'आय प्रमाण' in text or 'income certificate' in tl:
        return 'income_certificate'
    if 'caste' in tl or 'जाति प्रमाण' in text or 'जाति' in tl:
        return 'caste_certificate'
    if 'ration' in tl or 'राशन' in text or 'bpl' in tl or 'खाद्य' in text:
        return 'ration_card'
    if 'domicile' in tl or 'निवास प्रमाण' in text or 'mool niwas' in tl:
        return 'domicile_certificate'
    return 'unknown'


def extract_aadhaar_from_text(text: str) -> Optional[str]:
    """Extract 12-digit Aadhaar number from OCR text"""
    patterns = [
        r'(\d{4}\s?\d{4}\s?\d{4})',
        r'(\d{12})',
        r'[Xx]{4}\s?[Xx]{4}\s?(\d{4})',
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            raw = match.group(0)
            digits_only = re.sub(r'[^0-9Xx]', '', raw)
            if len(digits_only) >= 4:
                return digits_only
    return None


# ─────────────────────────────────────────────────────────────────────────────
# NAME EXTRACTION — document-type-aware
# ─────────────────────────────────────────────────────────────────────────────

def extract_name_certificate(text: str) -> Optional[str]:
    """
    For Income / Caste / Domicile certificates.
    Name appears after "यह प्रमाणित किया जाता है कि" or "certified that"
    Format: "NAME (ENGLISH NAME), धर्मपत्नी/पुत्र/पुत्री PARENT_NAME"
    """
    # Pattern 1: "ki NAME (ENGLISH)" or "कि NAME"
    cert_patterns = [
        # "की / कि / that" followed by Hindi or English name
        r'(?:जाता\s*है\s*कि|किया\s*जाता|certified\s*that|that\s*sh(?:ri|rimati)?\.?)\s*\n?\s*([A-Za-z\u0900-\u097F][A-Za-z\u0900-\u097F\s]{3,50}?)(?:\s*\(|,|\n)',
        r'(?:कि|that)\s+([A-Za-z\u0900-\u097F][A-Za-z\u0900-\u097F\s]{3,50}?)(?:\s*[\(,])',
    ]
    for pattern in cert_patterns:
        m = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
        if m:
            raw = m.group(1).strip().split('\n')[0]
            candidate = _clean_name(raw)
            if candidate:
                return candidate

    # Pattern 2: Bracketed ENGLISH name — "मीना देवी (MEENA DEVI)" → take English part
    m = re.search(r'\(([A-Z][A-Z\s]{3,50})\)', text)
    if m:
        candidate = _clean_name(m.group(1))
        if candidate and len(candidate.split()) >= 2:
            return candidate

    # Pattern 3: First standalone 2+ word name on a line after the government header
    lines = text.strip().split('\n')
    in_header = True
    for line in lines:
        stripped = line.strip()
        # Skip header lines (contain known gov words)
        if any(sw in stripped.lower() for sw in ['government', 'chhattisgarh', 'tehsil', 'certificate', 'शासन', 'कार्यालय', 'प्रमाण', 'number', 'certificate']):
            continue
        if in_header and re.search(r'(?:जाता|certified|प्रमाणित)', stripped, re.IGNORECASE):
            in_header = False
            continue
        if not in_header and stripped:
            candidate = _clean_name(stripped.split(',')[0].split('(')[0])
            if candidate and len(candidate.split()) >= 2:
                return candidate

    return None


def extract_name_aadhaar(text: str) -> Optional[str]:
    """
    For Aadhaar cards: name on labeled line or standalone ALL CAPS line.
    """
    # Priority 1: Labeled patterns
    label_patterns = [
        r'(?:नाम\s*(?:Name)?\s*[:\-]?\s*|Name\s*[:\-]\s*)([A-Z][a-zA-Z\u0900-\u097F\s]{3,50})',
        r'(?:name|NAME)\s*[:\-]\s*([A-Za-z\u0900-\u097F\s]{3,50})',
        r'(?:आवेदक|applicant)[\'s\s]*(?:name|नाम)\s*[:\-]?\s*([A-Z][a-zA-Z\s]{3,50})',
    ]
    for pattern in label_patterns:
        m = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
        if m:
            candidate = _clean_name(m.group(1).split('\n')[0])
            if candidate:
                return candidate

    # Priority 2: "नाम Name: VALUE" bilingual Aadhaar format
    m = re.search(r'(?:नाम\s+Name\s*[:\-]?\s*)([A-Z][A-Z\s]+)', text)
    if m:
        candidate = _clean_name(m.group(1))
        if candidate:
            return candidate

    # Priority 3: ALL CAPS line (2+ words, each 2+ chars)
    lines = text.strip().split('\n')
    for line in lines:
        stripped = line.strip()
        lower = stripped.lower()
        if not stripped or len(stripped) < 5:
            continue
        if any(sw in lower for sw in SKIP_WORDS):
            continue
        if re.match(r'^[=\-<>«»*#+]+', stripped):
            continue
        if re.match(r'^[A-Z][A-Z\s]{4,50}$', stripped):
            words = stripped.split()
            if len(words) >= 2 and all(len(w) >= 2 for w in words):
                candidate = _clean_name(stripped)
                if candidate:
                    return candidate

    return None


def extract_name_ration_card(text: str) -> Optional[str]:
    """
    For Ration Cards: name is head-of-family / खाताधारक / account holder
    """
    patterns = [
        r'(?:head\s*of\s*family|account\s*holder|खाताधारक|मुखिया|Card\s*Holder)\s*[:\-]?\s*([A-Za-z\u0900-\u097F\s]{3,50})',
        r'(?:1\.|Sr\.?\s*No\.?\s*1)\s+([A-Za-z\u0900-\u097F\s]{3,50}?)(?:\s+\d|\s*F|\s*M)',
    ]
    for pattern in patterns:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            candidate = _clean_name(m.group(1).split('\n')[0])
            if candidate:
                return candidate
    # Fallback: first ALL CAPS 2+ word name
    return extract_name_aadhaar(text)


def extract_name_from_text(text: str, doc_type: str = 'unknown') -> Optional[str]:
    """Route to correct name extractor based on document type."""
    if doc_type in ('income_certificate', 'caste_certificate', 'domicile_certificate'):
        return extract_name_certificate(text)
    if doc_type == 'ration_card':
        return extract_name_ration_card(text)
    # Aadhaar and unknown: use labeled-first approach
    return extract_name_aadhaar(text)


# ─────────────────────────────────────────────────────────────────────────────
# FATHER / HUSBAND NAME EXTRACTION
# ─────────────────────────────────────────────────────────────────────────────

def extract_father_name_from_text(text: str, doc_type: str = 'unknown') -> Optional[str]:
    """Extract father's/husband's name — handles certificate और Aadhaar patterns"""
    patterns = [
        # Certificate: "धर्मपत्नी/पत्नी का NAME" or "W/O NAME" or "पुत्र X"
        r'(?:धर्मपत्नी|पत्नी\s*का|W/O|d/o|s/o|w/o|पुत्र|पुत्री|पिता|husband|father|spouse)\s*[:.\-]?\s*([A-Za-z\u0900-\u097F][A-Za-z\u0900-\u097F\s]{2,50}?)(?:\s*[\(,\n]|$)',
        # C/O, S/O, D/O format
        r'(?:C/O|S/O|D/O|C\\O|S\\O|D\\O)\s*[:\-]?\s*([A-Za-z\u0900-\u097F\s]{3,50})',
        # "father name : ..."
        r'(?:father|पिता|parent)\s*[\'s\s]*(?:name|नाम)\s*[:\-]?\s*([A-Za-z\u0900-\u097F\s]{3,50})',
    ]
    for pattern in patterns:
        m = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
        if m:
            raw = m.group(1).strip().split('\n')[0]
            # Remove trailing city/address fragments
            raw = re.split(r'[,;]|(?:ward|block|gram|pin|dist|राजनांदगाँव|raipur)', raw, flags=re.IGNORECASE)[0]
            candidate = _clean_name(raw)
            if candidate and candidate.lower() not in SKIP_WORDS:
                return candidate

    # For income certificates: look for ENGLISH NAME in brackets after the husband mention
    if doc_type in ('income_certificate', 'caste_certificate', 'domicile_certificate'):
        # Pattern: "HUSBAND NAME (ENGLISH)" after the applicant's name
        m = re.search(r'(?:SAH[UU]|PRASAD|KUMAR|DEVI|LAL|RAM|SAHU|YADAV)\s+([A-Z][A-Z\s]+?)(?:\s*[\(,\n]|$)', text)
        if m:
            candidate = _clean_name(m.group(1))
            if candidate:
                return candidate

    return None


# ─────────────────────────────────────────────────────────────────────────────
# OTHER FIELD EXTRACTORS
# ─────────────────────────────────────────────────────────────────────────────

def extract_dob_from_text(text: str, doc_type: str = 'unknown') -> Optional[str]:
    """Extract Date of Birth — avoids issue/certificate dates for non-Aadhaar docs"""
    # For certificates, skip "Issue Date" / "जारी दिनांक"
    if doc_type in ('income_certificate', 'caste_certificate', 'domicile_certificate', 'ration_card'):
        # Remove Issue Date lines before searching
        text_clean = re.sub(r'(?:issue\s*date|जारी\s*दिनांक|dated|date\s*of\s*issue)\s*[:\-]?\s*\d[\d/\-]+', '', text, flags=re.IGNORECASE)
        # Only extract if explicitly labeled as DOB
        m = re.search(r'(?:DOB|dob|जन्म\s*तिथि|Date\s*of\s*Birth)\s*[:\-]?\s*(\d{2})[/\-](\d{2})[/\-](\d{4})', text_clean)
        if m:
            return f"{m.group(1)}/{m.group(2)}/{m.group(3)}"
        return None  # Don't guess DOB from issue date on certificates

    # Aadhaar / unknown: try labeled first, then bare date
    patterns = [
        (r'(?:DOB|dob|जन्म\s*तिथि|Date\s*of\s*Birth|जन्म\s*/\s*DOB)\s*[:\-]?\s*(\d{2})[/\-](\d{2})[/\-](\d{4})', 'dmy_explicit'),
        (r'(\d{2})[/\-](\d{2})[/\-](\d{4})', 'dmy'),
        (r'(\d{4})[/\-](\d{2})[/\-](\d{2})', 'ymd'),
    ]
    for pattern, fmt in patterns:
        match = re.search(pattern, text)
        if match:
            groups = match.groups()
            if fmt in ('dmy', 'dmy_explicit'):
                day, month, year = groups[-3], groups[-2], groups[-1]
                if int(year) > 1900:
                    return f"{day}/{month}/{year}"
            elif fmt == 'ymd':
                year, month, day = groups[0], groups[1], groups[2]
                if int(year) > 1900:
                    return f"{day}/{month}/{year}"
    return None


def extract_gender_from_text(text: str) -> Optional[str]:
    """Extract gender from OCR text"""
    text_lower = text.lower()
    if 'female' in text_lower or 'महिला' in text or 'धर्मपत्नी' in text or 'पत्नी' in text or 'w/o' in text_lower or 'kumari' in text_lower:
        return 'female'
    if 'male' in text_lower or 'पुरुष' in text or 's/o' in text_lower or 'd/o' in text_lower:
        return 'male'
    return None


def extract_address_from_text(text: str, doc_type: str = 'unknown') -> Optional[str]:
    """Extract address — handles 'Ward No.', 'Gram:', 'पता:' and certificate inline addresses."""
    lines = text.strip().split('\n')
    address_lines = []
    capture = False

    # For certificates: address is often inline — "Ward No. X, Village, District, PIN"
    if doc_type in ('income_certificate', 'caste_certificate', 'domicile_certificate', 'ration_card'):
        # Look for Ward No. / Gram / Village / Pin lines
        ward_patterns = [
            r'(?:ward\s*no\.?|vill(?:age)?\.?|gram|block|तहसील|tehsil|pin\s*[:.]?\s*\d{6})',
            r'(?:rajnandgaon|raipur|bilaspur|durg|raigarh|korba)',  # known CG districts
            r'\d{6}',  # PIN code
        ]
        cert_address_lines = []
        for line in lines:
            stripped = line.strip()
            if not stripped or len(stripped) < 4:
                continue
            # Skip lines that are headers or contain certificate boilerplate
            if any(kw in stripped.lower() for kw in ['government', 'chhattisgarh', 'tehsil office', 'certificate', 'प्रमाण पत्र', 'tahsildar', 'patwari', 'issue']):
                continue
            if any(re.search(p, stripped, re.IGNORECASE) for p in ward_patterns):
                cert_address_lines.append(stripped)

        if cert_address_lines:
            # Merge, clean
            merged = ', '.join(cert_address_lines)
            merged = re.sub(r'\s+', ' ', merged).strip()
            return merged

    # Aadhaar / generic: capture after "Address" / "पता" label
    for line in lines:
        stripped = line.strip()
        lower = stripped.lower()
        if any(kw in lower for kw in ['address', 'पता', 'निवास', 'स्थायी पता']):
            capture = True
            after = re.split(r'(?:address|पता|निवास|स्थायी\s*पता)\s*:?\s*', stripped, flags=re.IGNORECASE)
            if len(after) > 1 and after[-1].strip():
                address_lines.append(after[-1].strip())
            continue
        if re.match(r'^[SDW](/|\\)[O0]\s*:', stripped, re.IGNORECASE):
            capture = True
            address_lines.append(stripped)
            continue
        if capture and stripped:
            address_lines.append(stripped)
            if len(address_lines) >= 4:
                break

    return ', '.join(address_lines) if address_lines else None


def extract_income_from_text(text: str) -> Optional[str]:
    """Extract annual income amount (digits only)"""
    patterns = [
        # "₹54,000/-" or "Rs. 54000"
        r'(?:Rs\.?|₹)\s*([\d,]+)(?:\s*/[-]?|\.?)',
        # "annual income : 54000"
        r'(?:annual\s*income|वार्षिक\s*(?:परिवार\s*)?आय|income|आय)\s*[:\-]?\s*(?:Rs\.?|₹)?\s*([\d,]+)',
        # Rupees spelled out — extract the number before the word
        r'([\d,]+)\s*/[-]?\s*(?:\(Rupees|रुपये)',
    ]
    for pattern in patterns:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            return re.sub(r'[^\d]', '', m.group(1))
    return None


def extract_mobile_from_text(text: str) -> Optional[str]:
    """Extract 10-digit mobile number"""
    m = re.search(r'(?:mobile|mob|phone|tel|contact|मोबाइल)\s*[:\-]?\s*((?:\+91)?[\s\-]?(\d{10}))', text, re.IGNORECASE)
    if m:
        digits = re.sub(r'\D', '', m.group(1))[-10:]
        if len(digits) == 10:
            return digits
    # Bare 10-digit number not overlapping full aadhaar
    for m in re.finditer(r'\b(\d{10})\b', text):
        num = m.group(1)
        surround = text[max(0, m.start()-2):m.end()+2]
        if not re.match(r'\d{12}', surround.replace(' ', '')):
            return num
    return None


# ─────────────────────────────────────────────────────────────────────────────
# API ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

class AutocorrectRequest(BaseModel):
    field_name: str
    field_value: str
    service_type: str = ""


class AutocorrectResponse(BaseModel):
    original: str
    corrected: str
    changed: bool
    suggestion: str


@router.post("/autocorrect", response_model=AutocorrectResponse)
def autocorrect_field(req: AutocorrectRequest):
    """Suggest corrections for form fields"""
    original = req.field_value
    corrected = original
    suggestion = ""

    if req.field_name in ['applicant_name', 'father_name']:
        corrected = correct_name(original)
        if corrected != original:
            suggestion = f"क्या आपका मतलब '{corrected}' है?"

    if req.field_name == 'aadhaar_number':
        cleaned = re.sub(r'[^\d]', '', original)
        if len(cleaned) == 12:
            corrected = cleaned
            if corrected != original:
                suggestion = "आधार नंबर स्वचालित रूप से साफ किया गया"

    if req.field_name == 'income':
        cleaned = re.sub(r'[^\d]', '', original)
        if cleaned:
            corrected = cleaned

    return AutocorrectResponse(
        original=original, corrected=corrected,
        changed=corrected != original, suggestion=suggestion
    )


class AutofillRequest(BaseModel):
    ocr_text: str


class AutofillResponse(BaseModel):
    applicant_name: Optional[str] = None
    father_name: Optional[str] = None
    aadhaar_number: Optional[str] = None
    dob: Optional[str] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    income: Optional[str] = None
    mobile: Optional[str] = None
    document_type: Optional[str] = None
    detected_service: Optional[str] = None
    fields_found: int = 0


@router.post("/autofill", response_model=AutofillResponse)
def autofill_from_ocr(req: AutofillRequest):
    """Extract form fields from OCR raw text — document-type-aware extraction."""
    text = req.ocr_text

    # Step 1: Detect document type first
    doc_type = detect_document_type(text)

    # Step 2: Extract fields with document-type awareness
    name = extract_name_from_text(text, doc_type)
    father_name = extract_father_name_from_text(text, doc_type)
    aadhaar = extract_aadhaar_from_text(text)
    dob = extract_dob_from_text(text, doc_type)
    gender = extract_gender_from_text(text)
    address = extract_address_from_text(text, doc_type)
    income = extract_income_from_text(text)
    mobile = extract_mobile_from_text(text)

    DOCTYPE_SERVICE_MAP = {
        'ration_card': 'ration_card',
        'income_certificate': 'income_certificate',
        'caste_certificate': 'caste_certificate',
        'domicile_certificate': 'domicile_certificate',
        'aadhaar': None,  # Aadhaar supplements any service
    }
    detected_service = DOCTYPE_SERVICE_MAP.get(doc_type)

    fields_found = sum(1 for x in [name, father_name, aadhaar, dob, gender, address, income, mobile] if x)

    return AutofillResponse(
        applicant_name=name,
        father_name=father_name,
        aadhaar_number=aadhaar,
        dob=dob,
        gender=gender,
        address=address,
        income=income,
        mobile=mobile,
        document_type=doc_type,
        detected_service=detected_service,
        fields_found=fields_found,
    )
