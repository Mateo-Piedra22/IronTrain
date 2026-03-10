const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function main() {
    const repoRoot = path.resolve(__dirname, '..');
    const appJsonPath = path.join(repoRoot, 'app.json');
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
    const version = appJson.expo.version;
    const tag = `v${version}`;

    console.log(`\x1b[36m=== Starting Automated Deployment for ${tag} ===\x1b[0m`);

    // 1. Audit
    console.log('\n\x1b[34m[1/5] Running Final Audit...\x1b[0m');
    execSync('npm run audit', { stdio: 'inherit' });

    // 2. Git Commit
    console.log('\n\x1b[34m[2/5] Committing release changes...\x1b[0m');
    try {
        execSync('git add .', { stdio: 'inherit' });
        // Check if there are changes to commit
        const status = execSync('git status --porcelain').toString();
        if (status.trim().length > 0) {
            execSync(`git commit -m "chore: release ${version}"`, { stdio: 'inherit' });
            console.log(`Changes committed for version ${version}`);
        } else {
            console.log('No changes to commit.');
        }
    } catch (e) {
        console.warn('Git commit failed (maybe no changes or git not configured). Continuing...');
    }

    // 3. Git Tag
    console.log('\n\x1b[34m[3/5] Creating Git Tag ${tag}...\x1b[0m');
    try {
        // Delete tag if exists locally (to allow re-tagging if something failed)
        try { execSync(`git tag -d ${tag}`, { stdio: 'ignore' }); } catch (e) { }
        execSync(`git tag ${tag}`, { stdio: 'inherit' });
        console.log(`Tag ${tag} created.`);
    } catch (e) {
        console.error(`Failed to create tag ${tag}: ${e.message}`);
        process.exit(1);
    }

    // 4. Git Push
    console.log('\n\x1b[34m[4/5] Pushing to origin...\x1b[0m');
    try {
        execSync('git push origin main', { stdio: 'inherit' });
        execSync('git push origin --tags', { stdio: 'inherit' });
    } catch (e) {
        console.error(`Failed to push to origin: ${e.message}`);
        process.exit(1);
    }

    // 5. Success Message
    console.log(`\n\x1b[32m=== Deployment Process Initiated Successfully! ===\x1b[0m`);
    console.log(`\x1b[32mVersion ${tag} is now on GitHub. "release-android.yml" will trigger the EAS build shortly.\x1b[0m\n`);
}

main();
