import Table, { type TableProps } from '@mui/material/Table';
import { useSelector } from '@tanstack/react-store';
import { useLayoutEffect, useRef } from 'react';

import { useMRT_ColumnVirtualizer } from '../../hooks/useMRT_ColumnVirtualizer';
import { type MRT_RowData, type MRT_TableInstance } from '../../types';
import { parseCSSVarId } from '../../utils/style.utils';
import { mergeRefs, parseFromValuesOrFunc } from '../../utils/utils';
import { MRT_TableBody } from '../body/MRT_TableBody';
import { MRT_TableFooter } from '../footer/MRT_TableFooter';
import { MRT_TableHead } from '../head/MRT_TableHead';

export interface MRT_TableProps<TData extends MRT_RowData> extends TableProps {
  table: MRT_TableInstance<TData>;
}

export const MRT_Table = <TData extends MRT_RowData>({
  table,
  ...rest
}: MRT_TableProps<TData>) => {
  const {
    atoms: { columnSizing: columnSizingAtom },
    getFlatHeaders,
    options: {
      enableStickyHeader,
      enableTableFooter,
      enableTableHead,
      layoutMode,
      muiTableProps,
      renderCaption,
    },
  } = table;
  const isFullScreen = useSelector(table.atoms.isFullScreen);

  const tableProps = {
    ...parseFromValuesOrFunc(muiTableProps, { table }),
    ...rest,
  };

  const Caption = parseFromValuesOrFunc(renderCaption, { table });

  //Column widths are written directly onto the DOM node as CSS custom properties, subscribed to
  //table.atoms.columnSizing imperatively - matching TanStack's own official
  //"column-resizing-performant" example - instead of computing them as a React-rendered `style`
  //prop. This isn't working around a compiler limitation: it's the actual TanStack v9 pattern for
  //this, and it's strictly better than the render-based version it replaces - resize pixel deltas
  //never need to trigger a React re-render of this component (or trip any memoization, compiler or
  //manual) to reach the screen; they're applied the instant the atom fires, independent of whatever
  //else is re-rendering.
  //
  //Both dependencies below are genuinely stable, not just assumed to be: useTable() (see
  //@tanstack/react-table's own source) constructs its persistent core table object exactly once,
  //via useState's lazy initializer - every method on it (getFlatHeaders included) and every entry
  //in table.atoms (columnSizingAtom included) is assigned once at that point. The wrapper object
  //useTable() hands back each render is a fresh shell (`{...table, options, state}`) built around
  //those same, never-recreated references - so destructuring them out here and depending on THEM,
  //not on `table` itself, means this effect genuinely runs once per mount, matching TanStack's own
  //official "column-resizing-performant" example exactly, not just approximately.
  const tableRef = useRef<HTMLTableElement>(null);
  useLayoutEffect(() => {
    const writeColumnSizeVars = () => {
      const tableEl = tableRef.current;
      if (!tableEl) return;
      for (const header of getFlatHeaders()) {
        const colSize = header.getSize();
        tableEl.style.setProperty(
          `--header-${parseCSSVarId(header.id)}-size`,
          String(colSize),
        );
        tableEl.style.setProperty(
          `--col-${parseCSSVarId(header.column.id)}-size`,
          String(colSize),
        );
      }
    };
    writeColumnSizeVars();
    const { unsubscribe } = columnSizingAtom.subscribe(writeColumnSizeVars);
    return unsubscribe;
  }, [columnSizingAtom, getFlatHeaders]);

  const columnVirtualizer = useMRT_ColumnVirtualizer(table);

  const commonTableGroupProps = {
    columnVirtualizer,
    table,
  };

  return (
    <Table
      stickyHeader={enableStickyHeader || isFullScreen}
      {...tableProps}
      ref={mergeRefs<HTMLTableElement>(tableRef, tableProps?.ref)}
      sx={[
        {
          borderCollapse: 'separate',
          display: layoutMode?.startsWith('grid') ? 'grid' : undefined,
          position: 'relative',
        },
        ...(Array.isArray(tableProps?.sx) ? tableProps.sx : [tableProps?.sx]),
      ]}
    >
      {!!Caption && <caption>{Caption}</caption>}
      {/*Provides table via context (useMRT_TableContext()) to everything below - MRT_TableBodyRow/
      MRT_TableBodyCell (and, from Stage 2 on, the head/footer equivalents) read table this way
      instead of receiving it as an explicit prop. No selector - this wrapper itself never needs
      to re-render on atom writes, it's purely a context provider; the actual re-render-scoping
      happens at the AppRow/AppCell/AppHeader boundaries deeper in the tree.*/}
      <table.AppTable>
        {enableTableHead && <MRT_TableHead {...commonTableGroupProps} />}
        <MRT_TableBody {...commonTableGroupProps} />
        {enableTableFooter && <MRT_TableFooter {...commonTableGroupProps} />}
      </table.AppTable>
    </Table>
  );
};
