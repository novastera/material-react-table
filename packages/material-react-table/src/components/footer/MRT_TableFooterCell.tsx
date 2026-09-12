import { useTheme } from '@mui/material/styles';
import TableCell, { type TableCellProps } from '@mui/material/TableCell';
import { useSelector } from '@tanstack/react-store';

import { useMRT_HeaderContext } from '../../hooks/useMRT_AppTable';
import { type MRT_RowData, type MRT_TableInstance } from '../../types';
import { cellKeyboardShortcuts } from '../../utils/cell.utils';
import { getCommonMRTCellStyles } from '../../utils/style.utils';
import { parseFromValuesOrFunc } from '../../utils/utils';

export interface MRT_TableFooterCellProps extends TableCellProps {
  staticColumnIndex?: number;
}

//footer/table are read from context (see the table.AppFooter wrapper in
//MRT_TableFooterRow.tsx's footer-mapping loop) rather than received as props - same pattern as
//MRT_TableHeadCell.tsx, see that file's comment for the reasoning.
export const MRT_TableFooterCell = <TData extends MRT_RowData>({
  staticColumnIndex,
  ...rest
}: MRT_TableFooterCellProps) => {
  const theme = useTheme();
  const footer = useMRT_HeaderContext<TData>();
  //cast needed - MRT_Header's own `.table` field wasn't redeclared to point at
  //MRT_TableInstance, same type-vs-runtime gap as MRT_TableBodyCell.tsx's cell.table cast.
  const table = footer.table as unknown as MRT_TableInstance<TData>;
  const {
    options: {
      enableColumnPinning,
      enableKeyboardShortcuts,
      muiTableFooterCellProps,
    },
  } = table;
  const density = useSelector(table.atoms.density);
  //not read directly - getCommonMRTCellStyles below reads these live off table.getState()/
  //column.getIsPinned()/getIsResizing() for its opacity/zIndex/sticky-positioning calculation, a
  //plain utility function that can't subscribe itself - this component needs the subscription
  //instead. columnResizing/draggingColumn/hoveredColumn are no longer subscribed here at all
  //(unlike columnPinning) - nothing in this component's own body reads them as values (only
  //getCommonMRTCellStyles does, internally, via its own live reads), so the wrapping
  //table.AppFooter's selector (mirroring MRT_TableHeadCell.tsx's table.AppHeader) is the sole
  //trigger for those three.
  useSelector(table.atoms.columnPinning);
  const { column } = footer;
  const { columnDef } = column;
  const { columnDefType } = columnDef;

  const isColumnPinned =
    enableColumnPinning &&
    columnDef.columnDefType !== 'group' &&
    column.getIsPinned();

  const args = { column, table };
  const tableCellProps = {
    ...parseFromValuesOrFunc(muiTableFooterCellProps, args),
    ...parseFromValuesOrFunc(columnDef.muiTableFooterCellProps, args),
    ...rest,
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTableCellElement>) => {
    tableCellProps?.onKeyDown?.(event);
    cellKeyboardShortcuts({
      cellValue: footer.column.columnDef.footer,
      event,
      table,
    });
  };

  return (
    <TableCell
      align={
        columnDefType === 'group'
          ? 'center'
          : theme.direction === 'rtl'
            ? 'right'
            : 'left'
      }
      colSpan={footer.colSpan}
      data-index={staticColumnIndex}
      data-pinned={!!isColumnPinned || undefined}
      tabIndex={enableKeyboardShortcuts ? 0 : undefined}
      variant="footer"
      {...tableCellProps}
      onKeyDown={handleKeyDown}
      sx={[
        {
          fontWeight: 'bold',
          p:
            density === 'compact'
              ? '0.5rem'
              : density === 'comfortable'
                ? '1rem'
                : '1.5rem',
          verticalAlign: 'top',
        },
        //spread as separate sx array entries, not object-spread into the object above - see
        //getCommonMRTCellStyles's own comment (MUI's documented sx array-merging behavior; object
        //spread silently drops these into numeric keys the sx engine doesn't recognize).
        ...getCommonMRTCellStyles({
          column,
          header: footer,
          table,
          tableCellProps,
          theme,
        }),
        ...(Array.isArray(tableCellProps.sx)
          ? tableCellProps.sx
          : [tableCellProps.sx]),
      ]}
    >
      {tableCellProps.children ??
        (footer.isPlaceholder
          ? null
          : (parseFromValuesOrFunc(columnDef.Footer, {
              column,
              footer,
              table,
            }) ??
            columnDef.footer ??
            null))}
    </TableCell>
  );
};
