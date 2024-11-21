import React from 'react';
import { DataSourceHttpSettings } from '@grafana/ui';
import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { MyDataSourceOptions } from '../types';

interface Props extends DataSourcePluginOptionsEditorProps<MyDataSourceOptions> {}


export function ConfigEditor(props: Props) {
  const { onOptionsChange, options } = props;
  return (
    <>
      <DataSourceHttpSettings
        defaultUrl="https://demo.akvorado.net"
        dataSourceConfig={options}
        onChange={onOptionsChange}
        sigV4AuthToggleEnabled={true}
      />
    </>
  );

}
