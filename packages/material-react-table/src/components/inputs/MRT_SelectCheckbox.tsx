import Checkbox, { type CheckboxProps } from '@mui/material/Checkbox';
import Radio, { type RadioProps } from '@mui/material/Radio';
import { type Theme } from '@mui/material/styles';
import Tooltip from '@mui/material/Tooltip';
import { useSelector } from '@tanstack/react-store';
import { type ChangeEvent, type MouseEvent } from 'react';

import {
  type MRT_Row,
  type MRT_RowData,
  type MRT_TableInstance,
} from '../../types';
import {
  getIsRowSelected,
  getMRT_RowSelectionHandler,
  getMRT_SelectAllHandler,
} from '../../utils/row.utils';
import { getCommonTooltipProps } from '../../utils/style.utils';
import { parseFromValuesOrFunc } from '../../utils/utils';

export interface MRT_SelectCheckboxProps<TData extends MRT_RowData>
  extends CheckboxProps {
  row?: MRT_Row<TData>;
  staticRowIndex?: number;
  table: MRT_TableInstance<TData>;
}

export const MRT_SelectCheckbox = <TData extends MRT_RowData>({
  row,
  staticRowIndex,
  table,
  ...rest
}: MRT_SelectCheckboxProps<TData>) => {
  const {
    options: {
      enableMultiRowSelection,
      localization,
      muiSelectAllCheckboxProps,
      muiSelectCheckboxProps,
      selectAllMode,
    },
  } = table;
  const density = useSelector(table.atoms.density);
  const isLoading = useSelector(table.atoms.isLoading);
  //not read directly - table.getIsAllRowsSelected()/getIsSomeRowsSelected()/
  //getIsRowSelected()/row.getIsSomeSelected() below all read this live, but this component
  //needs its own subscription (this is the actual checkbox - the component most directly
  //affected if it goes stale) to know when to re-render.
  useSelector(table.atoms.rowSelection);

  const selectAll = !row;

  const allRowsSelected = selectAll
    ? selectAllMode === 'page'
      ? table.getIsAllPageRowsSelected()
      : table.getIsAllRowsSelected()
    : undefined;

  const isChecked = selectAll
    ? allRowsSelected
    : getIsRowSelected({ row, table });

  const {
    inputProps: muiInputProps,
    slotProps: muiSlotProps,
    ...checkboxProps
  } = ((selectAll
    ? parseFromValuesOrFunc(muiSelectAllCheckboxProps, { table })
    : parseFromValuesOrFunc(muiSelectCheckboxProps, {
      row,
      staticRowIndex,
      table,
    })) ?? {}) as any;

  const onSelectionChange = row
    ? getMRT_RowSelectionHandler({
      row,
      staticRowIndex,
      table,
    })
    : undefined;

  const onSelectAllChange = getMRT_SelectAllHandler({ table });

  const commonProps = {
    'aria-label': selectAll
      ? localization.toggleSelectAll
      : localization.toggleSelectRow,
    checked: isChecked,
    disabled:
      isLoading || (row && !row.getCanSelect()) || row?.id === 'mrt-row-create',
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      event.stopPropagation();
      if (selectAll) {
        onSelectAllChange(event);
      } else {
        onSelectionChange!(event);
      }
    },
    size: (density === 'compact' ? 'small' : 'medium') as 'medium' | 'small',
    slotProps: {
      ...muiSlotProps,
      input: {
        'aria-label': selectAll
          ? localization.toggleSelectAll
          : localization.toggleSelectRow,
        ...muiInputProps,
        ...muiSlotProps?.input,
      },
    },
    ...checkboxProps,
    ...rest,
    onClick: (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      (checkboxProps as any)?.onClick?.(e);
      rest?.onClick?.(e);
    },
    sx: (theme: Theme) => ({
      height: density === 'compact' ? '1.75rem' : '2.5rem',
      m: density !== 'compact' ? '-0.4rem' : undefined,
      width: density === 'compact' ? '1.75rem' : '2.5rem',
      zIndex: 0,
      ...parseFromValuesOrFunc((checkboxProps as any)?.sx, theme),
      ...parseFromValuesOrFunc(rest?.sx, theme),
    }),
    title: undefined,
  } as unknown as CheckboxProps | RadioProps;

  return (
    <Tooltip
      {...getCommonTooltipProps()}
      title={
        checkboxProps?.title ??
        (selectAll
          ? localization.toggleSelectAll
          : localization.toggleSelectRow)
      }
    >
      {enableMultiRowSelection === false ? (
        <Radio {...(commonProps as any)} />
      ) : (
        <Checkbox
          indeterminate={
            !isChecked && selectAll
              ? table.getIsSomeRowsSelected()
              : row?.getIsSomeSelected() && row.getCanSelectSubRows()
          }
          {...commonProps}
        />
      )}
    </Tooltip>
  );
};
