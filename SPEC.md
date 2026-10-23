# English Speaking Coach — Especificación para Claude Code

23 oct 2026 · Luis

## Resumen

Una app personal para practicar inglés hablado 10–20 minutos al día con un tutor de IA: hablas, te responde por voz, te corrige de forma breve y guarda tus errores para repasarlos. La v1 se construye como **un solo archivo HTML** que funciona en dos modos sin cambiar la lógica:

- **Modo artifact** (primera opción): publicado en claude.ai, usa tu plan de Claude, sin API key.
- **Modo PWA** (respaldo): instalable desde Chrome en Android, llama a la API de Anthropic con tu propia key.

**Decisiones tomadas**

| Tema | Decisión |
| --- | --- |
| Nivel | B1 (intermedio) |
| Funciones v1 | Conversación libre + banco de errores, role-plays |
| Formato | **PWA** (Fase 0, 23 oct 2026: el visor de Claude bloquea el micrófono en la app de Android y en Chrome). El adaptador de artifact se mantiene, pero allí solo sirve escribiendo |
| Dispositivo principal | Móvil Android, uso diario de 10–20 min |

**¿Se puede desarrollar el artifact desde Claude Code?** Sí, con un matiz:

- **El código, siempre.** La app es un HTML autocontenido; Claude Code lo escribe, lo edita y lo prueba como cualquier proyecto web, en local o en la nube.
- **Publicarlo como artifact** requiere la herramienta Artifact de claude.ai. Las sesiones de Claude Code abiertas desde claude.ai/code o la app de Claude la tienen. En Claude Code de terminal no está garantizado: compruébalo pidiéndole «lista los tipos de artifact disponibles». Si no la tiene, desarrolla en local en modo PWA y publica el artifact desde una sesión de claude.ai/code.

## Funcionalidades de la v1

Una sesión típica dura 10–15 minutos: eliges modo, hablas, y al terminar ves un resumen con tus 3 errores principales.

1. **Pantalla de inicio**
   - Botones grandes: «Conversación libre» y «Role-play».
   - Racha de días seguidos y minutos hablados esta semana.
   - Aviso si hay errores pendientes de repaso.
2. **Conversación libre**
   - El tutor propone un tema cotidiano (trabajo, viajes, fin de semana) o usa el que tú digas.
   - Botón de micrófono: pulsar para hablar, pulsar para enviar. Tu frase aparece transcrita para que veas qué ha entendido.
   - El tutor responde por voz (y en texto) con frases cortas de nivel B1 y una pregunta para seguir.
   - Corrección ligera: como mucho una corrección por turno, en una línea aparte, sin interrumpir la conversación.
3. **Role-plays**
   - Seis escenarios: entrevista de trabajo, check-in en hotel, restaurante, médico, reunión de trabajo, reclamación a atención al cliente.
   - Cada uno tiene un objetivo («consigue que te cambien la habitación») y el tutor mantiene su personaje hasta que lo cumples o pasan unos 8 turnos.
4. **Repaso al empezar**
   - Si hay errores pendientes, la sesión empieza con 2–3 de ellos: el tutor te da la frase en español o una situación y tú la dices bien en inglés.
   - Si aciertas, el error sube de nivel y tarda más en volver; si fallas, vuelve pronto.
5. **Resumen de sesión**
   - Al pulsar «Terminar»: tus 3 errores más importantes (lo que dijiste → versión correcta → explicación breve en español), 3 expresiones nuevas útiles y una nota de ánimo.
   - Los errores se guardan en el banco automáticamente.
6. **Banco de errores**
   - Lista de todos tus errores, filtrable por tipo (gramática, vocabulario, pronunciación, expresión poco natural).
   - Botón para escuchar la versión correcta.

**Fuera de la v1:** shadowing, diario hablado, puntuación de pronunciación por fonemas, recordatorios push.

## Arquitectura

La interfaz y la lógica de sesión no saben en qué modo corren: hablan con tres adaptadores, y solo dos de ellos cambian de implementación según el modo.

