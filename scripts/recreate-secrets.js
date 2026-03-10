const fs = require('fs');
const path = require('path');

/**
 * Recreates a file from a Base64 encoded environment variable.
 * This is used during EAS Build and GitHub Actions to inject secret files
 * that are not tracked by git (based on .gitignore).
 */
function recreateFile(envVar, filename) {
    const content = process.env[envVar];
    if (content) {
        console.log(`Recreating ${filename} from ${envVar}...`);
        try {
            // Check if it's already a JSON/plain string or base64
            // We assume base64 as it's the safest way to store multiline files in env vars
            const buffer = Buffer.from(content, 'base64');

            // Basic validation: if it's a JSON file, check if it starts with {
            const decoded = buffer.toString('utf-8');
            if (filename.endsWith('.json') && !decoded.trim().startsWith('{')) {
                console.error(`Error: Decoded content of ${envVar} does not look like a valid JSON.`);
                return;
            }

            fs.writeFileSync(path.join(process.cwd(), filename), buffer);
            console.log(`Successfully recreated ${filename}`);
        } catch (error) {
            console.error(`Error recreating ${filename}:`, error.message);
        }
    } else {
        console.log(`Environment variable ${envVar} not found. Skipping ${filename}.`);
    }
}

// Recreate Android configuration
recreateFile('ANDROID_GOOGLE_SERVICES_JSON_BASE64', 'google-services.json');

// Recreate iOS configuration
recreateFile('IOS_GOOGLE_SERVICES_INFO_PLIST_BASE64', 'GoogleService-Info.plist');
