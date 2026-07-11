FROM node:20-slim

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY . .

ENV PORT=5175
EXPOSE 5175

CMD ["node", "server.js"]
