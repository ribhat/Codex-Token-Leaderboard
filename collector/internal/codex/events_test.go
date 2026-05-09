package codex

import (
	"bytes"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"
	"time"
)

func TestParseEventsReadsUsageAndSkipsIncompleteLines(t *testing.T) {
	f, err := os.Open(filepath.Join("testdata", "session.jsonl"))
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()

	events, err := ParseEvents(f)
	if err != nil {
		t.Fatalf("ParseEvents returned error: %v", err)
	}

	if len(events) != 2 {
		t.Fatalf("expected 2 usage events, got %d", len(events))
	}

	wantTime := time.Date(2026, 5, 9, 6, 30, 0, 0, time.UTC)
	if !events[0].Timestamp.Equal(wantTime) {
		t.Fatalf("expected first timestamp %s, got %s", wantTime, events[0].Timestamp)
	}

	if events[0].Usage.TotalTokens != 100 {
		t.Fatalf("expected total tokens 100, got %d", events[0].Usage.TotalTokens)
	}
	if events[0].Usage.InputTokens != 60 {
		t.Fatalf("expected input tokens 60, got %d", events[0].Usage.InputTokens)
	}
	if events[0].Usage.CachedInputTokens != 20 {
		t.Fatalf("expected cached input tokens 20, got %d", events[0].Usage.CachedInputTokens)
	}
	if events[0].Usage.OutputTokens != 40 {
		t.Fatalf("expected output tokens 40, got %d", events[0].Usage.OutputTokens)
	}
	if events[0].Usage.ReasoningOutputTokens != 7 {
		t.Fatalf("expected reasoning output tokens 7, got %d", events[0].Usage.ReasoningOutputTokens)
	}
}

func TestParseEventsDoesNotRetainPrivateFields(t *testing.T) {
	f, err := os.Open(filepath.Join("testdata", "session.jsonl"))
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()

	events, err := ParseEvents(f)
	if err != nil {
		t.Fatalf("ParseEvents returned error: %v", err)
	}

	encoded, err := json.Marshal(events)
	if err != nil {
		t.Fatalf("marshal parsed events: %v", err)
	}

	forbiddenValues := []string{
		"session-forbidden-001",
		"Forbidden planning title",
		"Secret Project",
		"Secret Repo",
		"forbidden prompt text",
		"forbidden conversation text",
	}
	for _, forbidden := range forbiddenValues {
		if strings.Contains(string(encoded), forbidden) {
			t.Fatalf("parsed events retained forbidden value %q in %s", forbidden, encoded)
		}
	}
}

func TestParseEventsReturnsMalformedJSONError(t *testing.T) {
	_, err := ParseEvents(strings.NewReader("{not json}\n"))
	if err == nil {
		t.Fatal("expected malformed JSON error")
	}
}

func TestParseEventsReturnsInvalidTimestampError(t *testing.T) {
	input := `{"timestamp":"not-a-time","payload":{"info":{"last_token_usage":{"total_tokens":1}}}}` + "\n"

	_, err := ParseEvents(strings.NewReader(input))
	if err == nil {
		t.Fatal("expected invalid timestamp error")
	}
}

func TestParseEventsSkipsBlankLines(t *testing.T) {
	input := bytes.NewBufferString("\n  \n")

	events, err := ParseEvents(input)
	if err != nil {
		t.Fatalf("ParseEvents returned error: %v", err)
	}
	if len(events) != 0 {
		t.Fatalf("expected no events, got %d", len(events))
	}
}

func TestDiscoverSessionFiles(t *testing.T) {
	root := t.TempDir()
	nested := filepath.Join(root, "2026", "05")
	if err := os.MkdirAll(nested, 0o755); err != nil {
		t.Fatal(err)
	}

	first := filepath.Join(root, "a.jsonl")
	second := filepath.Join(nested, "b.jsonl")
	ignored := filepath.Join(nested, "c.txt")
	for _, name := range []string{first, second, ignored} {
		if err := os.WriteFile(name, []byte("{}\n"), 0o644); err != nil {
			t.Fatal(err)
		}
	}

	files, err := DiscoverSessionFiles(root)
	if err != nil {
		t.Fatalf("DiscoverSessionFiles returned error: %v", err)
	}

	want := []string{first, second}
	sort.Strings(want)
	if len(files) != len(want) {
		t.Fatalf("expected %d files, got %d: %v", len(want), len(files), files)
	}
	for i := range want {
		if files[i] != want[i] {
			t.Fatalf("expected files[%d] = %q, got %q", i, want[i], files[i])
		}
	}
}

func TestDiscoverSessionFilesReportsMissingRoot(t *testing.T) {
	root := filepath.Join(t.TempDir(), "missing")

	_, err := DiscoverSessionFiles(root)
	if err == nil {
		t.Fatal("expected missing root error")
	}
	if !errors.Is(err, ErrSessionsRootMissing) {
		t.Fatalf("expected ErrSessionsRootMissing, got %v", err)
	}
}

func TestDiscoverSessionFilesReportsNoFiles(t *testing.T) {
	_, err := DiscoverSessionFiles(t.TempDir())
	if err == nil {
		t.Fatal("expected no files error")
	}
	if !errors.Is(err, ErrNoSessionFiles) {
		t.Fatalf("expected ErrNoSessionFiles, got %v", err)
	}
}
