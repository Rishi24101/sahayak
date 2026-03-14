"""
OCR — Vision Document Field Extraction
Primary: OpenRouter (qwen-2.5-vl or any vision model)
Fallback: Groq meta-llama/llama-4-scout-17b-16e-instruct (vision-capable, free)
Supports: JPG, PNG, WEBP images + PDF files (converted to images via PyMuPDF)
"""
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from typing import Optional
import httpx
import base64
import os
import json
import re
import io
from anyio import to_thread

router = APIRouter()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
OCR_MODEL_OPENROUTER = os.getenv("OCR_MODEL", "qwen/qwen-2.5-vl-7b-instruct")
# Groq vision model — llama-4-scout supports image inputs
GROQ_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions"
GROQ_BASE_URL = "https://api.groq.com/openai/v1/chat/completions"
MAX_IMAGE_SIZE = 1200


class OcrExtractResponse(BaseModel):
    applicant_name: Optional[str] = None
    father_name: Optional[str] = None
    aadhaar_number: Optional[str] = None
    dob: Optional[str] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    income: Optional[str] = None
    document_type: Optional[str] = None
    raw_text: str = ""
    fields_found: int = 0
    detected_service: Optional[str] = None
    ocr_engine: Optional[str] = None  # which engine was used


EXTRACTION_PROMPT = """You are an expert document reader for Indian government documents.

Extract ALL of the following fields from this document image. Return ONLY a valid JSON object with these exact keys:

- document_type: one of "aadhaar", "pan", "ration_card", "income_certificate", "caste_certificate", "domicile_certificate", "death_certificate", "bank_passbook", "school_tc", "other"
- applicant_name: ONLY the primary person's full name (NOT their father/mother/spouse name). Look for lines labeled "Name:", "नाम:", or ALL CAPS names near "AADHAAR" or document header. DO NOT pick up watermarks, logos, or header text like "TAY", "GOI", etc.
- father_name: father's/husband's name if visible. Look for "S/O", "D/O", "W/O", "पिता", "Father" labels.
- aadhaar_number: 12-digit Aadhaar number if visible (digits only, no spaces). Masked (XXXX XXXX 1234) → return visible digits only.
- dob: date of birth in DD/MM/YYYY format. Convert any format to DD/MM/YYYY.
- gender: "male" or "female"
- address: full address as written on the document
- income: annual income amount as a plain number (digits only) if this is an income certificate, otherwise null
- raw_text: ALL text visible on the document, line by line

IMPORTANT: For applicant_name — look specifically for text after "Name:" or "नाम:" labels. If you see "नाम Name: RAM PRASAD SAHU" then the name is "RAM PRASAD SAHU". Do not confuse header/logo/watermark text with the actual name.

If a field is not found or not applicable, use null.
Return ONLY the JSON object, no markdown code fences, no explanation."""


def convert_pdf_to_image(pdf_bytes: bytes) -> bytes:
    """Convert first page of PDF to JPEG image using PyMuPDF"""
    try:
        import fitz
        with fitz.open(stream=pdf_bytes, filetype="pdf") as doc:
            if len(doc) == 0:
                raise ValueError("Empty PDF file")
            page = doc[0]
            mat = fitz.Matrix(2.0, 2.0)
            pix = page.get_pixmap(matrix=mat)
            img_bytes = pix.tobytes("jpeg")
            return img_bytes
    except Exception as e:
        raise ValueError(f"PDF conversion error: {e}") from e


def resize_image_if_needed(img_bytes: bytes, max_side: int = MAX_IMAGE_SIZE) -> bytes:
    """Resize image if too large for the API, returns JPEG bytes"""
    try:
        from PIL import Image
        img = Image.open(io.BytesIO(img_bytes))
        w, h = img.size
        if w > max_side or h > max_side:
            ratio = min(max_side / w, max_side / h)
            img = img.resize((int(w * ratio), int(h * ratio)), Image.LANCZOS)
        if img.mode not in ('RGB', 'L'):
            img = img.convert('RGB')
        buf = io.BytesIO()
        img.save(buf, format='JPEG', quality=85)
        return buf.getvalue()
    except Exception as e:
        print(f"Image resize error: {e}")
        return img_bytes


def parse_ocr_json(content: str) -> dict:
    """Parse JSON from LLM response — strips markdown fences, handles partial JSON"""
    cleaned = re.sub(r"```json\s*", "", content)
    cleaned = re.sub(r"```\s*", "", cleaned)
    # Extract JSON object
    m = re.search(r'\{.*\}', cleaned, re.DOTALL)
    if m:
        cleaned = m.group(0)
    try:
        return json.loads(cleaned.strip())
    except json.JSONDecodeError:
        return {"raw_text": content}


