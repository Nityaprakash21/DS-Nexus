# ===================================================================
# DS Nexus Automated Backup Script
# Backs up MongoDB ('EMPLOYEE_MANAGEMENT_SYSTEM') + Codebase
# ===================================================================

$Timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm"
$ProjectDir = "C:\Users\DELL\Desktop\DS-Nexus"
$TempDir = Join-Path $env:TEMP "DS_Nexus_Backup_$Timestamp"
$DbDumpDir = Join-Path $TempDir "Database"
$CodeDir = Join-Path $TempDir "Codebase"

# Google Drive Destination (Falls back to Desktop if Drive is not yet mounted)
$GDriveTarget = "H:\My Drive\DS Nexus"
$LocalFallback = "C:\Users\DELL\Desktop\DS_Nexus_Backups"

if (Test-Path "H:\My Drive") {
  $DestinationDir = "H:\My Drive\DS Nexus"
}
elseif (Test-Path "G:\My Drive") {
  $DestinationDir = "G:\My Drive\DS Nexus"
}
else {
  $DestinationDir = $LocalFallback
}

if (!(Test-Path $DestinationDir)) {
  New-Item -ItemType Directory -Path $DestinationDir -Force | Out-Null
}

$ZipOutputFile = Join-Path $DestinationDir "DS_Nexus_Backup_$Timestamp.zip"

Write-Host "[1/4] Preparing temporary directories..." -ForegroundColor Cyan
New-Item -ItemType Directory -Path $DbDumpDir -Force | Out-Null
New-Item -ItemType Directory -Path $CodeDir -Force | Out-Null

Write-Host "[2/4] Exporting MongoDB database (EMPLOYEE_MANAGEMENT_SYSTEM)..." -ForegroundColor Cyan
$exportScriptPath = Join-Path $ProjectDir "server\__temp_db_exporter.mjs"

$nodeExportScript = @'
import mongoose from "mongoose";
import fs from "fs";

const outDir = process.argv[2];

try {
  await mongoose.connect("mongodb://localhost:27017/EMPLOYEE_MANAGEMENT_SYSTEM");
  const collections = await mongoose.connection.db.listCollections().toArray();
  for (const c of collections) {
    const data = await mongoose.connection.db.collection(c.name).find({}).toArray();
    fs.writeFileSync(`${outDir}/${c.name}.json`, JSON.stringify(data, null, 2));
  }
  console.log(`  Successfully exported ${collections.length} database collections to backup.`);
  process.exit(0);
} catch (err) {
  console.error("  Database export error:", err);
  process.exit(1);
}
'@

Set-Content -Path $exportScriptPath -Value $nodeExportScript -Encoding UTF8

# Run export script from server directory where mongoose is installed
Push-Location (Join-Path $ProjectDir "server")
& node $exportScriptPath $DbDumpDir
Pop-Location

# Immediately remove temporary export script
if (Test-Path $exportScriptPath) {
  Remove-Item $exportScriptPath -Force
}

Write-Host "[3/4] Copying codebase files (excluding node_modules and builds)..." -ForegroundColor Cyan
# Fast recursive copy excluding node_modules, dist, .git
$excludeDirs = @("node_modules", "dist", ".git", ".system_generated")
& robocopy $ProjectDir $CodeDir /E /XD $excludeDirs /NFL /NDL /NJH /NJS /NC /NS /NP | Out-Null

Write-Host "[4/4] Creating backup zip archive..." -ForegroundColor Cyan
Compress-Archive -Path "$DbDumpDir", "$CodeDir" -DestinationPath $ZipOutputFile -Force

# Clean up temporary files
Remove-Item -Path $TempDir -Recurse -Force

# Rotate backups: Keep only the latest 7 backups
Get-ChildItem -Path $DestinationDir -Filter "DS_Nexus_Backup_*.zip" | 
Sort-Object CreationTime -Descending | 
Select-Object -Skip 7 | 
Remove-Item -Force

Write-Host "`n[SUCCESS] Backup completed successfully!" -ForegroundColor Green
Write-Host "File saved to: $ZipOutputFile`n" -ForegroundColor Yellow
