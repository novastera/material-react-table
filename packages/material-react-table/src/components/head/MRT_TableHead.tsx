import {
  horizontalListSortingStrategy,
  SortableContext,
} from '@dnd-kit/sortable';
import TableHead, { type TableHeadProps } from '@mui/material/TableHead';
import { useSelector } from '@tanstack/react-store';

import {
  type MRT_ColumnVirtualizer,
  type MRT_RowData,
  type MRT_TableInstance,
} from '../../types';
import { mergeRefs, parseFromValuesOrFunc } from '../../utils/utils';
import { MRT_ToolbarAlertBanner } from '../toolbar/MRT_ToolbarAlertBanner';
import { MRT_TableHeadRow } from './MRT_TableHeadRow';

export interface MRT_TableHeadProps<TData extends MRT_RowData>
  extends TableHeadProps {
  columnVirtualizer?: MRT_ColumnVirtualizer;
  table: MRT_TableInstance<TData>;
}

export const MRT_TableHead = <TData extends MRT_RowData>({
  columnVirtualizer,
  table,
  ...rest
}: MRT_TableHeadProps<TData>) => {
  const {
    options: {
      enableStickyHeader,
      layoutMode,
      muiTableHeadProps,
      positionToolbarAlertBanner,
    },
    refs: { tableHeadRef },
  } = table;
  const columnOrder = useSelector(table.atoms.columnOrder);
  const isFullScreen = useSelector(table.atoms.isFullScreen);
  const showAlertBanner = useSelector(table.atoms.showAlertBanner);
  //not read directly - table.getSelectedRowModel() below reads this live.
  useSelector(table.atoms.rowSelection);
  //not read directly - table.getHeaderGroups()/getVisibleLeafColumns() below both partition/order
  //columns by pin state and visibility internally; this component must re-render to pick up the
  //new header-group shape (found live via Stage 4 of migration-render.md - column pinning stopped
  //visually moving the header, and hiding a column stopped removing it from the header row, both
  //because this component never re-called getHeaderGroups()/getVisibleLeafColumns() again).
  useSelector(table.atoms.columnPinning);
  useSelector(table.atoms.columnVisibility);

  const tableHeadProps = {
    ...parseFromValuesOrFunc(muiTableHeadProps, { table }),
    ...rest,
  };

  const stickyHeader = enableStickyHeader || isFullScreen;

  return (
    <TableHead
      {...tableHeadProps}
      ref={mergeRefs(tableHeadRef, tableHeadProps?.ref)}
      sx={[
        {
          display: layoutMode?.startsWith('grid') ? 'grid' : undefined,
          opacity: 0.97,
          position: stickyHeader ? 'sticky' : 'relative',
          top: stickyHeader && layoutMode?.startsWith('grid') ? 0 : undefined,
          zIndex: stickyHeader ? 2 : undefined,
        },
        ...(Array.isArray(tableHeadProps?.sx)
          ? tableHeadProps.sx
          : [tableHeadProps?.sx]),
      ]}
    >
      {positionToolbarAlertBanner === 'head-overlay' &&
      (showAlertBanner || table.getSelectedRowModel().rows.length > 0) ? (
        <tr
          style={{
            display: layoutMode?.startsWith('grid') ? 'grid' : undefined,
          }}
        >
          <th
            colSpan={table.getVisibleLeafColumns().length}
            style={{
              display: layoutMode?.startsWith('grid') ? 'grid' : undefined,
              padding: 0,
            }}
          >
            <MRT_ToolbarAlertBanner table={table} />
          </th>
        </tr>
      ) : (
        <SortableContext
          items={columnOrder}
          strategy={horizontalListSortingStrategy}
        >
          {table
            .getHeaderGroups()
            .map((headerGroup) => (
              <MRT_TableHeadRow
                columnVirtualizer={columnVirtualizer}
                headerGroup={headerGroup as any}
                key={headerGroup.id}
                table={table}
              />
            ))}
        </SortableContext>
      )}
    </TableHead>
  );
};
