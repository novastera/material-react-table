import { type SxProps } from '@mui/material';
import { alpha, darken, lighten } from '@mui/material/styles';
import { type Theme } from '@mui/material/styles';
import { type TableCellProps } from '@mui/material/TableCell';
import { type TooltipProps } from '@mui/material/Tooltip';
import { type CSSProperties } from 'react';

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
  amount,
  color,
  mixWith,
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
  amount,
  color,
  fallbackColor,
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
  amount,
  color,
  fallbackColor,
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
  amount,
  color,
  fallbackColor,
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
          ? isPinned === 'start' && column.getIsLastColumn(isPinned)
            ? `-4px 0 4px -4px ${alpha(theme.palette.grey[700], 0.5)} inset`
            : isPinned === 'end' && column.getIsFirstColumn(isPinned)
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
  //An honest array return type, not the broader SxProps<Theme> (which also permits a single
  //object or a theme callback) - callers spread this directly into their own sx arrays
  //(`...getCommonMRTCellStyles(...)`), which needs this to actually be an array, not just
  //assignable to a type that might be one.
}): SxProps<Theme>[] => {
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

  //no explicit SxProps<Theme> annotation - this is always a plain object at runtime (never a
  //function or array), and letting TypeScript infer that concrete shape (rather than widening it
  //to the full SxProps union) is what lets it slot into the sx array returned below without a cast.
  const pinnedStyles = isColumnPinned
    ? {
        ...getCommonPinnedCellStyles({ column, table, theme }),
        insetInlineEnd:
          isColumnPinned === 'end'
            ? `${column.getAfter('end')}px`
            : undefined,
        insetInlineStart:
          isColumnPinned === 'start'
            ? `${column.getStart('start')}px`
            : undefined,
        opacity: 0.97,
        position: 'sticky',
      }
    : {};

  //An array, per MUI's own documented sx pattern ("using array syntax is preferred over object
  //spreading to ensure styles are merged correctly" - MUI's sx-prop docs) - each entry here is a
  //separate concern (base styles, pinned-column overrides, width/flex sizing), left as a
  //MUI-native sx array instead of collapsed into one object. Every call site must therefore spread
  //this array INTO its own sx array (`sx={[...getCommonMRTCellStyles(...), ...]}`), not
  //object-spread it inside a single entry (`sx={[{...getCommonMRTCellStyles(...)}]}`) - the latter
  //silently produces `{0: {...}, 1: pinnedStyles, 2: widthStyles}` (numeric keys, not CSS
  //properties MUI's sx engine recognizes), which is exactly how `widthStyles` (flex/width/minWidth,
  //the properties column resizing depends on) previously never reached the DOM at all despite this
  //function computing them correctly.
  return [
    {
      '&:focus-visible': {
        outline: `2px solid ${table.options.mrtTheme.cellNavigationOutlineColor}`,
        outlineOffset: '-2px',
      },
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
    },
    pinnedStyles,
    widthStyles,
  ];
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
