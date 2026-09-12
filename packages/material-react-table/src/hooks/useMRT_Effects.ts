import { useSelector } from '@tanstack/react-store';
import { useEffect, useRef } from 'react';

import {
  type MRT_RowData,
  type MRT_SortingState,
  type MRT_TableInstance,
} from '../types';
import { getDefaultColumnOrderIds } from '../utils/displayColumn.utils';
import { getCanRankRows } from '../utils/row.utils';

export const useMRT_Effects = <TData extends MRT_RowData>(
  table: MRT_TableInstance<TData>,
) => {
  const {
    getPrePaginatedRowModel,
    getState,
    options,
    options: { enablePagination, rowCount },
    setColumnOrder,
    setPageIndex,
    setSorting,
  } = table;
  //columnOrder/pagination stay as bare subscriptions (unlike isFullScreen/globalFilter below) -
  //their effects' setters (setColumnOrder/setPageIndex) write back into these SAME atoms, and
  //TanStack Store's flush() has no reentrancy guard for a subscriber synchronously calling
  //.set() on the atom it's subscribed to (see atom.js - a nested flush() mid-loop resets the
  //outer loop's counters). Routing these two through React's own effect scheduling (a plain
  //useSelector + useEffect, exactly like before) sidesteps that risk entirely; isFullScreen has
  //no setter at all and globalFilter's effect only ever writes `sorting` (a different atom), so
  //those two convert safely to the direct table.atoms.X.subscribe() pattern below (matching
  //MRT_Table.tsx's columnSizing precedent) without touching this hook's own caller
  //(MaterialReactTable.tsx) at all.
  const columnOrder = useSelector(table.atoms.columnOrder);
  const isLoading = useSelector(table.atoms.isLoading);
  const pagination = useSelector(table.atoms.pagination);
  const showSkeletons = useSelector(table.atoms.showSkeletons);

  const totalColumnCount = table.options.columns.length;
  const totalRowCount = rowCount ?? getPrePaginatedRowModel().rows.length;

  const initialBodyHeight = useRef<string>(null);
  const previousTop = useRef<number>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      initialBodyHeight.current = document.body.style.height;
    }
  }, []);

  //hide scrollbars when table is in full screen mode, preserve body scroll position after full
  //screen exit - subscribed directly to the atom (no useSelector) so this hook's caller
  //(MaterialReactTable.tsx, the whole table's root) doesn't re-render just to satisfy this
  //effect's own dependency tracking; matches MRT_Table.tsx's columnSizing precedent.
  useEffect(() => {
    const applyFullScreenState = (fullScreen: boolean) => {
      if (typeof window === 'undefined') return;
      if (fullScreen) {
        previousTop.current = document.body.getBoundingClientRect().top; //save scroll position
        document.body.style.height = '100dvh'; //hide page scrollbars when table is in full screen mode
      } else {
        document.body.style.height = initialBodyHeight.current as string;
        if (!previousTop.current) return;
        //restore scroll position
        window.scrollTo({
          behavior: 'instant',
          top: -1 * (previousTop.current as number),
        });
      }
    };
    applyFullScreenState(table.atoms.isFullScreen.get());
    const { unsubscribe } = table.atoms.isFullScreen.subscribe(
      applyFullScreenState,
    );
    return unsubscribe;
  }, [table.atoms.isFullScreen]);

  //recalculate column order when columns change or features are toggled on/off
  useEffect(() => {
    if (totalColumnCount !== columnOrder.length) {
      setColumnOrder(getDefaultColumnOrderIds(options));
    }
  }, [totalColumnCount, columnOrder.length, options, setColumnOrder]);

  //if page index is out of bounds, set it to the last page
  useEffect(() => {
    if (!enablePagination || isLoading || showSkeletons) return;
    const { pageIndex, pageSize } = pagination;
    const totalPages: number =
      totalRowCount > 0 ? Math.ceil(totalRowCount / pageSize) : 1;
    const isOutOfBounds: boolean = pageIndex < 0 || pageIndex >= totalPages;

    if (isOutOfBounds) {
      setPageIndex(totalPages - 1);
    }
  }, [
    totalRowCount,
    enablePagination,
    isLoading,
    showSkeletons,
    pagination,
    setPageIndex,
  ]);

  //turn off sort when global filter is looking for ranked results - subscribed directly to the
  //globalFilter atom (no useSelector) for the same MaterialReactTable.tsx-caller reason as the
  //full-screen effect above; safe to write `sorting` (a different atom) from inside this
  //subscription, unlike columnOrder/pagination above which write back into themselves.
  const appliedSort = useRef<MRT_SortingState>(table.atoms.sorting.get());
  useEffect(() => {
    const { unsubscribe: unsubscribeSorting } = table.atoms.sorting.subscribe(
      (sorting: MRT_SortingState) => {
        if (sorting.length) {
          appliedSort.current = sorting;
        }
      },
    );
    return unsubscribeSorting;
  }, [table.atoms.sorting]);

  useEffect(() => {
    //getCanRankRows takes just {getState, options} here (not the whole table) - both stable
    //references, so this effect only re-runs when they'd genuinely change, not on every unrelated
    //render caused by the table wrapper's own identity instability (see migration-table.md).
    const applyRankedSort = (globalFilter: unknown) => {
      if (!getCanRankRows({ getState, options })) return;
      if (globalFilter) {
        setSorting([]);
      } else {
        setSorting(() => appliedSort.current || []);
      }
    };
    applyRankedSort(table.atoms.globalFilter.get());
    const { unsubscribe } = table.atoms.globalFilter.subscribe(
      applyRankedSort,
    );
    return unsubscribe;
  }, [table.atoms.globalFilter, getState, options, setSorting]);
};
