export default {
  extends: ['@commitlint/config-conventional'],
  parserPreset: {
    parserOpts: {
      headerPattern: /^(?::[a-z0-9_+-]+:\s+)?(\w*)(?:\((.*)\))?!?: (.*)$/,
      headerCorrespondence: ['type', 'scope', 'subject'],
    },
  },
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        'core',
        'web',
        'physics',
        'rules',
        'render',
        'ui',
        'input',
        'audio',
        'docs',
        'deps',
        'ci',
        'repo',
      ],
    ],
    'subject-case': [0],
  },
};
