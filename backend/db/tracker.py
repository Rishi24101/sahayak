"""
SQLite Rejection History Tracker + Dashboard Endpoint
"""
from fastapi import APIRouter
from pydantic import BaseModel
import sqlite3
import os
import json
from datetime import datetime

router = APIRouter()

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'sahayak.db')

def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Create tables if not exist"""
    conn = get_conn()
    conn.execute('''
        CREATE TABLE IF NOT EXISTS submissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            service_type TEXT NOT NULL,
            applicant_name TEXT,
            risk_level TEXT,
            probability REAL,
            errors TEXT,
            warnings TEXT,
            rejected INTEGER DEFAULT 0,
            submitted_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS rejection_reasons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            service_type TEXT NOT NULL,
            field_name TEXT NOT NULL,
            error_message TEXT,
            count INTEGER DEFAULT 1,
            last_seen TEXT DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()
    
    # Seed with some initial data for demo
    _seed_demo_data()

def _seed_demo_data():
    """Add demo rejection history data"""
    conn = get_conn()
    existing = conn.execute("SELECT COUNT(*) FROM submissions").fetchone()[0]
    if existing > 0:
        conn.close()
        return
    
    demo_data = [
        ('old_age_pension', 'राम प्रसाद', 'HIGH', 0.78, '["आयु 55 वर्ष — 60+ चाहिए"]', '[]', 1),
        ('old_age_pension', 'सीता देवी', 'LOW', 0.12, '[]', '[]', 0),
        ('caste_certificate', 'अमित कुमार', 'HIGH', 0.85, '["नाम मेल नहीं खाता"]', '["दस्तावेज गायब"]', 1),
        ('income_certificate', 'प्रिया शर्मा', 'MEDIUM', 0.45, '[]', '["दस्तावेज गायब: 1"]', 0),
        ('old_age_pension', 'गोपाल सिंह', 'LOW', 0.08, '[]', '[]', 0),
        ('ration_card', 'कमला बाई', 'HIGH', 0.72, '["आय सीमा से अधिक"]', '[]', 1),
        ('ayushman', 'रामलाल', 'MEDIUM', 0.55, '[]', '["आधार लिंक नहीं"]', 0),
        ('widow_pension', 'सुनीता देवी', 'LOW', 0.15, '[]', '[]', 0),
        ('caste_certificate', 'विकास', 'HIGH', 0.82, '["पिता का नाम मेल नहीं खाता"]', '[]', 1),
        ('old_age_pension', 'महेश', 'HIGH', 0.90, '["आय ₹2,50,000"]', '["बैंक लिंक नहीं"]', 1),
        ('income_certificate', 'अनिल', 'LOW', 0.10, '[]', '[]', 0),
        ('ration_card', 'मुकेश', 'LOW', 0.18, '[]', '[]', 0),
    ]
    
    for row in demo_data:
        conn.execute(
            "INSERT INTO submissions (service_type, applicant_name, risk_level, probability, errors, warnings, rejected) VALUES (?,?,?,?,?,?,?)",
            row
        )
    
    # Seed rejection reasons
    reasons = [
        ('old_age_pension', 'income', 'आय सीमा से अधिक', 42),
        ('old_age_pension', 'age', 'आयु 60 वर्ष से कम', 35),
        ('old_age_pension', 'name_mismatch', 'नाम आधार से मेल नहीं', 28),
        ('caste_certificate', 'name_mismatch', 'नाम दस्तावेजों से मेल नहीं', 31),
        ('caste_certificate', 'father_name_mismatch', 'पिता का नाम मेल नहीं', 22),
        ('caste_certificate', 'docs_missing', 'दस्तावेज अधूरे', 18),
        ('income_certificate', 'name_mismatch', 'नाम मेल नहीं', 15),
        ('income_certificate', 'docs_missing', 'दस्तावेज गायब', 12),
        ('ration_card', 'income', 'आय सीमा पार', 20),
        ('ration_card', 'aadhaar_linked', 'आधार लिंक नहीं', 14),
        ('ayushman', 'income', 'आय सीमा पार', 16),
        ('widow_pension', 'docs_missing', 'मृत्यु प्रमाण पत्र गायब', 10),
    ]
    
    for r in reasons:
        conn.execute(
            "INSERT INTO rejection_reasons (service_type, field_name, error_message, count) VALUES (?,?,?,?)",
            r
        )
    
    conn.commit()
    conn.close()


class SubmissionRecord(BaseModel):
    service_type: str
    applicant_name: str
    risk_level: str
    probability: float
    errors: list = []
    warnings: list = []
    rejected: int = 0

@router.post("/track")
def track_submission(record: SubmissionRecord):
    """Save a submission to history"""
    conn = get_conn()
    conn.execute(
        "INSERT INTO submissions (service_type, applicant_name, risk_level, probability, errors, warnings, rejected) VALUES (?,?,?,?,?,?,?)",
        (record.service_type, record.applicant_name, record.risk_level,
         record.probability, json.dumps(record.errors, ensure_ascii=False),
         json.dumps(record.warnings, ensure_ascii=False), record.rejected)
    )
    conn.commit()
    conn.close()
    return {"status": "tracked"}

@router.get("/dashboard")
def get_dashboard():
    """Get rejection statistics for dashboard"""
    conn = get_conn()
    
    # Total stats
    total = conn.execute("SELECT COUNT(*) FROM submissions").fetchone()[0]
    rejected = conn.execute("SELECT COUNT(*) FROM submissions WHERE rejected=1").fetchone()[0]
    high_risk = conn.execute("SELECT COUNT(*) FROM submissions WHERE risk_level='HIGH'").fetchone()[0]
    
    # Per-scheme stats
    scheme_stats = conn.execute("""
        SELECT service_type, 
               COUNT(*) as total, 
               SUM(rejected) as rejected,
               AVG(probability) as avg_risk
        FROM submissions 
        GROUP BY service_type
    """).fetchall()
    
    # Top rejection reasons
    top_reasons = conn.execute("""
        SELECT service_type, field_name, error_message, count 
        FROM rejection_reasons 
        ORDER BY count DESC 
        LIMIT 10
    """).fetchall()
    
    # Recent submissions
    recent = conn.execute("""
        SELECT * FROM submissions ORDER BY id DESC LIMIT 10
    """).fetchall()
    
    conn.close()
    
    return {
        "total_submissions": total,
        "total_rejected": rejected,
        "rejection_rate": round((rejected / max(total, 1)) * 100, 1),
        "high_risk_count": high_risk,
        "scheme_stats": [dict(r) for r in scheme_stats],
        "top_rejection_reasons": [dict(r) for r in top_reasons],
        "recent_submissions": [dict(r) for r in recent]
    }
