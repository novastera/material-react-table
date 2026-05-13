import { type CSSProperties } from 'react';
import { type TableCellProps } from '@mui/material/TableCell';
import { type TooltipProps } from '@mui/material/Tooltip';
import { alpha, darken, lighten } from '@mui/material/styles';
import { type SxProps } from '@mui/material';
import { type Theme } from '@mui/material/styles';
import {
  type MRT_Column,
  type MRT_Header,
  type MRT_RowData,
  type MRT_TableInstance,
  type MRT_TableOptions,
  type MRT_Theme,
} from '../types';
import { parseFromValuesOrFunc } from './utils';

export const parseCSSVarId = (id: string) => id.replace(/[^a-zA-Z0-9]/g, '_');

const colorManipulatableCache = new Map<string, boolean>();

const isCssVariableColor = (color: string) => color.includes('var(');
const isColorMixExpression = (color: string) => color.trim().startsWith('color-mix(');
const toPercent = (value: number) => `${Math.round(value * 10000) / 100}%`;

const colorMix = ({
  color,
  mixWith,
  amount,
}: {
  amount: number;
  color: string;
  mixWith: string;
}) => `color-mix(in srgb, ${color}, ${mixWith} ${toPercent(amount)})`;

export const isColorManipulatable = (color: string): boolean => {
  const cachedResult = colorManipulatableCache.get(color);
  if (cachedResult !== undefined) {
    return cachedResult;
  }

  // Fast path for CssVars and nested color-mix expressions.
  if (isCssVariableColor(color) || isColorMixExpression(color)) {
    colorManipulatableCache.set(color, false);
    return false;
  }

  try {
    alpha(color, 1);
    colorManipulatableCache.set(color, true);
    return true;
  } catch {
    colorManipulatableCache.set(color, false);
    return false;
  }
};

export const resolveColorForColorMath = ({
  color,
  fallbackColor,
}: {
  color: string;
  fallbackColor: string;
}) => (isColorManipulatable(color) ? color : fallbackColor);

export const resolveBaseBackgroundForColorTools = (
  muiTheme: Theme,
  baseBackgroundColor: string,
): string =>
  resolveColorForColorMath({
    color: baseBackgroundColor,
    fallbackColor:
      muiTheme.palette.mode === 'dark'
        ? muiTheme.palette.background.default
        : muiTheme.palette.background.paper,
  });

export const mrtLighten = ({
  color,
  fallbackColor,
  amount,
}: {
  amount: number;
  color: string;
  fallbackColor: string;
}) =>
  isColorManipulatable(color)
    ? lighten(color, amount)
    : isCssVariableColor(color) || isColorMixExpression(color)
      ? colorMix({ amount, color, mixWith: 'white' })
      : lighten(fallbackColor, amount);

export const mrtDarken = ({
  color,
  fallbackColor,
  amount,
}: {
  amount: number;
  color: string;
  fallbackColor: string;
}) =>
  isColorManipulatable(color)
    ? darken(color, amount)
    : isCssVariableColor(color) || isColorMixExpression(color)
      ? colorMix({ amount, color, mixWith: 'black' })
      : darken(fallbackColor, amount);

export const mrtAlpha = ({
  color,
  fallbackColor,
  amount,
}: {
  amount: number;
  color: string;
  fallbackColor: string;
}) =>
  isColorManipulatable(color)
    ? alpha(color, amount)
    : isCssVariableColor(color) || isColorMixExpression(color)
      ? `color-mix(in srgb, ${color} ${toPercent(amount)}, transparent)`
      : alpha(fallbackColor, amount);

export const getMRTTheme = <TData extends MRT_RowData>(
  mrtTheme: MRT_TableOptions<TData>['mrtTheme'],
  muiTheme: Theme,
): MRT_Theme => {
  const mrtThemeOverrides = parseFromValuesOrFunc(mrtTheme, muiTheme);
  const baseBackgroundColor =
    mrtThemeOverrides?.baseBackgroundColor ??
    (muiTheme.palette.mode === 'dark'
      ? lighten(muiTheme.palette.background.default, 0.05)
      : muiTheme.palette.background.default);
  const baseBackgroundColorForColorTools = resolveBaseBackgroundForColorTools(
    muiTheme,
    baseBackgroundColor,
  );
  return {
    baseBackgroundColor,
    cellNavigationOutlineColor: muiTheme.palette.primary.main,
    draggingBorderColor: muiTheme.palette.primary.main,
    matchHighlightColor:
      muiTheme.palette.mode === 'dark'
        ? darken(muiTheme.palette.warning.dark, 0.25)
        : lighten(muiTheme.palette.warning.light, 0.5),
    menuBackgroundColor: mrtLighten({
      amount: 0.07,
      color: baseBackgroundColor,
      fallbackColor: baseBackgroundColorForColorTools,
    }),
    pinnedRowBackgroundColor: alpha(muiTheme.palette.primary.main, 0.1),
    selectedRowBackgroundColor: alpha(muiTheme.palette.primary.main, 0.2),
    ...mrtThemeOverrides,
  };
};

export const commonCellBeforeAfterStyles = {
  content: '""',
  height: '100%',
  left: 0,
  position: 'absolute',
  top: 0,
  width: '100%',
  zIndex: -1,
};

