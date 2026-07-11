FROM node:20-slim AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-slim
WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY server.js ./
COPY settingsStore.js ./
COPY qz-tray.js ./
COPY qzNodeShim.js ./
COPY qzPrintNode.js ./
COPY --from=build /app/dist ./dist

ENV PORT=5175
ENV SETTINGS_DIR=/app/data
EXPOSE 5175

CMD ["node", "server.js"]
