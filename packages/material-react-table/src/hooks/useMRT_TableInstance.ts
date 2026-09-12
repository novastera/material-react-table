import { useMemo, useRef } from 'react';

import {
  type MRT_ColumnDef,
  type MRT_DefinedTableOptions,
  type MRT_RowData,
  type MRT_TableInstance,
} from '../types';
import { getAllLeafColumnDefs, getColumnId, prepareColumns } from '../utils/column.utils';
import {
  showRowActionsColumn,
  showRowDragColumn,
  showRowExpandColumn,
  showRowNumbersColumn,
  showRowPinningColumn,
  showRowSelectionColumn,
  showRowSpacerColumn,
} from '../utils/displayColumn.utils';
import { getMRT_RowActionsColumnDef } from './display-columns/getMRT_RowActionsColumnDef';
import { getMRT_RowDragColumnDef } from './display-columns/getMRT_RowDragColumnDef';
import { getMRT_RowExpandColumnDef } from './display-columns/getMRT_RowExpandColumnDef';
import { getMRT_RowNumbersColumnDef } from './display-columns/getMRT_RowNumbersColumnDef';
import { getMRT_RowPinningColumnDef } from './display-columns/getMRT_RowPinningColumnDef';
import { getMRT_RowSelectColumnDef } from './display-columns/getMRT_RowSelectColumnDef';
import { getMRT_RowSpacerColumnDef } from './display-columns/getMRT_RowSpacerColumnDef';
import { useAppTable } from './useMRT_AppTable';
import { useMRT_Effects } from './useMRT_Effects';
import { useMRT_TanStackTableOptions } from './useMRT_TanStackTableOptions';

/**
 * The MRT hook that wraps the TanStack useTable hook and adds additional functionality.
 *
 * All of MRT's own state (density, editing state, hover/drag tracking, columnFilterFns,
 * globalFilterFn, and the pure-passthrough loading flags) is registered as a real TanStack v9
 * feature (see ../utils/mrtStateFeature.ts) rather than plain useState bolted onto the table
 * object after construction - it lives on table.atoms/table.store like every other feature's
 * state, so it's visible through any reference to the table (column.table, row.table,
 * header.getContext().table), not just the specific wrapper object useTable() hands back this
 * render, and it participates in the same reactivity (table.state, table.Subscribe, useSelector)
 * instead of forcing a monolithic re-render on every change.
 *
 * columnFilterFns and globalFilterFn additionally stay as plain useState here (see
 * mrtStateFeature.ts for the full reasoning - both are read synchronously before the table exists
 * this render, to build column defs and the globalFilterFn table option), matching columnOrder,
 * columnResizing, grouping, and pagination. Unlike those four, though, they're *also*
 * feature-registered: their onColumnFilterFnsChange/onGlobalFilterFnChange (wired into
 * tableOptionsForTanStack below) route the feature's auto-generated setters back into these same
 * React setters, so table.atoms.columnFilterFns/.globalFilterFn and native table.getState() work
 * correctly without any manual merge.
 *
 * This function used to mutate the table object useTable() returns (table.refs, table.getState,
 * table.setCreatingRow, table.setColumnFilterFns, table.setGlobalFilterFn) so those fields were
 * visible through the same stable `table` reference downstream code relies on - React Compiler
 * flagged every one of those as an "Immutability" violation ("modifying a value returned from a
 * hook... move the modification into the hook where the value is constructed"). All five are now
 * gone, following that suggestion literally: table.getState/table.setColumnFilterFns/
 * table.setGlobalFilterFn are native once their state is feature-registered (see above);
 * table.refs is assigned once by mrtStateFeature.ts's initTableInstanceData (the refs bundle is
 * passed in as a stable custom table option, mrtRefs, below); table.setCreatingRow's "true"
 * sentinel is a special case inside mrtStateFeature.ts's constructTableAPIs instead of a
 * post-hoc wrapper.
 *
 * `columns` used to be guarded by a ref-based bypass cache to avoid rebuilding column defs on
 * every pixel delta of an active column resize - removed once the root cause was fixed instead:
 * see useMRT_TanStackTableOptions.ts's columnDefTableOptions, which excludes the one field
 * (columnResizing) that was making the options object underlying that memo churn every frame
 * despite column-def construction never reading it. Column/row dragging never needed an
 * equivalent bypass in the first place once both moved to @dnd-kit (see migration-table.md):
 * dnd-kit's onDragOver only fires when the resolved drop target changes (once per column/row
 * crossed), not on every pixel of pointer movement the way native HTML5 dragenter did.
 *
 * Passing the mrtRefs bundle itself into useTable() below is still something React Compiler
 * flags (it can't prove a third-party hook won't dereference a ref object handed to it, even
 * though nothing here ever does) - a genuine, narrow exception, not a leftover from the above.
 *
 * @param definedTableOptions - table options with proper defaults set
 * @returns the MRT table instance
 */
