const { view } = require("__APPDIR__/.ondevice2/storybook.requires");
const AsyncStorage =
  require("__APPDIR__/node_modules/@react-native-async-storage/async-storage").default;
const { toId, storyNameFromExport } = require("__APPDIR__/node_modules/@storybook/csf");
import { View } from "react-native";

// eslint-disable-next-line @typescript-eslint/naming-convention
const StoryView = view.getStorybookUI({
  storage: {
    getItem: AsyncStorage.getItem,
    setItem: AsyncStorage.setItem,
  },
  onDeviceUI: false,
});

export function openStorybook() {
  const previewKey = "preview:/storybook:storybook";
  global.__RNIDE_previews.set(previewKey, {
    component: (
      <View style={{ flex: 1, marginTop: 100 }}>
        <StoryView />
      </View>
    ),
    name: "storybook",
  });
}

async function isStoryIdValid(storyId) {
  if (view === undefined) {
    throw new Error("View is undefined.");
  }
  const stories = await view._storyIndex.entries;
  return Object.values(stories).some((story) => story.id === storyId);
}

async function getCurrentStory() {
  if (view === undefined) {
    throw new Error("View is undefined.");
  }
  return await view._storage.getItem("lastOpenedStory");
}

export async function selectStorybookStory(componentTitle, storyName) {
  try {
    const preparedStoryName = storyNameFromExport(storyName);
    const storyId = toId(componentTitle, preparedStoryName);

    const currentStory = await getCurrentStory();
    if (currentStory && (!storyId || storyId === currentStory)) {
      return;
    }
    if (!isStoryIdValid(storyId)) {
      throw new Error("Incorrect story id.");
    }

    const preparedStory = await view._preview.storyStore.loadStory({
      storyId,
    });
    const story = view._preview.storyStore.getStoryContext(preparedStory);
    view._setStory(story);
  } catch (error) {
    console.log("Storybook story change error: ", error);
  }
}
