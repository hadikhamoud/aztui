#!/bin/bash
set -e

# aztui installer
# Usage: curl -fsSL https://raw.githubusercontent.com/hadikhamoud/aztui/main/install.sh | bash

REPO="hadikhamoud/aztui"
INSTALL_DIR="${AZTUI_INSTALL_DIR:-$HOME/.local/bin}"
BINARY_NAME="aztui"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# Detect OS and architecture
detect_platform() {
    local os arch

    case "$(uname -s)" in
        Linux*)  os="linux";;
        Darwin*) os="darwin";;
        MINGW*|MSYS*|CYGWIN*) os="windows";;
        *) error "Unsupported operating system: $(uname -s)";;
    esac

    case "$(uname -m)" in
        x86_64|amd64) arch="x64";;
        arm64|aarch64) arch="arm64";;
        *) error "Unsupported architecture: $(uname -m)";;
    esac

    echo "${os}-${arch}"
}

# Get the latest release version from GitHub
get_latest_version() {
    local version
    version=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')
    
    if [ -z "$version" ]; then
        error "Failed to fetch latest version"
    fi
    
    echo "$version"
}

# Download and install the binary
install_aztui() {
    local platform version download_url tmp_dir binary_path

    info "Detecting platform..."
    platform=$(detect_platform)
    info "Platform: $platform"

    info "Fetching latest version..."
    version=$(get_latest_version)
    info "Latest version: $version"

    # Construct the download URL
    binary_path="aztui-${platform}"
    if [ "$(uname -s)" = "MINGW"* ] || [ "$(uname -s)" = "MSYS"* ] || [ "$(uname -s)" = "CYGWIN"* ]; then
        binary_path="${binary_path}.exe"
    fi
    
    download_url="https://github.com/${REPO}/releases/download/${version}/${binary_path}"

    info "Downloading from: $download_url"

    # Create temp directory
    tmp_dir=$(mktemp -d)
    trap "rm -rf $tmp_dir" EXIT

    # Download the binary
    if ! curl -fsSL "$download_url" -o "$tmp_dir/$BINARY_NAME"; then
        error "Failed to download aztui"
    fi

    # Create install directory if it doesn't exist
    if [ ! -d "$INSTALL_DIR" ]; then
        info "Creating install directory: $INSTALL_DIR"
        mkdir -p "$INSTALL_DIR"
    fi

    # Move binary to install directory
    chmod +x "$tmp_dir/$BINARY_NAME"
    mv "$tmp_dir/$BINARY_NAME" "$INSTALL_DIR/$BINARY_NAME"

    success "aztui $version installed successfully to $INSTALL_DIR/$BINARY_NAME"

    # Check if install directory is in PATH
    if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
        warn "$INSTALL_DIR is not in your PATH"
        echo ""
        echo "Add the following to your shell profile (.bashrc, .zshrc, etc.):"
        echo ""
        echo "  export PATH=\"\$PATH:$INSTALL_DIR\""
        echo ""
    fi

    echo ""
    info "Run 'aztui' to get started!"
}

# Run the installer
install_aztui
