# AutonX Webserver

## Run

The server depends on other microservices to be available. It is recommended to spin up everything at once via the docker compose configuration in the [backend project](https://github.com/autonx-systems/autonx-backend).

In order to use the types during development, it is recommended to install the npm dependencies locally.

```bash
npm install
```

## Project setup

The webserver is the backbone for the [web app](https://github.com/autonx-systems/autonx-app). It uses a MySQL database to store views for the widget-based dashboard and runs a Socket.IO server to forward messages coming from the Kafka service.

The CRUD endpoints for view entities are exposed on the endpoint `/api/views`.

## Troubleshooting

If you're having issues installing node-gyp on MacOS (Sequoia).

1. Reinstall xcode

2. Use python v3.10

```bash
brew install python@3.10
export NODE_GYP_FORCE_PYTHON=/opt/homebrew/bin/python3.10
```