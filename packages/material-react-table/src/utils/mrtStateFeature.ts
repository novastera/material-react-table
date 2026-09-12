import {
  assignTableAPIs,
  makeStateUpdater,
  type OnChangeFn,
  setStateSlice,
  type TableFeature,
} from '@tanstack/react-table';

import {
  type MRT_ColumnFilterFnsState,
  type MRT_DensityState,
  type MRT_EditingRowValuesCacheState,
  type MRT_FilterOption,
} from '../types';
import { createRow } from './tanstack.helpers';

//Minimal shape for the row/column/cell-holding atoms below - just `id`, which is all any consumer
//of table.atoms.<key> can rely on without a concrete TData (see the TableState_FeatureMap
//augmentation comment). Using the real MRT_Cell/MRT_Row/MRT_Column<any> here instead fails to
//type-check: those types embed a `.table: MRT_TableInstance<TData>` back-reference whose methods
//use TData contravariantly (e.g. setOptions), which breaks structural "extends" compatibility once
//TData is erased to `any` - `{ id: string }` sidesteps that entirely, and is all
//MRT_TableBodyCell.tsx (and similar) actually read off these fields (`draggingColumn?.id`, etc.).
type MRT_AtomIdRef = { id: string } | null;
type MRT_AtomPartialIdRef = { id?: string } | null;

//Every piece of MRT's own table state that isn't backed by a real TanStack feature (density,
//editing state, hover/drag tracking, etc.) - registered as a genuine v9 feature instead of
//useState bolted onto the table object after construction. This means it lives on table.atoms/
//table.store like every other feature's state: it participates in the same reactivity
//(table.state, table.Subscribe, useSelector) instead of forcing a monolithic re-render on every
//change, and - critically - it's visible through every internal reference (column.table,
//row.table, header.getContext().table), not just the wrapper object useTable() hands back this
//specific render (v9's useTable() returns a fresh `{...table, options, state}` object every
//render; internal column/row/header objects keep a reference to the original, so anything only
//attached to the wrapper - which is how this used to be done - is invisible from those).
//columnFilterFns and globalFilterFn are registered here too, but unlike every other field below,
//their `on*Change` default (assigned generically in getDefaultTableOptions, via makeStateUpdater)
//is always overridden by an explicit onColumnFilterFnsChange/onGlobalFilterFnChange that
//useMRT_TableInstance.ts supplies (pointing at its own React useState setters, or a consumer's
//own controlled-state callback) - the same "controlled state" pattern columnOrder/columnResizing/
//grouping/pagination already use there. That's required, not optional, for these two specifically:
//both are read synchronously in useMRT_TableInstance.ts *before* the table is constructed this
//render (to build column defs and the globalFilterFn table option), so React state - not this
//feature's own base atom - has to stay the canonical, synchronously-readable source. Registering
//them here is still what makes table.atoms.columnFilterFns/.globalFilterFn exist and makes native
//table.getState() correct for them automatically (TanStack syncs options.state into this
//feature's base atoms on every render whenever a matching key exists here, exactly like
//columnOrder already does) - see the "controlled state" doc in useMRT_TableInstance.ts.
//
//isLoading/isSaving/showLoadingOverlay/showProgressBars/showSkeletons are registered too, but
//need no onXChange wiring at all (unlike the two above): they're pure consumer-set passthrough
//flags nothing ever calls a setter for, and the options.state->baseAtoms sync (triggered by
//their mere presence in options.state, which a consumer's own `state` prop already populates)
//writes the base atom directly, with no setter involved. The auto-generated
//table.setIsLoading/etc. from the generic loop below simply go unused, same as several other
//generated setters already do.
//
//Their default here is deliberately `undefined`, not `false`, even though every one of them is
//typed as a plain `boolean` on MRT_TableState<TData> - confirmed empirically (a live skeleton
//story stopped rendering skeletons) that several call sites, e.g. MRT_TableBodyCell.tsx's
//`showSkeletons !== false && (isLoading || showSkeletons)`, rely on being able to tell "consumer
//never touched this" (undefined) apart from "consumer explicitly disabled it" (false). Defaulting
//to `false` collapses that distinction and silently breaks `isLoading`-only usage. `undefined`
//preserves the exact pre-existing runtime semantics while still registering the key, which is all
//that's actually needed for table.atoms.<key>/native table.getState() to work.
const MRT_STATE_DEFAULTS = {
  actionCell: null,
  columnFilterFns: {} as MRT_ColumnFilterFnsState,
  creatingRow: null,
  density: 'comfortable',
  draggingColumn: null,
  draggingRow: null,
  editingCell: null,
  editingRow: null,
  editingRowValuesCache: {},
  globalFilterFn: 'fuzzy' as MRT_FilterOption,
  hoveredColumn: null,
  hoveredRow: null,
  isFullScreen: false,
  isLoading: undefined as boolean | undefined,
  isSaving: undefined as boolean | undefined,
  showAlertBanner: false,
  showColumnFilters: false,
  showGlobalFilter: false,
  showLoadingOverlay: undefined as boolean | undefined,
  showProgressBars: undefined as boolean | undefined,
  showSkeletons: undefined as boolean | undefined,
  showToolbarDropZone: false,
} as const;

