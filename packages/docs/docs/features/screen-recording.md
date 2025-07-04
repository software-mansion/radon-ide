---
id: screen-recording
title: Screen recording
sidebar_position: 5
---

Radon IDE has access to what is happening on the device preview screen. It allows you to take screenshots and record the screen.

## Capture a screenshot

Click the screenshot button to capture what's currently visible on the device preview.

<img width="300" src="/img/docs/ide_screenshot_button.png" className="shadow-image" />

The IDE will open a file dialog to choose where to save the screenshot. The screenshot will be saved as `.png` file.

<img width="450" src="/img/docs/ide_screenshot_where.png" className="shadow-image" />

## Screen recording

To start screen recording click the screen recording button in the top-right corner of the Radon IDE panel.

<img width="300" src="/img/docs/ide_screen_recording_button.png" className="shadow-image" />

A recording indicator appears in the top-right corner of the device preview. Clicking on the indicator stops the recording. Radon IDE will prompt you to choose where to save the recording. The screen recording will be saved as a `.mp4` file.

<img width="350" src="/img/docs/ide_screen_recording_indicator.png" className="shadow-image" />

When `Show Touches` is enabled, touch interactions are included in the recording. Radon IDE can capture recording up to 10 minutes.

<video autoPlay loop width="700" controls className="shadow-image">
  <source src="/video/ide_screen_recording.mp4" type="video/mp4"/>
</video>

## Replays

Replays automatically capture the last few seconds of what was happening on the device preview. This allows you to review recent interactions after they occur, go through the recording frame by frame, or save the replay as a file.

### Enabling replays

Enable the `Enable replays` option in device settings to activate the `Replay` feature.

<img width="350" src="/img/docs/ide_enable_replays.png" className="shadow-image" />

A new button will appear in the top-right corner of the IDE panel.

<img width="300" src="/img/docs/ide_replays_enabled.png" className="shadow-image" />

### Using Replays

Click the `Replay` button to view the last 5/10/30 seconds of screen activity.

<video autoPlay loop width="700" controls className="shadow-image">
  <source src="/video/ide_replays.mp4" type="video/mp4"/>
</video>

### Replay options

The replay overlay provides the following controls:

<img width="500" src="/img/docs/ide_replays.png" className="shadow-image" />

1. **Replay length** - Select recording duration: 5s, 10s, 30s, or full length
2. **Play/Pause button** - Control playback
3. **Seekbar** - Navigate to specific timestamps
4. **Previous frame** - Step backward one frame
5. **Next frame** - Step forward one frame
6. **Save replay** - Export the recording to file

### Closing the Replay overlay

Click the `x` button in the top-right corner to close the replay overlay.

<img width="250" src="/img/docs/ide_close_overlay.png" className="shadow-image" />
