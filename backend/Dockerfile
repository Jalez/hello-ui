FROM node:20-bullseye

ARG HOST_UID=1000
ARG HOST_GID=1000

# Change the "node" user's UID & GID to match the host user
# Makes sure any mounted files will not become owned by the root
RUN groupmod -g ${HOST_GID} node && usermod -u ${HOST_UID} -g ${HOST_GID} node

# Create app directory
WORKDIR /usr/src/app

# Change ownership of the app directory
RUN chown node:node /usr/src/app

# Run as regular user
USER node:node

# Install dependencies
COPY package.json ./

RUN npm install

# COPY app source
COPY . .

EXPOSE 3200
ENTRYPOINT ["./docker-entrypoint.sh"]
