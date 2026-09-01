package plugin

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

/*
A dashboard can hold limit, truncatev4 and truncatev6 either as a JSON number
or as a JSON string. The query editor writes strings, dashboards saved before
2.0.0 (and the example dashboard in provisioning/) hold numbers, and both must
decode into the same request.
*/
func TestQueryModelAcceptsNumbersAndStrings(t *testing.T) {
	cases := []struct {
		name       string
		raw        string
		limit      int
		truncateV4 int
		truncateV6 int
	}{
		{
			name:       "numbers",
			raw:        `{"type":"timeseries","limit":10,"truncatev4":24,"truncatev6":64}`,
			limit:      10,
			truncateV4: 24,
			truncateV6: 64,
		},
		{
			name:       "strings",
			raw:        `{"type":"timeseries","limit":"10","truncatev4":"24","truncatev6":"64"}`,
			limit:      10,
			truncateV4: 24,
			truncateV6: 64,
		},
		{
			name:       "absent fields fall back to the defaults",
			raw:        `{"type":"timeseries"}`,
			limit:      10,
			truncateV4: 32,
			truncateV6: 128,
		},
		{
			name:       "empty strings fall back to the defaults",
			raw:        `{"type":"timeseries","limit":"","truncatev4":"","truncatev6":""}`,
			limit:      10,
			truncateV4: 32,
			truncateV6: 128,
		},
		{
			name:       "null falls back to the defaults",
			raw:        `{"type":"timeseries","limit":null,"truncatev4":null,"truncatev6":null}`,
			limit:      10,
			truncateV4: 32,
			truncateV6: 128,
		},
		{
			name:       "an unresolved template variable falls back to the defaults",
			raw:        `{"type":"timeseries","limit":"$limit","truncatev4":"$v4","truncatev6":"$v6"}`,
			limit:      10,
			truncateV4: 32,
			truncateV6: 128,
		},
		{
			name:       "a whole float keeps its value",
			raw:        `{"type":"timeseries","limit":10.0,"truncatev4":24.0,"truncatev6":64.0}`,
			limit:      10,
			truncateV4: 24,
			truncateV6: 64,
		},
		{
			name:       "a value of the wrong kind falls back to the defaults",
			raw:        `{"type":"timeseries","limit":true,"truncatev4":{"a":1},"truncatev6":[64]}`,
			limit:      10,
			truncateV4: 32,
			truncateV6: 128,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var qm queryModel
			if err := json.Unmarshal([]byte(tc.raw), &qm); err != nil {
				t.Fatalf("unmarshal query: %v", err)
			}
			body := qm.toAkvoradoQuery(backend.TimeRange{From: time.Unix(0, 0), To: time.Unix(3600, 0)})
			if body.Limit != tc.limit {
				t.Errorf("limit = %d, want %d", body.Limit, tc.limit)
			}
			if body.TruncateV4 != tc.truncateV4 {
				t.Errorf("truncate-v4 = %d, want %d", body.TruncateV4, tc.truncateV4)
			}
			if body.TruncateV6 != tc.truncateV6 {
				t.Errorf("truncate-v6 = %d, want %d", body.TruncateV6, tc.truncateV6)
			}
		})
	}
}

func TestQueryModelKeepsTheOtherFields(t *testing.T) {
	raw := `{"type":"timeseries","expression":"InIfBoundary = external","dimensions":["SrcAS"],"topType":"max","unit":"pps"}`
	var qm queryModel
	if err := json.Unmarshal([]byte(raw), &qm); err != nil {
		t.Fatalf("unmarshal query: %v", err)
	}
	from := time.Date(2026, 9, 1, 10, 0, 0, 0, time.UTC)
	to := from.Add(time.Hour)
	body := qm.toAkvoradoQuery(backend.TimeRange{From: from, To: to})

	if body.Filter != "InIfBoundary = external" {
		t.Errorf("filter = %q", body.Filter)
	}
	if len(body.Dimensions) != 1 || body.Dimensions[0] != "SrcAS" {
		t.Errorf("dimensions = %v", body.Dimensions)
	}
	if body.LimitType != "max" {
		t.Errorf("limitType = %q", body.LimitType)
	}
	if body.Units != "pps" {
		t.Errorf("units = %q", body.Units)
	}
	if body.Start != from.Format(time.RFC3339Nano) || body.End != to.Format(time.RFC3339Nano) {
		t.Errorf("start/end = %q/%q", body.Start, body.End)
	}
	if body.Points != 200 {
		t.Errorf("points = %d, want 200", body.Points)
	}
}

