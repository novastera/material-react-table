import { useMaterialReactTable } from '../hooks/useMaterialReactTable';
import {
  type MRT_RowData,
  type MRT_TableInstance,
  type MRT_TableOptions,
  type Xor,
} from '../types';
import { MRT_TablePaper } from './table/MRT_TablePaper';

export type MaterialReactTableProps<TData extends MRT_RowData> = Xor<
  TableInstanceProp<TData>,
  MRT_TableOptions<TData>
>;

type TableInstanceProp<TData extends MRT_RowData> = {
  table: MRT_TableInstance<TData>;
};

const isTableInstanceProp = <TData extends MRT_RowData>(
  props: MaterialReactTableProps<TData>,
): props is TableInstanceProp<TData> =>
  (props as TableInstanceProp<TData>).table !== undefined;

export const MaterialReactTable = <TData extends MRT_RowData>(
  props: MaterialReactTableProps<TData>,
) => {
  //early-return to a dedicated sub-component instead of conditionally calling
  //useMaterialReactTable() in this function body - calling a hook only on some renders violates
  //Rules of Hooks (React Compiler rejects it outright: "Hooks must always be called in a
  //consistent order"). Splitting into two components means each one calls its own hooks
  //unconditionally; switching which branch renders is a normal conditional-render (a full
  //remount of the differing subtree), not a hook-order mismatch within one component.
  if (isTableInstanceProp(props)) {
    return <MRT_TablePaper table={props.table} />;
  }
  return <MaterialReactTableWithOptions {...props} />;
};

const MaterialReactTableWithOptions = <TData extends MRT_RowData>(
  props: MRT_TableOptions<TData>,
) => {
  const table = useMaterialReactTable(props);
  return <MRT_TablePaper table={table} />;
};
