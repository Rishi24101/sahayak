"""
RAG Query Pipeline — Groq API (llama-3.3-70b-versatile)
Retrieves context from local FAQ + sends to Groq for Hindi answers
"""
from fastapi import APIRouter
from pydantic import BaseModel
import json
import os
import re

router = APIRouter()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = "llama-3.3-70b-versatile"
FAQ_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'faq_hindi.json')

# Load FAQ data
_faq_data = None

def get_faq():
    global _faq_data
    if _faq_data is None:
        with open(FAQ_PATH, 'r', encoding='utf-8') as f:
            _faq_data = json.load(f)['questions']
    return _faq_data

def faq_lookup(question: str) -> dict:
    """Fuzzy match against local FAQ for offline fallback"""
    faq = get_faq()
    question_lower = question.lower()
    
    best_match = None
    best_score = 0
    
    for entry in faq:
        score = 0
        for kw in entry.get('keywords', []):
            if kw.lower() in question_lower:
                score += 1
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

async def groq_generate(question: str, context: str) -> str:
    """Call Groq API with llama-3.3-70b for Hindi answer generation"""
    import httpx
    
    system_prompt = """तुम "सहायक" हो — CSC ऑपरेटरों के लिए एक AI सहायक। 
तुम्हें छत्तीसगढ़ की सरकारी योजनाओं के बारे में हिंदी में जवाब देना है।
नीचे दिए गए संदर्भ (context) का उपयोग करके प्रश्न का सटीक उत्तर दो।
अगर संदर्भ में उत्तर नहीं है, तो अपने ज्ञान से उत्तर दो।
उत्तर संक्षिप्त और स्पष्ट रखो। बुलेट पॉइंट्स का उपयोग करो।"""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"संदर्भ:\n{context}\n\nप्रश्न: {question}"}
    ]
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
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
                    "max_tokens": 500,
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                return data['choices'][0]['message']['content']
            else:
                print(f"Groq API error: {response.status_code} - {response.text}")
                return None
    except Exception as e:
        print(f"Groq API connection error: {e}")
        return None


class QueryRequest(BaseModel):
    question: str
    scheme_context: str = ""

class QueryResponse(BaseModel):
    answer: str
    source: str
    scheme: str  

@router.post("/query", response_model=QueryResponse)
async def query_chatbot(req: QueryRequest):
    """
    Hindi RAG chatbot — tries Groq API first, falls back to local FAQ
    """
    # Step 1: Get local FAQ context
    faq_result = faq_lookup(req.question)
    context = faq_result['answer']
    
    # Step 2: Try Groq API for a richer answer
    groq_answer = await groq_generate(req.question, context)
    
    if groq_answer:
        return QueryResponse(
            answer=groq_answer,
            source="Groq AI (llama-3.3-70b)",
            scheme=faq_result.get('scheme', 'general')
        )
    
    # Step 3: Fallback to local FAQ
    return QueryResponse(
        answer=faq_result['answer'],
        source=faq_result['source'],
        scheme=faq_result.get('scheme', 'general')
    )
