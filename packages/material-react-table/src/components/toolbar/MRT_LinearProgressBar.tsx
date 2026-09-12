import Collapse from '@mui/material/Collapse';
import LinearProgress, {
  type LinearProgressProps,
} from '@mui/material/LinearProgress';
import { useSelector } from '@tanstack/react-store';

import { type MRT_RowData, type MRT_TableInstance } from '../../types';
import { parseFromValuesOrFunc } from '../../utils/utils';

export interface MRT_LinearProgressBarProps<TData extends MRT_RowData>
  extends LinearProgressProps {
  isTopToolbar: boolean;
  table: MRT_TableInstance<TData>;
}

export const MRT_LinearProgressBar = <TData extends MRT_RowData>({
  isTopToolbar,
  table,
  ...rest
}: MRT_LinearProgressBarProps<TData>) => {
  const {
    options: { muiLinearProgressProps },
  } = table;
  const isSaving = useSelector(table.atoms.isSaving);
  const showProgressBars = useSelector(table.atoms.showProgressBars);

  const linearProgressProps = {
    ...parseFromValuesOrFunc(muiLinearProgressProps, {
      isTopToolbar,
      table,
    }),
    ...rest,
  };

  return (
    <Collapse
      in={showProgressBars !== false && (showProgressBars || isSaving)}
      mountOnEnter
      sx={{
        bottom: isTopToolbar ? 0 : undefined,
        position: 'absolute',
        top: !isTopToolbar ? 0 : undefined,
        width: '100%',
      }}
      unmountOnExit
    >
      <LinearProgress
        aria-busy="true"
        aria-label="Loading"
        sx={{ position: 'relative' }}
        {...linearProgressProps}
      />
    </Collapse>
  );
};
