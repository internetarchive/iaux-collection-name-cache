![Build Status](https://github.com/internetarchive/iaux-typescript-wc-template/actions/workflows/ci.yml/badge.svg)

# This package is deprecated.
### It is no longer recommended to fetch collection titles via sidecar requests or cache them locally in this way. Other iaux components now simply rely on collection titles being provided alongside the other content that requires them (e.g., search results).
<hr>

# Internet Archive Typescript WebComponent Template

This is a base template for creating Typescript WebComponents. It is based off of the [Open WebComponents generator](https://open-wc.org/docs/development/generator/) with some IA-specific customizations and some development niceities.

## Usage

1. Click the "Use this Template" button in GitHub to create a new repository based on this one.
2. Clone your new repo and update the things below:

### Things to update in your copy
1. Remove this section
2. Search for the strings `your-webcomponent` and `YourWebComponent` and those are most of the spots that need to be updated.
3. `README.md` (this file). Update the readme in general, but also the badge URLs
4. `package.json` Update the name and description
5. Rename the `your-webcomponent.ts` and its associated `.test` file

## Local Demo with `web-dev-server`
```bash
yarn start
```
To run a local development server that serves the basic demo located in `demo/index.html`

## Testing with Web Test Runner
To run the suite of Web Test Runner tests, run
```bash
yarn run test
```

To run the tests in watch mode (for &lt;abbr title=&#34;test driven development&#34;&gt;TDD&lt;/abbr&gt;, for example), run

```bash
yarn run test:watch
```

## Linting with ESLint, Prettier, and Types
To scan the project for linting errors, run
```bash
yarn run lint
```

You can lint with ESLint and Prettier individually as well
```bash
yarn run lint:eslint
```
```bash
yarn run lint:prettier
```

To automatically fix many linting errors, run
```bash
yarn run format
```

You can format using ESLint and Prettier individually as well
```bash
yarn run format:eslint
```
```bash
yarn run format:prettier
```

## Tooling configs

For most of the tools, the configuration is in the `package.json` to reduce the amount of files in your project.

If you customize the configuration a lot, you can consider moving them to individual files.
