#!/bin/bash
set -e

# Sherlock Installer
# Usage: curl -fsSL https://raw.githubusercontent.com/michaelbromley/sherlock/main/install.sh | bash
#
# Installs the sherlock binary to ~/.local/bin (override with SHERLOCK_BIN_DIR),
# then offers to install the agent skill with the skills CLI (npx skills add).
# The binary and the skill are separate: the skill is a SKILL.md that any
# skill manager can install for any agent, and it runs `sherlock` from PATH.
#
# Earlier versions put the binary, the skill and the config together in
# ~/.claude/skills/sherlock. This installer moves the config out of there and
# removes the rest.

REPO="michaelbromley/sherlock"
BIN_DIR="${SHERLOCK_BIN_DIR:-$HOME/.local/bin}"
CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/sherlock"
OLD_DIR="$HOME/.claude/skills/sherlock"
OLD_PATH_LINE="export PATH=\"\$HOME/.claude/skills/sherlock:\$PATH\""
OLD_FISH_PATH_LINE="set -gx PATH \$HOME/.claude/skills/sherlock \$PATH"
OLD_PERMISSION='Bash(~/.claude/skills/sherlock/sherlock:*)'
PERMISSION='Bash(sherlock:*)'
SKILL_INSTALL_CMD="npx skills add $REPO -g"

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

# With `curl | bash`, stdin is this script, so questions are read from the
# terminal directly. With no terminal, every question is answered no, so an
# unattended install never edits shell config or runs anything extra.
can_prompt() {
    [ -z "$SHERLOCK_NO_PROMPT" ] && (: </dev/tty) 2>/dev/null
}

# ask "question" default(y|n) -> returns 0 for yes
ask() {
    local question="$1" default="$2" reply hint="[y/N]"
    [ "$default" = "y" ] && hint="[Y/n]"
    can_prompt || return 1
    echo -n "  $question $hint "
    read -r reply </dev/tty || reply=""
    [ -z "$reply" ] && reply="$default"
    [[ "$reply" =~ ^[Yy] ]]
}

# Detect platform. Only platforms with a released binary are accepted.
detect_platform() {
    local os arch

    os=$(uname -s | tr '[:upper:]' '[:lower:]')
    arch=$(uname -m)

    case "$os/$arch" in
        darwin/arm64|darwin/aarch64)
            echo "darwin-arm64"
            ;;
        linux/x86_64)
            echo "linux-x64"
            ;;
        *)
            error "No prebuilt sherlock binary for $os/$arch. Build it from source instead: https://github.com/$REPO#from-source"
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
# Migration from the old layout in ~/.claude/skills/sherlock
# =============================================================================

# Move a file into the config directory. An existing file there is backed up
# first, never overwritten.
move_config_file() {
    local name="$1"
    local src="$OLD_DIR/$name" dest="$CONFIG_DIR/$name"

    [ -f "$src" ] || return 0
    if [ -e "$dest" ]; then
        local backup="$dest.backup-$(date +%Y%m%d%H%M%S)"
        mv "$dest" "$backup"
        warn "Backed up the existing $dest to $backup"
    fi
    mv "$src" "$dest"
    chmod 600 "$dest"
    success "Moved $name to $dest"
}

# Merge a directory into the config directory. A file whose name is already
# taken there is kept under a ".migrated-<time>" name, never overwritten or
# dropped. The source is only removed once every file has moved.
move_config_dir() {
    local name="$1"
    local src="$OLD_DIR/$name" dest="$CONFIG_DIR/$name"
    local suffix=".migrated-$(date +%Y%m%d%H%M%S)" moved_all=true file target

    [ -d "$src" ] || return 0
    mkdir -p "$dest"
    while IFS= read -r -d '' file; do
        target="$dest/${file#./}"
        [ -e "$target" ] && target="$target$suffix"
        mkdir -p "$(dirname "$target")"
        mv "$src/${file#./}" "$target" || moved_all=false
    done < <(cd "$src" && find . -type f -print0)

    if [ "$moved_all" = true ]; then
        rm -rf "$src"
    else
        warn "Some files in $src could not be moved to $dest and were left in place."
    fi
}

# Remove the lines an earlier installer added to a shell config
remove_old_path_line() {
    local file="$1"
    [ -f "$file" ] || return 0
    grep -qF "$OLD_PATH_LINE" "$file" 2>/dev/null || grep -qF "$OLD_FISH_PATH_LINE" "$file" 2>/dev/null || return 0

    local tmp
    tmp=$(mktemp)
    awk -v a="$OLD_PATH_LINE" -v b="$OLD_FISH_PATH_LINE" '
        $0 == "# Added by sherlock installer" { held = $0; next }
        $0 == a || $0 == b { held = ""; next }
        { if (held != "") { print held; held = "" } print }
        END { if (held != "") print held }
    ' "$file" > "$tmp"
    # Write through the original file so its permissions and any symlink survive
    cat "$tmp" > "$file"
    rm -f "$tmp"
    success "Removed the old sherlock PATH entry from $file"
}

