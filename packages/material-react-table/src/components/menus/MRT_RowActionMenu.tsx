import Menu, { type MenuProps } from '@mui/material/Menu';
import { useSelector } from '@tanstack/react-store';
import { type MouseEvent, type ReactNode } from 'react';

import {
  type MRT_Row,
  type MRT_RowData,
  type MRT_TableInstance,
} from '../../types';
import { parseFromValuesOrFunc } from '../../utils/utils';
import { MRT_ActionMenuItem } from './MRT_ActionMenuItem';

export interface MRT_RowActionMenuProps<TData extends MRT_RowData>
  extends Partial<MenuProps> {
  anchorEl: HTMLElement | null;
  handleEdit: (event: MouseEvent) => void;
  row: MRT_Row<TData>;
  setAnchorEl: (anchorEl: HTMLElement | null) => void;
  staticRowIndex?: number;
  table: MRT_TableInstance<TData>;
}

export const MRT_RowActionMenu = <TData extends MRT_RowData>({
  anchorEl,
  handleEdit,
  row,
  setAnchorEl,
  staticRowIndex,
  table,
  ...rest
}: MRT_RowActionMenuProps<TData>) => {
  const {
    options: {
      editDisplayMode,
      enableEditing,
      icons: { EditIcon },
      localization,
      mrtTheme: { menuBackgroundColor },
      renderRowActionMenuItems,
    },
  } = table;
  const density = useSelector(table.atoms.density);

  //plain computed value (not useMemo) - the previous manual dependency array didn't match what
  //this actually reads (enableEditing, editDisplayMode, EditIcon, localization.edit, handleEdit,
  //setAnchorEl were used but not listed), which made React Compiler refuse to compile this
  //component at all (category PreserveManualMemo) rather than risk a stale value. Letting the
  //compiler infer the real dependencies itself is both correct and simpler.
  const menuItems = (() => {
    const items: ReactNode[] = [];
    const editItem = parseFromValuesOrFunc(enableEditing, row) &&
      ['modal', 'row'].includes(editDisplayMode!) && (
        <MRT_ActionMenuItem
          icon={<EditIcon />}
          key={'edit'}
          label={localization.edit}
          onClick={handleEdit}
          table={table}
        />
      );
    if (editItem) items.push(editItem);
    const rowActionMenuItems = renderRowActionMenuItems?.({
      closeMenu: () => setAnchorEl(null),
      row,
      staticRowIndex,
      table,
    });
    if (rowActionMenuItems?.length) items.push(...rowActionMenuItems);
    return items;
  })();

  if (!menuItems.length) return null;

  return (
    <Menu
      anchorEl={anchorEl}
      disableScrollLock
      onClick={(event) => event.stopPropagation()}
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
      {menuItems}
    </Menu>
  );
};
