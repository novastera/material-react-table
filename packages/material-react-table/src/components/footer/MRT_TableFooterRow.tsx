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
import { MRT_TableFooterCell } from './MRT_TableFooterCell';

export interface MRT_TableFooterRowProps<TData extends MRT_RowData>
  extends TableRowProps {
  columnVirtualizer?: MRT_ColumnVirtualizer;
  footerGroup: MRT_HeaderGroup<TData>;
  table: MRT_TableInstance<TData>;
}

export const MRT_TableFooterRow = <TData extends MRT_RowData>({
  columnVirtualizer,
  footerGroup,
  table,
  ...rest
}: MRT_TableFooterRowProps<TData>) => {
  const {
    options: {
      layoutMode,
      mrtTheme: { baseBackgroundColor },
      muiTableFooterRowProps,
    },
  } = table;

  const { virtualColumns, virtualPaddingLeft, virtualPaddingRight } =
    columnVirtualizer ?? {};

  // if no content in row, skip row
  if (
    !footerGroup.headers?.some(
      (header) =>
        (typeof header.column.columnDef.footer === 'string' &&
          !!header.column.columnDef.footer) ||
        header.column.columnDef.Footer,
    )
  ) {
    return null;
  }

  const tableRowProps = {
    ...parseFromValuesOrFunc(muiTableFooterRowProps, {
      footerGroup,
      table,
    }),
    ...rest,
  };

  return (
    <TableRow
      {...tableRowProps}
      sx={[
        {
          backgroundColor: baseBackgroundColor,
          display: layoutMode?.startsWith('grid') ? 'flex' : undefined,
          position: 'relative',
          width: '100%',
        },
        ...(Array.isArray(tableRowProps?.sx)
          ? tableRowProps.sx
          : [tableRowProps?.sx]),
      ]}
    >
      {virtualPaddingLeft ? (
        <th style={{ display: 'flex', width: virtualPaddingLeft }} />
      ) : null}
      {(virtualColumns ?? footerGroup.headers).map(
        (footerOrVirtualFooter, staticColumnIndex) => {
          let footer = footerOrVirtualFooter as MRT_Header<TData>;
          if (columnVirtualizer) {
            staticColumnIndex = (footerOrVirtualFooter as MRT_VirtualItem)
              .index;
            footer = footerGroup.headers[staticColumnIndex];
          }
          if (!footer) return null;
          //narrowed by column.id - see MRT_TableFooterCell.tsx's own comment.
          return (
            //footer cast to any - same type-vs-runtime gap as MRT_TableHeadRow.tsx's header cast.
            <table.AppFooter
              header={footer as any}
              key={footer.id}
              selector={(state) => ({
                isDraggingColumn: state.draggingColumn?.id === footer.column.id,
                isHoveredColumn: state.hoveredColumn?.id === footer.column.id,
                isResizingColumn:
                  state.columnResizing?.isResizingColumn === footer.column.id,
              })}
            >
              {() => (
                <MRT_TableFooterCell staticColumnIndex={staticColumnIndex} />
              )}
            </table.AppFooter>
          );
        },
      )}
      {virtualPaddingRight ? (
        <th style={{ display: 'flex', width: virtualPaddingRight }} />
      ) : null}
    </TableRow>
  );
};
