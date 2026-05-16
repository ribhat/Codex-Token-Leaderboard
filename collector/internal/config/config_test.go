package config

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func TestDefaultPathUsesUserConfigDir(t *testing.T) {
	userConfigDir, err := os.UserConfigDir()
	if err != nil {
		t.Fatalf("os.UserConfigDir returned error: %v", err)
	}

	got, err := DefaultPath()
	if err != nil {
		t.Fatalf("DefaultPath returned error: %v", err)
	}

	want := filepath.Join(userConfigDir, "codex-token-leaderboard", "config.json")
	if got != want {
		t.Fatalf("expected default path %q, got %q", want, got)
	}
}

func TestSaveAndLoadConfig(t *testing.T) {
	path := filepath.Join(t.TempDir(), "nested", "config.json")
	want := Config{
		ServerURL:   "https://tokens.example.test",
		DeviceToken: "device-token-123",
	}

	if err := Save(path, want); err != nil {
		t.Fatalf("Save returned error: %v", err)
	}

	if runtime.GOOS != "windows" {
		dirInfo, err := os.Stat(filepath.Dir(path))
		if err != nil {
			t.Fatalf("stat config dir: %v", err)
		}
		if got := dirInfo.Mode().Perm(); got != 0o700 {
			t.Fatalf("expected config dir mode 0700, got %o", got)
		}

		fileInfo, err := os.Stat(path)
		if err != nil {
			t.Fatalf("stat config file: %v", err)
		}
		if got := fileInfo.Mode().Perm(); got != 0o600 {
			t.Fatalf("expected config file mode 0600, got %o", got)
		}
	}

	got, err := Load(path)
	if err != nil {
		t.Fatalf("Load returned error: %v", err)
	}
	if got.ServerURL != want.ServerURL || got.DeviceToken != want.DeviceToken {
		t.Fatal("loaded config did not match saved config")
	}

	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read config file: %v", err)
	}
	var fields map[string]string
	if err := json.Unmarshal(raw, &fields); err != nil {
		t.Fatalf("config is not JSON: %v", err)
	}
	if fields["server_url"] != want.ServerURL {
		t.Fatalf("expected server_url JSON field, got %q", fields["server_url"])
	}
	if fields["device_token"] != want.DeviceToken {
		t.Fatal("expected device_token JSON field to match saved token")
	}
}

func TestSaveRejectsMissingRequiredValues(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.json")

	err := Save(path, Config{ServerURL: "https://tokens.example.test"})
	if err == nil {
		t.Fatal("expected Save to reject missing device token")
	}
	if !strings.Contains(err.Error(), "device token") {
		t.Fatalf("expected device token validation error, got %v", err)
	}

	err = Save(path, Config{DeviceToken: "device-token-123"})
	if err == nil {
		t.Fatal("expected Save to reject missing server URL")
	}
	if !strings.Contains(err.Error(), "server URL") {
		t.Fatalf("expected server URL validation error, got %v", err)
	}
}

func TestLoadReportsNotLoggedInWhenMissingOrIncomplete(t *testing.T) {
	missingPath := filepath.Join(t.TempDir(), "missing.json")
	_, err := Load(missingPath)
	if err == nil {
		t.Fatal("expected missing config to be not logged in")
	}
	if !errors.Is(err, ErrNotLoggedIn) {
		t.Fatalf("expected ErrNotLoggedIn for missing config, got %v", err)
	}
	if !strings.Contains(err.Error(), "collector is not logged in") {
		t.Fatalf("expected clear login error, got %v", err)
	}

	incompletePath := filepath.Join(t.TempDir(), "config.json")
	if err := os.WriteFile(incompletePath, []byte(`{"server_url":"https://tokens.example.test"}`), 0o600); err != nil {
		t.Fatalf("write incomplete config: %v", err)
	}
	_, err = Load(incompletePath)
	if err == nil {
		t.Fatal("expected incomplete config to be not logged in")
	}
	if !errors.Is(err, ErrNotLoggedIn) {
		t.Fatalf("expected ErrNotLoggedIn for incomplete config, got %v", err)
	}

	malformedPath := filepath.Join(t.TempDir(), "malformed.json")
	if err := os.WriteFile(malformedPath, []byte(`{not json}`), 0o600); err != nil {
		t.Fatalf("write malformed config: %v", err)
	}
	_, err = Load(malformedPath)
	if err == nil {
		t.Fatal("expected malformed config to be not logged in")
	}
	if !errors.Is(err, ErrNotLoggedIn) {
		t.Fatalf("expected ErrNotLoggedIn for malformed config, got %v", err)
	}
}
