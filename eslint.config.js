import { includeIgnoreFile } from '@eslint/compat';
import svelte from 'eslint-plugin-svelte';
import eslintJs from '@eslint/js';
import tsEslint from 'typescript-eslint';
import { fileURLToPath, URL } from 'node:url';
import stylistic from '@stylistic/eslint-plugin';
import svelteConfig from './svelte.config.js';
import globals from 'globals';

const gitignorePath = fileURLToPath(new URL('./.gitignore', import.meta.url));

export default tsEslint.config(
  eslintJs.configs.recommended,
  ...tsEslint.configs.recommended,
  ...svelte.configs.recommended,
  includeIgnoreFile(gitignorePath),
  {
    plugins: {
      '@stylistic': stylistic
    },
    languageOptions: {
      globals: {
        ...globals.browser
      }
    }
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        extraFileExtensions: ['.svelte'],
        parser: tsEslint.parser,
        svelteConfig
      }
    }
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off'
    }
  },
  {
    files: ['**/*.ts', '**/*.js'],
    rules: {
      '@stylistic/indent': ['error', 2],
      '@stylistic/semi': ['error', 'always'],
      '@stylistic/quotes': ['error', 'single'],
      '@stylistic/comma-dangle': ['error', 'never']
    }
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
    rules: {
      'svelte/indent': ['error', { indent: 2 }],
      'svelte/no-spaces-around-equal-signs-in-attribute': 'error',
      'svelte/spaced-html-comment': ['error', 'always'],
      'svelte/sort-attributes': 'error',
      'svelte/first-attribute-linebreak': ['error'],
      'svelte/no-at-html-tags': 'off'
    }
  }
);
