package plugin

import (
	"context"
	"fmt"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/resource/httpadapter"
)

var (
	_ backend.QueryDataHandler      = (*Datasource)(nil)
	_ backend.CheckHealthHandler    = (*Datasource)(nil)
	_ backend.CallResourceHandler   = (*Datasource)(nil)
	_ instancemgmt.InstanceDisposer = (*Datasource)(nil)
)

type Datasource struct {
	client  *http.Client
	baseURL string
	backend.CallResourceHandler
}

func NewDatasource(ctx context.Context, settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
	opts, err := settings.HTTPClientOptions(ctx)
	if err != nil {
		return nil, fmt.Errorf("http client options: %w", err)
	}
	client, err := httpclient.New(opts)
	if err != nil {
		return nil, fmt.Errorf("http client: %w", err)
	}

	ds := &Datasource{
		client:  client,
		baseURL: settings.URL,
	}

	mux := http.NewServeMux()
	ds.registerResourceRoutes(mux)
	ds.CallResourceHandler = httpadapter.New(mux)

	return ds, nil
}

func (d *Datasource) Dispose() {}
