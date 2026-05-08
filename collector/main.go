package main

import (
	"os"

	"github.com/codex-token-leaderboard/collector/internal/cmd"
)

func main() {
	if err := cmd.Execute(); err != nil {
		os.Exit(1)
	}
}
