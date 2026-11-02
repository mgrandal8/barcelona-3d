#!/usr/bin/env bash
# Uso: bash scripts/esperar-url.sh <url> [url…]
# Espera (hasta 60 s) a que cada URL responda; lo usa el workflow de calidad tras lanzar vite preview.
for url in "$@"; do
  for _ in $(seq 60); do
    curl -sf -o /dev/null "$url" && continue 2
    sleep 1
  done
  echo "no responde: $url" >&2
  exit 1
done
