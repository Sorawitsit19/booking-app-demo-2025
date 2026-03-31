# Stage 1: Build (ขั้นตอนปรุงอาหาร)
FROM node:20-alpine AS build-stage
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Production (ขั้นตอนเสิร์ฟ)
FROM nginx:stable-alpine
# ก๊อปปี้เฉพาะไฟล์ที่ Build เสร็จแล้ว (อยู่ในโฟลเดอร์ dist หรือ build) ไปที่ Nginx
COPY --from=build-stage /app/dist /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
