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
	TotalTokens           int `json:"totalTokens"`
	InputTokens           int `json:"inputTokens"`
	CachedInputTokens     int `json:"cachedInputTokens"`
	OutputTokens          int `json:"outputTokens"`
	ReasoningOutputTokens int `json:"reasoningOutputTokens"`
}

type Event struct {
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
	TotalTokens           int `json:"total_tokens"`
	InputTokens           int `json:"input_tokens"`
	CachedInputTokens     int `json:"cached_input_tokens"`
	OutputTokens          int `json:"output_tokens"`
	ReasoningOutputTokens int `json:"reasoning_output_tokens"`
}

func ParseEvents(r io.Reader) ([]Event, error) {
	reader := bufio.NewReader(r)
	var events []Event
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

func parseLine(line string) (Event, bool, error) {
	if strings.TrimSpace(line) == "" {
		return Event{}, false, nil
	}

	var raw jsonlEvent
	if err := json.Unmarshal([]byte(line), &raw); err != nil {
		return Event{}, false, err
	}
	if raw.Timestamp == "" || raw.Payload.Info.LastTokenUsage == nil {
		return Event{}, false, nil
	}

	timestamp, err := time.Parse(time.RFC3339Nano, raw.Timestamp)
	if err != nil {
		return Event{}, false, fmt.Errorf("invalid timestamp %q: %w", raw.Timestamp, err)
	}

	return Event{
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
