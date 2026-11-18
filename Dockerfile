# Imagem base com Node.js 22 LTS
FROM node:22-slim AS builder

WORKDIR /app

# Copia dependências e instala
COPY package*.json ./
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund

# Copia código-fonte e compila front-end (Vite) e back-end (esbuild)
COPY . .
RUN mkdir -p /app/uploads/images /app/uploads/videos && npm run build

# Estágio de execução (produção leve e seguro)
FROM node:22-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund || npm install --omit=dev --no-audit --no-fund

# Copia arquivos compilados e dados necessários
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/firebase-applet-config.json* ./
COPY --from=builder /app/uploads ./uploads

# Cloud Run mapeia automaticamente a porta na variável PORT (padrão 8080)
EXPOSE 8080

CMD ["node", "dist/server.cjs"]
