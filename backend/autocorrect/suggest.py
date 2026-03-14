"""
Auto-correct & Auto-fill Logic
Suggests corrections and fills form fields from OCR data
"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
import re

router = APIRouter()

# Common corrections for Hindi names
NAME_CORRECTIONS = {
    'kumr': 'kumar',
    'kumari': 'kumari',
    'shrama': 'sharma',
    'gupt': 'gupta',
    'sigh': 'singh',
    'signgh': 'singh',
    'prsad': 'prasad',
    'pradhan': 'pradhan',
    'verma': 'verma',
    'vishwakarma': 'vishwakarma',
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
        # Masked Aadhaar patterns (XXXX XXXX 3770 or XXXXXXXX3770)
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

def extract_name_from_aadhaar_text(text: str) -> Optional[str]:
    """Extract name from Aadhaar/DigiLocker OCR text"""
    lines = text.strip().split('\n')
    skip_words = ['government', 'india', 'aadhaar', 'unique', 'authority', 
                  'uid', 'digilocker', 'digital', 'locker', 'male', 'female',
                  'address', 'dob', 'date', 'birth', 'पता', 'जन्म', 'पुरुष', 'महिला',
                  'download', 'verify', 'uidai', 'vid', 'enrolment']
    
    for i, line in enumerate(lines):
        stripped = line.strip()
        if not stripped:
            continue
        
        # Skip lines that are metadata, dates, digits, or too short
        lower = stripped.lower()
        if any(sw in lower for sw in skip_words):
            continue
        if re.match(r'^[\d\s/\-.:Xx]+$', stripped):
            continue
        if len(stripped) < 3:
            continue
        # Skip lines starting with S/O, D/O, W/O (father/spouse lines)
        if re.match(r'^[SDW](/|\\)[O0]', stripped, re.IGNORECASE):
            continue
        # Skip address-like lines
        if re.search(r'(ward|block|district|state|pradesh|pin|gursarai|jhansi)', lower):
            continue
        
        # Clean OCR noise from the line and extract potential name
        # Remove common OCR artifacts like "i ]", "= AN", brackets, etc.
        cleaned = re.sub(r'^[^a-zA-Z\u0900-\u097F]*', '', stripped)  # Remove leading non-alpha
        cleaned = re.sub(r'[^a-zA-Z\u0900-\u097F\s]', '', cleaned)  # Keep only letters+spaces
        cleaned = cleaned.strip()
        
        # Valid name: 3-40 chars, mostly letters
        if len(cleaned) >= 3 and len(cleaned) <= 40:
            return cleaned.title()
    
    return None

def extract_dob_from_text(text: str) -> Optional[str]:
    """Extract Date of Birth from OCR text — handles multiple formats"""
    patterns = [
        # DD/MM/YYYY or DD-MM-YYYY
        (r'(\d{2})[/\-](\d{2})[/\-](\d{4})', 'dmy'),
        # YYYY-MM-DD (ISO format from DigiLocker)
        (r'(\d{4})[/\-](\d{2})[/\-](\d{2})', 'ymd'),
        # After DOB: or जन्म तिथि:
        (r'(?:DOB|dob|जन्म\s*तिथि|Date\s*of\s*Birth)\s*[:\-]?\s*(\d{2,4})[/\-](\d{2})[/\-](\d{2,4})', None),
    ]
    
    for pattern, fmt in patterns:
        match = re.search(pattern, text)
        if match:
            groups = match.groups()
            if fmt == 'ymd':
                year, month, day = groups[0], groups[1], groups[2]
                if int(year) > 1900:
                    return f"{day}/{month}/{year}"
            elif fmt == 'dmy':
                day, month, year = groups[0], groups[1], groups[2]
                if int(year) > 1900:
                    return f"{day}/{month}/{year}"
            else:
                return match.group(0)
    return None

def extract_gender_from_text(text: str) -> Optional[str]:
    """Extract gender from OCR text"""
    text_lower = text.lower()
    # Check for female first (contains 'male')
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
        # Start capture on address keyword or S/O, D/O, W/O lines
        if any(kw in lower for kw in ['address', 'पता', 'निवास']):
            capture = True
            # If address: is on the same line with content after it
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
        original=original,
        corrected=corrected,
        changed=corrected != original,
        suggestion=suggestion
    )


class AutofillRequest(BaseModel):
    ocr_text: str

class AutofillResponse(BaseModel):
    applicant_name: Optional[str] = None
    aadhaar_number: Optional[str] = None
    dob: Optional[str] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    fields_found: int = 0

@router.post("/autofill", response_model=AutofillResponse)
def autofill_from_ocr(req: AutofillRequest):
    """Extract form fields from OCR text"""
    text = req.ocr_text
    
    name = extract_name_from_aadhaar_text(text)
    aadhaar = extract_aadhaar_from_text(text)
    dob = extract_dob_from_text(text)
    gender = extract_gender_from_text(text)
    address = extract_address_from_text(text)
    
    fields_found = sum(1 for x in [name, aadhaar, dob, gender, address] if x)
    
    return AutofillResponse(
        applicant_name=name,
        aadhaar_number=aadhaar,
        dob=dob,
        gender=gender,
        address=address,
        fields_found=fields_found
    )
