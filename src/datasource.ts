import { FetchResponse, getBackendSrv, isFetchError } from '@grafana/runtime';
import {
  CoreApp,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  FieldType, Labels,
  toDataFrame,
} from '@grafana/data';

import { DEFAULT_QUERY, Field, MyDataSourceOptions, MyQuery, SandkeyResponse, TimeseriesResponse } from './types';
import { lastValueFrom } from 'rxjs';
import _ from 'lodash';

const queryTypes: { [key: string]: string } = {
  timeseries: '/api/v0/console/graph/line',
  sankey: '/api/v0/console/graph/sankey',
};

const queryUnits: string[] = ['l3bps', 'pps'];

export { queryTypes, queryUnits };

export class DataSource extends DataSourceApi<MyQuery, MyDataSourceOptions> {
  baseUrl: string;

  constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
    super(instanceSettings);
    this.baseUrl = instanceSettings.url!;
  }

  getDefaultQuery(_: CoreApp): Partial<MyQuery> {
    return DEFAULT_QUERY;
  }

  async query(options: DataQueryRequest<MyQuery>): Promise<DataQueryResponse> {
    const { range } = options;
    const from = range!.from.toISOString();
    const to = range!.to.toISOString();

    const dataPromises = options.targets.map(async (target) => {
      let fields: Field[] = [];

      const body = {
        bidirectional: false,
        dimensions: target.dimensions,
        end: to,
        filter: target.expression,
        limit: target.limit,
        points: 200,
        'previous-period': false,
        start: from,
        'truncate-v4': 32,
        'truncate-v6': 128,
        units: target.unit,
      };
      const endpoint: string = queryTypes[target.type];
      if (target.error) {
        return this.emptyResponse();
      }
      if (target.type === 'timeseries') {
        const response = await this.post<TimeseriesResponse>(endpoint, body, '');
        fields.push({ name: 'Time', type: FieldType.time, values: response.data.t });
        response.data.rows.forEach((r, i) => {
          fields.push({ type: FieldType.number, values: response.data.points[i], labels: this.buildLabels(target.dimensions!!, r) });
        });
      } else if (target.type === 'sankey') {
        const response = await this.post<SandkeyResponse>(endpoint, body, '');
        //Create a object per dimension
        target.dimensions?.forEach((d) => {
          fields.push({ name: d, type: FieldType.string, values: [] as string[] });
        });
        //Create a object for value
        fields.push({ name: 'value', type: FieldType.number, values: [] as number[] });

        const data: SandkeyResponse = response.data;
        const rows: string[][] = data.rows;
        const xps: number[] = data.xps;
        rows.forEach((row, rowIndex) => {
          row.forEach((value, index) => {
            //Add dimension value to column
            (fields[index].values as string[]).push(value);
            //Add value to xps column
          });
          (fields[fields.length - 1].values as number[]).push(xps[rowIndex]);
        });

        const foramtedData = {
          fields: fields,
        };
        const frame = toDataFrame(foramtedData);
        frame.name = 'sankey';
        return frame;
      }
      return toDataFrame({
        name: target.unit,
        fields: fields,
      });
    });

    const data = await Promise.all(dataPromises);
    return { data: data };
  }


  buildLabels(dimension: string[], r: string[]): Labels {
    if (dimension.length !== r.length) {
      throw new Error("The length of dimension and r must be the same.");
    }

    const labels: Labels = {};
    for (let i = 0; i < dimension.length; i++) {
      labels[dimension[i]] = r[i];
    }

    return labels;
  }

  private emptyResponse() {
    return toDataFrame({
      name: '',
      fields: [],
    });
  }

  async post<T>(url: string, body?: {}, params?: string): Promise<FetchResponse<T>> {
    const response = getBackendSrv().fetch<T>({
      url: `${this.baseUrl}${url}${params?.length ? `?${params}` : ''}`,
      data: body,
      method: 'POST',
    });
    return lastValueFrom(response);
  }

  async request<T>(url: string, params?: string) {
    const response = getBackendSrv().fetch<T>({
      url: `${this.baseUrl}/${url}${params?.length ? `?${params}` : ''}`,
    });
    return lastValueFrom(response);
  }

  /**
   * Checks whether we can connect to the API.
   */
  async testDatasource() {
    const defaultErrorMessage = 'Cannot connect to API';

    try {
      const response = await this.request('api/v0/healthcheck');
      if (response.status === 200) {
        return {
          status: 'success',
          message: 'Success',
        };
      } else {
        return {
          status: 'error',
          message: response.statusText ? response.statusText : defaultErrorMessage,
        };
      }
    } catch (err) {
      let message = '';
      if (_.isString(err)) {
        message = err;
      } else if (isFetchError(err)) {
        message = 'Fetch error: ' + (err.statusText ? err.statusText : defaultErrorMessage);
        if (err.data && err.data.error && err.data.error.code) {
          message += ': ' + err.data.error.code + '. ' + err.data.error.message;
        }
      }
      return {
        status: 'error',
        message,
      };
    }
  }
}
