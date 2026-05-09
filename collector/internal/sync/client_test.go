package sync

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/codex-token-leaderboard/collector/internal/aggregate"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func TestClientPostsRowsWithBearerTokenAndExpectedBody(t *testing.T) {
	rows := []aggregate.DailyUsage{{
		UsageDate:     "2026-05-09",
		Source:        aggregate.SourceCodexJSONL,
		TotalTokens:   123,
		InputTokens:   80,
		OutputTokens:  43,
		ResponseCount: 2,
	}}

	var gotMethod string
	var gotURL string
	var gotAuthorization string
	var gotContentType string
	var gotBody []byte
	client := &Client{
		ServerURL:   "https://tokens.example.test",
		DeviceToken: "secret-device-token",
		HTTPClient: &http.Client{Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			gotMethod = req.Method
			gotURL = req.URL.String()
			gotAuthorization = req.Header.Get("Authorization")
			gotContentType = req.Header.Get("Content-Type")
			var err error
			gotBody, err = io.ReadAll(req.Body)
			if err != nil {
				t.Fatalf("read request body: %v", err)
			}
			return &http.Response{
				StatusCode: http.StatusCreated,
				Body:       io.NopCloser(strings.NewReader("ok")),
				Header:     make(http.Header),
			}, nil
		})},
	}

	if err := client.Sync(context.Background(), rows); err != nil {
		t.Fatalf("sync returned error: %v", err)
	}

	if gotMethod != http.MethodPost {
		t.Fatalf("expected POST, got %s", gotMethod)
	}
	if gotURL != "https://tokens.example.test/api/collector/sync" {
		t.Fatalf("unexpected sync URL: %s", gotURL)
	}
	if gotAuthorization != "Bearer secret-device-token" {
		t.Fatalf("unexpected authorization header: %q", gotAuthorization)
	}
	if gotContentType != "application/json" {
		t.Fatalf("unexpected content type: %q", gotContentType)
	}

	var got struct {
		Rows []aggregate.DailyUsage `json:"rows"`
	}
	if err := json.Unmarshal(gotBody, &got); err != nil {
		t.Fatalf("request body was not expected JSON: %v\n%s", err, gotBody)
	}
	if len(got.Rows) != 1 {
		t.Fatalf("expected one row in request body, got %d", len(got.Rows))
	}
	if got.Rows[0].TotalTokens != 123 {
		t.Fatalf("expected row total tokens 123, got %d", got.Rows[0].TotalTokens)
	}
}

func TestClientTrimsTrailingServerSlash(t *testing.T) {
	var gotURL string
	client := &Client{
		ServerURL:   "https://tokens.example.test/",
		DeviceToken: "secret-device-token",
		HTTPClient: &http.Client{Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			gotURL = req.URL.String()
			return &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(bytes.NewReader(nil)),
				Header:     make(http.Header),
			}, nil
		})},
	}

	if err := client.Sync(context.Background(), nil); err != nil {
		t.Fatalf("sync returned error: %v", err)
	}
	if gotURL != "https://tokens.example.test/api/collector/sync" {
		t.Fatalf("expected trimmed sync URL, got %s", gotURL)
	}
}

func TestClientReturnsSanitizedNon2xxError(t *testing.T) {
	const token = "secret-device-token"
	const bodyValue = "2026-05-09"
	client := &Client{
		ServerURL:   "https://tokens.example.test",
		DeviceToken: token,
		HTTPClient: &http.Client{Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			return &http.Response{
				StatusCode: http.StatusUnauthorized,
				Status:     "401 Unauthorized",
				Body:       io.NopCloser(strings.NewReader(`{"error":"bad token"}`)),
				Header:     make(http.Header),
			}, nil
		})},
	}

	err := client.Sync(context.Background(), []aggregate.DailyUsage{{UsageDate: bodyValue}})
	if err == nil {
		t.Fatal("expected sync to fail")
	}

	message := err.Error()
	if !strings.Contains(message, "collector sync failed") || !strings.Contains(message, "401") {
		t.Fatalf("expected useful status error, got %q", message)
	}
	if strings.Contains(message, token) {
		t.Fatalf("sync error leaked token: %q", message)
	}
	if strings.Contains(message, bodyValue) || strings.Contains(message, "bad token") {
		t.Fatalf("sync error leaked request or response body: %q", message)
	}
}

func TestClientValidatesRequiredFieldsBeforeRequest(t *testing.T) {
	called := false
	client := &Client{
		ServerURL: "https://tokens.example.test",
		HTTPClient: &http.Client{Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			called = true
			return nil, nil
		})},
	}

	err := client.Sync(context.Background(), nil)
	if err == nil {
		t.Fatal("expected missing token error")
	}
	if called {
		t.Fatal("client made a request before validating required fields")
	}
	if strings.Contains(err.Error(), "https://tokens.example.test") {
		t.Fatalf("validation error leaked server URL: %v", err)
	}
}