export const useMRT_TableInstance = <TData extends MRT_RowData>(
  definedTableOptions: MRT_DefinedTableOptions<TData>,
): MRT_TableInstance<TData> => {
  const lastSelectedRowId = useRef<null | string>(null);
  const actionCellRef = useRef<HTMLTableCellElement>(null);
  const bottomToolbarRef = useRef<HTMLDivElement>(null);
  const editInputRefs = useRef<Record<string, HTMLInputElement>>({});
  const filterInputRefs = useRef<Record<string, HTMLInputElement>>({});
  const searchInputRef = useRef<HTMLInputElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const tableHeadCellRefs = useRef<Record<string, HTMLTableCellElement>>({});
  const tablePaperRef = useRef<HTMLDivElement>(null);
  const topToolbarRef = useRef<HTMLDivElement>(null);
  const tableHeadRef = useRef<HTMLTableSectionElement>(null);
  const tableFooterRef = useRef<HTMLTableSectionElement>(null);

  //every individual ref above is stable for this component's lifetime (useRef's own guarantee),
  //so this bundle only needs to be built once - passed through to mrtStateFeature.ts's
  //initTableInstanceData via a custom table option (see tableOptionsForTanStack below), which
  //assigns it to table.refs during table construction instead of this hook mutating table.refs
  //after useTable() returns (the latter is what React Compiler flags as an Immutability
  //violation - "modifying a value returned from a hook").
  const mrtRefs = useMemo(
    () => ({
      actionCellRef,
      bottomToolbarRef,
      editInputRefs,
      filterInputRefs,
      lastSelectedRowId,
      searchInputRef,
      tableContainerRef,
      tableFooterRef,
      tableHeadCellRefs,
      tableHeadRef,
      tablePaperRef,
      topToolbarRef,
    }),
    [],
  );

  const {
    columnDefTableOptions,
    globalFilterFn,
    instanceTableFeatures,
    onColumnOrderChange,
    onColumnResizingChange,
    onGroupingChange,
    onPaginationChange,
    setColumnFilterFns,
    setGlobalFilterFn,
    statefulTableOptions,
  } = useMRT_TanStackTableOptions(definedTableOptions);

  //columnDefTableOptions (not statefulTableOptions) - identical except columnResizing is pinned to
  //a stable placeholder (see useMRT_TanStackTableOptions.ts's own comment on it), since nothing
  //below reads live columnResizing. That's what lets this memo - and therefore `columns` - stay
  //referentially stable across both unrelated state changes (a row getting selected, a cell
  //getting hovered, etc.) AND an active resize drag, with no ref-based bypass needed for the
  //latter the way there used to be.
  const columns = useMemo(
    () =>
      prepareColumns({
        columnDefs: [
          ...([
            showRowPinningColumn(columnDefTableOptions) &&
              getMRT_RowPinningColumnDef(columnDefTableOptions),
            showRowDragColumn(columnDefTableOptions) &&
              getMRT_RowDragColumnDef(columnDefTableOptions),
            showRowActionsColumn(columnDefTableOptions) &&
              getMRT_RowActionsColumnDef(columnDefTableOptions),
            showRowExpandColumn(columnDefTableOptions) &&
              getMRT_RowExpandColumnDef(columnDefTableOptions),
            showRowSelectionColumn(columnDefTableOptions) &&
              getMRT_RowSelectColumnDef(columnDefTableOptions),
            showRowNumbersColumn(columnDefTableOptions) &&
              getMRT_RowNumbersColumnDef(columnDefTableOptions),
          ].filter(Boolean) as MRT_ColumnDef<TData>[]),
          ...columnDefTableOptions.columns,
          ...([
            showRowSpacerColumn(columnDefTableOptions) &&
              getMRT_RowSpacerColumnDef(columnDefTableOptions),
          ].filter(Boolean) as MRT_ColumnDef<TData>[]),
        ],
        tableOptions: columnDefTableOptions,
      }),
    [columnDefTableOptions],
  );

  //if loading, generate blank rows to show skeleton loaders
  const data =
    (statefulTableOptions.state.isLoading ||
      statefulTableOptions.state.showSkeletons) &&
    !statefulTableOptions.data.length
      ? [
          ...Array(
            Math.min(statefulTableOptions.state.pagination.pageSize, 20),
          ).fill(null),
        ].map(() =>
          Object.fromEntries(
            getAllLeafColumnDefs(columns).map((col) => [getColumnId(col), null]),
          ),
        )
      : statefulTableOptions.data;

  //MRT's column defs and options are typed against the union of every feature MRT might use
  //(see MRT_TableFeaturesType), which is inherently looser than the exact concrete features
  //object useTable expects here - same tradeoff the v8 code made with its own
  //`@ts-expect-error` at this identical call site.
  //
  //This function can never be compiler-optimized (see the file comment above), so a plain spread
  //here would always produce a new object every render regardless of whether anything inside it
  //actually changed - defeating useTable()'s own internal memoization of the table wrapper it
  //returns, and with it any chance of downstream components avoiding re-renders they don't need.
  //Every dependency listed here is itself stable when unchanged (the onXChange setters via
  //React's own useState guarantee, everything else via useMRT_TanStackTableOptions.ts), so this
  //useMemo is the one narrowly-justified exception to "let the compiler handle it": the compiler
  //genuinely cannot reach this particular construction, not because it wasn't trusted to.
  const tableOptionsForTanStack = useMemo(
    () =>
      ({
        features: instanceTableFeatures,
        onColumnOrderChange,
        onColumnResizingChange,
        onGroupingChange,
        onPaginationChange,
        ...statefulTableOptions,
        columns,
        data,
        globalFilterFn: (globalFilterFn ?? 'fuzzy') as any,
        //read by mrtStateFeature.ts's initTableInstanceData, which assigns it to table.refs -
        //see the mrtRefs comment above.
        mrtRefs,
        //controlled-state wiring for mrtStateFeature's columnFilterFns/globalFilterFn (see that
        //file's comment) - mirrors onColumnOrderChange above, but with the consumer-override
        //fallback these two have always publicly supported (columnOrder etc. don't check for a
        //consumer override here, that's pre-existing and unrelated).
        onColumnFilterFnsChange:
          statefulTableOptions.onColumnFilterFnsChange ?? setColumnFilterFns,
        onGlobalFilterFnChange:
          statefulTableOptions.onGlobalFilterFnChange ?? setGlobalFilterFn,
      }) as any,
    [
      instanceTableFeatures,
      onColumnOrderChange,
      onColumnResizingChange,
      onGroupingChange,
      onPaginationChange,
      statefulTableOptions,
      columns,
      data,
      globalFilterFn,
      setColumnFilterFns,
      setGlobalFilterFn,
      mrtRefs,
    ],
  );

  //Constant selector: useSelector compares with `shallow`, so `{}` vs `{}` is always "equal" and
  //`state` keeps its identity forever - which is what stops the wrapper useMemo inside useTable()
  //(which useAppTable calls internally) from invalidating on every atom write. table.getState()
  //is unaffected (mrtStateFeature.ts reads table.store.state directly), so every event-handler/
  //effect read keeps working. This makes `table.state` `{}` for consumers too (CHANGELOG.md
  //documents it) - use table.getState() instead.
  //
  //useAppTable (not the bare useTable) - see useMRT_AppTable.ts's own comment. Attaches
  //table.AppTable/AppCell/AppHeader/AppFooter, TanStack's own Context+Subscribe boundaries for
  //composable, granularly-scoped re-rendering (migration-render.md §13's resolution) - the row
  //counterpart, MRT_AppRow, is imported directly by call sites instead, since it takes `table` as
  //an explicit prop rather than needing to be bound to one table instance via closure.
  const reactTable = useAppTable(tableOptionsForTanStack, () => ({}));
  const table = reactTable as unknown as MRT_TableInstance<TData>;

  useMRT_Effects(table);

  return table;
};