def build_response_from_parsed(parsed: dict, engine: str) -> OcrExtractResponse:
    """Convert parsed LLM JSON dict into OcrExtractResponse"""
    DOCTYPE_SERVICE_MAP = {
        "ration_card": "ration_card",
        "income_certificate": "income_certificate",
        "caste_certificate": "caste_certificate",
        "domicile_certificate": "domicile_certificate",
    }
    doc_type = parsed.get("document_type")
    detected_service = DOCTYPE_SERVICE_MAP.get(doc_type) if doc_type else None

    raw_text = parsed.get("raw_text") or ""
    fields_found = sum(
        1 for k in ["applicant_name", "aadhaar_number", "dob", "gender", "address", "income", "father_name"]
        if parsed.get(k)
    )
    return OcrExtractResponse(
        applicant_name=parsed.get("applicant_name"),
        father_name=parsed.get("father_name"),
        aadhaar_number=parsed.get("aadhaar_number"),
        dob=parsed.get("dob"),
        gender=parsed.get("gender"),
        address=parsed.get("address"),
        income=str(parsed.get("income")) if parsed.get("income") else None,
        document_type=doc_type,
        raw_text=raw_text,
        fields_found=fields_found,
        detected_service=detected_service,
        ocr_engine=engine,
    )


async def call_openrouter_vision(b64_image: str, mime_type: str) -> OcrExtractResponse:
    """Call OpenRouter vision API"""
    async with httpx.AsyncClient(timeout=90.0) as client:
        response = await client.post(
            OPENROUTER_BASE_URL,
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://sahayak-csc.app",
                "X-Title": "Sahayak AI Co-Pilot",
            },
            json={
                "model": OCR_MODEL_OPENROUTER,
                "messages": [{
                    "role": "user",
                    "content": [
                        {"type": "text", "text": EXTRACTION_PROMPT},
                        {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{b64_image}"}},
                    ],
                }],
                "temperature": 0.1,
                "max_tokens": 1500,
            },
        )
        if response.status_code == 200:
            content = response.json()["choices"][0]["message"]["content"]
            parsed = parse_ocr_json(content)
            return build_response_from_parsed(parsed, "openrouter")
        raise ValueError(f"OpenRouter error {response.status_code}: {response.text[:200]}")


async def call_groq_vision(b64_image: str, mime_type: str) -> OcrExtractResponse:
    """Call Groq vision API (llama-4-scout) as fallback"""
    async with httpx.AsyncClient(timeout=90.0) as client:
        response = await client.post(
            GROQ_BASE_URL,
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": GROQ_VISION_MODEL,
                "messages": [{
                    "role": "user",
                    "content": [
                        {"type": "text", "text": EXTRACTION_PROMPT},
                        {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{b64_image}"}},
                    ],
                }],
                "temperature": 0.1,
                "max_tokens": 1500,
            },
        )
        if response.status_code == 200:
            content = response.json()["choices"][0]["message"]["content"]
            parsed = parse_ocr_json(content)
            return build_response_from_parsed(parsed, "groq-llama4-scout")
        raise ValueError(f"Groq vision error {response.status_code}: {response.text[:200]}")


@router.post("/ocr/extract", response_model=OcrExtractResponse)
async def extract_document_fields(image: UploadFile = File(...)):
    """
    Extract structured fields from a document image or PDF.
    Primary: OpenRouter vision (if OPENROUTER_API_KEY set)
    Fallback: Groq llama-4-scout vision (GROQ_API_KEY)
    """
    file_bytes = await image.read()
    content_type = image.content_type or ""
    filename = (image.filename or "").lower()
    is_pdf = "pdf" in content_type or filename.endswith(".pdf")

    if is_pdf:
        try:
            file_bytes = await to_thread.run_sync(convert_pdf_to_image, file_bytes)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e

    file_bytes = await to_thread.run_sync(resize_image_if_needed, file_bytes)
    b64_image = base64.b64encode(file_bytes).decode("utf-8")
    mime_type = "image/jpeg"

    errors = []

    # Try OpenRouter first
    if OPENROUTER_API_KEY:
        try:
            result = await call_openrouter_vision(b64_image, mime_type)
            print(f"[OCR] OpenRouter success: {result.fields_found} fields found")
            return result
        except Exception as e:
            print(f"[OCR] OpenRouter failed: {e}")
            errors.append(f"OpenRouter: {e}")

    # Fallback to Groq vision
    if GROQ_API_KEY:
        try:
            result = await call_groq_vision(b64_image, mime_type)
            print(f"[OCR] Groq vision success: {result.fields_found} fields found")
            return result
        except Exception as e:
            print(f"[OCR] Groq vision failed: {e}")
            errors.append(f"Groq: {e}")

    # Both failed
    raise HTTPException(
        status_code=503,
        detail=f"All OCR backends failed. Set OPENROUTER_API_KEY or GROQ_API_KEY. Errors: {'; '.join(errors)}"
    )
