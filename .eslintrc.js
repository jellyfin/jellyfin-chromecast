module.exports = {
    env: {
        browser: true,
        es6: true,
        node: true
    },
    extends: [
        'eslint:recommended',
        'plugin:jsdoc/recommended',
        'plugin:json/recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:prettier/recommended',
        'plugin:promise/recommended',
        'plugin:import/errors',
        'plugin:import/warnings',
        'plugin:import/typescript'
    ],
    overrides: [
        {
            env: {
                browser: true,
                es6: true,
                node: false
            },
            files: ['.js', '.ts'],
            globals: {
                $scope: 'writable',
                cast: 'readonly'
            }
        }
    ],
    plugins: ['promise', 'import', 'jsdoc'],
    root: true,
    rules: {
        '@typescript-eslint/explicit-function-return-type': 'error',
        '@typescript-eslint/no-explicit-any': 'warn',
        '@typescript-eslint/no-unused-vars': 'error',
        '@typescript-eslint/prefer-ts-expect-error': 'error',
        curly: 'error',
        'import/newline-after-import': 'error',
        'import/order': 'error',
        'jsdoc/check-indentation': 'error',
        'jsdoc/check-param-names': 'error',
        'jsdoc/check-property-names': 'error',
        'jsdoc/check-syntax': 'error',
        'jsdoc/check-tag-names': 'error',
        'jsdoc/no-types': 'error',
        'jsdoc/require-description': 'warn',
        'jsdoc/require-hyphen-before-param-description': 'error',
        'jsdoc/require-jsdoc': 'error',
        'jsdoc/require-param-description': 'warn',
        //TypeScript and IntelliSense already provides us information about the function typings while hovering and
        // eslint-jsdoc doesn't detect a mismatch between what's declared in the function and what's declared in
        // JSDOC.
        'jsdoc/require-param-type': 'off',
        'jsdoc/require-returns-type': 'off',
        'jsdoc/valid-types': 'off',
        'padding-line-between-statements': [
            'error',
            // Always require blank lines after directives (like 'use-strict'), except between directives
            { blankLine: 'always', next: '*', prev: 'directive' },
            { blankLine: 'any', next: 'directive', prev: 'directive' },
            // Always require blank lines after import, except between imports
            { blankLine: 'always', next: '*', prev: 'import' },
            { blankLine: 'any', next: 'import', prev: 'import' },
            // Always require blank lines before and after every sequence of variable declarations and export
            {
                blankLine: 'always',
                next: ['const', 'let', 'var', 'export'],
                prev: '*'
            },
            {
                blankLine: 'always',
                next: '*',
                prev: ['const', 'let', 'var', 'export']
            },
            {
                blankLine: 'any',
                next: ['const', 'let', 'var', 'export'],
                prev: ['const', 'let', 'var', 'export']
            },
            // Always require blank lines before and after class declaration, if, do/while, switch, try
            {
                blankLine: 'always',
                next: ['if', 'class', 'for', 'do', 'while', 'switch', 'try'],
                prev: '*'
            },
            {
                blankLine: 'always',
                next: '*',
                prev: ['if', 'class', 'for', 'do', 'while', 'switch', 'try']
            },
            // Always require blank lines before return statements
            { blankLine: 'always', next: 'return', prev: '*' }
        ],
        'prefer-arrow-callback': 'error',
        'prefer-template': 'error',
        'promise/no-nesting': 'error',
        'promise/no-return-in-finally': 'error',
        'promise/prefer-await-to-callbacks': 'error',
        'promise/prefer-await-to-then': 'error',
        'sort-keys': [
            'error',
            'asc',
            { caseSensitive: false, minKeys: 2, natural: true }
        ],
        'sort-vars': 'error'
    },
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
