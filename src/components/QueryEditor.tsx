import React, { ChangeEvent, useState } from 'react';
import { InlineField, Input, Stack, Select, AsyncMultiSelect, useTheme2, CollapsableSection } from '@grafana/ui';
import { QueryEditorProps, SelectableValue, AppEvents } from '@grafana/data';
import { DataSource, queryTypes, queryUnits } from '../datasource';
import { Configuration, DEFAULT_LIMIT, MyDataSourceOptions, MyQuery } from '../types';

import { getAppEvents } from '@grafana/runtime';
import CodeMirror, { EditorView, placeholder } from '@uiw/react-codemirror';
import { filterCompletion, filterLanguage } from 'codemirror/lang-filter';
import { autocompletion } from '@codemirror/autocomplete';
import { history } from '@codemirror/commands';
import { createLinter } from 'codemirror/lang-filter/linter';
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

const appEvents = getAppEvents();
type Props = QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>;

export function QueryEditor({ query, onChange, datasource }: Props) {
  const { limit, type, unit, dimensions } = query;
  const [uiDimensions, setUIDimensions] = useState<Array<SelectableValue<string>>>(
    dimensions?.map((v) => ({ label: v, value: v })) ?? [{ label: 'SrcAS', value: 'SrcAS' }]
  );

  const [expression, setExpression] = useState<string>('InIfBoundary = external');

  const getFilterTheme = (isDark: boolean) => [
    syntaxHighlighting(
      HighlightStyle.define([
        { tag: t.propertyName, color: isDark ? '#fb660a' : '#008800' },
        { tag: t.string, color: isDark ? '#ff0086' : '#880000' },
        { tag: t.comment, color: isDark ? '#7d8799' : '#4f4f4f' },
        { tag: t.operator, color: isDark ? '#00a3ff' : '#333399' },
      ])
    ),
    EditorView.theme({}, { dark: isDark }),
  ];
  const theme = useTheme2();

  const filterTheme = getFilterTheme(theme.isDark);
  const getTheme = (isDark: boolean) => {
    if (isDark) {
      return 'dark';
    } else {
      return 'light';
    }
  };

  const loadAsyncDimensions = async (query: string): Promise<Array<SelectableValue<string>>> => {
    try {
      const response = await datasource.request<Configuration>('/api/v0/console/configuration');
      return (
        response?.data.dimensions
          ?.filter((s) => s.toLowerCase().startsWith(query.toLocaleLowerCase()))
          .map((v) => ({
            label: v,
            value: v,
          }))
          .sort((a, b) => a.label.localeCompare(b.label)) ?? []
      );
    } catch (error) {
        appEvents.publish({
            type: AppEvents.alertError.name,
            payload: ['Failed to fetch dimensions:'+error],
        });
      return [];
    }
  };

  const onDimensionsChange = (selected: Array<SelectableValue<string>>) => {
    const newdimensions = selected.map((v) => v.value).filter((v): v is string => v !== undefined);
    setUIDimensions(selected);
    onChange({ ...query, dimensions: newdimensions });
    let myerror: string | undefined;
    if (query.type === 'sankey' && newdimensions && newdimensions.length < 2) {
      let myerror = "At least two dimensions are required for 'sankey' type queries.";
      appEvents.publish({
        type: AppEvents.alertError.name,
        payload: [myerror],
      });
    }
    onChange({ ...query, dimensions: newdimensions, error: myerror });
  };
  const onTypeChange = (item: SelectableValue<string>) => {
    let myerror: string | undefined;
    if (item.value === 'sankey' && dimensions && dimensions.length < 2) {
      myerror = "At least two dimensions are required for 'sankey' type queries.";
      appEvents.publish({
        type: AppEvents.alertError.name,
        payload: [myerror],
      });
    }
    onChange({ ...query, type: item.value || '', error: myerror });
  };

  const onUnitChange = (item: SelectableValue<string>) => {
    onChange({ ...query, unit: item.value!! });
  };

  const onLimitChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...query, limit: parseInt(event.target.value, 10) });
  };

  const queryTypeOptions = () =>
    Object.keys(queryTypes).map((v) => {
      return { label: v, value: v };
    });

  const queryUnitsOptions = () =>
    queryUnits.map((v) => {
      return { label: v, value: v };
    });

  return (

    <Stack gap={1} direction={'column'}>
      <Stack gap={1}>
        <InlineField label="Type of query" labelWidth={16} tooltip="Select the type of query">
          <Select value={type} options={queryTypeOptions()} onChange={onTypeChange} width={20} />
        </InlineField>
        <InlineField label="Unit" labelWidth={16} tooltip="Select the unit">
          <Select value={unit} options={queryUnitsOptions()} onChange={onUnitChange} width={20} />
        </InlineField>
        <InlineField label="Dimensions" labelWidth={16} tooltip="Select dimensions">
          <AsyncMultiSelect
            defaultOptions
            placeholder="Select dimensions"
            loadOptions={loadAsyncDimensions}
            value={uiDimensions}
            onChange={onDimensionsChange}
            width={32}
          />
        </InlineField>
        <InlineField label="Limit" labelWidth={16} tooltip="Number of results returned by the query (max 50)">
          <Input
            id="limit"
            type="text"
            value={limit || DEFAULT_LIMIT}
            onChange={onLimitChange}
            placeholder="Enter limit"
            onKeyDown={(event) => {
              const key = event.key;
              if (
                !(
                  /[0-9]/.test(key) ||
                  key === 'Backspace' ||
                  key === 'Delete' ||
                  key === 'ArrowLeft' ||
                  key === 'ArrowRight'
                )
              ) {
                event.preventDefault();
              }
            }}
            width={10}
          />
        </InlineField>
        <InlineField label="Filters" tooltip="Filters for the query" grow={true} labelWidth={16}>
          <CodeMirror
            value={expression || ''}
            theme={getTheme(theme.isDark)}
            extensions={[
              filterLanguage(),
              filterCompletion(datasource),
              autocompletion({ icons: false }),
              createLinter(datasource),
              history(),
              ...filterTheme,
              placeholder('Filter expression'),
              EditorView.lineWrapping,
              EditorView.updateListener.of((viewUpdate) => {
                if (viewUpdate.docChanged) {
                  setExpression(viewUpdate.state.doc.toString());
                  onChange({ ...query, expression: viewUpdate.state.doc.toString() });
                }
                if (viewUpdate.focusChanged) {
                  if (!viewUpdate.view.hasFocus) {
                    // Trim spaces
                    const index = viewUpdate.state.doc.toString().search(/\s+$/);
                    if (index !== -1) {
                      viewUpdate.view.dispatch({
                        changes: {
                          from: index,
                          to: viewUpdate.state.doc.length,
                        },
                      });
                    }
                  }
                }
              }),
            ]}
          />
        </InlineField>
      </Stack>
      <Stack>
        <CollapsableSection label="Options" isOpen={false}>
        <InlineField label="Legend" labelWidth={16} tooltip="Series name override or template. Ex {{hostname}} will be replaced with label values for hostname.">
          <Select value={type} options={queryTypeOptions()} onChange={onTypeChange} width={20} />
        </InlineField>
        </CollapsableSection>
      </Stack>
    </Stack >


  );
}
