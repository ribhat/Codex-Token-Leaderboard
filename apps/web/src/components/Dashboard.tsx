"use client";

import { CircleUserRound, LogIn, Plus, Users } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import type { LeaderboardRange } from "@/lib/types";
import { CollectorSetup } from "./CollectorSetup";
import { Leaderboard, type LeaderboardMember } from "./Leaderboard";

const sampleMembers: LeaderboardMember[] = [
  {
    userId: "sample-riley",
    rank: 1,
    displayName: "Riley Chen",
    avatarUrl: null,
    totalTokens: 12480,
    lastSyncedAt: "2026-05-08T19:42:00-07:00",
    isExactTotalHidden: false,
    isStale: false
  },
  {
    userId: "sample-sam",
    rank: 2,
    displayName: "Sam Privacy",
    avatarUrl: null,
    totalTokens: null,
    isExactTotalHidden: true,
    lastSyncedAt: "2026-05-08T18:10:00-07:00",
    isStale: false
  },
  {
    userId: "sample-morgan",
    rank: 3,
    displayName: "Morgan Stale",
    avatarUrl: null,
    totalTokens: 3910,
    lastSyncedAt: "2026-05-05T08:30:00-07:00",
    isExactTotalHidden: false,
    isStale: true
  }
];

type DashboardProps = {
  accessToken?: string | null;
};

function preventPlaceholderSubmit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
}

export function Dashboard({ accessToken = null }: DashboardProps) {
  const [selectedRange, setSelectedRange] = useState<LeaderboardRange>("today");

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <div>
          <p className="app-kicker">Codex Token Leaderboard</p>
          <h1>Token Leaderboard</h1>
        </div>
        <div className="identity-area" aria-label="Profile">
          <div className="identity-copy">
            <span>Not signed in</span>
            <small>Connect GitHub to save groups.</small>
          </div>
          <button type="button" className="identity-button">
            <CircleUserRound size={16} aria-hidden="true" />
            Sign in with GitHub
          </button>
        </div>
      </header>

      <div className="dashboard-main">
        <Leaderboard members={sampleMembers} selectedRange={selectedRange} onRangeChange={setSelectedRange} />

        <aside className="dashboard-sidebar" aria-label="Dashboard controls">
          <section className="panel group-panel" aria-labelledby="groups-title">
            <div className="panel-heading compact">
              <div>
                <h2 id="groups-title">Groups</h2>
                <p>Create a private leaderboard or join with an invite.</p>
              </div>
            </div>

            <form className="control-form" onSubmit={preventPlaceholderSubmit}>
              <label htmlFor="group-name">Group name</label>
              <div className="inline-controls">
                <input id="group-name" name="groupName" placeholder="Team usage" />
                <button type="submit" className="primary">
                  <Plus size={16} aria-hidden="true" />
                  Create group
                </button>
              </div>
            </form>

            <form className="control-form" onSubmit={preventPlaceholderSubmit}>
              <label htmlFor="invite-code">Invite code</label>
              <div className="inline-controls">
                <input id="invite-code" name="inviteCode" placeholder="ABCD-1234" />
                <button type="submit">
                  <LogIn size={16} aria-hidden="true" />
                  Join
                </button>
              </div>
            </form>

            <div className="group-meta">
              <Users size={15} aria-hidden="true" />
              Sample group: 3 members
            </div>
          </section>

          <CollectorSetup accessToken={accessToken} />
        </aside>
      </div>
    </main>
  );
}

export default Dashboard;
