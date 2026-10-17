# Creates local database interior_viz using your PostgreSQL password.
# Usage:  .\scripts\setup-db.ps1

$ErrorActionPreference = "Stop"
$Psql = "C:\Program Files\PostgreSQL\17\bin\psql.exe"
if (-not (Test-Path $Psql)) {
  $Psql = "C:\Program Files\PostgreSQL\15\bin\psql.exe"
}

$secure = Read-Host "Enter PostgreSQL password for user 'postgres'" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
$Password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

$env:PGPASSWORD = $Password
$dbUrl = "postgresql://postgres:$Password@localhost:5432/interior_viz"

Write-Host "Creating database (ignore error if it already exists)..."
& $Psql -U postgres -h localhost -c "CREATE DATABASE interior_viz;" 2>$null

$envFile = Join-Path $PSScriptRoot "..\.env"
@"
PORT=4001
DATABASE_URL=$dbUrl
UPLOAD_DIR=uploads
AI_MODE=mock
"@ | Set-Content -Path $envFile -Encoding UTF8

Write-Host "Updated backend/.env"
Write-Host "Running migrations..."
Set-Location (Join-Path $PSScriptRoot "..")
npm run migrate

Write-Host "Done. Start API with: npm run dev"
