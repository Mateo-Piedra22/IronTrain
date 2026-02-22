# IronTrain One-Click Dev Script

# 1. Add Android Tools to Path (Session Only)
Write-Host "Configuring Android Environment..."
$base = $env:LOCALAPPDATA
$androidSdk = "$base\Android\Sdk"
$platformTools = "$androidSdk\platform-tools"
$emulator = "$androidSdk\emulator"

# Inject Android SDK and Studio's bundled JDK so Gradle can compile the native modules
$env:ANDROID_HOME = $androidSdk
$studioJbr = "C:\Program Files\Android\Android Studio\jbr"
if (Test-Path $studioJbr) {
    $env:JAVA_HOME = $studioJbr
    $env:Path = "$studioJbr\bin;$platformTools;$emulator;$env:Path"
}
else {
    $env:Path = "$platformTools;$emulator;$env:Path"
}

# 2. Check/Start Emulator
Write-Host "Checking Emulator..."
$running = Get-Process emulator -ErrorAction SilentlyContinue
if (-not $running) {
    Write-Host "   Starting 'Medium_Phone_API_36.1'..."
    Start-Process emulator -ArgumentList "-avd Medium_Phone_API_36.1" -NoNewWindow
}
else {
    Write-Host "   Emulator already running."
}

# 3. Wait for Device
Write-Host "Waiting for device..."
try { adb kill-server | Out-Null } catch {}
try { adb start-server | Out-Null } catch {}

$deadline = (Get-Date).AddMinutes(4)
$serial = $null
while ((Get-Date) -lt $deadline) {
    $lines = adb devices
    $deviceLine = $lines | Select-String -Pattern '^emulator-\d+\s+' | Select-Object -First 1
    if ($deviceLine) {
        $parts = ($deviceLine.Line -split '\s+')
        $serial = $parts[0]
        $state = $parts[1]
        Write-Host "   $($serial): $state"
        if ($state -eq "device") { break }
        if ($state -eq "offline" -or $state -eq "unauthorized") {
            try { adb reconnect offline | Out-Null } catch {}
            try { adb reconnect device | Out-Null } catch {}
        }
    }
    Start-Sleep -Seconds 5
}

if (-not $serial) {
    throw "No emulator detected by adb."
}

$bootDeadline = (Get-Date).AddMinutes(4)
while ((Get-Date) -lt $bootDeadline) {
    $boot = adb -s $serial shell getprop sys.boot_completed
    if ($boot -eq "1") { break }
    Start-Sleep -Seconds 5
}

# 4. Start Expo (Native Dev Client required for Notifee)
Write-Host "Starting IronTrain (Native Build)..."
npx expo run:android
