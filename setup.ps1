# Wedding RSVP - One-command setup for Vercel + Supabase
# Run from inside the project folder:
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#   .\setup.ps1

$ErrorActionPreference = "Stop"

function Write-Header($text) {
    Write-Host ""
    Write-Host "---------------------------------------------------------" -ForegroundColor Cyan
    Write-Host "  $text" -ForegroundColor Cyan
    Write-Host "---------------------------------------------------------" -ForegroundColor Cyan
    Write-Host ""
}

function Ask($prompt, $default = "") {
    if ($default -ne "") { $answer = Read-Host "$prompt [$default]" }
    else                  { $answer = Read-Host "$prompt" }
    if ($answer -eq "" -and $default -ne "") { return $default }
    return $answer
}

function AskSecret($prompt) {
    $s = Read-Host $prompt -AsSecureString
    return [Runtime.InteropServices.Marshal]::PtrToStringAuto(
               [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))
}

function Check-Cmd($name) {
    return $null -ne (Get-Command $name -ErrorAction SilentlyContinue)
}

function Ensure-Cli($commandName, $installCommand, $successLabel) {
    if (Check-Cmd $commandName) {
        Write-Host "  OK  $successLabel found" -ForegroundColor Green
        return
    }

    Write-Host "  Installing $successLabel..." -ForegroundColor Gray
    cmd /c $installCommand

    if (-not (Check-Cmd $commandName)) {
        throw "Failed to install $successLabel"
    }

    Write-Host "  OK  $successLabel installed" -ForegroundColor Green
}

