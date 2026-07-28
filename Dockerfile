# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS dependencies

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci


FROM dependencies AS build

WORKDIR /app

COPY . .

RUN npm run lint
RUN npm run build


FROM node:20-bookworm-slim AS production-dependencies

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --omit=dev \
    && npm cache clean --force


FROM node:20-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app

RUN groupadd --system --gid 10001 storetrack \
    && useradd \
       --system \
       --uid 10001 \
       --gid storetrack \
       --home-dir /app \
       --shell /usr/sbin/nologin \
       storetrack

COPY --from=production-dependencies \
     --chown=storetrack:storetrack \
     /app/node_modules \
     ./node_modules

COPY --from=build \
     --chown=storetrack:storetrack \
     /app/dist \
     ./dist

COPY --from=build \
     --chown=storetrack:storetrack \
     /app/package.json \
     ./package.json

USER storetrack

EXPOSE 3000

HEALTHCHECK \
  --interval=30s \
  --timeout=5s \
  --start-period=20s \
  --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "dist/server.cjs"]
