# Contributing

## Development

### Development Environment

The development environment is setup with editorconfig, Code style is enforced by prettier and eslint for Javascipt/Typescript linting

-   [editorconfig](https://editorconfig.org/)
-   [prettier](https://prettier.io/)
-   [eslint](https://eslint.org/)

### Environment variables

| name          | required | description                                                | default if not set |
| ------------- | -------- | ---------------------------------------------------------- | ------------------ |
| RECEIVER_PORT | No       | The port used for the dev server when `yarn serve` is used | 9000               |

### Building/Using

`yarn build:development` - Build a development version
`yarn serve` / `yarn start` - Build a development version and start a dev server
`yarn build:production` - Build a production version

## Pull Requests

This project uses the standard Github Fork and PR flow
