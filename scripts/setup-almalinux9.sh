#!/usr/bin/env bash
set -euo pipefail

# Pro Club Order Portal — AlmaLinux 9 VPS setup
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/DanoIrishMan/OrderPortal/main/scripts/setup-almalinux9.sh | sudo bash -s -- --user YOUR_USER
#   curl -fsSL ... | sudo bash -s -- --user YOUR_USER --domain orders.example.com
#
# Options:
#   --user USER          Linux user that owns the app (required)
#   --domain DOMAIN      Domain for Nginx + Let's Encrypt SSL (optional)
#   --dir PATH           Install directory (default: /var/www/OrderPortal)
#   --repo URL           Git repo URL (default: GitHub OrderPortal)
#   --skip-ssl           Skip certbot even if --domain is set
#   --skip-firewall      Skip firewall-cmd changes

APP_DIR="/var/www/OrderPortal"
REPO_URL="https://github.com/DanoIrishMan/OrderPortal.git"
APP_USER=""
DOMAIN=""
SKIP_SSL=false
SKIP_FIREWALL=false

usage() {
  sed -n '2,12p' "$0"
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --user) APP_USER="$2"; shift 2 ;;
    --domain) DOMAIN="$2"; shift 2 ;;
    --dir) APP_DIR="$2"; shift 2 ;;
    --repo) REPO_URL="$2"; shift 2 ;;
    --skip-ssl) SKIP_SSL=true; shift ;;
    --skip-firewall) SKIP_FIREWALL=true; shift ;;
    -h|--help) usage ;;
    *) echo "Unknown option: $1"; usage ;;
  esac
done

if [[ -z "$APP_USER" ]]; then
  echo "Error: --user is required (e.g. --user $(whoami))"
  exit 1
fi

if [[ $EUID -ne 0 ]]; then
  echo "Error: run as root: sudo bash setup-almalinux9.sh --user YOUR_USER"
  exit 1
fi

if ! id "$APP_USER" &>/dev/null; then
  echo "Error: user '$APP_USER' does not exist"
  exit 1
fi

log() { echo "==> $*"; }

log "Installing system packages..."
dnf update -y
dnf install -y git curl nginx firewalld openssl

if ! command -v node &>/dev/null || [[ "$(node -p "process.versions.node.split('.')[0]")" -lt 20 ]]; then
  log "Installing Node.js 20..."
  curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
  dnf install -y nodejs
fi

log "Node $(node -v), npm $(npm -v)"

if [[ ! -d "$APP_DIR/.git" ]]; then
  log "Cloning repository to $APP_DIR..."
  mkdir -p "$(dirname "$APP_DIR")"
  if [[ -d "$APP_DIR" ]]; then
    rm -rf "$APP_DIR"
  fi
  git clone "$REPO_URL" "$APP_DIR"
else
  log "Updating existing install at $APP_DIR..."
  sudo -u "$APP_USER" git -C "$APP_DIR" pull
fi

chown -R "$APP_USER:$APP_USER" "$APP_DIR"

log "Creating .env..."
AUTH_SECRET=$(openssl rand -base64 32)
UPLOAD_DIR="$APP_DIR/uploads"
DB_PATH="$APP_DIR/prisma/prod.db"

if [[ -n "$DOMAIN" ]]; then
  NEXTAUTH_URL="https://${DOMAIN}"
else
  NEXTAUTH_URL="http://localhost:3000"
fi

if [[ ! -f "$APP_DIR/.env" ]]; then
  cat > "$APP_DIR/.env" <<EOF
DATABASE_URL="file:${DB_PATH}"
NEXTAUTH_URL="${NEXTAUTH_URL}"
NEXTAUTH_SECRET="${AUTH_SECRET}"
UPLOAD_DIR="${UPLOAD_DIR}"
NODE_ENV=production
EOF
  chown "$APP_USER:$APP_USER" "$APP_DIR/.env"
  chmod 600 "$APP_DIR/.env"
else
  log ".env already exists — leaving unchanged"
fi

log "Installing npm dependencies..."
sudo -u "$APP_USER" bash -lc "cd '$APP_DIR' && npm ci"

log "Preparing database and uploads..."
sudo -u "$APP_USER" bash -lc "cd '$APP_DIR' && mkdir -p uploads prisma && npm run db:setup"

log "Building application..."
sudo -u "$APP_USER" bash -lc "cd '$APP_DIR' && npm run build"

log "Creating systemd service..."
cat > /etc/systemd/system/order-portal.service <<EOF
[Unit]
Description=Pro Club Order Portal
After=network.target

[Service]
Type=simple
User=${APP_USER}
WorkingDirectory=${APP_DIR}
Environment=NODE_ENV=production
EnvironmentFile=${APP_DIR}/.env
ExecStart=$(command -v npm) start
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable order-portal
systemctl restart order-portal

log "Configuring Nginx..."
NGINX_CONF="/etc/nginx/conf.d/order-portal.conf"
SERVER_NAME="${DOMAIN:-_}"

cat > "$NGINX_CONF" <<EOF
server {
    listen 80;
    server_name ${SERVER_NAME};

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

nginx -t
systemctl enable nginx
systemctl restart nginx

if [[ "$SKIP_FIREWALL" == false ]]; then
  log "Opening firewall ports 80 and 443..."
  systemctl enable firewalld
  systemctl start firewalld
  firewall-cmd --permanent --add-service=http
  firewall-cmd --permanent --add-service=https
  firewall-cmd --reload
fi

if [[ -n "$DOMAIN" && "$SKIP_SSL" == false ]]; then
  log "Installing Certbot for SSL..."
  dnf install -y certbot python3-certbot-nginx
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email || {
    echo "Warning: certbot failed. Check DNS points to this server, then run:"
    echo "  sudo certbot --nginx -d $DOMAIN"
  }
  # Update NEXTAUTH_URL after SSL
  if grep -q '^NEXTAUTH_URL=' "$APP_DIR/.env"; then
    sed -i "s|^NEXTAUTH_URL=.*|NEXTAUTH_URL=\"https://${DOMAIN}\"|" "$APP_DIR/.env"
  fi
  systemctl restart order-portal
fi

log "Setup complete!"
echo ""
echo "  App service:  sudo systemctl status order-portal"
echo "  App logs:     sudo journalctl -u order-portal -f"
echo "  Install dir:  $APP_DIR"
echo ""
if [[ -n "$DOMAIN" ]]; then
  echo "  URL:          https://${DOMAIN}"
else
  echo "  URL:          http://$(curl -s ifconfig.me 2>/dev/null || echo YOUR_VPS_IP)"
fi
echo ""
echo "  Admin login:  admin@portal.local / admin123"
echo "  Change the admin password after first login!"
