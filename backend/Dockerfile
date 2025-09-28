FROM node:20-alpine

WORKDIR /app
COPY package.json tsconfig.json ./
RUN npm install

COPY src ./src
COPY sql ./sql

RUN npm run build

ENV NODE_ENV=production
CMD ["node", "dist/main.js"]
