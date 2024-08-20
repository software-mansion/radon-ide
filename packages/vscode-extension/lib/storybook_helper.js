const { view } = require("__APPDIR__/.ondevice2/storybook.requires");
const AsyncStorage =
  require("__APPDIR__/node_modules/@react-native-async-storage/async-storage").default;
const { toId } = require("__APPDIR__/node_modules/@storybook/csf");
// import { useState } from "react";

// storybookState
let storybookState = true;

const storybookUIRoot = view.getStorybookUI({
  storage: {
    getItem: AsyncStorage.getItem,
    setItem: AsyncStorage.setItem,
  },
});
// console.log("FRYTKI view", view);

function launchStorybook() {}

export function openStorybook() {
  // if (storybookState === open) {
  //   return;
  // }

  try {
    const previewKey = "preview:/123:123";
    global.__RNIDE_previews.set(previewKey, {
      component: storybookUIRoot,
      name: "123",
    });
    // console.log("FRYTKI previewKey", previewKey);
  } catch (error) {
    console.log("FRYTKI error", error);
  }
}

export async function closeStorybook() {
  // todo
  // setStorybookState(false);
}

async function isStoryIdValid(storyId) {
  if (view === undefined) {
    throw new Error("Storybook view in undefined.");
  }
  const stories = await view._storyIndex.entries;
  return Object.values(stories).some((story) => story.id === storyId);
}

async function getCurrentStory() {
  if (view === undefined) {
    throw new Error("Storybook view in undefined.");
  }
  return await view._storage.getItem("lastOpenedStory");
}

export async function selectStorybookStory(componentTitle, storyName) {
  try {
    const storyId = toId(componentTitle, storyName);
    const currentStory = await getCurrentStory();
    // console.log("FRYTKI currentStory", currentStory);
    if (currentStory && (!storyId || storyId === activeStory)) {
      console.log("Story already set.");
      return;
    }
    if (!isStoryIdValid(storyId)) {
      throw new Error("Incorrect storybook story Id.");
    }

    const preparedStory = await view._preview.storyStore.loadStory({
      storyId,
    });
    const story = view._preview.storyStore.getStoryContext(preparedStory);
    view._setStory(story);
    console.log("Story set successfully.");
  } catch (error) {
    console.log("Storybook story change error message: ", error);
  }
}
