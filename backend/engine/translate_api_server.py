import os
import sys
import json
import asyncio
from fastapi import FastAPI, HTTPException, Body
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional

# Add parent directory to path to import engine
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(os.path.dirname(current_dir)))

from backend.engine.engine import VietphraseEngine
from backend.config import Config

app = FastAPI(
    title="Vietphrase Translation Standalone API Server",
    description="Standalone API for fast Chinese to Vietnamese translation with 5 modes"
)

# Initialize engine
print("Lazy-loading Vietphrase Engine on API Startup...")
engine = VietphraseEngine()
print("Vietphrase Engine successfully loaded!")

class TranslateRequest(BaseModel):
    texts: List[str]
    mode: Optional[str] = "advanced"

@app.get("/health")
def health():
    return {
        "status": "ok",
        "modes": ["advanced", "fast", "vietphrase", "hanviet", "advanced_hanviet"],
        "dictionary_sizes": {
            "char_dict": len(engine.char_dict),
            "proper_names": len(engine.proper_names),
            "vietphrase": len(engine.vietphrase)
        }
    }

@app.post("/v1/translate")
def translate(req: TranslateRequest):
    if not req.texts:
        raise HTTPException(status_code=400, detail="Missing 'texts' list")
    
    translations = []
    for text in req.texts:
        if not text.strip():
            translations.append(text)
        else:
            try:
                translations.append(engine.translate(text, mode=req.mode))
            except Exception as e:
                translations.append(text)
                print(f"Error translating text: {e}")
                
    return {"translations": translations}

@app.post("/v1/translate_stream")
async def translate_stream(req: TranslateRequest):
    if not req.texts:
        raise HTTPException(status_code=400, detail="Missing 'texts' list")
        
    async def event_generator():
        for i, text in enumerate(req.texts):
            if not text.strip():
                trans = text
            else:
                try:
                    trans = engine.translate(text, mode=req.mode)
                except Exception as e:
                    trans = text
                    print(f"Error streaming translation: {e}")
                    
            yield f"data: {json.dumps({'index': i, 'text': trans}, ensure_ascii=False)}\n\n"
            await asyncio.sleep(0.001)

    return StreamingResponse(event_generator(), media_type="text/event-stream")

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8050))
    uvicorn.run("translate_api_server:app", host="0.0.0.0", port=port, reload=False)
