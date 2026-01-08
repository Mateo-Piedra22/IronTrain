# IronTrain One-Click Dev Script

# 1. Add Android Tools to Path (Session Only)
Write-Host "Configuring Android Environment..."
$base = $env:LOCALAPPDATA
$platformTools = "$base\Android\Sdk\platform-tools"
$emulator = "$base\Android\Sdk\emulator"
$env:Path = "$platformTools;$emulator;$env:Path"

# 2. Check/Start Emulator
Write-Host "Checking Emulator..."
$running = Get-Process emulator -ErrorAction SilentlyContinue
if (-not $running) {
    Write-Host "   Starting 'Medium_Phone_API_36.1'..."
    Start-Process emulator -ArgumentList "-avd Medium_Phone_API_36.1" -NoNewWindow
    Write-Host "   Waiting for emulator to warm up (10s)..."
    Start-Sleep -Seconds 10
} else {
    Write-Host "   Emulator already running."
}

# 3. Start Expo
Write-Host "Starting IronTrain..."
npx expo start --android
