package aggregate

import (
	"sort"

	"github.com/codex-token-leaderboard/collector/internal/codex"
)

const SourceCodexJSONL = "codex-jsonl"

type DailyUsage struct {
	UsageDate             string `json:"usageDate"`
	Source                string `json:"source"`
	TotalTokens           int    `json:"totalTokens"`
	InputTokens           int    `json:"inputTokens"`
	CachedInputTokens     int    `json:"cachedInputTokens"`
	OutputTokens          int    `json:"outputTokens"`
	ReasoningOutputTokens int    `json:"reasoningOutputTokens"`
	ResponseCount         int    `json:"responseCount"`
}

func DailyTotals(events []codex.Event) []DailyUsage {
	byDate := make(map[string]*DailyUsage)

	for _, event := range events {
		usageDate := event.Timestamp.UTC().Format("2006-01-02")
		row, ok := byDate[usageDate]
		if !ok {
			row = &DailyUsage{
				UsageDate: usageDate,
				Source:    SourceCodexJSONL,
			}
			byDate[usageDate] = row
		}

		row.TotalTokens += event.Usage.TotalTokens
		row.InputTokens += event.Usage.InputTokens
		row.CachedInputTokens += event.Usage.CachedInputTokens
		row.OutputTokens += event.Usage.OutputTokens
		row.ReasoningOutputTokens += event.Usage.ReasoningOutputTokens
		row.ResponseCount++
	}

	rows := make([]DailyUsage, 0, len(byDate))
	for _, row := range byDate {
		rows = append(rows, *row)
	}
	sort.Slice(rows, func(i, j int) bool {
		return rows[i].UsageDate < rows[j].UsageDate
	})

	return rows
}
