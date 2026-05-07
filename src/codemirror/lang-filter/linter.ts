// SPDX-FileCopyrightText: 2022 Free Mobile
// SPDX-License-Identifier: AGPL-3.0-only

import { syntaxTree } from '@codemirror/language';
import type { EditorView } from '@codemirror/view';
import { DataSource } from 'datasource';
import { linter } from '@codemirror/lint';

enum Severity {
  Error = 'error',
  Warning = 'warning',
  Info = 'info',
  Hint = 'hint',
}
// Define the linter function
export const createLinter = (datasource: DataSource) => {
  return linter(async (view: EditorView) => {
    const code = view.state.doc.toString();
    let data;
    try {
      data = await datasource.validateFilter(code);
    } catch (err) {
      return [];
    }

    return (
      data.errors?.map(({ offset, message }) => {
        const syntaxNode = syntaxTree(view.state).resolve(offset, 1);
        const word = view.state.wordAt(offset);
        const { from, to } = {
          from: (syntaxNode.name !== 'Filter' && syntaxNode?.from) || word?.from || offset,
          to: (syntaxNode.name !== 'Filter' && syntaxNode?.to) || word?.to || offset,
        };
        return {
          from: from === to ? from - 1 : from,
          to,
          severity: Severity.Error,
          message,
        };
      }) || []
    );
  });
};
