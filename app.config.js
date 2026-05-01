const { expo } = require('./app.json');
const DEFAULT_UPDATES_URL = 'https://u.expo.dev/be6f4343-3e14-4370-b2c8-60a5741b5664';

/** @returns {{ expo: import('@expo/config').ExpoConfig }} */
module.exports = () => ({
  expo: {
    ...expo,
    updates: {
      ...expo.updates,
      url: process.env.EXPO_PUBLIC_UPDATES_URL || expo.updates?.url || DEFAULT_UPDATES_URL,
    },
    extra: {
      ...(expo.extra || {}),
      eas: {
        ...(expo.extra?.eas || {}),
        ...(process.env.EAS_PROJECT_ID ? { projectId: process.env.EAS_PROJECT_ID } : {}),
      },
    },
  },
});
