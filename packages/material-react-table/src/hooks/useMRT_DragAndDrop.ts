import {
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  KeyboardSensor,
  type Modifier,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';

import {
  type MRT_Column,
  type MRT_Row,
  type MRT_RowData,
  type MRT_TableInstance,
} from '../types';
import { commitColumnReorder } from '../utils/column.utils';
import { parseFromValuesOrFunc } from '../utils/utils';

type MRT_DragData<TData extends MRT_RowData> =
  | { column: MRT_Column<TData>; type: 'column' }
  | { row: MRT_Row<TData>; type: 'row' };

//Single DndContext (wired up in MRT_TablePaper.tsx) drives BOTH column and row drag-and-drop,
//plus the toolbar drop-zone - discriminated at runtime by each dragged item's own `data.current`
//(set by the useSortable() call that registers it, in MRT_TableHeadCell.tsx/MRT_TableBodyRow.tsx).
//One shared context is required, not just convenient: RowOrdering.stories.tsx's
//`RowAndColumnOrdering` story has both drag types enabled on the same table at once.
//
//This hook intentionally never calls useSelector on any of the atoms it reads
//(draggingColumn/hoveredColumn/columnOrder) - they're only needed inside the imperative
//onDragStart/onDragOver/onDragEnd callbacks dnd-kit invokes, as a snapshot at the moment each
//event fires, not to re-render whenever they change. Reading them via table.atoms.<key>.get()
//instead of useSelector keeps MRT_TablePaper.tsx - which wraps the entire table - from
//re-rendering on every dragover, matching the same "table loads once, changes only on user
//action" principle the useMRT_TableInstance.ts redesign and the virtualizer isolation both
//already apply.
export const useMRT_DragAndDrop = <TData extends MRT_RowData>(
  table: MRT_TableInstance<TData>,
) => {
  const {
    options: {
      enableColumnOrdering,
      enableRowOrdering,
      muiColumnDragHandleProps,
      muiRowDragHandleProps,
    },
    setDraggingColumn,
    setDraggingRow,
    setHoveredColumn,
    setHoveredRow,
  } = table;

  //without an explicit coordinateGetter, KeyboardSensor moves the virtual cursor by a small fixed
  //pixel delta per arrow press - not enough to cross into an adjacent column/row's collision zone
  //for anything wider/taller than that delta. @dnd-kit/sortable's sortableKeyboardCoordinates
  //instead jumps to the next/previous registered sortable item's actual measured position, which
  //is what makes arrow-key reordering actually work (and is what makes this a real, usable
  //accessibility feature rather than one that merely satisfies the letter of "responds to a key").
  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  //Rows only ever reorder among themselves (vertically) - dnd-kit/modifiers' constant
  //restrictToVerticalAxis would do here, but since one context also handles column drags, this
  //small custom modifier picks the axis per-drag by checking data.current.type instead of adding
  //a whole extra dependency for what's otherwise a one-line constant.
  //
  //Columns deliberately do NOT get restrictToHorizontalAxis, unlike TanStack's own official
  //Column DnD example: that example only supports reordering, but MRT's column drag also targets
  //the toolbar drop-zone ABOVE the header row (drag up to group by that column) - locking Y
  //movement to 0 would make the dragged header physically unable to ever reach it.
  const restrictToDragAxis: Modifier = ({ active, transform }) => {
    const type = (active?.data.current as MRT_DragData<TData> | undefined)
      ?.type;
    if (type === 'row') return { ...transform, x: 0 };
    return transform;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as MRT_DragData<TData> | undefined;
    if (data?.type === 'column') setDraggingColumn(data.column);
    else if (data?.type === 'row') setDraggingRow(data.row);
  };

  //Replaces MRT_TableHeadCell.tsx's/MRT_TableBodyCell.tsx's/MRT_ToolbarDropZone.tsx's
  //previously-duplicated handleDragEnter logic with one handler.
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    const activeData = active.data.current as MRT_DragData<TData> | undefined;

    if (!over) {
      if (activeData?.type === 'column') setHoveredColumn(null);
      else if (activeData?.type === 'row') setHoveredRow(null);
      return;
    }

    if (over.id === 'drop-zone') {
      setHoveredColumn({ id: 'drop-zone' });
      return;
    }

    if (activeData?.type === 'column') {
      const overData = over.data.current as MRT_DragData<TData> | undefined;
      const targetColumn =
        overData?.type === 'column' ? overData.column : undefined;
      setHoveredColumn(
        enableColumnOrdering &&
          targetColumn &&
          targetColumn.columnDef.columnDefType !== 'group' &&
          targetColumn.columnDef.enableColumnOrdering !== false
          ? targetColumn
          : null,
      );
    } else if (activeData?.type === 'row') {
      const overData = over.data.current as MRT_DragData<TData> | undefined;
      const targetRow = overData?.type === 'row' ? overData.row : undefined;
      setHoveredRow(enableRowOrdering && targetRow ? targetRow : null);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active } = event;
    const activeData = active.data.current as MRT_DragData<TData> | undefined;

    if (activeData?.type === 'column') {
      const { column } = activeData;
      const iconButtonProps = {
        ...parseFromValuesOrFunc(muiColumnDragHandleProps, { column, table }),
        ...parseFromValuesOrFunc(column.columnDef.muiColumnDragHandleProps, {
          column,
          table,
        }),
      };
      iconButtonProps?.onDragEnd?.(event);

      const draggingColumn = table.atoms.draggingColumn.get();
      const hoveredColumn = table.atoms.hoveredColumn.get();
      if (hoveredColumn?.id === 'drop-zone') {
        column.toggleGrouping();
      } else if (
        enableColumnOrdering &&
        hoveredColumn &&
        hoveredColumn.id !== draggingColumn?.id
      ) {
        commitColumnReorder(table, column, hoveredColumn as MRT_Column<TData>);
      }
      setDraggingColumn(null);
      setHoveredColumn(null);
    } else if (activeData?.type === 'row') {
      const { row } = activeData;
      //this is the row-reorder commit point: MRT tracks draggingRow/hoveredRow but never splices
      //data itself (see useMRT_TableInstance.ts's docs) - every consumer commits their own reorder
      //inside this same onDragEnd, reading table.getState().draggingRow/hoveredRow.
      const iconButtonProps = parseFromValuesOrFunc(muiRowDragHandleProps, {
        row,
        table,
      });
      iconButtonProps?.onDragEnd?.(event);
      setDraggingRow(null);
      setHoveredRow(null);
    }
  };

  return {
    handleDragEnd,
    handleDragOver,
    handleDragStart,
    modifiers: [restrictToDragAxis],
    sensors,
  };
};
