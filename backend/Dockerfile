FROM node:20-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends postgresql-client gzip && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci || npm install
COPY prisma ./prisma
RUN npx prisma generate
COPY src ./src
COPY tests ./tests
RUN mkdir -p /app/backups
EXPOSE 3001
CMD ["sh","-c","npx prisma migrate deploy && node prisma/seed.js && node src/server.js"]
