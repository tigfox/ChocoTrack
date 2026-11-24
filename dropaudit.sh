#!/usr/bin/env bash
# Read-only security audit of the ChocoTrack Droplet. Run on the Droplet as a sudo-capable user:
#   bash dropaudit.sh 2>&1 | tee audit-$(date +%F).txt
# It changes nothing. Review the output before pasting it anywhere: it lists file modes,
# usernames and key fingerprints, but never prints .env contents, tokens or private keys.
set -uo pipefail

APP=/opt/chocotrack
DOMAIN="${1:-chocotrack.franson.nyc}"
COMPOSE="$APP/docker-compose.yml"

# The admin account is deliberately not in the docker group; use sudo for docker when needed.
if ! docker info >/dev/null 2>&1; then docker() { sudo docker "$@"; }; export -f docker; fi

section() { printf '\n===== %s =====\n' "$1"; }
run() { printf '$ %s\n' "$*"; "$@" 2>&1 </dev/null || printf '(exit %s)\n' "$?"; }
sh_() { printf '$ %s\n' "$1"; bash -c "$1" 2>&1 </dev/null || printf '(exit %s)\n' "$?"; }

section "Host"
sh_ 'hostnamectl | grep -E "Operating|Kernel"'
sh_ 'uptime; free -m | head -2'
sh_ 'test -f /var/run/reboot-required && echo "REBOOT REQUIRED" || echo "no reboot pending"'
sh_ 'apt list --upgradable 2>/dev/null | tail -n +2 | wc -l | xargs echo "upgradable packages:"'

section "SSH daemon (effective config)"
sh_ 'sudo sshd -T | grep -Ei "^(passwordauthentication|permitrootlogin|kbdinteractiveauthentication|pubkeyauthentication|allowusers|allowgroups|x11forwarding|permitemptypasswords|maxauthtries|port) "'
sh_ 'ls -l /etc/ssh/sshd_config.d/'
sh_ 'sudo grep -HEv "^\s*(#|$)" /etc/ssh/sshd_config.d/*.conf'

section "Users, sudo, docker group"
sh_ 'id deploy'
sh_ 'getent group docker sudo'
sh_ 'awk -F: "\$3>=1000 && \$3<65534 {print \$1\":\"\$3\":\"\$7}" /etc/passwd'
sh_ 'sudo awk -F: "(\$2==\"\" ) {print \$1\" HAS EMPTY PASSWORD\"}" /etc/shadow; echo "(empty-password check done)"'
sh_ 'sudo ls -l /etc/sudoers.d/'

section "authorized_keys (type, options, comment only; key material trimmed)"
for f in $(sudo sh -c "ls /home/*/.ssh/authorized_keys /root/.ssh/authorized_keys 2>/dev/null"); do
  sudo test -e "$f" || continue
  echo "--- $f"
  sudo awk '{ if ($1 ~ /^(ssh-|ecdsa-|sk-)/) print "no-options", $1, "...", $NF; else print "OPTIONS:", substr($0,1,80), "..." }' "$f"
  sudo stat -c '%a %U:%G' "$f"
done

section "Firewall and exposed ports"
sh_ 'sudo ufw status verbose'
sh_ 'ss -tlnup'
sh_ 'sudo iptables -S DOCKER-USER'
sh_ 'sudo iptables -t nat -S DOCKER | grep -E "dpt:" '
sh_ 'sudo fail2ban-client status sshd'

section "Automatic updates"
sh_ 'systemctl is-enabled unattended-upgrades; systemctl is-active unattended-upgrades'
sh_ 'cat /etc/apt/apt.conf.d/20auto-upgrades'
sh_ 'apt-config dump | grep -Ei "Unattended-Upgrade::(Origins-Pattern|Automatic-Reboot)"'
sh_ 'ls /etc/apt/apt.conf.d/ | grep -i unattended'

section "File permissions"
sh_ "stat -c '%a %U:%G %n' $APP $APP/* $APP/.env $APP/data/* /var/backups/chocotrack /var/backups/chocotrack/* 2>&1"
sh_ 'find /opt/chocotrack /var/backups/chocotrack -perm -o+r -type f 2>/dev/null'
echo "(files above are world-readable; .env, sessions.sqlite and backups should NOT appear)"
sh_ "grep -c . $APP/.env | xargs echo '.env line count:'"
sh_ "grep -E '^[A-Z_]+=' $APP/.env | cut -d= -f1 | sort | tr '\n' ' '; echo"
sh_ "grep -E '^(APP_DOMAIN|SHOPIFY_APP_URL|IMAGE_REF|DEPLOYED_SHA|SCOPES)=' $APP/.env"
sh_ 'sudo crontab -l'
sh_ 'ls -l /usr/local/lib/chocotrack/; tail -3 /opt/chocotrack/releases.log'
sh_ 'ls -la /etc/cron.d /etc/cron.daily 2>/dev/null | head -30'
sh_ 'sudo find / -xdev -perm -4000 -type f 2>/dev/null | head -40'

