FROM node:20-alpine

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY src ./src

ENV NODE_ENV=production
ENV CONFIG_PATH=/app/config.yml
ENV PORT=3001

EXPOSE 3001

CMD ["node", "src/index.js"]
