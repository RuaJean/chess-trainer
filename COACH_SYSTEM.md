# Sistema de Entrenador de Ajedrez — Documento Maestro

> Este documento es la fuente de verdad para Claude cuando actúa como entrenador de ajedrez.
> Léelo completo al inicio de cada sesión de coaching.

---

## 1. Perfil del Jugador

### Datos básicos
- **Nombre en Lichess**: LaMuerteEnTangas
- **Rating actual**: ~1862 Lichess Blitz
- **Rating objetivo**: 2200 FIDE
- **Rating histórico peak**: 1995 Lichess (en esta muestra), ~2200 hace 2 años
- **Control de tiempo habitual**: 3+0 (blitz sin incremento)
- **Tiempo disponible para entrenar**: ~30 min/día

### Repertorio declarado
- **Blancas**: Ruy López (1.e4)
- **Negras vs 1.e4**: Defensa Francesa
- **Negras vs 1.d4**: Sin repertorio definido (ha jugado QGD, Semi-Slav reactivamente)
- **Nota del jugador**: "No varío mucho de aperturas, tal vez deba aprender más"

### Análisis de 63 partidas (Dic 2025 - Mar 2026)

#### Resultados globales
- 34 victorias (54%) / 26 derrotas (41.3%) / 3 tablas (4.8%)
- Rating promedio: 1813 | Oponente promedio: 1811
- Tendencia: subiendo (1737 → 1862)

#### Rendimiento por color
| Color | Partidas | Win% | Observación |
|-------|----------|------|-------------|
| Blancas | 34 | 50.0% | BAJO para tener primer movimiento |
| Negras | 29 | 58.6% | Mejor que con blancas — inusual |

#### Rendimiento por apertura
| Apertura | Partidas | Score | Jugado como | Problema |
|----------|----------|-------|-------------|----------|
| Francesa | 18 | 58% | 15 Negras, 3 Blancas | Sólido — su mejor apertura |
| Ruy López | 7 | 43% | 7 Blancas | BAJO — pierde en variantes principales |
| Escandinava | 6 | 67% | 6 Blancas (oponente la juega) | Bien |
| Caro-Kann | 5 | 10% | 5 Blancas (oponente la juega) | DESASTRE — 0W 4L 1D |
| Peón Dama | 5 | 60% | 5 Negras | Aceptable |
| QGD | 4 | 62% | 4 Negras | Bien |
| Siciliana | 4 | 50% | 4 Blancas (oponente la juega) | Neutral |
| Pirc | 3 | 67% | 3 Blancas (oponente la juega) | Bien |

#### Gestión del tiempo — PROBLEMA CRÍTICO
| Métrica | Valor |
|---------|-------|
| Baja de 10 segundos | 33% de las partidas (21/63) |
| Derrotas relacionadas con tiempo | 50% de sus derrotas (13/26) |
| Perdidas por timeout | 7 partidas |
| Tiempo en jugada 10 | 161s (OK — juega rápido la apertura) |
| Tiempo en jugada 20 | 83s (ya gastó >50%) |
| Tiempo en jugada 30 | 36s (zona de peligro) |

**Patrón**: Gasta demasiado tiempo entre jugada 10-20 (la transición apertura→medio juego). Llega al medio juego tardío con menos de 40 segundos.

#### Cómo terminan sus partidas
- Resignación: 35 (55%)
- Mate: 13 (21%)
- Tiempo: 12 (19%)
- Tablas: 2 (3%)
- Ahogado: 1 (2%)

#### Por duración de partida
| Fase | Partidas | W-L | Observación |
|------|----------|-----|-------------|
| Cortas (≤20 jugadas) | 12 | 5-7 | Pierde más — errores tácticos tempranos |
| Medias (21-40 jugadas) | 41 | 24-16 | Su zona fuerte |
| Largas (40+ jugadas) | 10 | 5-3 | Aceptable pero muestra pocas |

### Debilidades detectadas (ordenadas por impacto)

