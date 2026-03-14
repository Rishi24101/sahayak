"""
XGBoost Rejection Prediction Model
Trains on synthetic data, exposes /predict endpoint
"""
from fastapi import APIRouter
from pydantic import BaseModel
import pandas as pd
import numpy as np
import pickle
import os

router = APIRouter()

# --- Model Training ---
MODEL_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'xgboost_model.pkl')
DATA_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'csc_synthetic_data.csv')

_model = None
_feature_names = None

def get_model():
    global _model, _feature_names
    if _model is None:
        if os.path.exists(MODEL_PATH):
            try:
                with open(MODEL_PATH, 'rb') as f:
                    saved = pickle.load(f)
                    _model = saved['model']
                    _feature_names = saved['features']
            except Exception as e:
                print(f"⚠️ Could not load saved model ({e}), retraining...")
                _model, _feature_names = train_model()
        else:
            _model, _feature_names = train_model()
    return _model, _feature_names

def train_model():
    """Train XGBoost on synthetic data"""
    from sklearn.preprocessing import LabelEncoder
    
    # Generate data if not exists
    if not os.path.exists(DATA_PATH):
        from data.generate_synthetic import generate_synthetic_data
        generate_synthetic_data(output_path=DATA_PATH)
    
    df = pd.read_csv(DATA_PATH)
    
    # Encode service_type
    le = LabelEncoder()
    df['service_type_encoded'] = le.fit_transform(df['service_type'])
    
    feature_cols = [
        'service_type_encoded', 'age', 'income', 'family_size',
        'docs_missing', 'aadhaar_linked', 'bank_linked',
        'name_mismatch', 'father_name_mismatch',
        'prev_rejections', 'operator_exp_months'
    ]
    
    X = df[feature_cols]
    y = df['rejected']
    
    # Use sklearn's GradientBoosting as a fallback if xgboost isn't installed
    try:
        from xgboost import XGBClassifier
        model = XGBClassifier(
            n_estimators=100,
            max_depth=5,
            learning_rate=0.1,
            random_state=42,
            eval_metric='logloss'
        )
    except ImportError:
        from sklearn.ensemble import GradientBoostingClassifier
        model = GradientBoostingClassifier(
            n_estimators=100,
            max_depth=5,
            learning_rate=0.1,
            random_state=42
        )
    
    model.fit(X, y)
    
    # Save
    with open(MODEL_PATH, 'wb') as f:
        pickle.dump({
            'model': model,
            'features': feature_cols,
            'label_encoder': le,
            'service_types': list(le.classes_)
        }, f)
    
    # Print metrics
    from sklearn.metrics import classification_report
    y_pred = model.predict(X)
    print("📊 Model Training Report:")
    print(classification_report(y, y_pred))
    
    return model, feature_cols

# --- Service type mapping ---
SERVICE_TYPE_MAP = {
    'old_age_pension': 0,
    'widow_pension': 5,
    'ration_card': 4,
    'income_certificate': 3,
    'caste_certificate': 2,
    'ayushman': 1,
}

# --- API ---
class PredictRequest(BaseModel):
    service_type: str
    age: int
    income: int
    family_size: int = 4
    docs_missing: int = 0
    aadhaar_linked: int = 1
    bank_linked: int = 1
    name_mismatch: int = 0
    father_name_mismatch: int = 0
    prev_rejections: int = 0
    operator_exp_months: int = 12

class PredictResponse(BaseModel):
    probability: float
    risk: str
    risk_hindi: str
    top_factors: list

@router.post("/predict", response_model=PredictResponse)
def predict_rejection(req: PredictRequest):
    model, features = get_model()
    
    svc_encoded = SERVICE_TYPE_MAP.get(req.service_type, 0)
    
    input_data = np.array([[
        svc_encoded, req.age, req.income, req.family_size,
        req.docs_missing, req.aadhaar_linked, req.bank_linked,
        req.name_mismatch, req.father_name_mismatch,
        req.prev_rejections, req.operator_exp_months
    ]])
    
    prob = float(model.predict_proba(input_data)[0][1])
    
    if prob < 0.3:
        risk = "LOW"
        risk_hindi = "कम जोखिम ✅"
    elif prob < 0.6:
        risk = "MEDIUM"
        risk_hindi = "मध्यम जोखिम ⚠️"
    else:
        risk = "HIGH"
        risk_hindi = "उच्च जोखिम 🔴"
    
    # Identify top contributing factors
    factors = []
    if req.docs_missing > 0:
        factors.append(f"दस्तावेज गायब: {req.docs_missing}")
    if req.name_mismatch == 1:
        factors.append("नाम मेल नहीं खाता (आधार से)")
    if req.father_name_mismatch == 1:
        factors.append("पिता का नाम मेल नहीं खाता")
    if req.aadhaar_linked == 0:
        factors.append("आधार लिंक नहीं है")
    if req.bank_linked == 0:
        factors.append("बैंक खाता लिंक नहीं है")
    if req.service_type == 'old_age_pension' and req.age < 60:
        factors.append(f"आयु {req.age} वर्ष — पेंशन के लिए 60+ चाहिए")
    if req.service_type == 'old_age_pension' and req.income > 200000:
        factors.append(f"आय ₹{req.income:,} — सीमा ₹2,00,000")
    if req.service_type == 'ayushman' and req.income > 100000:
        factors.append(f"आय ₹{req.income:,} — आयुष्मान सीमा ₹1,00,000")
    
    return PredictResponse(
        probability=round(prob, 2),
        risk=risk,
        risk_hindi=risk_hindi,
        top_factors=factors if factors else ["कोई प्रमुख जोखिम कारक नहीं"]
    )
