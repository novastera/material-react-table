import { useSelector } from '@tanstack/react-store';

import {
  type MRT_Row,
  type MRT_RowData,
  type MRT_TableInstance,
} from '../types';
import { getMRT_Rows } from '../utils/row.utils';

export const useMRT_Rows = <TData extends MRT_RowData>(
  table: MRT_TableInstance<TData>,
): MRT_Row<TData>[] => {
  //getMRT_Rows (and the getCanRankRows/getIsRankingRows it calls internally) reads all of these
  //atoms via table.getState() - a plain function can't subscribe itself, so this hook (its only
  //render-path caller - the row-selection-handler call site elsewhere reads them inside an event
  //handler, which needs no subscription) does it here, ensuring a fresh call happens whenever any
  //of them change instead of relying on some unrelated re-render to happen to catch it.
  useSelector(table.atoms.creatingRow);
  useSelector(table.atoms.expanded);
  useSelector(table.atoms.globalFilter);
  useSelector(table.atoms.globalFilterFn);
  useSelector(table.atoms.grouping);
  useSelector(table.atoms.pagination);
  useSelector(table.atoms.sorting);

  //plain computed value (not useMemo) - getMRT_Rows(table) closes over the whole table object, so
  //its real dependency is just `table`, not the hand-picked field list this used to be keyed on
  //(which also missed real dependencies getMRT_Rows itself reads, like enableRowPinning/
  //rowPinningDisplayMode/manualPagination/createDisplayMode). That mismatch made React Compiler
  //refuse to compile this hook at all (category PreserveManualMemo) rather than risk a stale
  //value. Once table's own identity is stabilized (see migration-table.md), the compiler will
  //correctly and safely memoize this on its own; until then this recomputes more often than the
  //old (already-buggy) manual memo did, which is the safe direction to be wrong in.
  return getMRT_Rows(table);
};
