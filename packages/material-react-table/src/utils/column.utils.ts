import {
  type DropdownOption,
  type MRT_Column,
  type MRT_ColumnDef,
  type MRT_ColumnOrderState,
  type MRT_DefinedColumnDef,
  type MRT_DefinedTableOptions,
  type MRT_FilterOption,
  type MRT_Header,
  type MRT_RowData,
  type MRT_TableInstance,
} from '../types';

export const getColumnId = <TData extends MRT_RowData>(
  columnDef: MRT_ColumnDef<TData>,
): string =>
  columnDef.id ?? columnDef.accessorKey?.toString?.() ?? columnDef.header;

export const getAllLeafColumnDefs = <TData extends MRT_RowData>(
  columns: MRT_ColumnDef<TData>[],
): MRT_ColumnDef<TData>[] => {
  const allLeafColumnDefs: MRT_ColumnDef<TData>[] = [];
  const getLeafColumns = (cols: MRT_ColumnDef<TData>[]) => {
    cols.forEach((col) => {
      if (col.columns) {
        getLeafColumns(col.columns);
      } else {
        allLeafColumnDefs.push(col);
      }
    });
  };
  getLeafColumns(columns);
  return allLeafColumnDefs;
};

export const prepareColumns = <TData extends MRT_RowData>({
  columnDefs,
  tableOptions,
}: {
  columnDefs: MRT_ColumnDef<TData>[];
  tableOptions: MRT_DefinedTableOptions<TData>;
}): MRT_DefinedColumnDef<TData>[] => {
  const {
    defaultDisplayColumn,
    filterFns = {},
    sortFns = {},
    state: { columnFilterFns = {} } = {},
  } = tableOptions;
  return columnDefs.map((columnDef) => {
    //assign columnId
    if (!columnDef.id) columnDef.id = getColumnId(columnDef);
    //assign columnDefType
    if (!columnDef.columnDefType) columnDef.columnDefType = 'data';
    if (columnDef.columns?.length) {
      columnDef.columnDefType = 'group';
      //recursively prepare columns if this is a group column
      columnDef.columns = prepareColumns({
        columnDefs: columnDef.columns,
        tableOptions,
      });
    } else if (columnDef.columnDefType === 'data') {
      //note: multiple aggregation functions (columnDef.aggregationFn as a string[]) are handled
      //natively by react-table v9 (produces a keyed object result), no glue code needed here

      //assign filterFns
      if (Object.keys(filterFns).includes(columnFilterFns[columnDef.id])) {
        columnDef.filterFn =
          filterFns[columnFilterFns[columnDef.id]] ?? filterFns.fuzzy;
        (columnDef as MRT_DefinedColumnDef<TData>)._filterFn =
          columnFilterFns[columnDef.id];
      }

      //assign sortFns
      if (Object.keys(sortFns).includes(columnDef.sortFn as string)) {
        // @ts-expect-error
        columnDef.sortFn = sortFns[columnDef.sortFn];
      }
    } else if (columnDef.columnDefType === 'display') {
      columnDef = {
        ...(defaultDisplayColumn as MRT_ColumnDef<TData>),
        ...columnDef,
      };
    }
    return columnDef;
  }) as MRT_DefinedColumnDef<TData>[];
};

export const reorderColumn = <TData extends MRT_RowData>(
  draggedColumn: MRT_Column<TData>,
  targetColumn: MRT_Column<TData>,
  columnOrder: MRT_ColumnOrderState,
): MRT_ColumnOrderState => {
  if (draggedColumn.getCanPin()) {
    draggedColumn.pin(targetColumn.getIsPinned());
  }
  const newColumnOrder = [...columnOrder];
  newColumnOrder.splice(
    newColumnOrder.indexOf(targetColumn.id),
    0,
    newColumnOrder.splice(newColumnOrder.indexOf(draggedColumn.id), 1)[0],
  );
  return newColumnOrder;
};

