import Menu, { type MenuProps } from '@mui/material/Menu';
import { useSelector } from '@tanstack/react-store';
import { useLayoutEffect, useState } from 'react';

import {
  type MRT_Cell,
  type MRT_RowData,
  type MRT_TableInstance,
} from '../../types';
import { openEditingCell } from '../../utils/cell.utils';
import { parseFromValuesOrFunc } from '../../utils/utils';
import { MRT_ActionMenuItem } from './MRT_ActionMenuItem';

export interface MRT_CellActionMenuProps<TData extends MRT_RowData>
  extends Partial<MenuProps> {
  table: MRT_TableInstance<TData>;
}

export const MRT_CellActionMenu = <TData extends MRT_RowData>({
  table,
  ...rest
}: MRT_CellActionMenuProps<TData>) => {
  const {
    options: {
      editDisplayMode,
      enableClickToCopy,
      enableEditing,
      icons: { ContentCopy, EditIcon },
      localization,
      mrtTheme: { menuBackgroundColor },
      renderCellActionMenuItems,
    },
    refs: { actionCellRef },
  } = table;
  //cast needed because table.atoms.actionCell's static type is the minimal `{ id }` shape (see
  //mrtStateFeature.ts) - at runtime this atom always holds a real MRT_Cell<TData> whenever this
  //menu is actually rendered (it's only mounted while a cell's action menu is open).
  const actionCell = useSelector(table.atoms.actionCell) as MRT_Cell<TData> | null;
  const density = useSelector(table.atoms.density);
  const cell = actionCell!;
  const { row } = cell;
  const { column } = cell;
  const { columnDef } = column;

  //actionCellRef is a plain table-level ref (not React state) so the cell that opened this menu
  //can hand its anchor DOM node off without prop-drilling a setter through the whole cell tree.
  //Reading ref.current directly during render violates Rules of React (React Compiler rejects it
  //outright: "Cannot access refs during render"), so it's synced into local state via
  //useLayoutEffect instead of read inline - this component only mounts while a cell's action menu
  //is open (see MRT_TableContainer.tsx), so the effect fires once per menu-open with the freshest
  //anchor, synchronously before the browser paints (no visible flash of a menu with no anchor).
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    setAnchorEl(actionCellRef.current);
  }, [actionCellRef]);

  const handleClose = (event?: any) => {
    event?.stopPropagation();
    table.setActionCell(null);
  };

  const internalMenuItems = [
    (parseFromValuesOrFunc(enableClickToCopy, cell) === 'context-menu' ||
      parseFromValuesOrFunc(columnDef.enableClickToCopy, cell) ===
        'context-menu') && (
      <MRT_ActionMenuItem
        icon={<ContentCopy />}
        key={'mrt-copy'}
        label={localization.copy}
        onClick={(event) => {
          event.stopPropagation();
          navigator.clipboard.writeText(cell.getValue() as string);
          handleClose();
        }}
        table={table}
      />
    ),
    parseFromValuesOrFunc(enableEditing, row) && editDisplayMode === 'cell' && (
      <MRT_ActionMenuItem
        icon={<EditIcon />}
        key={'mrt-edit'}
        label={localization.edit}
        onClick={() => {
          openEditingCell({ cell, table });
          handleClose();
        }}
        table={table}
      />
    ),
  ].filter(Boolean);

  const renderActionProps = {
    cell,
    closeMenu: handleClose,
    column,
    internalMenuItems,
    row,
    table,
  };

  const menuItems =
    columnDef.renderCellActionMenuItems?.(renderActionProps) ??
    renderCellActionMenuItems?.(renderActionProps);

  return (
    (!!menuItems?.length || !!internalMenuItems?.length) && (
      <Menu
        anchorEl={anchorEl}
        disableScrollLock
        onClick={(event) => event.stopPropagation()}
        onClose={handleClose}
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
        transformOrigin={{ horizontal: -100, vertical: 8 }}
        {...rest}
      >
        {menuItems ?? internalMenuItems}
      </Menu>
    )
  );
};
