import AsyncStorage from "@react-native-async-storage/async-storage";
import { view } from "./storybook.requires";
// import { toId } from "@storybook/csf";

const StorybookUIRoot = view.getStorybookUI({
  storage: {
    getItem: AsyncStorage.getItem,
    setItem: AsyncStorage.setItem,
  },
});

export default StorybookUIRoot;

// const test = () => {
//   setTimeout(async () => {
//     console.log("FRYTKI XX StorybookUIRoot", StorybookUIRoot);
//   }, 100);
// };
// test();

// // FRYTKI CHANGE ACTIVE STORY TO ANOTHER (TO BE DELETED)
// const changeStory = (componentTitle: string, storyTitle: string) => {
//   setTimeout(async () => {
//     const storyId = toId(componentTitle, storyTitle);
//     console.log("FRYTKI storyId", storyId);

//     console.log("FRYTKI entries", (await global.view._storyIndex.entries)!);

//     console.log(
//       "FRYTKI selected story (1):",
//       await global.view._storage.getItem("lastOpenedStory")
//     );

//     const preparedStory = await global.view._preview.storyStore.loadStory({
//       storyId,
//     });

//     preparedStory.

//     const story =
//       global.view._preview.storyStore.getStoryContext(preparedStory);

//     // @ts-ignore
//     global.view._setStory(story);

//     console.log(
//       "FRYTKI selected story (2):",
//       await global.view._storage.getItem("lastOpenedStory")
//     );
//   }, 1500);
// };

// changeStory("UglyButton", "Basic");
// // // changeStory("mybutton--basic");
// // // changeStory("uglybutton--basic");

// export default StorybookUIRoot;

// import { StoryRender } from "@storybook/preview-api/dist/preview-web/render/StoryRender";

// const render = new StoryRender()(
//   this.channel,
//   this.storyStoreValue,
//   renderToCanvas,
//   this.mainStoryCallbacks(storyId),
//   storyId,
//   "story"
// );
