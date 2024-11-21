// SPDX-FileCopyrightText: 2022 Free Mobile
// SPDX-License-Identifier: AGPL-3.0-only

import { parser } from './parser';
import { fileTests } from '@lezer/generator/dist/test';

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const caseFile = path.join(path.dirname(fileURLToPath(import.meta.url)), 'grammar.test.txt');

describe('filter parsing', () => {
  fileTests(fs.readFileSync(caseFile, 'utf8'), 'grammar.test.txt').forEach(({ name, run }) => {
    test(name, () => run(parser));
  });
});
