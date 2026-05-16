package cmd

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/codex-token-leaderboard/collector/internal/aggregate"
	"github.com/codex-token-leaderboard/collector/internal/config"
)

func executeForTest(t *testing.T, args ...string) (string, string, error) {
	t.Helper()

	var stdout bytes.Buffer
	var stderr bytes.Buffer
	command := NewRootCommand(&stdout, &stderr)
	command.SetArgs(args)

	err := command.Execute()
	return stdout.String(), stderr.String(), err
}

func TestLoginSavesConfigAndPrintsConfirmation(t *testing.T) {
	configPath := filepath.Join(t.TempDir(), "config.json")

	stdout, stderr, err := executeForTest(
		t,
		"--config", configPath,
		"login",
		"--server", "https://tokens.example.test",
		"--token", "device-token-123",
	)
	if err != nil {
		t.Fatalf("login returned error: %v", err)
	}
	if stderr != "" {
		t.Fatalf("expected no stderr, got %q", stderr)
	}
	if !strings.Contains(stdout, "Collector login saved") {
		t.Fatalf("expected login confirmation, got %q", stdout)
	}

	got, err := config.Load(configPath)
	if err != nil {
		t.Fatalf("load saved config: %v", err)
	}
	if got.ServerURL != "https://tokens.example.test" {
		t.Fatalf("expected saved server URL, got %q", got.ServerURL)
	}
	if got.DeviceToken != "device-token-123" {
		t.Fatal("saved device token did not match input token")
	}
}

func TestStatusPrintsNotLoggedInForMissingConfig(t *testing.T) {
	configPath := filepath.Join(t.TempDir(), "missing.json")

	stdout, _, err := executeForTest(t, "--config", configPath, "status")
	if err != nil {
		t.Fatalf("status returned error: %v", err)
	}
	if !strings.Contains(stdout, "Collector is not logged in") {
		t.Fatalf("expected not logged in message, got %q", stdout)
	}
}

func TestStatusPrintsServerAndHidesToken(t *testing.T) {
	configPath := filepath.Join(t.TempDir(), "config.json")
	if err := config.Save(configPath, config.Config{
		ServerURL:   "https://tokens.example.test",
		DeviceToken: "secret-device-token",
	}); err != nil {
		t.Fatalf("save config: %v", err)
	}

	stdout, _, err := executeForTest(t, "--config", configPath, "status")
	if err != nil {
		t.Fatalf("status returned error: %v", err)
	}
	if !strings.Contains(stdout, "Server: https://tokens.example.test") {
		t.Fatal("expected server URL in status output")
	}
	if !strings.Contains(stdout, "Token: configured") {
		t.Fatal("expected configured token status")
	}
	if strings.Contains(stdout, "secret-device-token") {
		t.Fatal("status printed the raw device token")
	}
}

func TestPreviewReturnsSanitizedErrors(t *testing.T) {
	privateRoot := filepath.Join(t.TempDir(), "private", "sessions")

	_, _, err := executeForTest(t, "preview", "--sessions", privateRoot)
	if err == nil {
		t.Fatal("expected preview to fail for missing session directory")
	}
	if strings.Contains(err.Error(), privateRoot) {
		t.Fatal("preview error leaked sessions path")
	}

	sessionsPath := filepath.Join(t.TempDir(), "sessions")
	if err := os.MkdirAll(sessionsPath, 0o755); err != nil {
		t.Fatalf("create sessions path: %v", err)
	}
	privateFile := filepath.Join(sessionsPath, "private-session.jsonl")
	if err := os.WriteFile(privateFile, []byte("{not json}\n"), 0o644); err != nil {
		t.Fatalf("write malformed session file: %v", err)
	}

	_, _, err = executeForTest(t, "preview", "--sessions", sessionsPath)
	if err == nil {
		t.Fatal("expected preview to fail for malformed session file")
	}
	if strings.Contains(err.Error(), privateFile) || strings.Contains(err.Error(), sessionsPath) {
		t.Fatal("preview parse error leaked local path")
	}
}

