package codex

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
)

var ErrSessionsRootMissing = errors.New("codex sessions root is missing")
var ErrNoSessionFiles = errors.New("no codex session jsonl files found")

func DiscoverSessionFiles(root string) ([]string, error) {
	info, err := os.Stat(root)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, fmt.Errorf("%w: %s", ErrSessionsRootMissing, root)
		}
		return nil, fmt.Errorf("inspect codex sessions root %s: %w", root, err)
	}
	if !info.IsDir() {
		return nil, fmt.Errorf("codex sessions root is not a directory: %s", root)
	}

	var files []string
	err = filepath.WalkDir(root, func(path string, d os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if d.IsDir() {
			return nil
		}
		if filepath.Ext(path) == ".jsonl" {
			files = append(files, path)
		}
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("discover codex session files under %s: %w", root, err)
	}
	sort.Strings(files)
	if len(files) == 0 {
		return nil, fmt.Errorf("%w under %s", ErrNoSessionFiles, root)
	}

	return files, nil
}
