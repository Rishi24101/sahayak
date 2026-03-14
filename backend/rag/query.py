"""
RAG Query Pipeline — Groq API (llama-3.3-70b-versatile)
Retrieves context from local FAQ + sends to Groq for Hindi answers
AGENTIC MODE: Detects form-fill intents and returns action objects the frontend can execute
"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, Any, Dict, List
import json
import os
import re

router = APIRouter()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = "llama-3.3-70b-versatile"
FAQ_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'faq_hindi.json')

_faq_data = None

def get_faq():
    global _faq_data
    if _faq_data is None:
        try:
            with open(FAQ_PATH, 'r', encoding='utf-8') as f:
                _faq_data = json.load(f)['questions']
        except Exception:
            _faq_data = []
    return _faq_data

def faq_lookup(question: str) -> dict:
    """Fuzzy match against local FAQ for offline fallback"""
    faq = get_faq()
    question_lower = question.lower()
    best_match = None
    best_score = 0
    for entry in faq:
        score = sum(1 for kw in entry.get('keywords', []) if kw.lower() in question_lower)
        if score > best_score:
            best_score = score
            best_match = entry
    if best_match and best_score > 0:
        return {
            'answer': best_match['a'],
            'source': 'ऑफलाइन FAQ',
            'scheme': best_match.get('scheme', 'general'),
            'confidence': min(best_score / 3.0, 1.0)
        }
    return {
        'answer': 'इस प्रश्न का उत्तर उपलब्ध नहीं है। कृपया अपना प्रश्न दोबारा लिखें या CSC हेल्पलाइन 1800-233-7887 पर कॉल करें।',
        'source': 'default',
        'scheme': 'unknown',
        'confidence': 0.0
    }


AGENTIC_SYSTEM_PROMPT = """तुम "सहायक" हो — CSC ऑपरेटरों के लिए एक AGENTIC AI सहायक।
तुम्हें छत्तीसगढ़ की सरकारी योजनाओं के बारे में हिंदी में जवाब देना है।

## तुम्हारी शक्तियाँ (Agentic Capabilities):
तुम सीधे फॉर्म में डेटा भर सकते हो! ऑपरेटर कहे तो:
- "आधार नंबर 741258369021 भर दो" 
- "नाम राम प्रसाद साहू करो / set karo"
- "आय 36000 भरो / income fill karo"
- "DOB 15/08/1958 set करो"
- "पूरा फॉर्म भरो / fill the form / autofill karo / sab fill karo"
- "OCR se bharo / aadhaar se data lo"

तो **ALWAYS** [FORM_ACTION] JSON block शामिल करो:

[FORM_ACTION]
{"actions": [{"field": "field_name", "value": "value", "label": "हिंदी में खेत का नाम"}]}
[/FORM_ACTION]

Valid field names: applicant_name, father_name, aadhaar_number, dob, gender, mobile, address, annual_income, bank_account, ifsc, family_size

## IMPORTANT: अगर ऑपरेटर "पूरा फॉर्म भरो" या "fill all" या "autofill" कहे:
तब OCR data से सभी available fields एक साथ भरो।

## Current Form State:
{form_context_block}

## नियम:
- उत्तर हिंदी में, संक्षिप्त और स्पष्ट
- Errors/warnings हों तो सुधारने में मदद करो
- जब field fill हो, confirm करो कि "✅ {field} फॉर्म में भर दिया"
- बुलेट points use करो list के लिए"""


async def groq_generate(question: str, context: str, form_context: dict | None = None) -> str | None:
    """Call Groq API with llama-3.3-70b for Hindi answer generation"""
    import httpx

    # Build rich form context block
    fc_lines = []
    if form_context:
        if form_context.get('service_name'):
            fc_lines.append(f"सेवा: {form_context['service_name']}")
        if form_context.get('errors'):
            fc_lines.append(f"त्रुटियाँ: {', '.join(form_context['errors'])}")
        if form_context.get('missing_docs'):
            fc_lines.append(f"गायब दस्तावेज़: {', '.join(form_context['missing_docs'])}")

        # Include OCR-extracted data for the chatbot to use in fill commands
        if form_context.get('ocr_data'):
            ocr = {k: v for k, v in form_context['ocr_data'].items() if v}
            if ocr:
                fc_lines.append(f"📄 OCR से निकाला डेटा: {json.dumps(ocr, ensure_ascii=False)}")

        # Include current form state
        if form_context.get('form_data'):
            data = form_context['form_data']
            filled = {k: v for k, v in data.items() if v and str(v).strip()}
            empty = [k for k, v in data.items() if not v or not str(v).strip()]
            if filled:
                fc_lines.append(f"✅ भरे गए खेत: {json.dumps(filled, ensure_ascii=False)}")
            if empty:
                fc_lines.append(f"❌ खाली खेत: {', '.join(empty[:8])}")

    form_ctx = '\n'.join(fc_lines) if fc_lines else 'कोई फॉर्म संदर्भ नहीं।'
    system = AGENTIC_SYSTEM_PROMPT.replace('{form_context_block}', form_ctx)

    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": f"संदर्भ:\n{context}\n\nप्रश्न/निर्देश: {question}"}
    ]

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": GROQ_MODEL,
                    "messages": messages,
                    "temperature": 0.3,
                    "max_tokens": 700,
                }
            )
            if response.status_code == 200:
                return response.json()['choices'][0]['message']['content']
            else:
                print(f"Groq API error: {response.status_code} - {response.text}")
                return None
    except Exception as e:
        print(f"Groq API error: {e}")
        return None



def extract_form_actions(answer: str) -> list:
    """Extract [FORM_ACTION] JSON blocks from the LLM answer"""
    m = re.search(r'\[FORM_ACTION\]\s*(.*?)\s*\[/FORM_ACTION\]', answer, re.DOTALL)
    if m:
        try:
            data = json.loads(m.group(1))
            return data.get('actions', [])
        except Exception:
            pass
    return []


def clean_answer_text(answer: str) -> str:
    """Remove [FORM_ACTION] blocks from the display text"""
    return re.sub(r'\[FORM_ACTION\].*?\[/FORM_ACTION\]', '', answer, flags=re.DOTALL).strip()


class QueryRequest(BaseModel):
    question: str
    scheme_context: str = ""
    form_context: Optional[Dict[str, Any]] = None


class FormAction(BaseModel):
    field: str
    value: str
    label: Optional[str] = None


class QueryResponse(BaseModel):
    answer: str
    source: str
    scheme: str
    form_actions: List[FormAction] = []  # Agentic: fields to fill in the form


@router.post("/query", response_model=QueryResponse)
async def query_chatbot(req: QueryRequest):
    """
    Hindi RAG chatbot with AGENTIC form-fill support.
    Tries Groq API first, falls back to local FAQ.
    Returns form_actions when operator asks to fill a field.
    """
    faq_result = faq_lookup(req.question)
    context = faq_result['answer']

    groq_answer = await groq_generate(req.question, context, req.form_context)

    if groq_answer:
        actions = extract_form_actions(groq_answer)
        clean_text = clean_answer_text(groq_answer)
        return QueryResponse(
            answer=clean_text,
            source="Groq AI (llama-3.3-70b) 🤖",
            scheme=faq_result.get('scheme', 'general'),
            form_actions=[FormAction(**a) for a in actions]
        )

    return QueryResponse(
        answer=faq_result['answer'],
        source=faq_result['source'],
        scheme=faq_result.get('scheme', 'general'),
        form_actions=[]
    )
