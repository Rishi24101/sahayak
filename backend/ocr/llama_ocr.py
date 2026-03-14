"""
OpenRouter Vision OCR
Uses qwen/qwen-2.5-vl-7b-instruct via OpenRouter for document field extraction
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
OCR_MODEL = os.getenv("OCR_MODEL", "qwen/qwen-2.5-vl-7b-instruct")
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions"
MAX_IMAGE_SIZE = 1200  # Max pixels on any side


class OcrExtractResponse(BaseModel):
    applicant_name: Optional[str] = None
    aadhaar_number: Optional[str] = None
    dob: Optional[str] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    raw_text: str = ""
    fields_found: int = 0


EXTRACTION_PROMPT = """You are an expert document reader for Indian government documents (Aadhaar card, PAN card, Ration card, Income certificate, Caste certificate, etc.).

Extract the following fields from this document image. Return ONLY a valid JSON object with these keys:
- applicant_name: full name of the person (not father/mother/spouse name)
- aadhaar_number: 12-digit Aadhaar number if visible (digits only, no spaces). If masked (like XXXX XXXX 1234), return the visible digits.
- dob: date of birth in DD/MM/YYYY format. Convert from any format (YYYY-MM-DD etc.) to DD/MM/YYYY.
- gender: "male" or "female"
- address: full address as written on the document
- raw_text: ALL text visible on the document, line by line

If a field is not found or not applicable for this document type, use null for that field.
Return ONLY the JSON object, no markdown code fences, no explanation."""


def convert_pdf_to_image(pdf_bytes: bytes) -> bytes:
    """Convert first page of PDF to JPEG image using PyMuPDF"""
    try:
        import fitz  # PyMuPDF
        with fitz.open(stream=pdf_bytes, filetype="pdf") as doc:
            if len(doc) == 0:
                raise ValueError("Empty PDF file")
            page = doc[0]  # First page
            # Render at 2x resolution for better OCR
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
        
        # Only resize if larger than max
        if w > max_side or h > max_side:
            ratio = min(max_side / w, max_side / h)
            new_w, new_h = int(w * ratio), int(h * ratio)
            img = img.resize((new_w, new_h), Image.LANCZOS)
        
        # Convert to RGB if needed (handles RGBA, palette mode, etc.)
        if img.mode not in ('RGB', 'L'):
            img = img.convert('RGB')
        
        buf = io.BytesIO()
        img.save(buf, format='JPEG', quality=85)
        return buf.getvalue()
    except Exception as e:
        print(f"Image resize error: {e}")
        return img_bytes  # Return original if resize fails


@router.post("/ocr/extract", response_model=OcrExtractResponse)
async def extract_document_fields(image: UploadFile = File(...)):
    """
    Extract structured fields from a document image or PDF using Llama Scout vision.
    """
    if not OPENROUTER_API_KEY:
        raise HTTPException(status_code=503, detail="OPENROUTER_API_KEY is missing on the server")

    file_bytes = await image.read()
    content_type = image.content_type or ""
    filename = (image.filename or "").lower()
    
    is_pdf = "pdf" in content_type or filename.endswith(".pdf")
    
    # Convert PDF to image
    if is_pdf:
        try:
            file_bytes = await to_thread.run_sync(convert_pdf_to_image, file_bytes)
            content_type = "image/jpeg"
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e

    # Resize large images
    file_bytes = await to_thread.run_sync(resize_image_if_needed, file_bytes)
    
    # Encode to base64
    b64_image = base64.b64encode(file_bytes).decode("utf-8")
    mime_type = "image/jpeg"  # Always JPEG after processing

    try:
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
                    "model": OCR_MODEL,
                    "messages": [
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": EXTRACTION_PROMPT},
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": f"data:{mime_type};base64,{b64_image}"
                                    },
                                },
                            ],
                        }
                    ],
                    "temperature": 0.1,
                    "max_tokens": 1500,
                },
            )

            if response.status_code == 200:
                data = response.json()
                content = data["choices"][0]["message"]["content"]
                # Parse JSON from the response
                try:
                    # Strip markdown code fences if present
                    cleaned = re.sub(r"```json\s*", "", content)
                    cleaned = re.sub(r"```\s*", "", cleaned)
                    parsed = json.loads(cleaned.strip())
                except json.JSONDecodeError:
                    parsed = {"raw_text": content}

                raw_text_value = parsed.get("raw_text")
                if not raw_text_value:
                    raw_text_value = content if isinstance(content, str) else json.dumps(parsed, ensure_ascii=False)

                fields_found = sum(
                    1
                    for k in ["applicant_name", "aadhaar_number", "dob", "gender", "address"]
                    if parsed.get(k)
                )

                return OcrExtractResponse(
                    applicant_name=parsed.get("applicant_name"),
                    aadhaar_number=parsed.get("aadhaar_number"),
                    dob=parsed.get("dob"),
                    gender=parsed.get("gender"),
                    address=parsed.get("address"),
                    raw_text=raw_text_value,
                    fields_found=fields_found,
                )
            else:
                error_text = response.text
                print(f"OpenRouter OCR API error: {response.status_code} - {error_text}")
                raise HTTPException(status_code=502, detail=f"OpenRouter API Error {response.status_code}: {error_text[:200]}")
    except httpx.HTTPError as e:
        print(f"OpenRouter OCR connection error: {e}")
        raise HTTPException(status_code=502, detail=f"OpenRouter connection error: {str(e)}") from e
    except HTTPException:
        raise
    except Exception as e:
        print(f"Unexpected OCR error: {e}")
        raise HTTPException(status_code=500, detail=f"Unexpected OCR error: {str(e)}") from e