func TestPreviewPrintsDailyAggregateRows(t *testing.T) {
	sessionsPath := filepath.Join(t.TempDir(), "sessions")
	if err := os.MkdirAll(filepath.Join(sessionsPath, "2026", "05"), 0o755); err != nil {
		t.Fatalf("create sessions path: %v", err)
	}
	sessionFile := filepath.Join(sessionsPath, "2026", "05", "session.jsonl")
	input := strings.Join([]string{
		`{"timestamp":"2026-05-09T06:30:00Z","payload":{"info":{"last_token_usage":{"total_tokens":100,"input_tokens":60,"cached_input_tokens":20,"output_tokens":40,"reasoning_output_tokens":7}}}}`,
		`{"timestamp":"2026-05-09T07:30:00Z","payload":{"info":{"last_token_usage":{"total_tokens":50,"input_tokens":30,"cached_input_tokens":10,"output_tokens":20,"reasoning_output_tokens":3}}}}`,
		"",
	}, "\n")
	if err := os.WriteFile(sessionFile, []byte(input), 0o644); err != nil {
		t.Fatalf("write session file: %v", err)
	}

	stdout, _, err := executeForTest(t, "preview", "--sessions", sessionsPath)
	if err != nil {
		t.Fatalf("preview returned error: %v", err)
	}

	var rows []aggregate.DailyUsage
	if err := json.Unmarshal([]byte(stdout), &rows); err != nil {
		t.Fatalf("preview did not print JSON rows: %v\n%s", err, stdout)
	}
	if len(rows) != 1 {
		t.Fatalf("expected one daily row, got %d", len(rows))
	}
	row := rows[0]
	if row.UsageDate != "2026-05-09" {
		t.Fatalf("expected usage date 2026-05-09, got %q", row.UsageDate)
	}
	if row.TotalTokens != 150 {
		t.Fatalf("expected total tokens 150, got %d", row.TotalTokens)
	}
	if row.ResponseCount != 2 {
		t.Fatalf("expected response count 2, got %d", row.ResponseCount)
	}
}

func TestSyncUploadsLocalAggregateAndPrintsRowCount(t *testing.T) {
	sessionsPath := filepath.Join(t.TempDir(), "sessions")
	if err := os.MkdirAll(filepath.Join(sessionsPath, "2026", "05"), 0o755); err != nil {
		t.Fatalf("create sessions path: %v", err)
	}
	sessionFile := filepath.Join(sessionsPath, "2026", "05", "session.jsonl")
	input := strings.Join([]string{
		`{"timestamp":"2026-05-09T06:30:00Z","payload":{"info":{"last_token_usage":{"total_tokens":100,"input_tokens":60,"cached_input_tokens":20,"output_tokens":40,"reasoning_output_tokens":7}}}}`,
		`{"timestamp":"2026-05-09T07:30:00Z","payload":{"info":{"last_token_usage":{"total_tokens":50,"input_tokens":30,"cached_input_tokens":10,"output_tokens":20,"reasoning_output_tokens":3}}}}`,
		"",
	}, "\n")
	if err := os.WriteFile(sessionFile, []byte(input), 0o644); err != nil {
		t.Fatalf("write session file: %v", err)
	}

	const token = "secret-device-token"
	var gotPath string
	var gotAuthorization string
	var gotContentType string
	var gotRows []aggregate.DailyUsage
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		gotAuthorization = r.Header.Get("Authorization")
		gotContentType = r.Header.Get("Content-Type")
		body, err := io.ReadAll(r.Body)
		if err != nil {
			t.Fatalf("read request body: %v", err)
		}
		var payload struct {
			Rows []aggregate.DailyUsage `json:"rows"`
		}
		if err := json.Unmarshal(body, &payload); err != nil {
			t.Fatalf("decode request body: %v", err)
		}
		gotRows = payload.Rows
		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()

	configPath := filepath.Join(t.TempDir(), "config.json")
	if err := config.Save(configPath, config.Config{
		ServerURL:   server.URL + "/",
		DeviceToken: token,
	}); err != nil {
		t.Fatalf("save config: %v", err)
	}

	stdout, stderr, err := executeForTest(t, "--config", configPath, "sync", "--sessions", sessionsPath)
	if err != nil {
		t.Fatalf("sync returned error: %v", err)
	}
	if stderr != "" {
		t.Fatalf("expected no stderr, got %q", stderr)
	}
	if !strings.Contains(stdout, "Synced 1 daily aggregate rows") {
		t.Fatalf("expected sync row count, got %q", stdout)
	}
	if strings.Contains(stdout, token) || strings.Contains(stdout, sessionFile) || strings.Contains(stdout, sessionsPath) {
		t.Fatal("sync output leaked sensitive data")
	}
	if gotPath != "/api/collector/sync" {
		t.Fatalf("expected sync path, got %s", gotPath)
	}
	if gotAuthorization != "Bearer "+token {
		t.Fatal("unexpected authorization header")
	}
	if gotContentType != "application/json" {
		t.Fatalf("unexpected content type: %q", gotContentType)
	}
	if len(gotRows) != 1 {
		t.Fatalf("expected one uploaded row, got %d", len(gotRows))
	}
	if gotRows[0].TotalTokens != 150 {
		t.Fatalf("expected total tokens 150, got %d", gotRows[0].TotalTokens)
	}
}

func TestSyncReportsNotLoggedInCleanlyWhenConfigMissing(t *testing.T) {
	configPath := filepath.Join(t.TempDir(), "missing.json")

	stdout, _, err := executeForTest(t, "--config", configPath, "sync", "--sessions", filepath.Join(t.TempDir(), "sessions"))
	if err == nil {
		t.Fatal("expected sync to fail without config")
	}
	message := err.Error()
	if !strings.Contains(message, "collector is not logged in") {
		t.Fatalf("expected not logged in error, got %q", message)
	}
	if strings.Contains(message, configPath) || strings.Contains(stdout, configPath) {
		t.Fatal("sync leaked config path in not logged in output")
	}
}
