import TableContainer, {
  type TableContainerProps,
} from '@mui/material/TableContainer';
import { useSelector } from '@tanstack/react-store';
import { useEffect, useLayoutEffect, useState } from 'react';

import { type MRT_RowData, type MRT_TableInstance } from '../../types';
import { mergeRefs, parseFromValuesOrFunc } from '../../utils/utils';
import { MRT_CellActionMenu } from '../menus/MRT_CellActionMenu';
import { MRT_EditRowModal } from '../modals/MRT_EditRowModal';
import { MRT_Table } from './MRT_Table';
import { MRT_TableLoadingOverlay } from './MRT_TableLoadingOverlay';

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export interface MRT_TableContainerProps<TData extends MRT_RowData>
  extends TableContainerProps {
  table: MRT_TableInstance<TData>;
}

export const MRT_TableContainer = <TData extends MRT_RowData>({
  table,
  ...rest
}: MRT_TableContainerProps<TData>) => {
  const {
    options: {
      createDisplayMode,
      editDisplayMode,
      enableCellActions,
      enableStickyHeader,
      muiTableContainerProps,
    },
    refs: { bottomToolbarRef, tableContainerRef, topToolbarRef },
  } = table;
  const actionCell = useSelector(table.atoms.actionCell);
  const creatingRow = useSelector(table.atoms.creatingRow);
  const editingRow = useSelector(table.atoms.editingRow);
  const isFullScreen = useSelector(table.atoms.isFullScreen);
  const isLoading = useSelector(table.atoms.isLoading);
  const showLoadingOverlay = useSelector(table.atoms.showLoadingOverlay);

  const loading =
    showLoadingOverlay !== false && (isLoading || showLoadingOverlay);

  const [totalToolbarHeight, setTotalToolbarHeight] = useState(0);

  const tableContainerProps = {
    ...parseFromValuesOrFunc(muiTableContainerProps, {
      table,
    }),
    ...rest,
  };

  useIsomorphicLayoutEffect(() => {
    const topToolbarHeight =
      typeof document !== 'undefined'
        ? (topToolbarRef.current?.offsetHeight ?? 0)
        : 0;

    const bottomToolbarHeight =
      typeof document !== 'undefined'
        ? (bottomToolbarRef?.current?.offsetHeight ?? 0)
        : 0;

    setTotalToolbarHeight(topToolbarHeight + bottomToolbarHeight);
  });

  const createModalOpen = createDisplayMode === 'modal' && creatingRow;
  const editModalOpen = editDisplayMode === 'modal' && editingRow;

  return (
    <TableContainer
      aria-busy={loading}
      aria-describedby={loading ? 'mrt-progress' : undefined}
      {...tableContainerProps}
      ref={(node: HTMLDivElement) => {
        if (node) mergeRefs(tableContainerRef, tableContainerProps?.ref)(node);
      }}
      style={{
        maxHeight: isFullScreen
          ? `calc(100vh - ${totalToolbarHeight}px)`
          : undefined,
        ...tableContainerProps?.style,
      }}
      sx={[
        {
          maxHeight: enableStickyHeader
            ? `clamp(350px, calc(100vh - ${totalToolbarHeight}px), 9999px)`
            : undefined,
          maxWidth: '100%',
          overflow: 'auto',
          position: 'relative',
        },
        ...(Array.isArray(tableContainerProps?.sx)
          ? tableContainerProps.sx
          : [tableContainerProps?.sx]),
      ]}
    >
      {loading ? <MRT_TableLoadingOverlay table={table} /> : null}
      <MRT_Table table={table} />
      {(createModalOpen || editModalOpen) && (
        <MRT_EditRowModal open table={table} />
      )}
      {enableCellActions && actionCell && <MRT_CellActionMenu table={table} />}
    </TableContainer>
  );
};
