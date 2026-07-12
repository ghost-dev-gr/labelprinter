commitFROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

ENV PORT=5175
EXPOSE 5175

CMD ["node", "server.js"]
