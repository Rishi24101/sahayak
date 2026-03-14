"""
Auto-correct & Auto-fill Logic
Suggests corrections and fills form fields from OCR data
Improved name extraction: labeled-pattern-first (Name: / नाम:) before fallthrough
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


def extract_aadhaar_from_text(text: str) -> Optional[str]:
    """Extract 12-digit Aadhaar number from OCR text"""
    patterns = [
        r'(\d{4}\s?\d{4}\s?\d{4})',
        r'(\d{12})',
        r'[Xx]{4}\s?[Xx]{4}\s?(\d{4})',
        r'[Xx]{8}(\d{4})',
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            raw = match.group(0)
            digits_only = re.sub(r'[^0-9Xx]', '', raw)
            if len(digits_only) >= 4:
                return digits_only
    return None


def _clean_name(raw: str) -> Optional[str]:
    """Clean a raw name string: remove non-alpha, validate length"""
    cleaned = re.sub(r'^[^a-zA-Z\u0900-\u097F]*', '', raw)
    cleaned = re.sub(r'[^a-zA-Z\u0900-\u097F\s]', '', cleaned).strip()
    if 3 <= len(cleaned) <= 60 and not re.match(r'^\d+$', cleaned):
        return cleaned.title()
    return None


def extract_name_from_aadhaar_text(text: str) -> Optional[str]:
    """
    Extract applicant name from OCR text.
    Strategy (priority order):
    1. Look for explicit label patterns: 'Name:', 'नाम:', 'NAME :' etc.
    2. Look for 'नाम Name:' bilingual patterns common on Aadhaar
    3. Fallback: scan lines and return first plausible full name (2+ words, all caps or title case)
    """
    # ── Priority 1: Labeled patterns ────────────────────────────────────────
    # Matches: "Name: RAM PRASAD SAHU", "नाम: राम प्रसाद", "NAME : John"
    label_patterns = [
        r'(?:नाम\s*(?:Name)?\s*[:\-]?\s*|Name\s*[:\-]\s*)([A-Z][a-zA-Z\u0900-\u097F\s]{3,50})',
        r'(?:name|NAME)\s*[:\-]\s*([A-Za-z\u0900-\u097F\s]{3,50})',
        r'(?:आवेदक|applicant)[\'s\s]*(?:name|नाम)\s*[:\-]?\s*([A-Z][a-zA-Z\s]{3,50})',
    ]
    for pattern in label_patterns:
        m = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
        if m:
            candidate = _clean_name(m.group(1))
            if candidate:
                return candidate

    # ── Priority 2: "नाम Name: VALUE" bilingual Aadhaar format ──────────────
    m = re.search(r'(?:नाम\s+Name\s*[:\-]?\s*)([A-Z][A-Z\s]+)', text)
    if m:
        candidate = _clean_name(m.group(1))
        if candidate:
            return candidate

    # ── Priority 3: Lines in ALL CAPS that look like full names (2+ words) ──
    # Typical Aadhaar format: "RAM PRASAD SAHU" on its own line
    lines = text.strip().split('\n')
    skip_words = ['government', 'india', 'aadhaar', 'unique', 'authority', 'uid',
                  'digilocker', 'digital', 'locker', 'male', 'female', 'address',
                  'dob', 'date', 'birth', 'पता', 'जन्म', 'पुरुष', 'महिला',
                  'download', 'verify', 'uidai', 'vid', 'enrolment', 'specimen',
                  'tay', 'onan', 'sample']  # skip known OCR artifact words

    all_caps_candidates = []
    for line in lines:
        stripped = line.strip()
        lower = stripped.lower()
        if not stripped or len(stripped) < 5:
            continue
        if any(sw in lower for sw in skip_words):
            continue
        if re.match(r'^[=\-<>«»*#+]+', stripped):  # skip decorative lines
            continue
        # ALL CAPS full name: 2+ words, each 2+ chars
        if re.match(r'^[A-Z][A-Z\s]{4,50}$', stripped):
            words = stripped.split()
            if len(words) >= 2 and all(len(w) >= 2 for w in words):
                all_caps_candidates.append(stripped)

    if all_caps_candidates:
        return all_caps_candidates[0].title()

    # ── Priority 4: General fallback (original logic, improved) ────────────
    for line in lines:
        stripped = line.strip()
        if not stripped or len(stripped) < 5:
            continue
        lower = stripped.lower()
        if any(sw in lower for sw in skip_words):
            continue
        if re.match(r'^[\d\s/\-.:Xx=<>«»]+$', stripped):
            continue
        if re.match(r'^[SDW](/|\\)[O0]', stripped, re.IGNORECASE):
            continue
        if re.search(r'(ward|block|district|state|pradesh|pin|taluk|tehsil)', lower):
            continue

        candidate = _clean_name(stripped)
        if candidate and len(candidate.split()) >= 2:
            return candidate

    return None


def extract_father_name_from_text(text: str) -> Optional[str]:
    """Extract father's/husband's name from OCR text"""
    patterns = [
        r'(?:S/O|D/O|W/O|C/O|पिता|Father)\s*[:\-]?\s*([A-Za-z\u0900-\u097F\s]{3,50})',
        r'(?:father|पिता|parent)\s*[\'s\s]*(?:name|नाम)\s*[:\-]?\s*([A-Za-z\u0900-\u097F\s]{3,50})',
    ]
    for pattern in patterns:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            candidate = _clean_name(m.group(1).split('\n')[0])
            if candidate:
                return candidate
    return None


def extract_dob_from_text(text: str) -> Optional[str]:
    """Extract Date of Birth from OCR text — handles multiple formats"""
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
    if 'female' in text_lower or 'महिला' in text:
        return 'female'
    if 'male' in text_lower or 'पुरुष' in text:
        return 'male'
    return None


def extract_address_from_text(text: str) -> Optional[str]:
    """Extract address from OCR text"""
    lines = text.strip().split('\n')
    address_lines = []
    capture = False
    for line in lines:
        stripped = line.strip()
        lower = stripped.lower()
        if any(kw in lower for kw in ['address', 'पता', 'निवास']):
            capture = True
            after = re.split(r'(?:address|पता|निवास)\s*:?\s*', stripped, flags=re.IGNORECASE)
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
    """Extract annual income from income certificate OCR text"""
    patterns = [
        r'(?:annual\s*income|वार्षिक\s*आय|income|आय)\s*[:\-]?\s*(?:Rs\.?|₹)?\s*(\d[\d,]+)',
        r'(?:Rs\.?|₹)\s*(\d[\d,]+)',
    ]
    for pattern in patterns:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            return re.sub(r'[^\d]', '', m.group(1))
    return None


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
    document_type: Optional[str] = None
    detected_service: Optional[str] = None
    fields_found: int = 0


@router.post("/autofill", response_model=AutofillResponse)
def autofill_from_ocr(req: AutofillRequest):
    """Extract form fields from OCR raw text (labeled-pattern-first name extraction)"""
    text = req.ocr_text

    name = extract_name_from_aadhaar_text(text)
    father_name = extract_father_name_from_text(text)
    aadhaar = extract_aadhaar_from_text(text)
    dob = extract_dob_from_text(text)
    gender = extract_gender_from_text(text)
    address = extract_address_from_text(text)
    income = extract_income_from_text(text)

    # Detect document type from keywords in text
    text_lower = text.lower()
    doc_type = None
    if 'aadhaar' in text_lower or 'uidai' in text_lower or 'unique identification' in text_lower:
        doc_type = 'aadhaar'
    elif 'income' in text_lower and ('certificate' in text_lower or 'प्रमाण' in text_lower):
        doc_type = 'income_certificate'
    elif 'caste' in text_lower or 'जाति' in text_lower:
        doc_type = 'caste_certificate'
    elif 'ration' in text_lower or 'राशन' in text_lower:
        doc_type = 'ration_card'
    elif 'domicile' in text_lower or 'निवास' in text_lower or 'residence' in text_lower:
        doc_type = 'domicile_certificate'

    DOCTYPE_SERVICE_MAP = {
        'ration_card': 'ration_card',
        'income_certificate': 'income_certificate',
        'caste_certificate': 'caste_certificate',
        'domicile_certificate': 'domicile_certificate',
    }
    detected_service = DOCTYPE_SERVICE_MAP.get(doc_type) if doc_type else None

    fields_found = sum(1 for x in [name, father_name, aadhaar, dob, gender, address, income] if x)

    return AutofillResponse(
        applicant_name=name, father_name=father_name, aadhaar_number=aadhaar,
        dob=dob, gender=gender, address=address, income=income,
        document_type=doc_type, detected_service=detected_service,
        fields_found=fields_found
    )
