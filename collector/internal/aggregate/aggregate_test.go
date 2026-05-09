package aggregate

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/codex-token-leaderboard/collector/internal/codex"
)

func TestDailyTotalsAggregatesByUTCDate(t *testing.T) {
	events := []codex.Event{
		{
			Timestamp: time.Date(2026, 5, 9, 23, 30, 0, 0, time.UTC),
			Usage: codex.TokenUsage{
				TotalTokens:           10,
				InputTokens:           6,
				CachedInputTokens:     2,
				OutputTokens:          4,
				ReasoningOutputTokens: 1,
			},
		},
		{
			Timestamp: time.Date(2026, 5, 10, 1, 15, 0, 0, time.UTC),
			Usage: codex.TokenUsage{
				TotalTokens:           20,
				InputTokens:           12,
				CachedInputTokens:     3,
				OutputTokens:          8,
				ReasoningOutputTokens: 2,
			},
		},
		{
			Timestamp: time.Date(2026, 5, 9, 2, 0, 0, 0, time.FixedZone("UTC-7", -7*60*60)),
			Usage: codex.TokenUsage{
				TotalTokens:           30,
				InputTokens:           18,
				CachedInputTokens:     4,
				OutputTokens:          12,
				ReasoningOutputTokens: 3,
			},
		},
	}

	rows := DailyTotals(events)

	if len(rows) != 2 {
		t.Fatalf("expected 2 daily rows, got %d", len(rows))
	}

	first := rows[0]
	if first.UsageDate != "2026-05-09" {
		t.Fatalf("expected first row date 2026-05-09, got %q", first.UsageDate)
	}
	if first.Source != SourceCodexJSONL {
		t.Fatalf("expected source %q, got %q", SourceCodexJSONL, first.Source)
	}
	if first.TotalTokens != 40 {
		t.Fatalf("expected total tokens 40, got %d", first.TotalTokens)
	}
	if first.InputTokens != 24 {
		t.Fatalf("expected input tokens 24, got %d", first.InputTokens)
	}
	if first.CachedInputTokens != 6 {
		t.Fatalf("expected cached input tokens 6, got %d", first.CachedInputTokens)
	}
	if first.OutputTokens != 16 {
		t.Fatalf("expected output tokens 16, got %d", first.OutputTokens)
	}
	if first.ReasoningOutputTokens != 4 {
		t.Fatalf("expected reasoning output tokens 4, got %d", first.ReasoningOutputTokens)
	}
	if first.ResponseCount != 2 {
		t.Fatalf("expected response count 2, got %d", first.ResponseCount)
	}

	second := rows[1]
	if second.UsageDate != "2026-05-10" {
		t.Fatalf("expected second row date 2026-05-10, got %q", second.UsageDate)
	}
	if second.TotalTokens != 20 {
		t.Fatalf("expected second row total tokens 20, got %d", second.TotalTokens)
	}
	if second.ResponseCount != 1 {
		t.Fatalf("expected second row response count 1, got %d", second.ResponseCount)
	}
}

func TestDailyTotalsDoesNotRetainPrivateFields(t *testing.T) {
	rows := DailyTotals([]codex.Event{
		{
			Timestamp: time.Date(2026, 5, 9, 0, 0, 0, 0, time.UTC),
			Usage: codex.TokenUsage{
				TotalTokens: 1,
			},
		},
	})

	encoded, err := json.Marshal(rows)
	if err != nil {
		t.Fatalf("marshal daily totals: %v", err)
	}

	forbiddenFields := []string{
		"prompt",
		"title",
		"cwd",
		"repo_path",
		"session_id",
		"conversation",
	}
	for _, forbidden := range forbiddenFields {
		if strings.Contains(string(encoded), forbidden) {
			t.Fatalf("aggregate rows retained forbidden field %q in %s", forbidden, encoded)
		}
	}
}
