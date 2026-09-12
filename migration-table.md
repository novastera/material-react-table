# Migration & incident notes

## 1. `MRT_TableBodyCellValue` placeholder-guard bug (fixed)

### What happened

An uncommitted, untested AI edit to
[`MRT_TableBodyCellValue.tsx`](packages/material-react-table/src/components/body/MRT_TableBodyCellValue.tsx)
added this early return, intending to fix "blank rows while loading":

```tsx
if (cell.getIsPlaceholder()) {
  return columnDef.PlaceholderCell?.({ cell, column, row, table }) ?? null;
}
```

`cell.getIsPlaceholder()` is not a loading/skeleton concept. Traced into
`@tanstack/table-core`'s actual source (`ColumnGrouping.js`):

```js
cell.getIsPlaceholder = () => !cell.getIsGrouped() && column.getIsGrouped();
```

It is a **row-grouping** signal: true for any cell whose column is currently
grouped, on any row that isn't that group's own header row. It has nothing to
do with data loading. The "generate blank rows while loading" fallback the
added comment blamed is a separate, already-correct mechanism
(`useMRT_TableInstance.ts`, driven by `isLoading`/`showSkeletons`) that never
sets `getIsPlaceholder()`.

### Blast radius

- In the standard `<MaterialReactTable>` render path this guard was **dead
  code** — `MRT_TableBodyCell.tsx` has its own pre-existing, correct
  placeholder guard that intercepts first and never reaches
  `MRT_TableBodyCellValue` in that case.
- It was a live regression for any consumer importing `MRT_TableBodyCellValue`
  directly to hand-roll a `<TableBody>` (a supported, exported pattern) while
  also using column grouping: every cell in a grouped column, on every
  non-header row, would silently render blank, since `columnDef.PlaceholderCell`
  is essentially never defined in practice.
- **This never shipped.** The frontend app's actually-installed
  `@novastera-oss/material-react-table@4.0.4`
  (`frontend/node_modules/@novastera-oss/material-react-table/dist/index.js`)
  was checked directly and contains the original, unmodified
  `MRT_TableBodyCellValue` — no placeholder guard, no skeleton-awareness at
  all. The buggy edit only ever existed in this repo's local, uncommitted
  working tree. It is confirmed **not** the cause of the production incident
  that prompted this investigation.
- The real incident is almost certainly the gap the app itself already found
  and worked around: v4.0.4's `MRT_TableBodyCellValue` has no
  skeleton/loading-awareness at all when called directly (see
  `frontend/src/components/organisms/app-dialog-list-multiple.tsx:159-164`,
  gating `isLoading` on `allItems.length > 0`).
- No test or Storybook coverage existed for either direct
  `MRT_TableBodyCellValue` usage or grouping-through-custom-table-body, so
  this class of regression had no safety net.

### Fix applied

1. Removed the `cell.getIsPlaceholder()` branch from
   `MRT_TableBodyCellValue.tsx` entirely.
2. Kept the `isLoading`/`showSkeletons` → `<Skeleton>` branch added alongside
   it — a genuine, correct improvement that gives standalone
   `MRT_TableBodyCellValue` the same skeleton-awareness `MRT_TableBodyCell`
   already had. Comment above it rewritten to describe only that behavior.
