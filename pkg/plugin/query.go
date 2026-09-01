package plugin

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

const (
	queryTypeTimeseries = "timeseries"
	queryTypeSankey     = "sankey"
)

var queryEndpoints = map[string]string{
	queryTypeTimeseries: "/api/v0/console/graph/line",
	queryTypeSankey:     "/api/v0/console/graph/sankey",
}

type queryModel struct {
	Expression string         `json:"expression"`
	Dimensions []string       `json:"dimensions"`
	Type       string         `json:"type"`
	Limit      numberOrString `json:"limit"`
	TruncateV4 numberOrString `json:"truncatev4"`
	TruncateV6 numberOrString `json:"truncatev6"`
	TopType    string         `json:"topType"`
	Unit       string         `json:"unit"`
	Error      string         `json:"error,omitempty"`
}

/*
numberOrString holds a value a dashboard can store either way. The query editor
writes strings, but dashboards saved with earlier versions of the plugin (and
the example dashboard in provisioning/) hold plain JSON numbers. Both decode
into the raw text, and parseIntDefault turns it into a number.
*/
type numberOrString string

func (n *numberOrString) UnmarshalJSON(b []byte) error {
	b = bytes.TrimSpace(b)
	switch {
	case len(b) == 0, string(b) == "null":
		*n = ""
	case b[0] == '"':
		var s string
		if err := json.Unmarshal(b, &s); err != nil {
			return err
		}
		*n = numberOrString(s)
	default:
		/* A number, or a value of a kind we do not expect: parseIntDefault
		   holds the fallback for anything that is not a number. */
		*n = numberOrString(b)
	}
	return nil
}

type akvoradoQuery struct {
	Bidirectional  bool     `json:"bidirectional"`
	Dimensions     []string `json:"dimensions"`
	End            string   `json:"end"`
	Filter         string   `json:"filter"`
	Limit          int      `json:"limit"`
	Points         int      `json:"points"`
	PreviousPeriod bool     `json:"previous-period"`
	Start          string   `json:"start"`
	TruncateV4     int      `json:"truncate-v4"`
	TruncateV6     int      `json:"truncate-v6"`
	LimitType      string   `json:"limitType"`
	Units          string   `json:"units"`
}

type timeseriesResponse struct {
	Points [][]float64 `json:"points"`
	Rows   [][]string  `json:"rows"`
	T      []string    `json:"t"`
}

type sankeyResponse struct {
	Rows [][]string `json:"rows"`
	XPS  []float64  `json:"xps"`
}

func (d *Datasource) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	resp := backend.NewQueryDataResponse()
	for _, q := range req.Queries {
		resp.Responses[q.RefID] = d.handleQuery(ctx, q)
	}
	return resp, nil
}

func (d *Datasource) handleQuery(ctx context.Context, q backend.DataQuery) backend.DataResponse {
	var qm queryModel
	if err := json.Unmarshal(q.JSON, &qm); err != nil {
		return backend.ErrDataResponse(backend.StatusBadRequest, fmt.Sprintf("invalid query json: %v", err))
	}
	if qm.Error != "" {
		return backend.DataResponse{Frames: data.Frames{}}
	}

	endpoint, ok := queryEndpoints[qm.Type]
	if !ok {
		return backend.ErrDataResponse(backend.StatusBadRequest, fmt.Sprintf("unsupported query type: %q", qm.Type))
	}

	raw, status, err := d.postJSON(ctx, endpoint, qm.toAkvoradoQuery(q.TimeRange))
	if err != nil {
		return backend.ErrDataResponse(toStatus(status), err.Error())
	}

	switch qm.Type {
	case queryTypeTimeseries:
		return buildTimeseriesFrames(qm, raw)
	case queryTypeSankey:
		return buildSankeyFrames(qm, raw)
	}
	return backend.DataResponse{}
}

func (qm queryModel) toAkvoradoQuery(tr backend.TimeRange) akvoradoQuery {
	return akvoradoQuery{
		Bidirectional:  false,
		Dimensions:     qm.Dimensions,
		End:            tr.To.UTC().Format(time.RFC3339Nano),
		Filter:         qm.Expression,
		Limit:          parseIntDefault(string(qm.Limit), 10),
		Points:         200,
		PreviousPeriod: false,
		Start:          tr.From.UTC().Format(time.RFC3339Nano),
		TruncateV4:     parseIntDefault(string(qm.TruncateV4), 32),
		TruncateV6:     parseIntDefault(string(qm.TruncateV6), 128),
		LimitType:      qm.TopType,
		Units:          qm.Unit,
	}
}

