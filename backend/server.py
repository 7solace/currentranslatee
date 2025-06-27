from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
from dotenv import load_dotenv
import uuid
import asyncio
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from emergentintegrations.llm.chat import LlmChat, UserMessage

# Load environment variables
load_dotenv()

app = FastAPI()

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB setup
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
client = AsyncIOMotorClient(MONGO_URL)
db = client.translator_db
translations_collection = db.translations

# OpenAI API Key
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
# Gemini API Key
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Supported languages
LANGUAGES = {
    "tr": "Türkçe",
    "en": "English", 
    "de": "Deutsch",
    "fr": "Français",
    "es": "Español",
    "it": "Italiano",
    "pt": "Português",
    "ru": "Русский"
}

class TranslationRequest(BaseModel):
    text: str
    from_lang: str
    to_lang: str

class TranslationResponse(BaseModel):
    id: str
    text: str
    from_lang: str
    to_lang: str
    main_translation: str
    alternatives: List[dict]
    timestamp: str

class HistoryResponse(BaseModel):
    translations: List[TranslationResponse]

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "message": "Translation API is running"}

@app.get("/api/languages")
async def get_languages():
    return {"languages": LANGUAGES}

@app.post("/api/translate")
async def translate_text(request: TranslationRequest):
    try:
        if not request.text.strip():
            raise HTTPException(status_code=400, detail="Text cannot be empty")
        
        if request.from_lang == request.to_lang:
            raise HTTPException(status_code=400, detail="Source and target languages cannot be the same")
            
        if len(request.text) > 5000:
            raise HTTPException(status_code=400, detail="Text too long (max 5000 characters)")
            
        if request.from_lang not in LANGUAGES or request.to_lang not in LANGUAGES:
            raise HTTPException(status_code=400, detail="Unsupported language")

        # Create translation session
        session_id = str(uuid.uuid4())
        
        # System message for translation
        system_message = f"""You are an expert translator who understands natural, everyday language usage.

Your task: Translate text from {LANGUAGES[request.from_lang]} to {LANGUAGES[request.to_lang]}.

IMPORTANT: 
- For casual/informal text, provide NATURAL, everyday translations that native speakers actually use
- For "What's up?" type phrases, use casual versions like "Naber?" not formal "Ne haber?"
- Return main_translation as: "casual_version (informal) / formal_version (formal)" format
- Write ALL explanations in {LANGUAGES[request.to_lang]} (target language)

Response format:
{{
    "main_translation": "Natural_casual_translation (gayri resmi) / Formal_translation (resmi)",
    "alternatives": [
        {{
            "translation": "Most natural everyday version", 
            "context": "Günlük konuşma",
            "explanation": "Explanation in {LANGUAGES[request.to_lang]} about natural usage"
        }},
        {{
            "translation": "Polite/neutral version",
            "context": "Nezaket/tarafsız", 
            "explanation": "Explanation in {LANGUAGES[request.to_lang]} about polite usage"
        }},
        {{
            "translation": "Very formal/business version",
            "context": "Çok resmi/iş",
            "explanation": "Explanation in {LANGUAGES[request.to_lang]} about formal usage"
        }}
    ]
}}

Rules:
1. Main translation should show both casual and formal in one line
2. Prioritize natural, native-speaker language
3. ALL explanations in {LANGUAGES[request.to_lang]}
4. Consider real-world usage, not textbook translations
5. Return ONLY valid JSON"""

        # Initialize LLM chat with Gemini
        chat = LlmChat(
            api_key=GEMINI_API_KEY,
            session_id=session_id,
            system_message=system_message
        ).with_model("gemini", "gemini-2.0-flash").with_max_tokens(2048)
        
        # Create user message
        user_message = UserMessage(
            text=f"Translate this text: '{request.text}'"
        )
        
        # Get translation
        response = await chat.send_message(user_message)
        
        # Parse response - Handle JSON in code blocks
        import json
        import re
        
        try:
            # First try direct JSON parsing
            translation_data = json.loads(response)
        except:
            try:
                # Try to extract JSON from code blocks
                json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', response, re.DOTALL)
                if json_match:
                    json_str = json_match.group(1)
                    translation_data = json.loads(json_str)
                else:
                    # Try to find JSON without code blocks
                    json_match = re.search(r'(\{.*?\})', response, re.DOTALL)
                    if json_match:
                        json_str = json_match.group(1)
                        translation_data = json.loads(json_str)
                    else:
                        raise Exception("No JSON found")
            except Exception as e:
                print(f"JSON parsing error: {e}")
                print(f"Raw response: {response}")
                # Fallback - create simple translation
                translation_data = {
                    "main_translation": response.strip(),
                    "alternatives": [
                        {"translation": response.strip(), "context": "General", "explanation": "Standard translation"}
                    ]
                }
        
        # Create translation record
        translation_id = str(uuid.uuid4())
        translation_record = {
            "id": translation_id,
            "text": request.text,
            "from_lang": request.from_lang,
            "to_lang": request.to_lang,
            "main_translation": translation_data.get("main_translation", response),
            "alternatives": translation_data.get("alternatives", []),
            "timestamp": datetime.utcnow().isoformat(),
            "created_at": datetime.utcnow()
        }
        
        # Save to database
        await translations_collection.insert_one(translation_record.copy())
        
        # Remove MongoDB ObjectId for response
        translation_record.pop("_id", None)
        translation_record.pop("created_at", None)
        
        return TranslationResponse(**translation_record)
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Translation error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Translation failed: {str(e)}")

@app.get("/api/history")
async def get_translation_history(limit: int = 20):
    try:
        cursor = translations_collection.find().sort("created_at", -1).limit(limit)
        translations = []
        
        async for doc in cursor:
            doc.pop("_id", None)
            doc.pop("created_at", None)
            translations.append(TranslationResponse(**doc))
            
        return HistoryResponse(translations=translations)
        
    except Exception as e:
        print(f"History error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch history: {str(e)}")

@app.delete("/api/history")
async def clear_history():
    try:
        await translations_collection.delete_many({})
        return {"message": "History cleared successfully"}
    except Exception as e:
        print(f"Clear history error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to clear history: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)