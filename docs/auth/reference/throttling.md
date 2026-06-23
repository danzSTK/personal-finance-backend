---
area: auth
type: reference
status: current
---

# Throttling Auth

| Rota | Limit | TTL | Block duration |
|---|---:|---:|---:|
| `POST /auth/sign-up` | 10 | 10min | 30min |
| `POST /auth/sign-in` | 5 | 1min | 10min |
| `GET /auth/google` | 5 | 1min | 10min |
| `POST /auth/refresh` | 5 | 60s | - |
