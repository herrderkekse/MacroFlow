const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.extraNodeModules = {
    ...(config.resolver.extraNodeModules || {}),
    "expo-keep-awake": path.resolve(__dirname, "src/shims/expoKeepAwake.ts"),
};

module.exports = config;