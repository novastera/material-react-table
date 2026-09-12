import {
  type DraggableAttributes,
  type DraggableSyntheticListeners,
} from '@dnd-kit/core';
import { type IconButtonProps } from '@mui/material/IconButton';
import { type Ref } from 'react';

import {
  type MRT_Column,
  type MRT_RowData,
  type MRT_TableInstance,
} from '../../types';
import { parseFromValuesOrFunc } from '../../utils/utils';
import { MRT_GrabHandleButton } from '../buttons/MRT_GrabHandleButton';

export interface MRT_TableHeadCellGrabHandleProps<TData extends MRT_RowData>
  extends IconButtonProps {
  activatorRef?: Ref<HTMLButtonElement>;
  attributes?: DraggableAttributes;
  column: MRT_Column<TData>;
  listeners?: DraggableSyntheticListeners;
  table: MRT_TableInstance<TData>;
}

//dnd-kit's useSortable() is called by the sortable item itself (MRT_TableHeadCell.tsx, the
//header cell) - this component is just the drag activator (the visible handle), receiving
//that hook's listeners/attributes/activatorRef as props to spread onto the actual button,
//per dnd-kit's documented "separate activator node" pattern.
export const MRT_TableHeadCellGrabHandle = <TData extends MRT_RowData>({
  activatorRef,
  attributes,
  column,
  listeners,
  table,
  ...rest
}: MRT_TableHeadCellGrabHandleProps<TData>) => {
  const {
    options: { muiColumnDragHandleProps },
  } = table;
  const { columnDef } = column;

  //onDragStart/onDragEnd aren't forwarded here - useMRT_DragAndDrop.ts already resolves and
  //calls these same muiColumnDragHandleProps callbacks once per drag, at the DndContext level
  //(the button itself no longer fires any native drag event a per-instance handler could hook).
  const {
    onDragEnd: _onDragEnd,
    onDragStart: _onDragStart,
    ...iconButtonProps
  } = {
    ...parseFromValuesOrFunc(muiColumnDragHandleProps, { column, table }),
    ...parseFromValuesOrFunc(columnDef.muiColumnDragHandleProps, {
      column,
      table,
    }),
    ...rest,
  };

  return (
    <MRT_GrabHandleButton
      {...iconButtonProps}
      activatorRef={activatorRef}
      attributes={attributes}
      listeners={listeners}
      table={table}
    />
  );
};
