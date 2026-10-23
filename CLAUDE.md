# English Speaking Coach
App personal de práctica de inglés hablado (usuario B1, hispanohablante, Android). La especificación completa está en SPEC.md.

## Reglas
- Todo el código de la app vive en index.html (un solo archivo, sin build).
- Tres adaptadores aislados: ai (artifact|api), store (db|local), voice (Web Speech API).
- Detectar el modo al arrancar: si `await claude.use("sample")` devuelve una función → artifact; si no → PWA con API key.
- En modo artifact: instrucciones como primer turno user (no hay system), `cache: false` en cada turno de chat, `modelTier: "quick"` para la conversación y "default" para el resumen. Llamar a Claude solo tras una acción del usuario.
- En modo PWA: fetch a https://api.anthropic.com/v1/messages con cabeceras x-api-key, anthropic-version: 2023-06-01 y anthropic-dangerous-direct-browser-access: true. Modelo claude-haiku-5-5 para conversar.
- Nunca escribir la API key en el código: se pide en Ajustes y se guarda en localStorage.
- Interfaz en español; el tutor habla en inglés. Pensado para móvil: botones ≥ 48 px, una mano.
- Antes de dar algo por terminado: comprobar el criterio de la fase en SPEC.md.
