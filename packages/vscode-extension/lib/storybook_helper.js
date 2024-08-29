async function isStoryIdValid(storyId) {
  const stories = await view._storyIndex.entries;
  return Object.values(stories).some((story) => story.id === storyId);
}

export async function storybookPreview(componentTitle, storyName) {
  try {
    const { view } = require("__APPDIR__/.storybook/storybook.requires");
    const { toId, storyNameFromExport } = require("__APPDIR__/node_modules/@storybook/csf");
    if (view === undefined) {
      throw new Error("Storybook view is undefined.");
    }

    const preparedStoryName = storyNameFromExport(storyName);
    const storyId = toId(componentTitle, preparedStoryName);
    if (!isStoryIdValid(storyId)) {
      throw new Error("Incorrect story id.");
    }

    const preparedStory = await view._preview.storyStore.loadStory({
      storyId,
    });
    const story = view._preview.storyStore.getStoryContext(preparedStory);
    view._setStory(story);

    // eslint-disable-next-line @typescript-eslint/naming-convention
    const { unboundStoryFn: StoryComponent } = story;

    if (StoryComponent === undefined) {
      throw new Error("Component is undefined.");
    }

    const key = `sb://${storyId}`;
    global.__RNIDE_previews.set(key, {
      component: <StoryComponent {...story} />,
      name: storyId,
    });

    return key;
  } catch (e) {
    console.error("Failed to select story: ", e);
  }
}
