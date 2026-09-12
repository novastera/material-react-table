import { useState } from 'react';
import { type MRT_ColumnDef, MaterialReactTable } from '../../src';
import { faker } from '@faker-js/faker';
import { type Meta } from '@storybook/react';

const meta: Meta = {
  title: 'Features/Row Dragging Examples',
};

export default meta;

const columns: MRT_ColumnDef<(typeof initData)[0]>[] = [
  {
    accessorKey: 'id',
    header: 'ID',
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
    accessorKey: 'age',
    header: 'Age',
  },
  {
    accessorKey: 'state',
    header: 'State',
  },
];

const initData = [...Array(25)].map(() => ({
  age: faker.number.int(20) + 18,
  email: faker.internet.email(),
  firstName: faker.person.firstName(),
  id: faker.string.alphanumeric(6),
  lastName: faker.person.lastName(),
  state: faker.location.state(),
}));

//enableRowDragging (not enableRowOrdering) shows the grab handle and lets rows be picked up/
//visually dragged, but does NOT populate hoveredRow or commit any reorder on drop - that's
//intentional (a narrower "just show the handle" flag for consumers wiring their own drop logic
//via the raw dnd-kit event in muiRowDragHandleProps.onDragEnd), not a bug. If you're looking for
//rows that actually reorder when dropped, see RowOrdering.stories.tsx's RowOrderingEnabled
//instead - that's the story demonstrating enableRowOrdering + the built-in commit pattern.
export const RowDraggingEnabled = () => {
  const [data, _setData] = useState(() => initData);

  return (
    <MaterialReactTable
      autoResetPageIndex={false}
      columns={columns}
      data={data}
      enableRowDragging
    />
  );
};

export const RowDraggingEnabledGrid = () => {
  const [data, _setData] = useState(() => initData);

  return (
    <MaterialReactTable
      autoResetPageIndex={false}
      columns={columns}
      data={data}
      enableRowDragging
      layoutMode="grid"
    />
  );
};

export const RowDraggingEnabledGridNoGrow = () => {
  const [data, _setData] = useState(() => initData);

  return (
    <MaterialReactTable
      autoResetPageIndex={false}
      columns={columns}
      data={data}
      enableRowDragging
      layoutMode="grid-no-grow"
    />
  );
};
