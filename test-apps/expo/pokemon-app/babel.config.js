module.exports = function (api) {
  api.cache(false);
  return {
    presets: ['babel-preset-expo'],
    env: {
      production: {
        plugins: ['react-native-paper/babel', 'module:react-native-dotenv', {
          envName: 'APP_ENV',
          moduleName: '@env',
          path: '.env',
          blocklist: null,
          allowlist: null,
          blacklist: null, // DEPRECATED
          whitelist: null, // DEPRECATED
          safe: false,
          allowUndefined: true,
          verbose: false,
        },],
      },
    },
  };
};
