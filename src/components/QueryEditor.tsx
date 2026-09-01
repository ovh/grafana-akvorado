import React, { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { css } from '@emotion/css';
import { Input, Select, AsyncMultiSelect, useTheme2, useStyles2 } from '@grafana/ui';
import { EditorField, EditorFieldGroup, EditorRow, EditorRows } from '@grafana/plugin-ui';
import { QueryEditorProps, SelectableValue, AppEvents } from '@grafana/data';
import { DataSource, queryTypes, queryUnits } from '../datasource';
import { DEFAULT_QUERY, MyDataSourceOptions, MyQuery } from '../types';
import {
  DEFAULT_MAX_LIMIT,
  MAX_TRUNCATE_V4,
  MAX_TRUNCATE_V6,
  SANKEY_DIMENSIONS_ERROR,
  firstError,
  validateQuery,
} from '../queryValidation';

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
  const { type, unit, dimensions, expression, topType } = query;
  const [uiDimensions, setUIDimensions] = useState<Array<SelectableValue<string>>>(
    dimensions?.map((v) => ({ label: v, value: v })) ?? [{ label: 'SrcAS', value: 'SrcAS' }]
  );
  const [containsAddr, setContainsAddr] = useState(false);
  const [maxLimit, setMaxLimit] = useState(DEFAULT_MAX_LIMIT);

  /* Akvorado refuses a limit above its own dimensionsLimit, so the check uses
     the value the console reports and falls back to the shipped default. */
  useEffect(() => {
    let live = true;
    datasource
      .getConfiguration()
      .then((config) => {
        if (live && config?.dimensionsLimit) {
          setMaxLimit(config.dimensionsLimit);
        }
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [datasource]);

  useEffect(() => {
    const addrCheck = uiDimensions.some(dim => dim.value !== undefined && dim.value.includes('Addr'));
    setContainsAddr(addrCheck);
  }, [uiDimensions]);

  const [uiExpression, setUIExpression] = useState<string>(expression || DEFAULT_QUERY.expression!!);
  const [uiTopType, setUITopType] = useState<string>(topType || DEFAULT_QUERY.topType!!);
  // Handler for the dropdown change event
  const handleLimitTypeChange = (item: SelectableValue<string>) => {
    const value = item.value!!;
    setUITopType(value);
    onChange({ ...query, topType: value });
  };




  /*
  A query can reach the editor without these values, and the query then runs on
  the documented defaults. `??` fills the box for that case only: an empty
  string is a deliberate clear, so it stays empty and warns.
  */
  const effectiveQuery: MyQuery = useMemo(
    () => ({
      ...query,
      limit: query.limit ?? DEFAULT_QUERY.limit!!,
      truncatev4: query.truncatev4 ?? DEFAULT_QUERY.truncatev4!!,
      truncatev6: query.truncatev6 ?? DEFAULT_QUERY.truncatev6!!,
    }),
    [query]
  );
  const validationErrors = validateQuery(effectiveQuery, { maxLimit, withTruncate: containsAddr });
  const queryError = firstError(validationErrors);

  /* filterQuery skips a query that carries an error, so a value the query
     cannot use stops the request and shows the warning, instead of running
     with a default nobody asked for. */
  useEffect(() => {
    if ((query.error ?? undefined) !== queryError) {
      onChange({ ...query, error: queryError });
    }
  }, [query, queryError, onChange]);

  const theme = useTheme2();
  const styles = useStyles2(getStyles);

  /* Theme tokens, so the filter editor follows Grafana in both light and dark
     mode instead of carrying its own hex values. */
  const filterTheme = [
    syntaxHighlighting(
      HighlightStyle.define([
        { tag: t.propertyName, color: theme.colors.primary.text },
        { tag: t.string, color: theme.colors.success.text },
        { tag: t.comment, color: theme.colors.text.secondary },
        { tag: t.operator, color: theme.colors.warning.text },
      ])
    ),
    EditorView.theme({}, { dark: theme.isDark }),
  ];

  const loadAsyncDimensions = async (query: string): Promise<Array<SelectableValue<string>>> => {
    try {
      const config = await datasource.getConfiguration();
      return (
        config?.dimensions
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
        payload: ['Failed to fetch dimensions:' + error],
      });
      return [];
    }
  };

  const onDimensionsChange = (selected: Array<SelectableValue<string>>) => {
    const newdimensions = selected.map((v) => v.value).filter((v): v is string => v !== undefined);
    setUIDimensions(selected);
    if (query.type === 'sankey' && newdimensions.length < 2) {
      appEvents.publish({
        type: AppEvents.alertError.name,
        payload: [SANKEY_DIMENSIONS_ERROR],
      });
    }
    onChange({ ...query, dimensions: newdimensions });
  };

  const onTypeChange = (item: SelectableValue<string>) => {
    if (item.value === 'sankey' && (dimensions?.length ?? 0) < 2) {
      appEvents.publish({
        type: AppEvents.alertError.name,
        payload: [SANKEY_DIMENSIONS_ERROR],
      });
    }
    onChange({ ...query, type: item.value || '' });
  };

  const onUnitChange = (item: SelectableValue<string>) => {
    onChange({ ...query, unit: item.value!! });
  };

  const onLimitChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...query, limit: event.target.value });
  };

  // Handler for uiTruncatedV4 input change
  const onTruncatedV4Change = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...query, truncatev4: event.target.value });
  }


  // Handler for uiTruncatedV6 input change
  const onTruncatedV6Change = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...query, truncatev6: event.target.value });
  };

  const queryTypeOptions = () =>
    Object.keys(queryTypes).map((v) => {
      return { label: v, value: v };
    });

  const queryUnitsOptions = () =>
    queryUnits.map((v) => {
      return { label: v, value: v };
    });

  const queryTopOptions = () => {
    return [{ label: "Avg", value: "avg" }, { label: "Max", value: "max" }]
  }

  return (
    <EditorRows>
      <EditorRow>
        <EditorFieldGroup>
          <EditorField label="Type of query" tooltip="Select the type of query">
            <Select value={type} options={queryTypeOptions()} onChange={onTypeChange} width={18} />
          </EditorField>
          <EditorField label="Unit" tooltip="Select the unit">
            <Select value={unit} options={queryUnitsOptions()} onChange={onUnitChange} width={14} />
          </EditorField>
          <EditorField
            label="Dimensions"
            tooltip="Select the dimensions the results are grouped by"
            invalid={!!validationErrors.dimensions}
            error={validationErrors.dimensions}
          >
            <AsyncMultiSelect
              defaultOptions
              placeholder="Select dimensions"
              loadOptions={loadAsyncDimensions}
              value={uiDimensions}
              onChange={onDimensionsChange}
              width={24}
            />
          </EditorField>
          <EditorField
            label="Limit"
            tooltip={`Number of results returned by the query (max ${maxLimit})`}
            invalid={!!validationErrors.limit}
            error={validationErrors.limit}
          >
            <Input
              id="limit"
              type="text"
              value={effectiveQuery.limit}
              onChange={onLimitChange}
              placeholder="Enter limit"
              width={8}
            />
          </EditorField>
          <EditorField label="Top by" tooltip="How the limit picks the top results">
            <Select
              id="uiLimitType"
              value={uiTopType}
              onChange={handleLimitTypeChange}
              options={queryTopOptions()}
              width={12}
            />
          </EditorField>
        </EditorFieldGroup>
      </EditorRow>

      <EditorRow>
        <div className={styles.filter}>
          <EditorField label="Filter" tooltip="Filter expression for the query">
            <CodeMirror
              value={uiExpression}
              theme={theme.isDark ? 'dark' : 'light'}
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
                    setUIExpression(viewUpdate.state.doc.toString());
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
          </EditorField>
        </div>
      </EditorRow>

      {containsAddr && (
        <EditorRow>
          <EditorFieldGroup>
            <EditorField
              label="IPv4 prefix length"
              tooltip="Group IPv4 addresses by this prefix length"
              invalid={!!validationErrors.truncatev4}
              error={validationErrors.truncatev4}
            >
              <Input
                id="uiTruncatedV4"
                type="number"
                value={effectiveQuery.truncatev4}
                onChange={onTruncatedV4Change}
                min={0}
                max={MAX_TRUNCATE_V4}
                width={8}
              />
            </EditorField>
            <EditorField
              label="IPv6 prefix length"
              tooltip="Group IPv6 addresses by this prefix length"
              invalid={!!validationErrors.truncatev6}
              error={validationErrors.truncatev6}
            >
              <Input
                id="uiTruncatedV6"
                type="number"
                value={effectiveQuery.truncatev6}
                onChange={onTruncatedV6Change}
                min={0}
                max={MAX_TRUNCATE_V6}
                width={8}
              />
            </EditorField>
          </EditorFieldGroup>
        </EditorRow>
      )}
    </EditorRows>
  );
}

/* The filter expression owns its whole row, the way the query field does in
   the Prometheus editor. */
const getStyles = () => ({
  filter: css({
    flexGrow: 1,
    minWidth: 0,
  }),
});
