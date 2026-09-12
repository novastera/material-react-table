import { tableFeatures } from '@tanstack/react-table';
import { useState } from 'react';

import {
  type MRT_ColumnDef,
  type MRT_ColumnFilterFnsState,
  type MRT_ColumnOrderState,
  type MRT_ColumnResizingState,
  type MRT_DefinedTableOptions,
  type MRT_FilterOption,
  type MRT_GroupingState,
  type MRT_PaginationState,
  type MRT_RowData,
  type MRT_StatefulTableOptions,
  type MRT_TableState,
} from '../types';
import {
  getAllLeafColumnDefs,
  getColumnId,
  getDefaultColumnFilterFn,
} from '../utils/column.utils';
import { getDefaultColumnOrderIds } from '../utils/displayColumn.utils';
import {
  MRT_TableFeatures,
  type MRT_TableFeaturesType,
} from '../utils/tableFeatures';

//stable placeholder for columnDefTableOptions.state.columnResizing (see that object's own comment
//below) - a module-level constant so its reference never changes, by construction, rather than
//relying on any per-render memoization to keep it stable.
const EMPTY_COLUMN_RESIZING = {} as MRT_ColumnResizingState;

/**
 * Builds the parts of MRT's table options that CAN be made referentially stable across renders
 * when nothing relevant changed - split out of useMRT_TableInstance.ts specifically so this piece
 * never touches `table` (which doesn't exist yet) or mutates its own `definedTableOptions`
 * argument, unlike useMRT_TableInstance.ts itself, which must keep mutating the constructed
 * `table` object after useTable() returns (table.refs, table.getState, etc. - see that file's own
 * comment for why) and can therefore never be optimized by React Compiler. Keeping this
 * construction in its own clean function lets the compiler actually memoize it, which is the
 * real prerequisite for `table`'s own identity to stay stable when unrelated state changes -
 * useTable()'s own wrapper-object memo depends on this options object's reference, not just on
 * which atoms changed.
 *
 * Does NOT include `columns`/`data` - those are built by the caller (useMRT_TableInstance.ts) from
 * columnDefTableOptions, this hook's separate column-def-construction view of the same options
 * (see that object's own comment above for why it needs to differ from statefulTableOptions at
 * all: column-def construction never reads live columnResizing, so pinning that one field keeps
 * `columns` referentially stable through a resize drag without any ref-based bypass).
 */
