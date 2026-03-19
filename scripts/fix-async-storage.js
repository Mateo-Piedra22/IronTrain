const { withProjectBuildGradle, withSettingsGradle } = require('@expo/config-plugins');

/**
 * Expo Config Plugin to fix @react-native-async-storage/async-storage build failure on Android.
 * This plugin is highly robust and ensures that the local Maven repository is correctly
 * injected during the prebuild phase, making it compatible with EAS Build.
 */
const withAsyncStorageRepo = (config) => {
    // 1. Modify project-level build.gradle (allprojects)
    config = withProjectBuildGradle(config, (config) => {
        let contents = config.modResults.contents;
        if (!contents.includes('@react-native-async-storage/async-storage/android/local_repo')) {
            const entry = `\n        maven { url uri("$rootDir/../node_modules/@react-native-async-storage/async-storage/android/local_repo") }`;
            contents = contents.replace(
                /allprojects\s*\{\s*repositories\s*\{/,
                `allprojects {\n    repositories {${entry}`
            );
        }
        config.modResults.contents = contents;
        return config;
    });

    // 2. Modify settings.gradle to ensure dependencyResolutionManagement has the repo
    config = withSettingsGradle(config, (config) => {
        let contents = config.modResults.contents;

        // Change PREFER_SETTINGS to PREFER_PROJECT to ensure local library repos are respected
        // this is a critical fix for Async Storage 3.x and SDK 54+
        contents = contents.replace(/RepositoriesMode\.PREFER_SETTINGS/g, 'RepositoriesMode.PREFER_PROJECT');

        if (!contents.includes('@react-native-async-storage/async-storage/android/local_repo')) {
            const entry = `\n        maven { url uri("$rootDir/../node_modules/@react-native-async-storage/async-storage/android/local_repo") }`;

            // Inject into dependencyResolutionManagement repositories block if present
            if (contents.includes('dependencyResolutionManagement')) {
                contents = contents.replace(
                    /(dependencyResolutionManagement\s*\{[\s\S]*?repositories\s*\{)/,
                    `$1${entry}`
                );
            }
        }

        config.modResults.contents = contents;
        return config;
    });

    return config;
};

module.exports = withAsyncStorageRepo;
