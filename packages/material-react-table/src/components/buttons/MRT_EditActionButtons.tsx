import Box, { type BoxProps } from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { useSelector } from '@tanstack/react-store';

import {
  type MRT_Row,
  type MRT_RowData,
  type MRT_TableInstance,
} from '../../types';

export interface MRT_EditActionButtonsProps<TData extends MRT_RowData>
  extends BoxProps {
  row: MRT_Row<TData>;
  table: MRT_TableInstance<TData>;
  variant?: 'icon' | 'text';
}

export const MRT_EditActionButtons = <TData extends MRT_RowData>({
  row,
  table,
  variant = 'icon',
  ...rest
}: MRT_EditActionButtonsProps<TData>) => {
  const {
    options: {
      icons: { CancelIcon, SaveIcon },
      localization,
      onCreatingRowCancel,
      onCreatingRowSave,
      onEditingRowCancel,
      onEditingRowSave,
    },
    refs: { editInputRefs },
    setCreatingRow,
    setEditingRow,
    setEditingRowValuesCache,
  } = table;
  const creatingRow = useSelector(table.atoms.creatingRow);
  const editingRow = useSelector(table.atoms.editingRow);
  const editingRowValuesCache = useSelector(
    table.atoms.editingRowValuesCache,
  );
  const isSaving = useSelector(table.atoms.isSaving);

  const isCreating = creatingRow?.id === row.id;
  const isEditing = editingRow?.id === row.id;

  const handleCancel = () => {
    if (isCreating) {
      onCreatingRowCancel?.({ row, table });
      setCreatingRow(null);
    } else if (isEditing) {
      onEditingRowCancel?.({ row, table });
      setEditingRow(null);
    }
    setEditingRowValuesCache((prev) => ({ ...prev, [row.id]: {} })); //reset values cache
  };

  const handleSubmitRow = () => {
    const values = { ...editingRowValuesCache[row.id] };
    //look for auto-filled input values
    Object.values(editInputRefs.current ?? {})
      .filter((inputRef) => row.id === inputRef?.name?.split('_')?.[0])
      ?.forEach((input) => {
        if (input.value !== undefined && Object.hasOwn(values, input.name)) {
          values[input.name] = input.value;
        }
      });
    setEditingRowValuesCache((prev) => ({ ...prev, [row.id]: values }));
    if (isCreating)
      onCreatingRowSave?.({
        exitCreatingMode: () => setCreatingRow(null),
        row,
        table,
        values: values as any,
      });
    else if (isEditing) {
      onEditingRowSave?.({
        exitEditingMode: () => setEditingRow(null),
        row,
        table,
        values: values as any,
      });
    }
  };

  return (
    <Box
      onClick={(e) => e.stopPropagation()}
      sx={[
        {
          display: 'flex',
          gap: '0.75rem',
        },
        ...(Array.isArray(rest?.sx) ? rest.sx : [rest?.sx]),
      ]}
    >
      {variant === 'icon' ? (
        <>
          <Tooltip title={localization.cancel}>
            <IconButton aria-label={localization.cancel} onClick={handleCancel}>
              <CancelIcon />
            </IconButton>
          </Tooltip>
          {((isCreating && onCreatingRowSave) ||
            (isEditing && onEditingRowSave)) && (
              <Tooltip title={localization.save}>
                <IconButton
                  aria-label={localization.save}
                  color="info"
                  disabled={isSaving}
                  onClick={handleSubmitRow}
                >
                  {isSaving ? <CircularProgress size={18} /> : <SaveIcon />}
                </IconButton>
              </Tooltip>
            )}
        </>
      ) : (
        <>
          <Button onClick={handleCancel} sx={{ minWidth: '100px' }}>
            {localization.cancel}
          </Button>
          <Button
            disabled={isSaving}
            onClick={handleSubmitRow}
            sx={{ minWidth: '100px' }}
            variant="contained"
          >
            {isSaving && <CircularProgress color="inherit" size={18} />}
            {localization.save}
          </Button>
        </>
      )}
    </Box>
  );
};
