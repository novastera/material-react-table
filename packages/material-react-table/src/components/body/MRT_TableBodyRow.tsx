import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  type Theme,
  useTheme,
} from '@mui/material/styles';
import TableRow, { type TableRowProps } from '@mui/material/TableRow';
import { useSelector } from '@tanstack/react-store';
import { type TableState } from '@tanstack/react-table';
import { type VirtualItem } from '@tanstack/react-virtual';
import { useRef } from 'react';

import { useMRT_RowContext } from '../../hooks/useMRT_AppRow';
import { useMRT_TableContext } from '../../hooks/useMRT_AppTable';
import {
  type MRT_Cell,
  type MRT_ColumnVirtualizer,
  type MRT_RowData,
  type MRT_RowVirtualizer,
  type MRT_VirtualItem,
} from '../../types';
import { getIsRowSelected } from '../../utils/row.utils';
import {
  commonCellBeforeAfterStyles,
  getCommonPinnedCellStyles,
  mrtAlpha,
  mrtDarken,
  mrtLighten,
  resolveBaseBackgroundForColorTools,
} from '../../utils/style.utils';
import { type MRT_TableFeaturesType } from '../../utils/tableFeatures';
import { parseFromValuesOrFunc } from '../../utils/utils';
import { MRT_TableBodyCell } from './MRT_TableBodyCell';
import { MRT_TableDetailPanel } from './MRT_TableDetailPanel';

export interface MRT_TableBodyRowProps extends TableRowProps {
  columnVirtualizer?: MRT_ColumnVirtualizer;
  numRows?: number;
  pinnedRowIds?: string[];
  rowVirtualizer?: MRT_RowVirtualizer;
  staticRowIndex: number;
  tableFooterHeight?: number;
  tableHeadHeight?: number;
  virtualRow?: VirtualItem;
}

