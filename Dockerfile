# syntax=docker/dockerfile:1

FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache openssl
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/
COPY apps/server/prisma apps/server/prisma
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/
COPY apps/server/prisma apps/server/prisma
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
# prisma jest w dependencies serwera: postinstall generuje klienta, CLI robi `migrate deploy` przy starcie
RUN npm ci --omit=dev --workspace @wedding/server --include-workspace-root && npm cache clean --force
COPY --from=build /app/apps/server/dist apps/server/dist
COPY --from=build /app/apps/web/dist apps/web/dist
USER node
EXPOSE 3000
WORKDIR /app/apps/server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
