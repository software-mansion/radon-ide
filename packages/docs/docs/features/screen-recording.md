---
id: screen-recording
title: Screen recording
sidebar_position: 6
---

The Radon IDE can record what's currently happens on the device preview. This proves to be extremely useful for rewinding to UI issues after they already happened. You can also granularly go through the recording frame by frame or save it as a file to your computer.

To use screen recording, you need enable replays in the device settings.

## Enabling the screen recording

<img width="350" src="/img/docs/ide_enable_replays.png" className="shadow-image" />

Enabling the screen recording option gives access to a new `Replay` button in the top-right corner of the Radon IDE panel.

<img width="350" src="/img/docs/ide_replays_enabled.png" className="shadow-image" />

## Using Replay

Clicking on the `Replay` button rewinds the last 5 seconds of what was happening on the device preview.

<video autoPlay loop width="700" controls className="shadow-image">
  <source src="/video/ide_screen_recording.mp4" type="video/mp4"/>
</video>

## Replay options

On the replay overlay you have access to some functionalities like:

<img width="500" src="/img/docs/ide_screen_recording.png" className="shadow-image" />

1. **Replay length** - allows to adjust the length of the recording for last _5s_, _10s_, _30s_, or _full_ length of the recording,
2. **Play/Pause button** - allows to manage the recording playback,
3. **Seekbar** - allows to seek through or skip to a part of the video,
4. **Previous frame** - jumps back one frame of the recording,
5. **Next frame** - jumps forward one frame of the recording,
6. **Save replay** - allows to save the recording.

## Closing the Replay overlay

You can close the overlay with a `x` button in the top-right corner of the overlay.

<img width="250" src="/img/docs/ide_close_overlay.png" className="shadow-image" />