//row/table are read from context (see the MRT_AppRow wrapper in MRT_TableBody.tsx's row-mapping
//loop, which is what makes them available here) rather than received as props - the row-keyed
//atoms this component used to bare-subscribe to directly (draggingRow/hoveredRow/rowPinning/
//rowSelection) are now subscribed, narrowed by row.id, at that same wrapper boundary instead
//(migration-render.md §13's resolution) - this component re-renders only when ITS row's relevance
//to one of those actually changes, not on any row's. The structural/global atoms below
//(density/columnOrder/columnPinning/columnVisibility/grouping/isFullScreen) stay as bare
//subscriptions - narrowing wouldn't help them (they reshape the whole table, not one row).
export const MRT_TableBodyRow = <TData extends MRT_RowData>({
  columnVirtualizer,
  numRows,
  pinnedRowIds,
  rowVirtualizer,
  staticRowIndex,
  tableFooterHeight = 0,
  tableHeadHeight = 0,
  virtualRow,
  ...rest
}: MRT_TableBodyRowProps) => {
  const theme = useTheme();
  const row = useMRT_RowContext<TData>();
  const table = useMRT_TableContext<TData>();

  const {
    options: {
      enableRowDragging,
      enableRowOrdering,
      enableRowPinning,
      enableStickyFooter,
      enableStickyHeader,
      layoutMode,
      mrtTheme: {
        baseBackgroundColor,
        pinnedRowBackgroundColor,
        selectedRowBackgroundColor,
      },
      muiTableBodyRowProps,
      renderDetailPanel,
      rowPinningDisplayMode,
    },
  } = table;
  const density = useSelector(table.atoms.density);
  //not read directly - row.getVisibleCells() below reads both live (column-visibility's own
  //row_getVisibleCells filters on columnVisibility and reads table.atoms.columnPinning directly
  //for start/end partitioning - see @tanstack/table-core's columnVisibilityFeature.utils.js).
  //Also subscribes columnOrder defensively, for the same "which cells, in what order" reasoning,
  //even though the exact internal read wasn't traced as precisely as the other two. Found live via
  //Stage 4 of migration-render.md - hiding a column left a stale extra <td> in every row even after
  //the header correctly dropped it.
  useSelector(table.atoms.columnOrder);
  useSelector(table.atoms.columnPinning);
  useSelector(table.atoms.columnVisibility);
  //not read directly - row.getIsGrouped() below (gates the detail panel) reads this live.
  useSelector(table.atoms.grouping);
  const isFullScreen = useSelector(table.atoms.isFullScreen);
  //draggingRow/hoveredRow are no longer subscribed here (see file comment above) - the wrapping
  //MRT_AppRow already re-renders this component when either becomes/stops being relevant to THIS
  //row, so a plain live read is correct and sufficient once re-rendered.
  const { draggingRow, hoveredRow } = table.getState();

  const visibleCells = row.getVisibleCells();

  const { virtualColumns, virtualPaddingLeft, virtualPaddingRight } =
    columnVirtualizer ?? {};

  const isRowSelected = getIsRowSelected({ row, table });
  const isRowPinned = enableRowPinning && row.getIsPinned();
  const isDraggingRow = draggingRow?.id === row.id;
  const isHoveredRow = hoveredRow?.id === row.id;
  const baseBackgroundColorForColorTools = resolveBaseBackgroundForColorTools(
    theme,
    baseBackgroundColor,
  );

  const tableRowProps = {
    ...parseFromValuesOrFunc(muiTableBodyRowProps, {
      row,
      staticRowIndex,
      table,
    }),
    ...rest,
  };

  const [bottomPinnedIndex, topPinnedIndex] =
    enableRowPinning &&
    rowPinningDisplayMode?.includes('sticky') &&
    pinnedRowIds &&
    row.getIsPinned()
      ? [
          [...pinnedRowIds].reverse().indexOf(row.id),
          pinnedRowIds.indexOf(row.id),
        ]
      : [];

  const sx = (
    Array.isArray(tableRowProps?.sx)
      ? tableRowProps?.sx[0]
      : typeof tableRowProps?.sx === 'function'
        ? tableRowProps?.sx(theme)
        : tableRowProps?.sx
  ) as any;

  const defaultRowHeight =
    density === 'compact' ? 37 : density === 'comfortable' ? 53 : 69;

  const customRowHeight =
    parseInt(
      (tableRowProps?.style?.height as string) ?? (sx?.height as string),
      10,
    ) || undefined;

  const rowHeight = customRowHeight || defaultRowHeight;

  const rowRef = useRef<HTMLTableRowElement | null>(null);

  //the row is the actual dnd-kit sortable item - see useMRT_DragAndDrop.ts for the shared
  //DndContext this participates in, and MRT_TableBodyRowGrabHandle.tsx (rendered several levels
  //deeper, as the mrt-row-drag display column's Cell) for where listeners/attributes end up.
  //Always called unconditionally (Rules of Hooks); `disabled` is dnd-kit's own native opt-out.
  const {
    attributes: rowDragAttributes,
    listeners: rowDragListeners,
    setActivatorNodeRef,
    setNodeRef: setSortableNodeRef,
    transform: rowDragTransform,
    transition: rowDragTransition,
  } = useSortable({
    data: { row, type: 'row' },
    disabled: !(enableRowDragging || enableRowOrdering),
    id: row.id,
  });

  //dnd-kit's useSortable() only computes the drag-shift transform/transition - it never applies
  //them to the DOM itself (unlike the old native-HTML5-DnD code, which had no separate
  //"compute vs apply" step). Without this, dnd-kit tracks a drag correctly internally (confirmed
  //via its own aria-live announcements) but the dragged row and its shifting siblings never
  //visually move - drag-and-drop looks completely broken even though the reorder still commits
  //correctly on drop. Combined with the virtualizer's own translateY (both are transform-based)
  //rather than picking one, since a row can be both virtualized and mid-drag at once. Built with
  //plain if-statements, not a ternary-per-array-element .filter(Boolean).join() - React Compiler
  //rejects that shape regardless of where it lives (category `Todo`, "Unexpected terminal kind
  //`ternary` for logical test block").
  const transformParts: string[] = [];
  if (virtualRow) transformParts.push(`translateY(${virtualRow.start}px)`);
  //CSS.Transform.toString's return type is string | undefined even when its input is non-null -
  //it can still yield undefined for an all-zero transform, so this needs its own guard.
  const rowDragTransformString = rowDragTransform
    ? CSS.Transform.toString(rowDragTransform)
    : undefined;
  if (rowDragTransformString) transformParts.push(rowDragTransformString);
  const rowTransform =
    transformParts.length > 0 ? transformParts.join(' ') : undefined;

  const cellHighlightColor = isRowSelected
    ? selectedRowBackgroundColor
    : isRowPinned
      ? pinnedRowBackgroundColor
      : undefined;

  const cellHighlightColorHover =
    tableRowProps?.hover !== false
      ? isRowSelected
        ? cellHighlightColor
        : theme.palette.mode === 'dark'
          ? mrtLighten({
              amount: 0.3,
              color: baseBackgroundColor,
              fallbackColor: baseBackgroundColorForColorTools,
            })
          : mrtDarken({
              amount: 0.3,
              color: baseBackgroundColor,
              fallbackColor: baseBackgroundColorForColorTools,
            })
      : undefined;

  return (
    <>
      <TableRow
        data-index={renderDetailPanel ? staticRowIndex * 2 : staticRowIndex}
        data-pinned={!!isRowPinned || undefined}
        data-selected={isRowSelected || undefined}
        ref={(node: HTMLTableRowElement | null) => {
          setSortableNodeRef(node);
          if (node) {
            rowRef.current = node;
            rowVirtualizer?.measureElement(node);
          }
        }}
        selected={isRowSelected}
        {...tableRowProps}
        style={{
          transform: rowTransform,
          //dnd-kit sets this to undefined for the row actively being dragged (so it tracks the
          //pointer with no lag) and a real transition for siblings animating out of the way - only
          //override the sx-managed transition when dnd-kit actually wants to.
          transition: rowDragTransition,
          ...tableRowProps?.style,
        }}
        sx={[
          (theme: Theme) => ({
            '&:hover td:after': cellHighlightColorHover
              ? {
                  backgroundColor: mrtAlpha({
                    amount: 0.3,
                    color: cellHighlightColorHover,
                    fallbackColor: baseBackgroundColorForColorTools,
                  }),
                  ...commonCellBeforeAfterStyles,
                }
              : undefined,
            backgroundColor: `${baseBackgroundColor} !important`,
            bottom:
              !virtualRow && bottomPinnedIndex !== undefined && isRowPinned
                ? `${
                    bottomPinnedIndex * rowHeight +
                    (enableStickyFooter ? tableFooterHeight - 1 : 0)
                  }px`
                : undefined,
            boxSizing: 'border-box',
            display: layoutMode?.startsWith('grid') ? 'flex' : undefined,
            opacity: isRowPinned
              ? 0.97
              : isDraggingRow || isHoveredRow
                ? 0.5
                : 1,
            position: virtualRow
              ? 'absolute'
              : rowPinningDisplayMode?.includes('sticky') && isRowPinned
                ? 'sticky'
                : 'relative',
            td: {
              ...getCommonPinnedCellStyles({ table, theme }),
            },
            'td:after': cellHighlightColor
              ? {
                  backgroundColor: cellHighlightColor,
                  ...commonCellBeforeAfterStyles,
                }
              : undefined,
            top: virtualRow
              ? 0
              : topPinnedIndex !== undefined && isRowPinned
                ? `${
                    topPinnedIndex * rowHeight +
                    (enableStickyHeader || isFullScreen
                      ? tableHeadHeight - 1
                      : 0)
                  }px`
                : undefined,
            transition: virtualRow ? 'none' : 'all 150ms ease-in-out',
            width: '100%',
            zIndex:
              rowPinningDisplayMode?.includes('sticky') && isRowPinned ? 2 : 0,
          }),
          ...(Array.isArray(tableRowProps?.sx)
            ? tableRowProps.sx
            : [tableRowProps?.sx]),
        ]}
      >
        {virtualPaddingLeft ? (
          <td style={{ display: 'flex', width: virtualPaddingLeft }} />
        ) : null}
        {(virtualColumns ?? visibleCells).map(
          (cellOrVirtualCell, staticColumnIndex) => {
            let cell = cellOrVirtualCell as MRT_Cell<TData>;
            if (columnVirtualizer) {
              staticColumnIndex = (cellOrVirtualCell as MRT_VirtualItem).index;
              cell = visibleCells[staticColumnIndex];
            }
            if (!cell) return null;
            const key = `${cell.id}-${staticRowIndex}`;
            //narrowed by cell.id/column.id/row.id - the actual trigger for MRT_TableBodyCell's
            //own cell/column/row-keyed reads (see that file's header comment). Column/cell-keyed
            //changes specifically (draggingColumn/hoveredColumn/columnResizing/actionCell/
            //editingCell) have no other path to reach this cell - nothing above it in the tree
            //subscribes to those - so this selector is load-bearing, not just an optimization.
            return (
              //cell cast to any - table.AppCell expects table-core's raw Cell<TFeatures, TData,
              //TValue>, structurally distinct from MRT_Cell<TData> (MRT_Column/MRT_DefinedColumnDef
              //vs Column/ColumnDef, same type-vs-runtime gap useMRT_TableInstance.ts's own
              //`table` cast already documents) - safe, the underlying runtime object is identical.
              <table.AppCell
                cell={cell as any}
                key={key}
                selector={(state: TableState<MRT_TableFeaturesType>) => ({
                  isActionCell: state.actionCell?.id === cell.id,
                  isCreatingRow: state.creatingRow?.id === cell.row.id,
                  isDraggingColumn: state.draggingColumn?.id === cell.column.id,
                  isDraggingRow: state.draggingRow?.id === cell.row.id,
                  isEditingCell: state.editingCell?.id === cell.id,
                  isEditingRow: state.editingRow?.id === cell.row.id,
                  isHoveredColumn: state.hoveredColumn?.id === cell.column.id,
                  isHoveredRow: state.hoveredRow?.id === cell.row.id,
                  isResizingColumn:
                    state.columnResizing?.isResizingColumn === cell.column.id,
                })}
              >
                {() => (
                  <MRT_TableBodyCell
                    numRows={numRows}
                    rowDragHandleProps={{
                      activatorRef: setActivatorNodeRef,
                      attributes: rowDragAttributes,
                      listeners: rowDragListeners,
                    }}
                    rowRef={rowRef}
                    staticColumnIndex={staticColumnIndex}
                    staticRowIndex={staticRowIndex}
                  />
                )}
              </table.AppCell>
            );
          },
        )}
        {virtualPaddingRight ? (
          <td style={{ display: 'flex', width: virtualPaddingRight }} />
        ) : null}
      </TableRow>
      {renderDetailPanel && !row.getIsGrouped() && (
        <MRT_TableDetailPanel
          parentRowRef={rowRef}
          row={row}
          rowVirtualizer={rowVirtualizer}
          staticRowIndex={staticRowIndex}
          table={table}
          virtualRow={virtualRow}
        />
      )}
    </>
  );
};