function Set-EnvEverywhere($name, $value, [switch]$Sensitive) {
    if ([string]::IsNullOrWhiteSpace($value)) { return }

    $tempFile = Join-Path $env:TEMP ("vercel-env-" + [System.Guid]::NewGuid().ToString() + ".txt")
    Set-Content -Path $tempFile -Value $value -NoNewline

    try {
        foreach ($environment in @("development", "preview", "production")) {
            $sensitiveFlag = ""
            if ($Sensitive) { $sensitiveFlag = " --sensitive" }

            cmd /c "vercel env add $name $environment --force$sensitiveFlag < `"$tempFile`"" | Out-Null
        }
    }
    finally {
        Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
    }
}

function Remove-PathIfExists($path) {
    if (Test-Path $path) {
        Remove-Item $path -Recurse -Force
        Write-Host "  Removed $path" -ForegroundColor DarkGray
    }
}

Clear-Host
Write-Host ""
Write-Host "  Wedding RSVP - Vercel Setup Wizard" -ForegroundColor White
Write-Host ""
Write-Host "  This script will:" -ForegroundColor Gray
Write-Host "    - clean out Cloudflare-only leftovers" -ForegroundColor Gray
Write-Host "    - ask for your wedding and Supabase details" -ForegroundColor Gray
Write-Host "    - push the code to GitHub" -ForegroundColor Gray
Write-Host "    - set Vercel environment variables" -ForegroundColor Gray
Write-Host "    - deploy the site to Vercel" -ForegroundColor Gray
Write-Host ""
Write-Host "  You will need:" -ForegroundColor Yellow
Write-Host "    Node.js 18+       ->  https://nodejs.org" -ForegroundColor Yellow
Write-Host "    Git               ->  https://git-scm.com" -ForegroundColor Yellow
Write-Host "    Free Vercel account   ->  https://vercel.com" -ForegroundColor Yellow
Write-Host "    GitHub account        ->  https://github.com" -ForegroundColor Yellow
Write-Host "    Supabase project      ->  https://database.new" -ForegroundColor Yellow
Write-Host ""
Read-Host "  Press Enter to begin"

Write-Header "Step 1 of 8 - Checking your computer"

$missing = @()
if (-not (Check-Cmd "node")) { $missing += "  Node.js  ->  https://nodejs.org" }
if (-not (Check-Cmd "git"))  { $missing += "  Git      ->  https://git-scm.com" }

if ($missing.Count -gt 0) {
    Write-Host "  The following tools are missing. Please install them and re-run." -ForegroundColor Red
    $missing | ForEach-Object { Write-Host $_ -ForegroundColor Red }
    exit 1
}

Write-Host "  OK  Node.js  $(node --version)" -ForegroundColor Green
Write-Host "  OK  npm      $(npm --version)" -ForegroundColor Green
Write-Host "  OK  Git      $(git --version)" -ForegroundColor Green

Ensure-Cli "vercel" "npm install -g vercel@latest" "Vercel CLI"

Write-Header "Step 2 of 8 - Cleaning Cloudflare leftovers"

Remove-PathIfExists ".vercel"
Remove-PathIfExists ".open-next"
Remove-PathIfExists ".wrangler"
Remove-PathIfExists ".next"
Remove-PathIfExists "node_modules"
Remove-Item "package-lock.json" -Force -ErrorAction SilentlyContinue
Remove-Item "wrangler.toml" -Force -ErrorAction SilentlyContinue
Write-Host "  Project cleaned for Vercel deployment" -ForegroundColor Green

Write-Header "Step 3 of 8 - Your wedding details"

$rsvpPrompt   = Ask "  Message shown to guests on the RSVP page" "Please kindly respond for our wedding."
$rsvpDeadline = Ask "  RSVP deadline (format: YYYY-MM-DDThh:mm:ss)" "2026-12-31T23:59:59"
$inviteMsg    = Ask "  Opening line of your WhatsApp invite message" "You are warmly invited to our wedding!"
$adminPass    = AskSecret "  Choose a password for the admin dashboard (hidden as you type)"
if ($adminPass.Length -lt 6) {
    Write-Host "  Warning: password is short. Consider making it longer." -ForegroundColor Yellow
}

Write-Header "Step 4 of 8 - Supabase details"

Write-Host "  Create a Supabase project first if you have not already." -ForegroundColor Gray
Write-Host "  You need the project URL, publishable/anon key, and service role/secret key." -ForegroundColor Gray
Write-Host ""
$publicSupabaseUrl = Ask "  Supabase project URL (https://xxxx.supabase.co)"
$supabaseUrl = Ask "  Server Supabase URL [press Enter to reuse the same URL]" $publicSupabaseUrl
$publicSupabaseAnon = AskSecret "  Supabase publishable/anon key"
$supabaseServiceKey = AskSecret "  Supabase service role/secret key"
$dbUrl = AskSecret "  Optional Postgres connection string for auto-running schema.sql (or press Enter to skip)"

Write-Header "Step 5 of 8 - Notifications (optional)"

$resendKey   = AskSecret "  Resend API key (or press Enter to skip)"
$resendFrom  = ""
$notifyEmail = ""
if ($resendKey -ne "") {
    $resendFrom  = Ask "  From address for emails" "noreply@your-domain.com"
    $notifyEmail = Ask "  Email address(es) to notify, comma-separated"
}

$waPhone = Ask "  Your WhatsApp number with country code e.g. +14165551234 (or press Enter to skip)"
$waApiKey = ""
if ($waPhone -ne "") {
    $waApiKey = AskSecret "  CallMeBot API key (or press Enter to skip)"
}

Write-Header "Step 6 of 8 - GitHub repo"

Write-Host "  Create a new empty private GitHub repo in your browser, then paste the URL here." -ForegroundColor Yellow
$repoUrl = Ask "  GitHub repository URL"
$projectNameDefault = ($repoUrl -split "/")[-1] -replace "\.git$", ""
if ($projectNameDefault -eq "") { $projectNameDefault = "wedding-rsvp" }
$vercelProjectName = Ask "  Vercel project name" $projectNameDefault

Write-Header "Step 7 of 8 - Install, database schema, git push"

npm install
if ($LASTEXITCODE -ne 0) {
    throw "npm install failed"
}

if (-not [string]::IsNullOrWhiteSpace($dbUrl)) {
    if (Check-Cmd "psql") {
        Write-Host "  Applying schema.sql with psql..." -ForegroundColor Gray
        $env:PGPASSWORD = ""
        cmd /c "psql `"$dbUrl`" -v ON_ERROR_STOP=1 -f schema.sql"
        Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
        Write-Host "  OK  schema.sql applied" -ForegroundColor Green
    } else {
        Write-Host "  Skipping schema.sql auto-run because psql is not installed." -ForegroundColor Yellow
        Write-Host "  After deployment, run schema.sql in the Supabase SQL Editor once." -ForegroundColor Yellow
    }
}

$ErrorActionPreference = "Continue"
if (-not (Test-Path ".git")) { git init 2>&1 | Out-Null }
git add . 2>&1 | Out-Null

$st = git status --short 2>&1 | Out-String
if ($st.Trim() -ne "") {
    git commit -m "Vercel-ready RSVP setup" 2>&1 | Out-Null
}

$remoteList = git remote 2>&1 | Out-String
if ($remoteList -match "origin") {
    git remote set-url origin $repoUrl 2>&1 | Out-Null
} else {
    git remote add origin $repoUrl 2>&1 | Out-Null
}

git branch -M main 2>&1 | Out-Null
$pushOut = git push -u origin main 2>&1 | Out-String
Write-Host $pushOut -ForegroundColor Gray
$ErrorActionPreference = "Stop"

Write-Host "  OK  Code pushed to GitHub" -ForegroundColor Green

Write-Header "Step 8 of 8 - Vercel login, env vars, and deploy"

Write-Host "  A browser may open for Vercel login." -ForegroundColor Gray
cmd /c "vercel login"
cmd /c "vercel link --yes --project $vercelProjectName"

Set-EnvEverywhere "NEXT_PUBLIC_RSVP_PROMPT" $rsvpPrompt
Set-EnvEverywhere "NEXT_PUBLIC_RSVP_DEADLINE" $rsvpDeadline
Set-EnvEverywhere "NEXT_PUBLIC_INVITE_MESSAGE" $inviteMsg
Set-EnvEverywhere "ADMIN_PASSWORD" $adminPass -Sensitive
Set-EnvEverywhere "NEXT_PUBLIC_SUPABASE_URL" $publicSupabaseUrl
Set-EnvEverywhere "SUPABASE_URL" $supabaseUrl
Set-EnvEverywhere "NEXT_PUBLIC_SUPABASE_ANON_KEY" $publicSupabaseAnon -Sensitive
Set-EnvEverywhere "SUPABASE_SERVICE_ROLE_KEY" $supabaseServiceKey -Sensitive

if ($resendKey -ne "")   { Set-EnvEverywhere "RESEND_API_KEY" $resendKey -Sensitive }
if ($resendFrom -ne "")  { Set-EnvEverywhere "RESEND_FROM_EMAIL" $resendFrom }
if ($notifyEmail -ne "") { Set-EnvEverywhere "NOTIFY_EMAIL" $notifyEmail }
if ($waPhone -ne "")     { Set-EnvEverywhere "WHATSAPP_NOTIFY_PHONE" $waPhone }
if ($waApiKey -ne "")    { Set-EnvEverywhere "WHATSAPP_NOTIFY_API_KEY" $waApiKey -Sensitive }

Write-Host "  Creating first production deployment..." -ForegroundColor Gray
$firstDeployUrl = (cmd /c "vercel --prod --yes") | Select-Object -Last 1
$firstDeployUrl = "$firstDeployUrl".Trim()

if ([string]::IsNullOrWhiteSpace($firstDeployUrl)) {
    $firstDeployUrl = Ask "  Paste the deployed Vercel URL"
}

Set-EnvEverywhere "NEXT_PUBLIC_SITE_URL" $firstDeployUrl

Write-Host "  Redeploying so NEXT_PUBLIC_SITE_URL is baked into the client build..." -ForegroundColor Gray
$finalDeployUrl = (cmd /c "vercel --prod --yes") | Select-Object -Last 1
$finalDeployUrl = "$finalDeployUrl".Trim()
if ([string]::IsNullOrWhiteSpace($finalDeployUrl)) {
    $finalDeployUrl = $firstDeployUrl
}

Write-Host ""
Write-Host "---------------------------------------------------------" -ForegroundColor Green
Write-Host "  All done! Your Vercel RSVP site is live." -ForegroundColor Green
Write-Host "---------------------------------------------------------" -ForegroundColor Green
Write-Host ""
Write-Host "  Your site:    $finalDeployUrl" -ForegroundColor White
Write-Host "  Admin panel:  $finalDeployUrl/admin" -ForegroundColor White
Write-Host ""
Write-Host "  Important:" -ForegroundColor Yellow
Write-Host "  If you skipped the database connection string or do not have psql," -ForegroundColor Yellow
Write-Host "  run schema.sql once in the Supabase SQL Editor before using the admin page." -ForegroundColor Yellow
Write-Host ""
