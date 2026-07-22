// Babel config used by Jest (and available to Metro). Expo's Metro bundler
// applies babel-preset-expo automatically, so this is primarily for the test
// transform.
module.exports = function (api) {
    api.cache(true);
    return {
        presets: ["babel-preset-expo"],
    };
};
