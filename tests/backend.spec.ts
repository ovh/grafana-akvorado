import { test, expect } from '@grafana/plugin-e2e';

const PLUGIN_TYPE = 'ovhcloud-akvorado-datasource';
const AKVORADO_URL = process.env.AKVORADO_URL || 'https://demo.akvorado.net';

/*
End-to-end tests covering the backend plugin path required for public
(shared) dashboards: CheckHealth, resource proxy, and QueryData all run
inside the Grafana backend instead of the browser, so they keep working
when no user session is present.
*/
test.describe('akvorado backend plugin', () => {
  test('CheckHealth returns OK for a reachable akvorado URL', async ({ createDataSource, request }) => {
    const ds = await createDataSource({ type: PLUGIN_TYPE, url: AKVORADO_URL });

    const resp = await request.get(`/api/datasources/uid/${ds.uid}/health`);
    await expect(resp).toBeOK();
    expect(await resp.json()).toMatchObject({ status: 'OK' });
  });

  test('resource proxy returns akvorado configuration', async ({ createDataSource, request }) => {
    const ds = await createDataSource({ type: PLUGIN_TYPE, url: AKVORADO_URL });

    const resp = await request.get(`/api/datasources/uid/${ds.uid}/resources/configuration`);
    await expect(resp).toBeOK();
    const cfg = await resp.json();
    expect(Array.isArray(cfg.dimensions)).toBe(true);
    expect(cfg.dimensions.length).toBeGreaterThan(0);
  });

  test('resource proxy validates a filter expression', async ({ createDataSource, request }) => {
    const ds = await createDataSource({ type: PLUGIN_TYPE, url: AKVORADO_URL });

    const resp = await request.post(`/api/datasources/uid/${ds.uid}/resources/filter/validate`, {
      data: { filter: 'InIfBoundary = external' },
    });
    await expect(resp).toBeOK();
    expect(await resp.json()).toMatchObject({ message: 'ok' });
  });

  test('QueryData returns timeseries frames', async ({ createDataSource, request }) => {
    const ds = await createDataSource({ type: PLUGIN_TYPE, url: AKVORADO_URL });

    const resp = await request.post('/api/ds/query', {
      data: {
        from: 'now-1h',
        to: 'now',
        queries: [
          {
            refId: 'A',
            datasource: { type: PLUGIN_TYPE, uid: ds.uid },
            type: 'timeseries',
            expression: 'InIfBoundary = external',
            dimensions: ['SrcAS'],
            limit: '5',
            truncatev4: '32',
            truncatev6: '128',
            topType: 'avg',
            unit: 'l3bps',
          },
        ],
      },
    });
    await expect(resp).toBeOK();
    const body = await resp.json();
    expect(body.results.A.status).toBe(200);
    expect(body.results.A.frames.length).toBeGreaterThan(0);

    const fields = body.results.A.frames[0].schema.fields;
    expect(fields[0].name).toBe('Time');
    expect(fields[0].type).toBe('time');
    expect(fields.length).toBeGreaterThan(1);
  });

  /*
  A dashboard saved with a numeric limit (what provisioning/dashboards/example.json
  holds) must query just like one saved with a string.
  */
  test('QueryData accepts a numeric limit and numeric truncate values', async ({ createDataSource, request }) => {
    const ds = await createDataSource({ type: PLUGIN_TYPE, url: AKVORADO_URL });

    const resp = await request.post('/api/ds/query', {
      data: {
        from: 'now-1h',
        to: 'now',
        queries: [
          {
            refId: 'A',
            datasource: { type: PLUGIN_TYPE, uid: ds.uid },
            type: 'timeseries',
            expression: 'InIfBoundary = external',
            dimensions: ['SrcAS'],
            limit: 5,
            truncatev4: 32,
            truncatev6: 128,
            topType: 'avg',
            unit: 'l3bps',
          },
        ],
      },
    });
    await expect(resp).toBeOK();
    const body = await resp.json();
    expect(body.results.A.error).toBeUndefined();
    expect(body.results.A.status).toBe(200);
    expect(body.results.A.frames.length).toBeGreaterThan(0);
  });
});
