# Build from repo root:
#   docker build -f coral-agents/buyer-agent/Dockerfile -t buyer-agent:0.1.0 .

FROM node:20-alpine AS builder
WORKDIR /app

COPY sdk/agent-runtime/package.json sdk/agent-runtime/package-lock.json* ./sdk/agent-runtime/
RUN cd sdk/agent-runtime && npm install --ignore-scripts
COPY sdk/agent-runtime/tsconfig.json ./sdk/agent-runtime/
COPY sdk/agent-runtime/src/ ./sdk/agent-runtime/src/
RUN cd sdk/agent-runtime && npx tsc

COPY coral-agents/buyer-agent/package.json coral-agents/buyer-agent/package-lock.json* ./coral-agents/buyer-agent/
RUN cd coral-agents/buyer-agent && npm install --ignore-scripts --install-links
COPY coral-agents/buyer-agent/tsconfig.json ./coral-agents/buyer-agent/
COPY coral-agents/buyer-agent/src/ ./coral-agents/buyer-agent/src/
RUN cd coral-agents/buyer-agent && npx tsc

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/coral-agents/buyer-agent/dist ./dist
COPY --from=builder /app/coral-agents/buyer-agent/node_modules ./node_modules

CMD ["node", "dist/index.js"]
