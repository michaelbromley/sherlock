#!/bin/bash
set -e

# Sherlock Installer
# Usage: curl -fsSL https://raw.githubusercontent.com/michaelbromley/sherlock/main/install.sh | bash

REPO="michaelbromley/sherlock"
SKILL_DIR="$HOME/.claude/skills/sherlock"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info() {
    echo -e "${BLUE}==>${NC} $1"
}

success() {
    echo -e "${GREEN}==>${NC} $1"
}

warn() {
    echo -e "${YELLOW}==>${NC} $1"
}

error() {
    echo -e "${RED}==>${NC} $1"
    exit 1
}

# Detect platform
detect_platform() {
    local os arch

    os=$(uname -s | tr '[:upper:]' '[:lower:]')
    arch=$(uname -m)

    case "$os" in
        darwin)
            case "$arch" in
                arm64|aarch64)
                    echo "darwin-arm64"
                    ;;
                x86_64)
                    echo "darwin-x64"
                    ;;
                *)
                    error "Unsupported architecture: $arch"
                    ;;
            esac
            ;;
        linux)
            case "$arch" in
                x86_64)
                    echo "linux-x64"
                    ;;
                *)
                    error "Unsupported architecture: $arch. Only x86_64 is supported on Linux."
                    ;;
            esac
            ;;
        *)
            error "Unsupported operating system: $os"
            ;;
    esac
}

# Download file with curl or wget
download() {
    local url="$1"
    local output="$2"

    if command -v curl &> /dev/null; then
        curl -fsSL "$url" -o "$output"
    elif command -v wget &> /dev/null; then
        wget -q "$url" -O "$output"
    else
        error "Neither curl nor wget found. Please install one of them."
    fi
}

# =============================================================================
# PATH setup - optionally add sherlock to user's PATH
# =============================================================================
add_to_path() {
    local SHELL_CONFIG=""
    local SHELL_NAME=""
    local PATH_LINE="export PATH=\"\$HOME/.claude/skills/sherlock:\$PATH\""

    # Detect shell config file
    case "$SHELL" in
        */zsh)
            SHELL_CONFIG="$HOME/.zshrc"
            SHELL_NAME="zsh"
            ;;
        */bash)
            # Prefer .bashrc, fall back to .bash_profile on macOS
            if [ -f "$HOME/.bashrc" ]; then
                SHELL_CONFIG="$HOME/.bashrc"
            else
                SHELL_CONFIG="$HOME/.bash_profile"
            fi
            SHELL_NAME="bash"
            ;;
        */fish)
            SHELL_CONFIG="$HOME/.config/fish/config.fish"
            SHELL_NAME="fish"
            PATH_LINE="set -gx PATH \$HOME/.claude/skills/sherlock \$PATH"
            ;;
        *)
            warn "Couldn't detect shell type from \$SHELL ($SHELL)"
            warn "Add this to your shell config manually:"
            echo ""
            echo "    $PATH_LINE"
            echo ""
            return 0
            ;;
    esac

    # Check if already in PATH config
    if [ -f "$SHELL_CONFIG" ] && grep -q "\.claude/skills/sherlock" "$SHELL_CONFIG" 2>/dev/null; then
        info "PATH already configured in $SHELL_CONFIG"
        return 0
    fi

    # Append to shell config
    echo "" >> "$SHELL_CONFIG"
    echo "# Added by sherlock installer" >> "$SHELL_CONFIG"
    echo "$PATH_LINE" >> "$SHELL_CONFIG"

    success "Added sherlock to PATH in $SHELL_CONFIG"
    echo ""
    echo -e "  ${YELLOW}Note:${NC} Run 'source $SHELL_CONFIG' or open a new terminal to use 'sherlock' directly."
    echo ""
}

