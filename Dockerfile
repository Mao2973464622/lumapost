# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  Dockerfile for LumaPost v2.1
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  构建: docker build -t lumapost .
#  运行: docker run --rm lumapost all:morning
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FROM node:20-slim

WORKDIR /app

# 安装依赖
COPY lumapost/package.json lumapost/package-lock.json ./
RUN npm install --no-audit --no-fund

# 复制代码
COPY lumapost/scripts/ ./scripts/
COPY lumapost/data/.gitkeep ./data/

# 环境变量（通过 docker run -e 或 .env 传入）
ENV AI_PROVIDER=deepseek
ENV MAIL_PROVIDER=qq

# 入口
ENTRYPOINT ["node"]
CMD ["--help"]