```
                                        MODO ARTIFACT              MODO PWA
┌──────────────────┐   ┌────────────┐   ┌───────────────────────────────────────────┐
│ index.html       │──▶│ Voz        │──▶│ Web Speech API (Chrome) — igual en ambos  │
│  Inicio          │   └────────────┘   └───────────────────────────────────────────┘
│  Conversación    │   ┌────────────┐   ┌────────────────────┐   ┌──────────────────┐
│  Role-play       │──▶│ IA         │──▶│ claude.use('sample')│ o │ API Anthropic    │
│  Resumen         │   └────────────┘   │ tu plan de Claude   │   │ fetch + API key  │
│  Banco de errores│   ┌────────────┐   ├────────────────────┤   ├──────────────────┤
│                  │──▶│ Almacen.   │──▶│ claude.use('db')    │ o │ localStorage     │
└──────────────────┘   └────────────┘   │ privado en tu cuenta│   │ solo en el móvil │
                                        └────────────────────┘   └──────────────────┘
Al arrancar: si claude.use('sample') responde → modo artifact; si no → modo PWA.
```

La voz es la misma en los dos modos; la IA y el almacenamiento eligen implementación una sola vez, al arrancar.

**Interfaces de los adaptadores**

```js
// Voz — Web Speech API, igual en ambos modos
voice.listen()            // → Promise<string> (lo que has dicho, en inglés)
voice.speak(text)         // → Promise<void>  (lee sin la línea "✎")

// IA — artifact: claude.use("sample") · PWA: fetch a api.anthropic.com
ai.turn(rules, messages)  // → Promise<string>  respuesta del tutor
ai.summary(transcript)    // → Promise<{errors, phrases, feedback_es}>

// Almacenamiento — artifact: claude.use("db") · PWA: localStorage
store.listErrors()        // → Promise<Error[]>
store.saveErrors(errors)  // → Promise<void>
store.saveSession(s)      // → Promise<void>
store.dueForReview(today) // → Promise<Error[]>  máx. 3
```

## Prompts del tutor

Tres prompts cubren toda la v1: el del tutor (cada turno), el de escenario (se añade en role-play) y el de resumen (al terminar). Van en inglés porque el tutor habla en inglés; las explicaciones de errores salen en español.

En modo artifact no hay *system prompt*: las instrucciones van como **primer turno de usuario** que la app mantiene siempre al principio de la lista. En modo PWA se envían como `system`. El adaptador de IA se encarga de esa diferencia.

**1. Tutor (cada turno)**

```
You are Sam, a friendly English conversation tutor. The learner is a Spanish speaker at B1 level practising SPOKEN English.
Rules:
- Reply in 1-3 short sentences (max ~40 words), simple B1 vocabulary, then ONE open question to keep them talking.
- Your reply will be read aloud: no lists, no emojis, no markdown.
- If the learner made an important mistake, add ONE correction on a separate final line starting with "✎ " in the form: ✎ "what they said" → "better version". Skip it if the mistake is minor. Never correct more than one thing per turn.
- Their text comes from speech recognition: ignore punctuation, capitalisation and obvious transcription glitches.
- If they write in Spanish, help with the English phrase they need and invite them to say it.
- Start of session: if REVIEW items are provided, first ask them to say 2-3 of those phrases correctly (give the Spanish meaning or a situation), one at a time, then move to the conversation.
```

**2. Escenario de role-play (se añade al prompt del tutor)**

```
ROLE-PLAY: {title}. You play {role}. Setting: {setting}.
Learner's goal: {goal}.
Stay in character. Create one small complication. After the goal is reached or ~8 turns, step out of character with: "Great job! Tap Finish to see your summary."
```

Escenarios iniciales (datos en un array JS, fácil de ampliar):

| Escenario | Personaje del tutor | Objetivo del usuario |
| --- | --- | --- |
| Entrevista de trabajo | Responsable de RR. HH. | Presentarte y explicar un logro |
| Hotel | Recepcionista | Hacer el check-in y cambiar de habitación por ruido |
| Restaurante | Camarero | Pedir con una alergia y pedir la cuenta |
| Médico | Médica de cabecera | Describir síntomas y entender el tratamiento |
| Reunión | Compañero de equipo | Dar una actualización y pedir más plazo |
| Atención al cliente | Agente telefónico | Reclamar un pedido que no llegó |

**3. Resumen de sesión (devuelve JSON)**

