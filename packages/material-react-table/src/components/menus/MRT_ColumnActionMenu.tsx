import Menu, { type MenuProps } from '@mui/material/Menu';
import { useSelector } from '@tanstack/react-store';
import { type MouseEvent, useState } from 'react';

import {
  type MRT_ColumnResizingState,
  type MRT_Header,
  type MRT_RowData,
  type MRT_TableInstance,
} from '../../types';
import { MRT_ActionMenuItem } from './MRT_ActionMenuItem';
import { MRT_FilterOptionMenu } from './MRT_FilterOptionMenu';

export interface MRT_ColumnActionMenuProps<TData extends MRT_RowData>
  extends Partial<MenuProps> {
  anchorEl: HTMLElement | null;
  header: MRT_Header<TData>;
  setAnchorEl: (anchorEl: HTMLElement | null) => void;
  table: MRT_TableInstance<TData>;
}

export const MRT_ColumnActionMenu = <TData extends MRT_RowData>({
  anchorEl,
  header,
  setAnchorEl,
  table,
  ...rest
}: MRT_ColumnActionMenuProps<TData>) => {
  const {
    getAllLeafColumns,
    options: {
      columnFilterDisplayMode,
      columnFilterModeOptions,
      enableColumnFilterModes,
      enableColumnFilters,
      enableColumnPinning,
      enableColumnResizing,
      enableGrouping,
      enableHiding,
      enableSorting,
      enableSortingRemoval,
      icons: {
        ClearAllIcon,
        DynamicFeedIcon,
        FilterListIcon,
        FilterListOffIcon,
        PushPinIcon,
        RestartAltIcon,
        SortIcon,
        ViewColumnIcon,
        VisibilityOffIcon,
      },
      localization,
      mrtTheme: { menuBackgroundColor },
      renderColumnActionsMenuItems,
    },
    refs: { filterInputRefs },
    setColumnFilterFns,
    setColumnOrder,
    setColumnResizing,
    setShowColumnFilters,
  } = table;
  const { column } = header;
  const { columnDef } = column;
  const columnSizing = useSelector(table.atoms.columnSizing);
  const columnVisibility = useSelector(table.atoms.columnVisibility);
  const density = useSelector(table.atoms.density);
  const showColumnFilters = useSelector(table.atoms.showColumnFilters);
  //not read directly - column.getIsSorted()/getIsGrouped()/getIsPinned() below read these live.
  useSelector(table.atoms.sorting);
  useSelector(table.atoms.grouping);
  useSelector(table.atoms.columnPinning);
  const columnFilterValue = column.getFilterValue();

  const [filterMenuAnchorEl, setFilterMenuAnchorEl] =
    useState<HTMLElement | null>(null);

  const handleClearSort = () => {
    column.clearSorting();
    setAnchorEl(null);
  };

  const handleSortAsc = () => {
    column.toggleSorting(false);
    setAnchorEl(null);
  };

  const handleSortDesc = () => {
    column.toggleSorting(true);
    setAnchorEl(null);
  };

  const handleResetColumnSize = () => {
    setColumnResizing((old: MRT_ColumnResizingState) => ({
      ...old,
      isResizingColumn: false,
    }));
    column.resetSize();
    setAnchorEl(null);
  };

  const handleHideColumn = () => {
    column.toggleVisibility(false);
    setAnchorEl(null);
  };

  const handlePinColumn = (pinDirection: 'end' | 'start' | false) => {
    column.pin(pinDirection);
    setAnchorEl(null);
  };

  const handleGroupByColumn = () => {
    column.toggleGrouping();
    setColumnOrder((old: any) => ['mrt-row-expand', ...old]);
    setAnchorEl(null);
  };

  const handleClearFilter = () => {
    column.setFilterValue(undefined);
    setAnchorEl(null);
    if (['empty', 'notEmpty'].includes(columnDef._filterFn)) {
      setColumnFilterFns((prev) => ({
        ...prev,
        [header.id]: allowedColumnFilterOptions?.[0] ?? 'fuzzy',
      }));
    }
  };

  const handleFilterByColumn = () => {
    setShowColumnFilters(true);
    queueMicrotask(() => filterInputRefs.current?.[`${column.id}-0`]?.focus());
    setAnchorEl(null);
  };

  const handleShowAllColumns = () => {
    getAllLeafColumns()
      .filter((col) => col.columnDef.enableHiding !== false)
      .forEach((col) => col.toggleVisibility(true));
    setAnchorEl(null);
  };

  const handleOpenFilterModeMenu = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setFilterMenuAnchorEl(event.currentTarget);
  };

  const isSelectFilter = !!columnDef.filterSelectOptions;

  const allowedColumnFilterOptions =
    columnDef?.columnFilterModeOptions ?? columnFilterModeOptions;

  const showFilterModeSubMenu =
    enableColumnFilterModes &&
    columnDef.enableColumnFilterModes !== false &&
    !isSelectFilter &&
    (allowedColumnFilterOptions === undefined ||
      !!allowedColumnFilterOptions?.length);

  const internalColumnMenuItems = [
    ...(enableSorting && column.getCanSort()
      ? [
          enableSortingRemoval !== false && (
            <MRT_ActionMenuItem
              disabled={column.getIsSorted() === false}
              icon={<ClearAllIcon />}
              key={0}
              label={localization.clearSort}
              onClick={handleClearSort}
              table={table}
            />
          ),
          <MRT_ActionMenuItem
            disabled={column.getIsSorted() === 'asc'}
            icon={
              <SortIcon style={{ transform: 'rotate(180deg) scaleX(-1)' }} />
            }
            key={1}
            label={localization.sortByColumnAsc?.replace(
              '{column}',
              String(columnDef.header),
            )}
            onClick={handleSortAsc}
            table={table}
          />,
          <MRT_ActionMenuItem
            disabled={column.getIsSorted() === 'desc'}
            divider={enableColumnFilters || enableGrouping || enableHiding}
            icon={<SortIcon />}
            key={2}
            label={localization.sortByColumnDesc?.replace(
              '{column}',
              String(columnDef.header),
            )}
            onClick={handleSortDesc}
            table={table}
          />,
        ]
      : []),
    ...(enableColumnFilters && column.getCanFilter()
      ? [
          <MRT_ActionMenuItem
            disabled={
              !columnFilterValue ||
              (Array.isArray(columnFilterValue) &&
                !columnFilterValue.filter((value) => value).length)
            }
            icon={<FilterListOffIcon />}
            key={3}
            label={localization.clearFilter}
            onClick={handleClearFilter}
            table={table}
          />,
          columnFilterDisplayMode === 'subheader' && (
            <MRT_ActionMenuItem
              disabled={showColumnFilters && !enableColumnFilterModes}
              divider={enableGrouping || enableHiding}
              icon={<FilterListIcon />}
              key={4}
              label={localization.filterByColumn?.replace(
                '{column}',
                String(columnDef.header),
              )}
              onClick={
                showColumnFilters
                  ? handleOpenFilterModeMenu
                  : handleFilterByColumn
              }
              onOpenSubMenu={
                showFilterModeSubMenu ? handleOpenFilterModeMenu : undefined
              }
              table={table}
            />
          ),
          showFilterModeSubMenu && (
            <MRT_FilterOptionMenu
              anchorEl={filterMenuAnchorEl}
              header={header}
              key={5}
              onSelect={handleFilterByColumn}
              setAnchorEl={setFilterMenuAnchorEl}
              table={table}
            />
          ),
        ].filter(Boolean)
      : []),
    ...(enableGrouping && column.getCanGroup()
      ? [
          <MRT_ActionMenuItem
            divider={enableColumnPinning}
            icon={<DynamicFeedIcon />}
            key={6}
            label={localization[
              column.getIsGrouped() ? 'ungroupByColumn' : 'groupByColumn'
            ]?.replace('{column}', String(columnDef.header))}
            onClick={handleGroupByColumn}
            table={table}
          />,
        ]
      : []),
    ...(enableColumnPinning && column.getCanPin()
      ? [
          <MRT_ActionMenuItem
            disabled={column.getIsPinned() === 'start' || !column.getCanPin()}
            icon={<PushPinIcon style={{ transform: 'rotate(90deg)' }} />}
            key={7}
            label={localization.pinToLeft}
            onClick={() => handlePinColumn('start')}
            table={table}
          />,
          <MRT_ActionMenuItem
            disabled={column.getIsPinned() === 'end' || !column.getCanPin()}
            icon={<PushPinIcon style={{ transform: 'rotate(-90deg)' }} />}
            key={8}
            label={localization.pinToRight}
            onClick={() => handlePinColumn('end')}
            table={table}
          />,
          <MRT_ActionMenuItem
            disabled={!column.getIsPinned()}
            divider={enableHiding}
            icon={<PushPinIcon />}
            key={9}
            label={localization.unpin}
            onClick={() => handlePinColumn(false)}
            table={table}
          />,
        ]
      : []),
    ...(enableColumnResizing && column.getCanResize()
      ? [
          <MRT_ActionMenuItem
            disabled={columnSizing[column.id] === undefined}
            icon={<RestartAltIcon />}
            key={10}
            label={localization.resetColumnSize}
            onClick={handleResetColumnSize}
            table={table}
          />,
        ]
      : []),
    ...(enableHiding
      ? [
          <MRT_ActionMenuItem
            disabled={!column.getCanHide()}
            icon={<VisibilityOffIcon />}
            key={11}
            label={localization.hideColumn?.replace(
              '{column}',
              String(columnDef.header),
            )}
            onClick={handleHideColumn}
            table={table}
          />,
          <MRT_ActionMenuItem
            disabled={
              !Object.values(columnVisibility).filter((visible) => !visible)
                .length
            }
            icon={<ViewColumnIcon />}
            key={12}
            label={localization.showAllColumns?.replace(
              '{column}',
              String(columnDef.header),
            )}
            onClick={handleShowAllColumns}
            table={table}
          />,
        ]
      : []),
  ].filter(Boolean);

  return (
    <Menu
      anchorEl={anchorEl}
      disableScrollLock
      onClose={() => setAnchorEl(null)}
      open={!!anchorEl}
      slotProps={{
        list: {
          dense: density === 'compact',
          sx: {
            backgroundColor: menuBackgroundColor,
          },
          ...rest.slotProps?.list,
        },
        ...rest.slotProps,
      }}
      {...rest}
    >
      {columnDef.renderColumnActionsMenuItems?.({
        closeMenu: () => setAnchorEl(null),
        column,
        internalColumnMenuItems,
        table,
      }) ??
        renderColumnActionsMenuItems?.({
          closeMenu: () => setAnchorEl(null),
          column,
          internalColumnMenuItems,
          table,
        }) ??
        internalColumnMenuItems}
    </Menu>
  );
};
