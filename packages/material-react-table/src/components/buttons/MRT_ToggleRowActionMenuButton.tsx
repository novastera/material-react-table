import IconButton, { type IconButtonProps } from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { type MouseEvent, useState } from 'react';

import {
  type MRT_Cell,
  type MRT_Row,
  type MRT_RowData,
  type MRT_TableInstance,
} from '../../types';
import { getCommonTooltipProps } from '../../utils/style.utils';
import { parseFromValuesOrFunc } from '../../utils/utils';
import { MRT_RowActionMenu } from '../menus/MRT_RowActionMenu';
import { MRT_EditActionButtons } from './MRT_EditActionButtons';

const commonIconButtonStyles = {
  '&:hover': {
    opacity: 1,
  },
  height: '2rem',
  ml: '10px',
  opacity: 0.5,
  transition: 'opacity 150ms',
  width: '2rem',
};

export interface MRT_ToggleRowActionMenuButtonProps<TData extends MRT_RowData>
  extends IconButtonProps {
  cell: MRT_Cell<TData>;
  row: MRT_Row<TData>;
  staticRowIndex?: number;
  table: MRT_TableInstance<TData>;
}

export const MRT_ToggleRowActionMenuButton = <TData extends MRT_RowData>({
  cell,
  row,
  staticRowIndex,
  table,
  ...rest
}: MRT_ToggleRowActionMenuButtonProps<TData>) => {
  const {
    options: {
      createDisplayMode,
      editDisplayMode,
      enableEditing,
      icons: { EditIcon, MoreHorizIcon },
      localization,
      renderRowActionMenuItems,
      renderRowActions,
    },
    setEditingRow,
  } = table;

  //no bare creatingRow/editingRow subscriptions here - this is always rendered inside the
  //row-actions cell's table.AppCell (see getMRT_RowActionsColumnDef.tsx -> MRT_TableBodyCell.tsx),
  //whose own selector already includes isCreatingRow/isEditingRow narrowed by cell.row.id (same
  //reasoning as MRT_RowPinButton.tsx). A bare subscription would re-fire on any row's
  //create/edit-mode change, not just this row's.
  const { creatingRow, editingRow } = table.getState();

  const isCreating = creatingRow?.id === row.id;
  const isEditing = editingRow?.id === row.id;

  const showEditActionButtons =
    (isCreating && createDisplayMode === 'row') ||
    (isEditing && editDisplayMode === 'row');

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const handleOpenRowActionMenu = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    event.preventDefault();
    setAnchorEl(event.currentTarget);
  };

  const handleStartEditMode = (event: MouseEvent) => {
    event.stopPropagation();
    //not {...row} - row's methods (getAllCells, getVisibleCells, ...) live on a shared prototype
    //(Object.create(rowPrototype), see @tanstack/table-core's constructRow), not as the row's own
    //enumerable properties, so spreading it silently drops every method and leaves a plain data
    //object. MRT_EditRowModal.tsx/MRT_EditCellTextField.tsx call row.getAllCells() on whatever
    //setEditingRow receives, so it must stay a real row reference - matches every other
    //setEditingRow(row) call site (e.g. MRT_EditCellTextField.tsx).
    setEditingRow(row);
    setAnchorEl(null);
  };

  return (
    <>
      {renderRowActions && !showEditActionButtons ? (
        renderRowActions({ cell, row, staticRowIndex, table })
      ) : showEditActionButtons ? (
        <MRT_EditActionButtons row={row} table={table} />
      ) : !renderRowActionMenuItems &&
        parseFromValuesOrFunc(enableEditing, row) &&
        ['modal', 'row'].includes(editDisplayMode!) ? (
        <Tooltip placement="right" title={localization.edit}>
          <IconButton
            aria-label={localization.edit}
            onClick={handleStartEditMode}
            sx={commonIconButtonStyles}
            {...rest}
          >
            <EditIcon />
          </IconButton>
        </Tooltip>
      ) : renderRowActionMenuItems?.({
          row,
          staticRowIndex,
          table,
        } as any)?.length ? (
        <>
          <Tooltip {...getCommonTooltipProps()} title={localization.rowActions}>
            <IconButton
              aria-label={localization.rowActions}
              onClick={handleOpenRowActionMenu}
              size="small"
              sx={commonIconButtonStyles}
              {...rest}
            >
              <MoreHorizIcon />
            </IconButton>
          </Tooltip>
          <MRT_RowActionMenu
            anchorEl={anchorEl}
            handleEdit={handleStartEditMode}
            row={row}
            setAnchorEl={setAnchorEl}
            staticRowIndex={staticRowIndex}
            table={table}
          />
        </>
      ) : null}
    </>
  );
};
