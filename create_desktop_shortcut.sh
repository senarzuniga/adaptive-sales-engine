#!/usr/bin/env bash
# create_desktop_shortcut.sh
# =====================================================================
# Crea un acceso directo en el escritorio de Linux (GNOME/KDE)
# y macOS para lanzar el ecosistema ACS con un solo clic.
#
# Uso:
#   chmod +x create_desktop_shortcut.sh
#   ./create_desktop_shortcut.sh
# =====================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LAUNCH_SCRIPT="$REPO_ROOT/start_ecosystem.sh"

GREEN='\033[92m'; YELLOW='\033[93m'; RED='\033[91m'; CYAN='\033[96m'; RESET='\033[0m'

if [ ! -f "$LAUNCH_SCRIPT" ]; then
  echo -e "${RED}[ERROR] No se encontró start_ecosystem.sh en: $LAUNCH_SCRIPT${RESET}"
  exit 1
fi

chmod +x "$LAUNCH_SCRIPT"
chmod +x "$REPO_ROOT/autostart/linux_autostart.sh" 2>/dev/null || true
chmod +x "$REPO_ROOT/autostart/macos_autostart.sh" 2>/dev/null || true

OS="$(uname -s)"

create_linux_shortcut() {
  # Standard XDG desktop entry (GNOME, KDE, XFCE, etc.)
  DESKTOP_FILE="$HOME/Desktop/acs-sales-engine.desktop"
  APPS_FILE="$HOME/.local/share/applications/acs-sales-engine.desktop"

  ENTRY="[Desktop Entry]
Version=1.0
Type=Application
Name=ACS Sales Engine
Comment=Adaptive Commercial System — Start Ecosystem
Exec=bash -c 'cd \"$REPO_ROOT\" && ./start_ecosystem.sh'
Icon=utilities-terminal
Terminal=true
Categories=Office;Development;
StartupNotify=true
"

  mkdir -p "$HOME/Desktop" "$HOME/.local/share/applications"

  echo "$ENTRY" > "$DESKTOP_FILE"
  echo "$ENTRY" > "$APPS_FILE"
  chmod +x "$DESKTOP_FILE" "$APPS_FILE"

  # Trust the desktop file (GNOME)
  if command -v gio &>/dev/null; then
    gio set "$DESKTOP_FILE" "metadata::trusted" true 2>/dev/null || true
  fi

  echo -e "${GREEN}✅ Acceso directo creado: $DESKTOP_FILE${RESET}"
  echo -e "   También registrado en: $APPS_FILE"
}

create_macos_shortcut() {
  # Create a simple macOS app wrapper using AppleScript
  APP_DIR="$HOME/Desktop/ACS Sales Engine.app"
  MACOS_DIR="$APP_DIR/Contents/MacOS"
  RESOURCES_DIR="$APP_DIR/Contents/Resources"
  PLIST="$APP_DIR/Contents/Info.plist"

  mkdir -p "$MACOS_DIR" "$RESOURCES_DIR"

  # Launcher script
  cat > "$MACOS_DIR/launcher" <<APPEOF
#!/usr/bin/env bash
cd "$REPO_ROOT"
exec ./start_ecosystem.sh
APPEOF
  chmod +x "$MACOS_DIR/launcher"

  # Info.plist
  cat > "$PLIST" <<PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
    "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key>
    <string>ACS Sales Engine</string>
    <key>CFBundleDisplayName</key>
    <string>ACS Sales Engine</string>
    <key>CFBundleIdentifier</key>
    <string>com.acs.adaptive-sales-engine</string>
    <key>CFBundleVersion</key>
    <string>1.0</string>
    <key>CFBundleExecutable</key>
    <string>launcher</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.13</string>
</dict>
</plist>
PLISTEOF

  echo -e "${GREEN}✅ App creada: $APP_DIR${RESET}"
  echo -e "   Doble clic en el escritorio para iniciar el ACS."
}

echo ""
echo -e "${CYAN}Creando acceso directo en el escritorio...${RESET}"
echo -e "  Sistema: $OS"
echo -e "  Repo: $REPO_ROOT"
echo ""

case "$OS" in
  Linux)
    create_linux_shortcut
    ;;
  Darwin)
    create_macos_shortcut
    ;;
  *)
    echo -e "${YELLOW}[WARN] Sistema no reconocido: $OS${RESET}"
    echo -e "       Crea el acceso directo manualmente apuntando a:"
    echo -e "       $LAUNCH_SCRIPT"
    ;;
esac

echo ""
echo -e "${CYAN}Para activar el inicio automático al encender el equipo:${RESET}"
if [ "$OS" = "Linux" ]; then
  echo -e "  ${YELLOW}./autostart/linux_autostart.sh install${RESET}"
elif [ "$OS" = "Darwin" ]; then
  echo -e "  ${YELLOW}./autostart/macos_autostart.sh install${RESET}"
fi
echo ""