1. **Gestión del tiempo** — 50% de derrotas están ligadas al reloj. Piensa demasiado en la transición apertura→medio juego.
2. **Preparación anti Caro-Kann** — 0% de victorias en 5 partidas. No tiene plan contra 1.e4 c6.
3. **Ruy López — variantes principales** — 43% de score. Pierde en Zukertort (0/2), Classical (0/2). Solo gana en líneas laterales.
4. **Partidas cortas** — Resultado negativo en partidas de ≤20 jugadas. Sugiere vulnerabilidad a trampas tácticas o desconocimiento teórico.
5. **Finales** — Autopercibido como debilidad. Pocas partidas largas en la muestra para confirmar estadísticamente, pero el jugador reconoce que es lo que menos ha estudiado.
6. **Sin repertorio vs 1.d4** — Juega reactivamente. Necesita un sistema definido.

### Fortalezas detectadas

1. **Defensa Francesa** — 58% de score, su apertura más fiable
2. **Medio juego** — Mejor resultado en partidas de 21-40 jugadas
3. **Contra irregulares** — Gana contra aperturas no teóricas
4. **Tendencia ascendente** — Mejorando mes a mes (Feb 65%, Mar 63%)
5. **Contra rivales más débiles** — 71% de victorias (convierte la ventaja)

---

## 2. Metodología de Coaching

### Filosofía (basada en Dvoretsky, Dorfman, GM Studer)

> "Una hora de entrenamiento enfocado supera cinco horas de entrenamiento aleatorio." — GM Noel Studer

**Principios rectores:**
1. **Arreglar la fuga más grande primero** — El problema que más puntos de rating cuesta tiene prioridad absoluta
2. **Calidad sobre cantidad** — 30 minutos enfocados > 2 horas sin dirección
3. **Datos, no intuición** — Las debilidades se miden, no se adivinan
4. **Enseñar a pensar, no a memorizar** — Entender planes, no líneas de 20 jugadas
5. **Periodización** — Rotar el foco cada 3 semanas para evitar estancamiento

### Marco de Análisis de Partidas (Método Dorfman)

Para cada partida analizada:
1. **Primero SIN engine** — El jugador repasa y marca dónde dudó
2. **Identificar 3-5 momentos críticos** — Posiciones donde cambió el rumbo
3. **Clasificar cada error**:
   - Táctico (no vio una combinación)
   - Posicional (plan equivocado)
   - De cálculo (vio la idea pero calculó mal)
   - De tiempo (error causado por apuro de reloj)
   - Psicológico (pánico, exceso de confianza)
   - Laguna teórica (desconocimiento de un final o apertura)
4. **Después con engine** — Comparar el análisis humano con Stockfish
5. **Extraer lección accionable** — No "metí la pata en jugada 24" sino "consistentemente ignoro amenazas en la primera fila"

### Clasificación de errores por categoría

| Categoría | Descripción | Ejemplo |
|-----------|-------------|---------|
| Táctico | No vio combinación/amenaza | Pierde pieza por clavada |
| Posicional | Plan equivocado para la posición | Atacar en el flanco equivocado |
| Estratégico | Mala comprensión del tipo de posición | Cambiar hacia un final perdido |
| Cálculo | Idea correcta, línea mal calculada | Vio el sacrificio pero no la defensa |
| Psicológico | Decisión emocional, no analítica | Pánico tras perder material |
| Tiempo | Error por presión del reloj | Metida de pata con 15 segundos |
| Teórico | Falta de conocimiento | No saber el final de torre teórico |

---

## 3. Plan de Entrenamiento

### Estructura semanal (30 min/día)

**Constante diaria (5-10 min):**
- Táctica: resolver puzzles con precisión (NO speed-solving). Rating ligeramente superior al nivel de comfort.

**Rotación (20-25 min restantes):**

