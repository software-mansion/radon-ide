---
id: storybook-integration
title: Storybook integration
sidebar_position: 7
---

Radon IDE seamlessly integrates with Storybook. The extension automatically detects Storybook stories and provides a quick access to run them in the device preview.

<img width="200" src="/img/docs/ide_select_story.png" className="shadow-image" />

## Setting up Storybook

For setting up Storybook in your application please consult the [storybookjs/react-native repository README](https://github.com/storybookjs/react-native/blob/next/README.md).

## Selecting the story

The extension displays a `Select story` button over each story. Clicking this button will launch the chosen story in isolation.

<video autoPlay loop width="700" controls className="shadow-image">
  <source src="/video/ide_storybook.mp4" type="video/mp4" />
</video>

## Closing the story

You exit the story by using the `Go to main screen` button in the top-left corner of the panel or by reloading the application.
