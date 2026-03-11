const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * deploy-hotfix.js
 * 
 * Flujo de emergencia robusto para construir APKs de producción localmente.
 * Reemplaza los pasos 5 y 6 del manual para casos de hotfix.
 * 
 * Corrección para Windows: Utiliza WSL para el comando 'eas build --local'
 * ya que EAS CLI no soporta builds locales en Windows directamente.
 */

function checkTool(cmd, name) {
    try {
        execSync(cmd, { stdio: 'ignore' });
        return true;
    } catch (e) {
        console.error(`\x1b[31m[ERROR] ${name} no está accesible.\x1b[0m`);
        return false;
    }
}

function rollback(tag, commitCreated) {
    console.log(`\n\x1b[33m🔄 Iniciando Rollback de seguridad...\x1b[0m`);
    try {
        console.log(`Borrando tag local ${tag}...`);
        execSync(`git tag -d ${tag}`, { stdio: 'ignore' });
    } catch (e) { }

    try {
        console.log(`Borrando tag remoto ${tag}...`);
        execSync(`git push --delete origin ${tag}`, { stdio: 'ignore' });
    } catch (e) { }

    if (commitCreated) {
        console.log(`Desaciendo último commit...`);
        try { execSync('git reset --soft HEAD~1', { stdio: 'ignore' }); } catch (e) { }
    }
    console.log(`\x1b[32mRollback finalizado. El estado ha vuelto a la normalidad.\x1b[0m`);
}

function main() {
    const repoRoot = path.resolve(__dirname, '..');
    const appJsonPath = path.join(repoRoot, 'app.json');
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
    const version = appJson.expo.version;
    const tag = `v${version}`;
    const apkName = `IronTrain-${tag}.apk`;

    let commitCreated = false;

    console.log(`\n\x1b[35m🚀 Iniciando Despliegue de Hotfix Local para ${tag}...\x1b[0m`);

    // 1. Verificación de Herramientas
    console.log('\n\x1b[34m[1/6] Verificando herramientas locales...\x1b[0m');
    const toolsOk =
        checkTool('java -version', 'Java JDK') &&
        checkTool('eas --version', 'EAS CLI') &&
        checkTool('gh --version', 'GitHub CLI (gh)');

    if (!toolsOk) process.exit(1);

    // 2. Audit
    console.log('\n\x1b[34m[2/6] Ejecutando auditoría de integridad...\x1b[0m');
    try {
        execSync('npm run audit', { stdio: 'inherit' });
    } catch (e) {
        console.error('\x1b[31m[ERROR] Auditoría fallida. Abortando.\x1b[0m');
        process.exit(1);
    }

    // 3. Git Operations (Commit & Tag)
    console.log('\n\x1b[34m[3/6] Committing y Tagging (con [skip eas])...\x1b[0m');
    try {
        execSync('git add .', { stdio: 'inherit' });
        const status = execSync('git status --porcelain').toString();

        if (status.trim().length > 0) {
            execSync(`git commit -m "chore: hotfix release ${version} [skip eas]"`, { stdio: 'inherit' });
            commitCreated = true;
        }

        try { execSync(`git tag -d ${tag}`, { stdio: 'ignore' }); } catch (e) { }
        execSync(`git tag ${tag}`, { stdio: 'inherit' });

        const currentBranch = execSync('git branch --show-current').toString().trim();
        execSync(`git push origin ${currentBranch}`, { stdio: 'inherit' });
        execSync('git push origin --tags', { stdio: 'inherit' });
    } catch (e) {
        console.error(`\x1b[31m[ERROR] Fallo en Git: ${e.message}\x1b[0m`);
        rollback(tag, commitCreated);
        process.exit(1);
    }

    // 4. Preparación de Secretos
    console.log('\n\x1b[34m[4/6] Restaurando secretos para la build...\x1b[0m');
    execSync('npm run eas-build-pre-install', { stdio: 'inherit' });

    // 5. Compilación Local de EAS (FIX PARA WINDOWS)
    console.log(`\n\x1b[34m[5/6] Construyendo APK localmente (Perfil: preview)...\x1b[0m`);

    let buildCmd = `eas build --platform android --profile preview --local --non-interactive --output ./${apkName}`;

    // Si estamos en Windows, intentamos usar WSL para el build de Android
    if (process.platform === 'win32') {
        console.log('\x1b[33mDetecado Windows. Usando WSL para evitar el bloqueo de plataforma de EAS...\x1b[0m');
        buildCmd = `wsl bash -c "eas build --platform android --profile preview --local --non-interactive --output ./${apkName}"`;
    }

    try {
        execSync(buildCmd, { stdio: 'inherit' });
    } catch (e) {
        console.error('\x1b[31m[ERROR] La compilación falló.\x1b[0m');
        if (process.platform === 'win32') {
            console.log('\x1b[33mNota: EAS en Windows requiere WSL con Node instalado internamente para builds locales.\x1b[0m');
        }
        rollback(tag, commitCreated);
        process.exit(1);
    }

    // 6. GitHub Release upload
    console.log('\n\x1b[34m[6/6] Subiendo APK a GitHub Releases...\x1b[0m');
    try {
        const changelogPath = path.join(repoRoot, 'src', 'changelog.generated.json');
        let notes = 'Hotfix update';
        if (fs.existsSync(changelogPath)) {
            const changelog = JSON.parse(fs.readFileSync(changelogPath, 'utf8'));
            const release = changelog.releases.find(r => r.version === version);
            if (release) notes = release.items.map(i => `- ${i}`).join('\n');
        }

        const tempNotesPath = path.join(repoRoot, 'temp_notes.txt');
        fs.writeFileSync(tempNotesPath, notes);
        execSync(`gh release create ${tag} ./${apkName} --title "IronTrain ${tag} (Hotfix)" --notes-file temp_notes.txt`, { stdio: 'inherit' });
        fs.unlinkSync(tempNotesPath);
    } catch (e) {
        console.error(`\x1b[31m[ERROR] Falló la subida a GitHub Releases: ${e.message}\x1b[0m`);
        rollback(tag, commitCreated);
        process.exit(1);
    }

    console.log(`\n\x1b[32m✅ ¡Despliegue de Hotfix finalizado con éxito para ${tag}!\x1b[0m\n`);
}

main();
