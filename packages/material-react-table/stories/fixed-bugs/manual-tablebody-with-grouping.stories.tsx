import { useState } from 'react';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { faker } from '@faker-js/faker';
import { type Meta } from '@storybook/react';
import {
  MRT_TableBodyCellValue,
  flexRender,
  useMaterialReactTable,
  type MRT_ColumnDef,
} from '../../src';

const meta: Meta = {
  title: 'Fixed Bugs/Manual TableBody with MRT_TableBodyCellValue',
};

export default meta;

interface Person {
  city: string;
  firstName: string;
  lastName: string;
  state: string;
}

const columns: MRT_ColumnDef<Person>[] = [
  { accessorKey: 'firstName', header: 'First Name' },
  { accessorKey: 'lastName', header: 'Last Name' },
  { accessorKey: 'state', header: 'State' },
  { accessorKey: 'city', header: 'City' },
];

const data: Person[] = [...Array(30)].map(() => ({
  city: faker.location.city(),
  firstName: faker.person.firstName(),
  lastName: faker.person.lastName(),
  state: faker.location.state(),
}));

// Regression coverage: a real consumer (a hand-rolled <TableBody> rendering
// MRT_TableBodyCellValue directly, bypassing MRT_TableBodyCell) combined with grouping used to
// render every cell in the grouped "State" column as blank, because a since-removed guard treated
// TanStack's grouping-only `cell.getIsPlaceholder()` as a loading signal. Toggle "isLoading" to
// also confirm the skeleton path still works for this same direct-usage pattern.
export const ManualTableBodyWithGrouping = () => {
  const [isLoading, setIsLoading] = useState(false);

  const table = useMaterialReactTable({
    columns,
    data,
    enableGrouping: true,
    initialState: { expanded: true, grouping: ['state'] },
    state: { isLoading },
  });

  return (
    <>
      <FormControlLabel
        control={
          <Switch
            checked={isLoading}
            onChange={(e) => setIsLoading(e.target.checked)}
          />
        }
        label="isLoading"
      />
      <TableContainer>
        <Table>
          <TableHead>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableCell key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.Header ??
                            header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableHead>
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
        </Table>
      </TableContainer>
    </>
  );
};
