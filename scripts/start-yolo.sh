#!/bin/bash
# Start the Clossie YOLO Detection Server
# Usage: bash scripts/start-yolo.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV_DIR="$SCRIPT_DIR/.yolo-venv"

if [[ ! -d "$VENV_DIR" ]]; then
  echo "Error: Venv not found. Run 'bash scripts/setup-yolo.sh' first."
  exit 1
fi

source "$VENV_DIR/bin/activate"

echo "Starting Clossie YOLO Detection Server on http://localhost:5002..."
python3 "$SCRIPT_DIR/yolo-server.py"
