"""
Groq Llama Scout Vision OCR
Uses meta-llama/llama-4-scout-17b-16e-instruct via Groq for document field extraction
Supports: JPG, PNG, WEBP images + PDF files (converted to images via PyMuPDF)
"""
from fastapi import APIRouter, UploadFile, File
from pydantic import BaseModel
from typing import Optional
import httpx
import base64
import os
import json
import re
import io

router = APIRouter()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
LLAMA_SCOUT_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"
MAX_IMAGE_SIZE = 1024  # Max pixels on any side for Groq API


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
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        page = doc[0]  # First page
        # Render at 2x resolution for better OCR
        mat = fitz.Matrix(2.0, 2.0)
        pix = page.get_pixmap(matrix=mat)
        img_bytes = pix.tobytes("jpeg")
        doc.close()
        return img_bytes
    except Exception as e:
        print(f"PDF conversion error: {e}")
        raise


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
    file_bytes = await image.read()
    content_type = image.content_type or ""
    filename = (image.filename or "").lower()
    
    is_pdf = "pdf" in content_type or filename.endswith(".pdf")
    
    # Convert PDF to image
    if is_pdf:
        try:
            file_bytes = convert_pdf_to_image(file_bytes)
            content_type = "image/jpeg"
        except Exception as e:
            return OcrExtractResponse(raw_text=f"PDF conversion failed: {str(e)}")

    # Resize large images
    file_bytes = resize_image_if_needed(file_bytes)
    
    # Encode to base64
    b64_image = base64.b64encode(file_bytes).decode("utf-8")
    mime_type = "image/jpeg"  # Always JPEG after processing

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": LLAMA_SCOUT_MODEL,
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
                    raw_text=parsed.get("raw_text", content),
                    fields_found=fields_found,
                )
            else:
                error_text = response.text
                print(f"Llama Scout API error: {response.status_code} - {error_text}")
                return OcrExtractResponse(raw_text=f"API Error {response.status_code}: {error_text[:200]}")
    except Exception as e:
        print(f"Llama Scout API connection error: {e}")
        return OcrExtractResponse(raw_text=f"Connection error: {str(e)}")
