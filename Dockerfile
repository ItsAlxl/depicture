FROM node:lts-alpine

WORKDIR /home/node/app

# Get git (used to grab some dependencies)
RUN apk add git

# Get dependencies
COPY package.json ./
COPY package-lock.json ./
RUN npm install

# Uninstall git now that we have our dependencies
RUN apk del git

# Bundle source
COPY Server ./Server
COPY Client ./Client

EXPOSE 6465
CMD ["npm",  "start"]