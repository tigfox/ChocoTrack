# Deploying ChocoTrack to a DigitalOcean Droplet

One small VM runs everything with Docker Compose:

```
Internet -> Caddy (80/443, automatic HTTPS) -> ChocoTrack app (port 3000, internal) -> /opt/chocotrack/data/sessions.sqlite
```

- The app image is built by GitHub Actions and pushed to `ghcr.io/tigfox/chocotrack`; the Droplet only pulls and runs it (no compiling on a tiny VM).
- The only data the app stores is Shopify OAuth sessions, in SQLite on the Droplet's disk. Business records live in Shopify. Losing the file just means signing in again.
- When the store team outgrows this (more apps, more load, high availability), move the same container to App Platform, Cloud Run, ECS and so on, and switch the Prisma datasource to PostgreSQL (see "Moving on" below).

## Sizing

A Basic Droplet with 1 vCPU and 1-2 GB RAM, running Ubuntu 24.04 or 26.04 LTS, is enough for a handful of staff. 2 GB gives comfortable headroom; 1 GB works because `bootstrap.sh` adds swap. The stack was smoke-tested on a **512 MB** Ubuntu 26.04.1 Droplet (2026-11-17): it runs, but with the app idle about 190 MB of the 1 GB swap was already in use, so pick 1 GB or more for real use. Check current prices on DigitalOcean's pricing page (roughly $6-12/month at the time of writing, from memory). Add DigitalOcean backups (about 20% extra) if you want whole-VM snapshots on top of the database backup below.

## One-time setup

### 1. Create the Droplet and a hostname

1. Create an Ubuntu 24.04 (or newer LTS) Droplet. A root password or key is only needed for the first step below; `bootstrap.sh` replaces it with a named admin account and turns root and password logins off.
2. Point a hostname at its IP: an `A` record such as `chocotrack.<your-domain>`. If the DNS provider can proxy traffic (Cloudflare), set the record to DNS-only so Caddy can get its certificate. For a throwaway test without a domain, `<ip-with-dashes>.sslip.io` works, but never use it with the production Shopify app: sslip.io is a third party's DNS and the IP can be reassigned.
3. Shopify requires HTTPS on a stable URL; Caddy gets and renews the certificate automatically once the hostname resolves and ports 80/443 are open.

### 2. Bootstrap the VM

```bash
scp deploy/droplet/bootstrap.sh root@<droplet-ip>:
ssh root@<droplet-ip> 'ADMIN_USER=<you> ADMIN_PUBKEY="$(cat ~/.ssh/id_ed25519.pub)" bash bootstrap.sh'
```

