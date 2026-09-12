import { defaultRangeExtractor, type Range } from '@tanstack/react-virtual';

import {
  type MRT_ColumnVirtualizer,
  type MRT_RowData,
  type MRT_TableInstance,
} from '../types';
import { parseFromValuesOrFunc } from '../utils/utils';
import { useMRT_UnmemoizedColumnVirtualizer } from './useMRT_UnmemoizedColumnVirtualizer';

export const useMRT_ColumnVirtualizer = <
  TData extends MRT_RowData,
  TScrollElement extends Element | Window = HTMLDivElement,
  TItemElement extends Element = HTMLTableCellElement,
>(
  table: MRT_TableInstance<TData>,
): MRT_ColumnVirtualizer | undefined => {
  const {
    options: {
      columnVirtualizerInstanceRef,
      columnVirtualizerOptions,
      enableColumnPinning,
      enableColumnVirtualization,
    },
    refs: { tableContainerRef },
  } = table;

  const columnVirtualizerProps = parseFromValuesOrFunc(
    columnVirtualizerOptions,
    {
      table,
    },
  );

  const visibleColumns = table.getVisibleLeafColumns();

  //plain computed values (not useMemo) - both previous manual dependency arrays missed real
  //dependencies (table/visibleColumns.length here; visibleColumns below), so neither actually
  //recomputed when column order changed without columnPinning/columnVisibility also changing - a
  //real staleness bug, not just a compiler lint nag. visibleColumns itself is already recomputed
  //fresh every render (table.getVisibleLeafColumns() isn't memoized), so these derived
  //computations being fresh every render too costs nothing extra in practice.
  const [leftPinnedIndexes, rightPinnedIndexes] = enableColumnPinning
    ? [
        table.getStartVisibleLeafColumns().map((c) => c.getPinnedIndex()),
        table
          .getEndVisibleLeafColumns()
          .map(
            (column) => visibleColumns.length - column.getPinnedIndex() - 1,
          )
          .sort((a: number, b: number) => a - b),
      ]
    : [[], []];

  const numPinnedLeft = leftPinnedIndexes.length;
  const numPinnedRight = rightPinnedIndexes.length;

  //useVirtualizer must always be called - Rules of Hooks (React Compiler rejects it outright:
  //"Hooks must always be called in a consistent order") forbid skipping a hook call based on a
  //prop like enableColumnVirtualization, since that prop could in principle change across
  //renders. `enabled` is react-virtual's own native opt-out (it skips
  //getScrollElement()/observer setup entirely when false, per its source), so it does the same
  //cost-avoidance the old early return did, without needing to skip the hook call itself.
  const columnVirtualizer = useMRT_UnmemoizedColumnVirtualizer(
    {
      count: visibleColumns.length,
      enabled: !!enableColumnVirtualization,
      estimateSize: (index: number) => visibleColumns[index].getSize(),
      getScrollElement: () => tableContainerRef.current,
      horizontal: true,
      overscan: 3,
      //plain function (not useCallback) - leftPinnedIndexes/rightPinnedIndexes are now freshly
      //computed every render (see above), so a useCallback keyed on them would never actually
      //skip recreating this function anyway.
      rangeExtractor: (range: Range) => {
        const newIndexes = defaultRangeExtractor(range);
        if (!numPinnedLeft && !numPinnedRight) {
          return newIndexes;
        }
        return [
          ...new Set([...leftPinnedIndexes, ...newIndexes, ...rightPinnedIndexes]),
        ];
      },
      ...columnVirtualizerProps,
    },
    { numPinnedLeft, numPinnedRight },
    //only wired up while virtualization is actually enabled, matching this option's previous
    //gating (it used to be assigned after an `if (!enableColumnVirtualization) return undefined`
    //check, which discarded the whole virtualizer instance in the disabled case anyway).
    enableColumnVirtualization ? columnVirtualizerInstanceRef : undefined,
  ) as unknown as MRT_ColumnVirtualizer<TScrollElement, TItemElement>;

  if (!enableColumnVirtualization) return undefined;

  return columnVirtualizer as any;
};
