# Contributing

## Development

### Development Environment

The development environment is setup with editorconfig. Code style is enforced by prettier and eslint for Javascript/Typescript linting

-   [editorconfig](https://editorconfig.org/)
-   [prettier](https://prettier.io/)
-   [eslint](https://eslint.org/)

### Environment variables

| name          | required | description                                               | default if not set |
| ------------- | -------- | --------------------------------------------------------- | ------------------ |
| RECEIVER_PORT | No       | The port used for the dev server when `npm start` is used | 9000               |

### Building/Using

`npm start` - Build a development version and start a dev server

`npm run build` - Build a production version

`npm run test` - Run tests

`npm run lint` - Run linting and prettier

1. Register a new [application](https://developers.google.com/cast/docs/registration). It is important that you choose a "Custom application", the rest of the details are up to you (name, description, etc). You will need a web server to host the files on.
2. Set up a local copy of [jellyfin-web](https://github.com/jellyfin/jellyfin-web).
3. Change `applicationStable` and `applicationUnstable` in `jellyfin-web/src/plugins/chromecastPlayer/plugin.js` to your own application ID.
4. Run the local copy of jellyfin-web using the provided instructions in the repo.
5. Clone this repo and run `npm install`. This will install all dependencies, run tests and build a production build by default.
6. Make changes and build with `npm run build`.
7. Before pushing your changes, make sure to run `npm run test` and `npm run lint`.

> NOTE: It is recommended to symlink the `dist` folder pointing to a location on your web server hosting the files. That way you can refresh the cast receiver via the Chrome Remote Debugger and see your changes without having to manually copy after each build.

## Pull Requests

This project uses the standard Github Fork and PR flow