```
Analyse this English practice transcript of a B1 Spanish-speaking learner. Reply with ONLY a JSON object:
{"errors":[{"said":"...","correct":"...","explanation_es":"short explanation in Spanish","type":"grammar|vocabulary|pronunciation|naturalness"}],
 "phrases":[{"en":"...","es":"..."}],
 "feedback_es":"one encouraging sentence in Spanish"}
Max 3 errors (the most important, recurring ones first), max 3 useful phrases. Ignore transcription glitches.
TRANSCRIPT:
{transcript}
```

En modo artifact se llama con `sample.json(...)`, que ya parsea la respuesta; en modo PWA, con la API y `JSON.parse` tolerante.

## Modelo de datos

Dos colecciones bastan: errores y sesiones. Los nombres de campo son los mismos en los dos modos; solo cambia dónde se guardan.

| Modo | Dónde | Ruta |
| --- | --- | --- |
| Artifact | Capacidad `db` (privada por usuario) | `data/users/{userId}/errors/items/{id}` y `data/users/{userId}/sessions/items/{id}` (un documento necesita un número par de segmentos) |
| PWA | `localStorage` del móvil (con botón de exportar/importar JSON) | claves `esc.errors` y `esc.sessions` |

**Error**

```json
{
  "id": "e_2026-10-23_1",
  "said": "I am agree with you",
  "correct": "I agree with you",
  "explanation_es": "'agree' ya es verbo: no lleva 'am'.",
  "type": "grammar",
  "createdAt": "2026-10-23",
  "box": 1,
  "nextReview": "2026-10-24",
  "timesSeen": 1,
  "timesCorrect": 0
}
```

**Sesión**

```json
{
  "id": "s_2026-10-23T11-50",
  "date": "2026-10-23",
  "mode": "free | roleplay",
  "scenario": "hotel",
  "minutes": 12,
  "turns": 14,
  "errorIds": ["e_2026-10-23_1"],
  "phrases": [{"en": "Could you double-check?", "es": "¿Podría comprobarlo?"}]
}
```

**Repaso (cajas de Leitner):** caja 1 → al día siguiente, 2 → 3 días, 3 → 7 días, 4 → 21 días, 5 → dominado. Acierto: sube una caja. Fallo: vuelve a la caja 1. Al iniciar sesión se eligen hasta 3 errores con `nextReview` ≤ hoy, de la caja más baja primero.

La transcripción completa no se guarda (solo vive en memoria durante la sesión); así el almacenamiento queda pequeño y privado.

## Plan de desarrollo

Cinco fases cortas; la fase 0 decide el modo y conviene hacerla antes de escribir nada más.

1. **Fase 0 — Prueba de micrófono (30 min).** Una página mínima con un botón que activa `SpeechRecognition` y muestra lo transcrito, y otro que lee una frase con `speechSynthesis`. Publicarla como artifact y abrirla en el móvil (app de Claude y Chrome).
   - *Terminado cuando:* sabes si el micrófono funciona dentro del visor de Claude. Sí → modo artifact. No → modo PWA.
2. **Fase 1 — Bucle de conversación.** Adaptador de voz + adaptador de IA + pantalla de conversación libre con el prompt del tutor.
   - *Terminado cuando:* mantienes 10 turnos hablados seguidos, oyes las respuestas y ves las correcciones «✎» separadas del texto que se lee en voz alta.
3. **Fase 2 — Resumen y banco de errores.** Botón «Terminar», prompt de resumen en JSON, guardado de errores y pantalla del banco.
   - *Terminado cuando:* tras una sesión ves 3 errores guardados, y siguen ahí al cerrar y volver a abrir la app.
4. **Fase 3 — Role-plays y repaso.** Selector de escenarios, repaso inicial con cajas de Leitner, racha y minutos en la pantalla de inicio.
   - *Terminado cuando:* completas un role-play de hotel y la sesión siguiente empieza repasando errores del día anterior.
5. **Fase 4 — Pulido para el móvil.** Botones grandes al alcance del pulgar, modo oscuro, voz inglesa elegible (británica/americana), velocidad de voz ajustable, manejo de errores (sin red, límite de uso).
   - *Terminado cuando:* la usas 5 días seguidos sin tener que tocar nada técnico.

