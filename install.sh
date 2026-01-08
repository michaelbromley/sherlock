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
        echo "  Tip: Add sherlock to your PATH for easier access:"
        echo ""
        echo "    # Add to ~/.zshrc or ~/.bashrc:"
        echo "    export PATH=\"\$HOME/.claude/skills/sherlock:\$PATH\""
        echo ""
        echo "    # Then you can just run:"
        echo "    sherlock setup"
        echo "    sherlock -c mydb tables"
        echo ""
    fi
    echo "  To uninstall:"
    echo "    rm -rf $SKILL_DIR"
    echo ""
}

main "$@"