//Shared by useMRT_DragAndDrop.ts (the table's own header-cell column drag) and
//MRT_ShowHideColumnsMenu.tsx (its independent, self-contained drag context for reordering columns
//inside the show/hide-columns popover) - both need the exact same "reorder, then keep pinning
//arrays consistent with the new order" commit, previously duplicated verbatim in both places.
export const commitColumnReorder = <TData extends MRT_RowData>(
  table: MRT_TableInstance<TData>,
  draggedColumn: MRT_Column<TData>,
  targetColumn: MRT_Column<TData>,
) => {
  const reorderedColumns = reorderColumn(
    draggedColumn,
    targetColumn,
    table.atoms.columnOrder.get(),
  );
  table.setColumnOrder(reorderedColumns);
  table.setColumnPinning(({ end = [], start = [] }) => ({
    end: reorderedColumns.filter((header) => end.includes(header)),
    start: reorderedColumns.filter((header) => start.includes(header)),
  }));
};

export const getDefaultColumnFilterFn = <TData extends MRT_RowData>(
  columnDef: MRT_ColumnDef<TData>,
): MRT_FilterOption => {
  const { filterVariant } = columnDef;
  if (filterVariant === 'multi-select') return 'arrIncludesSome';
  if (filterVariant?.includes('range')) return 'betweenInclusive';
  if (filterVariant === 'select' || filterVariant === 'checkbox')
    return 'equals';
  return 'fuzzy';
};

export const getColumnFilterInfo = <TData extends MRT_RowData>({
  header,
  table,
}: {
  header: MRT_Header<TData>;
  table: MRT_TableInstance<TData>;
}) => {
  const {
    options: { columnFilterModeOptions, enableFacetedValues },
  } = table;
  const { column } = header;
  const { columnDef } = column;
  const { filterVariant } = columnDef;

  const isDateFilter = !!(
    filterVariant?.startsWith('date') || filterVariant?.startsWith('time')
  );
  const isAutocompleteFilter = filterVariant === 'autocomplete';
  const isRangeFilter =
    filterVariant?.includes('range') ||
    ['between', 'betweenInclusive', 'inNumberRange'].includes(
      columnDef._filterFn,
    );
  const isSelectFilter = filterVariant === 'select';
  const isMultiSelectFilter = filterVariant === 'multi-select';
  const isTextboxFilter =
    ['autocomplete', 'text'].includes(filterVariant!) ||
    (!isSelectFilter && !isMultiSelectFilter);
  const currentFilterOption = columnDef._filterFn;

  const allowedColumnFilterOptions =
    columnDef?.columnFilterModeOptions ?? columnFilterModeOptions;

  //v9 always registers the faceted row models (features can't be conditionally registered
  //per-instance); gate the actual computation here so enableFacetedValues: false still means
  //what it says instead of computing unique values for every column regardless
  const facetedUniqueValues = enableFacetedValues
    ? column.getFacetedUniqueValues()
    : new Map<any, number>();

  return {
    allowedColumnFilterOptions,
    currentFilterOption,
    facetedUniqueValues,
    isAutocompleteFilter,
    isDateFilter,
    isMultiSelectFilter,
    isRangeFilter,
    isSelectFilter,
    isTextboxFilter,
  } as const;
};

export const useDropdownOptions = <TData extends MRT_RowData>({
  header,
  table,
}: {
  header: MRT_Header<TData>;
  table: MRT_TableInstance<TData>;
}): DropdownOption[] | undefined => {
  const { column } = header;
  const { columnDef } = column;
  const {
    facetedUniqueValues,
    isAutocompleteFilter,
    isMultiSelectFilter,
    isSelectFilter,
  } = getColumnFilterInfo({ header, table });

  //plain computed value (not useMemo) - the previous manual dependency array didn't list
  //isAutocompleteFilter despite the callback reading it, which made React Compiler refuse to
  //compile this hook at all (category PreserveManualMemo) rather than risk a stale value.
  //Letting the compiler infer the real dependencies itself is both correct and simpler.
  return (
    columnDef.filterSelectOptions ??
    ((isSelectFilter || isMultiSelectFilter || isAutocompleteFilter) &&
    facetedUniqueValues
      ? Array.from(facetedUniqueValues.keys())
          .filter((value) => value !== null && value !== undefined)
          .sort((a, b) => String(a).localeCompare(String(b)))
      : undefined)
  );
};
