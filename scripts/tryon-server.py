"""
Clossie Try-On Server — Local MLX Stable Diffusion for clothing flatlay generation.

Runs on http://localhost:5001
Endpoint: POST /generate
  Body: { "image": "<base64 PNG>", "description": "white crop top" }
  Returns: { "image": "<base64 PNG of flatlay>" }

Endpoint: GET /health
  Returns: { "status": "ready" } or { "status": "loading" }
"""

import base64
import io
import sys
import os
import time
import threading
from pathlib import Path

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

# Add the MLX SD pipeline to the path
SD_DIR = Path(__file__).parent / ".mlx-sd"
if SD_DIR.exists():
    sys.path.insert(0, str(SD_DIR))

@asynccontextmanager
async def lifespan(app):
    # Start idle unloader thread on startup
    t = threading.Thread(target=idle_unloader, daemon=True)
    t.start()
    print("[TryOn] Server ready. Model will load on first request.")
    yield

app = FastAPI(title="Clossie Try-On Server", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# Global state
pipeline = None
pipeline_loading = False
pipeline_lock = threading.Lock()
last_used = time.time()
IDLE_TIMEOUT = 300  # Unload model after 5 minutes idle to free memory


class GenerateRequest(BaseModel):
    image: str  # base64 encoded PNG (background-removed clothing item)
    description: str = "clothing item"  # e.g., "white crop top", "blue jeans"
    strength: float = 0.75  # How much to transform (0.0 = no change, 1.0 = fully new)
    steps: int = 20  # Inference steps


class GenerateResponse(BaseModel):
    image: str  # base64 encoded PNG of the generated flatlay
    time_seconds: float


def load_pipeline():
    """Load the MLX Stable Diffusion pipeline. Takes ~30s on first run (downloads model)."""
    global pipeline, pipeline_loading
    pipeline_loading = True

    try:
        import mlx.core as mx
        from stable_diffusion import StableDiffusion

        print("[TryOn] Loading Stable Diffusion 2.1 via MLX...")
        start = time.time()

        sd = StableDiffusion(
            "stabilityai/stable-diffusion-2-1-base",
            float16=True,  # Use float16 for lower memory (~2.5GB instead of 5GB)
        )

        elapsed = time.time() - start
        print(f"[TryOn] Model loaded in {elapsed:.1f}s")

        pipeline = sd
    except ImportError as e:
        print(f"[TryOn] Import error: {e}")
        print("[TryOn] Make sure you ran 'bash scripts/setup-tryon.sh' first.")
        pipeline = None
    except Exception as e:
        print(f"[TryOn] Failed to load model: {e}")
        pipeline = None
    finally:
        pipeline_loading = False


def ensure_pipeline():
    """Ensure the pipeline is loaded, loading it if needed."""
    global pipeline, last_used
    last_used = time.time()

    if pipeline is not None:
        return True

    with pipeline_lock:
        if pipeline is not None:
            return True
        load_pipeline()
        return pipeline is not None


def idle_unloader():
    """Background thread that unloads the model after IDLE_TIMEOUT seconds of no use."""
    global pipeline
    while True:
        time.sleep(60)  # Check every minute
        if pipeline is not None and (time.time() - last_used) > IDLE_TIMEOUT:
            print(f"[TryOn] Model idle for {IDLE_TIMEOUT}s, unloading to free memory...")
            with pipeline_lock:
                pipeline = None
            import gc
            gc.collect()
            print("[TryOn] Model unloaded.")


@app.get("/health")
async def health():
    if pipeline is not None:
        return {"status": "ready", "model": "stable-diffusion-2.1-base"}
    elif pipeline_loading:
        return {"status": "loading"}
    else:
        return {"status": "idle", "message": "Model will load on first request (~30s)"}


@app.post("/generate", response_model=GenerateResponse)
async def generate(req: GenerateRequest):
    start = time.time()

    # Ensure model is loaded
    if not ensure_pipeline():
        return GenerateResponse(image="", time_seconds=0)

    try:
        import mlx.core as mx
        from PIL import Image
        import numpy as np

        # Decode input image
        img_bytes = base64.b64decode(req.image)
        input_image = Image.open(io.BytesIO(img_bytes)).convert("RGB")

        # Resize to 512x512 (SD 2.1 native resolution)
        input_image = input_image.resize((512, 512), Image.LANCZOS)

        # Build the prompt for flatlay generation
        prompt = f"flat lay product photograph of a {req.description}, centered on clean white background, studio lighting, high quality product photography, no person, no mannequin, clothing laid flat"
        negative_prompt = "person, mannequin, model, worn, wrinkled, messy, dark background, low quality, blurry"

        # Convert image to MLX array for img2img
        img_array = np.array(input_image).astype(np.float32) / 255.0
        img_array = img_array * 2.0 - 1.0  # Normalize to [-1, 1]
        img_mlx = mx.array(img_array)

        # Generate using the pipeline
        # The MLX SD pipeline's generate function takes a prompt and optionally an input image
        latents = pipeline.generate_latents_from_image(
            prompt,
            img_mlx,
            strength=req.strength,
            n_images=1,
            cfg_weight=7.5,
            num_steps=req.steps,
            negative_text=negative_prompt,
        )

        # Decode the final latents
        for x_t in latents:
            pass  # Iterate through denoising steps, keep final result
        decoded = pipeline.decode(x_t)

        # Convert back to PIL Image
        decoded = mx.clip(decoded, 0, 1)
        decoded_np = np.array(decoded.squeeze() * 255).astype(np.uint8)
        output_image = Image.fromarray(decoded_np)

        # Encode as PNG base64
        buffer = io.BytesIO()
        output_image.save(buffer, format="PNG", optimize=True)
        output_b64 = base64.b64encode(buffer.getvalue()).decode()

        elapsed = time.time() - start
        print(f"[TryOn] Generated flatlay for '{req.description}' in {elapsed:.1f}s")

        return GenerateResponse(image=output_b64, time_seconds=round(elapsed, 1))

    except Exception as e:
        print(f"[TryOn] Generation error: {e}")
        import traceback
        traceback.print_exc()
        return GenerateResponse(image="", time_seconds=time.time() - start)


if __name__ == "__main__":
    print("=== Clossie Try-On Server ===")
    print("http://localhost:5001")
    print("POST /generate — Generate flatlay from clothing image")
    print("GET /health — Check server status")
    print("")
    uvicorn.run(app, host="0.0.0.0", port=5001, log_level="info")
