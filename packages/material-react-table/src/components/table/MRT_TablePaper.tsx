import { closestCenter, DndContext } from '@dnd-kit/core';
import Paper, { type PaperProps } from '@mui/material/Paper';
import { useTheme } from '@mui/material/styles';
import { useSelector } from '@tanstack/react-store';

import { useMRT_DragAndDrop } from '../../hooks/useMRT_DragAndDrop';
import { type MRT_RowData, type MRT_TableInstance } from '../../types';
import { mergeRefs, parseFromValuesOrFunc } from '../../utils/utils';
import { MRT_BottomToolbar } from '../toolbar/MRT_BottomToolbar';
import { MRT_TopToolbar } from '../toolbar/MRT_TopToolbar';
import { MRT_TableContainer } from './MRT_TableContainer';

export interface MRT_TablePaperProps<TData extends MRT_RowData>
  extends PaperProps {
  table: MRT_TableInstance<TData>;
}

export const MRT_TablePaper = <TData extends MRT_RowData>({
  table,
  ...rest
}: MRT_TablePaperProps<TData>) => {
  const {
    options: {
      enableBottomToolbar,
      enableTopToolbar,
      mrtTheme: { baseBackgroundColor },
      muiTablePaperProps,
      renderBottomToolbar,
      renderTopToolbar,
    },
    refs: { tablePaperRef },
  } = table;
  const isFullScreen = useSelector(table.atoms.isFullScreen);
  const { handleDragEnd, handleDragOver, handleDragStart, modifiers, sensors } =
    useMRT_DragAndDrop(table);

  const paperProps = {
    ...parseFromValuesOrFunc(muiTablePaperProps, { table }),
    ...rest,
  };

  const theme = useTheme();

  return (
    <Paper
      elevation={2}
      onKeyDown={(e) => e.key === 'Escape' && table.setIsFullScreen(false)}
      {...paperProps}
      ref={mergeRefs(tablePaperRef, paperProps?.ref)}
      style={{
        ...(isFullScreen
          ? {
              bottom: 0,
              height: '100dvh',
              left: 0,
              margin: 0,
              maxHeight: '100dvh',
              maxWidth: '100dvw',
              padding: 0,
              position: 'fixed',
              right: 0,
              top: 0,
              width: '100dvw',
              zIndex: theme.zIndex.modal,
            }
          : {}),
        ...paperProps?.style,
      }}
      sx={[
        {
          backgroundColor: baseBackgroundColor,
          backgroundImage: 'unset',
          overflow: 'hidden',
          transition: 'all 100ms ease-in-out',
        },
        ...(Array.isArray(paperProps?.sx) ? paperProps.sx : [paperProps?.sx]),
      ]}
    >
      <DndContext
        collisionDetection={closestCenter}
        modifiers={modifiers}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragStart={handleDragStart}
        sensors={sensors}
      >
        {enableTopToolbar &&
          (parseFromValuesOrFunc(renderTopToolbar, { table }) ?? (
            <MRT_TopToolbar table={table} />
          ))}
        <MRT_TableContainer table={table} />
        {enableBottomToolbar &&
          (parseFromValuesOrFunc(renderBottomToolbar, { table }) ?? (
            <MRT_BottomToolbar table={table} />
          ))}
      </DndContext>
    </Paper>
  );
};
