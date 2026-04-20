"""
Clossie YOLO Detection Server — Fashion-trained YOLOv8 on Apple Silicon.

Detects clothing items with pixel-accurate bounding boxes. Maps the fashion
model's 41 classes to Clossie's 10 categories (tops, bottoms, dresses, etc.)

Runs on http://localhost:5002
Endpoint: POST /detect
  Body: { "image": "<base64 PNG/JPEG>", "conf": 0.25 }
  Returns: { "items": [{ "label": "...", "category": "...", "box_2d": [y,x,y,x] }] }

Endpoint: GET /health
  Returns: { "status": "ready" } or { "status": "loading" }
"""

import base64
import io
import os
import time
import threading
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn


# ─── Class → Clossie category mapping ────────────────────────────────────────
# Covers class names from multiple fashion-trained YOLO models. Keys are
# lower-cased, hyphens/underscores/spaces stripped to a common form.
CATEGORY_MAP = {
    # generic "clothing" — YOLO can't tell what type, so flag as tops (Ollama will re-categorize)
    "clothing": "tops",
    "clothes": "tops",
    "apparel": "tops",
    "garment": "tops",

    # tops
    "shirt": "tops",
    "tshirt": "tops",
    "t-shirt": "tops",
    "top": "tops",
    "blouse": "tops",
    "topblouse": "tops",
    "top-blouse": "tops",
    "sweater": "tops",
    "hoodie": "tops",
    "sweaterhoodie": "tops",
    "sweater-hoodie": "tops",
    "cardigan": "tops",
    "tanktop": "tops",
    "tank-top": "tops",
    "polo": "tops",
    "bodysuit": "tops",
    "bra": "tops",
    "vest": "tops",

    # bottoms
    "pants": "bottoms",
    "jeans": "bottoms",
    "pantsjeans": "bottoms",
    "pants-jeans": "bottoms",
    "trousers": "bottoms",
    "shorts": "bottoms",
    "skirt": "bottoms",
    "leggings": "bottoms",
    "leggingsstockings": "bottoms",
    "leggings-stockings": "bottoms",
    "stockings": "bottoms",

    # dresses
    "dress": "dresses",
    "dresslong": "dresses",
    "dress-long": "dresses",
    "dressmini": "dresses",
    "dress-mini": "dresses",
    "gown": "dresses",
    "jumpsuit": "dresses",
    "suit": "dresses",
    "suitformalwear": "dresses",
    "suit-formal-wear": "dresses",

    # outerwear
    "jacket": "outerwear",
    "coat": "outerwear",
    "blazer": "outerwear",
    "coatjacketblazer": "outerwear",
    "coat-jacket-blazer": "outerwear",
    "outerwear": "outerwear",

    # shoes
    "shoe": "shoes",
    "shoes": "shoes",
    "footwear": "shoes",
    "sneakers": "shoes",
    "boots": "shoes",
    "heel": "shoes",
    "heels": "shoes",
    "highheels": "shoes",
    "high-heels": "shoes",
    "heelfootwear": "shoes",
    "heel-footwear": "shoes",
    "babyshoe": "shoes",
    "boyshoe": "shoes",
    "girlshoe": "shoes",
    "manshoe": "shoes",
    "menshoe": "shoes",
    "womenshoe": "shoes",
    "smallshoe": "shoes",
    "longshoe": "shoes",
    "sock": "shoes",
    "socks": "shoes",

    # bags
    "bag": "bags",
    "purse": "bags",
    "purseBag": "bags",
    "pursebag": "bags",
    "purse-bag": "bags",
    "handbag": "bags",
    "backpack": "bags",
    "suitcase": "bags",

    # accessories
    "accessories": "accessories",
    "accessory": "accessories",
    "belt": "accessories",
    "hat": "accessories",
    "cap": "accessories",
    "caphatheadgear": "accessories",
    "cap-hat-headgear": "accessories",
    "headgear": "accessories",
    "scarf": "accessories",
    "glove": "accessories",
    "gloves": "accessories",
    "glasses": "accessories",
    "eyewear": "accessories",
    "sunglasses": "accessories",
    "umbrella": "accessories",
    "hairclip": "accessories",
    "hairclipandaccessories": "accessories",
    "hair-clip-and-accessories": "accessories",
    "neckwear": "accessories",
    "tie": "accessories",

    # jewelry
    "earrings": "jewelry",
    "earring": "jewelry",
    "necklace": "jewelry",
    "bracelet": "jewelry",
    "ring": "jewelry",
    "watch": "jewelry",
}

