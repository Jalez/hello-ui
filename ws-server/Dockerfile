FROM node:20-bullseye
WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY server.mjs ./

EXPOSE 3100

CMD ["node", "server.mjs"]
