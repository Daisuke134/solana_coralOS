# Build from repo root:
#   docker build -f coral-agents/echo-agent/Dockerfile -t echo-agent:0.1.0 .

FROM node:20-alpine AS builder
WORKDIR /app

# Mirror repo layout so "file:../../sdk/agent-runtime" resolves correctly
COPY sdk/agent-runtime/package.json sdk/agent-runtime/package-lock.json* ./sdk/agent-runtime/
RUN cd sdk/agent-runtime && npm install --ignore-scripts
COPY sdk/agent-runtime/tsconfig.json ./sdk/agent-runtime/
COPY sdk/agent-runtime/src/ ./sdk/agent-runtime/src/
RUN cd sdk/agent-runtime && npx tsc

# --install-links copies the SDK into node_modules instead of symlinking
COPY coral-agents/echo-agent/package.json coral-agents/echo-agent/package-lock.json* ./coral-agents/echo-agent/
RUN cd coral-agents/echo-agent && npm install --ignore-scripts --install-links
COPY coral-agents/echo-agent/tsconfig.json ./coral-agents/echo-agent/
COPY coral-agents/echo-agent/src/ ./coral-agents/echo-agent/src/
RUN cd coral-agents/echo-agent && npx tsc

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/coral-agents/echo-agent/dist ./dist
COPY --from=builder /app/coral-agents/echo-agent/node_modules ./node_modules

CMD ["node", "dist/index.js"]
