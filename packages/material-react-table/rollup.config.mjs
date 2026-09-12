import pkg from './package.json' with { type: 'json' };
import { babel } from '@rollup/plugin-babel';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import copy from 'rollup-plugin-copy';
import del from 'rollup-plugin-delete';
import dts from 'rollup-plugin-dts';
import external from 'rollup-plugin-peer-deps-external';

const peerDepsExternal = [
  '@dnd-kit/core',
  '@dnd-kit/sortable',
  '@dnd-kit/utilities',
  '@mui/icons-material',
  '@mui/material',
  '@mui/x-date-pickers',
  '@tanstack/match-sorter-utils',
  '@tanstack/react-store',
  '@tanstack/react-table',
  '@tanstack/react-virtual',
  'highlight-words',
  'react',
];

export default [
  {
    //Declarations only, run separately from the JS bundle below and reading the original typed
    //source directly - Babel strips types for the runtime bundle, so type info wouldn't survive
    //if this ran after that instead.
    external: peerDepsExternal,
    input: './src/index.ts',
    output: [
      { dir: './dist', entryFileNames: 'declarations-only.js', format: 'esm' },
    ],
    plugins: [
      external(),
      typescript({
        declaration: true,
        declarationDir: './dist/types',
        emitDeclarationOnly: true,
        importHelpers: false,
        rootDir: './src',
      }),
      del({ hook: 'writeBundle', targets: ['dist/declarations-only.js'] }),
    ],
  },
  {
    //The actual runtime JS bundle, transformed with Babel (not the TypeScript plugin) so
    //React Compiler sees real JSX/hook source instead of already-compiled output.
    external: peerDepsExternal,
    input: './src/index.ts',
    output: [
      {
        file: `./${pkg.main}`,
        format: 'cjs',
        sourcemap: true,
      },
      {
        file: `./${pkg.module}`,
        format: 'esm',
        sourcemap: true,
      },
    ],
    plugins: [
      external(),
      resolve({ extensions: ['.ts', '.tsx', '.js'] }),
      babel({
        babelHelpers: 'bundled',
        extensions: ['.ts', '.tsx'],
        presets: ['@babel/preset-typescript', ['@babel/preset-react', { runtime: 'automatic' }]],
        plugins: [['babel-plugin-react-compiler', { target: '19' }]],
      }),
    ],
  },
  {
    input: './dist/types/index.d.ts',
    output: [{ file: `./${pkg.types}`, format: 'esm' }],
    plugins: [
      del({
        hook: 'buildEnd',
        targets: ['dist/types'],
      }),
      dts(),
    ],
  },
];
