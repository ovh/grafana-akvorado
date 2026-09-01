import { DataSourceWithBackend, getTemplateSrv } from '@grafana/runtime';
import { DataSourceInstanceSettings, ScopedVars } from '@grafana/data';

import { ApiCompleteResult, Configuration, DEFAULT_QUERY, MyDataSourceOptions, MyQuery } from './types';

const queryTypes: { [key: string]: string } = {
  timeseries: '/api/v0/console/graph/line',
  sankey: '/api/v0/console/graph/sankey',
};

const queryUnits: string[] = ['l3bps', 'pps'];

export { queryTypes, queryUnits };

export interface FilterValidationResponse {
  errors?: Array<{
    offset: number;
    message: string;
  }>;
}

export class DataSource extends DataSourceWithBackend<MyQuery, MyDataSourceOptions> {
  constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
    super(instanceSettings);
  }

  getDefaultQuery(): Partial<MyQuery> {
    return DEFAULT_QUERY;
  }

  applyTemplateVariables(query: MyQuery, scopedVars: ScopedVars): MyQuery {
    const tmpl = getTemplateSrv();
    return {
      ...query,
      expression: query.expression ? tmpl.replace(query.expression, scopedVars) : query.expression,
      /* String() because a saved dashboard can hold a number here, and the
         template service replaces variables in strings only. */
      limit: query.limit ? tmpl.replace(String(query.limit), scopedVars) : query.limit,
      truncatev4: query.truncatev4 ? tmpl.replace(String(query.truncatev4), scopedVars) : query.truncatev4,
      truncatev6: query.truncatev6 ? tmpl.replace(String(query.truncatev6), scopedVars) : query.truncatev6,
    };
  }

  filterQuery(query: MyQuery): boolean {
    return !query.error;
  }

  /*
   * Resource calls — proxied through the Grafana backend so they work on
   * shared (public) dashboards as well.
   */

  async getConfiguration(): Promise<Configuration> {
    return this.getResource('configuration');
  }

  async validateFilter(filter: string): Promise<FilterValidationResponse> {
    return this.postResource('filter/validate', { filter });
  }

  async completeFilter(payload: { what: string; column?: string; prefix?: string }): Promise<ApiCompleteResult> {
    return this.postResource('filter/complete', payload);
  }
}
