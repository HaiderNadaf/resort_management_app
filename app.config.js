const { expo } = require('./app.json');

/** @returns {{ expo: import('@expo/config').ExpoConfig }} */
module.exports = () => ({
  expo: {
    ...expo,
    updates: {
      ...expo.updates,
      ...(process.env.EXPO_PUBLIC_UPDATES_URL ? { url: process.env.EXPO_PUBLIC_UPDATES_URL } : {}),
    },
  },
});
