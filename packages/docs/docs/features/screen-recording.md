---
id: screen-recording
title: Screen recording
sidebar_position: 5
---

Radon IDE has access to what is happening on the device preview screen. It allows you to take screenshots and record the screen.

## Capture a screenshot

<img width="300" src="/img/docs/ide_screenshot_button.png" className="shadow-image" />

captures what's currently visible on the device preview. Radon IDE will ask you where to save the screenshot.

<img width="450" src="/img/docs/ide_screenshot_where.png" className="shadow-image" />

## Screen recording

<img width="3-0" src="/img/docs/ide_screen_recording_button.png" className="shadow-image" />

<img width="350" src="/img/docs/ide_screen_recording_indicator.png" className="shadow-image" />

<video autoPlay loop width="700" controls className="shadow-image">
  <source src="/video/ide_screen_recording.mp4" type="video/mp4"/>
</video>

When `Show Touches` option is enabled on the device preview it is also captured on the recording. You finish recording by clicking on the screen recording indicator.
Screen recording captures up to 10 minutes of recording.

## Replays

Replay allows to rewind the last couple of seconds of what was happening on the screen. This proves to be extremely useful for rewinding to UI issues after they has already happened. You can also granularly go through the recording frame by frame or save it as a file to your computer.

### Enabling replays

<img width="350" src="/img/docs/ide_enable_replays.png" className="shadow-image" />

Enabling the `Enable replays` option gives access to a new `Replay` button in the top-right corner of the Radon IDE panel.

<img width="300" src="/img/docs/ide_replays_enabled.png" className="shadow-image" />

### Using Replays

Clicking on the `Replay` button rewinds the last 5/10/30 seconds of what was happening on the device preview.

<video autoPlay loop width="700" controls className="shadow-image">
  <source src="/video/ide_replays.mp4" type="video/mp4"/>
</video>

### Replay options

On the replay overlay you have access to some functionalities like:

<img width="500" src="/img/docs/ide_replays.png" className="shadow-image" />

1. **Replay length** - allows to adjust the length of the recording for last _5s_, _10s_, _30s_, or _full_ length of the recording,
2. **Play/Pause button** - allows to manage the recording playback,
3. **Seekbar** - allows to seek through or skip to a part of the video,
4. **Previous frame** - jumps back one frame of the recording,
5. **Next frame** - jumps forward one frame of the recording,
6. **Save replay** - allows to save the recording.

### Closing the Replay overlay

You can close the overlay with a `x` button in the top-right corner of the overlay.

<img width="250" src="/img/docs/ide_close_overlay.png" className="shadow-image" />
