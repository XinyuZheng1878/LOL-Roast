#!/usr/bin/env bash
# 在你的 Mac 上运行：把代码和 .env 传到服务器并完成部署。
# 用法：./deploy.sh 服务器公网IP
set -euo pipefail

HOST="${1:?用法：./deploy.sh 服务器公网IP}"
cd "$(dirname "$0")"

[[ -f .env ]] || { echo "缺少 .env 文件"; exit 1; }
grep -q '^DASHSCOPE_API_KEY=.\+' .env || { echo ".env 里还没填 DASHSCOPE_API_KEY"; exit 1; }

echo "上传代码到 $HOST ..."
ssh "root@$HOST" "mkdir -p /opt/lol-roast"
rsync -az --delete \
  --exclude node_modules --exclude .git --exclude .claude --exclude .DS_Store \
  ./ "root@$HOST:/opt/lol-roast/"

echo "在服务器上安装并启动 ..."
ssh "root@$HOST" "bash /opt/lol-roast/deploy/setup-server.sh"

echo
echo "完成！打开 http://$HOST 试试"
