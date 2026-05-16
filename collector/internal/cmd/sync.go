package cmd

import (
	"errors"
	"fmt"

	"github.com/codex-token-leaderboard/collector/internal/config"
	collectorsync "github.com/codex-token-leaderboard/collector/internal/sync"
	"github.com/spf13/cobra"
)

func newSyncCommand(opts *commandOptions) *cobra.Command {
	sessionsPath := defaultSessionsPath()

	command := &cobra.Command{
		Use:   "sync",
		Short: "Upload local Codex token aggregates",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, err := config.Load(opts.configPath)
			if err != nil {
				if errors.Is(err, config.ErrNotLoggedIn) {
					return config.ErrNotLoggedIn
				}
				return errors.New("could not load collector config")
			}

			rows, err := loadLocalAggregates(sessionsPath)
			if err != nil {
				return err
			}

			client := collectorsync.Client{
				ServerURL:   cfg.ServerURL,
				DeviceToken: cfg.DeviceToken,
			}
			if err := client.Sync(cmd.Context(), rows); err != nil {
				return err
			}

			_, err = fmt.Fprintf(cmd.OutOrStdout(), "Synced %d daily aggregate rows\n", len(rows))
			return err
		},
	}

	command.Flags().StringVar(&sessionsPath, "sessions", sessionsPath, "Codex sessions directory")

	return command
}
