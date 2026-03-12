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

    // 2. Patch activateKeepAwakeAsync definition (Atomic fix)
    if (!patched.includes("// IronTrain: Suppress activation errors")) {
        const targetDef = `export async function activateKeepAwakeAsync(tag: string = ExpoKeepAwakeTag): Promise<void> {
  await ExpoKeepAwake.activate?.(tag);
}`;
        const patchedDef = `export async function activateKeepAwakeAsync(tag: string = ExpoKeepAwakeTag): Promise<void> {
  try {
    await ExpoKeepAwake.activate?.(tag);
  } catch (e) {
    // IronTrain: Suppress activation errors to prevent app crashes or freezes
    console.warn('[IronTrain] Failed to activate keep awake:', e);
  }
}`;
        if (patched.includes(targetDef)) {
            patched = patched.replace(targetDef, patchedDef);
        }
    }

    // 3. Patch deactivateKeepAwake definition (Atomic fix)
    if (!patched.includes("// IronTrain: Suppress deactivation errors")) {
        const targetDef = `export async function deactivateKeepAwake(tag: string = ExpoKeepAwakeTag): Promise<void> {
  await ExpoKeepAwake.deactivate?.(tag);
}`;
        const patchedDef = `export async function deactivateKeepAwake(tag: string = ExpoKeepAwakeTag): Promise<void> {
  try {
    await ExpoKeepAwake.deactivate?.(tag);
  } catch (e) {
    // IronTrain: Suppress deactivation errors
    console.warn('[IronTrain] Failed to deactivate keep awake:', e);
  }
}`;
        if (patched.includes(targetDef)) {
            patched = patched.replace(targetDef, patchedDef);
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
