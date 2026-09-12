import {
  DndContext,
  type DragOverEvent,
  type DragStartEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Menu, { type MenuProps } from '@mui/material/Menu';
import { useSelector } from '@tanstack/react-store';
import { useState } from 'react';

import {
  type MRT_Column,
  type MRT_RowData,
  type MRT_TableInstance,
  type MRT_VisibilityState
} from '../../types';
import { commitColumnReorder } from '../../utils/column.utils';
import { getDefaultColumnOrderIds } from '../../utils/displayColumn.utils';
import { MRT_ShowHideColumnsMenuItems } from './MRT_ShowHideColumnsMenuItems';

export interface MRT_ShowHideColumnsMenuProps<TData extends MRT_RowData>
  extends Partial<MenuProps> {
  anchorEl: HTMLElement | null;
  isSubMenu?: boolean;
  setAnchorEl: (anchorEl: HTMLElement | null) => void;
  table: MRT_TableInstance<TData>;
}

export const MRT_ShowHideColumnsMenu = <TData extends MRT_RowData>({
  anchorEl,
  setAnchorEl,
  table,
  ...rest
}: MRT_ShowHideColumnsMenuProps<TData>) => {
  const {
    getAllColumns,
    getAllLeafColumns,
    getCenterLeafColumns,
    getEndLeafColumns,
    getIsAllColumnsVisible,
    getIsSomeColumnsPinned,
    getIsSomeColumnsVisible,
    getStartLeafColumns,
    initialState,
    options: {
      enableColumnOrdering,
      enableColumnPinning,
      enableHiding,
      localization,
      mrtTheme: { menuBackgroundColor },
    },
  } = table;
  const columnOrder = useSelector(table.atoms.columnOrder);
  const density = useSelector(table.atoms.density);
  //not read directly - getIsSomeColumnsVisible()/getIsAllColumnsVisible() below read this live.
  useSelector(table.atoms.columnVisibility);
  //not read directly - getIsSomeColumnsPinned() below reads this live.
  useSelector(table.atoms.columnPinning);

  const handleToggleAllColumns = (value?: boolean) => {
    const updates =
      getAllLeafColumns()
        .filter((column) => column.columnDef.enableHiding !== false)
        .reduce((acc, column) => {
          acc[column.id] = value ?? !column.getIsVisible()
          return acc;
        }, {} as MRT_VisibilityState);

    table.setColumnVisibility((old) => ({ ...old, ...updates }));
  };

  const allColumns = (() => {
    const columns = getAllColumns();
    if (
      columnOrder.length > 0 &&
      !columns.some((col) => col.columnDef.columnDefType === 'group')
    ) {
      const centerLeafColumns = getCenterLeafColumns();
      return [
        ...getStartLeafColumns(),
        ...Array.from(new Set(columnOrder)).map((colId) =>
          centerLeafColumns.find((col) => col?.id === colId),
        ),
        ...getEndLeafColumns(),
      ].filter(Boolean);
    }
    return columns;
  })() as MRT_Column<TData>[];

  const isNestedColumns = allColumns.some(
    (col) => col.columnDef.columnDefType === 'group',
  );

  const hasColumnOrderChanged =
    columnOrder.length !== initialState.columnOrder.length ||
    !columnOrder.every(
      (column, index) => column === initialState.columnOrder[index],
    );

  const [draggingColumn, setDraggingColumn] =
    useState<MRT_Column<TData> | null>(null);
  const [hoveredColumn, setHoveredColumn] = useState<MRT_Column<TData> | null>(
    null,
  );

  //self-contained dnd-kit context for reordering columns inside this popover - independent of
  //the table's own draggingColumn/hoveredColumn atoms and useMRT_DragAndDrop.ts (confirmed this
  //was already a fully separate local-state implementation before this migration, just using
  //native HTML5 DnD instead of dnd-kit). findColumn resolves dnd-kit's id-only active/over back
  //to a real MRT_Column since allColumns is the single source of truth for what's rendered here.
  const findColumn = (id: string) =>
    allColumns.find((col) => col.id === id) ?? null;

  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    setDraggingColumn(findColumn(String(event.active.id)));
  };

  const handleDragOver = (event: DragOverEvent) => {
    const overColumn = event.over ? findColumn(String(event.over.id)) : null;
    setHoveredColumn(
      overColumn && overColumn.columnDef.enableColumnOrdering !== false
        ? overColumn
        : null,
    );
  };

  const handleDragEnd = () => {
    if (draggingColumn && hoveredColumn) {
      commitColumnReorder(table, draggingColumn, hoveredColumn);
    }
    setDraggingColumn(null);
    setHoveredColumn(null);
  };

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
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          p: '0.5rem',
          pt: 0,
        }}
      >
        {enableHiding && (
          <Button
            disabled={!getIsSomeColumnsVisible()}
            onClick={() => handleToggleAllColumns(false)}
          >
            {localization.hideAll}
          </Button>
        )}
        {enableColumnOrdering && (
          <Button
            disabled={!hasColumnOrderChanged}
            onClick={() =>
              table.setColumnOrder(
                getDefaultColumnOrderIds(table.options, true),
              )
            }
          >
            {localization.resetOrder}
          </Button>
        )}
        {enableColumnPinning && (
          <Button
            disabled={!getIsSomeColumnsPinned()}
            onClick={() => table.resetColumnPinning(true)}
          >
            {localization.unpinAll}
          </Button>
        )}
        {enableHiding && (
          <Button
            disabled={getIsAllColumnsVisible()}
            onClick={() => handleToggleAllColumns(true)}
          >
            {localization.showAll}
          </Button>
        )}
      </Box>
      <Divider />
      <DndContext
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragStart={handleDragStart}
        sensors={sensors}
      >
        <SortableContext
          items={allColumns.map((column) => column.id)}
          strategy={verticalListSortingStrategy}
        >
          {allColumns.map((column, index) => (
            <MRT_ShowHideColumnsMenuItems
              allColumns={allColumns}
              column={column}
              draggingColumn={draggingColumn}
              hoveredColumn={hoveredColumn}
              isNestedColumns={isNestedColumns}
              key={`${index}-${column.id}`}
              table={table}
            />
          ))}
        </SortableContext>
      </DndContext>
    </Menu>
  );
};