export const getCommonPinnedCellStyles = <TData extends MRT_RowData>({
  column,
  table,
  theme,
}: {
  column?: MRT_Column<TData>;
  table: MRT_TableInstance<TData>;
  theme: Theme;
}): SxProps<Theme> => {
  const { baseBackgroundColor } = table.options.mrtTheme;
  const baseBackgroundColorForColorTools = resolveBaseBackgroundForColorTools(
    theme,
    baseBackgroundColor,
  );
  const isPinned = column?.getIsPinned();

  return {
    '&[data-pinned="true"]': {
      '&:before': {
        backgroundColor: mrtAlpha({
          amount: 0.97,
          color: mrtDarken({
            amount: theme.palette.mode === 'dark' ? 0.05 : 0.01,
            color: baseBackgroundColor,
            fallbackColor: baseBackgroundColorForColorTools,
          }),
          fallbackColor: baseBackgroundColorForColorTools,
        }),
        boxShadow: column
          ? isPinned === 'left' && column.getIsLastColumn(isPinned)
            ? `-4px 0 4px -4px ${alpha(theme.palette.grey[700], 0.5)} inset`
            : isPinned === 'right' && column.getIsFirstColumn(isPinned)
              ? `4px 0 4px -4px ${alpha(theme.palette.grey[700], 0.5)} inset`
              : 'none'
          : 'none',
        ...commonCellBeforeAfterStyles,
      },
    },
  };
};

export const getCommonMRTCellStyles = <TData extends MRT_RowData>({
  column,
  header,
  table,
  tableCellProps,
  theme,
}: {
  column: MRT_Column<TData>;
  header?: MRT_Header<TData>;
  table: MRT_TableInstance<TData>;
  tableCellProps: TableCellProps;
  theme: Theme;
}): SxProps<Theme> => {
  const {
    getState,
    options: { enableColumnVirtualization, layoutMode },
  } = table;
  const { draggingColumn } = getState();
  const { columnDef } = column;
  const { columnDefType } = columnDef;

  const isColumnPinned =
    columnDef.columnDefType !== 'group' && column.getIsPinned();

  const widthStyles: CSSProperties = {
    minWidth: `max(calc(var(--${header ? 'header' : 'col'}-${parseCSSVarId(
      header?.id ?? column.id,
    )}-size) * 1px), ${columnDef.minSize ?? 30}px)`,
    width: `calc(var(--${header ? 'header' : 'col'}-${parseCSSVarId(
      header?.id ?? column.id,
    )}-size) * 1px)`,
  };

  if (layoutMode === 'grid') {
    widthStyles.flex = `${
      [0, false].includes(columnDef.grow!)
        ? 0
        : `var(--${header ? 'header' : 'col'}-${parseCSSVarId(
            header?.id ?? column.id,
          )}-size)`
    } 0 auto`;
  } else if (layoutMode === 'grid-no-grow') {
    widthStyles.flex = `${+(columnDef.grow || 0)} 0 auto`;
  }

  const pinnedStyles: SxProps<Theme> = isColumnPinned
    ? {
        ...(getCommonPinnedCellStyles({ column, table, theme }) as any),
        left:
          isColumnPinned === 'left'
            ? `${column.getStart('left')}px`
            : undefined,
        opacity: 0.97,
        position: 'sticky',
        right:
          isColumnPinned === 'right'
            ? `${column.getAfter('right')}px`
            : undefined,
      }
    : {};

  return [
    {
      backgroundColor: 'inherit',
      backgroundImage: 'inherit',
      display: layoutMode?.startsWith('grid') ? 'flex' : undefined,
      justifyContent:
        columnDefType === 'group'
          ? 'center'
          : layoutMode?.startsWith('grid')
            ? tableCellProps.align === 'left'
              ? 'flex-start'
              : tableCellProps.align === 'right'
                ? 'flex-end'
                : tableCellProps.align === 'justify'
                  ? 'space-between'
                  : tableCellProps.align
            : undefined,
      opacity:
        table.getState().draggingColumn?.id === column.id ||
        table.getState().hoveredColumn?.id === column.id
          ? 0.5
          : 1,
      position: 'relative',
      transition: enableColumnVirtualization
        ? 'none'
        : `padding 150ms ease-in-out`,
      zIndex:
        column.getIsResizing() || draggingColumn?.id === column.id
          ? 2
          : columnDefType !== 'group' && isColumnPinned
            ? 1
            : 0,
      '&:focus-visible': {
        outline: `2px solid ${table.options.mrtTheme.cellNavigationOutlineColor}`,
        outlineOffset: '-2px',
      },
    },
    pinnedStyles,
    widthStyles,
  ] as SxProps<Theme>;
};

export const getCommonToolbarStyles = <TData extends MRT_RowData>({
  table,
}: {
  table: MRT_TableInstance<TData>;
  theme: Theme;
}): SxProps<Theme> => ({
  alignItems: 'flex-start',
  backgroundColor: table.options.mrtTheme.baseBackgroundColor,
  display: 'grid',
  flexWrap: 'wrap-reverse',
  minHeight: '3.5rem',
  overflow: 'hidden',
  position: 'relative',
  transition: 'all 150ms ease-in-out',
  zIndex: 1,
});

export const flipIconStyles = (theme: Theme) =>
  theme.direction === 'rtl'
    ? { style: { transform: 'scaleX(-1)' } }
    : undefined;

export const getCommonTooltipProps = (
  placement?: TooltipProps['placement'],
): Partial<TooltipProps> => ({
  disableInteractive: true,
  enterDelay: 1000,
  enterNextDelay: 1000,
  placement,
});
