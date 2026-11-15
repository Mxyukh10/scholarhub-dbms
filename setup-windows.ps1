$ErrorActionPreference = 'Stop'
Write-Host 'ScholarHub local setup' -ForegroundColor Cyan
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Install Node.js 20+ first: https://nodejs.org/' }
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Install Docker Desktop and open it first: https://www.docker.com/products/docker-desktop/' }
if (-not (Test-Path '.env.local')) {
  Copy-Item '.env.example' '.env.local'
  Write-Host 'Created .env.local. Change the demo passwords and AUTH_SECRET before sharing.' -ForegroundColor Yellow
}
docker compose up -d
if ($LASTEXITCODE -ne 0) { throw 'Could not start PostgreSQL. Make sure Docker Desktop is running.' }
Write-Host 'PostgreSQL is starting. Installing Node dependencies...' -ForegroundColor Green
npm install
if ($LASTEXITCODE -ne 0) { throw 'npm install failed.' }
Write-Host 'Setup complete. Run: npm run dev' -ForegroundColor Green
