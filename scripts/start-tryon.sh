#!/bin/bash
# Start the Clossie Try-On Server
# Usage: bash scripts/start-tryon.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV_DIR="$SCRIPT_DIR/.tryon-venv"

if [[ ! -d "$VENV_DIR" ]]; then
  echo "Error: Venv not found. Run 'bash scripts/setup-tryon.sh' first."
  exit 1
fi

source "$VENV_DIR/bin/activate"
export PYTHONPATH="$SCRIPT_DIR/.mlx-sd:$PYTHONPATH"

echo "Starting Clossie Try-On Server on http://localhost:5001..."
python3 "$SCRIPT_DIR/tryon-server.py"
