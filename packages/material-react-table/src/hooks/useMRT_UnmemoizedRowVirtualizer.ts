import { useVirtualizer } from '@tanstack/react-virtual';

//`useVirtualizer()` returns functions (getVirtualItems, measureElement, etc.) that close over
//internal mutable state and can't be safely auto-memoized - React Compiler's own diagnostic says
//so explicitly (category IncompatibleLibrary: "This API returns functions which cannot be
//memoized without leading to stale UI"). Isolating the call behind a tiny wrapper marked
//`'use no memo'` - the officially documented escape hatch for exactly this scenario ("wrap
//functions containing third-party hooks with potential side effects") - opts out only this one
//call, not the surrounding useMRT_RowVirtualizer hook that uses it. From that outer hook's
//perspective this is then a normal, opaque function call whose result the compiler can't (and
//won't try to) memoize incorrectly, while everything else in useMRT_RowVirtualizer.ts remains
//compiler-optimizable.
//
//Isolating just the useVirtualizer() call and returning its result unmodified would still leave
//useMRT_RowVirtualizer.ts mutating that returned value afterward (setting .virtualRows, writing
//to the consumer's rowVirtualizerInstanceRef) - the exact "modifying a value returned from a
//hook" Immutability violation this whole migration has been eliminating elsewhere. So this
//wrapper does that post-processing itself, inside the same opted-out function, instead of
//exporting a bare pass-through - matching the "move the modification into the hook where the
//value is constructed" pattern already used for useMRT_TableInstance.ts.
export const useMRT_UnmemoizedRowVirtualizer = (
  options: any,
  instanceRef: any,
): any => {
  'use no memo';
  //cast to any - virtualRows is MRT's own extension property, not part of TanStack's own
  //Virtualizer type, same as the cast every caller already applied downstream before this
  //post-processing moved here.
  const rowVirtualizer: any = useVirtualizer(options);
  rowVirtualizer.virtualRows = rowVirtualizer.getVirtualItems();
  if (instanceRef) {
    instanceRef.current = rowVirtualizer;
  }
  return rowVirtualizer;
};
