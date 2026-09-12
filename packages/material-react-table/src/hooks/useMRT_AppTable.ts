import { createTableHook } from '@tanstack/react-table';

import {
  type MRT_Cell,
  type MRT_Header,
  type MRT_RowData,
  type MRT_TableInstance,
} from '../types';
import { MRT_TableFeatures } from '../utils/tableFeatures';

//Called once, at module scope, not per-render - matches TanStack's own guidance ("define the
//feature object outside the component when possible"). Per-instance overrides (a consumer's own
//filterFns/sortFns/aggregationFns, merged into instanceTableFeatures by
//useMRT_TanStackTableOptions.ts) still flow through normally: useAppTable's own tableOptions
//argument is spread AFTER this file's defaults inside createTableHook's implementation, so
//tableOptionsForTanStack.features (in useMRT_TableInstance.ts) overrides this default per call.
//
//cellComponents/headerComponents/tableComponents are deliberately left unset - that machinery is
//for consumers who register named cell types referenced per-column-def (e.g. `cell.TextCell`).
//MRT's own components decide what to render internally (skeleton vs edit-field vs value vs
//grouped-cell, driven by state), not by per-column type registration - see migration-render.md
//§13 and the plan referenced there for the full reasoning.
export const {
  useAppTable,
  useCellContext: useAppCellContext,
  useHeaderContext: useAppHeaderContext,
  useTableContext: useAppTableContext,
} = createTableHook({
  features: MRT_TableFeatures,
});

//MRT-typed wrappers around the three raw context hooks above - every component reads table/cell/
//header this way instead of calling the raw hooks directly, so the TData/TSelected generics (and
//the same type-erasing cast useMRT_TableInstance.ts's own `table` already uses) live in exactly
//one place instead of being repeated at every call site. TSelected is always Record<string, never>
//- MRT's useAppTable() call is always given the constant selector () => ({}), matching
//MRT_TableInstance's own type (see types.ts).
export const useMRT_TableContext = <TData extends MRT_RowData>() =>
  useAppTableContext<TData, Record<string, never>>() as unknown as MRT_TableInstance<TData>;

//CellContext/HeaderContext are shared across every cell/header regardless of which specific
//table they belong to (createTableHook.d.ts's own useCellContext returns Cell<TFeatures, any,
//TValue> - the row-data generic is hardcoded to `any`, unlike useTableContext's TData param),
//so these wrappers cast rather than parameterize.
export const useMRT_CellContext = <TData extends MRT_RowData>() =>
  useAppCellContext() as unknown as MRT_Cell<TData>;

export const useMRT_HeaderContext = <TData extends MRT_RowData>() =>
  useAppHeaderContext() as unknown as MRT_Header<TData>;