/*
The panel of the example dashboard: limit stored as a number. Before the fix
the whole query failed to decode and the panel showed "No data".
*/
func TestHandleQuerySendsANumericLimit(t *testing.T) {
	var got akvoradoQuery
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := json.NewDecoder(r.Body).Decode(&got); err != nil {
			t.Errorf("decode request: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"t":["2026-09-01T10:00:00Z"],"rows":[["12345"]],"points":[[1.5]]}`))
	}))
	defer srv.Close()

	d := &Datasource{client: srv.Client(), baseURL: srv.URL}
	resp := d.handleQuery(context.Background(), backend.DataQuery{
		RefID:     "A",
		JSON:      []byte(`{"type":"timeseries","dimensions":["SrcAS"],"limit":10,"truncatev4":24,"truncatev6":64,"unit":"l3bps","topType":"avg"}`),
		TimeRange: backend.TimeRange{From: time.Unix(0, 0), To: time.Unix(3600, 0)},
	})

	if resp.Error != nil {
		t.Fatalf("query failed: %v", resp.Error)
	}
	if got.Limit != 10 {
		t.Errorf("limit sent to akvorado = %d, want 10", got.Limit)
	}
	if got.TruncateV4 != 24 || got.TruncateV6 != 64 {
		t.Errorf("truncate sent to akvorado = %d/%d, want 24/64", got.TruncateV4, got.TruncateV6)
	}
	if len(resp.Frames) != 1 || len(resp.Frames[0].Fields) != 2 {
		t.Fatalf("frames = %v", resp.Frames)
	}
}

/*
A value the query cannot read keeps the default, and the panel says so. A
silent substitution is what hides a broken dashboard.
*/
func TestAnUnreadableValueWarnsInThePanel(t *testing.T) {
	cases := []struct {
		name    string
		raw     string
		limit   int
		notices []string
	}{
		{
			name:    "text instead of a number",
			raw:     `{"type":"timeseries","limit":"abc"}`,
			limit:   10,
			notices: []string{`limit "abc" is not a number: the query used 10.`},
		},
		{
			name:    "an unresolved template variable",
			raw:     `{"type":"timeseries","limit":"$limit"}`,
			limit:   10,
			notices: []string{`limit "$limit" is not a number: the query used 10.`},
		},
		{
			name:  "every field readable",
			raw:   `{"type":"timeseries","limit":10,"truncatev4":"24","truncatev6":64}`,
			limit: 10,
		},
		{
			name:  "an empty field is not set, not broken",
			raw:   `{"type":"timeseries","limit":"","truncatev4":null}`,
			limit: 10,
		},
		{
			name:  "an absent field is not set either",
			raw:   `{"type":"timeseries"}`,
			limit: 10,
		},
		{
			name:  "one notice per broken field",
			raw:   `{"type":"timeseries","limit":"abc","truncatev4":"x","truncatev6":"y"}`,
			limit: 10,
			notices: []string{
				`limit "abc" is not a number: the query used 10.`,
				`truncatev4 "x" is not a number: the query used 32.`,
				`truncatev6 "y" is not a number: the query used 128.`,
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var qm queryModel
			if err := json.Unmarshal([]byte(tc.raw), &qm); err != nil {
				t.Fatalf("unmarshal query: %v", err)
			}
			if got := qm.toAkvoradoQuery(backend.TimeRange{}).Limit; got != tc.limit {
				t.Errorf("limit = %d, want %d", got, tc.limit)
			}
			got := qm.warnings()
			if len(got) != len(tc.notices) {
				t.Fatalf("warnings = %q, want %q", got, tc.notices)
			}
			for i, want := range tc.notices {
				if got[i] != want {
					t.Errorf("warning %d = %q, want %q", i, got[i], want)
				}
			}
		})
	}
}

func TestFramesCarryTheWarnings(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.Copy(io.Discard, r.Body)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"t":["2026-09-01T10:00:00Z"],"rows":[["12345"]],"points":[[1.5]]}`))
	}))
	defer srv.Close()

	d := &Datasource{client: srv.Client(), baseURL: srv.URL}
	resp := d.handleQuery(context.Background(), backend.DataQuery{
		RefID:     "A",
		JSON:      []byte(`{"type":"timeseries","dimensions":["SrcAS"],"limit":"abc"}`),
		TimeRange: backend.TimeRange{From: time.Unix(0, 0), To: time.Unix(3600, 0)},
	})

	if resp.Error != nil {
		t.Fatalf("query failed: %v", resp.Error)
	}
	if len(resp.Frames) != 1 || resp.Frames[0].Meta == nil {
		t.Fatalf("frames = %v", resp.Frames)
	}
	notices := resp.Frames[0].Meta.Notices
	if len(notices) != 1 {
		t.Fatalf("notices = %v", notices)
	}
	if notices[0].Severity != data.NoticeSeverityWarning {
		t.Errorf("severity = %v, want warning", notices[0].Severity)
	}
	if notices[0].Text != `limit "abc" is not a number: the query used 10.` {
		t.Errorf("text = %q", notices[0].Text)
	}
}

func TestParseIntDefault(t *testing.T) {
	cases := []struct {
		in   string
		def  int
		want int
	}{
		{in: "5", def: 10, want: 5},
		{in: "", def: 10, want: 10},
		{in: "  7  ", def: 10, want: 7},
		{in: "0", def: 10, want: 0},
		{in: "-1", def: 10, want: -1},
		{in: "5.0", def: 10, want: 5},
		{in: "5.5", def: 10, want: 10},
		{in: "abc", def: 10, want: 10},
		{in: "$limit", def: 10, want: 10},
		{in: "NaN", def: 10, want: 10},
		{in: "Inf", def: 10, want: 10},
		{in: "1e400", def: 10, want: 10},
	}
	for _, tc := range cases {
		if got := parseIntDefault(tc.in, tc.def); got != tc.want {
			t.Errorf("parseIntDefault(%q, %d) = %d, want %d", tc.in, tc.def, got, tc.want)
		}
	}
}
