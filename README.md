# Chess Trainer

Herramienta de entrenamiento de ajedrez con tema oscuro construida con Angular 17. Incluye juego contra Stockfish, análisis de partidas, biblioteca de juegos, y modo a ciegas con reconocimiento de voz en español.

## Características

- **Jugar vs IA** — Partidas contra Stockfish con ELO y reloj configurables
- **Análisis** — Análisis de posiciones y partidas completas con gráfico de evaluación y flechas de movimiento
- **Biblioteca de partidas** — Base de datos local con importación (PGN / Lichess) y exportación
- **Modo a ciegas** — Entrenamiento sin tablero visible con entrada/salida de voz en español
- **Diseño offline-first** — Toda la persistencia es local vía IndexedDB (Dexie), sin servidor backend obligatorio

## Tech Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | Angular 17.3 (standalone components, lazy-loaded routes) |
| Tablero | Chessground (librería de tablero de Lichess) |
| Motor | Stockfish WASM (single-threaded) |
| Validación | chess.js |
| Base de datos | IndexedDB vía Dexie |
| Backend (opcional) | FastAPI + PostgreSQL + faster-whisper |
| Servidor web | Nginx (en Docker) |

## Requisitos previos

- **Node.js** 20+
- **npm** 10+
- **Docker** y **Docker Compose** (para despliegue con contenedores)

## Instalación local (desarrollo)

```bash
# Clonar el repositorio
git clone https://github.com/RuaJean/chess-trainer.git
cd chess-trainer

# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
ng serve
```

La app estará disponible en `http://localhost:4200`.

El servidor de desarrollo usa un proxy (`proxy.conf.json`) para redirigir `/lichess-api/*` a `https://lichess.org/api/*` y evitar problemas de CORS.

## Despliegue con Docker

### Solo frontend

```bash
# Construir la imagen
docker build -t chess-trainer .

# Ejecutar el contenedor
docker run -d -p 8888:80 chess-trainer
```

La app estará disponible en `http://localhost:8888`.

### Stack completo (frontend + backend + base de datos)

El stack completo incluye:
- **Frontend** — Angular app servida con Nginx (puerto 8888)
- **Backend** — API FastAPI con autenticación y transcripción de voz vía faster-whisper (puerto 8000)
- **Base de datos** — PostgreSQL 16 (puerto 5433)

```bash
# Copiar variables de entorno
cp .env.example .env

# Editar .env con tus valores (especialmente en producción)
# DB_PASSWORD=tu-password-seguro
# JWT_SECRET=tu-secreto-jwt
# WHISPER_MODEL=large-v3-turbo

# Levantar todos los servicios
docker compose up -d

# Ver logs
docker compose logs -f

# Detener servicios
docker compose down
```

La app estará disponible en `http://localhost:8888` y el backend en `http://localhost:8000`.

### Variables de entorno

| Variable | Default | Descripción |
|----------|---------|-------------|
| `DB_PASSWORD` | `chess` | Contraseña de PostgreSQL |
| `JWT_SECRET` | `change-me-in-production` | Secreto para tokens JWT |
| `WHISPER_MODEL` | `large-v3-turbo` | Modelo de Whisper para transcripción de voz |

## Comandos útiles

```bash
ng serve        # Servidor de desarrollo (localhost:4200)
ng build        # Build de producción → dist/
ng test         # Tests unitarios (Karma/Jasmine)
```

## Estructura del proyecto

```
chess-trainer/
├── src/app/
│   ├── core/services/     # Servicios singleton (Stockfish, chess.js, DB, etc.)
│   ├── shared/components/ # Componentes reutilizables (tablero, reloj, lista de movimientos)
│   ├── features/          # Rutas lazy-loaded
│   │   ├── play-ai/       # Jugar vs Stockfish
│   │   ├── analysis/      # Análisis de posiciones y partidas
│   │   ├── games-library/ # Biblioteca de partidas
│   │   ├── blindfold/     # Modo a ciegas
│   │   └── settings/      # Configuración
│   └── models/            # Interfaces TypeScript
├── backend/               # API FastAPI (Python)
├── Dockerfile             # Build multi-stage (Angular + Nginx)
├── docker-compose.yml     # Stack completo
└── nginx.conf             # Configuración de Nginx
```

## Licencia

Uso privado.
