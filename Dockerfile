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
COPY Client ./Client
COPY Server ./Server

EXPOSE 6465
CMD ["npm",  "start"]