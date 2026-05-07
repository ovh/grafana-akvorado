package plugin

import (
	"bytes"
	"io"
	"net/http"
)

/*
Resource routes proxy frontend calls through the Grafana backend, so that
every Akvorado request goes through this plugin's backend — required for
shared (public) dashboards to work.
*/
func (d *Datasource) registerResourceRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/configuration", d.proxy(http.MethodGet, "/api/v0/console/configuration"))
	mux.HandleFunc("/filter/validate", d.proxy(http.MethodPost, "/api/v0/console/filter/validate"))
	mux.HandleFunc("/filter/complete", d.proxy(http.MethodPost, "/api/v0/console/filter/complete"))
}

func (d *Datasource) proxy(method, target string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != method {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var bodyReader io.Reader
		if r.Body != nil {
			b, err := io.ReadAll(r.Body)
			if err != nil {
				http.Error(w, "read body: "+err.Error(), http.StatusBadRequest)
				return
			}
			bodyReader = bytes.NewReader(b)
		}

		req, err := http.NewRequestWithContext(r.Context(), method, d.urlFor(target), bodyReader)
		if err != nil {
			http.Error(w, "build request: "+err.Error(), http.StatusInternalServerError)
			return
		}
		if ct := r.Header.Get("Content-Type"); ct != "" {
			req.Header.Set("Content-Type", ct)
		} else if method == http.MethodPost {
			req.Header.Set("Content-Type", "application/json")
		}

		resp, err := d.client.Do(req)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadGateway)
			return
		}
		defer resp.Body.Close()

		if ct := resp.Header.Get("Content-Type"); ct != "" {
			w.Header().Set("Content-Type", ct)
		}
		w.WriteHeader(resp.StatusCode)
		_, _ = io.Copy(w, resp.Body)
	}
}
