import { useId, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import { MRT_AggregationFns } from '../fns/aggregationFns';
import { MRT_FilterFns } from '../fns/filterFns';
import { MRT_SortFns } from '../fns/sortingFns';
import { MRT_Default_Icons } from '../icons';
import { MRT_Localization_EN } from '../locales/en';
import {
  type MRT_DefinedTableOptions,
  type MRT_RowData,
  type MRT_TableOptions,
} from '../types';
import { getMRTTheme } from '../utils/style.utils';

export const MRT_DefaultColumn = {
  filterVariant: 'text',
  maxSize: 1000,
  minSize: 40,
  size: 180,
} as const;

export const MRT_DefaultDisplayColumn = {
  columnDefType: 'display',
  enableClickToCopy: false,
  enableColumnActions: false,
  enableColumnDragging: false,
  enableColumnFilter: false,
  enableColumnOrdering: false,
  enableEditing: false,
  enableGlobalFilter: false,
  enableGrouping: false,
  enableHiding: false,
  enableResizing: false,
  enableSorting: false,
} as const;

export const useMRT_TableOptions: <TData extends MRT_RowData>(
  tableOptions: MRT_TableOptions<TData>,
) => MRT_DefinedTableOptions<TData> = <TData extends MRT_RowData>({
  aggregationFns: aggregationFnsProp,
  autoResetExpanded = false,
  columnFilterDisplayMode = 'subheader',
  columnResizeDirection: columnResizeDirectionProp,
  columnResizeMode = 'onChange',
  createDisplayMode = 'modal',
  defaultColumn: defaultColumnProp,
  defaultDisplayColumn: defaultDisplayColumnProp,
  editDisplayMode = 'modal',
  enableBatchRowSelection = true,
  enableBottomToolbar = true,
  enableColumnActions = true,
  enableColumnFilters = true,
  enableColumnOrdering = false,
  enableColumnPinning = false,
  enableColumnResizing = false,
  enableColumnVirtualization: enableColumnVirtualizationProp,
  enableDensityToggle = true,
  enableExpandAll = true,
  enableExpanding,
  enableFacetedValues = false,
  enableFilterMatchHighlighting = true,
  enableFilters = true,
  enableFullScreenToggle = true,
  enableGlobalFilter = true,
  enableGlobalFilterRankedResults = true,
  enableGrouping = false,
  enableHiding = true,
  enableKeyboardShortcuts = true,
  enableMultiRowSelection = true,
  enableMultiSort = true,
  enablePagination = true,
  enableRowPinning = false,
  enableRowSelection = false,
  enableRowVirtualization: enableRowVirtualizationProp,
  enableSelectAll = true,
  enableSorting = true,
  enableStickyHeader: enableStickyHeaderProp = false,
  enableTableFooter = true,
  enableTableHead = true,
  enableToolbarInternalActions = true,
  enableTopToolbar = true,
  filterFns: filterFnsProp,
  icons: iconsProp,
  id: idProp,
  layoutMode: layoutModeProp,
  localization: localizationProp,
  manualFiltering: manualFilteringProp,
  manualGrouping: manualGroupingProp,
  manualPagination: manualPaginationProp,
  manualSorting: manualSortingProp,
  mrtTheme: mrtThemeProp,
  paginationDisplayMode = 'default',
  positionActionsColumn = 'first',
  positionCreatingRow = 'top',
  positionExpandColumn = 'first',
  positionGlobalFilter = 'right',
  positionPagination = 'bottom',
  positionToolbarAlertBanner = 'top',
  positionToolbarDropZone = 'top',
  rowNumberDisplayMode = 'static',
  rowPinningDisplayMode = 'sticky',
  selectAllMode = 'page',
  sortFns: sortFnsProp,
  ...rest
}: MRT_TableOptions<TData>) => {
  const theme = useTheme();
  const generatedId = useId();
  const id = idProp ?? generatedId;

  //React Compiler doesn't yet support reassigning a destructured parameter directly (hits a
  //"Support destructuring of context variables" Todo internally) - every option that needs
  //further resolution below is destructured under a `...Prop` name instead, then resolved into
  //a plain local const/let, so the compiler can actually optimize this hook.
  const icons = { ...MRT_Default_Icons, ...iconsProp };
  const localization = { ...MRT_Localization_EN, ...localizationProp };
  const mrtTheme = getMRTTheme(mrtThemeProp, theme);
  const aggregationFns = { ...MRT_AggregationFns, ...aggregationFnsProp };
  const filterFns = { ...MRT_FilterFns, ...filterFnsProp };
  const sortFns = { ...MRT_SortFns, ...sortFnsProp };
  const defaultColumn = { ...MRT_DefaultColumn, ...defaultColumnProp };
  const defaultDisplayColumn = {
    ...MRT_DefaultDisplayColumn,
    ...defaultDisplayColumnProp,
  };
  //cannot be changed after initialization - useState's lazy initializer only ever runs once
  //(on mount), so this stays frozen even if a consumer's enableColumnVirtualization/
  //enableRowVirtualization option changes on a later render
  const [{ enableColumnVirtualization, enableRowVirtualization }] = useState(
    () => ({
      enableColumnVirtualization: enableColumnVirtualizationProp,
      enableRowVirtualization: enableRowVirtualizationProp,
    }),
  );

  const columnResizeDirection =
    columnResizeDirectionProp || theme.direction || 'ltr';

  let layoutMode =
    layoutModeProp || (enableColumnResizing ? 'grid-no-grow' : 'semantic');
  if (
    layoutMode === 'semantic' &&
    (enableRowVirtualization || enableColumnVirtualization)
  ) {
    layoutMode = 'grid';
  }

  const enableStickyHeader = enableRowVirtualization
    ? true
    : enableStickyHeaderProp;

  let manualPagination = manualPaginationProp;
  if (enablePagination === false && manualPagination === undefined) {
    manualPagination = true;
  }

  let manualFiltering = manualFilteringProp;
  let manualGrouping = manualGroupingProp;
  let manualSorting = manualSortingProp;
  if (!rest.data?.length) {
    manualFiltering = true;
    manualGrouping = true;
    manualPagination = true;
    manualSorting = true;
  }

  return {
    aggregationFns,
    autoResetExpanded,
    columnFilterDisplayMode,
    columnResizeDirection,
    columnResizeMode,
    createDisplayMode,
    defaultColumn,
    defaultDisplayColumn,
    editDisplayMode,
    enableBatchRowSelection,
    enableBottomToolbar,
    enableColumnActions,
    enableColumnFilters,
    enableColumnOrdering,
    enableColumnPinning,
    enableColumnResizing,
    enableColumnVirtualization,
    enableDensityToggle,
    enableExpandAll,
    enableExpanding,
    enableFacetedValues,
    enableFilterMatchHighlighting,
    enableFilters,
    enableFullScreenToggle,
    enableGlobalFilter,
    enableGlobalFilterRankedResults,
    enableGrouping,
    enableHiding,
    enableKeyboardShortcuts,
    enableMultiRowSelection,
    enableMultiSort,
    enablePagination,
    enableRowPinning,
    enableRowSelection,
    enableRowVirtualization,
    enableSelectAll,
    enableSorting,
    enableStickyHeader,
    enableTableFooter,
    enableTableHead,
    enableToolbarInternalActions,
    enableTopToolbar,
    filterFns,
    //without this, row.toggleExpanded()/getCanExpand() only ever recognize hierarchical rows
    //(subRows.length) - table-core's row_getCanExpand has no notion of renderDetailPanel, so a
    //flat table using ONLY renderDetailPanel (no subRows) renders an enabled-looking Expand
    //button (MRT_ExpandButton.tsx's own `disabled` calc already accounts for detailPanel) whose
    //click silently no-ops, because row_toggleExpanded's own `!row_getCanExpand(row)` guard
    //(rowExpandingFeature.utils.js) still says false. Consumer-provided getRowCanExpand always
    //wins (spread via ...rest below, after this).
    getRowCanExpand:
      rest.getRowCanExpand ??
      ((row) =>
        (enableExpanding ?? true) &&
        (!!rest.renderDetailPanel || !!row.subRows?.length)),
    getSubRows: (row) => row?.subRows,
    icons,
    id,
    layoutMode,
    localization,
    manualFiltering,
    manualGrouping,
    manualPagination,
    manualSorting,
    mrtTheme,
    paginationDisplayMode,
    positionActionsColumn,
    positionCreatingRow,
    positionExpandColumn,
    positionGlobalFilter,
    positionPagination,
    positionToolbarAlertBanner,
    positionToolbarDropZone,
    rowNumberDisplayMode,
    rowPinningDisplayMode,
    selectAllMode,
    sortFns,
    ...rest,
  } as MRT_DefinedTableOptions<TData>;
};
