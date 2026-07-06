FROM node:20-alpine AS builder

RUN corepack enable && pnpm --version

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY prisma ./prisma
RUN npx prisma generate

COPY . .

FROM node:20-alpine AS runner
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json .
COPY --from=builder /app/tsconfig.json .
COPY --from=builder /app/src ./src

EXPOSE 10000
CMD ["pnpm", "start"]
