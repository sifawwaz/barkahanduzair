param()

$ErrorActionPreference = "Stop"

function Write-Step($text) {
    Write-Host ""
    Write-Host "==================================================" -ForegroundColor Cyan
    Write-Host $text -ForegroundColor Cyan
    Write-Host "==================================================" -ForegroundColor Cyan
}

function Write-Info($text) {
    Write-Host "[INFO] $text" -ForegroundColor Yellow
}

function Write-Ok($text) {
    Write-Host "[OK] $text" -ForegroundColor Green
}

function Write-Fail($text) {
    Write-Host "[ERROR] $text" -ForegroundColor Red
}

function Ask-Required($prompt) {
    while ($true) {
        $value = Read-Host $prompt
        if (-not [string]::IsNullOrWhiteSpace($value)) {
            return $value.Trim()
        }
        Write-Fail "This value is required."
    }
}

function Ask-Optional($prompt) {
    $value = Read-Host $prompt
    if ([string]::IsNullOrWhiteSpace($value)) {
        return ""
    }
    return $value.Trim()
}

function Ask-YesNo($prompt, $default = "Y") {
    while ($true) {
        $suffix = if ($default -eq "Y") { "[Y/n]" } else { "[y/N]" }
        $value = Read-Host "$prompt $suffix"
        if ([string]::IsNullOrWhiteSpace($value)) {
            return ($default -eq "Y")
        }
        switch ($value.Trim().ToLower()) {
            "y" { return $true }
            "yes" { return $true }
            "n" { return $false }
            "no" { return $false }
            default { Write-Fail "Please answer y or n." }
        }
    }
}

function Require-Command($name, $installHelp) {
    if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
        throw "$name is not installed. $installHelp"
    }
}

function Ensure-VercelCli {
    if (-not (Get-Command vercel -ErrorAction SilentlyContinue)) {
        Write-Info "Vercel CLI not found. Installing it globally now..."
        npm install -g vercel
        if (-not (Get-Command vercel -ErrorAction SilentlyContinue)) {
            throw "Vercel CLI install failed. Run: npm install -g vercel"
        }
    }
}

function Remove-IfExists($path) {
    if (Test-Path $path) {
        Remove-Item $path -Recurse -Force
        Write-Ok "Removed $path"
    }
}

function Write-NoBOM($path, $content) {
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    $fullPath = Join-Path (Resolve-Path ".").Path $path
    [System.IO.File]::WriteAllText($fullPath, $content, $utf8NoBom)
}

function Fix-BOM($file) {
    if (-not (Test-Path $file)) {
        return
    }

    $content = Get-Content $file -Raw
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    $fullPath = (Resolve-Path $file).Path
    [System.IO.File]::WriteAllText($fullPath, $content, $utf8NoBom)
    Write-Ok "Encoding fixed: $file"
}

function Set-OrReplaceEnvLine([string[]]$lines, [string]$key, [string]$value) {
    $escaped = [Regex]::Escape($key)
    $newLine = "$key=$value"
    $found = $false
    $result = @()

    foreach ($line in $lines) {
        if ($line -match "^$escaped=") {
            $result += $newLine
            $found = $true
        } else {
            $result += $line
        }
    }

    if (-not $found) {
        $result += $newLine
    }

    return ,$result
}

function Save-EnvFile($filePath, $pairs) {
    $lines = @()

    if (Test-Path $filePath) {
        $lines = Get-Content $filePath
    }

    foreach ($key in $pairs.Keys) {
        $lines = Set-OrReplaceEnvLine -lines $lines -key $key -value $pairs[$key]
    }

    $content = ($lines -join "`n")
    Write-NoBOM $filePath $content
}

function Add-VercelEnv($name, $value, $targets) {
    if ([string]::IsNullOrWhiteSpace($value)) {
        Write-Info "Skipping empty env var: $name"
        return
    }

    foreach ($target in $targets) {
        Write-Info "Setting $name for Vercel target: $target"

        try {
            vercel env rm $name $target -y 2>$null | Out-Null
        } catch {}

        $tempFile = [System.IO.Path]::GetTempFileName()
        try {
            Write-NoBOM $tempFile $value
            Get-Content $tempFile | vercel env add $name $target | Out-Null
            Write-Ok "$name added to $target"
        } finally {
            if (Test-Path $tempFile) {
                Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
            }
        }
    }
}

