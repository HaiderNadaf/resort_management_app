const { expo } = require('./app.json');

/** @returns {{ expo: import('@expo/config').ExpoConfig }} */
module.exports = () => ({
  expo: {
    ...expo,
    updates: {
      ...expo.updates,
      ...(process.env.EXPO_PUBLIC_UPDATES_URL ? { url: process.env.EXPO_PUBLIC_UPDATES_URL } : {}),
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
