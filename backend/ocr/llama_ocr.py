"""
Groq Llama Scout Vision OCR
Uses meta-llama/llama-4-scout-17b-16e-instruct via Groq for document field extraction
"""
from fastapi import APIRouter, UploadFile, File
from pydantic import BaseModel
from typing import Optional
import httpx
import base64
import os
import json
import re

router = APIRouter()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
LLAMA_SCOUT_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"


class OcrExtractResponse(BaseModel):
    applicant_name: Optional[str] = None
    aadhaar_number: Optional[str] = None
    dob: Optional[str] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    raw_text: str = ""
    fields_found: int = 0


EXTRACTION_PROMPT = """You are an expert document reader for Indian government ID documents (Aadhaar card, PAN card, Ration card, etc.).

Extract the following fields from this document image. Return ONLY a valid JSON object with these keys:
- applicant_name: full name as written on the document
- aadhaar_number: 12-digit Aadhaar number (digits only, no spaces)
- dob: date of birth in DD/MM/YYYY format
- gender: "male" or "female"
- address: full address as written
- raw_text: all visible text on the document

If a field is not found, use null for that field.
Return ONLY the JSON, no markdown, no explanation."""


@router.post("/ocr/extract", response_model=OcrExtractResponse)
async def extract_document_fields(image: UploadFile = File(...)):
    """
    Extract structured fields from a document image using Llama Scout vision.
    """
    image_bytes = await image.read()
    b64_image = base64.b64encode(image_bytes).decode("utf-8")

    mime_type = image.content_type or "image/jpeg"

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
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
                    "max_tokens": 1000,
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
                print(f"Llama Scout API error: {response.status_code} - {response.text}")
                return OcrExtractResponse(raw_text=f"API Error: {response.status_code}")
    except Exception as e:
        print(f"Llama Scout API connection error: {e}")
        return OcrExtractResponse(raw_text=f"Connection error: {str(e)}")
