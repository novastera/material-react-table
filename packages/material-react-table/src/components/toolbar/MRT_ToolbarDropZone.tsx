import { useDroppable } from '@dnd-kit/core';
import Box, { type BoxProps } from '@mui/material/Box';
import Fade from '@mui/material/Fade';
import { alpha } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { useSelector } from '@tanstack/react-store';
import { useEffect } from 'react';

import {
  type MRT_Column,
  type MRT_RowData,
  type MRT_TableInstance,
} from '../../types';

export interface MRT_ToolbarDropZoneProps<TData extends MRT_RowData>
  extends BoxProps {
  table: MRT_TableInstance<TData>;
}

export const MRT_ToolbarDropZone = <TData extends MRT_RowData>({
  table,
  ...rest
}: MRT_ToolbarDropZoneProps<TData>) => {
  const {
    options: { enableGrouping, localization },
    setShowToolbarDropZone,
  } = table;

  //cast needed because table.atoms.draggingColumn's static type is the minimal `{ id }` shape
  //(see mrtStateFeature.ts) - at runtime this atom always holds a real MRT_Column<TData>, and
  //this file is the one place (besides .id checks elsewhere) that needs .columnDef off it.
  const draggingColumn = useSelector(
    table.atoms.draggingColumn,
  ) as MRT_Column<TData> | null;
  const grouping = useSelector(table.atoms.grouping);
  const hoveredColumn = useSelector(table.atoms.hoveredColumn);
  const showToolbarDropZone = useSelector(table.atoms.showToolbarDropZone);

  //not sortable - just a drop target. Hover detection (setHoveredColumn) lives in
  //useMRT_DragAndDrop.ts's shared onDragOver, keyed off this 'drop-zone' sentinel id.
  const { setNodeRef } = useDroppable({
    disabled: !enableGrouping,
    id: 'drop-zone',
  });

  useEffect(() => {
    if (table.options.state?.showToolbarDropZone !== undefined) {
      setShowToolbarDropZone(
        !!enableGrouping &&
          !!draggingColumn &&
          draggingColumn.columnDef.enableGrouping !== false &&
          !grouping.includes(draggingColumn.id),
      );
    }
  }, [enableGrouping, draggingColumn, grouping]);

  return (
    <Fade in={showToolbarDropZone}>
      <Box
        className="Mui-ToolbarDropZone"
        ref={setNodeRef}
        {...rest}
        sx={[
          (theme) => ({
            alignItems: 'center',
            backdropFilter: 'blur(4px)',
            backgroundColor: alpha(
              theme.palette.info.main,
              hoveredColumn?.id === 'drop-zone' ? 0.2 : 0.1,
            ),
            border: `dashed ${theme.palette.info.main} 2px`,
            boxSizing: 'border-box',
            display: 'flex',
            height: '100%',
            justifyContent: 'center',
            position: 'absolute',
            width: '100%',
            zIndex: 4,
          }),
          ...(Array.isArray(rest?.sx) ? rest.sx : [rest?.sx]),
        ]}
      >
        <Typography sx={{ fontStyle: 'italic' }}>
          {localization.dropToGroupBy.replace(
            '{column}',
            draggingColumn?.columnDef?.header ?? '',
          )}
        </Typography>
      </Box>
    </Fade>
  );
};
