package codex

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"strings"
	"time"
)

type TokenUsage struct {
	TotalTokens           int64 `json:"totalTokens"`
	InputTokens           int64 `json:"inputTokens"`
	CachedInputTokens     int64 `json:"cachedInputTokens"`
	OutputTokens          int64 `json:"outputTokens"`
	ReasoningOutputTokens int64 `json:"reasoningOutputTokens"`
}

type UsageEvent struct {
	Timestamp time.Time  `json:"timestamp"`
	Usage     TokenUsage `json:"usage"`
}

type jsonlEvent struct {
	Timestamp string `json:"timestamp"`
	Payload   struct {
		Info struct {
			LastTokenUsage *jsonlTokenUsage `json:"last_token_usage"`
		} `json:"info"`
	} `json:"payload"`
}

type jsonlTokenUsage struct {
	TotalTokens           int64 `json:"total_tokens"`
	InputTokens           int64 `json:"input_tokens"`
	CachedInputTokens     int64 `json:"cached_input_tokens"`
	OutputTokens          int64 `json:"output_tokens"`
	ReasoningOutputTokens int64 `json:"reasoning_output_tokens"`
}

func ParseUsageEvents(r io.Reader) ([]UsageEvent, error) {
	reader := bufio.NewReader(r)
	var events []UsageEvent
	lineNumber := 0

	for {
		line, err := reader.ReadString('\n')
		if len(line) > 0 {
			lineNumber++
			event, ok, parseErr := parseLine(line)
			if parseErr != nil {
				return nil, fmt.Errorf("parse codex jsonl line %d: %w", lineNumber, parseErr)
			}
			if ok {
				events = append(events, event)
			}
		}
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("read codex jsonl: %w", err)
		}
	}

	return events, nil
}

func parseLine(line string) (UsageEvent, bool, error) {
	if strings.TrimSpace(line) == "" {
		return UsageEvent{}, false, nil
	}

	var raw jsonlEvent
	if err := json.Unmarshal([]byte(line), &raw); err != nil {
		return UsageEvent{}, false, err
	}
	if raw.Timestamp == "" || raw.Payload.Info.LastTokenUsage == nil {
		return UsageEvent{}, false, nil
	}

	timestamp, err := time.Parse(time.RFC3339Nano, raw.Timestamp)
	if err != nil {
		return UsageEvent{}, false, fmt.Errorf("invalid timestamp %q: %w", raw.Timestamp, err)
	}

	return UsageEvent{
		Timestamp: timestamp,
		Usage: TokenUsage{
			TotalTokens:           raw.Payload.Info.LastTokenUsage.TotalTokens,
			InputTokens:           raw.Payload.Info.LastTokenUsage.InputTokens,
			CachedInputTokens:     raw.Payload.Info.LastTokenUsage.CachedInputTokens,
			OutputTokens:          raw.Payload.Info.LastTokenUsage.OutputTokens,
			ReasoningOutputTokens: raw.Payload.Info.LastTokenUsage.ReasoningOutputTokens,
		},
	}, true, nil
}
