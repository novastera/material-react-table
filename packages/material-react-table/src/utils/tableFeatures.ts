import { type RankingInfo } from '@tanstack/match-sorter-utils';
import {
  createExpandedRowModel,
  createFacetedMinMaxValues,
  createFacetedRowModel,
  createFacetedUniqueValues,
  createFilteredRowModel,
  createGroupedRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  stockFeatures,
  tableFeatures,
} from '@tanstack/react-table';
import { MRT_AggregationFns } from '../fns/aggregationFns';
import { MRT_FilterFns } from '../fns/filterFns';
import { MRT_SortFns } from '../fns/sortingFns';
import { mrtStateFeature } from './mrtStateFeature';

//A single static feature set covering every row model/feature MRT ever conditionally used in v8.
//v9 requires features to be registered once, statically - MRT's own enableX/manualX options
//still gate *behavior* (whether a row model actually does anything), they just no longer gate
//whether the API exists on the table instance at all.
export const MRT_TableFeatures = tableFeatures({
  ...stockFeatures,
  aggregationFns: MRT_AggregationFns,
  expandedRowModel: createExpandedRowModel(),
  facetedMinMaxValues: createFacetedMinMaxValues(),
  facetedRowModel: createFacetedRowModel(),
  facetedUniqueValues: createFacetedUniqueValues(),
  filterFns: MRT_FilterFns,
  filterMeta: {} as RankingInfo,
  filteredRowModel: createFilteredRowModel(),
  groupedRowModel: createGroupedRowModel(),
  mrtStateFeature,
  paginatedRowModel: createPaginatedRowModel(),
  sortFns: MRT_SortFns,
  sortedRowModel: createSortedRowModel(),
});

export type MRT_TableFeaturesType = typeof MRT_TableFeatures;
