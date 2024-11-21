import {DataSourceJsonData, FieldType, Labels} from '@grafana/data';
import { DataQuery } from '@grafana/schema';
export const DEFAULT_LIMIT = 10;

export interface MyQuery extends DataQuery {
  expression?: string;
  dimensions?: string[];
  type: string;
  limit: number;
  unit: string;
  error: string | undefined;
}

export interface Field {
  name?: string;
  type: FieldType;
  labels?: Labels;
  values: string[] | number[];
}

export const DEFAULT_QUERY: Partial<MyQuery> = {
  expression: 'InIfBoundary = external',
  type: 'timeseries',
  dimensions: ['SrcAS'],
  limit: DEFAULT_LIMIT,
  unit: 'l3bps',
};
export type ApiCompleteResult = {
  completions: Array<{ label: string; detail?: string; quoted: boolean }>;
};

export interface SandkeyResponse {
  rows: string[][];
  xps: number[];
  nodes: string[];
  links: Link[];
}

export interface Link {
  source: string;
  target: string;
  xps: number;
}

export interface TimeseriesResponse {
  ninetyFifth: number[];
  average: number[];
  axis: number[];
  axisNames: {};
  max: number[];
  min: number[];
  points: number[][];
  rows: string[][];
  t: string[];
}

export interface Configuration {
  defaultVisualizeOptions: DefaultVisualizeOptions;
  dimensions: string[];
  dimensionsLimit: number;
  homepageTopWidgets: string[];
  truncatable: string[];
  version: string;
}

export interface DefaultVisualizeOptions {
  graphType: string;
  start: string;
  end: string;
  filter: string;
  dimensions: string[];
  limit: number;
}

/**
 * These are options configured for each DataSource instance
 */
export interface MyDataSourceOptions extends DataSourceJsonData {
  url?: string;
}
