"""
XGBoost Rejection Prediction Model
Uses the real xgboost_rejection.pkl from timepass/sahayak (richer feature vector)
Falls back to rule-based prediction when offline/model missing
"""
from fastapi import APIRouter
from pydantic import BaseModel
import numpy as np
import pickle
import os
import re
from typing import List

router = APIRouter()

MODEL_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'xgboost_model.pkl')

_model = None


def get_model():
    global _model
    if _model is None:
        if os.path.exists(MODEL_PATH):
            try:
                with open(MODEL_PATH, 'rb') as f:
                    _model = pickle.load(f)
                print(f"✅ XGBoost model loaded from {MODEL_PATH}")
            except Exception as e:
                print(f"⚠️ Could not load XGBoost model ({e}), will use rule-based fallback")
                _model = None
    return _model


def _feature_vector_timepass(service_type: str, req: 'PredictRequest') -> List[float]:
    """Feature vector matching timepass/sahayak xgboost_rejection.pkl training format."""
    def has_abbrev(name: str) -> float:
        return 1.0 if re.search(r'\b[A-Za-z]\s*\.\s*', name) else 0.0

    # Service type one-hot (5 services)
    services = ['old_age_pension', 'caste_certificate', 'income_certificate',
                 'domicile_certificate', 'ration_card']
    svc_ohe = [1.0 if service_type == s else 0.0 for s in services]

    applicant_name = req.applicant_name or ''
    father_name = req.father_name or ''
    aadhaar = (req.aadhaar_number or '').replace(' ', '')
    address = req.address or ''

    features = svc_ohe + [
        float(len(applicant_name.strip())),       # strlen applicant_name
        float(len(father_name.strip())),           # strlen father_name
        has_abbrev(applicant_name),                # has_abbrev applicant_name
        has_abbrev(father_name),                   # has_abbrev father_name
        1.0 if len(aadhaar) == 12 else 0.0,        # valid aadhaar
        1.0 if len(req.mobile or '') == 10 else 0.0,  # valid mobile
        1.0 if req.pincode and len(req.pincode) == 6 else 0.0,  # valid pincode
        float(req.income or 0) / 100000.0,         # income normalised
        float(req.family_size or 4),               # family_members
        float(len(address.strip())),               # strlen address
        1.0 if req.bank_account else 0.0,          # has bank account
        1.0 if req.ifsc else 0.0,                  # has IFSC
    ]
    return features


def _rule_based_predict(service_type: str, req: 'PredictRequest'):
    """Smart rule-based fallback — works fully offline."""
    score = 0.0
    factors = []

    name = req.applicant_name or ''
    if re.search(r'\b[A-Za-z]\s*\.\s*', name):
        score += 0.25
        factors.append('आवेदक के नाम में संक्षिप्त रूप है')

    father = req.father_name or ''
    if re.search(r'\b[A-Za-z]\s*\.\s*', father):
        score += 0.2
        factors.append('पिता के नाम में संक्षिप्त रूप है')

    aadhaar = (req.aadhaar_number or '').replace(' ', '')
    if aadhaar and len(aadhaar) != 12:
        score += 0.3
        factors.append('आधार संख्या गलत है (12 अंक चाहिए)')
    elif not aadhaar:
        score += 0.2
        factors.append('आधार संख्या नहीं दी गई')

    address = req.address or ''
    if len(address.strip()) < 15:
        score += 0.15
        factors.append('पता अधूरा है')

    income = float(req.income or 0)
    if service_type == 'old_age_pension':
        if income > 200000:
            score += 0.4
            factors.append(f'वार्षिक आय ₹{income:,.0f} — सीमा ₹2,00,000')
        if req.age and req.age < 60:
            score += 0.5
            factors.append(f'आयु {req.age} वर्ष — 60+ चाहिए')
    elif service_type == 'ayushman' and income > 100000:
        score += 0.4
        factors.append(f'वार्षिक आय ₹{income:,.0f} — आयुष्मान सीमा ₹1,00,000')

    if req.docs_missing and req.docs_missing > 0:
        score += 0.15 * req.docs_missing
        factors.append(f'{req.docs_missing} दस्तावेज़ गायब हैं')
    if req.name_mismatch:
        score += 0.2
        factors.append('नाम आधार से मेल नहीं खाता')
    if not req.bank_account:
        score += 0.1
        factors.append('बैंक खाता नंबर नहीं दिया गया')

    return min(score, 0.99), factors


class PredictRequest(BaseModel):
    service_type: str
    age: int = 0
    income: int = 0
    family_size: int = 4
    docs_missing: int = 0
    aadhaar_linked: int = 1
    bank_linked: int = 1
    name_mismatch: int = 0
    father_name_mismatch: int = 0
    prev_rejections: int = 0
    operator_exp_months: int = 12
    # Extra rich fields for timepass feature vector
    applicant_name: str = ''
    father_name: str = ''
    aadhaar_number: str = ''
    mobile: str = ''
    address: str = ''
    pincode: str = ''
    bank_account: str = ''
    ifsc: str = ''


class PredictResponse(BaseModel):
    probability: float
    risk: str
    risk_hindi: str
    top_factors: list
    model_used: str = 'rule_based'


@router.post("/predict", response_model=PredictResponse)
def predict_rejection(req: PredictRequest):
    model = get_model()
    model_used = 'rule_based'

    if model is not None:
        try:
            fv = _feature_vector_timepass(req.service_type, req)
            features = np.array([fv])
            prob = float(model.predict_proba(features)[0][1])
            factors = []
            model_used = 'xgboost_pkl'
            # Add human readable factors even when using XGBoost
            if req.docs_missing > 0:
                factors.append(f'{req.docs_missing} दस्तावेज़ गायब हैं')
            if req.name_mismatch:
                factors.append('नाम आधार से मेल नहीं खाता')
            if req.father_name_mismatch:
                factors.append('पिता का नाम मेल नहीं खाता')
            name = req.applicant_name or ''
            if re.search(r'\b[A-Za-z]\s*\.\s*', name):
                factors.append('नाम में संक्षिप्त रूप — अस्वीकृति का कारण बन सकता है')
            if req.service_type == 'old_age_pension' and req.age < 60 and req.age > 0:
                factors.append(f'आयु {req.age} वर ष — 60+ चाहिए')
            income = float(req.income or 0)
            if req.service_type == 'old_age_pension' and income > 200000:
                factors.append(f'आय ₹{income:,.0f} — सीमा ₹2,00,000')
        except Exception as e:
            print(f"XGBoost prediction error: {e}, falling back to rules")
            prob, factors = _rule_based_predict(req.service_type, req)
    else:
        prob, factors = _rule_based_predict(req.service_type, req)

    # Risk levels
    if prob >= 0.6:
        risk, risk_hindi = 'HIGH', 'उच्च जोखिम 🔴'
    elif prob >= 0.3:
        risk, risk_hindi = 'MEDIUM', 'मध्यम जोखिम ⚠️'
    else:
        risk, risk_hindi = 'LOW', 'कम जोखिम ✅'

    if not factors:
        if risk == 'HIGH':
            factors = ['उच्च अस्वीकृति जोखिम — सभी फ़ील्ड जाँचें']
        elif risk == 'MEDIUM':
            factors = ['कुछ सुधार आवश्यक हो सकते हैं']
        else:
            factors = ['आवेदन अच्छी तरह भरा है ✅']

    return PredictResponse(
        probability=round(prob, 2),
        risk=risk,
        risk_hindi=risk_hindi,
        top_factors=factors[:4],
        model_used=model_used,
    )
