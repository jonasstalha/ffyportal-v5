import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-var-requires': 'off',
      'no-console': 'off',
    },
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
    },
  }
); 