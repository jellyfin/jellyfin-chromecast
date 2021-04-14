module.exports = {
  root: true,
  env: {
    node: true,
    browser: true,
    es6: true
  },
  extends: [
    'eslint:recommended',
    'plugin:jsdoc/recommended',
    'plugin:json/recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
    'plugin:prettier/recommended',
    'plugin:promise/recommended',
    'plugin:import/errors',
    'plugin:import/warnings',
    'plugin:import/typescript'
  ],
  plugins: ['prettier', 'promise', 'import', 'jsdoc'],
  rules: {
    'import/newline-after-import': 'error',
    'import/order': 'error',
    'jsdoc/require-hyphen-before-param-description': 'error',
    'jsdoc/require-description': 'warn',
    'jsdoc/require-param-description': 'warn',
    'jsdoc/require-jsdoc': 'error',
    //TypeScript and IntelliSense already provides us information about the function typings while hovering and
    // eslint-jsdoc doesn't detect a mismatch between what's declared in the function and what's declared in
    // JSDOC.
    'jsdoc/require-param-type': 'off',
    'jsdoc/require-returns-type': 'off',
    'jsdoc/check-indentation': 'error',
    'jsdoc/check-syntax': 'error',
    'jsdoc/check-param-names': 'error',
    'jsdoc/check-property-names': 'error',
    'jsdoc/check-tag-names': 'error',
    'jsdoc/no-types': 'error',
    'jsdoc/valid-types': 'off',
    'promise/no-nesting': 'error',
    'promise/no-return-in-finally': 'error',
    'promise/prefer-await-to-callbacks': 'error',
    'promise/prefer-await-to-then': 'error',
    '@typescript-eslint/explicit-function-return-type': 'error',
    '@typescript-eslint/prefer-ts-expect-error': 'error',
    '@typescript-eslint/no-unused-vars': 'error',
    'prefer-arrow-callback': 'error',
    'prefer-template': 'error',
    curly: 'error',
    'padding-line-between-statements': [
      'error',
      // Always require blank lines after directives (like 'use-strict'), except between directives
      { blankLine: 'always', prev: 'directive', next: '*' },
      { blankLine: 'any', prev: 'directive', next: 'directive' },
      // Always require blank lines after import, except between imports
      { blankLine: 'always', prev: 'import', next: '*' },
      { blankLine: 'any', prev: 'import', next: 'import' },
      // Always require blank lines before and after every sequence of variable declarations and export
      {
        blankLine: 'always',
        prev: '*',
        next: ['const', 'let', 'var', 'export']
      },
      {
        blankLine: 'always',
        prev: ['const', 'let', 'var', 'export'],
        next: '*'
      },
      {
        blankLine: 'any',
        prev: ['const', 'let', 'var', 'export'],
        next: ['const', 'let', 'var', 'export']
      },
      // Always require blank lines before and after class declaration, if, do/while, switch, try
      {
        blankLine: 'always',
        prev: '*',
        next: ['if', 'class', 'for', 'do', 'while', 'switch', 'try']
      },
      {
        blankLine: 'always',
        prev: ['if', 'class', 'for', 'do', 'while', 'switch', 'try'],
        next: '*'
      },
      // Always require blank lines before return statements
      { blankLine: 'always', prev: '*', next: 'return' }
    ]
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
