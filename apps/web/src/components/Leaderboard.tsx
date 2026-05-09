"use client";

import { AlertTriangle, EyeOff } from "lucide-react";
import type { LeaderboardRow } from "@/lib/leaderboardService";
import type { LeaderboardRange } from "@/lib/types";

export type LeaderboardMember = Pick<
  LeaderboardRow,
  "rank" | "displayName" | "totalTokens" | "isExactTotalHidden" | "lastSyncedAt" | "isStale"
>;

type LeaderboardProps = {
  members: LeaderboardMember[];
  selectedRange: LeaderboardRange;
  onRangeChange: (range: LeaderboardRange) => void;
};

const ranges: Array<{ value: LeaderboardRange; label: string }> = [
  { value: "today", label: "Today" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
  { value: "all", label: "All Time" }
];

const numberFormatter = new Intl.NumberFormat("en-US");

function formatTokens(member: LeaderboardMember) {
  if (member.isExactTotalHidden) {
    return "Hidden";
  }

  if (member.totalTokens === null) {
    return "No data";
  }

  return numberFormatter.format(member.totalTokens);
}

function formatLastSynced(value: string | null) {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

export function Leaderboard({ members, selectedRange, onRangeChange }: LeaderboardProps) {
  return (
    <section className="panel leaderboard-panel" aria-labelledby="leaderboard-title">
      <div className="panel-heading">
        <div>
          <h2 id="leaderboard-title">Leaderboard</h2>
          <p>Group members ranked by synced Codex token usage.</p>
        </div>
        <div className="range-tabs" aria-label="Leaderboard range">
          {ranges.map((range) => (
            <button
              key={range.value}
              type="button"
              aria-pressed={selectedRange === range.value}
              onClick={() => onRangeChange(range.value)}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {members.length === 0 ? (
        <div className="empty-state">
          <h3>No synced members yet</h3>
          <p>Create or join a group, then connect the collector to start ranking usage.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th scope="col">Rank</th>
                <th scope="col">Member</th>
                <th scope="col">Tokens</th>
                <th scope="col">Last synced</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={`${member.rank}-${member.displayName}`}>
                  <td data-label="Rank">#{member.rank}</td>
                  <td data-label="Member">
                    <div className="member-cell">
                      <span className="avatar" aria-hidden="true">
                        {member.displayName.slice(0, 1)}
                      </span>
                      <span>{member.displayName}</span>
                    </div>
                  </td>
                  <td data-label="Tokens">
                    <span className={member.isExactTotalHidden ? "token-total token-total-muted" : "token-total"}>
                      {member.isExactTotalHidden ? <EyeOff size={15} aria-hidden="true" /> : null}
                      {formatTokens(member)}
                    </span>
                  </td>
                  <td data-label="Last synced">
                    <div className="sync-cell">
                      <span>{formatLastSynced(member.lastSyncedAt)}</span>
                      {member.isStale ? (
                        <span className="sync-warning">
                          <AlertTriangle size={15} aria-hidden="true" />
                          Sync stale
                        </span>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default Leaderboard;
