# Deploying ChocoTrack to a DigitalOcean Droplet

One small VM runs everything with Docker Compose:

```
Internet -> Caddy (80/443, automatic HTTPS) -> ChocoTrack app (port 3000, internal) -> /opt/chocotrack/data/sessions.sqlite
```

- The app image is built by GitHub Actions and pushed to `ghcr.io/tigfox/chocotrack`; the Droplet only pulls and runs it (no compiling on a tiny VM).
- The only data the app stores is Shopify OAuth sessions, in SQLite on the Droplet's disk. Business records live in Shopify. Losing the file just means signing in again.
- When the store team outgrows this (more apps, more load, high availability), move the same container to App Platform, Cloud Run, ECS and so on, and switch the Prisma datasource to PostgreSQL (see "Moving on" below).

## Sizing

A Basic Droplet with 1 vCPU and 1-2 GB RAM, running Ubuntu 24.04 LTS, is enough for a handful of staff. 2 GB gives comfortable headroom; 1 GB works because `bootstrap.sh` adds swap. Check current prices on DigitalOcean's pricing page (roughly $6-12/month at the time of writing, from memory). Add DigitalOcean backups (about 20% extra) if you want whole-VM snapshots on top of the database backup below.

## One-time setup

### 1. Create the Droplet and a hostname

1. Create an Ubuntu 24.04 Droplet and add your SSH key (no password login).
2. Point a hostname at its IP: an `A` record such as `chocotrack.<your-domain>`. For a first test without a domain, `<ip-with-dashes>.sslip.io` (for example `203-0-113-10.sslip.io`) resolves to the IP and gets a real certificate.
3. Shopify requires HTTPS on a stable URL; Caddy gets and renews the certificate automatically once the hostname resolves and ports 80/443 are open.

### 2. Bootstrap the VM

```bash
scp deploy/droplet/bootstrap.sh root@<droplet-ip>:
ssh root@<droplet-ip> 'bash bootstrap.sh'
```

This installs Docker, a firewall (SSH, 80, 443 only), fail2ban, automatic security updates, 1 GB swap, a `deploy` user, `/opt/chocotrack` and a backup folder. It is safe to run again.

### 3. Create a CI deploy key

On your laptop:

```bash
ssh-keygen -t ed25519 -f chocotrack-deploy -N "" -C "github-actions-chocotrack"
ssh root@<droplet-ip> "cat >> /home/deploy/.ssh/authorized_keys" < chocotrack-deploy.pub
ssh-keyscan -t ed25519 <droplet-ip-or-hostname>   # copy this output for DROPLET_KNOWN_HOSTS
```

Keep `chocotrack-deploy` (private key) out of the repo; it goes into a GitHub secret and nowhere else.

### 4. Put the configuration on the Droplet

```bash
scp deploy/droplet/{docker-compose.yml,Caddyfile,deploy.sh,backup.sh,.env.example} deploy@<droplet>:/opt/chocotrack/
ssh deploy@<droplet>
cd /opt/chocotrack && cp .env.example .env && chmod 600 .env && nano .env
```

Fill in `APP_DOMAIN`, `SHOPIFY_APP_URL` (`https://<APP_DOMAIN>`), and `SHOPIFY_API_KEY` / `SHOPIFY_API_SECRET` from the Dev Dashboard (the ChocoTrack app's Settings). `SCOPES` must match `shopify.app.toml`.

### 5. GitHub secrets and environment

In the repo settings, under Secrets and variables, Actions, add:

| Secret | Value |
|---|---|
| `DROPLET_HOST` | the Droplet's IP or hostname |
| `DROPLET_USER` | `deploy` |
| `DROPLET_SSH_KEY` | contents of `chocotrack-deploy` (private key) |
| `DROPLET_KNOWN_HOSTS` | the `ssh-keyscan` output from step 3 |

Optionally create an Environment named `production` (Settings, Environments) and add a required reviewer, so deploys wait for a click.

### 6. First deploy

Push to `main`. CI runs the tests, builds and pushes the image, copies the stack files and runs `deploy.sh`, which waits for the app's health check. The first image push creates a package under your GitHub profile: open its settings and set visibility to **Public** so the Droplet can pull it without credentials (the image contains no secrets; configuration comes from `.env`). Re-run the failed deploy afterwards if the first pull was denied.

Check it: `curl https://<APP_DOMAIN>/healthz` should print `ok`.

### 7. Point Shopify at the app

The dev app (`shopify.app.toml`) rewrites its URLs every time someone runs `shopify app dev`, so production uses its own Shopify app. A template with everything pre-filled is in `choco-track/shopify.app.production.toml.example`:

1. In the Dev Dashboard, create a second app (for example "ChocoTrack Production").
2. `cd choco-track && shopify app config link`, choose that app and name the config `production`. This writes `shopify.app.production.toml` with the real `client_id`.
3. Make it match the template: set `application_url` and the redirect URL to `https://<APP_DOMAIN>`, keep the scopes and webhooks identical to `shopify.app.toml`, and set `automatically_update_urls_on_dev = false`.
4. `shopify app deploy --config production` releases the URLs, scopes and webhook subscriptions (including the mandatory privacy webhooks).
5. Copy the production app's API key and secret into the Droplet's `.env`, run `./deploy.sh`, then install the app on the store from the Dev Dashboard.

## Day to day

| Task | Command (on the Droplet, in `/opt/chocotrack`) |
|---|---|
| Deploy | automatic on every push to `main` |
| Roll back | `./deploy.sh <older-commit-sha>` (tags are commit SHAs) |
| Logs | `docker compose logs -f app` (or `caddy`) |
| Status | `docker compose ps` |
| Restart | `docker compose restart app` |

### Backups

```bash
sudo -u deploy crontab -e
# daily at 03:15
15 3 * * * /opt/chocotrack/backup.sh
```

Backups go to `/var/backups/chocotrack` (14 days kept). To restore: stop the app, copy a backup over `/opt/chocotrack/data/sessions.sqlite`, make it owned by uid 1000, start the app. For off-box copies, sync that folder to a DigitalOcean Space or similar.

### Updating the server

Security updates install automatically. For kernel updates, reboot occasionally (`sudo reboot`); the containers restart themselves.

## Security notes

- Only ports 22, 80 and 443 are open. SSH is key-only; the CI user can run Docker but has no root.
- `.env` holds the Shopify secret: mode 600, never in git. Rotate the secret in the Dev Dashboard if it is ever exposed.
- The container runs as an unprivileged user with a memory limit; Caddy sets HSTS and other basic headers. The app sets its own frame policy so Shopify can embed it.

## Moving on

To leave the Droplet: build the same image (it is configured only through environment variables), switch `provider = "postgresql"` and `url = env("DATABASE_URL")` in `choco-track/prisma/schema.prisma` with a fresh migration (sessions are disposable, so no data migration is needed), and run it on the new platform. The plan in `sampler_builder.md` lists the AWS, GCP and App Platform equivalents.
