#!/bin/bash

# ─────────────────────────────────────────────────────────────────
#  start-ios.sh — Build & launch the iOS app via Capacitor + Xcode
# ─────────────────────────────────────────────────────────────────

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}Starting Qualcomm Financial Insights Engine (iOS)...${NC}\n"

# ── 1. Check and clear port 8000 ─────────────────────────────────
if lsof -ti:8000 >/dev/null; then
    echo -e "${YELLOW}Port 8000 is in use. Killing old backend process...${NC}"
    lsof -ti:8000 | xargs kill -9
fi

# ── Cleanup function ─────────────────────────────────────────────
cleanup() {
    echo -e "\n${YELLOW}Stopping backend server...${NC}"
    
    if [ -n "$BACKEND_PID" ]; then
        echo "Killing backend (PID: $BACKEND_PID)..."
        kill $BACKEND_PID 2>/dev/null
    fi
    
    # Fallback: ensure everything in this group is dead
    kill 0 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# ── 2. Start Backend ─────────────────────────────────────────────
echo -e "${GREEN}[1/4] Starting Backend on http://localhost:8000${NC}"
cd Backend
if [ ! -d venv ]; then
    echo -e "${YELLOW}No venv found in Backend/. Creating one...${NC}"
    python3 -m venv venv
fi
source venv/bin/activate
# Ensure dependencies are installed
python -m pip install -q -r requirements.txt 2>/dev/null || true
uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!
cd ..

# Give backend a second to start
sleep 2

# ── 3. Install frontend dependencies (if needed) ────────────────
echo -e "${GREEN}[2/4] Installing frontend dependencies...${NC}"
cd Frontend
npm install

# ── 4. Build frontend for production ─────────────────────────────
echo -e "${GREEN}[3/4] Building frontend (npm run build)...${NC}"
if ! npm run build; then
    echo -e "${RED}✗ Build failed! Fix errors above and try again.${NC}"
    cleanup
    exit 1
fi

# ── 5. Sync to Capacitor & open Xcode ────────────────────────────
echo -e "${GREEN}[4/4] Syncing to Capacitor & opening Xcode...${NC}"
npx cap sync
npx cap open ios
cd ..

echo -e "\n${GREEN}✓ iOS app ready!${NC}"
echo -e "${BLUE}Backend:${NC}  http://localhost:8000"
echo -e "${BLUE}Xcode:${NC}   Select a simulator (e.g. iPhone 15 Pro) and press ▶️ to run"
echo -e "\n${YELLOW}Press Ctrl+C to stop the backend server${NC}\n"

# Wait for backend to keep running (Xcode runs independently)
wait
