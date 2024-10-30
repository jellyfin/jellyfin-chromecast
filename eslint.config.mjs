import jsdoc from 'eslint-plugin-jsdoc';
import promise from 'eslint-plugin-promise';
import importPlugin from 'eslint-plugin-import';
import globals from 'globals';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import json from 'eslint-plugin-json';

export default [
    eslint.configs.recommended,
    jsdoc.configs['flat/recommended'],
    eslintPluginPrettierRecommended,
    ...tseslint.configs.strict,
    ...tseslint.configs.stylisticTypeChecked,
    promise.configs['flat/recommended'],
    importPlugin.flatConfigs.errors,
    importPlugin.flatConfigs.warnings,
    {
        ignores: ['dist/*']
    },
    {
        settings: {
            'import/resolver': {
                typescript: {
                    alwaysTryTypes: true
                }
            }
        }
    },
    {
        files: ['**/*.json'],
        ...json.configs['recommended'],
        ...tseslint.configs.disableTypeChecked
    },
    {
        files: ['**/*.ts'],
        ...importPlugin.flatConfigs.typescript,
        languageOptions: {
            parser: tseslint.parser
        }
    },
    {
        files: ['eslint.config.mjs'],
        ...tseslint.configs.disableTypeChecked
    },
    {
        files: ['**/*.ts', '**/*.js'],
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.es2015
            },
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname
            }
        },
        rules: {
            '@typescript-eslint/explicit-function-return-type': 'error',
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-unused-expressions': 'warn',
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
                    next: [
                        'if',
                        'class',
                        'for',
                        'do',
                        'while',
                        'switch',
                        'try'
                    ],
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
        }
    },
    {
        files: ['*.js'],
        languageOptions: {
            globals: {
                ...globals.node
            }
        }
    }
];
