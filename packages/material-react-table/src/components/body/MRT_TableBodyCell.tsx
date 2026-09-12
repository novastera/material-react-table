import Skeleton from '@mui/material/Skeleton';
import { useTheme } from '@mui/material/styles';
import TableCell, { type TableCellProps } from '@mui/material/TableCell';
import { useSelector } from '@tanstack/react-store';
import { type MouseEvent, type RefObject } from 'react';

import { useMRT_CellContext } from '../../hooks/useMRT_AppTable';
import {
  type MRT_RowData,
  type MRT_RowDragHandleProps,
  type MRT_TableInstance,
} from '../../types';
import {
  cellKeyboardShortcuts,
  isCellEditable,
  openEditingCell,
} from '../../utils/cell.utils';
import { getCommonMRTCellStyles } from '../../utils/style.utils';
import { parseFromValuesOrFunc } from '../../utils/utils';
import { MRT_CopyButton } from '../buttons/MRT_CopyButton';
import { MRT_EditCellTextField } from '../inputs/MRT_EditCellTextField';
import { MRT_TableBodyCellValue } from './MRT_TableBodyCellValue';

export interface MRT_TableBodyCellProps extends TableCellProps {
  numRows?: number;
  rowDragHandleProps?: MRT_RowDragHandleProps;
  rowRef: RefObject<HTMLTableRowElement | null>;
  staticColumnIndex?: number;
  staticRowIndex: number;
}

