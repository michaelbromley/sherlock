#Requires -Version 5.1
<#
.SYNOPSIS
    Sherlock Installer for Windows
.DESCRIPTION
    Downloads and installs the Sherlock database query tool for Claude Code.
.EXAMPLE
    irm https://raw.githubusercontent.com/michaelbromley/sherlock/main/install.ps1 | iex
#>

$ErrorActionPreference = 'Stop'

$Repo = 'michaelbromley/sherlock'
$SkillDir = Join-Path $env:USERPROFILE '.claude\skills\sherlock'

# Colors via Write-Host
function Write-Info($Message) {
    Write-Host '==> ' -ForegroundColor Blue -NoNewline
    Write-Host $Message
}

function Write-Success($Message) {
    Write-Host '==> ' -ForegroundColor Green -NoNewline
    Write-Host $Message
}

function Write-Warn($Message) {
    Write-Host '==> ' -ForegroundColor Yellow -NoNewline
    Write-Host $Message
}

function Write-Err($Message) {
    Write-Host '==> ' -ForegroundColor Red -NoNewline
    Write-Host $Message
    exit 1
}

# ---------------------------------------------------------------------------
# Detect platform
# ---------------------------------------------------------------------------
function Get-Platform {
    $arch = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture
    switch ($arch) {
        'X64'   { return 'windows-x64' }
        'Arm64' { return 'windows-arm64' }
        default { Write-Err "Unsupported architecture: $arch" }
    }
}

# ---------------------------------------------------------------------------
# Download helper
# ---------------------------------------------------------------------------
function Invoke-Download {
    param(
        [string]$Url,
        [string]$OutFile
    )
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $Url -OutFile $OutFile -UseBasicParsing -ErrorAction Stop
    }
    catch {
        throw "Download failed: $_"
    }
}

# ---------------------------------------------------------------------------
# PATH setup - optionally add sherlock to user PATH
# ---------------------------------------------------------------------------
function Add-ToPath {
    $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    if ($userPath -split ';' | Where-Object { $_ -eq $SkillDir }) {
        Write-Info "PATH already contains $SkillDir"
        return
    }

    $newPath = "$SkillDir;$userPath"
    [Environment]::SetEnvironmentVariable('Path', $newPath, 'User')

    # Also update the current session
    $env:Path = "$SkillDir;$env:Path"

    Write-Success "Added sherlock to user PATH"
    Write-Host ''
    Write-Host '  Note: ' -ForegroundColor Yellow -NoNewline
    Write-Host "New terminal windows will have sherlock in PATH automatically."
    Write-Host ''
}

