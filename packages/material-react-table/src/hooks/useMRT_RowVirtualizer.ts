import { useSelector } from '@tanstack/react-store';

import {
  type MRT_Row,
  type MRT_RowData,
  type MRT_RowVirtualizer,
  type MRT_TableInstance,
} from '../types';
import { parseFromValuesOrFunc } from '../utils/utils';
import { useMRT_UnmemoizedRowVirtualizer } from './useMRT_UnmemoizedRowVirtualizer';

export const useMRT_RowVirtualizer = <
  TData extends MRT_RowData,
  TScrollElement extends Element | Window = HTMLDivElement,
  TItemElement extends Element = HTMLTableRowElement,
>(
  table: MRT_TableInstance<TData>,
  rows?: MRT_Row<TData>[],
): MRT_RowVirtualizer<TScrollElement, TItemElement> | undefined => {
  const {
    getRowModel,
    options: {
      enableRowVirtualization,
      renderDetailPanel,
      rowVirtualizerInstanceRef,
      rowVirtualizerOptions,
    },
    refs: { tableContainerRef },
  } = table;
  const density = useSelector(table.atoms.density);
  const expanded = useSelector(table.atoms.expanded);

  const rowVirtualizerProps = parseFromValuesOrFunc(rowVirtualizerOptions, {
    table,
  });

  const realRows = rows ?? getRowModel().rows;

  const rowCount = realRows.length;

  const normalRowHeight =
    density === 'compact' ? 37 : density === 'comfortable' ? 58 : 73;

  //useVirtualizer must always be called - Rules of Hooks (React Compiler rejects it outright:
  //"Hooks must always be called in a consistent order") forbid skipping a hook call based on a
  //prop like enableRowVirtualization, since that prop could in principle change across renders.
  //`enabled` is react-virtual's own native opt-out (it skips getScrollElement()/observer setup
  //entirely when false, per its source), so it does the same cost-avoidance the old early return
  //did, without needing to skip the hook call itself.
  const rowVirtualizer = useMRT_UnmemoizedRowVirtualizer(
    {
      count: renderDetailPanel ? rowCount * 2 : rowCount,
      enabled: !!enableRowVirtualization,
      estimateSize: (index: number) =>
        renderDetailPanel && index % 2 === 1
          ? expanded === true
            ? 100
            : 0
          : normalRowHeight,
      getScrollElement: () => tableContainerRef.current,
      measureElement:
        typeof window !== 'undefined' &&
        navigator.userAgent.indexOf('Firefox') === -1
          ? (element: Element) => element?.getBoundingClientRect().height
          : undefined,
      overscan: 4,
      ...rowVirtualizerProps,
    },
    //only wired up while virtualization is actually enabled, matching this option's previous
    //gating (it used to be assigned after an `if (!enableRowVirtualization) return undefined`
    //check, which discarded the whole virtualizer instance in the disabled case anyway).
    enableRowVirtualization ? rowVirtualizerInstanceRef : undefined,
  ) as unknown as MRT_RowVirtualizer<TScrollElement, TItemElement>;

  if (!enableRowVirtualization) return undefined;

  return rowVirtualizer;
};
