import React from 'react';
import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import {
  AdvancedHttpSettings,
  Auth,
  ConfigSection,
  ConnectionSettings,
  convertLegacyAuthProps,
} from '@grafana/plugin-ui';

import { MyDataSourceOptions } from '../types';

interface Props extends DataSourcePluginOptionsEditorProps<MyDataSourceOptions> {}

export function ConfigEditor({ options, onOptionsChange }: Props) {
  return (
    <>
      <ConnectionSettings
        config={options}
        onChange={onOptionsChange}
        urlLabel="Akvorado URL"
        urlPlaceholder="https://demo.akvorado.net"
        urlTooltip="Base URL of the Akvorado console. The plugin appends /api/v0/console/... to it."
      />

      <Auth {...convertLegacyAuthProps({ config: options, onChange: onOptionsChange })} />

      <ConfigSection title="Advanced settings" isCollapsible isInitiallyOpen={false}>
        <AdvancedHttpSettings config={options} onChange={onOptionsChange} />
      </ConfigSection>
    </>
  );
}
