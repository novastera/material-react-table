import { faker } from '@faker-js/faker';
import { type Meta } from '@storybook/react';
import { useState } from 'react';

import {
  MaterialReactTable,
  type MRT_ColumnDef,
  type MRT_Row,
  reorderRows,
} from '../../src';

const meta: Meta = {
  title: 'Features/Row Ordering Examples',
};

export default meta;

type Person = {
  address: string;
  city: string;
  email: string;
  firstName: string;
  lastName: string;
  num: number;
  state: string;
};

//'#' is bound to each row's own static `num` field (set once in initData below, never touched by
//reorderRows), not to the row's live display position - so it deliberately does NOT renumber
//itself as rows are dragged/dropped. Mid-drag this looks like the number "isn't following" the
//row (it stays showing its original value while the row visually moves elsewhere) - that's
//expected for this demo's data shape, not a bug in row dragging itself. A consumer wanting an
//always-sequential display column would bind it to `row.index` (updates live) instead of a plain
//data field like this.
const columns: MRT_ColumnDef<Person>[] = [
  {
    accessorKey: 'num',
    header: '#',
  },
  {
    accessorKey: 'firstName',
    header: 'First Name',
  },
  {
    accessorKey: 'lastName',
    header: 'Last Name',
  },
  {
    accessorKey: 'email',
    header: 'Email Address',
  },
  {
    accessorKey: 'address',
    header: 'Address',
  },
  {
    accessorKey: 'city',
    header: 'City',
  },
  {
    accessorKey: 'state',
    header: 'State',
  },
];

const initData = [...Array(100)].map((_, i) => ({
  address: faker.location.streetAddress(),
  city: faker.location.city(),
  email: faker.internet.email(),
  firstName: faker.person.firstName(),
  lastName: faker.person.lastName(),
  num: i,
  state: faker.location.state(),
}));

export const RowOrderingEnabled = () => {
  const [data, setData] = useState(() => initData);

  return (
    <MaterialReactTable
      autoResetPageIndex={false}
      columns={columns}
      data={data}
      enableRowOrdering
      enableSorting={false}
      muiRowDragHandleProps={({ table }) => ({
        onDragEnd: () => {
          const { draggingRow, hoveredRow } = table.getState();
          setData((prev) => reorderRows(prev, draggingRow, hoveredRow));
        },
      })}
    />
  );
};

export const RowOrderingWithSelect = () => {
  const [data, setData] = useState(() => initData);
  const [draggingRow, setDraggingRow] = useState<MRT_Row<Person> | null>(null);
  const [hoveredRow, setHoveredRow] = useState<null | Partial<MRT_Row<Person>>>(
    null,
  );

  return (
    <MaterialReactTable
      autoResetPageIndex={false}
      columns={columns}
      data={data}
      enableRowOrdering
      enableRowSelection
      enableSorting={false}
      getRowId={(row) => row.email}
      muiRowDragHandleProps={{
        onDragEnd: () => {
          setData((prev) => reorderRows(prev, draggingRow, hoveredRow));
        },
      }}
      onDraggingRowChange={setDraggingRow}
      onHoveredRowChange={setHoveredRow}
      state={{
        draggingRow,
        hoveredRow,
      }}
    />
  );
};

export const RowOrderingWithPinning = () => {
  const [data, setData] = useState(() => initData);
  const [draggingRow, setDraggingRow] = useState<MRT_Row<Person> | null>(null);
  const [hoveredRow, setHoveredRow] = useState<null | Partial<MRT_Row<Person>>>(
    null,
  );

  return (
    <MaterialReactTable
      autoResetPageIndex={false}
      columns={columns}
      data={data}
      enableColumnPinning
      enableRowOrdering
      enableSorting={false}
      muiRowDragHandleProps={{
        onDragEnd: () => {
          setData((prev) => reorderRows(prev, draggingRow, hoveredRow));
        },
      }}
      onDraggingRowChange={setDraggingRow}
      onHoveredRowChange={setHoveredRow}
      state={{
        draggingRow,
        hoveredRow,
      }}
    />
  );
};

export const RowAndColumnOrdering = () => {
  const [data, setData] = useState(() => initData);
  const [draggingRow, setDraggingRow] = useState<MRT_Row<Person> | null>(null);
  const [hoveredRow, setHoveredRow] = useState<null | Partial<MRT_Row<Person>>>(
    null,
  );

  return (
    <MaterialReactTable
      autoResetPageIndex={false}
      columns={columns}
      data={data}
      enableColumnOrdering
      enableColumnPinning
      enableRowOrdering
      enableSorting={false}
      muiRowDragHandleProps={{
        onDragEnd: () => {
          setData((prev) => reorderRows(prev, draggingRow, hoveredRow));
        },
      }}
      onDraggingRowChange={setDraggingRow}
      onHoveredRowChange={setHoveredRow}
      state={{
        draggingRow,
        hoveredRow,
      }}
    />
  );
};

export const RowOrderingWithRowVirtualization = () => {
  const [data, setData] = useState(() => initData);

  return (
    <MaterialReactTable
      autoResetPageIndex={false}
      columns={columns}
      data={data}
      enablePagination={false}
      enableRowOrdering
      enableRowVirtualization
      enableSorting={false}
      muiRowDragHandleProps={({ table }) => ({
        onDragEnd: () => {
          const { draggingRow, hoveredRow } = table.getState();
          setData((prev) => reorderRows(prev, draggingRow, hoveredRow));
        },
      })}
    />
  );
};

const fakeColumns = [...Array(500)].map((_, i) => {
  return {
    accessorKey: i.toString(),
    header: 'Column ' + i.toString(),
  };
});

const fakeData = [...Array(500)].map(() => ({
  ...Object.fromEntries(
    fakeColumns.map((col) => [col.accessorKey, faker.person.firstName()]),
  ),
}));

export const RowOrderingWithColumnVirtualization = () => {
  const [data, setData] = useState(() => fakeData);

  return (
    <MaterialReactTable
      autoResetPageIndex={false}
      columns={fakeColumns}
      data={data}
      displayColumnDefOptions={{
        'mrt-row-drag': {
          enableColumnDragging: true,
          enableColumnOrdering: true,
        },
      }}
      enableColumnOrdering
      enableColumnVirtualization
      enableRowOrdering
      enableSorting={false}
      muiRowDragHandleProps={({ table }) => ({
        onDragEnd: () => {
          const { draggingRow, hoveredRow } = table.getState();
          setData((prev) => reorderRows(prev, draggingRow, hoveredRow));
        },
      })}
    />
  );
};
