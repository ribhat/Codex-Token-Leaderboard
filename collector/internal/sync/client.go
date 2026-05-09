package sync

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/codex-token-leaderboard/collector/internal/aggregate"
)

type HTTPClient interface {
	Do(*http.Request) (*http.Response, error)
}

type Client struct {
	ServerURL   string
	DeviceToken string
	HTTPClient  HTTPClient
}

func (c *Client) Sync(ctx context.Context, rows []aggregate.DailyUsage) error {
	if ctx == nil {
		ctx = context.Background()
	}

	serverURL := strings.TrimRight(strings.TrimSpace(c.ServerURL), "/")
	deviceToken := strings.TrimSpace(c.DeviceToken)
	if serverURL == "" {
		return errors.New("server URL is required")
	}
	if deviceToken == "" {
		return errors.New("device token is required")
	}

	payload, err := json.Marshal(struct {
		Rows []aggregate.DailyUsage `json:"rows"`
	}{
		Rows: rows,
	})
	if err != nil {
		return fmt.Errorf("marshal collector sync payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, serverURL+"/api/collector/sync", bytes.NewReader(payload))
	if err != nil {
		return errors.New("build collector sync request")
	}
	req.Header.Set("Authorization", "Bearer "+deviceToken)
	req.Header.Set("Content-Type", "application/json")

	httpClient := c.HTTPClient
	if httpClient == nil {
		httpClient = http.DefaultClient
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		return errors.New("send collector sync request failed")
	}
	if resp.Body != nil {
		defer resp.Body.Close()
	}

	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		return fmt.Errorf("collector sync failed with status %d", resp.StatusCode)
	}

	return nil
}
