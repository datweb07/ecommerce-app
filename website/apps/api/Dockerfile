# syntax=docker/dockerfile:1
FROM node:26-bookworm-slim AS build
ENV PNPM_HOME=/opt/pnpm
ENV PATH=$PNPM_HOME:$PATH
WORKDIR /workspace
RUN npm install --global pnpm@10.17.1
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN --mount=type=cache,id=storefront-pnpm,target=/opt/pnpm/store \
    pnpm install --filter @storefront/api... --frozen-lockfile --store-dir=/opt/pnpm/store
COPY apps/api/src apps/api/src
COPY apps/api/tsconfig.json apps/api/tsconfig.json
COPY packages/shared/src packages/shared/src
COPY packages/shared/tsconfig.json packages/shared/tsconfig.json
RUN pnpm --filter @storefront/shared build && pnpm --filter @storefront/api build
RUN --mount=type=cache,id=storefront-pnpm,target=/opt/pnpm/store \
    pnpm --filter @storefront/api --prod deploy --legacy --store-dir=/opt/pnpm/store /runtime

FROM node:26-bookworm-slim AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4000
WORKDIR /app
# The runtime only executes Node directly; remove the unused bundled package managers.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
COPY --from=build --chown=node:node /runtime/ ./
USER node
EXPOSE 4000
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+process.env.PORT+'/health/live',{signal:AbortSignal.timeout(2000)}).then(r=>{if(!r.ok)process.exitCode=1}).catch(()=>{process.exitCode=1})"]
CMD ["node", "dist/server.js"]
