const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * deploy-hotfix.js
 * 
 * Flujo de emergencia robusto para construir APKs de producción localmente.
 * Reemplaza los pasos 5 y 6 del manual para casos de hotfix.
 * 
 * Basado en la lógica de deploy-mobile.js pero con compilación local
 * y subida directa vía GitHub CLI (gh).
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

function main() {
    const repoRoot = path.resolve(__dirname, '..');
    const appJsonPath = path.join(repoRoot, 'app.json');
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
    const version = appJson.expo.version;
    const tag = `v${version}`;
    const apkName = `IronTrain-${tag}.apk`;

    console.log(`\n\x1b[35m🚀 Iniciando Despliegue de Hotfix Local para ${tag}...\x1b[0m`);

    // 1. Verificación de Herramientas
    console.log('\n\x1b[34m[1/6] Verificando herramientas y entorno...\x1b[0m');
    const toolsOk =
        checkTool('java -version', 'Java JDK') &&
        checkTool('eas --version', 'EAS CLI') &&
        checkTool('gh --version', 'GitHub CLI (gh)');

    if (!toolsOk) {
        process.exit(1);
    }

    try {
        execSync('eas whoami', { stdio: 'ignore' });
        execSync('gh auth status', { stdio: 'ignore' });
    } catch (e) {
        console.error('\x1b[31m[ERROR] No has iniciado sesión en EAS o GitHub CLI.\x1b[0m');
        process.exit(1);
    }

    // 2. Audit (Parity con deploy-mobile)
    console.log('\n\x1b[34m[2/6] Ejecutando auditoría de integridad...\x1b[0m');
    try {
        execSync('npm run audit', { stdio: 'inherit' });
    } catch (e) {
        console.error('\x1b[31m[ERROR] Auditoría fallida. Abortando.\x1b[0m');
        process.exit(1);
    }

    // 3. Preparación de Secretos (Necesario para build local)
    console.log('\n\x1b[34m[3/6] Restaurando secretos de Firebase para la build...\x1b[0m');
    execSync('npm run eas-build-pre-install', { stdio: 'inherit' });

    // 4. Git Operations (Commit & Tag)
    console.log('\n\x1b[34m[4/6] Committing y Tagging (con [skip eas])...\x1b[0m');
    let commitCreated = false;
    let tagCreated = false;

    try {
        execSync('git add .', { stdio: 'inherit' });
        const status = execSync('git status --porcelain').toString();

        if (status.trim().length > 0) {
            // USAMOS [skip eas] para que GitHub Actions no dispare una build en la nube
            execSync(`git commit -m "chore: hotfix release ${version} [skip eas]"`, { stdio: 'inherit' });
            commitCreated = true;
            console.log(`Commit creado: chore: hotfix release ${version} [skip eas]`);
        } else {
            console.log('No hay cambios nuevos para commitear.');
        }

        // Tagging
        try { execSync(`git tag -d ${tag}`, { stdio: 'ignore' }); } catch (e) { }
        execSync(`git tag ${tag}`, { stdio: 'inherit' });
        tagCreated = true;
        console.log(`Tag ${tag} creado.`);

        // Pushing
        const currentBranch = execSync('git branch --show-current').toString().trim();
        execSync(`git push origin ${currentBranch}`, { stdio: 'inherit' });
        execSync('git push origin --tags', { stdio: 'inherit' });

    } catch (e) {
        console.error(`\x1b[31m[ERROR] Error en operaciones de Git: ${e.message}\x1b[0m`);
        console.log('\x1b[33mIntentando desacer cambios locales...\x1b[0m');
        if (tagCreated) execSync(`git tag -d ${tag}`, { stdio: 'ignore' });
        if (commitCreated) execSync('git reset --soft HEAD~1', { stdio: 'ignore' });
        process.exit(1);
    }

    // 5. Compilación Local de EAS
    console.log(`\n\x1b[34m[5/6] Construyendo APK localmente (Perfil: preview)...\x1b[0m`);
    try {
        // Generamos el APK directamente en la raíz
        execSync(`eas build --platform android --profile preview --local --non-interactive --output ./${apkName}`, { stdio: 'inherit' });
    } catch (e) {
        console.error('\x1b[31m[ERROR] La compilación falló.\x1b[0m');
        console.log('\x1b[33mNota: El tag y el código ya están en GitHub, pero no se pudo generar el APK.\x1b[0m');
        process.exit(1);
    }

    // 6. GitHub Release upload
    console.log('\n\x1b[34m[6/6] Subiendo APK a GitHub Releases...\x1b[0m');
    try {
        // Extraer notas de changelog.generated.json
        const changelogPath = path.join(repoRoot, 'src', 'changelog.generated.json');
        let notes = 'Hotfix update';
        if (fs.existsSync(changelogPath)) {
            const changelog = JSON.parse(fs.readFileSync(changelogPath, 'utf8'));
            const release = changelog.releases.find(r => r.version === version);
            if (release) {
                notes = release.items.map(i => `- ${i}`).join('\n');
            }
        }

        // Creamos el release (o lo actualizamos si falla algo)
        // Usamos notes heredadas del changelog
        const tempNotesPath = path.join(repoRoot, 'temp_notes.txt');
        fs.writeFileSync(tempNotesPath, notes);

        execSync(`gh release create ${tag} ./${apkName} --title "IronTrain ${tag} (Hotfix)" --notes-file temp_notes.txt`, { stdio: 'inherit' });

        fs.unlinkSync(tempNotesPath);
    } catch (e) {
        console.error(`\x1b[31m[ERROR] Falló la subida a GitHub Releases: ${e.message}\x1b[0m`);
        console.log(`\x1b[33mPuedes subir el APK manualmente (${apkName}) a la release ${tag}.\x1b[0m`);
        process.exit(1);
    }

    // Limpieza final de secretos (opcional pero recomendado por seguridad)
    console.log('\n\x1b[32m✅ ¡Despliegue de Hotfix finalizado con éxito!\x1b[0m');
    console.log(`Versión: ${tag}`);
    console.log(`Link: https://github.com/Mateo-Piedra22/IronTrain/releases/tag/${tag}\n`);
}

main();
