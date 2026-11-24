FROM node:26-alpine
RUN apk add --no-cache openssl

EXPOSE 3000

WORKDIR /app

ENV NODE_ENV=production
ENV DATA_DIR=/data

COPY package.json package-lock.json* ./

RUN npm ci --omit=dev && npm cache clean --force

COPY . .

# /app stays root-owned (read-only for the runtime user); only /data is writable.
# prisma/schema.prisma points at file:dev.sqlite, so link it to the volume at build time.
RUN npm run build \
  && npx prisma generate \
  && mkdir -p /data \
  && ln -s /data/sessions.sqlite prisma/dev.sqlite \
  && chown node:node /data

USER node

VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/healthz || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
