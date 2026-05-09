package cmd

import (
	"fmt"

	"github.com/codex-token-leaderboard/collector/internal/config"
	"github.com/spf13/cobra"
)

func newLoginCommand(opts *commandOptions) *cobra.Command {
	var serverURL string
	var deviceToken string

	command := &cobra.Command{
		Use:   "login",
		Short: "Save collector login credentials",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg := config.Config{
				ServerURL:   serverURL,
				DeviceToken: deviceToken,
			}
			if err := config.Save(opts.configPath, cfg); err != nil {
				return err
			}
			_, err := fmt.Fprintln(cmd.OutOrStdout(), "Collector login saved")
			return err
		},
	}

	command.Flags().StringVar(&serverURL, "server", "", "leaderboard server URL")
	command.Flags().StringVar(&deviceToken, "token", "", "device token")

	return command
}
