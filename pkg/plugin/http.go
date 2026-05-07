package plugin

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

func (d *Datasource) postJSON(ctx context.Context, path string, body any) ([]byte, int, error) {
	buf, err := json.Marshal(body)
	if err != nil {
		return nil, 0, fmt.Errorf("marshal body: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, d.urlFor(path), bytes.NewReader(buf))
	if err != nil {
		return nil, 0, fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	return d.do(req)
}

func (d *Datasource) get(ctx context.Context, path string) (int, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, d.urlFor(path), nil)
	if err != nil {
		return 0, fmt.Errorf("build request: %w", err)
	}
	resp, err := d.client.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, resp.Body)
	return resp.StatusCode, nil
}

func (d *Datasource) do(req *http.Request) ([]byte, int, error) {
	resp, err := d.client.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, resp.StatusCode, fmt.Errorf("read body: %w", err)
	}
	if resp.StatusCode >= 400 {
		return body, resp.StatusCode, fmt.Errorf("akvorado returned %d: %s", resp.StatusCode, truncate(body, 256))
	}
	return body, resp.StatusCode, nil
}

func (d *Datasource) urlFor(path string) string {
	base := strings.TrimRight(d.baseURL, "/")
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	return base + path
}

func truncate(b []byte, n int) string {
	if len(b) <= n {
		return string(b)
	}
	return string(b[:n]) + "…"
}
