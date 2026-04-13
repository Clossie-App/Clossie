#!/bin/bash
# Setup script for Clossie Try-On Server (MLX Stable Diffusion on Apple Silicon)
# Creates a Python venv and installs all dependencies.
# Usage: bash scripts/setup-tryon.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV_DIR="$SCRIPT_DIR/.tryon-venv"

echo "=== Clossie Try-On Server Setup ==="
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

# Core dependencies for MLX Stable Diffusion
pip install -q \
  "mlx>=0.20" \
  "mlx-lm>=0.2" \
  numpy \
  tqdm \
  safetensors \
  "huggingface_hub>=0.20" \
  "transformers>=4.38" \
  Pillow \
  fastapi \
  uvicorn \
  python-multipart

echo ""
echo "Downloading MLX Stable Diffusion pipeline..."
# Clone just the stable_diffusion subdirectory from mlx-examples
SD_DIR="$SCRIPT_DIR/.mlx-sd"
if [[ -d "$SD_DIR" ]]; then
  echo "MLX SD pipeline already downloaded."
else
  # Sparse checkout of just the stable_diffusion directory
  git clone --depth 1 --filter=blob:none --sparse \
    https://github.com/ml-explore/mlx-examples.git "$SD_DIR-tmp"
  cd "$SD_DIR-tmp"
  git sparse-checkout set stable_diffusion
  mv stable_diffusion "$SD_DIR"
  cd "$SCRIPT_DIR"
  rm -rf "$SD_DIR-tmp"

  # Install the SD module's requirements
  if [[ -f "$SD_DIR/requirements.txt" ]]; then
    pip install -q -r "$SD_DIR/requirements.txt"
  fi
fi

echo ""
echo "=== Setup Complete ==="
echo ""
echo "To start the try-on server:"
echo "  bash scripts/start-tryon.sh"
echo ""
echo "The first run will download the model weights (~5GB)."
echo "After that, startup takes about 30 seconds."
