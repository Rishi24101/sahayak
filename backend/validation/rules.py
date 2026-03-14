"""
Form Validation Rules Engine
Hindi error messages for top 6 CG government schemes
"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

# --- Scheme-specific eligibility rules ---
SCHEME_RULES = {
    'old_age_pension': {
        'name': 'वृद्धावस्था पेंशन (IGNOAPS)',
        'required_docs': ['aadhaar', 'age_proof', 'income_proof', 'bank_passbook', 'domicile', 'photo', 'bpl_card'],
        'rules': [
            {'field': 'age', 'check': 'min', 'value': 60, 'error': 'आयु 60 वर्ष से कम है। वृद्धावस्था पेंशन के लिए आयु 60 वर्ष या अधिक होनी चाहिए।'},
            {'field': 'income', 'check': 'max', 'value': 200000, 'error': 'वार्षिक आय ₹2,00,000 से अधिक है। पात्रता सीमा ₹2,00,000 है।'},
            {'field': 'aadhaar_linked', 'check': 'equals', 'value': 1, 'error': 'आधार कार्ड लिंक नहीं है। पेंशन DBT के लिए आधार लिंक अनिवार्य है।'},
            {'field': 'bank_linked', 'check': 'equals', 'value': 1, 'error': 'बैंक खाता लिंक नहीं है। पेंशन राशि बैंक में आती है।'},
        ]
    },
    'widow_pension': {
        'name': 'विधवा पेंशन (IGNWPS)',
        'required_docs': ['aadhaar', 'death_certificate', 'age_proof', 'income_proof', 'bank_passbook', 'domicile', 'photo'],
        'rules': [
            {'field': 'age', 'check': 'min', 'value': 40, 'error': 'आयु 40 वर्ष से कम है। विधवा पेंशन के लिए 40+ आयु चाहिए।'},
            {'field': 'income', 'check': 'max', 'value': 80000, 'error': 'वार्षिक आय ₹80,000 से अधिक है। विधवा पेंशन सीमा ₹80,000 है।'},
        ]
    },
    'ration_card': {
        'name': 'राशन कार्ड (NFSA)',
        'required_docs': ['aadhaar_all_members', 'domicile', 'income_proof', 'family_photo', 'bank_passbook'],
        'rules': [
            {'field': 'income', 'check': 'max', 'value': 150000, 'error': 'वार्षिक आय ₹1,50,000 से अधिक है। BPL राशन कार्ड सीमा पार।'},
            {'field': 'aadhaar_linked', 'check': 'equals', 'value': 1, 'error': 'आधार लिंक नहीं है। राशन कार्ड के लिए आधार अनिवार्य है।'},
        ]
    },
    'income_certificate': {
        'name': 'आय प्रमाण पत्र',
        'required_docs': ['aadhaar', 'ration_card', 'self_declaration', 'domicile'],
        'rules': [
            {'field': 'name_mismatch', 'check': 'equals', 'value': 0, 'error': 'नाम आधार कार्ड से मेल नहीं खाता। कृपया सही नाम दर्ज करें।'},
        ]
    },
    'caste_certificate': {
        'name': 'जाति प्रमाण पत्र (SC/ST/OBC)',
        'required_docs': ['aadhaar', 'domicile', 'ration_card', 'father_caste_cert', 'school_tc', 'affidavit', 'patwari_report'],
        'rules': [
            {'field': 'name_mismatch', 'check': 'equals', 'value': 0, 'error': 'नाम दस्तावेजों से मेल नहीं खाता। जाति प्रमाण पत्र में नाम सटीक होना चाहिए।'},
            {'field': 'father_name_mismatch', 'check': 'equals', 'value': 0, 'error': 'पिता का नाम स्कूल/पटवारी रिपोर्ट से मेल नहीं खाता।'},
        ]
    },
    'ayushman': {
        'name': 'आयुष्मान भारत (PM-JAY)',
        'required_docs': ['aadhaar_all_members', 'ration_card', 'mobile'],
        'rules': [
            {'field': 'income', 'check': 'max', 'value': 100000, 'error': 'वार्षिक आय ₹1,00,000 से अधिक है। आयुष्मान भारत पात्रता सीमा पार।'},
            {'field': 'aadhaar_linked', 'check': 'equals', 'value': 1, 'error': 'आधार लिंक नहीं है। आयुष्मान कार्ड के लिए आधार अनिवार्य है।'},
        ]
    }
}

DOCUMENT_NAMES_HINDI = {
    'aadhaar': 'आधार कार्ड',
    'aadhaar_all_members': 'सभी सदस्यों का आधार कार्ड',
    'age_proof': 'आयु प्रमाण पत्र',
    'income_proof': 'आय प्रमाण पत्र',
    'bank_passbook': 'बैंक पासबुक',
    'domicile': 'मूल निवास प्रमाण पत्र',
    'photo': 'पासपोर्ट साइज़ फोटो',
    'bpl_card': 'BPL राशन कार्ड',
    'death_certificate': 'पति का मृत्यु प्रमाण पत्र',
    'family_photo': 'परिवार का फोटो',
    'ration_card': 'राशन कार्ड',
    'self_declaration': 'स्व-घोषणा पत्र',
    'father_caste_cert': 'पिता/दादा का जाति प्रमाण पत्र',
    'school_tc': 'स्कूल TC / प्रमाण पत्र',
    'affidavit': 'शपथ पत्र (Affidavit)',
    'patwari_report': 'पटवारी रिपोर्ट',
    'mobile': 'मोबाइल नंबर',
}


class ValidateRequest(BaseModel):
    service_type: str
    applicant_name: str = ""
    father_name: str = ""
    age: int = 0
    income: int = 0
    family_size: int = 1
    aadhaar_number: str = ""
    aadhaar_linked: int = 1
    bank_linked: int = 1
    name_mismatch: int = 0
    father_name_mismatch: int = 0
    docs_submitted: list = []

class ValidationError(BaseModel):
    field: str
    message: str
    severity: str  # 'error' or 'warning'

class ValidateResponse(BaseModel):
    valid: bool
    errors: list[ValidationError]
    warnings: list[ValidationError]
    required_docs: list[str]
    missing_docs: list[str]

@router.post("/validate", response_model=ValidateResponse)
def validate_form(req: ValidateRequest):
    scheme = SCHEME_RULES.get(req.service_type)
    if not scheme:
        return ValidateResponse(
            valid=False,
            errors=[ValidationError(field="service_type", message="अज्ञात सेवा प्रकार", severity="error")],
            warnings=[],
            required_docs=[],
            missing_docs=[]
        )
    
    errors = []
    warnings = []
    
    # Check eligibility rules
    for rule in scheme['rules']:
        field_val = getattr(req, rule['field'], None)
        if field_val is None:
            continue
            
        failed = False
        if rule['check'] == 'min' and field_val < rule['value']:
            failed = True
        elif rule['check'] == 'max' and field_val > rule['value']:
            failed = True
        elif rule['check'] == 'equals' and field_val != rule['value']:
            failed = True
        
        if failed:
            errors.append(ValidationError(
                field=rule['field'],
                message=rule['error'],
                severity='error'
            ))
    
    # Check Aadhaar format
    if req.aadhaar_number and len(req.aadhaar_number) != 12:
        errors.append(ValidationError(
            field='aadhaar_number',
            message=f'आधार नंबर 12 अंकों का होना चाहिए। वर्तमान: {len(req.aadhaar_number)} अंक।',
            severity='error'
        ))
    
    if not req.aadhaar_number.isdigit() and req.aadhaar_number:
        errors.append(ValidationError(
            field='aadhaar_number',
            message='आधार नंबर में केवल अंक होने चाहिए।',
            severity='error'
        ))
    
    # Check name
    if req.applicant_name and len(req.applicant_name.strip()) < 3:
        warnings.append(ValidationError(
            field='applicant_name',
            message='नाम बहुत छोटा है। कृपया पूरा नाम दर्ज करें (आधार अनुसार)।',
            severity='warning'
        ))
    
    # Check missing documents
    required = scheme['required_docs']
    required_hindi = [DOCUMENT_NAMES_HINDI.get(d, d) for d in required]
    missing = [DOCUMENT_NAMES_HINDI.get(d, d) for d in required if d not in req.docs_submitted]
    
    if missing:
        warnings.append(ValidationError(
            field='docs_submitted',
            message=f'ये दस्तावेज गायब हैं: {", ".join(missing)}',
            severity='warning'
        ))
    
    return ValidateResponse(
        valid=len(errors) == 0,
        errors=errors,
        warnings=warnings,
        required_docs=required_hindi,
        missing_docs=missing
    )
