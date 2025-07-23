const overrides = {
  eqeqeq: ['error', 'always', { null: 'ignore' }], // noisy
  'id-length': 'off', // noisy
  'no-console': 'off', // noisy
  'no-eq-null': 'off', // noisy
  'react/forbid-component-props': 'off', // noisy
  'react/prop-types': 'off', // noisy
  'unicorn/no-array-reduce': 'off', // noisy
};

/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'prettier',
  ],
  plugins: [
    'import',
    'promise',
    'react-hooks',
    'n',
  ],
  ignorePatterns: ['build', 'node_modules', 'package-lock.json'],
  overrides: [
    {
      extends: [
        'plugin:react/recommended',
        'plugin:jsx-a11y/recommended',
        'prettier',
      ],
      files: ['*.jsx'],
      parserOptions: {
        babelOptions: {
          parserOpts: {
            plugins: ['jsx'],
          },
        },
      },
      rules: {
        ...overrides,
        'react/no-set-state': 'off', // only useful when using state libs
      },
    },
    {
      extends: ['plugin:jest/recommended'],
      files: '*.test.{js,jsx}',
    },
  ],
  root: true,
  rules: {
    ...overrides,

    'import/no-unassigned-import': [
      'error',
      {
        allow: ['semantic-ui-less/semantic.less', '**/*.css'],
      },
    ],
  },
};
