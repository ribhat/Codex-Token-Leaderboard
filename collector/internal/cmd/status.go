package cmd

import (
	"errors"
	"fmt"

	"github.com/codex-token-leaderboard/collector/internal/config"
	"github.com/spf13/cobra"
)

func newStatusCommand(opts *commandOptions) *cobra.Command {
	return &cobra.Command{
		Use:   "status",
		Short: "Show collector login status",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, err := config.Load(opts.configPath)
			if err != nil {
				if errors.Is(err, config.ErrNotLoggedIn) {
					_, printErr := fmt.Fprintln(cmd.OutOrStdout(), "Collector is not logged in")
					return printErr
				}
				return err
			}

			if _, err := fmt.Fprintf(cmd.OutOrStdout(), "Server: %s\n", cfg.ServerURL); err != nil {
				return err
			}
			_, err = fmt.Fprintln(cmd.OutOrStdout(), "Token: configured")
			return err
		},
	}
}
