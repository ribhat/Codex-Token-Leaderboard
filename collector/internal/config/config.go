package config

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

var ErrNotLoggedIn = errors.New("collector is not logged in")

type Config struct {
	ServerURL   string `json:"server_url"`
	DeviceToken string `json:"device_token"`
}

func DefaultPath() (string, error) {
	userConfigDir, err := os.UserConfigDir()
	if err != nil {
		return "", fmt.Errorf("locate user config dir: %w", err)
	}

	return filepath.Join(userConfigDir, "codex-token-leaderboard", "config.json"), nil
}

func Save(path string, cfg Config) error {
	cfg.ServerURL = strings.TrimSpace(cfg.ServerURL)
	cfg.DeviceToken = strings.TrimSpace(cfg.DeviceToken)

	if cfg.ServerURL == "" {
		return errors.New("server URL is required")
	}
	if cfg.DeviceToken == "" {
		return errors.New("device token is required")
	}
	if strings.TrimSpace(path) == "" {
		return errors.New("config path is required")
	}

	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return fmt.Errorf("create collector config dir: %w", err)
	}

	payload, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal collector config: %w", err)
	}
	payload = append(payload, '\n')

	if err := os.WriteFile(path, payload, 0o600); err != nil {
		return fmt.Errorf("write collector config: %w", err)
	}

	return nil
}

func Load(path string) (Config, error) {
	if strings.TrimSpace(path) == "" {
		return Config{}, errors.New("config path is required")
	}

	payload, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return Config{}, fmt.Errorf("%w: run codex-tokens login", ErrNotLoggedIn)
		}
		return Config{}, fmt.Errorf("read collector config: %w", err)
	}

	var cfg Config
	if err := json.Unmarshal(payload, &cfg); err != nil {
		return Config{}, fmt.Errorf("%w: invalid collector config", ErrNotLoggedIn)
	}

	cfg.ServerURL = strings.TrimSpace(cfg.ServerURL)
	cfg.DeviceToken = strings.TrimSpace(cfg.DeviceToken)
	if strings.TrimSpace(cfg.ServerURL) == "" || strings.TrimSpace(cfg.DeviceToken) == "" {
		return Config{}, fmt.Errorf("%w: missing server_url or device_token", ErrNotLoggedIn)
	}

	return cfg, nil
}