type MRT_StateKey = keyof typeof MRT_STATE_DEFAULTS;

const capitalize = (key: string) => `${key[0].toUpperCase()}${key.slice(1)}`;
const onChangeKey = (key: string) => `on${capitalize(key)}Change`;
const setterKey = (key: string) => `set${capitalize(key)}`;

//The feature-map slice below is what makes table.atoms.<key> (useSelector(table.atoms.actionCell),
//etc.) statically typed instead of `unknown` - TanStack's Atoms<TFeatures> type is built from
//TableState<TFeatures>, which only knows about a feature's state shape if that feature
//declaration-merges itself into TableState_FeatureMap (the same mechanism every stock feature
//uses, see table-core's TableState.d.ts). This map isn't parameterized by TData (TanStack's own
//feature slices aren't either), so row/column/cell-holding fields use the minimal MRT_AtomIdRef
//shape below instead of the real MRT_Cell/MRT_Row/MRT_Column<TData> - the fully-typed-per-TData
//versions of these same fields live on MRT_TableState<TData> in types.ts, which table.getState()
//still returns.
declare module '@tanstack/react-table' {
  interface Plugins {
    mrtStateFeature: typeof mrtStateFeature;
  }
  interface TableState_FeatureMap {
    mrtStateFeature: {
      actionCell?: MRT_AtomIdRef;
      columnFilterFns: MRT_ColumnFilterFnsState;
      creatingRow: MRT_AtomIdRef;
      density: MRT_DensityState;
      draggingColumn: MRT_AtomIdRef;
      draggingRow: MRT_AtomIdRef;
      editingCell: MRT_AtomIdRef;
      editingRow: MRT_AtomIdRef;
      editingRowValuesCache: MRT_EditingRowValuesCacheState;
      globalFilterFn: MRT_FilterOption;
      hoveredColumn: MRT_AtomPartialIdRef;
      hoveredRow: MRT_AtomPartialIdRef;
      isFullScreen: boolean;
      isLoading?: boolean;
      isSaving?: boolean;
      showAlertBanner: boolean;
      showColumnFilters: boolean;
      showGlobalFilter: boolean;
      showLoadingOverlay?: boolean;
      showProgressBars?: boolean;
      showSkeletons?: boolean;
      showToolbarDropZone: boolean;
    };
  }
}

export const mrtStateFeature: TableFeature = {
  constructTableAPIs: (table) => {
    const apis: Record<string, { fn: (updater: any) => void }> = {
      //table.getState() was removed by react-table v9 in favor of table.state, but every
      //feature's state (stock + this one) already flows through table.store, so this is a
      //genuine native passthrough - not a re-merge - and works via any reference to the table.
      table_getState: { fn: () => (table as any).store.state },
      //creatingRow's "true" sentinel (auto-generate a blank row via createRow) needs the fully
      //constructed table, which is available here (constructTableAPIs runs after
      //initTableInstanceData, once options/atoms/store are ready) - special-cased instead of
      //using the generic per-key loop below, matching what useMRT_TableInstance.ts used to do by
      //wrapping this API after useTable() returned (an Immutability violation - "modifying a
      //value returned from a hook" - since that wrapping happened outside table construction).
      //Note this convenience shorthand is therefore only available via table.setCreatingRow(true),
      //not through column.table.setCreatingRow(true)-style access to some other raw setter.
      table_setCreatingRow: {
        fn: (updater: any) =>
          setStateSlice(
            table,
            'creatingRow',
            updater === true ? createRow(table as any) : updater,
          ),
      },
    };
    for (const key of Object.keys(MRT_STATE_DEFAULTS) as MRT_StateKey[]) {
      if (key === 'creatingRow') continue;
      apis[`table_${setterKey(key)}`] = {
        fn: (updater: any) => setStateSlice(table, key, updater),
      };
    }
    assignTableAPIs('mrtStateFeature', table, apis);
  },
  getDefaultTableOptions: (table) => {
    const defaults: Record<string, OnChangeFn<any>> = {};
    for (const key of Object.keys(MRT_STATE_DEFAULTS) as MRT_StateKey[]) {
      defaults[onChangeKey(key)] = makeStateUpdater(key, table);
    }
    return defaults;
  },
  getInitialState: (initialState) => ({
    ...MRT_STATE_DEFAULTS,
    ...initialState,
  }),
  //table.refs is plain, non-reactive instance data (DOM refs), not table state, so it doesn't
  //belong in MRT_STATE_DEFAULTS/the atom system above - this is TanStack's own designated hook
  //for exactly that ("Initializes mutable, non-reactive data owned by this feature on the table
  //instance... runs once during table construction"). table.options.mrtRefs is a stable bundle
  //useMRT_TableInstance.ts builds once (every ref inside is itself useRef-stable), passed through
  //as a custom table option specifically so it can be assigned here - inside table construction -
  //instead of mutating table.refs after useTable() returns, which is what React Compiler flags as
  //an Immutability violation ("modifying a value returned from a hook").
  initTableInstanceData: (table) => {
    (table as any).refs = (table.options as any).mrtRefs;
  },
};
