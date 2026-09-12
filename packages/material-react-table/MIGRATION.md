# Migrating from v4 to v5

v5 moves the table engine from `@tanstack/react-table` v8 to **v9**, migrates drag-and-drop onto `@dnd-kit`, and rebuilds how the table re-renders. It's a hard break — there's no compatibility shim, and most apps will need a handful of mechanical find-and-replace changes plus a couple of larger ones if you render internal `MRT_*` components directly. `CHANGELOG.md` has the terse version-by-version record; this file walks through *how* to actually make each change, in the order you'll hit them.

## Before you start

- **React / React DOM: `>=19.3`** (previously `>=19.0`). Bump these first — nothing else will run otherwise.
- **`@mui/material`: `>=9.0`**.
- If you construct the table with `useReactTable`/`useTable` imported directly from `@tanstack/react-table` yourself (headless usage), you're on v9 of that package too — read [TanStack's own v8→v9 migration guide](https://tanstack.com/table/latest/docs/guide/migrating) alongside this file. Everything below assumes you're using this library's own `useMaterialReactTable`/`<MaterialReactTable>`, which absorbs most of that upgrade for you.

## 1. Column pinning: `left`/`right` → `start`/`end`

Every column-pinning value, everywhere, renames `left`→`start` and `right`→`end`. Row pinning (`top`/`bottom`) is a separate feature and is **not** affected.

```diff
- state: { columnPinning: { left: ['id'], right: ['actions'] } }
+ state: { columnPinning: { start: ['id'], end: ['actions'] } }

- column.pin('left')
+ column.pin('start')

- column.pin('right')
+ column.pin('end')

- if (column.getIsPinned() === 'left') { ... }
+ if (column.getIsPinned() === 'start') { ... }
```

Search your codebase for `columnPinning`, `.pin(`, and `getIsPinned()` to find every call site.

## 2. Sorting: `sortingFn` → `sortFn`

```diff
  const columns: MRT_ColumnDef<Person>[] = [
    {
      accessorKey: 'age',
-     sortingFn: 'basic',
+     sortFn: 'basic',
    },
  ];

  useMaterialReactTable({
    columns,
    data,
-   sortingFns: { myCustomSort: (rowA, rowB) => ... },
+   sortFns: { myCustomSort: (rowA, rowB) => ... },
  });
```

If you imported the types directly: `MRT_SortingFn` → `MRT_SortFn`, `MRT_SortingFns` → `MRT_SortFns`.

## 3. Column sizing/resizing: `columnSizingInfo` → `columnResizing`

TanStack v9 split "sizing" (the committed widths) from "resizing" (the in-progress drag state) into separate features. This library's `columnSizing` state is unchanged; only the drag-tracking slice renamed:

```diff
- state: { columnSizingInfo }
+ state: { columnResizing }

- onColumnSizingInfoChange={setColumnSizingInfo}
+ onColumnResizingChange={setColumnResizing}

- table.setColumnSizingInfo(...)
+ table.setColumnResizing(...)
```

Type rename: `MRT_ColumnSizingInfoState` → `MRT_ColumnResizingState`.

## 4. Renamed table instance methods

| v4 | v5 |
|---|---|
| `table.getLeftLeafColumns()` | `table.getStartLeafColumns()` |
| `table.getRightLeafColumns()` | `table.getEndLeafColumns()` |
| `table.getPaginationRowModel()` | `table.getPaginatedRowModel()` |
| `table.getPrePaginationRowModel()` | `table.getPrePaginatedRowModel()` |

## 5. Multiple aggregation functions per column: array → keyed object

```diff
  {
    accessorKey: 'salary',
    aggregationFn: ['min', 'max'],
-   AggregatedCell: ({ cell }) => `${cell.getValue()[0]} - ${cell.getValue()[1]}`,
+   AggregatedCell: ({ cell }) => `${cell.getValue().min} - ${cell.getValue().max}`,
  }
```

Only relevant if you pass an *array* of aggregation function names to one column and read the result positionally in a custom `AggregatedCell`/`Cell`.

## 6. `table.getState()` vs `table.state`

`table.getState()` keeps working exactly as before, everywhere, including inside `header.getContext()`/`cell.getContext()`/`row.getContext()` — no change needed for the vast majority of code.

Two things narrowed:

- **`table.state` (the property, not the method) now always returns `{}`.** This is what makes the render-scoping fix in step 8 possible. If you were reading `table.state.sorting` or similar anywhere, switch to `table.getState().sorting`:
  ```diff
  - const isDark = table.state.density === 'compact';
  + const isDark = table.getState().density === 'compact';
  ```
- If you build a custom `Header`/`Cell` through `header.getContext()`/`cell.getContext()` and read `columnFilterFns`, `globalFilterFn`, or the pure passthrough loading flags (`isLoading`, `showSkeletons`, `isSaving`, `showLoadingOverlay`, `showProgressBars`), pass `table` explicitly to be safe — these five fields aren't backed by the same atom system as everything else:
  ```tsx
  flexRender(columnDef.Header, { ...header.getContext(), table })
  ```
  Skip this if you already pass `table` explicitly (the standard `<MaterialReactTable>` component does).

## 7. `enableFacetedValues` — no action needed

Still works exactly as documented (`true` computes faceted unique values / min-max, `false`/unset skips it). Nothing to change; noted here only because the internal registration mechanism changed.

## 8. `memoMode` removed

React Compiler now handles this automatically, at build time, for every component in the library.

```diff
  useMaterialReactTable({
    columns,
    data,
-   memoMode: 'cells',
  });
```

Just delete it — there's no replacement setting, and nothing to configure in its place.

## 9. Drag and drop now uses `@dnd-kit`, not native HTML5 DnD

Skip this section entirely unless you render `<MRT_GrabHandleButton>` yourself, or read something off the `event` argument inside `muiColumnDragHandleProps`/`muiRowDragHandleProps`'s `onDragStart`/`onDragEnd`. Everything else — `enableColumnDragging`/`enableRowDragging`/`enableColumnOrdering`/`enableRowOrdering`, the `draggingRow`/`hoveredRow`/`draggingColumn`/`hoveredColumn` state and their `on*Change` callbacks, and the standard reorder-commit pattern below — is unchanged in shape, just implemented on a different DnD library underneath.

**If you only read table state in `onDragEnd`** (the common case, e.g. committing a row reorder), nothing changes:

```tsx
// still works exactly as before
muiRowDragHandleProps: {
  onDragEnd: () => {
    setData((prev) => reorderRows(prev, draggingRow, hoveredRow)); // reorderRows is new - see below
  },
},
```

**If you inspected the native `DragEvent`** (e.g. `event.dataTransfer`, `event.clientX`), that object no longer exists — dnd-kit passes its own `DragStartEvent`/`DragEndEvent` instead. Read [dnd-kit's `useSortable` docs](https://dndkit.com/react/hooks/use-sortable) for the replacement shape; there's no drop-in equivalent for raw `DataTransfer` access.

**If you render `<MRT_GrabHandleButton>` directly**, its props changed:

```diff
  export interface MRT_GrabHandleButtonProps {
-   onDragStart: DragEventHandler<HTMLButtonElement>;
-   onDragEnd: DragEventHandler<HTMLButtonElement>;
+   listeners?: DraggableSyntheticListeners;
+   attributes?: DraggableAttributes;
+   activatorRef?: Ref<HTMLButtonElement>;
  }
```

These are dnd-kit's own types, re-exported from `@dnd-kit/core` — pass through whatever `useSortable()` gave you.

**New, optional**: `reorderRows(data, draggingRow, hoveredRow)` — a small exported utility that replaces the array-splice most row-reordering examples used to hand-write inside `onDragEnd`:

```diff
- onDragEnd: () => {
-   setData((prev) => {
-     const next = [...prev];
-     const from = next.indexOf(draggingRow.original);
-     const to = next.indexOf(hoveredRow.original);
-     next.splice(to, 0, next.splice(from, 1)[0]);
-     return next;
-   });
- },
+ onDragEnd: () => {
+   setData((prev) => reorderRows(prev, draggingRow, hoveredRow));
+ },
```

Purely additive — your existing splice logic still works if you'd rather keep it.

**Behavior notes, not code changes**: column/row reordering is now keyboard-accessible (focus the grab handle, `Space` to pick up, arrow keys to move, `Space` to drop). A column reorder must be dropped on a header cell specifically now (previously anywhere in the column's body also worked).

## 10. Row/cell/header/footer rendering: props → context

This is the biggest structural change, but it **only affects you if you directly import and render one of these components yourself** — `<MRT_TableBodyCell>`, `<MRT_TableHeadCell>`, or `<MRT_TableFooterCell>` — typically because you're building a custom `<TableBody>`/`<TableHead>`/`<TableFooter>` shell instead of using `<MaterialReactTable>` as-is. If you only use `<MaterialReactTable columns={...} data={...} />` (or customize it through options like `renderDetailPanel`/`Cell`/`Header`/`muiTable*Props`), **nothing in this section applies to you** — skip to step 11.

**Why**: these components used to receive `row`/`cell`/`header`/`table` as explicit props. They now read them from React context, provided by whichever internal wrapper renders them, so that a specific row/cell can be told to re-render without forcing every other row/cell to re-render too (the whole point of this release's rework).

**`MRT_TableBodyCell`, `MRT_TableHeadCell`, `MRT_TableFooterCell`** — wrap them in `table.AppCell`/`table.AppHeader`/`table.AppFooter` instead of passing the prop:

```diff
  // cell
- <MRT_TableBodyCell cell={cell} table={table} staticColumnIndex={i} staticRowIndex={j} rowRef={rowRef} />
+ <table.AppCell cell={cell}>
+   {() => (
+     <MRT_TableBodyCell staticColumnIndex={i} staticRowIndex={j} rowRef={rowRef} />
+   )}
+ </table.AppCell>

  // header
- <MRT_TableHeadCell header={header} table={table} />
+ <table.AppHeader header={header}>
+   {() => <MRT_TableHeadCell />}
+ </table.AppHeader>

  // footer
- <MRT_TableFooterCell header={header} table={table} />
+ <table.AppFooter header={header}>
+   {() => <MRT_TableFooterCell />}
+ </table.AppFooter>
```

`table` here is whatever `useMaterialReactTable()` returned you — `AppCell`/`AppHeader`/`AppFooter` are new members on that same object, not a separate import.

**`MRT_TableBodyRow`** doesn't have a standalone public boundary yet to satisfy its own row context — if you were manually composing individual `<MRT_TableBodyRow>` elements, render the whole `<MRT_TableBody>` component instead (it sets up row context internally as it maps over rows).

**If you only need cell values, not the full cell shell** (padding, skeleton loading state, click-to-copy, right-click menu, etc.), reach for `MRT_TableBodyCellValue` instead — it's **unaffected** by this change and still takes `cell`/`table` as plain props, exactly as before:

```tsx
// this pattern still works exactly as it did in v4
<TableBody>
  {table.getRowModel().rows.map((row) => (
    <TableRow key={row.id}>
      {row.getVisibleCells().map((cell) => (
        <TableCell key={cell.id}>
          <MRT_TableBodyCellValue cell={cell} table={table} />
        </TableCell>
      ))}
    </TableRow>
  ))}
</TableBody>
```

**None of this touches**: `columnDef.Cell`/`Header`/`Footer`/`AggregatedCell`/`GroupedCell`/etc. (still plain functions MRT calls for you, receiving `{cell, column, row, table}` exactly as before), or `header.getContext()`/`cell.getContext()`/`row.getContext()`-based headless rendering with `flexRender` (still works as documented in step 6).

## Anything not covered here

Everything else about the public options API (`enableSorting`, `muiTableBodyCellProps`, `renderDetailPanel`, etc.) is unchanged. If something breaks that isn't listed above, it's either a genuine bug (please file an issue) or a v8→v9 TanStack Table change this list missed — check [TanStack's own migration guide](https://tanstack.com/table/latest/docs/guide/migrating) next.
