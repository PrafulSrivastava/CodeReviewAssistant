#!/usr/bin/env python
import warnings
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Any, Dict
from assistant.crew import Assistant

warnings.filterwarnings("ignore", category=SyntaxWarning, module="pysbd")

app = FastAPI()

# Accept any JSON with the expected fields
class CodeChangePayload(BaseModel):
    repository: str
    file: str
    baseCommit: str
    headCommit: str
    diff: Dict[str, Any]  # diff is a nested dict structure

@app.post("/run")
def run_api(payload: CodeChangePayload):
    """
    Accepts JSON with repository info and diff,
    serializes it and passes to generate.
    """
    try:
        # Serialize the whole payload as JSON string for your model input
        import json
        input_json_str = json.dumps(payload.dict())

        print("Received payload:", input_json_str)

        rap = generate(input_json_str)
        return JSONResponse(content={"status": "success", "response": rap})
    except Exception as e:
        return JSONResponse(content={"status": "error", "detail": str(e)}, status_code=500)


def generate(message: str) -> str:
    inputs = {
        'input_json': message
    }
    try:
        result = Assistant().crew().kickoff(inputs=inputs)
        if not hasattr(result, 'raw') or not isinstance(result.raw, str):
            return "No output was generated."
        return result.raw
    except Exception as e:
        return f"❌ Error: {e}"


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
