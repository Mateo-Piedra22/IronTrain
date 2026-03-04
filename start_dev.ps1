# IronTrain One-Click Dev Script (Physical USB Device Edition)

# 1. Add Android Tools to Path (Session Only)
Write-Host "Configuring Android Environment for Physical Device..."
$base = $env:LOCALAPPDATA
$androidSdk = "$base\Android\Sdk"
$platformTools = "$androidSdk\platform-tools"

# Inject Android SDK and Studio's bundled JDK so Gradle can compile the native modules
$env:ANDROID_HOME = $androidSdk
$studioJbr = "C:\Program Files\Android\Android Studio\jbr"
if (Test-Path $studioJbr) {
    $env:JAVA_HOME = $studioJbr
    $env:Path = "$studioJbr\bin;$platformTools;$env:Path"
}
else {
    $env:Path = "$platformTools;$env:Path"
}

# 2. Wait for Physical Device
Write-Host ""
Write-Host "Waiting for a physical Android device via USB..."
Write-Host "--> Please connect your phone with a USB cable."
Write-Host "--> Ensure 'USB Debugging' is enabled in Developer Options."
try { adb start-server | Out-Null } catch {}

$serial = $null
while ($true) {
    $lines = adb devices
    
    # Check for unauthorized devices first
    $unauthLine = $lines | Select-String -Pattern '^([^\s]+)\s+unauthorized$' | Where-Object { $_.Line -notmatch 'emulator-' } | Select-Object -First 1
    if ($unauthLine) {
        Write-Host "   (!) Device detected but UNAUTHORIZED. Please accept the RSA prompt on your phone's screen!"
        Start-Sleep -Seconds 3
        continue
    }

    # Look for a device that is NOT an emulator
    $deviceLine = $lines | Select-String -Pattern '^([^\s]+)\s+device$' | Where-Object { $_.Line -notmatch 'emulator-' } | Select-Object -First 1
    if ($deviceLine) {
        $serial = $deviceLine.Matches.Groups[1].Value
        Write-Host "   (V) Physical device found: $serial"
        break
    }
    
    Start-Sleep -Seconds 3
}

# 3. Handle Screen Mirroring (scrcpy)
Write-Host "Checking for scrcpy (Screen Mirroring)..."
$scrcpyPath = Get-Command scrcpy -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Definition

if (-not $scrcpyPath) {
    # Find scrcpy.exe anywhere inside the winget packages
    $scrcpyExe = Get-ChildItem -Path "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Filter "scrcpy.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($scrcpyExe) {
        $scrcpyPath = $scrcpyExe.FullName
    }
}

if ($scrcpyPath) {
    Write-Host "Starting screen mirroring (scrcpy)..."
    Start-Process $scrcpyPath -ArgumentList "-s $serial" -WindowStyle Hidden
}
else {
    Write-Host "scrcpy not found. Installing via winget so you can see your phone on PC..."
    try {
        winget install --id Genymobile.scrcpy --silent --accept-package-agreements --accept-source-agreements
        Write-Host "Locating scrcpy..."
        $scrcpyExe = Get-ChildItem -Path "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Filter "scrcpy.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
        
        if ($scrcpyExe) {
            Write-Host "Installation successful! Starting screen mirroring..."
            $scrcpyPath = $scrcpyExe.FullName
            Start-Process $scrcpyPath -ArgumentList "-s $serial" -WindowStyle Hidden
        }
        else {
            Write-Host "Warning: Could not automatically locate scrcpy after install."
        }
    }
    catch {
        Write-Host "Failed to install scrcpy automatically. Screen mirroring won't be available."
    }
}

# 4. Start Expo Native Build
Write-Host "Creating Short-Path Junction to bypass CMake MAX_PATH (260 characters) limits..."
$junctionPath = "C:\IT"
if (Test-Path $junctionPath) {
    # If it's a junction, we must use rmdir to remove it properly on Windows
    cmd /c rmdir $junctionPath
}
cmd /c mklink /J $junctionPath $PSScriptRoot | Out-Null

Write-Host "Starting IronTrain (Native Build) from Short-Path root ($junctionPath)..."
Set-Location $junctionPath
npx expo run:android

# 5. Cleanup
Set-Location "$PSScriptRoot"
# Only remove the junction, not the content
cmd /c rmdir $junctionPath | Out-Null
Write-Host "Development Session Ended."
