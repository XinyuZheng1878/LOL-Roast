#!/usr/bin/env bash
# 在服务器上运行（Ubuntu 22.04 / 24.04）：安装 Node.js 和 nginx，把锐评服务注册成开机自启。
# 由 deploy.sh 自动调用，一般不用手动运行。
set -euo pipefail

APP_DIR=/opt/lol-roast

# Node.js 22
if ! command -v node >/dev/null || [[ "$(node -v)" != v22* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

# nginx：对外监听 80 端口，转发给 Node 服务
if ! command -v nginx >/dev/null; then
  apt-get update
  apt-get install -y nginx
fi

cd "$APP_DIR"
npm ci --omit=dev

# 用独立的低权限用户运行服务
id lolroast >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin lolroast
chown -R lolroast:lolroast "$APP_DIR"
chmod 600 "$APP_DIR/.env"

cp deploy/lol-roast.service /etc/systemd/system/lol-roast.service
systemctl daemon-reload
systemctl enable lol-roast
systemctl restart lol-roast

cp deploy/nginx.conf /etc/nginx/sites-available/lol-roast
ln -sf /etc/nginx/sites-available/lol-roast /etc/nginx/sites-enabled/lol-roast
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

sleep 2
systemctl --no-pager --lines=5 status lol-roast
echo "部署完成"
