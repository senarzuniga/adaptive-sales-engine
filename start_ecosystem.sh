#!/usr/bin/env bash
# start_ecosystem.sh
# =====================================================================
# ACS Ecosystem Launcher — Linux / macOS
# Inicia todos los servicios del Adaptive Commercial System:
#   • Streamlit App (puerto 8501)
#   • Ingestion Monitor (puerto 8502)
#   • Next.js Frontend (puerto 8080) — opcional
#
# Uso:
#   chmod +x start_ecosystem.sh
#   ./start_ecosystem.sh
#   ./start_ecosystem.sh --mode streamlit
#   ./start_ecosystem.sh --detach
# =====================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODE="all"
DETACH=false

for arg in "$@"; do
  case $arg in
    --mode=*) MODE="${arg#*=}" ;;
    --detach) DETACH=true ;;
  esac
done

GREEN='\033[92m'; YELLOW='\033[93m'; RED='\033[91m'; CYAN='\033[96m'; RESET='\033[0m'; BOLD='\033[1m'

echo ""
echo -e "${BOLD}${CYAN}========================================================"
echo "  ADAPTIVE COMMERCIAL SYSTEM — Ecosystem Launcher"
echo -e "========================================================${RESET}"
echo "  Directorio: $REPO_ROOT"
echo "  Modo: $MODE"
echo "  Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

cd "$REPO_ROOT"

# ── Detect Python ────────────────────────────────────────────────
PYTHON_CMD=""
for cmd in python3 python; do
  if command -v "$cmd" &>/dev/null; then
    PYTHON_CMD="$cmd"
    break
  fi
done
if [ -z "$PYTHON_CMD" ]; then
  echo -e "${RED}[ERROR] Python no encontrado en PATH.${RESET}"
  echo "        Instala Python 3.8+ y vuelve a intentarlo."
  exit 1
fi
echo -e "${GREEN}[OK] Python: $PYTHON_CMD ($($PYTHON_CMD --version 2>&1))${RESET}"

# ── Load .env ────────────────────────────────────────────────────
if [ -f ".env" ]; then
  set -o allexport
  # shellcheck disable=SC1091
  source .env 2>/dev/null || true
  set +o allexport
  echo -e "${GREEN}[OK] .env cargado${RESET}"
else
  echo -e "${YELLOW}[WARN] .env no encontrado — modo demo${RESET}"
fi

# ── Verify ACS ───────────────────────────────────────────────────
echo ""
echo -e "${CYAN}[INFO] Verificando sistema...${RESET}"
if "$PYTHON_CMD" scripts/verify_acs.py --json > /dev/null 2>&1; then
  echo -e "${GREEN}[OK] Verificación ACS pasada${RESET}"
else
  echo -e "${YELLOW}[WARN] Algunos componentes no están al 100% — continuando...${RESET}"
fi

# ── PID tracking ─────────────────────────────────────────────────
PIDS=()

start_service() {
  local name="$1"; shift
  local cmd="$*"
  echo ""
  echo -e "${BOLD}▶  Iniciando $name...${RESET}"
  if $DETACH; then
    nohup bash -c "$cmd" >> "/tmp/acs_${name// /_}.log" 2>&1 &
  else
    bash -c "$cmd" &
  fi
  PIDS+=($!)
  echo -e "${GREEN}   [OK] $name arrancado (PID: ${PIDS[-1]})${RESET}"
}

# ── Start services ───────────────────────────────────────────────
if [[ "$MODE" == "all" || "$MODE" == "streamlit" ]]; then
  start_service "Streamlit App (8501)" \
    "$PYTHON_CMD -m streamlit run streamlit_app.py --server.port 8501 --server.headless true"
  sleep 2
fi

if [[ "$MODE" == "all" || "$MODE" == "monitor" ]]; then
  start_service "Ingestion Monitor (8502)" \
    "$PYTHON_CMD -m streamlit run launcher/ingestion_monitor.py --server.port 8502 --server.headless true"
fi

if [[ "$MODE" == "all" || "$MODE" == "nextjs" ]]; then
  if [ -f "package.json" ] && command -v npm &>/dev/null; then
    start_service "Next.js Frontend (8080)" "npm run dev"
  else
    echo -e "${YELLOW}▶  [SKIP] npm no disponible o package.json ausente${RESET}"
  fi
fi

# ── Open browser ─────────────────────────────────────────────────
sleep 4
if command -v xdg-open &>/dev/null; then
  xdg-open "http://localhost:8501" &>/dev/null &
elif command -v open &>/dev/null; then
  open "http://localhost:8501" &>/dev/null &
fi

echo ""
echo -e "${BOLD}${GREEN}========================================================"
echo "  ✅ ECOSISTEMA ACS INICIADO"
echo -e "========================================================${RESET}"
echo -e "  Streamlit App:      ${CYAN}http://localhost:8501${RESET}"
echo -e "  Ingestion Monitor:  ${CYAN}http://localhost:8502${RESET}"
echo -e "  Orchestrator Panel: ${CYAN}dashboard/orchestrator_panel.html${RESET}"
echo -e "  Offers Panel:       ${CYAN}dashboard/offers_panel.html${RESET}"
echo ""

if $DETACH; then
  echo "  [DETACH] Servicios en background. Logs en /tmp/acs_*.log"
  exit 0
fi

echo -e "${YELLOW}  Presiona Ctrl+C para detener todos los servicios...${RESET}"
echo ""

cleanup() {
  echo ""
  echo -e "${YELLOW}[ACS] Deteniendo servicios...${RESET}"
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  echo -e "${GREEN}[ACS] Ecosistema detenido.${RESET}"
  exit 0
}
trap cleanup INT TERM

wait
