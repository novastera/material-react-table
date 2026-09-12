import IconButton, { type IconButtonProps } from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { useSelector } from '@tanstack/react-store';

import { type MRT_RowData, type MRT_TableInstance } from '../../types';
import { getCommonTooltipProps } from '../../utils/style.utils';
import { parseFromValuesOrFunc } from '../../utils/utils';

export interface MRT_ExpandAllButtonProps<TData extends MRT_RowData>
  extends IconButtonProps {
  table: MRT_TableInstance<TData>;
}

export const MRT_ExpandAllButton = <TData extends MRT_RowData>({
  table,
  ...rest
}: MRT_ExpandAllButtonProps<TData>) => {
  const {
    getCanSomeRowsExpand,
    getIsAllRowsExpanded,
    getIsSomeRowsExpanded,
    options: {
      icons: { KeyboardDoubleArrowDownIcon },
      localization,
      muiExpandAllButtonProps,
      renderDetailPanel,
    },
    toggleAllRowsExpanded,
  } = table;
  const density = useSelector(table.atoms.density);
  const isLoading = useSelector(table.atoms.isLoading);
  //not read directly - getIsAllRowsExpanded()/getCanSomeRowsExpand()/getIsSomeRowsExpanded()
  //below read this live, but this component needs its own subscription to know when to
  //re-render, rather than relying on an ancestor's re-render to happen to catch it.
  useSelector(table.atoms.expanded);

  const iconButtonProps = {
    ...parseFromValuesOrFunc(muiExpandAllButtonProps, {
      table,
    }),
    ...rest,
  };

  const isAllRowsExpanded = getIsAllRowsExpanded();

  return (
    <Tooltip
      {...getCommonTooltipProps()}
      title={
        iconButtonProps?.title ??
        (isAllRowsExpanded ? localization.collapseAll : localization.expandAll)
      }
    >
      <span>
        <IconButton
          aria-label={localization.expandAll}
          disabled={
            isLoading || (!renderDetailPanel && !getCanSomeRowsExpand())
          }
          onClick={() => toggleAllRowsExpanded(!isAllRowsExpanded)}
          {...iconButtonProps}
          sx={[
            {
              height: density === 'compact' ? '1.75rem' : '2.25rem',
              mt: density !== 'compact' ? '-0.25rem' : undefined,
              width: density === 'compact' ? '1.75rem' : '2.25rem',
            },
            ...(Array.isArray(iconButtonProps?.sx)
              ? iconButtonProps.sx
              : [iconButtonProps?.sx]),
          ]}
          title={undefined}
        >
          {iconButtonProps?.children ?? (
            <KeyboardDoubleArrowDownIcon
              style={{
                transform: `rotate(${
                  isAllRowsExpanded ? -180 : getIsSomeRowsExpanded() ? -90 : 0
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