# ---------------------------------------------------------------------------
# Workaround: Add sherlock to Claude Code allowed permissions
# https://github.com/anthropics/claude-code/issues/14956
# ---------------------------------------------------------------------------
function Add-ClaudePermission {
    $permission = 'Bash(~/.claude/skills/sherlock/sherlock:*)'
    $settingsFile = $null

    $localSettings = Join-Path $env:USERPROFILE '.claude\settings.local.json'
    $globalSettings = Join-Path $env:USERPROFILE '.claude\settings.json'

    if (Test-Path $localSettings) {
        $settingsFile = $localSettings
    }
    elseif (Test-Path $globalSettings) {
        $settingsFile = $globalSettings
    }

    if (-not $settingsFile) { return }

    try {
        $settings = Get-Content $settingsFile -Raw | ConvertFrom-Json

        # Ensure permissions.allow exists
        if (-not $settings.permissions) {
            $settings | Add-Member -NotePropertyName 'permissions' -NotePropertyValue ([PSCustomObject]@{ allow = @() })
        }
        elseif (-not $settings.permissions.allow) {
            $settings.permissions | Add-Member -NotePropertyName 'allow' -NotePropertyValue @()
        }

        # Check if already present
        if ($settings.permissions.allow -contains $permission) { return }

        # Add permission
        $settings.permissions.allow = @($settings.permissions.allow) + $permission
        $settings | ConvertTo-Json -Depth 10 | Set-Content $settingsFile -Encoding UTF8

        Write-Info "Added sherlock to Claude Code allowed permissions"
        Write-Host ''
        Write-Host '  Note: ' -ForegroundColor Yellow -NoNewline
        Write-Host "Added permission to $settingsFile"
        Write-Host "  This is a workaround for: https://github.com/anthropics/claude-code/issues/14956"
        Write-Host "  It allows sherlock to run without prompting for permission each time."
        Write-Host ''
    }
    catch {
        Write-Warn "Could not update Claude Code settings automatically"
        Write-Warn "You may need to manually allow sherlock in Claude Code"
    }
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
function Main {
    Write-Host ''
    Write-Host '  Sherlock Installer'
    Write-Host '  ====================='
    Write-Host ''

    # Detect platform
    Write-Info 'Detecting platform...'
    $platform = Get-Platform
    Write-Success "Detected platform: $platform"

    # Check for existing installation
    $upgrading = $false
    $sherlockExe = Join-Path $SkillDir 'sherlock.exe'
    if (Test-Path $sherlockExe) {
        $upgrading = $true
        try {
            $oldVersion = & $sherlockExe --version 2>$null
        }
        catch {
            $oldVersion = 'unknown'
        }
        Write-Info "Existing installation found (v$oldVersion) - upgrading..."
    }

    # Create skill directory
    Write-Info 'Creating skill directory...'
    New-Item -ItemType Directory -Path $SkillDir -Force | Out-Null

    # Determine script location for local repo detection
    $scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { $PWD.Path }

    # Try local binary first (cloned repo - run "npm run build:windows" first)
    $localBinary = Join-Path $scriptDir 'dist\sherlock-windows.exe'
    $localSkill = Join-Path $scriptDir '.claude\skills\sherlock\SKILL.md'

    if (Test-Path $localBinary) {
        Write-Info "Found local binary at $localBinary"
        Copy-Item -Path $localBinary -Destination $sherlockExe -Force
        Write-Success "Installed binary to $sherlockExe"
    }
    else {
        # Download binary from GitHub releases
        $binaryUrl = "https://github.com/$Repo/releases/latest/download/sherlock-windows.exe"
        Write-Info 'Downloading sherlock binary...'

        $tempFile = [System.IO.Path]::GetTempFileName()
        try {
            Invoke-Download -Url $binaryUrl -OutFile $tempFile
        }
        catch {
            Remove-Item $tempFile -ErrorAction SilentlyContinue
            Write-Err "Failed to download binary. Check your internet connection or if the release exists.`nIf running from a cloned repo, run 'npm run build:windows' first."
        }

        Move-Item -Path $tempFile -Destination $sherlockExe -Force
        Write-Success "Installed binary to $sherlockExe"
    }

    # Install skill definition - prefer local copy, fall back to download
    $skillFile = Join-Path $SkillDir 'SKILL.md'
    if (Test-Path $localSkill) {
        Write-Info "Found local skill definition"
        Copy-Item -Path $localSkill -Destination $skillFile -Force
        Write-Success "Installed skill to $skillFile"
    }
    else {
        Write-Info 'Downloading skill definition...'
        $skillUrl = "https://raw.githubusercontent.com/$Repo/main/.claude/skills/sherlock/SKILL.md"
        try {
            Invoke-Download -Url $skillUrl -OutFile $skillFile
            Write-Success "Installed skill to $skillFile"
        }
        catch {
            Write-Warn 'Failed to download skill file. You can manually copy it later.'
        }
    }

    # Create config for portable mode
    $configFile = Join-Path $SkillDir 'config.json'
    if (-not (Test-Path $configFile)) {
        '{"version":"2.0","connections":{}}' | Set-Content $configFile -Encoding UTF8
        Write-Success 'Created config.json (portable mode enabled)'
    }

    # Add permission to Claude Code settings (workaround)
    Add-ClaudePermission

    # Get new version
    try {
        $newVersion = & $sherlockExe --version 2>$null
    }
    catch {
        $newVersion = 'unknown'
    }

    Write-Host ''
    if ($upgrading) {
        Write-Success "Upgrade complete! (v$oldVersion -> v$newVersion)"
    }
    else {
        Write-Success "Installation complete! (v$newVersion)"
    }
    Write-Host ''
    Write-Host "  Installed to: $SkillDir"
    Write-Host ''

    if (-not $upgrading) {
        Write-Host '  Next steps:'
        Write-Host '  -----------'
        Write-Host "  1. Run '$sherlockExe setup' to configure your database connections"
        Write-Host "  2. Use '/sherlock' in Claude Code to query your databases"
        Write-Host ''

        # Ask about PATH setup
        $reply = Read-Host '  Add sherlock to your PATH for easier command-line access? [y/N]'
        if ($reply -match '^[Yy]$') {
            Add-ToPath
        }
        else {
            Write-Host ''
            Write-Host '  Tip: You can add sherlock to your PATH later from PowerShell:'
            Write-Host "    `$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')"
            Write-Host "    [Environment]::SetEnvironmentVariable('Path', `"$SkillDir;`$userPath`", 'User')"
            Write-Host ''
        }
    }

    Write-Host '  To uninstall:'
    Write-Host "    Remove-Item -Recurse -Force '$SkillDir'"
    Write-Host ''
}

Main
