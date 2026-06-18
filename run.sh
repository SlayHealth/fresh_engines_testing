#!/bin/bash

# Kill all background jobs spawned by this script on exit
trap 'echo "Stopping services..."; kill 0' EXIT

echo "========================================="
echo " Starting SlayHealth Pathology Engine"
echo "========================================="

# Start Backend
echo "-> Starting Backend on port 3001..."
cd backend || exit
npm install
npm run dev &
BACKEND_PID=$!
cd ..

# Start Frontend
echo "-> Starting Frontend on port 3000..."
cd frontend || exit
npm install
npm run dev &
FRONTEND_PID=$!
cd ..

echo "========================================="
echo "Services are starting up!"
echo "Frontend: http://localhost:3000"
echo "Backend:  http://localhost:3001"
echo ""
echo "Press Ctrl+C to stop both services."
echo "========================================="

# Wait for background processes to keep the script running
wait
