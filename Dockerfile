FROM node:24.11.1

WORKDIR /webserver
COPY . .
RUN rm -rf node_modules build dist

RUN apt-get update && apt-get install -y g++ python3 make

RUN npm install
RUN npm run build
CMD npm start
