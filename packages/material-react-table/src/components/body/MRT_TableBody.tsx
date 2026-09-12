import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import TableBody, { type TableBodyProps } from '@mui/material/TableBody';
import Typography from '@mui/material/Typography';
import { useSelector } from '@tanstack/react-store';
import { type TableState } from '@tanstack/react-table';
import { type VirtualItem } from '@tanstack/react-virtual';

import { MRT_AppRow } from '../../hooks/useMRT_AppRow';
import { useMRT_ObservedElementSize } from '../../hooks/useMRT_ObservedElementSize';
import { useMRT_Rows } from '../../hooks/useMRT_Rows';
import { useMRT_RowVirtualizer } from '../../hooks/useMRT_RowVirtualizer';
import {
  type MRT_ColumnVirtualizer,
  type MRT_Row,
  type MRT_RowData,
  type MRT_TableInstance,
} from '../../types';
import { getIsRowSelected } from '../../utils/row.utils';
import { type MRT_TableFeaturesType } from '../../utils/tableFeatures';
import { parseFromValuesOrFunc } from '../../utils/utils';
import { MRT_TableBodyRow } from './MRT_TableBodyRow';

export interface MRT_TableBodyProps<TData extends MRT_RowData>
  extends TableBodyProps {
  columnVirtualizer?: MRT_ColumnVirtualizer;
  table: MRT_TableInstance<TData>;
}

