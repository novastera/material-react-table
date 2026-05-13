import Checkbox, { type CheckboxProps } from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Tooltip from '@mui/material/Tooltip';
import {
  type MRT_Column,
  type MRT_RowData,
  type MRT_TableInstance,
} from '../../types';
import { getCommonTooltipProps } from '../../utils/style.utils';
import { parseFromValuesOrFunc } from '../../utils/utils';

export interface MRT_FilterCheckboxProps<TData extends MRT_RowData>
  extends CheckboxProps {
  column: MRT_Column<TData>;
  table: MRT_TableInstance<TData>;
}

export const MRT_FilterCheckbox = <TData extends MRT_RowData>({
  column,
  table,
  ...rest
}: MRT_FilterCheckboxProps<TData>) => {
  const {
    getState,
    options: { localization, muiFilterCheckboxProps },
  } = table;
  const { density } = getState();
  const { columnDef } = column;

  const {
    inputProps: muiInputProps,
    slotProps: muiSlotProps,
    ...checkboxProps
  } = {
    ...parseFromValuesOrFunc(muiFilterCheckboxProps, {
      column,
      table,
    }),
    ...parseFromValuesOrFunc(columnDef.muiFilterCheckboxProps, {
      column,
      table,
    }),
  } as any;

  const filterLabel = localization.filterByColumn?.replace(
    '{column}',
    columnDef.header,
  );

  return (
    <Tooltip
      {...getCommonTooltipProps()}
      title={checkboxProps?.title ?? filterLabel}
    >
      <FormControlLabel
        control={
          <Checkbox
            checked={column.getFilterValue() === 'true'}
            color={
              column.getFilterValue() === undefined ? 'default' : 'primary'
            }
            indeterminate={column.getFilterValue() === undefined}
            size={density === 'compact' ? 'small' : 'medium'}
            slotProps={{
              ...muiSlotProps,
              input: {
                'aria-label': filterLabel,
                ...muiInputProps,
                ...muiSlotProps?.input,
              },
            }}
            {...checkboxProps}
            {...rest}
            onChange={(e, checked) => {
              column.setFilterValue(
                column.getFilterValue() === undefined
                  ? 'true'
                  : column.getFilterValue() === 'true'
                    ? 'false'
                    : undefined,
              );
              (checkboxProps as any)?.onChange?.(e, checked);
              rest?.onChange?.(e, checked);
            }}
            onClick={(e) => {
              e.stopPropagation();
              (checkboxProps as any)?.onClick?.(e);
              rest?.onClick?.(e);
            }}
            sx={(theme) => [
              {
                height: '2.5rem',
                width: '2.5rem',
              },
              ...[parseFromValuesOrFunc((checkboxProps as any)?.sx, theme)].flat(),
              ...[parseFromValuesOrFunc(rest?.sx, theme)].flat(),
            ]}
          />
        }
        disableTypography
        label={checkboxProps.title ?? filterLabel}
        sx={{ color: 'text.secondary', fontWeight: 'normal', mt: '-4px' }}
        title={undefined}
      />
    </Tooltip>
  );
};
