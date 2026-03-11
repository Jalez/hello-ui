# 📋 Production Maintenance & Logs Guide

This guide describes how to check logs and troubleshoot the production environment on `tie-lukioplus.rd.tuni.fi`.

## 🐳 Container Logs (Docker Compose)

The production server uses an older version of Docker. Use `docker-compose` with the production config file.

### Stream All Logs
To see real-time output from all services:
```bash
docker-compose -f production.docker-compose.yml logs -f
```

### Stream Specific Service Logs
- **Main App**: `docker-compose -f production.docker-compose.yml logs -f app`
- **WS Server**: `docker-compose -f production.docker-compose.yml logs -f ws-server`
- **Database**: `docker-compose -f production.docker-compose.yml logs -f db`

---

## 📂 Persisted Debug Logs

The main application writes detailed JSONL logs to a persistent volume.

- **Host Location**: `./logs/`
- **Format**: `debug-YYYY-MM-DDTHH-mm-ss.jsonl`

### Viewing Recent Debug Logs
To see the last 50 lines of the latest debug log:
```bash
ls -t ./logs/debug-*.jsonl | head -n 1 | xargs tail -n 50
```

---

## 🗄️ Database Troubleshooting

### Check Database Health
```bash
docker exec ui-designer.db pg_isready -U postgres -d ui_designer
```

### Access Postgres CLI
```bash
docker exec -it ui-designer.db psql -U postgres -d ui_designer
```

---

## 🚀 Deployment Scripts

- `docker-up.sh`: Builds images and brings the stack up.
- `docker-stop.sh`: Gracefully stops the containers.
