FROM node:22.17.1

WORKDIR /autonx-webserver
COPY package.json .
RUN npm install
COPY . .
RUN npm run build
CMD npm start