This installs Docker, a firewall (SSH, 80, 443 only), fail2ban, automatic security updates (including Docker's packages, with a 04:00 reboot when needed), 1 GB swap, an admin user with your key and passwordless sudo, a `deploy` user for CI, `/opt/chocotrack` and a backup folder. It also **turns off root and password SSH logins** (`/etc/ssh/sshd_config.d/00-hardening.conf`, `AllowUsers <you> deploy`) and blocks containers from the cloud metadata address. Keep the root session open and, from a second terminal, check `ssh <you>@<droplet-ip> sudo -n true` before closing it. From here on, work as the admin user, never as root. It is safe to run again.

If the key has a passphrase, load it first (`ssh-add --apple-use-keychain ~/.ssh/id_ed25519`).

### 3. Create a CI deploy key

On your laptop:

```bash
ssh-keygen -t ed25519 -f chocotrack-deploy -N "" -C "github-actions-chocotrack"
# install the public key WITH its restriction (one line; root login is off, so use the admin account)
ssh <you>@<droplet-ip> "echo 'restrict,command=\"/usr/local/lib/chocotrack/ci-entry.sh\" $(cat chocotrack-deploy.pub)' | sudo tee -a /home/deploy/.ssh/authorized_keys >/dev/null"
ssh-keyscan -t ed25519 <droplet-ip-or-hostname>   # copy this output for DROPLET_KNOWN_HOSTS
```

Run `push-stack.sh` (step 4) before the first CI deploy: the restricted key can only run the root-owned `ci-entry.sh`, which `push-stack.sh` installs. Test a restriction change with a throwaway key, and pass its `-i` file as a bash array: too many failed logins get your own IP banned by fail2ban for about ten minutes (`sudo fail2ban-client unban --all` from the DigitalOcean console clears it).

Generate the key pair in a folder outside the repo (for example `~/chocotrack-key`). The private key goes into a GitHub secret and nowhere else: paste it, then delete the local file (`rm -P chocotrack-deploy`). Never leave it, or a stray `.pub`, inside the project folder where `git add -A` could pick it up.

### 4. Put the configuration on the Droplet

Keep `/opt/chocotrack/data` owned by uid 1000 (the app's user) with mode 700, and `sessions.sqlite` at 600: it holds live Shopify access tokens. Do not run a recursive `chown deploy:deploy` over `/opt/chocotrack`: the app then exits with "/data is not writable by uid 1000". Fix with `chown 1000:1000 /opt/chocotrack/data`.

```bash
deploy/droplet/push-stack.sh <you>@<droplet>   # installs compose, Caddyfile, .env.example and the root-owned scripts
ssh <you>@<droplet>
sudo -iu deploy
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

The deploy job runs in a GitHub Environment named `production`, so add the four secrets **to that environment** (Settings, Environments, production, Environment secrets), or with `gh secret set <NAME> --env production`. Repository-level secrets are not needed. **Add a required reviewer** and restrict deployment branches to `main` (Settings, Environments, production). The deploy key can start containers, which is root-equivalent on the Droplet, so this gate and the branch ruleset on `main` are what stand between a stolen or merged change and the host. Add a `CODEOWNERS` file (done: `.github/CODEOWNERS`) and keep secrets at the environment level only.

### 6. First deploy

Push to `main`. CI runs the tests, builds and pushes the image, then SSHes in with the restricted deploy key and asks for `deploy <sha> <image digest>`. `deploy.sh` pulls that exact digest, waits for the app's health check, records it in `releases.log`, and rolls back to the previous image if the new one is not healthy. CI never copies files to the host: to change the compose file, Caddyfile or scripts, merge the change and run `deploy/droplet/push-stack.sh` yourself. The first image push creates a package under your GitHub profile: open its settings and set visibility to **Public** so the Droplet can pull it without credentials (the image contains no secrets; configuration comes from `.env`). Re-run the failed deploy afterwards if the first pull was denied.

Check it: `curl https://<APP_DOMAIN>/healthz` should print `ok`.

### 7. Point Shopify at the app

The dev app (`shopify.app.toml`) rewrites its URLs every time someone runs `shopify app dev`, so production uses its own Shopify app. The finished production config is committed as `choco-track/shopify.app.chocotrack-production.toml` (it holds only the public client ID, never the secret); `shopify.app.production.toml.example` is the template for a new store or hostname.

1. In the Dev Dashboard, open Apps, click **Create app** and choose **Create app manually** (not the `npm init @shopify/app` option, which scaffolds a whole new project). Name it, for example, "ChocoTrack Production".
2. `cd choco-track && shopify app config link`, choose that app. The CLI names the file after the app, here `shopify.app.chocotrack-production.toml`, and that name is what `--config` takes below. It writes only the client ID and some defaults, with **empty scopes and no webhooks**, so go on to step 3.
3. Make it match the template: `application_url` is `https://<APP_DOMAIN>`, the redirect URL is `https://<APP_DOMAIN>/auth/callback` (the app signs in under `/auth`, not `/api/auth`), the scopes and webhooks are identical to `shopify.app.toml`, `api_version` is the one the app code uses (`2026-07`), and `automatically_update_urls_on_dev = false`.
4. `shopify app deploy --config chocotrack-production` releases the URLs, scopes and webhook subscriptions (including the mandatory privacy webhooks).
5. On the Droplet, edit `/opt/chocotrack/.env` (as `deploy`; mode 600): set `SHOPIFY_API_KEY` to the production app's client ID and `SHOPIFY_API_SECRET` to its secret (Dev Dashboard, the app's Settings page). One `NAME=value` per line, no spaces or quotes. Never paste the secret into chat or the repo. Then restart with `docker compose up -d` (or let the next deploy do it).
6. Install the app on the store from the Dev Dashboard and approve the permissions (including the two inventory-transfer scopes). Open it from the store admin to check.

If you change the hostname later: update `APP_DOMAIN` and `SHOPIFY_APP_URL` in `.env`, the two URLs in the production config, run `shopify app deploy --config chocotrack-production` again, then `docker compose up -d` in `/opt/chocotrack`.

## Day to day

| Task | Command (on the Droplet, in `/opt/chocotrack`) |
|---|---|
| Deploy | automatic on every push to `main` |
| Roll back | `sudo -u deploy /usr/local/lib/chocotrack/deploy.sh <older-commit-sha>` (looks the digest up in `releases.log`) |
| Logs | `sudo docker compose logs -f app` (or `caddy`) |
| Status | `sudo docker compose ps`; the running image is `IMAGE_REF` in `.env`, its git sha `DEPLOYED_SHA` |
| Restart | `sudo docker compose restart app` |
| Change compose, Caddyfile or scripts | merge to `main`, then `deploy/droplet/push-stack.sh <you>@<droplet>` from your laptop |
| Audit the host | `ssh <you>@<droplet> 'bash -s' < dropaudit.sh` (read-only; repo root) |

The admin account is not in the `docker` group, so it uses `sudo docker`.

### Backups

```bash
sudo crontab -e   # root's crontab: the data directory is private to the container user
# daily at 03:15
15 3 * * * /usr/local/lib/chocotrack/backup.sh
```

Backups go to `/var/backups/chocotrack` (mode 700, root only; 14 days kept). **Each backup contains live Shopify access tokens**: treat it as a credential, and encrypt it (for example with `age`) before copying it off the Droplet. To restore: stop the app, copy a backup over `/opt/chocotrack/data/sessions.sqlite`, make it owned by uid 1000, start the app. For off-box copies, sync that folder to a DigitalOcean Space or similar.

### Updating the server

Security updates install automatically. For kernel updates, reboot occasionally (`sudo reboot`); the containers restart themselves.

## Security notes

- Only ports 22, 80 and 443 are open. SSH is key-only and root login is off. The CI user (`deploy`) is in the `docker` group, which is **root-equivalent**: protect `DROPLET_SSH_KEY` accordingly (environment-scoped secret, required reviewer, protected `main`).
- **The CI key is restricted.** In `authorized_keys` it carries `restrict,command="/usr/local/lib/chocotrack/ci-entry.sh"`, so it cannot open a shell, copy files or forward ports; it can only run `deploy <40-hex sha> <sha256 digest>` of this repo's image. The scripts it can reach are root-owned in `/usr/local/lib/chocotrack`, and the compose file and Caddyfile are root-owned too, so a leaked key or a hostile workflow cannot reach the host itself, only deploy an image to the hardened container. A merged change to `main` can still ship hostile *application* code, so keep the branch ruleset, CODEOWNERS and the required reviewer on `production`.
- Images are pulled by digest (`IMAGE_REF` in `.env`, Caddy and the Node base image pinned in the compose file and Dockerfile; Dependabot bumps them), so a re-pushed registry tag cannot change what runs.
- Never add a `ports:` entry for the app: Docker publishes ports through iptables and bypasses the ufw rules. A systemd unit (`block-metadata.service`) stops containers reaching the cloud metadata service.
- Both containers run with a read-only filesystem, no capabilities (Caddy keeps only `NET_BIND_SERVICE`) and `no-new-privileges`. `/app` in the image is root-owned.
- `sudo bash dropaudit.sh` (repo root) is a read-only audit of the host; run it after any change here.
- `.env` holds the Shopify secret: mode 600, never in git. Keep local credential files such as `.local` out of git too. Rotate the secret in the Dev Dashboard if it is ever exposed.
- The container runs as an unprivileged user with a memory limit; Caddy sets HSTS and other basic headers. The app sets its own frame policy so Shopify can embed it.

## Moving on

To leave the Droplet: build the same image (it is configured only through environment variables), switch `provider = "postgresql"` and `url = env("DATABASE_URL")` in `choco-track/prisma/schema.prisma` with a fresh migration (sessions are disposable, so no data migration is needed), and run it on the new platform. The plan in `sampler_builder.md` lists the AWS, GCP and App Platform equivalents.
