import Collapse from '@mui/material/Collapse';
import TableCell, { type TableCellProps } from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
import { useSelector } from '@tanstack/react-store';
import { type RefObject } from 'react';

import { useMRT_ObservedElementSize } from '../../hooks/useMRT_ObservedElementSize';
import {
  type MRT_Row,
  type MRT_RowData,
  type MRT_RowVirtualizer,
  type MRT_TableInstance,
  type MRT_VirtualItem,
} from '../../types';
import { parseFromValuesOrFunc } from '../../utils/utils';

export interface MRT_TableDetailPanelProps<TData extends MRT_RowData>
  extends TableCellProps {
  parentRowRef: RefObject<HTMLTableRowElement | null>;
  row: MRT_Row<TData>;
  rowVirtualizer?: MRT_RowVirtualizer;
  staticRowIndex: number;
  table: MRT_TableInstance<TData>;
  virtualRow?: MRT_VirtualItem;
}

export const MRT_TableDetailPanel = <TData extends MRT_RowData>({
  parentRowRef,
  row,
  rowVirtualizer,
  staticRowIndex,
  table,
  virtualRow,
  ...rest
}: MRT_TableDetailPanelProps<TData>) => {
  const {
    getVisibleLeafColumns,
    options: {
      layoutMode,
      mrtTheme: { baseBackgroundColor },
      muiDetailPanelProps,
      muiTableBodyRowProps,
      renderDetailPanel,
    },
  } = table;
  const isLoading = useSelector(table.atoms.isLoading);
  //not read directly - getVisibleLeafColumns().length below (colSpan) reads this live. Same
  //defect shape as MRT_TableHead.tsx/MRT_TableBody.tsx's identical colSpan pattern - see
  //migration-render.md §13.
  useSelector(table.atoms.columnVisibility);
  //not read directly - row.getIsExpanded() below reads this live.
  useSelector(table.atoms.expanded);

  const tableRowProps = parseFromValuesOrFunc(muiTableBodyRowProps, {
    isDetailPanel: true,
    row,
    staticRowIndex,
    table,
  });

  const tableCellProps = {
    ...parseFromValuesOrFunc(muiDetailPanelProps, {
      row,
      table,
    }),
    ...rest,
  };

  const DetailPanel = !isLoading && renderDetailPanel?.({ row, table });

  const parentRowHeight = useMRT_ObservedElementSize(
    parentRowRef,
    (el) => el.getBoundingClientRect().height,
  );

  return (
    <TableRow
      className="Mui-TableBodyCell-DetailPanel"
      data-index={renderDetailPanel ? staticRowIndex * 2 + 1 : staticRowIndex}
      ref={(node: HTMLTableRowElement) => {
        if (node) {
          rowVirtualizer?.measureElement?.(node);
        }
      }}
      {...tableRowProps}
      sx={[
        {
          display: layoutMode?.startsWith('grid') ? 'flex' : undefined,
          position: virtualRow ? 'absolute' : undefined,
          top: virtualRow ? `${parentRowHeight}px` : undefined,
          transform: virtualRow
            ? `translateY(${virtualRow?.start}px)`
            : undefined,
          width: '100%',
        },
        ...(Array.isArray(tableRowProps?.sx)
          ? tableRowProps.sx
          : [tableRowProps?.sx]),
      ]}
    >
      <TableCell
        className="Mui-TableBodyCell-DetailPanel"
        colSpan={getVisibleLeafColumns().length}
        {...tableCellProps}
        sx={[
          {
            backgroundColor: virtualRow ? baseBackgroundColor : undefined,
            borderBottom: !row.getIsExpanded() ? 'none' : undefined,
            display: layoutMode?.startsWith('grid') ? 'flex' : undefined,
            py: !!DetailPanel && row.getIsExpanded() ? '1rem' : 0,
            transition: !virtualRow ? 'all 150ms ease-in-out' : undefined,
            width: `100%`,
          },
          ...(Array.isArray(tableCellProps?.sx)
            ? tableCellProps.sx
            : [tableCellProps?.sx]),
        ]}
      >
        {virtualRow ? (
          row.getIsExpanded() && DetailPanel
        ) : (
          <Collapse in={row.getIsExpanded()} mountOnEnter unmountOnExit>
            {DetailPanel}
          </Collapse>
        )}
      </TableCell>
    </TableRow>
  );
};
