import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: [
    '../stories/**/*.mdx',
    '../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)',
    //internal-check/ is gitignored (local verification tooling, see its README.md) - this picks
    //up its test-harness stories so the same running `pnpm storybook` instance serves both the
    //real component docs and the internal render/interaction test fixtures, without needing a
    //second dev server.
    '../internal-check/**/*.stories.@(js|jsx|mjs|ts|tsx)',
  ],
  addons: [
    'storybook-dark-mode',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },

  typescript: {
    reactDocgen: 'react-docgen',
  },
};

export default config;