function Replace-InFile($path, $find, $replace) {
    if (-not (Test-Path $path)) { return }
    $content = Get-Content $path -Raw
    $content = $content -replace $find, $replace
    Write-NoBOM $path $content
}

function Ensure-NextConfigMjs {
    if (Test-Path "next.config.ts") {
        Remove-Item "next.config.ts" -Force
        Write-Ok "Removed unsupported next.config.ts"
    }

    $config = @"
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
"@

    if (-not (Test-Path "next.config.mjs")) {
        Write-NoBOM "next.config.mjs" $config
        Write-Ok "Created next.config.mjs"
    } else {
        Fix-BOM "next.config.mjs"
    }
}

function Ensure-GitIgnore {
    $path = ".gitignore"
    $entries = @(
        ".env.local",
        ".env",
        ".vercel",
        "node_modules",
        ".next"
    )

    $existing = @()
    if (Test-Path $path) {
        $existing = Get-Content $path
    }

    foreach ($entry in $entries) {
        if ($existing -notcontains $entry) {
            Add-Content $path $entry
        }
    }

    Fix-BOM $path
    Write-Ok ".gitignore checked"
}

function Ensure-PackageJsonScripts {
    $path = "package.json"
    if (-not (Test-Path $path)) {
        throw "package.json not found."
    }

    Fix-BOM $path

    $pkg = Get-Content $path -Raw | ConvertFrom-Json

    if (-not $pkg.scripts) {
        $pkg | Add-Member -MemberType NoteProperty -Name scripts -Value ([pscustomobject]@{})
    }

    $scripts = @{}
    foreach ($p in $pkg.scripts.PSObject.Properties) {
        $scripts[$p.Name] = $p.Value
    }

    if (-not $scripts.ContainsKey("dev")) { $scripts["dev"] = "next dev" }
    if (-not $scripts.ContainsKey("build")) { $scripts["build"] = "next build" }
    if (-not $scripts.ContainsKey("start")) { $scripts["start"] = "next start" }

    $pkg.scripts = [pscustomobject]$scripts

    $content = $pkg | ConvertTo-Json -Depth 100
    Write-NoBOM $path $content

    Write-Ok "package.json scripts checked"
}

function Ensure-Dependencies {
    Write-Info "Installing project dependencies..."
    npm install
    Write-Ok "Dependencies installed"
}

function Ensure-RepoConnected($repoUrl) {
    if (-not (Test-Path ".git")) {
        git init | Out-Null
        Write-Ok "Git repository initialized"
    }

    git branch -M main | Out-Null

    $hasOrigin = $false
    try {
        $remoteUrl = git remote get-url origin 2>$null
        if ($LASTEXITCODE -eq 0 -and $remoteUrl) {
            $hasOrigin = $true
        }
    } catch {}

    if ($hasOrigin) {
        git remote set-url origin $repoUrl
        Write-Ok "Updated existing origin remote"
    } else {
        git remote add origin $repoUrl
        Write-Ok "Added origin remote"
    }
}

function Git-CommitAll($message) {
    git add .
    try {
        git commit -m $message | Out-Null
        Write-Ok "Git commit created"
    } catch {
        Write-Info "No new commit created. Working tree may already be clean."
    }
}

function Ensure-SupabaseClientEnvSample {
    $path = ".env.example"
    $pairs = [ordered]@{
        "NEXT_PUBLIC_SUPABASE_URL"      = "your_supabase_url"
        "NEXT_PUBLIC_SUPABASE_ANON_KEY" = "your_supabase_anon_key"
        "SUPABASE_SERVICE_ROLE_KEY"     = "your_supabase_service_role_key"
        "ADMIN_PASSWORD"                = "your_admin_password"
        "NEXT_PUBLIC_RSVP_MESSAGE"      = "Please confirm your attendance"
        "NEXT_PUBLIC_RSVP_DEADLINE"     = "May 3, 2026"
        "NEXT_PUBLIC_INVITE_MESSAGE"    = "You are invited"
        "RESEND_API_KEY"                = ""
        "RESEND_FROM_EMAIL"             = ""
        "WHATSAPP_PHONE"                = ""
        "WHATSAPP_API_KEY"              = ""
        "NEXT_PUBLIC_SITE_URL"          = "https://your-project.vercel.app"
    }

    Save-EnvFile -filePath $path -pairs $pairs
    Write-Ok ".env.example updated"
}

