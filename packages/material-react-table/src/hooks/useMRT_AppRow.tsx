import { type TableState } from '@tanstack/react-table';
import { createContext, type ReactNode, useContext } from 'react';

import { type MRT_Row, type MRT_RowData, type MRT_TableInstance } from '../types';
import { type MRT_TableFeaturesType } from '../utils/tableFeatures';

const MRT_RowContext = createContext<MRT_Row<any> | null>(null);

//Row-level counterpart to useMRT_AppTable.ts's useCellContext/useHeaderContext -
//createTableHook ships table/cell/header/footer boundaries but not a row one, because rows are
//MRT's own rendering concept layered on top of TanStack's row-feature APIs (rowSelectionFeature,
//rowPinningFeature, rowExpandingFeature, ...), not something a framework-agnostic factory can
//know about. Built the exact same way TanStack builds its own boundaries (see MRT_AppRow below).
export const useMRT_RowContext = <TData extends MRT_RowData>(): MRT_Row<TData> => {
  const row = useContext(MRT_RowContext);
  if (!row) {
    throw new Error(
      '`useMRT_RowContext` must be used within an `MRT_AppRow` component. Make sure your component is wrapped with `<MRT_AppRow row={row} table={table}>...</MRT_AppRow>`.',
    );
  }
  return row as MRT_Row<TData>;
};

interface MRT_AppRowProps<TData extends MRT_RowData, TSelected = undefined> {
  children: (row: MRT_Row<TData>, state: TSelected) => ReactNode;
  row: MRT_Row<TData>;
  //the RAW feature-level state table.Subscribe's selector actually receives - not MRT_TableState,
  //which is MRT's own friendlier, resolved-for-consumers shape (e.g. actionCell is a full
  //MRT_Cell there, but just an {id} atom reference in the raw store).
  selector?: (state: TableState<MRT_TableFeaturesType>) => TSelected;
  table: MRT_TableInstance<TData>;
}

//Same shape as createTableHook's own AppCellImpl: provides `row` via context so descendants stop
//needing it prop-drilled, and - only when given a `selector` - wraps `children` in table.Subscribe
//so just this row's boundary re-renders when the selected slice changes, not its caller. Unlike
//AppCell/AppHeader, this needs no useMemo/ref-closure trick to stay stable across renders: it's
//not bound to one specific table instance via closure (createTableHook needs that because
//multiple independent useAppTable() calls could each have their own table), so `table`/`row` are
//plain props on an ordinary module-level component instead.
export const MRT_AppRow = <TData extends MRT_RowData, TSelected = undefined>({
  children,
  row,
  selector,
  table,
}: MRT_AppRowProps<TData, TSelected>) => {
  return (
    //React Context can't itself be generic - MRT_Row<any> is the standard, accepted escape hatch
    //here, matched by the cast back to MRT_Row<TData> in useMRT_RowContext above.
    <MRT_RowContext.Provider value={row as MRT_Row<any>}>
      {selector ? (
        <table.Subscribe selector={selector}>
          {(state: TSelected) => children(row, state)}
        </table.Subscribe>
      ) : (
        children(row, undefined as TSelected)
      )}
    </MRT_RowContext.Provider>
  );
};
