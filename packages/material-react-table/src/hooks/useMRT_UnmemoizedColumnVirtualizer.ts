import { useVirtualizer } from '@tanstack/react-virtual';

//See useMRT_UnmemoizedRowVirtualizer.ts for the full reasoning - same `'use no memo'` isolation
//of the one call React Compiler can't safely optimize, with the post-processing that used to
//mutate the returned virtualizer afterward (virtualColumns, the pinned-column padding
//calculation, the consumer's columnVirtualizerInstanceRef) moved inside this same opted-out
//function instead, so useMRT_ColumnVirtualizer.ts itself never mutates a hook-returned value.
//
//numPinnedLeft/numPinnedRight are passed in rather than recomputed here because they're already
//plain, cheap local values in the calling hook (not anything hook-returned or otherwise
//compiler-sensitive) - no reason to duplicate that computation.
export const useMRT_UnmemoizedColumnVirtualizer = (
  options: any,
  pinning: { numPinnedLeft: number; numPinnedRight: number },
  instanceRef: any,
): any => {
  'use no memo';
  //cast to any - virtualColumns/virtualPaddingLeft/virtualPaddingRight are MRT's own extension
  //properties, not part of TanStack's own Virtualizer type, same as the cast every caller already
  //applied downstream before this post-processing moved here.
  const columnVirtualizer: any = useVirtualizer(options);
  const virtualColumns = columnVirtualizer.getVirtualItems();
  columnVirtualizer.virtualColumns = virtualColumns;
  const numColumns = virtualColumns.length;

  if (numColumns) {
    const { numPinnedLeft, numPinnedRight } = pinning;
    const totalSize = columnVirtualizer.getTotalSize();

    const leftNonPinnedStart = virtualColumns[numPinnedLeft]?.start || 0;
    const leftNonPinnedEnd = virtualColumns[numPinnedLeft - 1]?.end || 0;

    const rightNonPinnedStart =
      virtualColumns[numColumns - numPinnedRight]?.start || 0;
    const rightNonPinnedEnd =
      virtualColumns[numColumns - numPinnedRight - 1]?.end || 0;

    columnVirtualizer.virtualPaddingLeft = leftNonPinnedStart - leftNonPinnedEnd;
    columnVirtualizer.virtualPaddingRight =
      totalSize -
      rightNonPinnedEnd -
      (numPinnedRight ? totalSize - rightNonPinnedStart : 0);
  }

  if (instanceRef) {
    instanceRef.current = columnVirtualizer;
  }

  return columnVirtualizer;
};
