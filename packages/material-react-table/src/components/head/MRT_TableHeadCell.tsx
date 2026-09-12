import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';
import TableCell, { type TableCellProps } from '@mui/material/TableCell';
import { useSelector } from '@tanstack/react-store';

import { useMRT_HeaderContext } from '../../hooks/useMRT_AppTable';
import {
  type MRT_ColumnVirtualizer,
  type MRT_RowData,
  type MRT_TableInstance,
} from '../../types';
import { cellKeyboardShortcuts } from '../../utils/cell.utils';
import { getCommonMRTCellStyles } from '../../utils/style.utils';
import { parseFromValuesOrFunc, setRefMapEntry } from '../../utils/utils';
import { MRT_TableHeadCellColumnActionsButton } from './MRT_TableHeadCellColumnActionsButton';
import { MRT_TableHeadCellFilterContainer } from './MRT_TableHeadCellFilterContainer';
import { MRT_TableHeadCellFilterLabel } from './MRT_TableHeadCellFilterLabel';
import { MRT_TableHeadCellGrabHandle } from './MRT_TableHeadCellGrabHandle';
import { MRT_TableHeadCellResizeHandle } from './MRT_TableHeadCellResizeHandle';
import { MRT_TableHeadCellSortLabel } from './MRT_TableHeadCellSortLabel';

export interface MRT_TableHeadCellProps extends TableCellProps {
  columnVirtualizer?: MRT_ColumnVirtualizer;
  staticColumnIndex?: number;
}