3. Added a regression story —
   [`stories/fixed-bugs/manual-tablebody-with-grouping.stories.tsx`](packages/material-react-table/stories/fixed-bugs/manual-tablebody-with-grouping.stories.tsx)
   — that hand-renders a `<TableBody>` via `MRT_TableBodyCellValue` directly
   (mirroring the frontend app's pattern) with grouping enabled and a loading
   toggle, closing the coverage gap.
4. Updated the comment in `app-dialog-list-multiple.tsx` to reflect the
   corrected understanding and added a standing caution: don't add
   `enableGrouping` to those columns while using direct
   `MRT_TableBodyCellValue` rendering unless the installed library version is
   confirmed to include this fix.

## 2. Dependency version reality check

The initial ask was to verify/bump three dependencies. What was actually
found, after an early Context7 docs lookup gave stale numbers and was
corrected against the npm registry directly:

| package | currently declared | actual latest (npm registry) | change type |
|---|---|---|---|
| `@tanstack/react-table` | `^8.21.2` | **9.2.4** | major, breaking |
| `@tanstack/match-sorter-utils` | `^8.15.1` | **9.1.2** | major, coupled to react-table's release |
| `@faker-js/faker` (dev-only) | `^9.3.0` | **10.6.0** | major, lower risk (Storybook-only) |

**Decision at the time: not executed in that pass.** The user confirmed
sequencing — ship the `MRT_TableBodyCellValue` hotfix first; treat the
dependency major-version migration as a separate, larger tracked effort.
**That effort is now complete — see §3 below.**

### Why this is a real migration, not a version bump

`@tanstack/react-table` v9 changes core APIs that this package uses directly:

- `useReactTable` → `useTable`, with a required, explicitly-registered
  `tableFeatures()` object (features are no longer bundled by default).
- All row-model factories (`getCoreRowModel`, `getSortedRowModel`,
  `getFilteredRowModel`, `getPaginationRowModel`, `getGroupedRowModel`,
  `getExpandedRowModel`, `getFacetedRowModel`, `getFacetedUniqueValues`,
  `getFacetedMinMaxValues`) move into that features object.
- `table.getState()` / `onStateChange` removed in favor of `table.state` /
  `table.store.state` and per-slice callbacks.
- Column pinning: `'left'/'right'` → `'start'/'end'`.
- Column-def `sortingFn` → `sortFn`.
- Column sizing/resizing state renamed (`columnSizingInfo` → `columnResizing`
  per the equivalent Angular-adapter migration notes).
- Underscore-prefixed internal APIs removed.

A repo grep confirms real blast radius:

- Row-model/`useReactTable`-style imports touch **11 files**:
  `useMRT_TableInstance.ts`, `useMRT_TableOptions.ts`, `fns/sortingFns.ts`,
  `fns/filterFns.ts`, `fns/aggregationFns.ts`, `types.ts`, `index.ts`, plus a
  few components.
- `.getState()` / pinning `left`/`right` / sizing-state usage hits **46
  occurrences across 21 files**, including `MRT_TableBodyCell.tsx`,
  `MRT_ColumnPinningButtons.tsx`, `MRT_TableHeadCellResizeHandle.tsx`,
  `MRT_ColumnActionMenu.tsx`, `MRT_TableHeadCell.tsx`, `MRT_TableFooterCell.tsx`,
  and more.
- Some of what changes (pinning state shape, column-def `sortingFn`) is
  **material-react-table's own public API** — a future migration to
  react-table v9 would itself be a breaking major version for
  material-react-table's own consumers (e.g. the `frontend` app), not just an
  internal dependency swap.
- `@tanstack/match-sorter-utils` v9.1.2 ships in lockstep with react-table v9
  in the same TanStack monorepo and must move together with it.
- `@faker-js/faker` v10 is dev-only (Storybook mock data, 51 of 54 story
  files use it) and lower-risk, but its own breaking-change list has not yet
  been reviewed — do that before scheduling the bump. All current faker calls
  in stories use the modern namespaced API (`faker.person.*`,
  `faker.location.*`, `faker.number.*`, etc.); no legacy `faker.name`/
  `faker.address`/`faker.datatype.number` calls exist except one
  `faker.datatype.boolean()` in `Filtering.stories.tsx:81`, which remains
  valid through v9.

### Repo hygiene handled now (unrelated to the version question)

An untracked, stray `package-lock.json` (npm-format) existed alongside
`pnpm-lock.yaml` in this pnpm monorepo and had resolved `@faker-js/faker` to a
different version (`9.9.0`) than `pnpm-lock.yaml` did (`9.3.0`) — a drift risk
for reproducible installs. Deleted, and `pnpm install` re-run to confirm a
clean, single-lockfile resolution (`@faker-js/faker@9.3.0`, matching the
declared `^9.3.0` range).

## 3. Migration executed — `@novastera-oss/material-react-table@5.0.0`

The deferred migration from §2 has been carried out in full, on branch
`feat/react-table-v9-migration`, as a sequence of independently-revertable
commits. Decision confirmed with the user: **clean hard break, no
backward-compat shim** — see `CHANGELOG.md` for the full consumer-facing
breaking-change list (pinning shape, `sortFn`, `columnResizing`, renamed
table methods, multi-aggregation result shape, and the `getContext()`
table-identity gotcha for headless consumers).

### What actually shipped, vs. what was planned

- **`row._valuesCache` risk (resolved before the bump)**: verified directly
  against the real `9.2.4` package — `row.getValue()`'s internal caching
  behavior is byte-identical to v8. Replaced anyway with an MRT-owned
  `editingRowValuesCache` state slice, since depending on a react-table
  *internal* field was the real risk, not this specific version.
- **Core rewrite**: `useReactTable` → `useTable` with a static
  `tableFeatures()` config (new file:
  `packages/material-react-table/src/utils/tableFeatures.ts`) registering
  every feature/row-model this library ever conditionally used. Consumer
  `filterFns`/`sortFns`/`aggregationFns` overrides are still supported via a
  memoized per-instance `tableFeatures()` call, not lost by moving to a
  static config.
- **Pinning and sizing/resizing renames** (originally scoped as separate
  Stage 3/4 work) had to be folded into the same pass as the core rewrite —
  v9 doesn't compile with a half-renamed state shape, so there was no way to
  land the `useTable` swap without also touching every `left`/`right` and
  `columnSizingInfo` reference at the same time.
- **Two real runtime bugs were caught only by actually running the code**,
  not by `tsc`, because `MRT_TableInstance`'s own
  `Omit<Table<...>, [...]> & {...}` type pattern re-declares method names
  regardless of whether the underlying object still has them — a clean
  typecheck gave false confidence here:
  - `getPaginationRowModel`/`getPrePaginationRowModel` were silently
    accepted by the type checker but don't exist at runtime in v9 (renamed to
    `getPaginatedRowModel`/`getPrePaginatedRowModel` — inconsistent with
    every other row-model getter, which kept its v8 name).
  - `enableFacetedValues` had silently become a no-op (v9 can't conditionally
    register a feature per instance, so faceted values were always being
    computed) — restored the gate at the two places that actually consume
    faceted data, and fixed a numeric-column crash
    (`.localeCompare` on non-string facet keys) this exposed.
