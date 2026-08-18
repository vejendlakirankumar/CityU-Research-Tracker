# CityU Research Review Portal — Deployment Guides

Deployment documentation is split by target platform. Pick the guide that matches how you run the portal:

| Guide | Use when… |
|---|---|
| **[DEPLOYMENT-DOCKER.md](DEPLOYMENT-DOCKER.md)** | You deploy with **Docker Compose** (containers for app, worker, PostgreSQL, Redis). Uses `deploy/quick-start-docker.sh` / `deploy/install-remote.sh` / `deploy/update.sh`. |
| **[DEPLOYMENT-VM.md](DEPLOYMENT-VM.md)** | You deploy **natively on an Ubuntu VM** (no Docker) — PHP-FPM, PostgreSQL, Redis, Nginx, Supervisor as system services. Uses `deploy/install.sh` and the `/opt/rrp/source` → `/var/www/rrp` two-tree flow. |

Both guides assume a **production** deployment and each contains:

- Architecture overview and prerequisites
- Step-by-step production deployment
- Environment variables
- SSL / HTTPS (Let's Encrypt) and **Azure Application Gateway** (external TLS termination)
- First-time configuration (create the first admin, emergency break-glass)
- Updating, rollback, and backups
- A dedicated **Test / UAT deployment** section that seeds all users and programs
- Post-deployment validation and troubleshooting

> **Production rule:** never seed demo data into a production database. Seeding (all users + programs) is documented in the *Test / UAT Deployment* section of each guide and is intended for throwaway UAT environments only.