//header/table are read from context (see the table.AppHeader wrapper in MRT_TableHeadRow.tsx's
//header-mapping loop) rather than received as props - draggingColumn/hoveredColumn/columnResizing
//(simple, safe "is this the one" checks with no cross-column interdependence) are now subscribed,
//narrowed by column.id, at that same wrapper boundary instead. columnPinning/grouping/sorting stay
//bare for now - each has cross-column interdependence (sticky-offset chains, multi-sort priority
//display, drag-handle visibility depending on OTHER columns' grouping) that needs more careful
//per-atom verification before narrowing safely - see migration-render.md §13's follow-up.
export const MRT_TableHeadCell = <TData extends MRT_RowData>({
  columnVirtualizer,
  staticColumnIndex,
  ...rest
}: MRT_TableHeadCellProps) => {
  const theme = useTheme();
  const header = useMRT_HeaderContext<TData>();
  //cast needed - MRT_Header's own `.table` field wasn't redeclared to point at MRT_TableInstance,
  //same type-vs-runtime gap as MRT_TableBodyCell.tsx's cell.table cast.
  const table = header.table as unknown as MRT_TableInstance<TData>;
  const {
    options: {
      columnFilterDisplayMode,
      columnResizeDirection,
      columnResizeMode,
      enableColumnActions,
      enableColumnDragging,
      enableColumnOrdering,
      enableColumnPinning,
      enableGrouping,
      enableKeyboardShortcuts,
      enableMultiSort,
      layoutMode,
      mrtTheme: { draggingBorderColor },
      muiTableHeadCellProps,
    },
    refs: { tableHeadCellRefs },
  } = table;
  //not read directly - getCommonMRTCellStyles below reads column.getIsPinned() (backed by this
  //atom) for its sticky-positioning/opacity calculation, a plain utility function that can't
  //subscribe itself - this component needs the subscription instead.
  useSelector(table.atoms.columnPinning);
  const density = useSelector(table.atoms.density);
  const grouping = useSelector(table.atoms.grouping);
  const showColumnFilters = useSelector(table.atoms.showColumnFilters);
  //not read directly - column.getIsSorted() below (aria-sort/data-sort) reads this live.
  useSelector(table.atoms.sorting);
  //column-keyed atoms - no longer subscribed here (see file comment above); the wrapping
  //table.AppHeader already re-renders this component when any of these become/stop being
  //relevant to THIS column, so a plain live read is correct and sufficient once re-rendered.
  const { columnResizing, draggingColumn, hoveredColumn } = table.getState();
  const { column } = header;
  const { columnDef } = column;
  const { columnDefType } = columnDef;

  const tableCellProps = {
    ...parseFromValuesOrFunc(muiTableHeadCellProps, { column, table }),
    ...parseFromValuesOrFunc(columnDef.muiTableHeadCellProps, {
      column,
      table,
    }),
    ...rest,
  };

  const isColumnPinned =
    enableColumnPinning &&
    columnDef.columnDefType !== 'group' &&
    column.getIsPinned();

  const showColumnActions =
    (enableColumnActions || columnDef.enableColumnActions) &&
    columnDef.enableColumnActions !== false;

  const showDragHandle =
    enableColumnDragging !== false &&
    columnDef.enableColumnDragging !== false &&
    (enableColumnDragging ||
      (enableColumnOrdering && columnDef.enableColumnOrdering !== false) ||
      (enableGrouping &&
        columnDef.enableGrouping !== false &&
        !grouping.includes(column.id)));

  let headerPL = 0;
  if (column.getCanSort()) headerPL += 1;
  if (showColumnActions) headerPL += 1.75;
  if (showDragHandle) headerPL += 1.5;

  const draggingBorders = (() => {
    const showResizeBorder =
      columnResizing.isResizingColumn === column.id &&
      columnResizeMode === 'onChange' &&
      !header.subHeaders.length;

    const borderStyle = showResizeBorder
      ? `2px solid ${draggingBorderColor} !important`
      : draggingColumn?.id === column.id
        ? `1px dashed ${theme.palette.grey[500]}`
        : hoveredColumn?.id === column.id
          ? `2px dashed ${draggingBorderColor}`
          : undefined;

    if (showResizeBorder) {
      return columnResizeDirection === 'ltr'
        ? { borderRight: borderStyle }
        : { borderLeft: borderStyle };
    }

    return borderStyle
      ? {
          borderLeft: borderStyle,
          borderRight: borderStyle,
          borderTop: borderStyle,
        }
      : undefined;
  })();

  //the header cell is the actual dnd-kit sortable item for column drag-and-drop - see
  //useMRT_DragAndDrop.ts for the shared DndContext this participates in. Only disabled for
  //group-type headers (spanning multiple sub-columns, never a valid drag source or drop target -
  //matching this file's previous handleDragEnter check). Not gated on showDragHandle/
  //enableColumnOrdering here: a column with no grab handle of its own (showDragHandle false) or
  //that opted out of ordering can still be a legitimate drop target/insertion point for OTHER
  //columns - useMRT_DragAndDrop.ts's onDragOver is what decides target-acceptance per column, not
  //this registration. Always called unconditionally (Rules of Hooks).
  const { attributes, listeners, setActivatorNodeRef, setNodeRef, transform, transition } =
    useSortable({
      data: { column, type: 'column' },
      disabled: columnDefType === 'group',
      id: column.id,
    });

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTableCellElement>) => {
    tableCellProps?.onKeyDown?.(event);
    cellKeyboardShortcuts({
      cellValue: header.column.columnDef.header,
      event,
      header,
      table,
    });
  };

  const handleRef = (node: HTMLTableCellElement | null) => {
    setNodeRef(node);
    if (node) {
      setRefMapEntry(tableHeadCellRefs, column.id, node);
      if (columnDefType !== 'group') {
        columnVirtualizer?.measureElement?.(node);
      }
    }
  };

  const HeaderElement =
    parseFromValuesOrFunc(columnDef.Header, {
      column,
      header,
      table,
    }) ?? columnDef.header;

  return (
    <TableCell
      align={
        columnDefType === 'group'
          ? 'center'
          : theme.direction === 'rtl'
            ? 'right'
            : 'left'
      }
      aria-sort={
        column.getIsSorted()
          ? column.getIsSorted() === 'asc'
            ? 'ascending'
            : 'descending'
          : 'none'
      }
      colSpan={header.colSpan}
      data-can-sort={column.getCanSort() || undefined}
      data-index={staticColumnIndex}
      data-pinned={!!isColumnPinned || undefined}
      data-sort={column.getIsSorted() || undefined}
      ref={handleRef}
      tabIndex={enableKeyboardShortcuts ? 0 : undefined}
      {...tableCellProps}
      onKeyDown={handleKeyDown}
      style={{
        //see MRT_TableBodyRow.tsx's identical comment - useSortable() only computes the drag-shift
        //transform/transition, it doesn't apply them; without this the header cell never visually
        //moves during a column drag even though dnd-kit tracks it correctly internally.
        transform: transform ? CSS.Transform.toString(transform) : undefined,
        transition,
        ...tableCellProps?.style,
      }}
      sx={[
        {
          '& :hover': {
            '.MuiButtonBase-root': {
              opacity: 1,
            },
          },
          flexDirection: layoutMode?.startsWith('grid') ? 'column' : undefined,
          fontWeight: 'bold',
          overflow: 'visible',
          p:
            density === 'compact'
              ? '0.5rem'
              : density === 'comfortable'
                ? columnDefType === 'display'
                  ? '0.75rem'
                  : '1rem'
                : columnDefType === 'display'
                  ? '1rem 1.25rem'
                  : '1.5rem',
          pb:
            columnDefType === 'display'
              ? 0
              : showColumnFilters || density === 'compact'
                ? '0.4rem'
                : '0.6rem',
          pt:
            columnDefType === 'group' || density === 'compact'
              ? '0.25rem'
              : density === 'comfortable'
                ? '.75rem'
                : '1.25rem',
          userSelect:
            enableMultiSort && column.getCanSort() ? 'none' : undefined,
          verticalAlign: 'top',
        },
        //spread as separate sx array entries, not object-spread into the object above - see
        //getCommonMRTCellStyles's own comment (MUI's documented sx array-merging behavior; object
        //spread silently drops these into numeric keys the sx engine doesn't recognize).
        ...getCommonMRTCellStyles({
          column,
          header,
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
      {header.isPlaceholder
        ? null
        : (tableCellProps.children ?? (
            <Box
              className="Mui-TableHeadCell-Content"
              sx={{
                alignItems: 'center',
                display: 'flex',
                flexDirection:
                  tableCellProps?.align === 'right' ? 'row-reverse' : 'row',
                justifyContent:
                  columnDefType === 'group' ||
                  tableCellProps?.align === 'center'
                    ? 'center'
                    : column.getCanResize()
                      ? 'space-between'
                      : 'flex-start',
                position: 'relative',
                width: '100%',
              }}
            >
              <Box
                className="Mui-TableHeadCell-Content-Labels"
                onClick={column.getToggleSortingHandler()}
                sx={{
                  alignItems: 'center',
                  cursor:
                    column.getCanSort() && columnDefType !== 'group'
                      ? 'pointer'
                      : undefined,
                  display: 'flex',
                  flexDirection:
                    tableCellProps?.align === 'right' ? 'row-reverse' : 'row',
                  overflow: columnDefType === 'data' ? 'hidden' : undefined,
                  pl:
                    tableCellProps?.align === 'center'
                      ? `${headerPL}rem`
                      : undefined,
                }}
              >
                <Box
                  className="Mui-TableHeadCell-Content-Wrapper"
                  sx={{
                    '&:hover': {
                      textOverflow: 'clip',
                    },
                    minWidth: `${Math.min(columnDef.header?.length ?? 0, 4)}ch`,
                    overflow: columnDefType === 'data' ? 'hidden' : undefined,
                    textOverflow: 'ellipsis',
                    whiteSpace:
                      (columnDef.header?.length ?? 0) < 20
                        ? 'nowrap'
                        : 'normal',
                  }}
                >
                  {HeaderElement}
                </Box>
                {column.getCanFilter() && (
                  <MRT_TableHeadCellFilterLabel header={header} table={table} />
                )}
                {column.getCanSort() && (
                  <MRT_TableHeadCellSortLabel header={header} table={table} />
                )}
              </Box>
              {columnDefType !== 'group' && (
                <Box
                  className="Mui-TableHeadCell-Content-Actions"
                  sx={{
                    whiteSpace: 'nowrap',
                  }}
                >
                  {showDragHandle && (
                    <MRT_TableHeadCellGrabHandle
                      activatorRef={setActivatorNodeRef}
                      attributes={attributes}
                      column={column}
                      listeners={listeners}
                      table={table}
                    />
                  )}
                  {showColumnActions && (
                    <MRT_TableHeadCellColumnActionsButton
                      header={header}
                      table={table}
                    />
                  )}
                </Box>
              )}
              {column.getCanResize() && (
                <MRT_TableHeadCellResizeHandle header={header} table={table} />
              )}
            </Box>
          ))}
      {columnFilterDisplayMode === 'subheader' && column.getCanFilter() && (
        <MRT_TableHeadCellFilterContainer header={header} table={table} />
      )}
    </TableCell>
  );
};
