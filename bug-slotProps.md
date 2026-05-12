# Bug: `slotProps.list` Type Incompatibility on `Menu` Component

## Description
When using the `Menu` component in Material UI v9 (alpha), specifying `slotProps.list` results in a TypeScript error:
`Object literal may only specify known properties, and 'list' does not exist in type '{ root?: ...; paper?: ...; }'`.

This occurs because the TypeScript definitions for the `Menu` component in the current MUI v9 alpha versions sometimes fail to correctly expose the `list` slot, instead falling back to the slots available in the parent `Popover` or `Modal` components (which only define `root`, `paper`, `backdrop`, and `transition`).

## Root Cause
This is likely an upstream issue in `@mui/material` v9's type definitions where the `MenuSlotsAndSlotProps` are not being correctly merged or prioritized when the component is used in a generic context or with spread props.

## Solution
The issue can be resolved by ensuring that the `slotProps` object is correctly typed as part of the `Menu` component's expected structure. This is most easily achieved by merging the manual `slotProps` with the one from the spread `rest` props, which provides the necessary type context to the compiler.

### Example (Fixed)
```tsx
<Menu
  {...rest}
  slotProps={{
    ...rest.slotProps,
    list: {
      dense: true,
      ...rest.slotProps?.list,
    },
  }}
>
```

This pattern ensures that TypeScript sees the full set of available slots for the `Menu` component.

## Affected Files in `material-react-table`
The following files have been refactored to use the correct `slotProps.list` pattern:

- `packages/material-react-table/src/components/menus/MRT_CellActionMenu.tsx`
- `packages/material-react-table/src/components/menus/MRT_ColumnActionMenu.tsx`
- `packages/material-react-table/src/components/menus/MRT_FilterOptionMenu.tsx`
- `packages/material-react-table/src/components/menus/MRT_RowActionMenu.tsx`
- `packages/material-react-table/src/components/menus/MRT_ShowHideColumnsMenu.tsx`

## Recommendation
Once MUI v9 reaches a more stable release and correctly fixes the `Menu` slot types, these components can be reverted to use the standardized `slotProps.list` pattern if desired for architectural consistency.