function Validate-PackageJson {
    Write-Info "Validating package.json..."
    try {
        Get-Content "package.json" -Raw | ConvertFrom-Json | Out-Null
        Write-Ok "package.json is valid"
    } catch {
        throw "package.json is invalid JSON."
    }
}

Write-Step "Wedding RSVP Full Automation Setup"

Write-Host "This script will:"
Write-Host "1. Clean up leftover files that commonly break Vercel"
Write-Host "2. Ask you for required project values"
Write-Host "3. Create or update .env.local"
Write-Host "4. Install dependencies"
Write-Host "5. Connect GitHub"
Write-Host "6. Link and deploy to Vercel"
Write-Host "7. Add your environment variables to Vercel"
Write-Host ""

if (-not (Ask-YesNo "Continue?" "Y")) {
    Write-Host "Cancelled."
    exit 0
}

Write-Step "Checking Required Tools"
Require-Command "node" "Install Node.js from https://nodejs.org"
Require-Command "npm" "Node.js install should include npm."
Require-Command "git" "Install Git from https://git-scm.com"
Ensure-VercelCli
Write-Ok "All required tools are available"

Write-Step "Collecting Configuration"

$rsvpMessage      = Ask-Required "RSVP message"
$rsvpDeadline     = Ask-Required "RSVP deadline (example: May 3, 2026)"
$inviteMessage    = Ask-Required "Invite message"
$adminPassword    = Ask-Required "Admin password"

Write-Host ""
Write-Host "Supabase details are required." -ForegroundColor Yellow
$supabaseUrl      = Ask-Required "Supabase URL"
$supabaseAnon     = Ask-Required "Supabase anon key"
$supabaseService  = Ask-Required "Supabase service role key"

Write-Host ""
Write-Host "Optional email notifications with Resend." -ForegroundColor Yellow
$resendKey        = Ask-Optional "Resend API key (press Enter to skip)"
$resendFrom       = Ask-Optional "Resend sender email (press Enter to skip)"

Write-Host ""
Write-Host "Optional WhatsApp notifications with CallMeBot." -ForegroundColor Yellow
$whatsAppPhone    = Ask-Optional "WhatsApp phone number with country code (press Enter to skip)"
$whatsAppApiKey   = Ask-Optional "WhatsApp API key (press Enter to skip)"

Write-Host ""
$repoUrl          = Ask-Required "GitHub repository URL (empty repo recommended)"
$projectName      = Ask-Required "Vercel project name"
$siteUrlGuess     = "https://$projectName.vercel.app"

Write-Host ""
$deployPreviewToo = Ask-YesNo "Also add env vars to Preview deployments?" "Y"
$runLocalBuild    = Ask-YesNo "Run a local production build test before pushing?" "Y"
$pushToGitHub     = Ask-YesNo "Push changes to GitHub automatically?" "Y"

Write-Step "Cleaning Up Project"

$pathsToRemove = @(
    "wrangler.toml",
    "_worker.js",
    "_routes.json",
    ".wrangler",
    ".open-next",
    ".cloudflare",
    "next.config.ts"
)

foreach ($path in $pathsToRemove) {
    Remove-IfExists $path
}

Ensure-NextConfigMjs
Ensure-GitIgnore
Ensure-PackageJsonScripts
Ensure-SupabaseClientEnvSample

Write-Step "Creating Environment Files"

