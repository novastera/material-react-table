import { alpha } from '@mui/material/styles';
import TableRow, { type TableRowProps } from '@mui/material/TableRow';

import {
  type MRT_ColumnVirtualizer,
  type MRT_Header,
  type MRT_HeaderGroup,
  type MRT_RowData,
  type MRT_TableInstance,
  type MRT_VirtualItem,
} from '../../types';
import { parseFromValuesOrFunc } from '../../utils/utils';
import { MRT_TableHeadCell } from './MRT_TableHeadCell';

export interface MRT_TableHeadRowProps<TData extends MRT_RowData>
  extends TableRowProps {
  columnVirtualizer?: MRT_ColumnVirtualizer;
  headerGroup: MRT_HeaderGroup<TData>;
  table: MRT_TableInstance<TData>;
}

export const MRT_TableHeadRow = <TData extends MRT_RowData>({
  columnVirtualizer,
  headerGroup,
  table,
  ...rest
}: MRT_TableHeadRowProps<TData>) => {
  const {
    options: {
      enableStickyHeader,
      layoutMode,
      mrtTheme: { baseBackgroundColor },
      muiTableHeadRowProps,
    },
  } = table;

  const { virtualColumns, virtualPaddingLeft, virtualPaddingRight } =
    columnVirtualizer ?? {};

  const tableRowProps = {
    ...parseFromValuesOrFunc(muiTableHeadRowProps, {
      headerGroup,
      table,
    }),
    ...rest,
  };

  return (
    <TableRow
      {...tableRowProps}
      sx={[
        (theme) => ({
          backgroundColor: baseBackgroundColor,
          boxShadow: `4px 0 8px ${alpha(theme.palette.common.black, 0.1)}`,
          display: layoutMode?.startsWith('grid') ? 'flex' : undefined,
          position:
            enableStickyHeader && layoutMode === 'semantic'
              ? 'sticky'
              : 'relative',
          top: 0,
        }),
        ...(Array.isArray(tableRowProps?.sx)
          ? tableRowProps.sx
          : [tableRowProps?.sx]),
      ]}
    >
      {virtualPaddingLeft ? (
        <th style={{ display: 'flex', width: virtualPaddingLeft }} />
      ) : null}
      {(virtualColumns ?? headerGroup.headers).map(
        (headerOrVirtualHeader, staticColumnIndex) => {
          let header = headerOrVirtualHeader as MRT_Header<TData>;
          if (columnVirtualizer) {
            staticColumnIndex = (headerOrVirtualHeader as MRT_VirtualItem)
              .index;
            header = headerGroup.headers[staticColumnIndex];
          }
          if (!header) return null;
          //narrowed by column.id - see MRT_TableHeadCell.tsx's own comment for which atoms this
          //covers and why columnPinning/grouping/sorting are deliberately left out for now.
          return (
            //header cast to any - table.AppHeader expects table-core's raw Header, structurally
            //distinct from MRT_Header (same type-vs-runtime gap as MRT_TableBodyRow.tsx's
            //cell-as-any cast for table.AppCell).
            <table.AppHeader
              header={header as any}
              key={header.id}
              selector={(state) => ({
                isDraggingColumn: state.draggingColumn?.id === header.column.id,
                isHoveredColumn: state.hoveredColumn?.id === header.column.id,
                isResizingColumn:
                  state.columnResizing?.isResizingColumn === header.column.id,
              })}
            >
              {() => (
                <MRT_TableHeadCell
                  columnVirtualizer={columnVirtualizer}
                  staticColumnIndex={staticColumnIndex}
                />
              )}
            </table.AppHeader>
          );
        },
      )}
      {virtualPaddingRight ? (
        <th style={{ display: 'flex', width: virtualPaddingRight }} />
      ) : null}
    </TableRow>
  );
};
