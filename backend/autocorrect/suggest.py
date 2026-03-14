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
    # Pattern: 4 digits, space/separator, 4 digits, space/separator, 4 digits
    patterns = [
        r'(\d{4}\s?\d{4}\s?\d{4})',
        r'(\d{12})',
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return re.sub(r'\s', '', match.group(1))
    return None

def extract_name_from_aadhaar_text(text: str) -> Optional[str]:
    """Extract name from Aadhaar OCR text"""
    lines = text.strip().split('\n')
    for i, line in enumerate(lines):
        # Name usually appears after "Government of India" or before DOB
        if any(kw in line.lower() for kw in ['name', 'नाम']):
            # Next non-empty line is likely the name
            if i + 1 < len(lines) and lines[i + 1].strip():
                return lines[i + 1].strip()
        # Try to detect Hindi/English name patterns
        if re.match(r'^[A-Za-z\s]{5,40}$', line.strip()):
            if not any(skip in line.lower() for skip in ['government', 'india', 'aadhaar', 'unique', 'authority', 'uid']):
                return line.strip()
    return None

def extract_dob_from_text(text: str) -> Optional[str]:
    """Extract Date of Birth from OCR text"""
    patterns = [
        r'(\d{2}/\d{2}/\d{4})',
        r'(\d{2}-\d{2}-\d{4})',
        r'DOB\s*[:\-]?\s*(\d{2}/\d{2}/\d{4})',
        r'जन्म\s*तिथि\s*[:\-]?\s*(\d{2}/\d{2}/\d{4})',
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(1) if match.lastindex and match.lastindex > 0 else match.group(0)
    return None

def extract_gender_from_text(text: str) -> Optional[str]:
    """Extract gender from OCR text"""
    text_lower = text.lower()
    if 'male' in text_lower or 'पुरुष' in text:
        if 'female' in text_lower or 'महिला' in text:
            return 'female'
        return 'male'
    if 'female' in text_lower or 'महिला' in text:
        return 'female'
    return None

def extract_address_from_text(text: str) -> Optional[str]:
    """Extract address from OCR text"""
    lines = text.strip().split('\n')
    address_lines = []
    capture = False
    for line in lines:
        if any(kw in line.lower() for kw in ['address', 'पता', 'निवास']):
            capture = True
            continue
        if capture and line.strip():
            address_lines.append(line.strip())
            if len(address_lines) >= 3:
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