- **Verification**: since this repo has no automated test suite, a headless
  Playwright sweep was built ad hoc to load all 399 Storybook stories and
  capture console errors — this is what caught both runtime bugs above. Final
  state: 399/399 stories render cleanly except 3 pre-existing, unrelated
  cosmetic warnings (a React list-key warning, an SSR `:nth-child` warning,
  and a hydration warning in a styling demo — none touch react-table
  behavior).
- **Faker v10** bump was low-risk as predicted: one required change
  (`faker.internet.color()` → `faker.color.rgb()`), re-verified with the same
  399-story sweep.

### Follow-up: MRT's own state moved to a real TanStack v9 feature

The first pass above shipped `getState()`/`setX()` as a post-construction shim
merging plain `useState` into the object `useTable()` returns each render.
That worked, but per TanStack's own v9 announcement the whole point of the
new architecture is atom/store-backed state with selective reactivity
(`table.Subscribe`, `useSelector`) instead of the old "everything re-renders
on any change" model — and the shim also caused the exact `getContext()`
table-identity gotcha documented above, since state that only exists on the
per-render wrapper is invisible from `column.table`/`row.table` (which
reference the original, stable internal instance).

Fixed properly: `src/utils/mrtStateFeature.ts` registers 13 of MRT's own
state slices (density, editing state, action cell, hover/drag tracking, etc.)
as a genuine custom TanStack v9 feature — same `getInitialState`/
`getDefaultTableOptions`/`constructTableAPIs` contract every stock feature
uses, registered via the `Plugins` declaration-merge extension point.
`table.getState()` is now a real native method reading `table.store.state`
directly. **Verified this actually closes the `getContext()` gap**: the
regression story's `header.getContext()`-based header rendering works
correctly with zero errors even with the explicit `table` override removed,
for every field now backed by the feature.

Two fields stay as plain `useState` (`columnFilterFns`, `globalFilterFn`) —
both are read synchronously before the table exists this render (building
column defs / the `globalFilterFn` table option), and an atom read would be
one render stale, which for these two would be a real visible bug (a filter
change not taking effect until an unrelated re-render happened), not just a
perf blip. `draggingColumn`/`draggingRow` are feature-backed but mirrored
into a ref for the same pre-construction read, since that one only gates a
performance optimization and a stale read there is harmless.

**This refactor caught its own bug via the same headless sweep**: the first
version of the merged `getState()` dropped the pure consumer-passthrough
fields (`isLoading`, `showSkeletons`, `isSaving`, `showLoadingOverlay`,
`showProgressBars` — never backed by any internal state, before or after),
which silently broke `MRT_TableHeadCellSortLabel`'s `isLoading` guard and
crashed `AccessorKeyWhileLoading` by calling `getNextSortingOrder()` against
a synthetic blank loading row. Confirmed via `git stash` that this did not
reproduce against the pre-refactor commit, fixed, and re-verified against
all 399 stories with zero diff from the known-good baseline.

### Follow-up: adopt React Compiler, delete memoMode, start on the re-render-scoping fix

`tableOptions()`/`createTableHook()` investigated and **skipped**: they're
composition helpers for a fixed, reusable table factory with a static shared
options base. MRT builds one dynamic, per-instance, per-render-customized
options object (conditional display columns, faked skeleton rows) — there's
no static base to factor out, and adopting it would add indirection without
removing any of the actual conditional logic already in
`useMRT_TableInstance.ts`/`useMRT_TableOptions.ts`.