migrate_old_install() {
    [ -d "$OLD_DIR" ] || return 0
    [ -f "$OLD_DIR/sherlock" ] || [ -f "$OLD_DIR/config.json" ] || return 0

    info "Moving the old installation out of $OLD_DIR..."

    if [ -f "$OLD_DIR/config.json" ]; then
        # Tunnels started by the old binary keep their state in the old
        # directory; stop them before that state moves.
        if [ -x "$OLD_DIR/sherlock" ]; then
            "$OLD_DIR/sherlock" tunnel stop > /dev/null 2>&1 || true
        fi

        mkdir -p "$CONFIG_DIR"
        chmod 700 "$CONFIG_DIR"
        move_config_file config.json
        move_config_file .env
        move_config_dir logs
        move_config_dir cache
        rm -rf "$OLD_DIR/tunnels"
    fi

    rm -f "$OLD_DIR/sherlock" "$OLD_DIR/sherlock.old" "$OLD_DIR/sherlock.tmp"

    # A plain directory was made by an earlier installer, and its SKILL.md
    # names the old binary path. A symlink belongs to a skill manager; leave
    # its SKILL.md for that manager to update.
    if [ ! -L "$OLD_DIR" ]; then
        rm -f "$OLD_DIR/SKILL.md"
        if rmdir "$OLD_DIR" 2>/dev/null; then
            success "Removed $OLD_DIR"
        else
            warn "Left $OLD_DIR in place: it contains files the installer did not create."
        fi
    fi

    remove_old_path_line "$HOME/.zshrc"
    remove_old_path_line "$HOME/.bashrc"
    remove_old_path_line "$HOME/.bash_profile"
    remove_old_path_line "$HOME/.config/fish/config.fish"
}

# =============================================================================
# PATH setup
# =============================================================================
on_path() {
    case ":$PATH:" in
        *":$BIN_DIR:"*) return 0 ;;
        *) return 1 ;;
    esac
}

add_to_path() {
    local shell_config path_line="export PATH=\"$BIN_DIR:\$PATH\""

    case "$SHELL" in
        */zsh)
            shell_config="$HOME/.zshrc"
            ;;
        */bash)
            if [ -f "$HOME/.bashrc" ]; then
                shell_config="$HOME/.bashrc"
            else
                shell_config="$HOME/.bash_profile"
            fi
            ;;
        */fish)
            shell_config="$HOME/.config/fish/config.fish"
            path_line="fish_add_path $BIN_DIR"
            ;;
        *)
            warn "Couldn't detect your shell. Add this to your shell config:"
            echo ""
            echo "    $path_line"
            echo ""
            return 0
            ;;
    esac

    if [ -f "$shell_config" ] && grep -qF "$path_line" "$shell_config" 2>/dev/null; then
        info "PATH already configured in $shell_config"
        return 0
    fi

    mkdir -p "$(dirname "$shell_config")"
    {
        echo ""
        echo "# Added by sherlock installer"
        echo "$path_line"
    } >> "$shell_config"

    success "Added $BIN_DIR to PATH in $shell_config"
    echo -e "  ${YELLOW}Note:${NC} Open a new terminal, or run 'source $shell_config', to use 'sherlock'."
}

# =============================================================================
# WORKAROUND: Allow sherlock in Claude Code settings
# The skill's allowed-tools should grant this, but currently doesn't:
# https://github.com/anthropics/claude-code/issues/14956
# Once that is fixed, this section can be removed.
# =============================================================================
# Edit a Claude Code settings file with a jq filter, keeping the file (and
# any symlink to it) in place. Returns non-zero if jq fails.
edit_settings() {
    local file="$1" filter="$2" tmp
    tmp=$(mktemp)
    if jq --arg p "$PERMISSION" --arg o "$OLD_PERMISSION" "$filter" "$file" > "$tmp" 2>/dev/null; then
        cat "$tmp" > "$file"
        rm -f "$tmp"
    else
        rm -f "$tmp"
        return 1
    fi
}

has_rule() {
    jq -e --arg r "$2" '(.permissions.allow // []) | index($r)' "$1" > /dev/null 2>&1
}

