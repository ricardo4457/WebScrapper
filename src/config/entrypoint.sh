#!/bin/bash
set -e

if [ "$SCRAPER_HEADLESS" != "true" ]; then
  echo "[entrypoint] A arrancar Xvfb no display :99..."
  Xvfb :99 -screen 0 1920x1080x24 -ac +extension GLX +render -noreset &
  XVFB_PID=$!

  # Espera o Xvfb ficar mesmo pronto antes de lanÃ§ar o Chrome.
  for i in $(seq 1 10); do
    if xdpyinfo -display :99 >/dev/null 2>&1; then
      echo "[entrypoint] Xvfb pronto (pid $XVFB_PID)."
      break
    fi
    sleep 0.5
  done
fi

# 'exec' substitui este processo shell pelo node, sem sub-shell no meio -
# stdout/stderr passam a ser herdados diretamente pelo Docker, sem buffering
# extra, e sinais (SIGTERM/SIGINT) chegam ao node corretamente.
exec "$@"