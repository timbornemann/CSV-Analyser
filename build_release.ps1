# Build and Release Script for CSV Analyzer
# 1. Increments version (patch)
# 2. Builds Windows app (.exe)
# 3. Copies artifact to releases/vX.Y.Z/
# 4. Git commits the release

$ErrorActionPreference = "Stop"

# Use npm to increment version in package.json and get the new version string (e.g. "v1.0.1")
$version_tag = npm version patch --no-git-tag-version
# Remove 'v' for json files if needed, though npm version usually outputs vX.Y.Z
$version = $version_tag -replace "^v", ""

Write-Host "New Version: $version" -ForegroundColor Green

# Update tauri.conf.json version
$tauriConfigPath = "src-tauri/tauri.conf.json"
$tauriConfig = Get-Content $tauriConfigPath | ConvertFrom-Json
$tauriConfig.version = $version
$tauriConfig | ConvertTo-Json -Depth 10 | Set-Content $tauriConfigPath

Write-Host "Updated tauri.conf.json to $version" -ForegroundColor Green

# Build the application
Write-Host "Building Tauri App..." -ForegroundColor Yellow
npm run tauri build

if ($LASTEXITCODE -ne 0) {
    Write-Error "Build failed!"
    exit 1
}

# Create Release Directory
$releaseDir = "releases/$version_tag"
if (-not (Test-Path $releaseDir)) {
    New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null
}

# Find built .exe (usually in src-tauri/target/release/bundle/nsis/)
$sourceExe = "src-tauri/target/release/bundle/nsis/*.exe"
$destExe = "$releaseDir/"

Write-Host "Copying installer to $releaseDir..." -ForegroundColor Yellow
Copy-Item $sourceExe -Destination $destExe -Force

# Create notes.md
$notesPath = "$releaseDir/notes.md"
if (-not (Test-Path $notesPath)) {
    "# Release Notes $version_tag`n`n- [ ] Add your release notes here." | Set-Content $notesPath
}

# Git operations
Write-Host "Staging release files..." -ForegroundColor Yellow
git add package.json src-tauri/tauri.conf.json $releaseDir

Write-Host "Ready to commit! Run: git commit -m 'Release $version_tag' && git push" -ForegroundColor Green
Write-Host "The GitHub Action will pick this up and create a Release." -ForegroundColor Cyan
