#!/usr/bin/env bash
# One-time setup for a fresh Ubuntu 24.04 Droplet. Run as root: sudo bash bootstrap.sh
# Idempotent: safe to run again.
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "run as root (sudo bash bootstrap.sh)" >&2
  exit 1
fi

APP_DIR=/opt/chocotrack
DEPLOY_USER=deploy

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl ufw fail2ban unattended-upgrades sqlite3

# Docker Engine + Compose plugin from Docker's apt repository
if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
fi
systemctl enable --now docker

# A small VM needs swap to survive image pulls and restarts
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 1G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# Firewall: SSH, HTTP (certificate challenge), HTTPS
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443
ufw --force enable

systemctl enable --now fail2ban
dpkg-reconfigure -f noninteractive unattended-upgrades

# Unprivileged user that CI uses to deploy (key-only SSH)
if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "$DEPLOY_USER"
fi
usermod -aG docker "$DEPLOY_USER"
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
touch "/home/$DEPLOY_USER/.ssh/authorized_keys"
chmod 600 "/home/$DEPLOY_USER/.ssh/authorized_keys"
chown "$DEPLOY_USER:$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh/authorized_keys"

# App + data directories. The container runs as uid 1000 and must own the data directory.
install -d -m 755 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$APP_DIR"
install -d -m 750 -o 1000 -g 1000 "$APP_DIR/data"
install -d -m 750 -o "$DEPLOY_USER" -g "$DEPLOY_USER" /var/backups/chocotrack

cat <<MSG

Bootstrap complete. Next:
  1. Paste the CI deploy public key into /home/$DEPLOY_USER/.ssh/authorized_keys
  2. As $DEPLOY_USER, put docker-compose.yml, Caddyfile and a filled-in .env in $APP_DIR
  3. Disable SSH password logins if you have not: PasswordAuthentication no in /etc/ssh/sshd_config.d/
MSG
