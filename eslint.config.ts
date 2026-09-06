import antfu from '@antfu/eslint-config'

export default antfu({
  vue: false,
  lessOpinionated: true,
  ignores: ['dist/**', '**/dist/**', 'pnpm-workspace.yaml'],
  rules: {
    'curly': ['error', 'multi-line', 'consistent'],
    'ts/consistent-type-definitions': ['error', 'type'],
    'node/prefer-global/process': ['off'],
  },
})
