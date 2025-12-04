#!/bin/bash

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}Starting Qualcomm Financial Insights Engine...${NC}\n"

# Check and clear port 8000
if lsof -ti:8000 >/dev/null; then
    echo -e "${YELLOW}Port 8000 is in use. Killing old backend process...${NC}"
    lsof -ti:8000 | xargs kill -9
fi

# Cleanup function
cleanup() {
    echo -e "\n${YELLOW}Stopping servers...${NC}"
    
    if [ -n "$BACKEND_PID" ]; then
        echo "Killing backend (PID: $BACKEND_PID)..."
        kill $BACKEND_PID 2>/dev/null
    fi
    
    if [ -n "$FRONTEND_PID" ]; then
        echo "Killing frontend (PID: $FRONTEND_PID)..."
        kill $FRONTEND_PID 2>/dev/null
    fi
    
    # Fallback: ensure everything in this group is dead
    kill 0 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start backend
echo -e "${GREEN}[1/2] Starting Backend on http://localhost:8000${NC}"
cd Backend
source venv/bin/activate
uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!
cd ..

# Give backend a second to start
sleep 2

# Start frontend
echo -e "${GREEN}[2/2] Starting Frontend...${NC}"
cd Frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo -e "\n${GREEN}✓ Both services starting...${NC}"
echo -e "${BLUE}Backend:${NC}  http://localhost:8000"
echo -e "${BLUE}Frontend:${NC} Check the output above for the port"
echo -e "\n${YELLOW}Press Ctrl+C to stop all servers${NC}\n"

# Wait for all background jobs
wait
