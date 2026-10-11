#!/usr/bin/env bash
# Stop the GPU worker and any model children.
pkill -f "workers/gpu/server.py" ; pkill -f "python server.py"; sleep 3; pkill -f worker_child.py; sleep 1
pgrep -af "server.py|worker_child.py" || echo "worker stopped"
