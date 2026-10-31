# Auditoría de dependencias — línea base

Fecha: 2026-10-31
Node: v22.20.0 · npm: 10.9.3

## Resultado de `npm install`

- 146 paquetes instalados.
- 12 vulnerabilidades reportadas por `npm audit`:
  - 1 crítica
  - 7 altas
  - 4 moderadas

## Vulnerabilidades detectadas

| Paquete | Severidad | Corrección sugerida |
| --- | --- | --- |
| proxy-addr | crítica | `npm audit fix` |
| body-parser | alta | `npm audit fix` |
| brace-expansion | alta | `npm audit fix` |
| minimatch | alta | `npm audit fix` |
| multer | alta | `npm audit fix` |
| nodemailer | alta | `npm audit fix --force` (10.3.1, cambio mayor) |
| path-to-regexp | alta | `npm audit fix` |
| picomatch | alta | `npm audit fix` |
| bn.js | moderada | `npm audit fix` |
| mongoose | moderada | `npm audit fix` |
| qs | moderada | `npm audit fix` |

> Este documento es la referencia "antes". El resultado final se documenta al cierre de la Fase 1.
