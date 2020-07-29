module.exports = {
    root: true,
    env: {
        node: true,
        es6: true
    },
    parser: '@typescript-eslint/parser',
    plugins: [
      '@typescript-eslint',
    ],
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
    ],
    parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module'
    },
    rules: {
        'block-spacing': ["error"],
        'brace-style': ["error"],
        'comma-dangle': ["error", "never"],
        'comma-spacing': ["error"],
        'eol-last': ["error"],
        'indent': ["error", 4, { "SwitchCase": 1 }],
        'keyword-spacing': ["error"],
        'max-statements-per-line': ["error"],
        'no-floating-decimal': ["error"],
        'no-multi-spaces': ["error"],
        'no-multiple-empty-lines': ["error", { "max": 1 }],
        'no-trailing-spaces': ["error"],
        'one-var': ["error", "never"],
        'semi': ["error"],
        'space-before-blocks': ["error"],
    },
    overrides: [{
        files: ['./src/**/*.ts', './src/*.ts'],
        env: {
            node: false,
            browser: true,
            es6: true
        },
        globals: {
            cast: 'readonly',
            PRODUCTION: 'readonly',
            $scope: 'writable'
        }
    }]
}