/*
warnings names every field the query could not read. The query still runs with
the default, but the panel says which value it ignored: a silent substitution
is what hides a broken dashboard.
*/
func (qm queryModel) warnings() []string {
	fields := []struct {
		name  string
		value numberOrString
		def   int
	}{
		{"limit", qm.Limit, 10},
		{"truncatev4", qm.TruncateV4, 32},
		{"truncatev6", qm.TruncateV6, 128},
	}

	var warnings []string
	for _, f := range fields {
		text := strings.TrimSpace(string(f.value))
		if text == "" {
			/* Absent, null or empty: the value is not set, not broken. */
			continue
		}
		if _, ok := parseInt(text); !ok {
			warnings = append(warnings, fmt.Sprintf("%s %q is not a number: the query used %d.", f.name, text, f.def))
		}
	}
	return warnings
}

func addNotices(frame *data.Frame, warnings []string) *data.Frame {
	if len(warnings) == 0 {
		return frame
	}
	if frame.Meta == nil {
		frame.Meta = &data.FrameMeta{}
	}
	for _, w := range warnings {
		frame.Meta.Notices = append(frame.Meta.Notices, data.Notice{
			Severity: data.NoticeSeverityWarning,
			Text:     w,
		})
	}
	return frame
}

func buildTimeseriesFrames(qm queryModel, raw []byte) backend.DataResponse {
	var resp timeseriesResponse
	if err := json.Unmarshal(raw, &resp); err != nil {
		return backend.ErrDataResponse(backend.StatusInternal, fmt.Sprintf("decode timeseries: %v", err))
	}

	times := make([]time.Time, 0, len(resp.T))
	for _, ts := range resp.T {
		t, err := time.Parse(time.RFC3339Nano, ts)
		if err != nil {
			t, err = time.Parse(time.RFC3339, ts)
			if err != nil {
				t = time.Time{}
			}
		}
		times = append(times, t)
	}

	frame := data.NewFrame("response")
	frame.Fields = append(frame.Fields, data.NewField("Time", nil, times))

	for i, row := range resp.Rows {
		var values []float64
		if i < len(resp.Points) {
			values = resp.Points[i]
		}
		labels := buildLabels(qm.Dimensions, row)
		name := qm.Unit
		if len(row) > 0 {
			name = strings.Join(row, " - ")
		}
		frame.Fields = append(frame.Fields, data.NewField(name, labels, values))
	}

	return backend.DataResponse{Frames: data.Frames{addNotices(frame, qm.warnings())}}
}

func buildSankeyFrames(qm queryModel, raw []byte) backend.DataResponse {
	var resp sankeyResponse
	if err := json.Unmarshal(raw, &resp); err != nil {
		return backend.ErrDataResponse(backend.StatusInternal, fmt.Sprintf("decode sankey: %v", err))
	}

	frame := data.NewFrame("sankey")

	dimCols := make([][]string, len(qm.Dimensions))
	for i := range dimCols {
		dimCols[i] = make([]string, 0, len(resp.Rows))
	}
	values := make([]float64, 0, len(resp.Rows))

	for i, row := range resp.Rows {
		for j := range qm.Dimensions {
			if j < len(row) {
				dimCols[j] = append(dimCols[j], row[j])
			} else {
				dimCols[j] = append(dimCols[j], "")
			}
		}
		if i < len(resp.XPS) {
			values = append(values, resp.XPS[i])
		} else {
			values = append(values, 0)
		}
	}

	for i, dim := range qm.Dimensions {
		frame.Fields = append(frame.Fields, data.NewField(dim, nil, dimCols[i]))
	}
	frame.Fields = append(frame.Fields, data.NewField("value", nil, values))

	return backend.DataResponse{Frames: data.Frames{addNotices(frame, qm.warnings())}}
}

func buildLabels(dimensions []string, row []string) data.Labels {
	if len(dimensions) == 0 || len(dimensions) != len(row) {
		return nil
	}
	labels := data.Labels{}
	for i, d := range dimensions {
		labels[d] = row[i]
	}
	return labels
}

func parseIntDefault(s string, def int) int {
	if n, ok := parseInt(strings.TrimSpace(s)); ok {
		return n
	}
	return def
}

/*
parseInt reads a whole number, written as an integer or as a whole float such
as 10.0. Anything else, an unresolved template variable included, cannot be
read.
*/
func parseInt(s string) (int, bool) {
	if s == "" {
		return 0, false
	}
	if n, err := strconv.Atoi(s); err == nil {
		return n, true
	}
	if f, err := strconv.ParseFloat(s, 64); err == nil && f == math.Trunc(f) && math.Abs(f) <= math.MaxInt32 {
		return int(f), true
	}
	return 0, false
}

func toStatus(httpStatus int) backend.Status {
	switch {
	case httpStatus >= 500:
		return backend.StatusInternal
	case httpStatus == 0:
		return backend.StatusInternal
	case httpStatus >= 400:
		return backend.StatusBadRequest
	default:
		return backend.StatusOK
	}
}
