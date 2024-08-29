export default {
  expo: {
    scheme: "acme",
    web: {
      bundler: "metro",
    },
    name: "expo-router-example",
    slug: "expo-router-example",
    android: {
      package: "com.kmagiera.exporouterexample",
    },
    ios: {
      bundleIdentifier: "com.kmagiera.exporouterexample",
    },
    extra: {
      storybookEnabled: process.env.STORYBOOK_ENABLED,
    },
  },
};