$envPairs = [ordered]@{
    "NEXT_PUBLIC_SUPABASE_URL"      = $supabaseUrl
    "NEXT_PUBLIC_SUPABASE_ANON_KEY" = $supabaseAnon
    "SUPABASE_SERVICE_ROLE_KEY"     = $supabaseService
    "ADMIN_PASSWORD"                = $adminPassword
    "NEXT_PUBLIC_RSVP_MESSAGE"      = $rsvpMessage
    "NEXT_PUBLIC_RSVP_DEADLINE"     = $rsvpDeadline
    "NEXT_PUBLIC_INVITE_MESSAGE"    = $inviteMessage
    "RESEND_API_KEY"                = $resendKey
    "RESEND_FROM_EMAIL"             = $resendFrom
    "WHATSAPP_PHONE"                = $whatsAppPhone
    "WHATSAPP_API_KEY"              = $whatsAppApiKey
    "NEXT_PUBLIC_SITE_URL"          = $siteUrlGuess
}

Save-EnvFile -filePath ".env.local" -pairs $envPairs
Write-Ok ".env.local created or updated"

Write-Step "Fixing Encoding"

Fix-BOM "package.json"
Fix-BOM ".env.local"
Fix-BOM ".env.example"
Fix-BOM "next.config.mjs"

Validate-PackageJson

Write-Step "Installing Dependencies"

if (Ask-YesNo "Delete node_modules and package-lock.json first for a clean install?" "Y") {
    Remove-IfExists "node_modules"
    Remove-IfExists "package-lock.json"
}

Ensure-Dependencies

Write-Step "Optional Local Build Check"

if ($runLocalBuild) {
    Write-Info "Running npm run build..."
    npm run build
    Write-Ok "Local build passed"
} else {
    Write-Info "Skipped local build check"
}

Write-Step "Git Setup"

Ensure-RepoConnected $repoUrl
Git-CommitAll "Automated Vercel setup and environment configuration"

if ($pushToGitHub) {
    Write-Info "Pushing to GitHub..."
    git push -u origin main
    Write-Ok "Pushed to GitHub"
} else {
    Write-Info "Skipped GitHub push"
}

Write-Step "Vercel Setup"

Write-Info "You may be asked to log in to Vercel in the browser."
vercel login
vercel link --yes --project $projectName

$targets = @("production")
if ($deployPreviewToo) {
    $targets += "preview"
}

Add-VercelEnv "NEXT_PUBLIC_SUPABASE_URL" $supabaseUrl $targets
Add-VercelEnv "NEXT_PUBLIC_SUPABASE_ANON_KEY" $supabaseAnon $targets
Add-VercelEnv "SUPABASE_SERVICE_ROLE_KEY" $supabaseService $targets
Add-VercelEnv "ADMIN_PASSWORD" $adminPassword $targets
Add-VercelEnv "NEXT_PUBLIC_RSVP_MESSAGE" $rsvpMessage $targets
Add-VercelEnv "NEXT_PUBLIC_RSVP_DEADLINE" $rsvpDeadline $targets
Add-VercelEnv "NEXT_PUBLIC_INVITE_MESSAGE" $inviteMessage $targets
Add-VercelEnv "RESEND_API_KEY" $resendKey $targets
Add-VercelEnv "RESEND_FROM_EMAIL" $resendFrom $targets
Add-VercelEnv "WHATSAPP_PHONE" $whatsAppPhone $targets
Add-VercelEnv "WHATSAPP_API_KEY" $whatsAppApiKey $targets
Add-VercelEnv "NEXT_PUBLIC_SITE_URL" $siteUrlGuess $targets

Write-Info "Deploying to Vercel production..."
vercel --prod
Write-Ok "Vercel deployment started or completed"

Write-Step "Supabase Database Reminder"

Write-Host "If your database tables do not exist yet:"
Write-Host "1. Open Supabase"
Write-Host "2. Go to SQL Editor"
Write-Host "3. Run the contents of schema.sql"
Write-Host ""
Write-Host "Your expected site URL is:"
Write-Host $siteUrlGuess -ForegroundColor Green
Write-Host ""
Write-Host "Admin page:"
Write-Host "$siteUrlGuess/admin" -ForegroundColor Green

Write-Step "Setup Complete"
Write-Host "Done." -ForegroundColor Green