# =============================================================================
# WORKAROUND: Add sherlock to Claude Code allowed permissions
# This is a workaround for: https://github.com/anthropics/claude-code/issues/14956
# The SKILL.md allowed-tools frontmatter should handle this, but currently doesn't.
# Once the bug is fixed, this section can be removed.
# =============================================================================
add_claude_permission() {
    local PERMISSION='Bash(~/.claude/skills/sherlock/sherlock:*)'
    local SETTINGS_FILE=""

    # Check for settings file (settings.local.json takes precedence)
    if [ -f "$HOME/.claude/settings.local.json" ]; then
        SETTINGS_FILE="$HOME/.claude/settings.local.json"
    elif [ -f "$HOME/.claude/settings.json" ]; then
        SETTINGS_FILE="$HOME/.claude/settings.json"
    fi

    # If no settings file exists, nothing to do
    if [ -z "$SETTINGS_FILE" ]; then
        return 0
    fi

    # Check if jq is available
    if ! command -v jq &> /dev/null; then
        warn "jq not found - skipping automatic permission setup"
        warn "You may need to manually allow sherlock in Claude Code settings"
        return 0
    fi

    # Check if permission already exists
    if jq -e ".permissions.allow | index(\"$PERMISSION\")" "$SETTINGS_FILE" > /dev/null 2>&1; then
        # Permission already exists
        return 0
    fi

    # Add permission to the allow array
    local TEMP_SETTINGS=$(mktemp)
    if jq ".permissions.allow += [\"$PERMISSION\"]" "$SETTINGS_FILE" > "$TEMP_SETTINGS" 2>/dev/null; then
        mv "$TEMP_SETTINGS" "$SETTINGS_FILE"
        info "Added sherlock to Claude Code allowed permissions"
        echo ""
        echo -e "  ${YELLOW}Note:${NC} Added permission to $SETTINGS_FILE"
        echo "  This is a workaround for: https://github.com/anthropics/claude-code/issues/14956"
        echo "  It allows sherlock to run without prompting for permission each time."
        echo ""
        return 0
    else
        rm -f "$TEMP_SETTINGS"
        warn "Could not update Claude Code settings automatically"
        warn "You may need to manually allow sherlock in Claude Code"
        return 0
    fi
}

main() {
    echo ""
    echo "  🔍 Sherlock Installer"
    echo "  ====================="
    echo ""

    # Detect platform
    info "Detecting platform..."
    PLATFORM=$(detect_platform)
    success "Detected platform: $PLATFORM"

    # Check for existing installation
    UPGRADING=false
    if [ -f "$SKILL_DIR/sherlock" ]; then
        UPGRADING=true
        OLD_VERSION=$("$SKILL_DIR/sherlock" --version 2>/dev/null || echo "unknown")
        info "Existing installation found (v$OLD_VERSION) - upgrading..."
    fi

    # Create skill directory
    info "Creating skill directory..."
    mkdir -p "$SKILL_DIR"

    # Download binary
    BINARY_URL="https://github.com/$REPO/releases/latest/download/sherlock-$PLATFORM"
    info "Downloading sherlock binary..."

    TEMP_FILE=$(mktemp)
    if ! download "$BINARY_URL" "$TEMP_FILE"; then
        rm -f "$TEMP_FILE"
        error "Failed to download binary. Check your internet connection or if the release exists."
    fi

    # Install binary to skill directory
    mv "$TEMP_FILE" "$SKILL_DIR/sherlock"
    chmod +x "$SKILL_DIR/sherlock"
    success "Installed binary to $SKILL_DIR/sherlock"

    # Download skill
    info "Downloading skill definition..."
    SKILL_URL="https://raw.githubusercontent.com/$REPO/main/.claude/skills/sherlock/SKILL.md"
    if download "$SKILL_URL" "$SKILL_DIR/SKILL.md"; then
        success "Installed skill to $SKILL_DIR/SKILL.md"
    else
        warn "Failed to download skill file. You can manually copy it later."
    fi

    # Create empty config to enable portable mode
    if [ ! -f "$SKILL_DIR/config.json" ]; then
        echo '{"version":"2.0","connections":{}}' > "$SKILL_DIR/config.json"
        chmod 600 "$SKILL_DIR/config.json"
        success "Created config.json (portable mode enabled)"
    fi

    # Add permission to Claude Code settings (workaround for bug)
    add_claude_permission

    # Get new version
    NEW_VERSION=$("$SKILL_DIR/sherlock" --version 2>/dev/null || echo "unknown")

    echo ""
    if [ "$UPGRADING" = true ]; then
        success "Upgrade complete! (v$OLD_VERSION -> v$NEW_VERSION)"
    else
        success "Installation complete! (v$NEW_VERSION)"
    fi
    echo ""
    echo "  Installed to: $SKILL_DIR"
    echo ""
    if [ "$UPGRADING" = false ]; then
        echo "  Next steps:"
        echo "  -----------"
        echo "  1. Run '$SKILL_DIR/sherlock setup' to configure your database connections"
        echo "  2. Use '/sherlock' in Claude Code to query your databases"
        echo ""

        # Ask about PATH setup
        echo -n "  Add sherlock to your PATH for easier command-line access? [y/N] "
        read -r REPLY
        if [[ "$REPLY" =~ ^[Yy]$ ]]; then
            add_to_path
        else
            echo ""
            echo "  Tip: You can add sherlock to your PATH later:"
            echo "    export PATH=\"\$HOME/.claude/skills/sherlock:\$PATH\""
            echo ""
        fi
    fi
    echo "  To uninstall:"
    echo "    rm -rf $SKILL_DIR"
    echo ""
}

main "$@"