| Día | Foco | Actividad específica |
|-----|------|---------------------|
| Lunes | Análisis de partida | Revisar tu partida más reciente con el Marco de Momentos Críticos |
| Martes | Finales | Una posición teórica (Lucena, Philidor, finales de torre). Estudiar y practicar |
| Miércoles | Cálculo | Posiciones complejas sin mover piezas. Método de jugadas candidatas |
| Jueves | Estrategia posicional | Desequilibrios de Silman: pieza mala, estructura, espacio |
| Viernes | Repertorio de aperturas | UNA línea, enfocada en los PLANES del medio juego resultante |
| Sábado | Partida seria | Jugar 15+10 o 30+0 (NO blitz 3+0 para entrenar) |
| Domingo | Revisión semanal | Repasar la semana, ajustar plan si es necesario |

### Ciclos de 3 semanas (periodización)

| Ciclo | Semanas | Énfasis rotativo |
|-------|---------|-----------------|
| 1 | 1-3 | **Anti Caro-Kann + Gestión de tiempo** — Prioridad #1 y #2 |
| 2 | 4-6 | **Ruy López (variantes principales) + Finales de torre** |
| 3 | 7-9 | **Táctica intensiva + Cálculo** |
| 4 | 10-12 | **Repertorio vs 1.d4 + Estrategia posicional** |

### Hitos de progreso

| Hito | Indicador | Estado |
|------|-----------|--------|
| Gestión de tiempo mejorada | <20% de partidas bajando de 10s (actual: 33%) | ❌ Pendiente |
| Anti Caro-Kann funcional | >40% score en Caro-Kann (actual: 10%) | ❌ Pendiente |
| Ruy López estable | >55% score (actual: 43%) | ❌ Pendiente |
| Finales básicos dominados | Lucena, Philidor, R+P vs R prácticos | ❌ Pendiente |
| Repertorio vs 1.d4 | Sistema definido y practicado | ❌ Pendiente |
| Blunder rate reducido | <1 blunder (>100cp) por partida seria | 🔍 Necesita análisis engine |
| Rating 2000 Lichess | Sostenido por 20+ partidas | ❌ Pendiente |
| Rating 2200 FIDE | Objetivo final | ❌ Pendiente |

---

## 4. Historial de Sesiones de Coaching

> Cada sesión con el entrenador debe registrarse aquí para mantener continuidad.

### Sesión 1 — 2026-03-15 (Sesión inaugural)
- **Qué se hizo**: Entrevista inicial, importación de 63 partidas de Lichess, análisis estadístico completo
- **Hallazgos clave**: Gestión de tiempo (50% de derrotas), Caro-Kann (0%), Ruy López bajo (43%), mejor con negras que blancas
- **Deberes asignados**: Ninguno aún (sesión de diagnóstico)
- **Próxima sesión**: Configurar MCP chessagine, analizar partidas con engine, crear plan diario concreto

---

## 5. Configuración Técnica

### MCP: chessagine-mcp
- **Repo**: https://github.com/jalpp/chessagine-mcp
- **37 herramientas** incluyendo: Stockfish 18, Leela Chess Zero, base de datos de aperturas, Lichess API, puzzles, análisis temático
- **Herramientas clave para coaching**:
  - `get-stockfish-analysis` — Evaluar posiciones
  - `get-stockfish-batch-analysis` — Analizar múltiples posiciones
  - `generate-game-review` — Revisión completa de partida con análisis temático
  - `find-critical-moments` — Detectar momentos donde cambia el rumbo
  - `get-theme-scores` — Evaluar temas posicionales (material, movilidad, espacio, seguridad del rey)
  - `get-tactical-position-summary` — Piezas colgadas, clavadas, horquillas
  - `fetch-lichess-games` — Obtener partidas recientes
  - `fetch-chess-puzzle` — Puzzles filtrados por tema y rating
  - `get-lichess-master-games` — Base de datos de maestros para preparación
  - `fen-openingbook-lookup` — Identificar aperturas
- **Configuración**: Requiere `LICHESS_API_TOKEN` y `LICHESS_USERNAME=LaMuerteEnTangas`

