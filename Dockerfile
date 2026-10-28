# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  Dockerfile for LumaPost (v10.6.0)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  Web UI 已移除，本镜像只跑「常驻调度器」，无任何监听端口。
#
#  构建: docker build -t lumapost .
#  运行（常驻调度器）: docker run -d --name lumapost \
#                        -v $PWD/config:/app/config -v $PWD/data:/app/data lumapost
#  一次性发一份:       docker run --rm -v $PWD/config:/app/config \
#                        -v $PWD/data:/app/data lumapost run morning
#  查看状态:           docker exec lumapost node scripts/cli.js status
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FROM node:22-slim

ENV TZ=Asia/Shanghai \
    NODE_ENV=production \
    LANG=C.UTF-8

WORKDIR /app

# 依赖层
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev --no-audit --no-fund; \
    else npm install --omit=dev --no-audit --no-fund; fi \
    && npm cache clean --force

# 代码层
COPY scripts/ ./scripts/

# 运行期目录（config 含密钥，请用 volume 挂载，不入镜像）
RUN mkdir -p data config \
    && chown -R node:node /app/data /app/config

USER node

# 无 EXPOSE：本项目不再提供 HTTP 服务
# 健康检查改为「进程存活 + 配置可读」，不依赖网络端口
HEALTHCHECK --interval=120s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "const c=require('./scripts/config-store');const v=c.validate();process.exit(v.valid?0:1)"

ENTRYPOINT ["node", "scripts/cli.js"]
CMD ["serve"]