const fs = require('fs');
const path = require('path');

const COLORS = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
};

const repoRoot = path.resolve(__dirname, '..');
let errors = 0;
let warnings = 0;

function logHeader(text) {
    console.log(`\n${COLORS.cyan}=== ${text} ===${COLORS.reset}`);
}

function logOk(text) {
    console.log(`${COLORS.green}✓${COLORS.reset} ${text}`);
}

function logWarn(text) {
    warnings++;
    console.log(`${COLORS.yellow}⚠${COLORS.reset} ${text}`);
}

function logError(text) {
    errors++;
    console.log(`${COLORS.red}✗${COLORS.reset} ${text}`);
}

// 1. Version Consistency
logHeader('Checking Version Consistency');
const packageJson = require('../package.json');
const appJson = require('../app.json');

if (packageJson.version === appJson.expo.version) {
    logOk(`Versions match: ${packageJson.version}`);
} else {
    logError(`Version mismatch! package.json: ${packageJson.version}, app.json: ${appJson.expo.version}`);
}

// 2. Critical Files (Local Environment)
logHeader('Checking Critical Build Files');
const criticalFiles = [
    'google-services.json',
    'GoogleService-Info.plist',
    'docs/CHANGELOG.md',
];

criticalFiles.forEach(file => {
    if (fs.existsSync(path.join(repoRoot, file))) {
        logOk(`${file} exists`);
    } else {
        logWarn(`${file} is missing locally. Ensure it is provided via EAS Secrets or manual injection.`);
    }
});

// 3. Changelog Synchronization
logHeader('Checking Changelog Sync');
const changelogMdPath = path.join(repoRoot, 'docs', 'CHANGELOG.md');
const changelogJsonPath = path.join(repoRoot, 'src', 'changelog.generated.json');

if (fs.existsSync(changelogMdPath) && fs.existsSync(changelogJsonPath)) {
    const mdStats = fs.statSync(changelogMdPath);
    const jsonStats = fs.statSync(changelogJsonPath);

    if (jsonStats.mtime >= mdStats.mtime) {
        logOk('generated changelog is up-to-date');
    } else {
        logWarn('docs/CHANGELOG.md is newer than src/changelog.generated.json. Run "npm run generate-changelog".');
    }
} else if (!fs.existsSync(changelogMdPath)) {
    logWarn('docs/CHANGELOG.md not found, cannot verify sync.');
}

// 4. website synchronization
logHeader('Checking Website Sync');
const websiteChangelogPath = path.join(repoRoot, 'website', 'content', 'CHANGELOG.md');
if (fs.existsSync(changelogMdPath) && fs.existsSync(websiteChangelogPath)) {
    const mainMd = fs.readFileSync(changelogMdPath, 'utf8');
    const webMd = fs.readFileSync(websiteChangelogPath, 'utf8');
    if (mainMd === webMd) {
        logOk('Website changelog is synced with docs/');
    } else {
        logWarn('Website changelog is OUT OF SYNC. Run "npm run website:sync-content".');
    }
}

// 5. EAS Ignore Check
logHeader('EAS Config Check');
const easIgnore = fs.readFileSync(path.join(repoRoot, '.easignore'), 'utf8');
if (easIgnore.includes('docs/')) {
    logOk('.easignore excludes docs/ (optimized build size)');
} else {
    logWarn('.easignore might be including docs/ unnecessarily.');
}

// Final Report
console.log('\n-----------------------------------');
if (errors > 0) {
    console.log(`${COLORS.red}AUDIT FAILED: ${errors} errors, ${warnings} warnings${COLORS.reset}`);
    process.exit(1);
} else if (warnings > 0) {
    console.log(`${COLORS.yellow}AUDIT PASSED with ${warnings} warnings.${COLORS.reset}`);
} else {
    console.log(`${COLORS.green}AUDIT PASSED PERFECTLY!${COLORS.reset}`);
}
console.log('-----------------------------------\n');
