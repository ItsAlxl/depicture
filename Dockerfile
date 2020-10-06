FROM node:lts-alpine

WORKDIR /home/node/app

# Get dependencies
COPY package.json ./
COPY package-lock.json ./
RUN npm install

# Bundle source
COPY Client ./Client
COPY Server ./Server

EXPOSE 6465
CMD ["npm",  "start"]