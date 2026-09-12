import { type RankingInfo, compareItems } from '@tanstack/match-sorter-utils';
import { type Row, sortFns } from '@tanstack/react-table';
import { type MRT_Row, type MRT_RowData } from '../types';

const fuzzy = <TData extends MRT_RowData>(
  rowA: Row<any, TData>,
  rowB: Row<any, TData>,
  columnId: string,
) => {
  let dir = 0;
  if (rowA.columnFiltersMeta[columnId]) {
    dir = compareItems(
      rowA.columnFiltersMeta[columnId] as RankingInfo,
      rowB.columnFiltersMeta[columnId] as RankingInfo,
    );
  }
  // Provide a fallback for when the item ranks are equal
  return dir === 0
    ? sortFns.alphanumeric(rowA as Row<any, any>, rowB as Row<any, any>, columnId)
    : dir;
};

export const MRT_SortFns = {
  ...sortFns,
  fuzzy,
};

export const rankGlobalFuzzy = <TData extends MRT_RowData>(
  rowA: MRT_Row<TData>,
  rowB: MRT_Row<TData>,
) =>
  Math.max(...Object.values(rowB.columnFiltersMeta).map((v: any) => v.rank)) -
  Math.max(...Object.values(rowA.columnFiltersMeta).map((v: any) => v.rank));
