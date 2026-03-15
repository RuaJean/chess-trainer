# Prompt para construir el Sistema de Entrenador

> Copia y pega el contenido entre las líneas `---` en una nueva sesión de Claude Code.

---

## Prompt

```
Vamos a construir un sistema de entrenador de ajedrez personalizado en mi app Angular.

### Contexto obligatorio — lee estos archivos antes de hacer nada:
1. `CLAUDE.md` — Arquitectura de la app, comandos, decisiones de diseño
2. `COACH_SYSTEM.md` — El documento maestro del entrenador. Contiene: perfil del jugador con análisis de 63 partidas, debilidades detectadas, metodología de coaching (Dvoretsky/Dorfman/Studer), plan de entrenamiento semanal con ciclos de 3 semanas, y las 5 features a construir con especificaciones detalladas.

### MCP disponible:
Tengo configurado `chessagine-mcp` (37 herramientas de ajedrez: Stockfish 18, Leela, base de datos de aperturas, Lichess API, puzzles, análisis temático, detección de momentos críticos). Úsalo para cualquier análisis de posiciones o partidas.

### Lo que hay que construir (5 features nuevas):

**Fase 1 — Foundation (hacer primero):**
1. **Coach Dashboard** (`/coach`) — Pantalla principal: ejercicio del día, partida para analizar, puzzle, progreso semanal, próximo hito
2. **Player Profile** (`/coach/profile`) — Stats agregadas: rating timeline, win rate por apertura, gestión del tiempo (gráfico), distribución de errores, top 5 debilidades

**Fase 2 — Core training:**
3. **Training Plan** (`/coach/plan`) — Vista calendario con tema diario, ciclo actual (3 semanas), ejercicios completados, historial de sesiones
4. **Game Review mejorado** (`/coach/review/:gameId`) — Momentos críticos (auto-detectados), clasificación de errores por tipo (táctico/posicional/tiempo/etc.), gráfico de tiempo superpuesto a evaluación, panel "¿Qué pensabas?", lección accionable al final

**Fase 3 — Advanced:**
5. **Banco de Posiciones** (`/coach/positions`) — Posiciones extraídas de mis partidas donde fallé, posiciones teóricas de finales, modo drill con repetición espaciada

### Patrones a seguir:
- Standalone components (Angular 17), lazy-loaded
- Estilos inline en el componente (no archivos SCSS separados)
- Variables de tema en `src/styles/_variables.scss` (dark theme Lichess-style)
- Servicios singleton con `providedIn: 'root'`
- Reutilizar: BoardComponent, MoveListComponent, EvalChartComponent
- Los datos del perfil del jugador y plan de entrenamiento deben persistir en la base de datos (backend REST en puerto 8000, PostgreSQL)
- El estado del coaching (sesiones, progreso, deberes) debe ser legible por Claude en futuras sesiones

### Prioridad:
Empieza por la Fase 1 (Coach Dashboard + Player Profile). Antes de escribir código, lee los archivos de contexto y proponme el plan de implementación.
```

---

## Notas adicionales

### Antes de usar este prompt:
1. Asegúrate de que `chessagine-mcp` esté instalado y configurado:
   ```bash
   git clone https://github.com/jalpp/chessagine-mcp.git
   cd chessagine-mcp && npm install && npm run build
   claude mcp add chessagine-mcp -- node /ruta/absoluta/chessagine-mcp/build/runner/stdio.js
   ```
2. Configura las variables de entorno:
   - `LICHESS_API_TOKEN` — Obtener en https://lichess.org/account/oauth/token
   - `LICHESS_USERNAME=LaMuerteEnTangas`

### Para sesiones de coaching (no de desarrollo):
```
Eres mi entrenador de ajedrez. Lee COACH_SYSTEM.md para tener todo el contexto: mi perfil, debilidades, plan de entrenamiento, y el historial de sesiones anteriores.

Hoy es [DÍA DE LA SEMANA]. Según el plan, el foco de hoy es [TEMA].

Usa chessagine-mcp para análisis con engine. No inventes evaluaciones.

[Aquí describe lo que quieres hacer: analizar una partida, hacer ejercicios de táctica, estudiar un final, etc.]
```

### Para actualizar el perfil después de nuevas partidas:
```
Lee COACH_SYSTEM.md. Importa mis últimas partidas de Lichess (usuario: LaMuerteEnTangas, blitz 3+0) y actualiza la Sección 1 (Perfil del Jugador) con los nuevos datos. Compara con el análisis anterior para ver si las debilidades han mejorado.
```
