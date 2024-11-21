// SPDX-FileCopyrightText: 2022 Free Mobile
// SPDX-License-Identifier: AGPL-3.0-only

import { LRLanguage, LanguageSupport } from '@codemirror/language';
import { styleTags, tags as t } from '@lezer/highlight';
import { createComplete } from './complete';
import { parser } from './parser';
import { DataSource } from 'datasource';

export const FilterLanguage = LRLanguage.define({
  parser: parser.configure({
    props: [
      styleTags({
        Column: t.propertyName,
        String: t.string,
        Literal: t.literal,
        LineComment: t.lineComment,
        BlockComment: t.blockComment,
        Or: t.logicOperator,
        And: t.logicOperator,
        Not: t.logicOperator,
        Operator: t.compareOperator,
        '( )': t.paren,
      }),
    ],
  }),
  languageData: {
    commentTokens: { line: '--', block: { open: '/*', close: '*/' } },
  },
});

export function filterLanguage() {
  return new LanguageSupport(FilterLanguage);
}
export function filterCompletion(
  datasource: DataSource
) {
  return FilterLanguage.data.of({ autocomplete: createComplete(datasource) });
}
