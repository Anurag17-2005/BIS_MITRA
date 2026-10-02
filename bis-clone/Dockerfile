# Optional: Render → Web Service → Environment Docker (instead of Node native)
FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y python3 build-essential \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
COPY api/package.json ./api/
RUN npm ci && npm rebuild better-sqlite3 -w api

COPY . .
RUN cp -f data/bis-clone.seed.db data/bis-clone.db

ENV PORT=4000
EXPOSE 4000
CMD ["npm", "run", "start", "-w", "api"]