update_claude_permission() {
    local settings_file="" file
    local claude_files=("$HOME/.claude/settings.local.json" "$HOME/.claude/settings.json")

    for file in "${claude_files[@]}"; do
        if [ -f "$file" ]; then
            settings_file="$file"
            break
        fi
    done
    [ -n "$settings_file" ] || return 0

    if ! command -v jq &> /dev/null; then
        warn "jq not found, so Claude Code settings were not updated."
        warn "Claude Code may ask before each sherlock command. To stop that, allow $PERMISSION."
        return 0
    fi

    # The old rule names a binary that no longer exists; remove it wherever it
    # is, leaving the rest of each allow list in its original order.
    for file in "${claude_files[@]}"; do
        if [ -f "$file" ] && has_rule "$file" "$OLD_PERMISSION"; then
            if edit_settings "$file" '.permissions.allow -= [$o]'; then
                info "Removed the old sherlock permission from $file"
            else
                warn "Could not remove $OLD_PERMISSION from $file"
            fi
        fi
    done

    has_rule "$settings_file" "$PERMISSION" && return 0
    if edit_settings "$settings_file" '.permissions.allow = ((.permissions.allow // []) + [$p])'; then
        info "Allowed $PERMISSION in $settings_file"
        echo "  This works around https://github.com/anthropics/claude-code/issues/14956, so Claude Code"
        echo "  runs sherlock without asking each time."
    else
        warn "Could not update $settings_file. Claude Code may ask before each sherlock command."
    fi
}

# =============================================================================
# Skill
# =============================================================================
install_skill() {
    echo ""
    info "The sherlock skill teaches your AI agent how to use sherlock."
    if ! command -v npx &> /dev/null; then
        echo "  Install it with the skills CLI, which needs Node.js:"
        echo ""
        echo "    $SKILL_INSTALL_CMD"
        echo ""
        return 0
    fi
    if ! can_prompt; then
        echo "  Install it for your agents with:"
        echo ""
        echo "    $SKILL_INSTALL_CMD"
        echo ""
        return 0
    fi
    if ask "Install it now for your agents (Claude Code, Codex, Cursor, ...)?" y; then
        # The skills CLI asks which agents to install for
        if ! npx -y skills add "$REPO" -g </dev/tty; then
            warn "The skill was not installed. Run this later: $SKILL_INSTALL_CMD"
        fi
    else
        echo "  Install it later with: $SKILL_INSTALL_CMD"
    fi
}

main() {
    # Every path below is built from $HOME, including the ones cleaned up
    [ -n "$HOME" ] && [ "$HOME" != "/" ] || error "HOME is not set."

    echo ""
    echo "  🔍 Sherlock Installer"
    echo "  ====================="
    echo ""

    info "Detecting platform..."
    PLATFORM=$(detect_platform)
    success "Detected platform: $PLATFORM"

    OLD_VERSION=""
    for existing in "$BIN_DIR/sherlock" "$OLD_DIR/sherlock"; do
        if [ -x "$existing" ] && [ ! -L "$existing" ]; then
            OLD_VERSION=$("$existing" --version 2>/dev/null || echo "unknown")
            info "Existing installation found (v$OLD_VERSION) - upgrading..."
            break
        fi
    done

    BINARY_URL="https://github.com/$REPO/releases/latest/download/sherlock-$PLATFORM"
    info "Downloading sherlock binary..."
    TEMP_FILE=$(mktemp)
    if ! download "$BINARY_URL" "$TEMP_FILE"; then
        rm -f "$TEMP_FILE"
        error "Failed to download binary. Check your internet connection or if the release exists."
    fi

    mkdir -p "$BIN_DIR"
    chmod +x "$TEMP_FILE"
    mv "$TEMP_FILE" "$BIN_DIR/sherlock"
    success "Installed binary to $BIN_DIR/sherlock"

    migrate_old_install
    update_claude_permission

    NEW_VERSION=$("$BIN_DIR/sherlock" --version 2>/dev/null || echo "unknown")

    if ! on_path; then
        echo ""
        warn "$BIN_DIR is not on your PATH, and agents run 'sherlock' from PATH."
        if ask "Add it to your shell config?" y; then
            add_to_path
        else
            echo "  Add it yourself with: export PATH=\"$BIN_DIR:\$PATH\""
        fi
    fi

    install_skill

    echo ""
    if [ -n "$OLD_VERSION" ]; then
        success "Upgrade complete! (v$OLD_VERSION -> v$NEW_VERSION)"
    else
        success "Installation complete! (v$NEW_VERSION)"
    fi
    echo ""
    echo "  Next: run 'sherlock manage' to add a database connection."
    echo "  Later: 'sherlock update' updates the binary, 'npx skills update sherlock -g' updates the skill."
    echo ""
    echo "  To uninstall: rm $BIN_DIR/sherlock, and 'npx skills remove sherlock -g' for the skill."
    echo "  Your connections are in $CONFIG_DIR."
    echo ""
}

main "$@"
