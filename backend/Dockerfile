FROM node:20-alpine

ENV NODE_ENV=production

WORKDIR /app

# Font untuk cap koordinat & jam di foto absensi.
# Alpine tidak membawa font sama sekali. Tanpa ini sharp tetap berhasil
# menggambar, tapi teksnya tidak muncul -- foto keluar dengan gradasi
# gelap kosong di bagian bawah, dan kegagalannya tidak melempar error.
RUN apk add --no-cache fontconfig ttf-dejavu

# npm ci memakai package-lock.json supaya versi dependency persis sama
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Folder foto absensi (di-mount sebagai volume di docker-compose untuk persistensi)
RUN mkdir -p uploads

EXPOSE 5000

CMD ["node", "src/server.js"]
