import {
  type DraggableAttributes,
  type DraggableSyntheticListeners,
} from '@dnd-kit/core';
import { type IconButtonProps } from '@mui/material/IconButton';
import { type Ref } from 'react';

import {
  type MRT_Row,
  type MRT_RowData,
  type MRT_TableInstance,
} from '../../types';
import { parseFromValuesOrFunc } from '../../utils/utils';
import { MRT_GrabHandleButton } from '../buttons/MRT_GrabHandleButton';

export interface MRT_TableBodyRowGrabHandleProps<TData extends MRT_RowData>
  extends IconButtonProps {
  activatorRef?: Ref<HTMLButtonElement>;
  attributes?: DraggableAttributes;
  listeners?: DraggableSyntheticListeners;
  row: MRT_Row<TData>;
  table: MRT_TableInstance<TData>;
}

//dnd-kit's useSortable() is called by the sortable item itself (MRT_TableBodyRow.tsx, the row) -
//this component is just the drag activator, receiving that hook's listeners/attributes/
//activatorRef as props, matching MRT_TableHeadCellGrabHandle.tsx's same pattern.
export const MRT_TableBodyRowGrabHandle = <TData extends MRT_RowData>({
  activatorRef,
  attributes,
  listeners,
  row,
  table,
  ...rest
}: MRT_TableBodyRowGrabHandleProps<TData>) => {
  const {
    options: { muiRowDragHandleProps },
  } = table;

  //onDragStart/onDragEnd aren't forwarded here - useMRT_DragAndDrop.ts already resolves and
  //calls these same muiRowDragHandleProps callbacks once per drag, at the DndContext level
  //(this is also the row-reorder commit point consumers use, per muiRowDragHandleProps.onDragEnd -
  //see useMRT_DragAndDrop.ts).
  const {
    onDragEnd: _onDragEnd,
    onDragStart: _onDragStart,
    ...iconButtonProps
  } = {
    ...parseFromValuesOrFunc(muiRowDragHandleProps, {
      row,
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
      location="row"
      table={table}
    />
  );
};
