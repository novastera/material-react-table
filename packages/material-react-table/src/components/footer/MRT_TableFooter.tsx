import TableFooter, { type TableFooterProps } from '@mui/material/TableFooter';
import { useSelector } from '@tanstack/react-store';

import {
  type MRT_ColumnVirtualizer,
  type MRT_RowData,
  type MRT_TableInstance,
} from '../../types';
import { mergeRefs, parseFromValuesOrFunc } from '../../utils/utils';
import { MRT_TableFooterRow } from './MRT_TableFooterRow';

export interface MRT_TableFooterProps<TData extends MRT_RowData>
  extends TableFooterProps {
  columnVirtualizer?: MRT_ColumnVirtualizer;
  table: MRT_TableInstance<TData>;
}

export const MRT_TableFooter = <TData extends MRT_RowData>({
  columnVirtualizer,
  table,
  ...rest
}: MRT_TableFooterProps<TData>) => {
  const {
    options: { enableStickyFooter, layoutMode, muiTableFooterProps },
    refs: { tableFooterRef },
  } = table;
  const isFullScreen = useSelector(table.atoms.isFullScreen);
  //not read directly - table.getFooterGroups() below partitions/orders columns by pin state and
  //visibility internally, same as MRT_TableHead.tsx's getHeaderGroups() (see that file's comment
  //and migration-render.md - found live via the same Stage 4 investigation).
  useSelector(table.atoms.columnPinning);
  useSelector(table.atoms.columnVisibility);

  const tableFooterProps = {
    ...parseFromValuesOrFunc(muiTableFooterProps, {
      table,
    }),
    ...rest,
  };

  const stickFooter =
    (isFullScreen || enableStickyFooter) && enableStickyFooter !== false;

  const footerGroups = table.getFooterGroups();

  //if no footer cells at all, skip footer
  if (
    !footerGroups.some((footerGroup) =>
      footerGroup.headers?.some(
        (header) =>
          (typeof header.column.columnDef.footer === 'string' &&
            !!header.column.columnDef.footer) ||
          header.column.columnDef.Footer,
      ),
    )
  ) {
    return null;
  }

  return (
    <TableFooter
      {...tableFooterProps}
      ref={mergeRefs(tableFooterRef, tableFooterProps?.ref)}
      sx={[
        (theme) => ({
          bottom: stickFooter ? 0 : undefined,
          display: layoutMode?.startsWith('grid') ? 'grid' : undefined,
          opacity: stickFooter ? 0.97 : undefined,
          outline: stickFooter
            ? theme.palette.mode === 'light'
              ? `1px solid ${theme.palette.grey[300]}`
              : `1px solid ${theme.palette.grey[700]}`
            : undefined,
          position: stickFooter ? 'sticky' : 'relative',
          zIndex: stickFooter ? 1 : undefined,
        }),
        ...(Array.isArray(tableFooterProps?.sx)
          ? tableFooterProps.sx
          : [tableFooterProps?.sx]),
      ]}
    >
      {footerGroups.map((footerGroup) => (
        <MRT_TableFooterRow
          columnVirtualizer={columnVirtualizer}
          footerGroup={footerGroup as any}
          key={footerGroup.id}
          table={table}
        />
      ))}
    </TableFooter>
  );
};