export const MRT_TableBody = <TData extends MRT_RowData>({
  columnVirtualizer,
  table,
  ...rest
}: MRT_TableBodyProps<TData>) => {
  const {
    getBottomRows,
    getIsSomeRowsPinned,
    getRowModel,
    getTopRows,
    options: {
      enableStickyFooter,
      enableStickyHeader,
      layoutMode,
      localization,
      muiTableBodyProps,
      renderDetailPanel,
      renderEmptyRowsFallback,
      rowPinningDisplayMode,
    },
    refs: { tableFooterRef, tableHeadRef, tablePaperRef },
  } = table;
  const columnFilters = useSelector(table.atoms.columnFilters);
  const globalFilter = useSelector(table.atoms.globalFilter);
  const isFullScreen = useSelector(table.atoms.isFullScreen);
  const rowPinning = useSelector(table.atoms.rowPinning);
  //not read directly - the empty-state fallback row's colSpan below reads
  //table.getVisibleLeafColumns().length live.
  useSelector(table.atoms.columnVisibility);

  const tableBodyProps = {
    ...parseFromValuesOrFunc(muiTableBodyProps, { table }),
    ...rest,
  };

  const measuredHeadHeight = useMRT_ObservedElementSize(
    tableHeadRef,
    (el) => el.clientHeight,
  );
  const measuredFooterHeight = useMRT_ObservedElementSize(
    tableFooterRef,
    (el) => el.clientHeight,
  );
  const measuredPaperWidth = useMRT_ObservedElementSize(
    tablePaperRef,
    (el) => el.clientWidth,
  );
  const tableHeadHeight =
    enableStickyHeader || isFullScreen ? measuredHeadHeight : 0;
  const tableFooterHeight = enableStickyFooter ? measuredFooterHeight : 0;

  const pinnedRowIds =
    rowPinning.bottom?.length || rowPinning.top?.length
      ? getRowModel()
          .rows.filter((row) => row.getIsPinned())
          .map((r) => r.id)
      : [];

  const rows = useMRT_Rows(table);

  //dnd-kit sortable items for row drag-and-drop - see useMRT_TableBodyRow.tsx (useSortable is
  //called per-row there) and useMRT_DragAndDrop.ts for the shared DndContext. Includes pinned
  //rows too, matching the pre-existing native-DnD behavior where any rendered row (pinned or not)
  //could become draggingRow/hoveredRow.
  const sortableRowIds = [
    ...getTopRows(),
    ...rows,
    ...getBottomRows(),
  ].map((row) => row.id);

  const rowVirtualizer = useMRT_RowVirtualizer(table, rows);

  const { virtualRows } = rowVirtualizer ?? {};

  const commonRowProps = {
    columnVirtualizer,
    numRows: rows.length,
    tableFooterHeight,
    tableHeadHeight,
  };

  //row-keyed atoms this row (and nothing above it - MRT_TableBody itself isn't row-scoped) needs
  //to know about. rowSelection/rowPinning call the real, already-proven utility/method
  //(getIsRowSelected/row.getIsPinned()) rather than re-deriving their logic here -
  //getIsRowSelected in particular has hierarchical subrow-cascading complexity
  //(row.getIsSelected() || all-subrows-selected) that would be easy to get subtly wrong by
  //reimplementing. The selector re-evaluates on every store change regardless of what it reads
  //internally (table.Subscribe's source defaults to the full table.store) - only its *output*
  //(compared shallowly) gates the actual re-render, so calling the real function costs nothing
  //extra in correctness and removes an entire class of potential mismatch.
  const getRowSelector =
    (row: MRT_Row<TData>) => (state: TableState<MRT_TableFeaturesType>) => ({
      isDraggingRow: state.draggingRow?.id === row.id,
      isHoveredRow: state.hoveredRow?.id === row.id,
      isRowPinned: row.getIsPinned(),
      isRowSelected: getIsRowSelected({ row, table }),
    });

  return (
    <SortableContext
      items={sortableRowIds}
      strategy={verticalListSortingStrategy}
    >
      {!rowPinningDisplayMode?.includes('sticky') &&
        getIsSomeRowsPinned('top') && (
          <TableBody
            {...tableBodyProps}
            sx={[
              {
                display: layoutMode?.startsWith('grid') ? 'grid' : undefined,
                position: 'sticky',
                top: tableHeadHeight - 1,
                zIndex: 1,
              },
              ...(Array.isArray(tableBodyProps?.sx)
                ? tableBodyProps.sx
                : [tableBodyProps?.sx]),
            ]}
          >
            {getTopRows().map((row, staticRowIndex) => (
              <MRT_AppRow
                key={row.id}
                row={row}
                selector={getRowSelector(row)}
                table={table}
              >
                {() => (
                  <MRT_TableBodyRow
                    {...commonRowProps}
                    staticRowIndex={staticRowIndex}
                  />
                )}
              </MRT_AppRow>
            ))}
          </TableBody>
        )}
      <TableBody
        {...tableBodyProps}
        sx={[
          {
            display: layoutMode?.startsWith('grid') ? 'grid' : undefined,
            height: rowVirtualizer
              ? `${rowVirtualizer.getTotalSize()}px`
              : undefined,
            minHeight: !rows.length ? '100px' : undefined,
            position: 'relative',
          },
          ...(Array.isArray(tableBodyProps?.sx)
            ? tableBodyProps.sx
            : [tableBodyProps?.sx]),
        ]}
      >
        {tableBodyProps?.children ??
          (!rows.length ? (
            <tr
              style={{
                display: layoutMode?.startsWith('grid') ? 'grid' : undefined,
              }}
            >
              <td
                colSpan={table.getVisibleLeafColumns().length}
                style={{
                  display: layoutMode?.startsWith('grid') ? 'grid' : undefined,
                }}
              >
                {renderEmptyRowsFallback?.({ table }) ?? (
                  <Typography
                    sx={{
                      color: 'text.secondary',
                      fontStyle: 'italic',
                      maxWidth: `min(100vw, ${
                        measuredPaperWidth ? `${measuredPaperWidth}px` : '100%'
                      })`,
                      py: '2rem',
                      textAlign: 'center',
                      width: '100%',
                    }}
                  >
                    {globalFilter || columnFilters.length
                      ? localization.noResultsFound
                      : localization.noRecordsToDisplay}
                  </Typography>
                )}
              </td>
            </tr>
          ) : (
            <>
              {(virtualRows ?? rows).map((rowOrVirtualRow, staticRowIndex) => {
                let row = rowOrVirtualRow as MRT_Row<TData>;
                if (rowVirtualizer) {
                  if (renderDetailPanel) {
                    if (rowOrVirtualRow.index % 2 === 1) {
                      return null;
                    } else {
                      staticRowIndex = rowOrVirtualRow.index / 2;
                    }
                  } else {
                    staticRowIndex = rowOrVirtualRow.index;
                  }
                  row = rows[staticRowIndex];
                }
                const key = `${row.id}-${row.index}`;
                return (
                  <MRT_AppRow
                    key={key}
                    row={row}
                    selector={getRowSelector(row)}
                    table={table}
                  >
                    {() => (
                      <MRT_TableBodyRow
                        {...commonRowProps}
                        pinnedRowIds={pinnedRowIds}
                        rowVirtualizer={rowVirtualizer}
                        staticRowIndex={staticRowIndex}
                        virtualRow={
                          rowVirtualizer
                            ? (rowOrVirtualRow as VirtualItem)
                            : undefined
                        }
                      />
                    )}
                  </MRT_AppRow>
                );
              })}
            </>
          ))}
      </TableBody>
      {!rowPinningDisplayMode?.includes('sticky') &&
        getIsSomeRowsPinned('bottom') && (
          <TableBody
            {...tableBodyProps}
            sx={[
              {
                bottom: tableFooterHeight - 1,
                display: layoutMode?.startsWith('grid') ? 'grid' : undefined,
                position: 'sticky',
                zIndex: 1,
              },
              ...(Array.isArray(tableBodyProps?.sx)
                ? tableBodyProps.sx
                : [tableBodyProps?.sx]),
            ]}
          >
            {getBottomRows().map((row, staticRowIndex) => (
              <MRT_AppRow
                key={row.id}
                row={row}
                selector={getRowSelector(row)}
                table={table}
              >
                {() => (
                  <MRT_TableBodyRow
                    {...commonRowProps}
                    staticRowIndex={staticRowIndex}
                  />
                )}
              </MRT_AppRow>
            ))}
          </TableBody>
        )}
    </SortableContext>
  );
};
