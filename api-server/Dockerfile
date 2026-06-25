# Build from repo root:
#   docker build -f api-server/Dockerfile -t api-server:latest .

FROM node:20-slim
WORKDIR /build

# SDK
COPY sdk/agent-runtime/package*.json ./sdk/agent-runtime/
RUN cd sdk/agent-runtime && npm install
COPY sdk/agent-runtime/src ./sdk/agent-runtime/src

# api-server — runs with tsx so TypeScript imports from SDK src work at runtime
COPY api-server/package*.json ./api-server/
RUN cd api-server && npm install
COPY api-server/src ./api-server/src
COPY api-server/tsconfig.json ./api-server/

EXPOSE 8081
WORKDIR /build/api-server
CMD ["node", "node_modules/tsx/dist/cli.mjs", "src/index.ts"]
