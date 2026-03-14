"""
Synthetic Data Generator for XGBoost Training
Generates 2000 rows of realistic CSC application data
"""
import pandas as pd
import numpy as np
import random
import os

def generate_synthetic_data(n=2000, output_path=None):
    np.random.seed(42)
    
    if output_path is None:
        output_path = os.path.join(os.path.dirname(__file__), 'csc_synthetic_data.csv')
    
    service_types = [
        'old_age_pension', 'widow_pension', 'ration_card',
        'income_certificate', 'caste_certificate', 'ayushman'
    ]
    
    # Real CG government eligibility rules
    rejection_rules = {
        'old_age_pension': lambda r: (
            r['age'] < 60 or 
            r['income'] > 200000 or 
            r['docs_missing'] > 0 or 
            r['aadhaar_linked'] == 0
        ),
        'widow_pension': lambda r: (
            r['age'] < 18 or 
            r['income'] > 80000 or 
            r['docs_missing'] > 1
        ),
        'ration_card': lambda r: (
            r['income'] > 150000 or 
            r['docs_missing'] > 1 or 
            r['aadhaar_linked'] == 0
        ),
        'income_certificate': lambda r: (
            r['docs_missing'] > 1 or 
            r['name_mismatch'] == 1
        ),
        'caste_certificate': lambda r: (
            r['docs_missing'] > 0 or 
            r['name_mismatch'] == 1 or
            r['father_name_mismatch'] == 1
        ),
        'ayushman': lambda r: (
            r['income'] > 100000 or 
            r['family_size'] < 1 or 
            r['aadhaar_linked'] == 0
        ),
    }
    
    rows = []
    for _ in range(n):
        svc = random.choice(service_types)
        row = {
            'service_type': svc,
            'age': random.randint(18, 85),
            'income': random.randint(15000, 300000),
            'family_size': random.randint(1, 10),
            'docs_missing': random.choices([0, 1, 2, 3], weights=[50, 30, 15, 5])[0],
            'aadhaar_linked': random.choices([0, 1], weights=[20, 80])[0],
            'bank_linked': random.choices([0, 1], weights=[15, 85])[0],
            'name_mismatch': random.choices([0, 1], weights=[85, 15])[0],
            'father_name_mismatch': random.choices([0, 1], weights=[90, 10])[0],
            'prev_rejections': random.choices([0, 1, 2, 3], weights=[40, 30, 20, 10])[0],
            'operator_exp_months': random.randint(1, 60),
        }
        
        # Apply rules, add some noise (5% random flip)
        base_rejection = int(rejection_rules[svc](row))
        if random.random() < 0.05:
            base_rejection = 1 - base_rejection
        row['rejected'] = base_rejection
        rows.append(row)
    
    df = pd.DataFrame(rows)
    df.to_csv(output_path, index=False)
    print(f"✅ Generated {n} records → {output_path}")
    print(f"   Rejection rate: {df['rejected'].mean():.1%}")
    return df

if __name__ == "__main__":
    generate_synthetic_data()
