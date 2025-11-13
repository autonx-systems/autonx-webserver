FROM node:24.11.1

WORKDIR /autonx-webserver
COPY package.json .

RUN apt-get update && apt-get install -y g++ python3 make

COPY . . 
RUN rm -rf node_modules build dist

RUN npm install
RUN npm uninstall node-rdkafka
RUN npm install node-rdkafka --no-package-lock

RUN npm run build
CMD npm start
