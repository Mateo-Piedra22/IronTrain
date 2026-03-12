const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const targetPath = path.join(
    repoRoot,
    "node_modules",
    "expo-keep-awake",
    "src",
    "index.ts",
);

function patch(content) {
    let patched = content;

    // 1. Patch useKeepAwake hook (the .then() block)
    if (!patched.includes("// IronTrain: added catch to prevent uncaught promise rejection")) {
        const targetSnippet = `    activateKeepAwakeAsync(tagOrDefault).then(() => {
      if (isMounted && ExpoKeepAwake.addListenerForTag && options?.listener) {
        addListener(tagOrDefault, options.listener);
      }
    });`;

        const patchedSnippet = `    activateKeepAwakeAsync(tagOrDefault).then(() => {
      if (isMounted && ExpoKeepAwake.addListenerForTag && options?.listener) {
        addListener(tagOrDefault, options.listener);
      }
    }).catch(() => {
      // IronTrain: added catch to prevent uncaught promise rejection
    });`;

        if (patched.includes(targetSnippet)) {
            patched = patched.replace(targetSnippet, patchedSnippet);
        }
    }

    return patched;
}

function main() {
    if (!fs.existsSync(targetPath)) {
        console.log("expo-keep-awake source not found at " + targetPath);
        return;
    }
    const before = fs.readFileSync(targetPath, "utf8");
    const after = patch(before);
    if (after !== before) {
        fs.writeFileSync(targetPath, after, "utf8");
        console.log("Successfully patched expo-keep-awake with atomic safety");
    } else {
        console.log("expo-keep-awake is already patched or target snippets not found.");
    }
}

main();
