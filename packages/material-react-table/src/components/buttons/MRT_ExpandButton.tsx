import IconButton, { type IconButtonProps } from '@mui/material/IconButton';
import { useTheme } from '@mui/material/styles';
import Tooltip from '@mui/material/Tooltip';
import { useSelector } from '@tanstack/react-store';
import { type MouseEvent } from 'react';

import {
  type MRT_Row,
  type MRT_RowData,
  type MRT_TableInstance,
} from '../../types';
import { getCommonTooltipProps } from '../../utils/style.utils';
import { parseFromValuesOrFunc } from '../../utils/utils';

export interface MRT_ExpandButtonProps<TData extends MRT_RowData>
  extends IconButtonProps {
  row: MRT_Row<TData>;
  staticRowIndex?: number;
  table: MRT_TableInstance<TData>;
}

export const MRT_ExpandButton = <TData extends MRT_RowData>({
  row,
  staticRowIndex,
  table,
}: MRT_ExpandButtonProps<TData>) => {
  const theme = useTheme();
  const {
    options: {
      icons: { ExpandMoreIcon },
      localization,
      muiExpandButtonProps,
      positionExpandColumn,
      renderDetailPanel,
    },
  } = table;
  const density = useSelector(table.atoms.density);
  //not read directly - row.getCanExpand()/getIsExpanded() below read this live.
  useSelector(table.atoms.expanded);

  const iconButtonProps = parseFromValuesOrFunc(muiExpandButtonProps, {
    row,
    staticRowIndex,
    table,
  });

  const canExpand = row.getCanExpand();
  const isExpanded = row.getIsExpanded();

  const handleToggleExpand = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    row.toggleExpanded();
    iconButtonProps?.onClick?.(event);
  };

  const detailPanel = !!renderDetailPanel?.({ row, table });

  return (
    <Tooltip
      disableHoverListener={!canExpand && !detailPanel}
      {...getCommonTooltipProps()}
      title={
        iconButtonProps?.title ??
        (isExpanded ? localization.collapse : localization.expand)
      }
    >
      <span>
        <IconButton
          aria-label={localization.expand}
          disabled={!canExpand && !detailPanel}
          {...iconButtonProps}
          onClick={handleToggleExpand}
          sx={[
            //React Compiler can't lower a computed object key built from a conditional
            //expression, so the RTL-dependent margin side is split into its own object and
            //spread in, instead of `[theme.direction === 'rtl' ? 'mr' : 'ml']: ...`.
            (theme) => ({
              ...(theme.direction === 'rtl' || positionExpandColumn === 'last'
                ? { mr: `${row.depth * 16}px` }
                : { ml: `${row.depth * 16}px` }),
              height: density === 'compact' ? '1.75rem' : '2.25rem',
              opacity: !canExpand && !detailPanel ? 0.3 : 1,
              width: density === 'compact' ? '1.75rem' : '2.25rem',
            }),
            ...(Array.isArray(iconButtonProps?.sx)
              ? iconButtonProps.sx
              : [iconButtonProps?.sx]),
          ]}
          title={undefined}
        >
          {iconButtonProps?.children ?? (
            <ExpandMoreIcon
              style={{
                transform: `rotate(${
                  !canExpand && !renderDetailPanel
                    ? positionExpandColumn === 'last' ||
                      theme.direction === 'rtl'
                      ? 90
                      : -90
                    : isExpanded
                      ? -180
                      : 0
                }deg)`,
                transition: 'transform 150ms',
              }}
            />
          )}
        </IconButton>
      </span>
    </Tooltip>
  );
};
