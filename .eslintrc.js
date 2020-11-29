module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint'],
    env: {
        node: true,
        es6: true
    },
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'prettier'
    ],
    parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module'
    },
    rules: {
        'block-spacing': ['error'],
        'brace-style': ['error'],
        'comma-dangle': ['error', 'never'],
        'comma-spacing': ['error'],
        'eol-last': ['error'],
        indent: ['error', 4, { SwitchCase: 1 }],
        'keyword-spacing': ['error'],
        'max-statements-per-line': ['error'],
        'no-floating-decimal': ['error'],
        'no-multi-spaces': ['error'],
        'no-multiple-empty-lines': ['error', { max: 1 }],
        'no-trailing-spaces': ['error'],
        'one-var': ['error', 'never'],
        semi: ['error'],
        'space-before-blocks': ['error']
    },
    overrides: [
        {
            files: ['./src/**/*.js', './src/**/*.ts'],
            env: {
                node: false,
                browser: true,
                es6: true
            },
            globals: {
                cast: 'readonly',
                PRODUCTION: 'readonly',
                $scope: 'writable'
            },
            rules: {
                // Disable these until we have converted the project to TS
                '@typescript-eslint/explicit-module-boundary-types': 'off',
                '@typescript-eslint/no-explicit-any': 'off'
            }
        }
    ]
};
