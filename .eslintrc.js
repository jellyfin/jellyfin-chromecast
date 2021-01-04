module.exports = {
    root: true,
    plugins: ['@typescript-eslint', 'prettier', 'promise', 'import', 'jsdoc'],
    env: {
        node: true,
        es6: true
    },
    extends: [
        'eslint:recommended',
        'plugin:prettier/recommended',
        'plugin:promise/recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:jsdoc/recommended',
        'plugin:import/errors',
        'plugin:import/warnings',
        'plugin:import/typescript',
        'prettier'
    ],
    rules: {
        '@typescript-eslint/explicit-function-return-type': 'error',
        '@typescript-eslint/no-explicit-any': 'warn',
        'import/newline-after-import': 'error',
        'import/order': 'error'
    },
    overrides: [
        {
            files: ['.js', '.ts'],
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
        }
    ],
    settings: {
        'import/parsers': {
            '@typescript-eslint/parser': ['.ts', '.tsx']
        },
        'import/resolver': {
            typescript: {
                alwaysTryTypes: true
            }
        }
    }
};
