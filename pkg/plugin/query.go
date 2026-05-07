package plugin

import (
	"context"
	"encoding/json"
	"fmt"
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
	Expression string   `json:"expression"`
	Dimensions []string `json:"dimensions"`
	Type       string   `json:"type"`
	Limit      string   `json:"limit"`
	TruncateV4 string   `json:"truncatev4"`
	TruncateV6 string   `json:"truncatev6"`
	TopType    string   `json:"topType"`
	Unit       string   `json:"unit"`
	Error      string   `json:"error,omitempty"`
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

	body := akvoradoQuery{
		Bidirectional:  false,
		Dimensions:     qm.Dimensions,
		End:            q.TimeRange.To.UTC().Format(time.RFC3339Nano),
		Filter:         qm.Expression,
		Limit:          parseIntDefault(qm.Limit, 10),
		Points:         200,
		PreviousPeriod: false,
		Start:          q.TimeRange.From.UTC().Format(time.RFC3339Nano),
		TruncateV4:     parseIntDefault(qm.TruncateV4, 32),
		TruncateV6:     parseIntDefault(qm.TruncateV6, 128),
		LimitType:      qm.TopType,
		Units:          qm.Unit,
	}

	raw, status, err := d.postJSON(ctx, endpoint, body)
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

	return backend.DataResponse{Frames: data.Frames{frame}}
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

	return backend.DataResponse{Frames: data.Frames{frame}}
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
	if s == "" {
		return def
	}
	n, err := strconv.Atoi(s)
	if err != nil {
		return def
	}
	return n
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
