package cmd

import (
	"io"
	"os"

	"github.com/codex-token-leaderboard/collector/internal/config"
	"github.com/spf13/cobra"
)

type commandOptions struct {
	configPath string
}

func NewRootCommand(stdout, stderr io.Writer) *cobra.Command {
	if stdout == nil {
		stdout = io.Discard
	}
	if stderr == nil {
		stderr = io.Discard
	}

	defaultConfigPath, defaultConfigErr := config.DefaultPath()
	opts := &commandOptions{
		configPath: defaultConfigPath,
	}

	root := &cobra.Command{
		Use:           "codex-tokens",
		Short:         "Collect local Codex token usage",
		SilenceUsage:  true,
		SilenceErrors: true,
		PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
			if opts.configPath != "" {
				return nil
			}
			if defaultConfigErr != nil {
				return defaultConfigErr
			}
			return nil
		},
	}
	root.SetOut(stdout)
	root.SetErr(stderr)

	root.PersistentFlags().StringVar(&opts.configPath, "config", opts.configPath, "collector config file")
	_ = root.PersistentFlags().MarkHidden("config")

	root.AddCommand(newLoginCommand(opts))
	root.AddCommand(newPreviewCommand())
	root.AddCommand(newStatusCommand(opts))

	return root
}

func Execute() error {
	return NewRootCommand(os.Stdout, os.Stderr).Execute()
}
