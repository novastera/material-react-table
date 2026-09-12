import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Box from '@mui/material/Box';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem, { type MenuItemProps } from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useSelector } from '@tanstack/react-store';

import {
  type MRT_Column,
  type MRT_RowData,
  type MRT_TableInstance,
} from '../../types';
import { getCommonTooltipProps } from '../../utils/style.utils';
import { MRT_ColumnPinningButtons } from '../buttons/MRT_ColumnPinningButtons';
import { MRT_GrabHandleButton } from '../buttons/MRT_GrabHandleButton';

export interface MRT_ShowHideColumnsMenuItemsProps<TData extends MRT_RowData>
  extends MenuItemProps {
  allColumns: MRT_Column<TData>[];
  column: MRT_Column<TData>;
  draggingColumn: MRT_Column<TData> | null;
  hoveredColumn: MRT_Column<TData> | null;
  isNestedColumns: boolean;
  table: MRT_TableInstance<TData>;
}

export const MRT_ShowHideColumnsMenuItems = <TData extends MRT_RowData>({
  allColumns,
  column,
  draggingColumn,
  hoveredColumn,
  isNestedColumns,
  table,
  ...rest
}: MRT_ShowHideColumnsMenuItemsProps<TData>) => {
  const {
    options: {
      enableColumnOrdering,
      enableColumnPinning,
      enableHiding,
      localization,
      mrtTheme: { draggingBorderColor },
    },
  } = table;
  const { columnDef } = column;
  const { columnDefType } = columnDef;
  //not read directly - column.getIsVisible() below reads this live.
  useSelector(table.atoms.columnVisibility);

  const switchChecked = column.getIsVisible();

  const handleToggleColumnHidden = (column: MRT_Column<TData>) => {
    if (columnDefType === 'group') {
      column?.columns?.forEach?.((childColumn: MRT_Column<TData>) => {
        childColumn.toggleVisibility(!switchChecked);
      });
    } else {
      column.toggleVisibility();
    }
  };

  const isDragging = draggingColumn?.id === column.id;

  //this menu item is the dnd-kit sortable item (its own self-contained context - see
  //MRT_ShowHideColumnsMenu.tsx, independent of the table's own useMRT_DragAndDrop.ts). Disabled
  //for group headers/nested-column mode/no-ordering, matching the conditions that used to gate
  //whether this item even rendered a grab handle - not gated on this specific column's own
  //enableColumnOrdering, since a column that can't itself be dragged can still be a valid drop
  //target for other columns (checked separately in the parent's handleDragOver).
  const { attributes, listeners, setActivatorNodeRef, setNodeRef, transform, transition } =
    useSortable({
      data: { column },
      disabled:
        isNestedColumns || columnDefType === 'group' || !enableColumnOrdering,
      id: column.id,
    });

  if (!columnDef.header || columnDef.visibleInShowHideMenu === false) {
    return null;
  }

  return (
    <>
      <MenuItem
        disableRipple
        ref={setNodeRef}
        {...rest}
        style={{
          //see MRT_TableBodyRow.tsx's identical comment - useSortable() only computes the
          //drag-shift transform/transition, it doesn't apply them.
          transform: transform ? CSS.Transform.toString(transform) : undefined,
          transition,
          ...rest?.style,
        }}
        sx={[
          (theme) => ({
            alignItems: 'center',
            justifyContent: 'flex-start',
            my: 0,
            opacity: isDragging ? 0.5 : 1,
            outline: isDragging
              ? `2px dashed ${theme.palette.grey[500]}`
              : hoveredColumn?.id === column.id
                ? `2px dashed ${draggingBorderColor}`
                : 'none',
            outlineOffset: '-2px',
            pl: `${(column.depth + 0.5) * 2}rem`,
            py: '6px',
          }),
          ...(Array.isArray(rest?.sx) ? rest.sx : [rest?.sx]),
        ]}
      >
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'nowrap',
            gap: '8px',
          }}
        >
          {columnDefType !== 'group' &&
            enableColumnOrdering &&
            !isNestedColumns &&
            (columnDef.enableColumnOrdering !== false ? (
              <MRT_GrabHandleButton
                activatorRef={setActivatorNodeRef}
                attributes={attributes}
                listeners={listeners}
                table={table}
              />
            ) : (
              <Box sx={{ width: '28px' }} />
            ))}
          {enableColumnPinning &&
            (column.getCanPin() ? (
              <MRT_ColumnPinningButtons column={column} table={table} />
            ) : (
              <Box sx={{ width: '70px' }} />
            ))}
          {enableHiding ? (
            <FormControlLabel
              checked={switchChecked}
              control={
                <Tooltip
                  {...getCommonTooltipProps()}
                  title={localization.toggleVisibility}
                >
                  <Switch />
                </Tooltip>
              }
              disabled={!column.getCanHide()}
              label={columnDef.header}
              onChange={() => handleToggleColumnHidden(column)}
              slotProps={{
                typography: {
                  sx: {
                    mb: 0,
                    opacity: columnDefType !== 'display' ? 1 : 0.5,
                  },
                },
              }}
            />
          ) : (
            <Typography sx={{ alignSelf: 'center' }}>
              {columnDef.header}
            </Typography>
          )}
        </Box>
      </MenuItem>
      {column.columns?.map((c: MRT_Column<TData>, i) => (
        <MRT_ShowHideColumnsMenuItems
          allColumns={allColumns}
          column={c}
          draggingColumn={draggingColumn}
          hoveredColumn={hoveredColumn}
          isNestedColumns={isNestedColumns}
          key={`${i}-${c.id}`}
          table={table}
        />
      ))}
    </>
  );
};
