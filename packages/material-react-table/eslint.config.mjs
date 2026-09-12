import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import perfectionist from 'eslint-plugin-perfectionist';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  {
    ignores: ['dist/', 'locales/', 'node_modules/'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react-hooks': reactHooks,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      //React Compiler diagnostics (purity, refs, immutability, static-components, etc.) are
      //bundled into this plugin's recommended rules - surfaced even before the compiler runs,
      //since they flag the same Rules-of-React violations the compiler itself would skip over.
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/ban-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        {
          prefer: 'type-imports',
          disallowTypeAnnotations: true,
          fixStyle: 'inline-type-imports',
        },
      ],
    },
  },
  {
    //ponytail: perfectionist v5 reshaped sort-imports' customGroups schema (object -> array), and
    //lint hasn't actually run in a while (see eslint.config.mjs's git history) - there's a large
    //pre-existing backlog of sort-order violations across the codebase unrelated to this pass.
    //Keeping the plugin active but as warnings so it doesn't block on unrelated pre-existing debt;
    //re-deriving the old MRT-specific import-group ordering is a separate cleanup, not this one.
    files: ['**/*.ts', '**/*.tsx'],
    plugins: perfectionist.configs['recommended-natural'].plugins,
    rules: Object.fromEntries(
      Object.entries(perfectionist.configs['recommended-natural'].rules).map(
        ([rule]) => [rule, 'warn'],
      ),
    ),
  },
];
