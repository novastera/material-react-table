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
    //JSX/TS survive as real source through this pass. Do NOT run babel-plugin-react-compiler
    //here: this is a library, and TanStack Table's row/cell/table objects are stable identities
    //whose "current" values are read through methods (row.getIsSelected(), table.getState(),
    //…). The compiler memoizes those calls against the stable object, so a discarded
    //useSelector(table.atoms.rowSelection) no longer invalidates `checked` / `data-selected`.
    //Storybook (uncompiled source) was fine; every consumer of dist was not. Re-render scoping
    //is already handled by table.Subscribe / AppCell / AppRow. Consumers who want the compiler
    //can run it on their own app; it will not compile this package's node_modules dist.
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
