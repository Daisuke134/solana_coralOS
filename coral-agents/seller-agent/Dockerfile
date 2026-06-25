# Build from repo root:
#   docker build -f coral-agents/seller-agent/Dockerfile -t seller-agent:0.1.0 .

FROM node:20-alpine AS builder
WORKDIR /app

# Mirror repo layout so "file:../../sdk/agent-runtime" resolves correctly
COPY sdk/agent-runtime/package.json sdk/agent-runtime/package-lock.json* ./sdk/agent-runtime/
RUN cd sdk/agent-runtime && npm install --ignore-scripts
COPY sdk/agent-runtime/tsconfig.json ./sdk/agent-runtime/
COPY sdk/agent-runtime/src/ ./sdk/agent-runtime/src/
RUN cd sdk/agent-runtime && npx tsc

# --install-links copies the SDK into node_modules instead of symlinking
COPY coral-agents/seller-agent/package.json coral-agents/seller-agent/package-lock.json* ./coral-agents/seller-agent/
RUN cd coral-agents/seller-agent && npm install --ignore-scripts --install-links
COPY coral-agents/seller-agent/tsconfig.json ./coral-agents/seller-agent/
COPY coral-agents/seller-agent/src/ ./coral-agents/seller-agent/src/
RUN cd coral-agents/seller-agent && npx tsc

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/coral-agents/seller-agent/dist ./dist
COPY --from=builder /app/coral-agents/seller-agent/node_modules ./node_modules

CMD ["node", "dist/index.js"]
