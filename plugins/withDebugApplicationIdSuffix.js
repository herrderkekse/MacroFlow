const { withAppBuildGradle } = require("@expo/config-plugins");

/**
 * Debug builds (expo run:android / EAS development profile) get a distinct
 * applicationId so they can be installed alongside the release app without
 * a signature conflict, each with its own local SQLite database.
 */
const withDebugApplicationIdSuffix = (config) =>
    withAppBuildGradle(config, (config) => {
        if (config.modResults.contents.includes("applicationIdSuffix")) {
            return config;
        }
        config.modResults.contents = config.modResults.contents.replace(
            /(buildTypes\s*\{\s*debug\s*\{)/,
            `$1\n            applicationIdSuffix ".dev"`
        );
        return config;
    });

module.exports = withDebugApplicationIdSuffix;
