import {
  type DraggableAttributes,
  type DraggableSyntheticListeners,
} from '@dnd-kit/core';
import IconButton, { type IconButtonProps } from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { type Ref } from 'react';

import { type MRT_RowData, type MRT_TableInstance } from '../../types';
import { getCommonTooltipProps } from '../../utils/style.utils';

export interface MRT_GrabHandleButtonProps<TData extends MRT_RowData>
  extends IconButtonProps {
  activatorRef?: Ref<HTMLButtonElement>;
  attributes?: DraggableAttributes;
  iconButtonProps?: IconButtonProps;
  listeners?: DraggableSyntheticListeners;
  location?: 'column' | 'row';
  table: MRT_TableInstance<TData>;
}

export const MRT_GrabHandleButton = <TData extends MRT_RowData>({
  activatorRef,
  attributes,
  listeners,
  location,
  table,
  ...rest
}: MRT_GrabHandleButtonProps<TData>) => {
  const {
    options: {
      icons: { DragHandleIcon },
      localization,
    },
  } = table;

  return (
    <Tooltip
      {...getCommonTooltipProps('top')}
      title={rest?.title ?? localization.move}
    >
      <IconButton
        aria-label={rest.title ?? localization.move}
        disableRipple
        ref={activatorRef}
        size="small"
        {...attributes}
        {...listeners}
        {...rest}
        onClick={(e) => {
          e.stopPropagation();
          rest?.onClick?.(e);
        }}
        sx={[
          {
            '&:active': {
              cursor: 'grabbing',
            },
            '&:hover': {
              backgroundColor: 'transparent',
              opacity: 1,
            },
            cursor: 'grab',
            m: '0 -0.1rem',
            opacity: location === 'row' ? 1 : 0.5,
            p: '2px',
            transition: 'all 150ms ease-in-out',
          },
          ...(Array.isArray(rest?.sx) ? rest.sx : [rest?.sx]),
        ]}
        title={undefined}
      >
        <DragHandleIcon />
      </IconButton>
    </Tooltip>
  );
};
