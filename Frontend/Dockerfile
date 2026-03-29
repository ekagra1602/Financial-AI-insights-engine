FROM node:18-alpine

WORKDIR /app

# Install deps (layer cache — only re-runs when package files change)
COPY package.json package-lock.json ./
RUN npm ci

# Source code is bind-mounted via docker-compose for HMR
EXPOSE 3000

CMD ["npm", "run", "dev"]