export const useMRT_TanStackTableOptions = <TData extends MRT_RowData>(
  definedTableOptions: MRT_DefinedTableOptions<TData>,
) => {
  //transform initial state with proper column order and column filter fn defaults - computed
  //once, on mount, and frozen forever after (matching TanStack's own "initialState is a one-time
  //seed" semantics), via useState's lazy initializer rather than useMemo(..., []) so it stays
  //compiler-safe without changing behavior
  const [initialState] = useState<Partial<MRT_TableState<TData>>>(() => {
    const providedInitialState = definedTableOptions.initialState ?? {};
    const statefulOptionsForDefaults = {
      ...definedTableOptions,
      state: {
        ...definedTableOptions.initialState,
        ...definedTableOptions.state,
      },
    } as MRT_StatefulTableOptions<TData>;
    return {
      ...providedInitialState,
      columnFilterFns:
        providedInitialState.columnFilterFns ??
        Object.fromEntries(
          getAllLeafColumnDefs(
            definedTableOptions.columns as MRT_ColumnDef<TData>[],
          ).map((col) => [
            getColumnId(col),
            col.filterFn instanceof Function
              ? (col.filterFn.name ?? 'custom')
              : (col.filterFn ?? getDefaultColumnFilterFn(col)),
          ]),
        ),
      columnOrder:
        providedInitialState.columnOrder ??
        getDefaultColumnOrderIds(statefulOptionsForDefaults),
      globalFilterFn: definedTableOptions.globalFilterFn ?? 'fuzzy',
    };
  });

  //these 4 stay as plain useState (not feature-backed atoms) because they're read synchronously
  //before the table is constructed this render, to build column defs and the
  //"generate blank rows while loading" fallback - matching the pre-existing pattern
  const [columnFilterFns, setColumnFilterFns] =
    useState<MRT_ColumnFilterFnsState>(initialState.columnFilterFns ?? {});
  const [columnOrder, onColumnOrderChange] = useState<MRT_ColumnOrderState>(
    initialState.columnOrder ?? [],
  );
  const [columnResizing, onColumnResizingChange] =
    useState<MRT_ColumnResizingState>(
      initialState.columnResizing ?? ({} as MRT_ColumnResizingState),
    );
  const [globalFilterFn, setGlobalFilterFn] = useState<MRT_FilterOption>(
    initialState.globalFilterFn ?? 'fuzzy',
  );
  const [grouping, onGroupingChange] = useState<MRT_GroupingState>(
    initialState.grouping ?? [],
  );
  const [pagination, onPaginationChange] = useState<MRT_PaginationState>(
    initialState?.pagination ?? { pageIndex: 0, pageSize: 10 },
  );

  //a new object, not a mutation of definedTableOptions - the table options now include all state
  //needed to help determine column visibility and order logic
  const statefulTableOptions = {
    ...definedTableOptions,
    initialState,
    state: {
      columnFilterFns,
      columnOrder,
      columnResizing,
      globalFilterFn,
      grouping,
      pagination,
      ...definedTableOptions.state,
    },
  } as MRT_StatefulTableOptions<TData>;

  //a second view of the same options, used only for building column defs (prepareColumns/
  //getMRT_Row*ColumnDef in useMRT_TableInstance.ts) - identical to statefulTableOptions except
  //columnResizing is pinned to a stable empty placeholder instead of the live value. Column-def
  //construction never reads columnResizing (confirmed: no getMRT_Row*ColumnDef/showRow*Column/
  //prepareColumns references it), but resizing fires a state update on every pixel delta, so
  //embedding the live value in statefulTableOptions.state makes THAT object's reference change on
  //every frame of a drag - which used to force a `columns` memo keyed on the whole object to
  //recompute every frame too, despite nothing it actually reads having changed. Pinning the one
  //field nothing downstream reads lets React Compiler's own auto-memoization of this object
  //correctly treat resizing as irrelevant to it, so `columns` (see useMRT_TableInstance.ts) stays
  //referentially stable through a resize drag without any ref-based bypass.
  const columnDefTableOptions = {
    ...definedTableOptions,
    initialState,
    state: {
      columnFilterFns,
      columnOrder,
      globalFilterFn,
      grouping,
      pagination,
      ...definedTableOptions.state,
      //always wins over any consumer-controlled state.columnResizing override above - nothing in
      //column-def construction reads this field, so pinning it here (rather than a live value)
      //is what keeps this whole object's reference stable through a resize drag.
      columnResizing: EMPTY_COLUMN_RESIZING,
    },
  } as MRT_StatefulTableOptions<TData>;

  //merge consumer-provided custom filterFns/sortFns/aggregationFns (already merged with MRT's
  //own defaults in useMRT_TableOptions) into a per-instance features config - v9 requires
  //these registries to live on tableFeatures() rather than as plain TableOptions
  const instanceTableFeatures = tableFeatures({
    ...MRT_TableFeatures,
    aggregationFns: statefulTableOptions.aggregationFns,
    filterFns: statefulTableOptions.filterFns,
    sortFns: statefulTableOptions.sortFns,
  }) as MRT_TableFeaturesType;

  return {
    columnDefTableOptions,
    columnFilterFns,
    columnResizing,
    globalFilterFn,
    instanceTableFeatures,
    onColumnOrderChange,
    onColumnResizingChange,
    onGroupingChange,
    onPaginationChange,
    setColumnFilterFns,
    setGlobalFilterFn,
    statefulTableOptions,
  };
};