The bigger finding: `useTable()` is called with no selector, so the whole
table subscribes to every atom, and most leaf components read
`table.getState()` broadly instead of subscribing to individual atoms — the
real root cause of most avoidable re-render cost, and still an open item
(see below). Separately, the user pointed out that hand-written
`useMemo`/`useCallback`/`memo()` are largely obsolete once React Compiler is
actually running — React 19 (already MRT's peer-dep floor) ships a native
compiler runtime, and the compiler's whole purpose is inserting this
memoization automatically, correctly, based on real dataflow instead of a
manually-written (and frequently wrong) dependency array.

**Landed**: wired `babel-plugin-react-compiler` into MRT's own Rollup build
(`rollup.config.mjs` now runs the JS bundle through Babel — preset-typescript
+ preset-react + the compiler plugin — instead of `@rollup/plugin-typescript`,
which is now scoped to type-checking/`.d.ts` emission only, in a separate
build step so type info isn't lost). Verified genuinely active (not just
installed) by checking the compiled output imports `react/compiler-runtime`.

Lint was completely broken before this pass (`.eslintrc` format incompatible
with the installed `eslint@10`, two plugins referenced but never installed) —
fixed as a prerequisite, since it's also how the compiler's own Rules-of-React
diagnostics (`eslint-plugin-react-hooks`'s bundled `react-hooks/*` rules) get
surfaced. That audit found real violations across ~20 files, mostly reading
`ref.current` during render for layout math, and manually-memoized values
whose dependency arrays don't match what they actually read (which makes the
compiler bail out of optimizing the *whole* component, not just that value —
confirmed empirically via `babel-plugin-react-compiler`'s own diagnostic
logger, which caught cases `eslint-plugin-react-hooks` missed).

Scoped this pass to the components `memoMode` actually wrapped
(`MRT_TableBody`, `MRT_TableBodyRow`, `MRT_TableBodyCell`) plus their direct
parent (`MRT_Table`, since a non-optimized parent handing down new prop
identities every render defeats a child's own memoization regardless). Fixed
per file, re-verified compiler success via the same diagnostic-logger
technique after each fix (not just lint — lint's `preserve-manual-memoization`
rule didn't catch everything the actual compiler flags):

- `MRT_TableBody.tsx`/`MRT_TableBodyRow.tsx`: synchronous `ref.current` reads
  for sticky header/footer height during render, duplicated in both files.
  Replaced with one hook (`useMRT_ObservedElementSize.ts`) that measures via
  `useLayoutEffect` + `ResizeObserver` instead, measured once in
  `MRT_TableBody` and passed down as props rather than each row
  re-measuring independently.
- `MRT_TableBodyCell.tsx`: a `useEffect` calling `setState` synchronously to
  randomize skeleton width — replaced with a deterministic hash of `cell.id`
  computed inline, removing the effect entirely; an `actionCellRef.current =`
  write inside an event handler that the compiler couldn't verify was a ref
  (reached through `table.refs.actionCellRef`, not a direct `useRef()`
  binding) — fixed by destructuring `actionCellRef` to a local binding first,
  which the compiler *can* trace.
- `MRT_TableBody.tsx`/`MRT_TableBodyRow.tsx`/`MRT_TableBodyCell.tsx`/
  `MRT_Table.tsx`: several manually-memoized values (`pinnedRowIds`,
  `bottomPinnedIndex`/`topPinnedIndex`, `draggingBorders`, `columnSizeVars`)
  had dependency arrays that didn't match what they actually read. Deleted
  the manual `useMemo` wrappers rather than hand-fixing each array — the
  compiler infers correct dependencies from real dataflow, which is safer
  than a human re-deriving the same list by hand.

All four files confirmed compiling successfully (not skipped) via the
compiler's own diagnostic output before deleting `memoMode`. **Removed**
`memoMode` entirely (public option, breaking change — see CHANGELOG) and the
three `Memo_MRT_TableBody`/`Memo_MRT_TableBodyRow`/`Memo_MRT_TableBodyCell`
hand-rolled `memo()`-with-custom-comparator wrappers, along with the
now-obsolete `Memod.stories.tsx` and two `memoMode`-specific virtualization
stories. Verified with the full 399-story sweep (0 diff from baseline) plus
a manual screenshot check of sticky row-pinning (confirmed the pinned row
still sits flush under the measured header height after the ref-to-effect
change).

**Not done in this pass** (deferred, not because it's unimportant, but
because it's a materially bigger and riskier change than the above): the
~17 remaining files with Rules-of-React violations found by the same lint
audit (conditional hook calls in `useMaterialReactTable`/`useId`/both
virtualizer hooks, more ref-during-render reads in toolbars/menus/detail
panel, and `useMRT_TableOptions.ts`'s parameter-reassignment pattern, which
is *already* causing the compiler to skip several of its `useMemo` calls
today per the diagnostic logger). None of these cause regressions by being
left alone — the compiler just quietly skips optimizing those specific
components, same as it always has. Also not done: the `useTable()` selector
fix and converting hot leaf components to `useSelector(table.atoms.x)`/
`table.Subscribe` — the actual root-cause re-render-scoping fix — which is
larger and independent of the compiler work above.

### Follow-up: extending React Compiler coverage past the body/row/cell chain

Continued past the initial memoMode-blocking scope into most of the
remaining ~20-file Rules-of-React backlog, since the payoff (more of the
tree actually gets compiler-optimized) was worth it once the pattern was
established. New techniques that came out of this pass, beyond what's
already documented above:

- **Ref mutations reached through a hook-returned object** (`table.refs.x.current = ...`,
  `tableFooterProps.ref.current = ...`) get flagged even when the ref itself
  is destructured to a local binding first — the compiler's "this is a safe
  ref write" allowance only recognizes a *direct* `.current =` assignment
  made by a `useRef()` call it can trace in the same scope, not one reached
  through a member-expression chain into an object handed down from
  elsewhere. Fix: route the actual mutation through a plain external
  function (`mergeRefs`, `setRefMapEntry` in `src/utils/utils.ts`) — calling
  an external function is opaque to the compiler's analysis of the
  *calling* component, so whatever that function does internally isn't
  scrutinized. This pattern fixed six near-identical `ref={(node) => {
  tableXRef.current = node; if (xProps?.ref) xProps.ref.current = node; }}`
  call sites (`MRT_TableFooter`/`MRT_TableHead`/`MRT_TableContainer`/
  `MRT_TablePaper`/`MRT_BottomToolbar`/`MRT_TopToolbar`) and three keyed
  ref-map writes (`MRT_TableHeadCell`, `MRT_EditCellTextField`,
  `MRT_FilterRangeSlider`/`MRT_FilterTextField`'s `filterInputRefs`) — also a
  real de-duplication win (six copies of the same merge-refs boilerplate
  down to one shared 10-line utility), not just a compiler workaround. Found
  and fixed one genuinely dead line along the way in
  `MRT_GlobalFilterTextField.tsx`: `textFieldProps.inputRef = inputRef` was
  mutating a copy *after* the component had already consumed it during
  render, so it never did anything; replaced with the same `mergeRefs` call
  so a consumer-supplied `inputRef` is now actually honored (previously
  silently dropped, since the separate explicit `inputRef` JSX prop always
  won over whatever `{...textFieldProps}` carried).
- **`debounce()` wrapped in `useCallback`** (`MRT_FilterTextField`,
  `MRT_GlobalFilterTextField`) doesn't fit `useMemo`/`useCallback` at all,
  even restructured correctly — `debounce()` returns a stateful closure (its
  own pending-timeout bookkeeping), and the compiler's diagnostic logger
  reported "existing memoization could not be preserved" with no further
  detail, distinct from the usual wrong-dependency-array case. Fixed with
  the *lazy ref initialization* idiom instead (`if (ref.current === null)
  ref.current = debounce(...)`), which is React's own documented pattern for
  "cache an expensive computation across renders without useMemo" — a
  `useRef` doing exactly the job a ref is for, not a `useMemo` stand-in.
- **"Adjusting state when a prop changes"** (`MRT_FilterRangeSlider`,
  `MRT_FilterTextField`, `MRT_GlobalFilterTextField`) replaced three
  `useEffect` + `isMounted` ref combinations that synced local input state
  from external filter state, skipping only the first run. React's own
  documented pattern for this — compare against a `useState`-tracked
  "previous value" during render, conditionally call the local setter right
  there — needs no ref at all and confirmed compiler-safe empirically
  (tested since it wasn't obvious whether the compiler's `set-state-in-render`
  diagnostic would treat this differently from an unconditional one).
- **A genuine, filed compiler limitation** blocked `useMRT_TableOptions.ts`
  entirely (`category: "Todo"`, `"Support destructuring of context
  variables"`) — not a code-quality issue but a not-yet-implemented case in
  `babel-plugin-react-compiler` itself, triggered by reassigning a
  destructured parameter (`icons = useMemo(...)`) rather than introducing a
  new binding. This is the hook that builds options for *every* table
  instance, so fixing it was worth the size of the change: every reassigned
  parameter renamed to a `...Prop` suffix, with a clean local
  `const`/`let` holding the resolved value instead — restores the same
  values, same order, but the compiler can now trace them. Also fixed the
  conditional `useId()` default-parameter call while in there (a real,
  independent Rules-of-Hooks issue) and the "freeze after first render"
  virtualization-flags tuple, which used to reassign the destructured
  parameters via `useMemo(() => [...], [])` (blocked by the same Todo) —
  replaced with `useState`'s lazy initializer, which is the more correct
  primitive for this anyway (the value affects rendered output, so it
  belongs in state, not a ref). Confirmed `CompileSuccess` for the whole
  file after.
- **Two deliberate exceptions, decided against forcing a fix**:
  - `useMRT_TableInstance.ts` mutates the constructed `table` object
    (`table.refs = ...`, `table.getState = ...`, etc.) — this is *not*
    legacy debt, it's this session's own fix (documented above) for the
    exact bug where state only visible on the per-render wrapper object is
    invisible from `column.table`/`header.getContext().table`. Removing it
    to satisfy the compiler would reintroduce that bug. Since one such
    violation skips the whole function regardless, fixing the *other*
    (options-mutation) violations in the same file would buy zero actual
    compiler coverage — left entirely as-is rather than doing cosmetic-only
    churn on the most sensitive file in the codebase.
  - `MRT_CellActionMenu.tsx` reads `actionCellRef.current` directly in JSX
    (`anchorEl={actionCellRef.current}`) to position its popover, and passes
    a ref-touching `closeMenu` callback to arbitrary consumer-supplied
    render functions (`renderCellActionMenuItems`) — fixing this properly
    means either changing the anchor-positioning architecture or accepting
    the compiler's conservative (but not obviously wrong) flagging of a
    callback that touches a ref being handed to unknown external code. This
    is a single-instance, low-render-frequency component; left as-is rather
    than risk a popover-positioning regression for a marginal gain.
    `MaterialReactTable.tsx`'s conditionally-called `useMaterialReactTable()`
    and the virtualizer hooks' conditional `useMemo`/`useVirtualizer`/
    `useCallback` calls (gated on `enableColumnVirtualization`/
    `enableRowVirtualization`, which are already frozen at mount) fall in
    the same "theoretically a Rules-of-Hooks violation, practically safe
    since the gating condition can't change for a mounted instance" category
    — same call, left as-is.

Verified with the full 393-story sweep after each file and again at the end
(0 diff from the post-memoMode-removal baseline — the only textual
difference was a React warning's function-name string changing from
`function ref` to `function`, a devtools display artifact of `mergeRefs`'
returned callback now being anonymous, not a functional change).

### Follow-up: removed a now-redundant forced-rerender hack

`useMRT_Effects.ts` had a `setTimeout(() => rerender(), 150)` on `density`
changes, only when some row was pinned - a workaround from when sticky
pinned-row offsets depended on `tableHeadRef.current?.clientHeight`/
`tableFooterRef.current?.clientHeight` read synchronously during render (see
the React Compiler pass above): changing density resizes the header/footer
via CSS padding, but a plain synchronous ref read at render time wouldn't
pick up the new height until *something else* happened to re-render, hence
forcing one 150ms later (long enough for the resize to settle).

Once `MRT_TableBody.tsx` started measuring that height via
`useMRT_ObservedElementSize` (a `ResizeObserver`-backed hook, added earlier
in this same pass), the hack became redundant: the observer itself detects
the density-driven resize and updates state automatically, no forced
re-render needed. Verified by removing it, then testing the exact scenario
it existed for (pin a row top and bottom, toggle density, screenshot
immediately after the toggle and again well past the old 150ms window) -
pixel-identical in the top-pin case (the only visible diff in the bottom-pin
case was a hover-tooltip fade-in, unrelated), and the full 393-story sweep
stayed at the same 3 pre-existing baseline errors.

### Follow-up: stabilizing the options pipeline (partial - real, measured progress)

Split `useMRT_TableInstance.ts` into two files based on the finding above:
`src/hooks/useMRT_TanStackTableOptions.ts` (new) now owns everything that CAN be made
compiler-safe - `initialState` (frozen once via `useState`'s lazy initializer, matching
the old `useMemo(..., [])` semantics exactly, rather than reactively recomputing), the
six pre-construction local state fields, the `instanceTableFeatures` construction, and
the resulting `statefulTableOptions` object - built fresh each call rather than mutating
`definedTableOptions` in place, which is what let the compiler actually process this
function (confirmed `CompileSuccess`, 8 memo blocks). One real compiler limitation found
and fixed along the way, unrelated to this refactor's own logic: computed object keys
(`{[getColumnId(col)]: value}`) aren't supported yet (`category: "Todo"`) - rewritten
via `Object.fromEntries(arr.map(col => [getColumnId(col), value]))`, same result, no
computed key.

`useMRT_TableInstance.ts` keeps the pieces that can't move: the drag/resize column-defs
bypass cache (a ref written during render - the compiler only tolerates a one-time
`if (ref.current == null)` init, not a repeating conditional write, confirmed by testing
a `useStableMemo`-style ref-cache helper directly and watching the compiler reject it
with the same category), and the mutations onto the constructed `table` object. The
final merge that feeds `useTable()` (`{ features, onXChange, ...statefulTableOptions,
columns, data, globalFilterFn }`) is wrapped in one manual `useMemo` - the one narrowly-
justified exception in this whole pass, since this specific function can never be
compiler-processed (the `table.refs`/`table.getState` mutations rule it out regardless
of what else is in it), so a plain spread here would always produce a new object every
render no matter how stable its pieces are. Every dependency in that `useMemo` is itself
stable-when-unchanged: the `onXChange` setters via React's own useState guarantee,
everything else via the new hook.

**Measured, not assumed**: built a small standalone Vite harness (not Storybook, whose
dev pipeline doesn't run the compiler at all) that imports the actual compiled
`dist/index.js`, temporarily instrumented with counters, and drove it with Playwright -
clicking three row-selection checkboxes (a feature-backed atom unrelated to columns,
data, or any of the new hook's own state) confirmed `statefulTableOptions` from the new
hook stayed at the same reference across all three re-renders (0 additional rebuilds),
proving the extraction genuinely works end-to-end in the real compiled build, not just
in the compiler's static diagnostics. The same test also quantified the remaining gap:
`columns` rebuilt on all three clicks (`prepareColumns` has no bypass for "nothing
column-relevant changed", only for active drag/resize), which cascades into the final
merged options object rebuilding the same three times - so `table`'s own identity is
*measurably* more stable than before (half its real inputs no longer churn spuriously)
but not yet fully stable, pending the columns piece below. All instrumentation was
removed before committing; verified with a full 393-story sweep (0 diff) plus targeted
interaction tests (row creation/editing, filter mode change, pagination, column
grouping - all clean) after removing it.

### What's left for full stability: the columns computation itself

`prepareColumns()` (called from the columns computation) unconditionally builds new
column-def objects on every render it's not bypassing, via calls to the seven
`getMRT_RowXColumnDef()` display-column builders (pinning, drag, actions, expand,
select, numbers, spacer) - none of these were part of this pass's investigation, and
each would need its own analysis (they likely construct closures/render functions
referencing `table`, meaning stabilizing them isn't a small addition on top of this same
technique - it's a comparably-sized investigation of its own, into files not yet looked
at this session). This is *why* `columns` still rebuilds every render outside the
drag/resize bypass window, and is the direct, measured reason `table`'s identity isn't
fully stable yet even after this pass.

### On the deeper re-render-scoping idea (`useTable()` selector / `useSelector(table.atoms.x)`)

Traced this further and found the actual blocker is more fundamental than
"pass `useTable()` a selector": reading the real `useTable()` source
(`@tanstack/react-table@9.2.4`), the wrapper object it returns is
`useMemo(() => ({...table, options: tableOptions, state}), [table,
tableOptions, state])` - and `tableOptions` (the *options argument*, not the
selected state) is a brand-new object literal built fresh in
`useMRT_TableInstance.ts` on every render (`{ features, onColumnOrderChange,
..., ...statefulTableOptions, globalFilterFn }`). Since that dependency
never has a stable identity regardless of what selector is passed, the
memo recomputes - and the wrapper object gets a new reference - on every
render of `useMRT_TableInstance`, independent of which atoms actually
changed. That `table` reference is what gets threaded as an explicit prop
through the entire component tree, so no amount of `useSelector`/
`table.Subscribe` inside a leaf component prevents React from re-invoking
it when its parent re-renders and hands it a "new" `table` prop - fine-
grained atom subscriptions control *what state a component reacts to*, not
*whether React calls it again after an ancestor re-renders*. That second
part still needs either (a) a real fix to make the constructed options
object referentially stable when nothing relevant changed - a
multi-file effort spanning the whole `useMaterialReactTable` →
`useMRT_TableOptions` → `useMRT_TableInstance` construction pipeline, whose
ceiling is ultimately set by whether the *consumer's own* `columns`/`data`
props are stable, not something MRT fully controls - or (b) `React.memo`
with a custom comparator that deliberately ignores `table`'s identity and
compares only the props a component actually cares about (`cell`, `row`,
etc.) - which is exactly what the old `memoMode` comparators did, and which
the compiler's automatic memoization cannot replicate, since it has no way
to know a given prop's identity churn is irrelevant to a specific
component's output. Flagged for the user rather than picked unilaterally:
(a) is a large, cross-cutting rewrite bounded by factors outside MRT's
control; (b) directly reintroduces the hand-written-memo pattern the user
explicitly asked to move away from.

### Follow-up: closing the columns gap, and a caught-and-reverted regression

Closed the gap flagged above. Audited `prepareColumns()`'s seven display-
column builder functions (`getMRT_RowPinningColumnDef`,
`getMRT_RowDragColumnDef`, `getMRT_RowActionsColumnDef`,
`getMRT_RowExpandColumnDef`, `getMRT_RowSelectColumnDef`,
`getMRT_RowNumbersColumnDef`, `getMRT_RowSpacerColumnDef`) plus the six
`showRowXColumn`/`getLeadingDisplayColumnIds`/`getTrailingDisplayColumnIds`
gating functions in `displayColumn.utils.ts` - all seven getters and every
gating function are pure, reading only from `tableOptions` (now the
already-stable `statefulTableOptions`), with one real, easy-to-miss
exception: `getMRT_RowNumbersColumnDef`'s `Cell` render function closes
over `tableOptions.state.pagination` (`pageIndex`/`pageSize`) to compute the
row number in `rowNumberDisplayMode: 'static'` mode - so `columns` *must*
still react to pagination changes, not just column-structure changes.

Given all of that, wrapping the existing `prepareColumns(...)` call itself
in a `useMemo` keyed on `[statefulTableOptions]` was sufficient and correct
- no need to enumerate every individual field, since `statefulTableOptions`
already bundles exactly the right set (including `pagination`) and is
already stable-when-unchanged thanks to the earlier extraction. This is
layered *underneath* the existing drag/resize ref-based bypass, not a
replacement for it - the two are complementary: the ref bypass already kept
`columns` frozen (same cached reference) throughout an entire drag/resize
gesture (`columnResizing` continuously updates during a resize, which would
otherwise thrash the new `useMemo` on every mouse-move frame, since it's
one of the six fields folded into `statefulTableOptions.state` - the
existing ref check short-circuits before that would ever matter). The new
memo's job is everything *else*: renders triggered by row selection, cell
hover, sorting, editing, or any other atom the columns computation never
needed in the first place.

**Measured**: the same standalone-harness technique as before, clicking 5
row-selection checkboxes - `columns` stayed at the same reference across
all 5 (previously rebuilt on every single one). Verified the pagination
dependency specifically still works (not just "doesn't crash"): screenshotted
a `rowNumberDisplayMode: 'static'` story before and after paging, confirming
row numbers correctly read 13-20 on page 2 rather than freezing at 1-6.
Full 393-story sweep stayed at the 3 baseline errors.

**Then attempted the next layer - giving `useTable()` a real selector - and
had to revert it after catching a genuine regression.** The reasoning that
led there: even with `columns`/`statefulTableOptions` now stable,
`useTable()`'s *own* internal wrapper memo is keyed on `[coreTable, options,
state]`, and `state` comes from an internal `useSelector` call with no
selector passed - meaning it re-selects and diffs the *entire* atom store on
every change, so the wrapper (and therefore `table` itself, threaded as a
prop through the whole tree) still got a new reference on every atom change
regardless of the options-object fix. Giving `useTable()` an explicit,
constant selector - decoupling the wrapper's own memo from atom churn, with
a separate `useSyncExternalStore(table.store.subscribe, ...)` subscription
added to keep `useMRT_TableInstance` itself re-rendering on every atom
change (required for `combinedState`/`table.getState()` to stay accurate) -
did make `table`'s reference measurably stable (confirmed: 0 rebuilds
across 5 clicks, down from 5).

**But row selection silently stopped working entirely** - clicking a
checkbox, or the select-all header checkbox, no longer checked anything, no
console errors, nothing. The root cause is architectural, not a coding
mistake in the selector itself: `useMRT_TableInstance.ts` MUTATES
`table.getState`/`table.refs`/etc. onto the *same* object every render
(documented above, and unavoidable - it's the fix for the `getContext()`
bug), and **every leaf component in this codebase still reads state via
`table.getState()` during its own render**, reached only by React
re-invoking that component when its parent re-renders and hands it a "new"
`table` prop. None of them subscribe to individual atoms yet (the
`useSelector(table.atoms.x)`/`table.Subscribe` conversion from the original
plan was never done). Making `table`'s reference stable removes the *only*
signal those components currently have that anything changed - mutating a
property doesn't change an object's reference identity, so a component that
never re-renders never sees the mutation. This isn't a bug to fix in the
selector code; it's a real, load-bearing dependency the rest of the
codebase currently has on `table` changing identity on every render. Fully
reverted (confirmed via the same checkbox test: selection works correctly
again), keeping the columns/options stabilization, which does not have this
problem since nothing downstream skips rendering because of it - it just
stops *wasted* recomputation, without removing the update signal itself.

This means the natural next step *for the deeper fix* is now well-defined
and sequenced: converting leaf components (starting with `MRT_TableBodyCell`/
`MRT_TableBodyRow`, the highest render-multiplicity ones) to
`useSelector(table.atoms.x)`/`table.Subscribe` for the specific state they
read, so they stop depending on `table`'s reference changing to notice
updates - *only after that* does giving `useTable()` a real selector become
safe. Attempting them in the other order (as just demonstrated) breaks the
table outright.

### Recommended follow-up (not blocking this release)

- Soak-test a `5.0.0-rc.x` prerelease in the `frontend` app's staging cycle
  before a final publish.
- The `table`-identity-stability idea has a confirmed, correct fix, but it
  must happen in this order: convert leaf components to atom-based
  subscriptions *first* (starting with `MRT_TableBodyCell`/
  `MRT_TableBodyRow`), *then* give `useTable()` an explicit selector plus
  the `useSyncExternalStore` companion subscription documented above. Doing
  the second step first silently breaks all state-driven interactivity
  (row selection confirmed; sorting, filtering, editing, and anything else
  reached only via `table.getState()` in an unconverted component would
  have the identical failure mode).
