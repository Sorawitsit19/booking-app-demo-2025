# Stage: Production Environment
FROM node:20-alpine

# Build Tools สำหรับ better-sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# สร้างโฟลเดอร์สำหรับเก็บ SQLite database file
RUN mkdir -p /app/data

# Configuration
ENV NODE_ENV=production PORT=5000 DB_PATH=/app/data/booking.db

EXPOSE 5000

CMD ["node", "server.js"]