# Classes we skip entirely (body parts, brand logos — not clothing items)
SKIP_CLASSES = {
    "person", "people",
    "body", "babybody", "boybody", "girlbody", "manbody", "womanbody",
    "baby-body", "boy-body", "girl-body", "man-body", "woman-body",
    "brandname", "brand-name", "logo",
    "pocket", "button", "zipper",
    "face", "hair", "skin",
}


def normalize_class_name(name: str) -> str:
    """Normalize class name for lookup: lowercase, strip whitespace/underscores."""
    return name.lower().strip().replace("_", "").replace(" ", "")


# ─── Lifecycle ───────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app):
    t = threading.Thread(target=idle_unloader, daemon=True)
    t.start()
    print("[YOLO] Server ready. Model will load on first request.")
    yield


app = FastAPI(title="Clossie YOLO Detection Server", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# Global state
model = None
model_name = "unknown"
model_loading = False
model_lock = threading.Lock()
last_used = time.time()
IDLE_TIMEOUT = 300  # Unload after 5 minutes of no use


# ─── Request/response schemas ────────────────────────────────────────────────

class DetectRequest(BaseModel):
    image: str  # base64 encoded PNG or JPEG
    conf: float = 0.25  # Minimum confidence threshold


class DetectedItem(BaseModel):
    label: str
    category: str
    box_2d: list[int]  # [y_min, x_min, y_max, x_max] on 0-1000 scale
    confidence: float


class DetectResponse(BaseModel):
    items: list[DetectedItem]
    time_seconds: float
    model: str = "yolov8"


# ─── Model loading ───────────────────────────────────────────────────────────

# Fashion-trained YOLO models to try, in order of preference. Each entry is
# (huggingface_repo_id, filename). Falls back to base YOLOv8 if all fail.
FASHION_MODELS = [
    ("kesimeg/yolov8n-clothing-detection", "best.pt"),
    ("valentinafeve/yolov8m-deepfashion2", "best.pt"),
]


def load_model():
    """Load a fashion-trained YOLO model. Falls back to base YOLOv8 if none work."""
    global model, model_loading, model_name
    model_loading = True

    try:
        from ultralytics import YOLO
        from huggingface_hub import hf_hub_download
        from huggingface_hub.utils import HfHubHTTPError

        loaded = None
        used_name = None
        start = time.time()

        # Try fashion-trained models first
        for repo_id, filename in FASHION_MODELS:
            try:
                print(f"[YOLO] Trying fashion model {repo_id}...")
                model_path = hf_hub_download(repo_id=repo_id, filename=filename)
                loaded = YOLO(model_path)
                used_name = repo_id
                print(f"[YOLO] Loaded fashion model: {repo_id}")
                break
            except (HfHubHTTPError, FileNotFoundError) as e:
                print(f"[YOLO] Could not load {repo_id}: {e}")
                continue
            except Exception as e:
                print(f"[YOLO] Unexpected error loading {repo_id}: {e}")
                continue

        # Fall back to Ultralytics base YOLOv8 (COCO-trained, general object detection)
        if loaded is None:
            print("[YOLO] No fashion model available, falling back to YOLOv8n (COCO)")
            loaded = YOLO("yolov8n.pt")  # Auto-downloads from Ultralytics
            used_name = "yolov8n-coco"

        # Move to MPS (Apple Silicon GPU) for fast inference
        try:
            loaded.to("mps")
            print("[YOLO] Model moved to MPS (Apple Silicon GPU)")
        except Exception as e:
            print(f"[YOLO] Could not use MPS ({e}), falling back to CPU")

        elapsed = time.time() - start
        print(f"[YOLO] Model '{used_name}' loaded in {elapsed:.1f}s")

        model = loaded
        model_name = used_name
    except Exception as e:
        print(f"[YOLO] Failed to load any model: {e}")
        import traceback
        traceback.print_exc()
        model = None
    finally:
        model_loading = False


def ensure_model():
    global model, last_used
    last_used = time.time()

    if model is not None:
        return True

    with model_lock:
        if model is not None:
            return True
        load_model()
        return model is not None


def idle_unloader():
    """Unload the model after IDLE_TIMEOUT seconds of no use to free memory."""
    global model
    while True:
        time.sleep(60)
        if model is not None and (time.time() - last_used) > IDLE_TIMEOUT:
            print(f"[YOLO] Model idle for {IDLE_TIMEOUT}s, unloading to free memory...")
            with model_lock:
                model = None
            import gc
            gc.collect()
            print("[YOLO] Model unloaded.")


# ─── Endpoints ───────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    if model is not None:
        return {"status": "ready", "model": model_name}
    elif model_loading:
        return {"status": "loading"}
    else:
        return {"status": "idle", "message": "Model will load on first request (~5s after download)"}


@app.post("/detect", response_model=DetectResponse)
async def detect(req: DetectRequest):
    start = time.time()

    if not ensure_model():
        return DetectResponse(items=[], time_seconds=0)

    try:
        from PIL import Image

        # Decode input image
        img_bytes = base64.b64decode(req.image)
        img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        img_w, img_h = img.size

        # Run inference
        results = model.predict(img, conf=req.conf, verbose=False)
        result = results[0]

        items = []
        if result.boxes is not None and len(result.boxes) > 0:
            boxes = result.boxes
            class_names = result.names  # dict: class_id -> class_name

            for i in range(len(boxes)):
                cls_id = int(boxes.cls[i].item())
                cls_name_raw = class_names.get(cls_id, "unknown")
                cls_name = cls_name_raw.lower().strip()
                cls_name_normalized = normalize_class_name(cls_name_raw)
                conf = float(boxes.conf[i].item())

                # Skip body-part and logo classes (try both hyphenated and normalized forms)
                if cls_name in SKIP_CLASSES or cls_name_normalized in SKIP_CLASSES:
                    continue

                # Map to Clossie category (try both forms)
                category = CATEGORY_MAP.get(cls_name, CATEGORY_MAP.get(cls_name_normalized, "other"))

                # Box in pixel coords: [x1, y1, x2, y2]
                x1, y1, x2, y2 = boxes.xyxy[i].tolist()

                # Convert to 0-1000 scale [y_min, x_min, y_max, x_max]
                y_min = int(round(y1 / img_h * 1000))
                x_min = int(round(x1 / img_w * 1000))
                y_max = int(round(y2 / img_h * 1000))
                x_max = int(round(x2 / img_w * 1000))

                # Clamp to 0-1000
                y_min = max(0, min(1000, y_min))
                x_min = max(0, min(1000, x_min))
                y_max = max(0, min(1000, y_max))
                x_max = max(0, min(1000, x_max))

                # Skip tiny boxes (< 2% of image)
                if (x_max - x_min) < 20 or (y_max - y_min) < 20:
                    continue

                # Build a human-readable label
                label = cls_name.replace("-", " ")

                items.append(DetectedItem(
                    label=label,
                    category=category,
                    box_2d=[y_min, x_min, y_max, x_max],
                    confidence=round(conf, 3),
                ))

        # Sort by confidence, highest first
        items.sort(key=lambda x: x.confidence, reverse=True)

        elapsed = time.time() - start
        print(f"[YOLO] Detected {len(items)} items in {elapsed:.2f}s (img {img_w}x{img_h})")

        return DetectResponse(items=items, time_seconds=round(elapsed, 2))

    except Exception as e:
        print(f"[YOLO] Detection error: {e}")
        import traceback
        traceback.print_exc()
        return DetectResponse(items=[], time_seconds=time.time() - start)


if __name__ == "__main__":
    print("=== Clossie YOLO Detection Server ===")
    print("http://localhost:5002")
    print("POST /detect — Detect clothing items with bounding boxes")
    print("GET /health — Check server status")
    print("")
    uvicorn.run(app, host="0.0.0.0", port=5002, log_level="info")
