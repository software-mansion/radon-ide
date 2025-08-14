#!/bin/bash

mkdir -p videos

nohup ffmpeg -f avfoundation -framerate 15 -i "1:none" -preset ultrafast -t 600 videos/vscode-ui-recording.mp4 > videos/ffmpeg.log 2>&1 &

echo $! > videos/ffmpeg_pid.txt

echo "Started ffmpeg in background with PID $(cat videos/ffmpeg_pid.txt)"