section "Docker engine and stack"
sh_ 'docker version --format "client {{.Client.Version}} server {{.Server.Version}}"'
sh_ "cd $APP && docker compose ps"
sh_ "docker compose -f $COMPOSE config | grep -E 'image:|read_only|cap_(add|drop)|privileged|security_opt|pids_limit|user:|published|network_mode|/var/run/docker.sock'"
sh_ "docker inspect \$(docker compose -f $COMPOSE ps -q) --format '{{.Name}} user={{.Config.User}} capdrop={{.HostConfig.CapDrop}} capadd={{.HostConfig.CapAdd}} ro={{.HostConfig.ReadonlyRootfs}} priv={{.HostConfig.Privileged}} secopt={{.HostConfig.SecurityOpt}} pids={{.HostConfig.PidsLimit}}'"
sh_ "docker inspect \$(docker compose -f $COMPOSE ps -q) --format '{{.Name}} mounts: {{range .Mounts}}{{.Source}}->{{.Destination}}({{.Mode}}) {{end}}'"
sh_ "docker images --digests --format '{{.Repository}}:{{.Tag}} {{.Digest}} {{.CreatedSince}}'"
sh_ "docker inspect \$(docker compose -f $COMPOSE ps -q app) --format '{{range .Config.Env}}{{println .}}{{end}}' | cut -d= -f1 | sort | tr '\n' ' '; echo"
sh_ "docker compose -f $COMPOSE exec -T app id"
sh_ "docker compose -f $COMPOSE exec -T app sh -c 'touch /app/.writetest && echo \"/app IS WRITABLE\" && rm /app/.writetest || echo \"/app read-only (good)\"'"
sh_ "docker compose -f $COMPOSE exec -T app wget -q -T 3 -O- http://169.254.169.254/metadata/v1/id; echo \"(metadata reachable from app container if an id printed above)\""
sh_ 'docker network ls'

section "Public endpoint (from the Droplet itself)"
sh_ "getent hosts $DOMAIN"
sh_ "curl -sS -o /dev/null -w 'healthz: %{http_code} tls=%{ssl_verify_result}\n' https://$DOMAIN/healthz"
sh_ "curl -sSI https://$DOMAIN/ | grep -Ei '^(HTTP|strict-transport|content-security|x-frame|server|referrer|x-content|location|permissions|cross-origin)'"
sh_ "curl -sSI 'https://$DOMAIN/app?shop=evil.example.com' | grep -Ei '^(HTTP|content-security|location|x-frame)'"
sh_ "curl -sS -o /dev/null -w 'bare IP https: %{http_code}\n' -k https://\$(curl -s ifconfig.me)/ "
sh_ "curl -sS -o /dev/null -w 'http->https redirect: %{http_code} -> %{redirect_url}\n' http://$DOMAIN/"
sh_ "echo | openssl s_client -connect $DOMAIN:443 -servername $DOMAIN 2>/dev/null | openssl x509 -noout -issuer -subject -dates"

section "Logins and recent activity"
sh_ 'last -n 15'
sh_ "sudo journalctl -u ssh --since '7 days ago' --no-pager | grep -Ei 'accepted' | awk '{print \$1,\$2,\$3,\$6,\$7,\$9,\$11}' | tail -15"
sh_ "sudo journalctl -u ssh --since '7 days ago' --no-pager | grep -Eic 'invalid user|failed password' | xargs echo 'failed or invalid SSH attempts (7d):'"

section "Lynis (optional, installs nothing)"
if command -v lynis >/dev/null 2>&1; then
  sh_ 'sudo lynis audit system --quick --no-colors 2>&1 | grep -E "Hardening index|Warning|Suggestion" | head -40'
else
  echo "lynis not installed; skipped. To use: sudo apt install lynis, then rerun."
fi

printf '\n===== Done. Review before sharing: output contains usernames, IPs and file layout. =====\n'
