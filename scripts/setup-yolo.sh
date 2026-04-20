#!/bin/bash
# Setup script for Clossie YOLO Detection Server (fashion-trained YOLOv8 on Apple Silicon)
# Creates a Python venv and installs all dependencies.
# Usage: bash scripts/setup-yolo.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV_DIR="$SCRIPT_DIR/.yolo-venv"

echo "=== Clossie YOLO Detection Server Setup ==="
echo ""

# Check we're on Apple Silicon
if [[ "$(uname -m)" != "arm64" ]]; then
  echo "Error: This script requires Apple Silicon (M1/M2/M3)."
  exit 1
fi

# Check Python
PYTHON=$(which python3)
if [[ -z "$PYTHON" ]]; then
  echo "Error: python3 not found. Install via 'brew install python3'."
  exit 1
fi
echo "Using Python: $($PYTHON --version)"

# Create venv
if [[ -d "$VENV_DIR" ]]; then
  echo "Venv already exists at $VENV_DIR"
else
  echo "Creating virtual environment..."
  $PYTHON -m venv "$VENV_DIR"
fi

# Activate and install
source "$VENV_DIR/bin/activate"

echo "Installing dependencies (this may take a few minutes)..."
pip install --upgrade pip -q

# Core dependencies for YOLOv8 fashion detection
pip install -q \
  "ultralytics>=8.3" \
  "huggingface_hub>=0.20" \
  Pillow \
  fastapi \
  uvicorn \
  python-multipart

echo ""
echo "=== Setup Complete ==="
echo ""
echo "To start the YOLO detection server:"
echo "  bash scripts/start-yolo.sh"
echo ""
echo "The first run will download the fashion model (~50MB)."
echo "After that, startup takes about 5 seconds."
