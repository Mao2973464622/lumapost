# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  Dockerfile for LumaPost v3.0
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  构建: docker build -t lumapost .
#  运行: docker run --rm lumapost all:morning
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FROM node:20-slim

WORKDIR /app

# 安装依赖
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

# 复制代码
COPY scripts/ ./scripts/
RUN mkdir -p data

# 环境变量（通过 docker run -e 或 .env 传入）
ENV AI_PROVIDER=deepseek
ENV MAIL_PROVIDER=qq

# 入口
ENTRYPOINT ["node"]
CMD ["--help"]
