#!/bin/bash
# Install the Clossie YOLO Detection Server as a macOS login agent.
# This makes YOLO auto-start at login and auto-restart if it crashes,
# similar to how `brew services start ollama` works for Ollama.
#
# Usage:
#   bash scripts/install-yolo-service.sh              # install + start
#   bash scripts/install-yolo-service.sh --uninstall  # remove
#   bash scripts/install-yolo-service.sh --status     # check if running
#   bash scripts/install-yolo-service.sh --logs       # tail logs (ctrl-c to exit)
#   bash scripts/install-yolo-service.sh --restart    # bounce the service

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LABEL="com.clossie.yolo"
PLIST_PATH="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG_PATH="$HOME/Library/Logs/clossie-yolo.log"
START_SCRIPT="$SCRIPT_DIR/start-yolo.sh"
VENV_DIR="$SCRIPT_DIR/.yolo-venv"

# ─── Subcommands ─────────────────────────────────────────────────────────────

case "${1:-}" in
  --uninstall|uninstall|-u)
    echo "=== Uninstalling Clossie YOLO service ==="
    if [[ -f "$PLIST_PATH" ]]; then
      launchctl unload "$PLIST_PATH" 2>/dev/null || true
      rm "$PLIST_PATH"
      echo "Service removed."
    else
      echo "Service was not installed."
    fi
    # Also kill any running instance
    if lsof -ti :5002 >/dev/null 2>&1; then
      lsof -ti :5002 | xargs kill -9 2>/dev/null || true
      echo "Killed running YOLO process on port 5002."
    fi
    exit 0
    ;;

  --status|status|-s)
    if launchctl list | grep -q "$LABEL"; then
      echo "Service: installed"
      # Show PID and last exit code
      launchctl list "$LABEL" 2>/dev/null | grep -E '"PID"|"LastExitStatus"' || true
    else
      echo "Service: not installed"
    fi
    # Check if port is responding
    if curl -s --max-time 2 http://localhost:5002/health >/dev/null 2>&1; then
      echo "Port 5002: responding"
      curl -s http://localhost:5002/health
      echo ""
    else
      echo "Port 5002: not responding"
    fi
    exit 0
    ;;

  --logs|logs|-l)
    if [[ -f "$LOG_PATH" ]]; then
      echo "Tailing $LOG_PATH (Ctrl-C to exit)..."
      echo ""
      tail -f "$LOG_PATH"
    else
      echo "No log file found yet at $LOG_PATH"
      exit 1
    fi
    exit 0
    ;;

  --restart|restart|-r)
    if [[ -f "$PLIST_PATH" ]]; then
      echo "Restarting service..."
      launchctl unload "$PLIST_PATH" 2>/dev/null || true
      sleep 1
      launchctl load "$PLIST_PATH"
      sleep 2
      if launchctl list | grep -q "$LABEL"; then
        echo "Service restarted."
      else
        echo "Warning: Service did not restart cleanly."
        exit 1
      fi
    else
      echo "Service not installed. Run without arguments to install."
      exit 1
    fi
    exit 0
    ;;

  --help|help|-h)
    head -12 "$0" | tail -11 | sed 's/^# \?//'
    exit 0
    ;;
esac

# ─── Install (default action) ────────────────────────────────────────────────

echo "=== Installing Clossie YOLO as a login agent ==="
echo ""

# Prerequisite checks
if [[ ! -f "$START_SCRIPT" ]]; then
  echo "Error: $START_SCRIPT not found."
  echo "Make sure you're running this from the project root."
  exit 1
fi

if [[ ! -d "$VENV_DIR" ]]; then
  echo "Error: Python venv not found at $VENV_DIR"
  echo "Run 'bash scripts/setup-yolo.sh' first to set up dependencies."
  exit 1
fi

# Stop any existing YOLO process (manually-started or previous service)
if lsof -ti :5002 >/dev/null 2>&1; then
  echo "Stopping existing YOLO process on port 5002..."
  lsof -ti :5002 | xargs kill -9 2>/dev/null || true
  sleep 1
fi

# If already loaded, unload first to reinstall cleanly
if launchctl list | grep -q "$LABEL"; then
  echo "Service already installed, reloading..."
  launchctl unload "$PLIST_PATH" 2>/dev/null || true
fi

# Create required directories
mkdir -p "$(dirname "$PLIST_PATH")"
mkdir -p "$(dirname "$LOG_PATH")"

# Write the launchd plist
# - RunAtLoad: start immediately when loaded (and at every login)
# - KeepAlive.Crashed: auto-restart if process crashes (but not if cleanly exited)
# - ThrottleInterval: wait 10s between restart attempts (prevents crash loops)
# - StandardOutPath/StandardErrorPath: merged into one log file
cat > "$PLIST_PATH" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$LABEL</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>$START_SCRIPT</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$PROJECT_ROOT</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <dict>
        <key>Crashed</key>
        <true/>
        <key>SuccessfulExit</key>
        <false/>
    </dict>
    <key>ThrottleInterval</key>
    <integer>10</integer>
    <key>StandardOutPath</key>
    <string>$LOG_PATH</string>
    <key>StandardErrorPath</key>
    <string>$LOG_PATH</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    </dict>
</dict>
</plist>
PLIST

echo "Wrote plist to: $PLIST_PATH"

# Load the service (also starts it due to RunAtLoad)
launchctl load "$PLIST_PATH"
echo "Service loaded."

# Give it a few seconds to start
echo "Waiting for server to respond..."
for i in 1 2 3 4 5 6 7 8 9 10; do
  sleep 1
  if curl -s --max-time 1 http://localhost:5002/health >/dev/null 2>&1; then
    break
  fi
done

# Verify it's responding
if curl -s --max-time 2 http://localhost:5002/health >/dev/null 2>&1; then
  echo ""
  echo "=== Installed Successfully ==="
  echo ""
  echo "YOLO is running and will auto-start at every login."
  echo "If it crashes, launchd will auto-restart it after 10 seconds."
  echo ""
  echo "Server: http://localhost:5002"
  echo "Logs:   $LOG_PATH"
  echo ""
  echo "Useful commands:"
  echo "  bash scripts/install-yolo-service.sh --status     # check status"
  echo "  bash scripts/install-yolo-service.sh --logs       # tail logs"
  echo "  bash scripts/install-yolo-service.sh --restart    # restart server"
  echo "  bash scripts/install-yolo-service.sh --uninstall  # remove"
else
  echo ""
  echo "Warning: Service loaded but server is not responding at http://localhost:5002"
  echo "Check the logs for errors:"
  echo "  tail $LOG_PATH"
  exit 1
fi
