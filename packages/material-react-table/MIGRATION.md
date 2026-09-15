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

Row/cell/header re-render scoping is now handled internally by `table.Subscribe` / `AppCell` / `AppRow`. The published bundle is not transformed by React Compiler — that tool belongs in consuming apps, not in a library that reads TanStack Table state through methods on stable `row`/`cell`/`table` objects.

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

## 11. If you hand-build a `<TableBody>`: three re-render footguns to avoid

Not itself a v4→v5 breaking change — this applies to the manual-`<TableBody>`/`MRT_TableBodyCellValue` pattern from step 10 regardless of version — but it's easy to reach for while migrating, all three mistakes look reasonable at a glance, and all three have been seen in real code. Confirmed live, not just by reading source: `internal-check/harness.stories.tsx`'s `HeadlessManualSelectionDuringBackgroundLoad` story plus `internal-check/select-during-loading-check.mjs` reproduce the second item below directly.

### Map `isLoading` from your query's *first-load* flag, not its *any-fetch-in-flight* flag

This is the one to check first if row selection or cell content seems to flicker/reset during normal use, not just at first mount. `MRT_TableBodyCellValue` shows a `<Skeleton>` — replacing the cell's entire content, checkbox included — for as long as `table.getState().isLoading` (or `showSkeletons`) is `true`, and `MRT_SelectCheckbox` disables itself under the same condition. That's correct and wanted when there's genuinely no data yet. It's very much not wanted if you wire it to a flag that's *also* `true` during ordinary background activity — most commonly, passing react-query's `isFetching` (`true` on every fetch: the first one, every page of an eager "load more" loop, and every background refetch) instead of its `isLoading` (`true` only before the first successful fetch, back to `false` the moment there's any data to show). Confirmed live: a cell that's already showing real data gets torn down to a skeleton and rebuilt from scratch on *every* background fetch when fed `isFetching` — not once at mount, every single time, for as long as the query keeps refetching.

```diff
  const { data, isFetching, isLoading } = useInfiniteQuery({ ... });

  const table = useMaterialReactTable({
    columns,
    data: allItems,
-   state: { isLoading: isFetching, pagination, rowSelection },
+   state: { isLoading, pagination, rowSelection },
  });
```

If you specifically want a subtle "more rows are loading in the background" indicator without disturbing already-visible rows, don't route it through `isLoading`/`showSkeletons` at all — there's no separate flag for that today; render your own indicator (a toolbar spinner, a banner) driven by `isFetching` directly instead.

### Don't put loading/fetching state in the row `key`

`MRT_TableBodyCellValue` and `MRT_SelectCheckbox` each carry their **own** `useSelector` subscription (`table.atoms.isLoading`/`showSkeletons`, and `table.atoms.rowSelection`, respectively) specifically so they update correctly on their own, without needing help from a parent re-render or a forced remount. Keying each row on something like `` `${row.id}-${isFetching}` `` to work around a suspected stale-skeleton issue is both unnecessary and expensive: changing a `key` doesn't re-render an element, it makes React **unmount and remount it from scratch** — everything inside it, checkbox included, torn down and rebuilt. If your data source fetches several pages back-to-back (an eager "load everything" loop, a background refetch), every such fetch becomes a full-table remount storm. Two symptoms this produces together: a visible slowdown right after the table mounts (while several pages land in quick succession), and checkbox clicks that don't seem to register (the checkbox's component instance — and the click it's mid-handling — can get torn down by a remount landing milliseconds later).

```diff
- <TableRow key={`${row.id}-${isFetching}`} selected={!!rowSelection[row.id]}>
+ <TableRow key={row.id} selected={!!rowSelection[row.id]}>
```

If a cell's value previously seemed to get "stuck" on a background refetch and this key trick was added to fix it, re-test without it first — `MRT_TableBodyCellValue`'s own `isLoading`/`showSkeletons` subscription should already handle that case on its own.

### Eager "load everything" pagination costs one full re-render per page, by design

If your data source grows one array across several sequential fetches (e.g. `useInfiniteQuery` plus a loop that calls `fetchNextPage()` repeatedly until everything is loaded) and passes that growing array as `data`, expect a full row-model reconstruction — and a full re-render of every hand-built row and cell — each time a new page lands. This isn't a bug to chase in this library: TanStack Table's row model memoizes strictly on the `data` array's reference, so a freshly-flattened array (a new reference every time, even if most of its contents are unchanged) means a fresh row model every time, regardless of how finely anything downstream subscribes. It's most visible exactly where you'd expect it — a burst of jank while several pages load back-to-back right after a table/dialog first opens, settling once loading finishes. If that's visible enough to matter, the fix is upstream of this library, in your own data-loading code: don't eagerly load every page up front, or page normally and only fetch what's currently needed.

## Anything not covered here

Everything else about the public options API (`enableSorting`, `muiTableBodyCellProps`, `renderDetailPanel`, etc.) is unchanged. If something breaks that isn't listed above, it's either a genuine bug (please file an issue) or a v8→v9 TanStack Table change this list missed — check [TanStack's own migration guide](https://tanstack.com/table/latest/docs/guide/migrating) next.
