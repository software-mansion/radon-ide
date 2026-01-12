import { ChatTestCase } from "./models";

export const testCases: ChatTestCase[] = [
  {
    prompt: "How to use Shared Element Transitions in Reanimated 4?",
    allowedToolIds: ["query_documentation"],
  },
  {
    prompt: "How to use SETs in Reanimated?",
    allowedToolIds: ["query_documentation"],
  },
  {
    prompt: "Implement an example interaction with a local LLM in my app.",
    allowedToolIds: ["query_documentation"],
  },
  {
    prompt: "Add LLM chat to my app.",
    allowedToolIds: ["query_documentation"],
  },

  {
    prompt: "My button in the center of the screen is malformed.",
    allowedToolIds: ["view_component_tree", "view_screenshot"],
  },
  {
    prompt: "The orange button is ugly. Fix it.",
    allowedToolIds: ["view_component_tree", "view_screenshot"],
  },

  {
    prompt: "Restart the app.",
    allowedToolIds: ["reload_application"],
  },
  {
    prompt: "The app is frozen. Can you reset it?",
    allowedToolIds: ["reload_application"],
  },

  {
    prompt: "Why did the app just crash?",
    allowedToolIds: ["view_application_logs"],
  },
  {
    prompt: "Are there any errors in the logs?",
    allowedToolIds: ["view_application_logs"],
  },
  {
    prompt: "Debug the error thrown when I clicked the login button.",
    allowedToolIds: ["view_application_logs", "view_component_tree"],
  },

  {
    prompt: "Does the layout look broken to you?",
    allowedToolIds: ["view_screenshot"],
  },
  {
    prompt: "I think the text is being cut off on the right side.",
    allowedToolIds: ["view_screenshot"],
  },
  {
    prompt: "Verify if the dark mode colors are applied correctly.",
    allowedToolIds: ["view_screenshot"],
  },
  {
    prompt: "Take a look at the current screen.",
    allowedToolIds: ["view_screenshot"],
  },

  {
    prompt: "What is the hierarchy of the current screen?",
    allowedToolIds: ["view_component_tree"],
  },
  {
    prompt: "Show me the props passed to the Header component.",
    allowedToolIds: ["view_component_tree"],
  },
  {
    prompt: "Is the 'Submit' button currently inside a SafeAreaView?",
    allowedToolIds: ["view_component_tree"],
  },
  {
    prompt: "Find the component ID for the bottom navigation bar.",
    allowedToolIds: ["view_component_tree"],
  },

  {
    prompt: "Why is the banner not showing up?",
    allowedToolIds: ["view_component_tree", "view_application_logs", "view_screenshot"],
  },
  {
    prompt: "Inspect the padding on the user profile card.",
    allowedToolIds: ["view_component_tree", "view_screenshot"],
  },
];
