FROM node:18

ARG HOST_UID=1000
ARG HOST_GID=1000

# Change the "node" user's UID & GID to match the host user
# Makes sure any mounted files will not become owned by the root
RUN groupmod -g ${HOST_GID} node && usermod -u ${HOST_UID} -g ${HOST_GID} node

# Run as regular user
USER node:node

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package.json .

# RUN npm install -g npm@latest \
#   && npm install

RUN npm install

# Get vulnerability reports
# RUN npm audit

# Bundle app source
COPY . .

ARG DRABOARD_URL="https://tie-lukioplus.rd.tuni.fi/drawboard"
ARG LOCAL_TESTING_URL="https://tie-lukioplus.rd.tuni.fi"

# For some reason sed fails when run as a regular user
USER root

RUN sed -i "s#http://localhost:3500#${DRABOARD_URL}#" src/components/ArtBoards/Frame.tsx \
  && sed -i "s#http://localhost:3500#${DRABOARD_URL}#" src/components/ArtBoards/Drawboard/ScenarioDrawing.tsx \
  && echo LOCAL_TESTING_URL="${LOCAL_TESTING_URL}" >./.env \
  && echo LOCAL_TESTING_URL="${LOCAL_TESTING_URL}" >./.env.example \
  && npm run build \
  && npx import-meta-env -x .env.example -p dist/index.html

# change the ownersip of created and modified files back to user "node"
RUN chown node:node src/components/ArtBoards/Frame.tsx src/components/ArtBoards/Drawboard/ScenarioDrawing.tsx ./.env ./.env.example dist/index.html

# Run as regular user
USER node:node

EXPOSE 3000
ENTRYPOINT [ "npm", "start" ]
