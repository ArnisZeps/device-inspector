# Device Inspector

REST API for registering and monitoring IoT devices. A background worker probes each enabled device every minute via REST or gRPC, tracking connectivity status and probe history.

## Stack

- **Runtime**: Node.js + TypeScript + Express
- **Database**: PostgreSQL (migrations via `db-migrate`)
- **Protocols**: REST and gRPC device probing

## Getting started

```bash
cp .env.example .env   # fill in the variables
docker compose up
```

The API is available at `http://localhost:3000`. Migrations run automatically on startup.

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | API listen port |
| `POSTGRES_USER` | `postgres` | DB user |
| `POSTGRES_PASSWORD` | — | DB password (required) |
| `POSTGRES_DB` | `device_inspector` | DB name |
| `POSTGRES_PORT` | `5432` | DB port |
| `DB_HOST` | `postgres` | DB host |
| `CHECKSUM_BINARY_PATH` | — | Path to checksum validation binary |

## API

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/devices` | Create a device |
| `GET` | `/api/devices` | List devices (`?connectivity_status=`, `?enabled=`) |
| `GET` | `/api/devices/:id` | Get a device |
| `PATCH` | `/api/devices/:id` | Update a device (`name`, `base_url`, `enabled`) |
| `DELETE` | `/api/devices/:id` | Soft-delete a device |
| `GET` | `/api/devices/:id/history` | Probe history (`?limit=`, `?offset=`, `?from=`, `?to=`) |
| `GET` | `/health` | Health check |

## Development

```bash
npm run dev       # start with hot reload
npm test          # run tests
npm run migrate   # run pending migrations
```