//cell/table are read from context (see the MRT_AppCell wrapper in MRT_TableBodyRow.tsx's
//cell-mapping loop) rather than received as props - the cell/column/row-keyed atoms this
//component used to bare-subscribe to directly (actionCell/columnResizing/creatingRow/
//draggingColumn/draggingRow/editingCell/editingRow/hoveredColumn/hoveredRow) are now subscribed,
//narrowed by cell.id/column.id/row.id, at that same wrapper boundary instead
//(migration-render.md §13's resolution) - this cell re-renders only when one of those becomes/
//stops being relevant to IT specifically, not on any cell's. The structural/global atoms below
//(columnPinning/density/grouping/isLoading/showSkeletons) stay as bare subscriptions - narrowing
//wouldn't help them.
export const MRT_TableBodyCell = <TData extends MRT_RowData>({
  numRows,
  rowDragHandleProps,
  rowRef,
  staticColumnIndex,
  staticRowIndex,
  ...rest
}: MRT_TableBodyCellProps) => {
  const theme = useTheme();
  const cell = useMRT_CellContext<TData>();
  //cell.table (not useMRT_TableContext()) - the stable core reference react-compiler.md itself
  //documents (distinct from the wrapper useMRT_TableContext() returns, which additionally carries
  //AppCell/AppRow/AppTable/AppHeader/AppFooter). Safe and preferable here specifically because
  //this component is a leaf - it reads atoms/options/getState/refs but never itself needs to wrap
  //further AppCell/AppRow boundaries, which only exist on the wrapper. Cast needed because
  //MRT_Cell's own `.table` field (unlike `.row`/`.column`) wasn't redeclared to point at
  //MRT_TableInstance - same type-vs-runtime gap as the useMRT_TableInstance.ts `table` cast.
  const table = cell.table as unknown as MRT_TableInstance<TData>;
  const {
    options: {
      columnResizeDirection,
      columnResizeMode,
      createDisplayMode,
      editDisplayMode,
      enableCellActions,
      enableClickToCopy,
      enableColumnPinning,
      enableKeyboardShortcuts,
      layoutMode,
      mrtTheme: { draggingBorderColor },
      muiSkeletonProps,
      muiTableBodyCellProps,
    },
    refs: { actionCellRef },
  } = table;
  //not read directly - getCommonMRTCellStyles below reads column.getIsPinned() (backed by this
  //atom) for its sticky-positioning/opacity calculation, a plain utility function that can't
  //subscribe itself - this component needs the subscription instead.
  useSelector(table.atoms.columnPinning);
  const density = useSelector(table.atoms.density);
  //not read directly - row.getIsGrouped()/cell.getIsGrouped() below read this live.
  useSelector(table.atoms.grouping);
  const isLoading = useSelector(table.atoms.isLoading);
  const showSkeletons = useSelector(table.atoms.showSkeletons);
  //cell/column/row-keyed atoms - no longer subscribed here (see file comment above); the wrapping
  //MRT_AppCell already re-renders this component when any of these become/stop being relevant to
  //THIS cell, so a plain live read is correct and sufficient once re-rendered.
  const {
    actionCell,
    columnResizing,
    creatingRow,
    draggingColumn,
    draggingRow,
    editingCell,
    editingRow,
    hoveredColumn,
    hoveredRow,
  } = table.getState();
  const { column, row } = cell;
  const { columnDef } = column;
  const { columnDefType } = columnDef;

  const args = { cell, column, row, table };
  const tableCellProps = {
    ...parseFromValuesOrFunc(muiTableBodyCellProps, args),
    ...parseFromValuesOrFunc(columnDef.muiTableBodyCellProps, args),
    ...rest,
  };

  const skeletonProps = parseFromValuesOrFunc(muiSkeletonProps, {
    cell,
    column,
    row,
    table,
  });

  //deterministic pseudo-randomness from cell.id (instead of Math.random() in an effect) so
  //skeleton widths still vary per cell, without needing state that persists across renders
  const skeletonWidth = (() => {
    const size = column.getSize();
    if (columnDefType === 'display') return size / 2;
    let hash = 0;
    for (let i = 0; i < cell.id.length; i++) {
      hash = (hash * 31 + cell.id.charCodeAt(i)) | 0;
    }
    const unitInterval = (hash >>> 0) / 0xffffffff;
    return Math.round(unitInterval * (size - size / 3) + size / 3);
  })();

  //plain computed value (not useMemo) - the previous manual dependency array didn't match what
  //this actually reads (column, columnResizeDirection, etc. were used but not listed), which
  //made React Compiler bail out of optimizing this whole component rather than risk a stale
  //value. Letting the compiler infer the real dependencies itself is both correct and simpler.
  const draggingBorders = (() => {
    const isDraggingColumn = draggingColumn?.id === column.id;
    const isHoveredColumn = hoveredColumn?.id === column.id;
    const isDraggingRow = draggingRow?.id === row.id;
    const isHoveredRow = hoveredRow?.id === row.id;
    const isFirstColumn = column.getIsFirstColumn();
    const isLastColumn = column.getIsLastColumn();
    const isLastRow = numRows && staticRowIndex === numRows - 1;
    const isResizingColumn = columnResizing.isResizingColumn === column.id;
    const showResizeBorder =
      isResizingColumn && columnResizeMode === 'onChange';

    const borderStyle = showResizeBorder
      ? `2px solid ${draggingBorderColor} !important`
      : isDraggingColumn || isDraggingRow
        ? `1px dashed ${theme.palette.grey[500]} !important`
        : isHoveredColumn || isHoveredRow || isResizingColumn
          ? `2px dashed ${draggingBorderColor} !important`
          : undefined;

    if (showResizeBorder) {
      return columnResizeDirection === 'ltr'
        ? { borderRight: borderStyle }
        : { borderLeft: borderStyle };
    }

    return borderStyle
      ? {
          borderBottom:
            isDraggingRow || isHoveredRow || (isLastRow && !isResizingColumn)
              ? borderStyle
              : undefined,
          borderLeft:
            isDraggingColumn ||
            isHoveredColumn ||
            ((isDraggingRow || isHoveredRow) && isFirstColumn)
              ? borderStyle
              : undefined,
          borderRight:
            isDraggingColumn ||
            isHoveredColumn ||
            ((isDraggingRow || isHoveredRow) && isLastColumn)
              ? borderStyle
              : undefined,
          borderTop: isDraggingRow || isHoveredRow ? borderStyle : undefined,
        }
      : undefined;
  })();

  const isColumnPinned =
    enableColumnPinning &&
    columnDef.columnDefType !== 'group' &&
    column.getIsPinned();

  const isEditable = isCellEditable({ cell, table });

  const isEditing =
    isEditable &&
    !['custom', 'modal'].includes(editDisplayMode as string) &&
    (editDisplayMode === 'table' ||
      editingRow?.id === row.id ||
      editingCell?.id === cell.id) &&
    !row.getIsGrouped();

  const isCreating =
    isEditable && createDisplayMode === 'row' && creatingRow?.id === row.id;

  const showClickToCopyButton =
    (parseFromValuesOrFunc(enableClickToCopy, cell) === true ||
      parseFromValuesOrFunc(columnDef.enableClickToCopy, cell) === true) &&
    !['context-menu', false].includes(
      // @ts-expect-error
      parseFromValuesOrFunc(columnDef.enableClickToCopy, cell),
    );

  const isRightClickable = parseFromValuesOrFunc(enableCellActions, cell);

  const cellValueProps = {
    cell,
    staticColumnIndex,
    staticRowIndex,
    table,
  };

  const handleDoubleClick = (event: MouseEvent<HTMLTableCellElement>) => {
    tableCellProps?.onDoubleClick?.(event);
    openEditingCell({ cell, table });
  };

  const handleContextMenu = (e: MouseEvent<HTMLTableCellElement>) => {
    tableCellProps?.onContextMenu?.(e);
    if (isRightClickable) {
      e.preventDefault();
      table.setActionCell(cell);
      actionCellRef.current = e.currentTarget;
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTableCellElement>) => {
    tableCellProps?.onKeyDown?.(event);
    cellKeyboardShortcuts({
      cell,
      cellValue: cell.getValue<string>(),
      event,
      table,
    });
  };

  return (
    <TableCell
      align={theme.direction === 'rtl' ? 'right' : 'left'}
      data-index={staticColumnIndex}
      data-pinned={!!isColumnPinned || undefined}
      tabIndex={enableKeyboardShortcuts ? 0 : undefined}
      {...tableCellProps}
      onContextMenu={handleContextMenu}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      sx={[
        (theme) => ({
          '&:hover': {
            outline:
              actionCell?.id === cell.id ||
              (editDisplayMode === 'cell' && isEditable) ||
              (editDisplayMode === 'table' && (isCreating || isEditing))
                ? `1px solid ${theme.palette.grey[500]}`
                : undefined,
            textOverflow: 'clip',
          },
          alignItems: layoutMode?.startsWith('grid') ? 'center' : undefined,
          cursor: isRightClickable
            ? 'context-menu'
            : isEditable && editDisplayMode === 'cell'
              ? 'pointer'
              : 'inherit',
          outline:
            actionCell?.id === cell.id
              ? `1px solid ${theme.palette.grey[500]}`
              : undefined,
          outlineOffset: '-1px',
          overflow: 'hidden',
          p:
            density === 'compact'
              ? columnDefType === 'display'
                ? '0 0.5rem'
                : '0.5rem'
              : density === 'comfortable'
                ? columnDefType === 'display'
                  ? '0.5rem 0.75rem'
                  : '1rem'
                : columnDefType === 'display'
                  ? '1rem 1.25rem'
                  : '1.5rem',

          textOverflow: columnDefType !== 'display' ? 'ellipsis' : undefined,
          whiteSpace:
            row.getIsPinned() || density === 'compact' ? 'nowrap' : 'normal',
        }),
        //spread as separate sx array entries, not object-spread into the callback above - see
        //getCommonMRTCellStyles's own comment (MUI's documented sx array-merging behavior; object
        //spread silently drops these into numeric keys the sx engine doesn't recognize).
        ...getCommonMRTCellStyles({
          column,
          table,
          tableCellProps,
          theme,
        }),
        draggingBorders,
        ...(Array.isArray(tableCellProps.sx)
          ? tableCellProps.sx
          : [tableCellProps.sx]),
      ]}
    >
      {tableCellProps.children ?? (
        <>
          {cell.getIsPlaceholder() ? (
            (columnDef.PlaceholderCell?.({ cell, column, row, table }) ?? null)
          ) : showSkeletons !== false && (isLoading || showSkeletons) ? (
            <Skeleton
              animation="wave"
              height={20}
              width={skeletonWidth}
              {...skeletonProps}
            />
          ) : columnDefType === 'display' &&
            (['mrt-row-expand', 'mrt-row-numbers', 'mrt-row-select'].includes(
              column.id,
            ) ||
              !row.getIsGrouped()) ? (
            columnDef.Cell?.({
              cell,
              column,
              renderedCellValue: cell.renderValue() as any,
              row,
              rowDragHandleProps,
              rowRef,
              staticColumnIndex,
              staticRowIndex,
              table,
            })
          ) : isCreating || isEditing ? (
            <MRT_EditCellTextField cell={cell} table={table} />
          ) : showClickToCopyButton && columnDef.enableClickToCopy !== false ? (
            <MRT_CopyButton cell={cell} table={table}>
              <MRT_TableBodyCellValue {...cellValueProps} />
            </MRT_CopyButton>
          ) : (
            <MRT_TableBodyCellValue {...cellValueProps} />
          )}
          {cell.getIsGrouped() && !columnDef.GroupedCell && (
            <> ({row.subRows?.length})</>
          )}
        </>
      )}
    </TableCell>
  );
};
