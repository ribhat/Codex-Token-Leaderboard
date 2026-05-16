"use client";

import { CircleUserRound, LogIn, Plus, Users } from "lucide-react";
import type { FormEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { createSupabaseBrowserClient, displayNameFromSession } from "@/lib/supabaseBrowser";
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

type PublicGroup = {
  id: string;
  name: string;
  creatorId: string;
  timezone: string;
  createdAt: string;
};

type GroupResponse = {
  group?: PublicGroup;
  inviteCode?: string;
  error?: string;
};

type GroupsResponse = {
  groups?: PublicGroup[];
  error?: string;
};

type LeaderboardResponse = {
  rows?: LeaderboardMember[];
  error?: string;
};

async function readJsonError(response: Response) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? "Request failed";
  } catch {
    return "Request failed";
  }
}

export function Dashboard({ accessToken = null }: DashboardProps) {
  const [selectedRange, setSelectedRange] = useState<LeaderboardRange>("today");
  const [session, setSession] = useState<Session | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [groups, setGroups] = useState<PublicGroup[]>([]);
  const [activeGroup, setActiveGroup] = useState<PublicGroup | null>(null);
  const [groupStatus, setGroupStatus] = useState<string | null>(null);
  const [groupError, setGroupError] = useState<string | null>(null);
  const [groupListError, setGroupListError] = useState<string | null>(null);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [isJoiningGroup, setIsJoiningGroup] = useState(false);
  const [leaderboardMembers, setLeaderboardMembers] = useState<LeaderboardMember[]>(sampleMembers);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);
  const externalAccessToken = accessToken?.trim() ?? "";
  const effectiveAccessToken = session?.access_token ?? externalAccessToken;
  const userScope = session?.user.id ?? (externalAccessToken ? "external-token" : "");
  const userScopeRef = useRef(userScope);
  const signedInName = displayNameFromSession(session);

  const resetPrivateDashboardState = useCallback(() => {
    setGroups([]);
    setActiveGroup(null);
    setGroupStatus(null);
    setGroupError(null);
    setGroupListError(null);
    setLeaderboardError(null);
    setLeaderboardMembers(sampleMembers);
  }, []);

  useEffect(() => {
    let isMounted = true;

    try {
      const supabase = createSupabaseBrowserClient();
      supabase.auth.getSession().then(({ data }) => {
        if (isMounted) {
          userScopeRef.current = data.session?.user.id ?? (externalAccessToken ? "external-token" : "");
          setSession(data.session);
        }
      });
      const {
        data: { subscription }
      } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        if (isMounted) {
          userScopeRef.current = nextSession?.user.id ?? (externalAccessToken ? "external-token" : "");
          setSession(nextSession);
          setAuthError(null);
        }
      });

      return () => {
        isMounted = false;
        subscription.unsubscribe();
      };
    } catch {
      return () => {
        isMounted = false;
      };
    }
  }, [externalAccessToken]);

  useEffect(() => {
    userScopeRef.current = userScope;
    resetPrivateDashboardState();
  }, [resetPrivateDashboardState, userScope]);

  const loadLeaderboard = useCallback(
    async (groupId: string, range: LeaderboardRange, token: string, requestedUserScope: string) => {
      if (!token) {
        return;
      }

      setLeaderboardError(null);
      const response = await fetch(`/api/groups/${groupId}/leaderboard?range=${range}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) {
        throw new Error(await readJsonError(response));
      }

      const payload = (await response.json()) as LeaderboardResponse;
      if (userScopeRef.current !== requestedUserScope) {
        return;
      }

      setLeaderboardMembers(payload.rows ?? []);
    },
    []
  );

  const loadGroups = useCallback(async (token: string, requestedUserScope: string) => {
    if (!token) {
      return;
    }

    setGroupListError(null);
    const response = await fetch("/api/groups", {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) {
      throw new Error(await readJsonError(response));
    }

    const payload = (await response.json()) as GroupsResponse;
    if (userScopeRef.current !== requestedUserScope) {
      return;
    }

    const nextGroups = payload.groups ?? [];
    setGroups(nextGroups);
    setActiveGroup((currentGroup) => {
      if (currentGroup && nextGroups.some((group) => group.id === currentGroup.id)) {
        return currentGroup;
      }
      return nextGroups[0] ?? null;
    });
  }, []);

  useEffect(() => {
    if (!effectiveAccessToken) {
      return;
    }

    loadGroups(effectiveAccessToken, userScope).catch((error) => {
      if (userScopeRef.current !== userScope) {
        return;
      }
      setGroupListError(error instanceof Error ? error.message : "Groups could not be loaded");
    });
  }, [effectiveAccessToken, loadGroups, userScope]);

  useEffect(() => {
    if (!activeGroup || !effectiveAccessToken) {
      return;
    }

    loadLeaderboard(activeGroup.id, selectedRange, effectiveAccessToken, userScope).catch((error) => {
      if (userScopeRef.current !== userScope) {
        return;
      }
      setLeaderboardError(error instanceof Error ? error.message : "Leaderboard could not be loaded");
    });
  }, [activeGroup, effectiveAccessToken, loadLeaderboard, selectedRange, userScope]);

  async function signInOrOut() {
    setIsSigningIn(true);
    setAuthError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      if (session) {
        await supabase.auth.signOut();
        userScopeRef.current = externalAccessToken ? "external-token" : "";
        setSession(null);
        resetPrivateDashboardState();
        return;
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: { redirectTo: window.location.origin }
      });
      if (error) {
        throw error;
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "GitHub sign-in could not start");
    } finally {
      setIsSigningIn(false);
    }
  }

  async function submitGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!effectiveAccessToken) {
      setGroupError("Sign in with GitHub before managing groups.");
      return;
    }

    setIsCreatingGroup(true);
    setGroupError(null);
    setGroupStatus(null);

    try {
      const response = await fetch("/api/groups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${effectiveAccessToken}`
        },
        body: JSON.stringify({ name: groupName })
      });
      if (!response.ok) {
        throw new Error(await readJsonError(response));
      }

      const payload = (await response.json()) as GroupResponse;
      if (!payload.group) {
        throw new Error("Group could not be created");
      }
      setGroups((currentGroups) =>
        currentGroups.some((group) => group.id === payload.group!.id)
          ? currentGroups.map((group) => (group.id === payload.group!.id ? payload.group! : group))
          : [...currentGroups, payload.group!]
      );
      setActiveGroup(payload.group);
      setGroupName("");
      setGroupStatus(
        payload.inviteCode
          ? `Created ${payload.group.name}. Invite code: ${payload.inviteCode}`
          : `Created ${payload.group.name}.`
      );
    } catch (error) {
      setGroupError(error instanceof Error ? error.message : "Group could not be created");
    } finally {
      setIsCreatingGroup(false);
    }
  }

  async function submitInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!effectiveAccessToken) {
      setGroupError("Sign in with GitHub before managing groups.");
      return;
    }

    setIsJoiningGroup(true);
    setGroupError(null);
    setGroupStatus(null);

    try {
      const response = await fetch("/api/groups/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${effectiveAccessToken}`
        },
        body: JSON.stringify({ inviteCode })
      });
      if (!response.ok) {
        throw new Error(await readJsonError(response));
      }

      const payload = (await response.json()) as GroupResponse;
      if (!payload.group) {
        throw new Error("Group could not be joined");
      }
      setGroups((currentGroups) =>
        currentGroups.some((group) => group.id === payload.group!.id)
          ? currentGroups.map((group) => (group.id === payload.group!.id ? payload.group! : group))
          : [...currentGroups, payload.group!]
      );
      setActiveGroup(payload.group);
      setInviteCode("");
      setGroupStatus(`Joined ${payload.group.name}.`);
    } catch (error) {
      setGroupError(error instanceof Error ? error.message : "Group could not be joined");
    } finally {
      setIsJoiningGroup(false);
    }
  }

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <div>
          <p className="app-kicker">Codex Token Leaderboard</p>
          <h1>Token Leaderboard</h1>
        </div>
        <div className="identity-area" aria-label="Profile">
          <div className="identity-copy">
            <span>{session ? signedInName : "Not signed in"}</span>
            <small>{session ? "GitHub connected." : "Connect GitHub to save groups."}</small>
          </div>
          <button type="button" className="identity-button" onClick={signInOrOut} disabled={isSigningIn}>
            <CircleUserRound size={16} aria-hidden="true" />
            {session ? "Sign out" : isSigningIn ? "Connecting..." : "Sign in with GitHub"}
          </button>
          {authError ? (
            <p className="form-error compact" role="alert">
              {authError}
            </p>
          ) : null}
        </div>
      </header>

      <div className="dashboard-main">
        <Leaderboard members={leaderboardMembers} selectedRange={selectedRange} onRangeChange={setSelectedRange} />

        <aside className="dashboard-sidebar" aria-label="Dashboard controls">
          <section className="panel group-panel" aria-labelledby="groups-title">
            <div className="panel-heading compact">
              <div>
                <h2 id="groups-title">Groups</h2>
                <p>Create a private leaderboard or join with an invite.</p>
              </div>
            </div>

            <form className="control-form" onSubmit={submitGroup}>
              <label htmlFor="group-name">Group name</label>
              <div className="inline-controls">
                <input
                  id="group-name"
                  name="groupName"
                  placeholder="Team usage"
                  value={groupName}
                  onChange={(event) => setGroupName(event.target.value)}
                />
                <button type="submit" className="primary" disabled={isCreatingGroup}>
                  <Plus size={16} aria-hidden="true" />
                  {isCreatingGroup ? "Creating..." : "Create group"}
                </button>
              </div>
            </form>

            <form className="control-form" onSubmit={submitInvite}>
              <label htmlFor="invite-code">Invite code</label>
              <div className="inline-controls">
                <input
                  id="invite-code"
                  name="inviteCode"
                  placeholder="ABCD-1234"
                  value={inviteCode}
                  onChange={(event) => setInviteCode(event.target.value)}
                />
                <button type="submit" disabled={isJoiningGroup}>
                  <LogIn size={16} aria-hidden="true" />
                  {isJoiningGroup ? "Joining..." : "Join"}
                </button>
              </div>
            </form>

            {groupError ? (
              <p className="form-error" role="alert">
                {groupError}
              </p>
            ) : null}
            {groupStatus ? <p className="form-success">{groupStatus}</p> : null}
            {groupListError ? (
              <p className="form-error" role="alert">
                {groupListError}
              </p>
            ) : null}

            {groups.length > 1 ? (
              <div className="control-form">
                <label htmlFor="active-group">Current group</label>
                <select
                  id="active-group"
                  value={activeGroup?.id ?? ""}
                  onChange={(event) => {
                    setActiveGroup(groups.find((group) => group.id === event.target.value) ?? null);
                  }}
                >
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="group-meta">
              <Users size={15} aria-hidden="true" />
              {activeGroup ? `Current group: ${activeGroup.name}` : "Sample group: 3 members"}
            </div>
          </section>

          {leaderboardError ? (
            <p className="form-error" role="alert">
              {leaderboardError}
            </p>
          ) : null}
          <CollectorSetup accessToken={effectiveAccessToken} />
        </aside>
      </div>
    </main>
  );
}

export default Dashboard;
