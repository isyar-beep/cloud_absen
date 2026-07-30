FROM node:20-alpine

ENV NODE_ENV=production

WORKDIR /app

# npm ci memakai package-lock.json supaya versi dependency persis sama
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 5000

CMD ["node", "src/server.js"]
