const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const targetPath = path.join(
  repoRoot,
  "node_modules",
  "react-native-css-interop",
  "dist",
  "runtime",
  "native",
  "render-component.js",
);

function patch(content) {
  if (content.includes("CssInterop upgrade warning (IronTrain).")) return content;

  const originalWarning =
    "function printUpgradeWarning(warning, originalProps) {\n" +
    "    console.log(`CssInterop upgrade warning.\\n\\n${warning}.\\n\\nThis warning was caused by a component with the props:\\n${stringify(originalProps)}\\n\\nIf adding or removing sibling components caused this warning you should add a unique \"key\" prop to your components. https://react.dev/learn/rendering-lists#keeping-list-items-in-order-with-key\\n`);\n" +
    "}\n";

  const patchedWarning =
    "function printUpgradeWarning(warning, originalProps) {\n" +
    "    globalThis.__IRONTRAIN_CSS_INTEROP_WARN_COUNT__ ??= 0;\n" +
    "    globalThis.__IRONTRAIN_CSS_INTEROP_WARN_COUNT__ += 1;\n" +
    "    if (globalThis.__IRONTRAIN_CSS_INTEROP_WARN_COUNT__ > 3) {\n" +
    "        return;\n" +
    "    }\n" +
    "    let keys = \"\";\n" +
    "    try {\n" +
    "        keys = originalProps && typeof originalProps === \"object\" ? Object.keys(originalProps).slice(0, 20).join(\", \") : \"\";\n" +
    "    }\n" +
    "    catch { }\n" +
    "    console.log(`CssInterop upgrade warning (IronTrain).\\n\\n${warning}.\\n\\nProps keys: ${keys}\\n`);\n" +
    "}\n";

  if (content.includes(originalWarning)) {
    return content.replace(originalWarning, patchedWarning);
  }

  const idx = content.indexOf("function printUpgradeWarning(");
  if (idx === -1) return content;

  const endIdx = content.indexOf("}\nfunction stringify", idx);
  if (endIdx === -1) return content;

  return content.slice(0, idx) + patchedWarning + content.slice(endIdx + 2);
}

function main() {
  if (!fs.existsSync(targetPath)) return;
  const before = fs.readFileSync(targetPath, "utf8");
  const after = patch(before);
  if (after !== before) {
    fs.writeFileSync(targetPath, after, "utf8");
  }
}

main();