- [x] Fase 0: prueba de micrófono en el móvil — micrófono bloqueado en el visor → modo PWA
- [x] Fase 1: bucle de conversación — 10 turnos hablados en Android (23 oct 2026)
- [x] Fase 2: resumen y banco de errores — errores guardados y persistentes (23 oct 2026)
- [x] Fase 3: role-plays y repaso — role-play de hotel y repaso al día siguiente (24 oct 2026)
- [ ] Fase 4: pulido para el móvil

## Cómo trabajar con Claude Code

Abre una sesión de Claude Code (mejor en claude.ai/code o desde la app), pon este archivo y CLAUDE.md en la carpeta del proyecto y empieza con el prompt de abajo.

**Prompt inicial**

```
Lee SPEC.md y CLAUDE.md.
Empieza por la Fase 0: una página mínima de prueba de micrófono y voz.
Publícala como artifact y dime cómo probarla en mi Android.
No avances a la Fase 1 hasta que te diga el resultado.
```

**Estructura del proyecto**

```
english-coach/
├── CLAUDE.md            # reglas para Claude Code
├── SPEC.md              # este archivo
├── index.html           # LA app: HTML + CSS + JS en un solo archivo
├── sw.js                # service worker mínimo; en la raíz porque su alcance es su carpeta
├── pwa/
│   ├── manifest.webmanifest
│   ├── icon-192.png
│   └── icon-512.png
└── tests/
    └── prompts.md       # conversaciones de prueba y resultados esperados
```

**Probar en local**

- `python3 -m http.server 8000` y abrir `http://localhost:8000` en Chrome de escritorio. El micrófono funciona en `localhost` sin HTTPS.
- En local no hay `window.claude`, así que la app arranca en modo PWA y pide la API key. Es la forma rápida de iterar.
- El móvil necesita HTTPS: prueba allí la versión publicada (artifact o GitHub Pages).

**Publicar como artifact**

- Pedir a Claude Code: «publica index.html como artifact con las capacidades `sample`, `db` y `user`». Para actualizarlo, «vuelve a publicarlo»: el enlace no cambia.
- La primera vez que hables, Claude pedirá permiso para que el artifact use tu cuenta. Acéptalo.
- En el móvil: fija el artifact en la barra lateral de Claude para tenerlo a mano.

**Publicar como PWA**

- Crear un repositorio en GitHub, subir `index.html`, `sw.js` y la carpeta `pwa/`, activar GitHub Pages.
- En el móvil: abrir la URL en Chrome → menú ⋮ → «Añadir a pantalla de inicio» (o «Instalar app»).
- Crear la API key en console.anthropic.com, ponerle un límite de gasto mensual bajo y pegarla en Ajustes de la app.

## Riesgos y preguntas abiertas

El riesgo principal es el micrófono dentro del visor de Claude; la fase 0 lo resuelve en media hora.

| Riesgo | Impacto | Plan |
| --- | --- | --- |
| El visor de Claude bloquea el micrófono | El modo artifact no sirve para hablar | Pasar a PWA; el resto del código no cambia |
| Reconocimiento de voz de Chrome con acento español | Transcripciones con fallos | El prompt ignora fallos evidentes; la transcripción visible te deja repetir. Probar `lang = "en-GB"` y `"en-US"` |
| Límites de uso del plan de Claude (modo artifact) | Una sesión larga puede cortarse con `rate_limited` | Turnos cortos y modelo rápido; mostrar aviso y permitir terminar con resumen |
| Coste de la API (modo PWA) | Gasto inesperado | Límite de gasto mensual en la consola de Anthropic; modelo Haiku para conversar |
| API key guardada en el móvil | Si alguien usa tu móvil, puede gastarla | Uso personal; key con límite bajo y revocable |
| Errores repetidos o triviales en el banco | El repaso aburre | El prompt de resumen prioriza errores recurrentes; botón para borrar un error |

**Preguntas abiertas**

- ¿Voz británica o americana por defecto?
- ¿Quieres un recordatorio diario (notificación o tarea programada) o prefieres abrirla tú?
- ¿Algún escenario de role-play propio de tu trabajo que añadir a la lista?
