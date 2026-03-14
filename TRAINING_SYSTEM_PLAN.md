# Plan: Sistema de Entrenador de Ajedrez Personalizado

## Contexto del Jugador

- **Usuario Lichess**: LaMuerteEnTangas
- **Rating actual**: ~1900 Lichess
- **Rating objetivo**: 2200 FIDE
- **Rating histórico**: ~2200 Lichess (hace 2 años, cuando entrenaba activamente)
- **Control de tiempo**: 3 minutos (blitz)
- **Repertorio con blancas**: Ruy López
- **Repertorio con negras**: Francesa (ante 1.e4)
- **Debilidad autopercibida**: Finales (lo que menos ha estudiado)
- **Tiempo disponible**: ~30 min/día
- **Nota**: Repertorio limitado, podría beneficiarse de ampliar aperturas

## Estado Actual de la App

### Funciona bien
- **StockfishService** — Motor WASM funcionando, evalúa posiciones, da mejor jugada, profundidad configurable
- **PgnService** — Parsea PGNs correctamente, importa archivos .pgn
- **ChessLogicService** — Validación de jugadas, manejo de FEN/PGN via chess.js
- **GameAnalysisService** — Análisis con fórmulas Lichess (accuracy, ACPL, clasificación de jugadas)

### Roto o incompleto
1. **Lichess Import NO funciona** — `LichessApiService` llama a un backend REST (`/api/lichess/games/{username}`) que no existe. El `proxy.conf.json` tiene configurado proxy a `https://lichess.org/api/*` pero el servicio no lo usa.
2. **No hay base de datos de aperturas** — Campo `opening_name` en el modelo `Game` existe pero NUNCA se llena. ECO solo viene del header PGN (si existe). No hay tabla ECO → nombre. No hay detección automática de apertura desde las jugadas.
3. **Clasificación "book" inalcanzable** — `MoveClassification` incluye 'book' pero `classifyMove()` nunca lo retorna.
4. **Análisis no se persiste** — `analysis_json` en el modelo existe pero rara vez se guarda tras analizar.
5. **La app migró de IndexedDB/Dexie a backend REST** — El CLAUDE.md dice offline-first con Dexie, pero `DatabaseService` ahora usa HTTP calls a `/api/*`. Esto es inconsistente con la documentación.

## Fases del Plan

### Fase 1: Arreglar los Cimientos

#### 1.1 — Arreglar importación de Lichess
- Reescribir `LichessApiService` para usar directamente el proxy `/lichess-api/*` que ya está en `proxy.conf.json`
- Implementar parsing de NDJSON (formato que usa la API de Lichess)
- Endpoint a usar: `GET /lichess-api/games/user/{username}?max=100&perfType=blitz&opening=true`
  - El parámetro `opening=true` hace que Lichess devuelva el nombre de la apertura
- Parsear cada línea NDJSON → extraer PGN, headers, apertura, ECO
- Guardar las partidas en la DB con `source: 'lichess'`
- Crear colección automática tipo 'lichess'
- Solo partidas a 3 minutos (blitz) para el usuario LaMuerteEnTangas

#### 1.2 — Base de datos de aperturas (ECO)
- Crear/integrar una tabla de clasificación ECO (A00-E99) con nombres de aperturas
- Fuentes posibles: archivo TSV/JSON con las ~500 líneas principales de ECO
- Servicio `OpeningService` que dado un array de jugadas detecte la apertura (match más largo)
- Al importar partidas (PGN o Lichess), clasificar automáticamente
- Rellenar `opening_name` en todas las partidas existentes

#### 1.3 — Persistir análisis
- Tras cada análisis, guardar `analysis_json` en la partida
- Al abrir una partida ya analizada, cargar el análisis sin recalcular
- Mostrar indicador de "ya analizada" en la lista de partidas

#### 1.4 — Activar clasificación "book"
- Usar la base de datos de aperturas para marcar jugadas como "book" durante el análisis
- Si una jugada está dentro de la teoría de apertura conocida → clasificar como 'book' en vez de calcular accuracy

### Fase 2: Análisis en Masa y Perfil del Jugador

#### 2.1 — Análisis batch
- Función para analizar N partidas secuencialmente con Stockfish
- Progreso visual (X de N partidas analizadas)
- Guardar resultados tras cada partida (no perder progreso si se interrumpe)

#### 2.2 — Módulo de estadísticas / Perfil del jugador
- Nueva feature route: `features/player-profile/`
- Agregar datos de todas las partidas analizadas:
  - **Por apertura**: accuracy promedio, win rate, errores frecuentes
  - **Por fase**: accuracy en apertura (jugadas 1-15) vs medio juego (15-30) vs final (30+)
  - **Por color**: rendimiento con blancas vs negras
  - **Tendencias temporales**: mejora o deterioro en el tiempo
  - **Tipos de error**: % blunders/mistakes/inaccuracies por fase
  - **Patrones**: ¿pierde más piezas por táctica? ¿finales perdidos desde posición ganada?

#### 2.3 — Detección de debilidades
- Algoritmo que identifique las 3-5 debilidades principales basado en datos
- Ejemplo de output: "Pierdes 15cp promedio en finales de torre vs 5cp en aperturas"
- Comparar debilidades autopercibidas vs reales

### Fase 3: Sistema de Entrenamiento

#### 3.1 — Plan de estudio personalizado
- Basado en debilidades detectadas, generar plan semanal
- Distribución de 30 min/día entre áreas
- Ejercicios específicos por tema

#### 3.2 — Banco de posiciones de entrenamiento
- Posiciones extraídas de las propias partidas del jugador donde cometió errores
- "Resuelve esta posición que fallaste el 15 de marzo"
- Posiciones de finales básicos (rey y torre vs rey, etc.)

#### 3.3 — Seguimiento de progreso
- Dashboard con evolución de accuracy por área
- Streak de entrenamiento diario
- Objetivos semanales/mensuales

## Notas Técnicas

- **Arquitectura**: Angular 17, standalone components, lazy-loaded routes
- **Estilos**: Inline en componentes, variables globales en `src/styles/variables.scss`
- **Motor**: Stockfish WASM single-threaded (no cambiar a multi-thread, rompe Web Speech API)
- **Persistencia**: Backend REST API (no IndexedDB como dice el CLAUDE.md — actualizar documentación)
- **Proxy Lichess**: `proxy.conf.json` mapea `/lichess-api/*` → `https://lichess.org/api/*`
