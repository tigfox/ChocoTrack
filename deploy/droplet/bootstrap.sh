#!/usr/bin/env bash
# One-time setup for a fresh Ubuntu 24.04+ Droplet. Run as root:
#   ADMIN_USER=<name> ADMIN_PUBKEY="ssh-ed25519 AAAA... you@host" bash bootstrap.sh
# It creates the admin account, installs its key, then turns off root and password SSH logins,
# so the admin key must be right: keep your root session open and test a second login before closing it.
# Idempotent: safe to run again.
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "run as root (ADMIN_USER=... ADMIN_PUBKEY=... bash bootstrap.sh)" >&2
  exit 1
fi
: "${ADMIN_USER:?set ADMIN_USER to the admin account name (not root)}"
: "${ADMIN_PUBKEY:?set ADMIN_PUBKEY to the admin SSH public key (one line)}"
case "$ADMIN_PUBKEY" in ssh-ed25519\ *|ssh-rsa\ *|ecdsa-sha2-*) ;; *) echo "ADMIN_PUBKEY is not a public key line" >&2; exit 1 ;; esac
[ "$ADMIN_USER" != root ] || { echo "ADMIN_USER must not be root" >&2; exit 1; }

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
# Also patch Docker's packages, and reboot at 04:00 when a kernel update needs it.
cat >/etc/apt/apt.conf.d/52local <<'APT'
Unattended-Upgrade::Origins-Pattern:: "origin=Docker";
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "04:00";
APT

# Admin account (key-only sudo). Replaces root for all manual work.
if ! id "$ADMIN_USER" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "$ADMIN_USER"
fi
usermod -aG sudo "$ADMIN_USER"
install -d -m 700 -o "$ADMIN_USER" -g "$ADMIN_USER" "/home/$ADMIN_USER/.ssh"
touch "/home/$ADMIN_USER/.ssh/authorized_keys"
grep -qxF "$ADMIN_PUBKEY" "/home/$ADMIN_USER/.ssh/authorized_keys" || echo "$ADMIN_PUBKEY" >> "/home/$ADMIN_USER/.ssh/authorized_keys"
chmod 600 "/home/$ADMIN_USER/.ssh/authorized_keys"
chown "$ADMIN_USER:$ADMIN_USER" "/home/$ADMIN_USER/.ssh/authorized_keys"
echo "$ADMIN_USER ALL=(ALL) NOPASSWD:ALL" > "/etc/sudoers.d/90-$ADMIN_USER"
chmod 440 "/etc/sudoers.d/90-$ADMIN_USER"
visudo -cf "/etc/sudoers.d/90-$ADMIN_USER"

# SSH: keys only, no root. The 00- prefix matters: sshd uses the first value it sees, and
# cloud-init's 50-cloud-init.conf may set PasswordAuthentication yes.
cat >/etc/ssh/sshd_config.d/00-hardening.conf <<CONF
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
X11Forwarding no
MaxAuthTries 3
AllowUsers $ADMIN_USER deploy
CONF
sshd -t
systemctl reload ssh

# Containers must not reach the cloud metadata service (it can hold user-data and tokens).
cat >/etc/systemd/system/block-metadata.service <<'UNIT'
[Unit]
Description=Block containers from the cloud metadata endpoint
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/bin/sh -c 'iptables -C DOCKER-USER -d 169.254.169.254 -j DROP 2>/dev/null || iptables -I DOCKER-USER -d 169.254.169.254 -j DROP'
ExecStop=/bin/sh -c 'iptables -D DOCKER-USER -d 169.254.169.254 -j DROP 2>/dev/null || true'

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now block-metadata.service

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
# data holds Shopify access tokens: private to uid 1000. Backups hold the same tokens: root only.
install -d -m 700 -o 1000 -g 1000 "$APP_DIR/data"
install -d -m 700 -o root -g root /var/backups/chocotrack

cat <<MSG

Bootstrap complete. Next:
  1. In a SECOND terminal confirm: ssh $ADMIN_USER@<host> sudo -n true   (root and password logins are now refused)
  2. Paste the CI deploy public key into /home/$DEPLOY_USER/.ssh/authorized_keys
  3. As $DEPLOY_USER, put docker-compose.yml, Caddyfile and a filled-in .env in $APP_DIR
  4. As $ADMIN_USER, add the backup cron: sudo crontab -e   ->   15 3 * * * /opt/chocotrack/backup.sh
MSG