### App: chess-trainer (Angular 17)
- **Backend**: Django REST en Docker (puerto 8000), PostgreSQL (puerto 5433)
- **Base de datos**: 63 partidas importadas, análisis NO persistido aún
- **Features existentes**: Play AI, Library, Analysis, Blindfold, Settings
- **Features a construir**: Coach Dashboard, Player Profile, Training Plan, Game Review mejorado

---

## 6. Features a Construir en la App

### 6.1 — Coach Dashboard (`/coach`)
Pantalla principal del sistema de entrenamiento.
- **Ejercicio del día**: Basado en el plan semanal y el día actual
- **Partida para analizar**: Seleccionada automáticamente (la más reciente sin analizar)
- **Puzzle del día**: Filtrado por el tema de debilidad actual
- **Progreso semanal**: Qué días has entrenado, streak
- **Próximo hito**: El más cercano a completarse

### 6.2 — Player Profile (`/coach/profile`)
Estadísticas agregadas y visualización de debilidades.
- **Gráfico de rating** en el tiempo
- **Win rate por apertura** (tabla con barras de color)
- **Accuracy por fase** (apertura / medio juego / final) — requiere análisis engine
- **Gestión del tiempo**: gráfico de tiempo promedio restante por jugada
- **Distribución de errores**: pie chart con categorías (táctico, posicional, tiempo, etc.)
- **Top 5 debilidades** con score y tendencia

### 6.3 — Training Plan (`/coach/plan`)
El plan de estudio visual y editable.
- **Vista calendario** con el tema de cada día
- **Ciclo actual**: En qué semana del ciclo de 3 semanas estamos
- **Ejercicios completados** vs pendientes
- **Historial de sesiones**: Log de cada sesión de coaching (leer/escribir Sección 4 de este doc)

### 6.4 — Game Review mejorado (`/coach/review/:gameId`)
Análisis de partida con metodología de entrenador, no solo engine.
- **Momentos críticos** marcados automáticamente (usando `find-critical-moments` de chessagine)
- **Clasificación de errores por tipo** (táctico/posicional/tiempo/etc.)
- **Gráfico de tiempo** superpuesto al gráfico de evaluación
- **Panel "¿Qué pensabas?"**: El jugador puede escribir notas en cada momento crítico
- **Lección extraída**: Resumen accionable al final ("En esta partida, tu patrón de error fue X")
- **Comparación con la base de datos de maestros**: En la apertura, mostrar qué jugarían los maestros

### 6.5 — Banco de Posiciones (`/coach/positions`)
Colección de posiciones de entrenamiento.
- **Posiciones de tus partidas**: Donde cometiste errores (auto-extraídas del análisis)
- **Posiciones teóricas**: Finales fundamentales (Lucena, Philidor, etc.)
- **Posiciones de apertura**: Posiciones críticas de tu repertorio
- **Modo drill**: Presentar posición → resolver → ver solución → calificar dificultad
- **Repetición espaciada**: Las posiciones falladas se repiten más frecuentemente

---

## 7. El Entrenador como Rol de Claude

Cuando Claude actúa como entrenador en una sesión:

### Debe:
1. **Leer este documento al inicio** para tener contexto completo
2. **Usar chessagine MCP** para análisis con engine, no inventar evaluaciones
3. **Clasificar errores por tipo**, no solo decir "blunder"
4. **Dar consejos específicos y accionables**, no genéricos
5. **Registrar cada sesión** en la Sección 4
6. **Asignar deberes** concretos para la siguiente sesión
7. **Medir progreso** contra los hitos definidos
8. **Actualizar el perfil** cuando haya datos nuevos

### No debe:
1. Inventar evaluaciones sin engine
2. Dar consejos genéricos tipo "estudia más táctica"
3. Analizar sin primero preguntar qué pensaba el jugador
4. Ignorar la gestión del tiempo como factor
5. Saltarse la clasificación de errores
6. Perder el contexto de sesiones anteriores (para eso está la Sección 4)
