package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/codex-token-leaderboard/collector/internal/aggregate"
	"github.com/codex-token-leaderboard/collector/internal/codex"
	"github.com/spf13/cobra"
)

func newPreviewCommand() *cobra.Command {
	sessionsPath := defaultSessionsPath()

	command := &cobra.Command{
		Use:   "preview",
		Short: "Preview local Codex token aggregates",
		RunE: func(cmd *cobra.Command, args []string) error {
			files, err := codex.DiscoverSessionFiles(sessionsPath)
			if err != nil {
				return err
			}

			var events []codex.UsageEvent
			for _, path := range files {
				fileEvents, err := parseSessionFile(path)
				if err != nil {
					return err
				}
				events = append(events, fileEvents...)
			}

			rows := aggregate.Daily(events)
			payload, err := json.MarshalIndent(rows, "", "  ")
			if err != nil {
				return fmt.Errorf("marshal preview rows: %w", err)
			}
			_, err = fmt.Fprintln(cmd.OutOrStdout(), string(payload))
			return err
		},
	}

	command.Flags().StringVar(&sessionsPath, "sessions", sessionsPath, "Codex sessions directory")

	return command
}

func defaultSessionsPath() string {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return filepath.Join(".codex", "sessions")
	}
	return filepath.Join(homeDir, ".codex", "sessions")
}

func parseSessionFile(path string) ([]codex.UsageEvent, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("open codex session file %s: %w", path, err)
	}
	defer f.Close()

	events, err := codex.ParseUsageEvents(f)
	if err != nil {
		return nil, fmt.Errorf("parse codex session file %s: %w", path, err)
	}

	return events, nil
}
