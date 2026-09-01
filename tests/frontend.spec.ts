import { test, expect } from '@grafana/plugin-e2e';
import type { Page } from '@playwright/test';

const PLUGIN_TYPE = 'ovhcloud-akvorado-datasource';
const AKVORADO_URL = process.env.AKVORADO_URL || 'https://demo.akvorado.net';

/*
Grafana 13 runs React 19. A plugin that bundles its own react/jsx-runtime
reads the renamed __SECRET_INTERNALS object off Grafana's React instance and
throws while the editor mounts. An API-only test never renders a component,
so it stays green through that failure. These tests render both editors and
fail on any React error.
*/
/*
An uncaught exception is what a React 19 mount failure produces, so every
pageerror fails the test. Console errors are filtered: Grafana's own bundled
apps log unrelated network failures, and failing on those would make this
test a false-alarm generator.
*/
const REACT_ERROR =
  /SECRET_INTERNALS|jsx-runtime|Minified React error|Invalid hook call|ReactCurrentOwner|createFactory|findDOMNode/i;

function collectReactErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error' && REACT_ERROR.test(msg.text())) {
      errors.push(`console: ${msg.text()}`);
    }
  });
  return errors;
}

test.describe('akvorado frontend', () => {
  test('config editor mounts with no React error', async ({ createDataSourceConfigPage, page }) => {
    const errors = collectReactErrors(page);

    await createDataSourceConfigPage({ type: PLUGIN_TYPE });

    /* Rendered by ConnectionSettings, Auth and AdvancedHttpSettings
       from @grafana/plugin-ui. */
    await expect(page.getByRole('heading', { name: 'Connection' })).toBeVisible();
    await expect(page.getByText('Akvorado URL')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Authentication', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Advanced settings' })).toBeVisible();

    expect(errors, `React errors while mounting the config editor:\n${errors.join('\n')}`).toEqual([]);
  });

  test('query editor mounts with no React error', async ({ panelEditPage, createDataSource, page }) => {
    const errors = collectReactErrors(page);

    const ds = await createDataSource({ type: PLUGIN_TYPE, url: AKVORADO_URL });
    await panelEditPage.datasource.set(ds.name);

    await expect(page.getByText('Type of query')).toBeVisible();

    /* CodeMirror is the dependency that pulls in react/jsx-runtime, so its
       editor rendering is the direct proof the externalisation works. */
    await expect(page.locator('.cm-editor')).toBeVisible();

    expect(errors, `React errors while mounting the query editor:\n${errors.join('\n')}`).toEqual([]);
  });

  /*
  Clearing the limit used to snap the box back to 10, because the input
  rendered `limit || DEFAULT_LIMIT`. An empty box now stays empty and warns.
  */
  test('clearing the limit keeps the box empty and warns', async ({ panelEditPage, createDataSource, page }) => {
    const ds = await createDataSource({ type: PLUGIN_TYPE, url: AKVORADO_URL });
    await panelEditPage.datasource.set(ds.name);

    const limit = page.locator('#limit');
    await expect(limit).toHaveValue('10');

    await limit.fill('');
    await expect(limit).toHaveValue('');
    await expect(page.getByText('Limit is required.')).toBeVisible();

    await limit.fill('60');
    await expect(page.getByText(/Limit must be between 1 and \d+\./)).toBeVisible();

    await limit.fill('5');
    await expect(limit).toHaveValue('5');
    await expect(page.getByText('Limit is required.')).toBeHidden();
  });

  /*
  The query row carries a Run query button. The run itself cannot be asserted
  here: the panelEditPage fixture issues no query of its own, so the counter
  never moves. It is checked against a live dashboard instead, where a click
  fires one /api/ds/query each time.
  */
  test('the query row carries a Run query button', async ({ panelEditPage, createDataSource, page }) => {
    const ds = await createDataSource({ type: PLUGIN_TYPE, url: AKVORADO_URL });
    await panelEditPage.datasource.set(ds.name);

    const row = page.locator('[data-testid="data-testid Query editor row"]').first();
    const run = row.getByTestId('akvorado-run-query');

    await expect(run).toBeVisible();
    await expect(run).toBeEnabled();
    await expect(run).toHaveText('Run query');
  });
});
