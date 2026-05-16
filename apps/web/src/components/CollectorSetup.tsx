"use client";

import { KeyRound, Terminal } from "lucide-react";
import { useState } from "react";

type CollectorDeviceResponse = {
  token?: string;
};

type CollectorSetupProps = {
  accessToken?: string | null;
};

function getOrigin() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.location.origin;
}

export function CollectorSetup({ accessToken = null }: CollectorSetupProps) {
  const [command, setCommand] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const normalizedAccessToken = accessToken?.trim() ?? "";
  const canGenerateToken = Boolean(normalizedAccessToken);

  async function generateToken() {
    if (!canGenerateToken) {
      setError("Sign in with GitHub before generating a collector token.");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setCommand(null);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${normalizedAccessToken}`
      };

      const response = await fetch("/api/collector/devices", {
        method: "POST",
        headers,
        body: JSON.stringify({ platform: "web", deviceLabel: "Dashboard browser" })
      });

      if (!response.ok) {
        throw new Error("Token generation failed");
      }

      const payload = (await response.json()) as CollectorDeviceResponse;
      if (!payload.token) {
        throw new Error("Token generation failed");
      }

      setCommand(`codex-tokens login --server ${getOrigin()} --token ${payload.token}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Token generation failed");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <section className="panel collector-panel" aria-labelledby="collector-title">
      <div className="panel-heading compact">
        <div>
          <h2 id="collector-title">Collector setup</h2>
          <p>Generate a one-time device token for the local collector.</p>
        </div>
      </div>

      <button
        type="button"
        className="primary action-button"
        onClick={generateToken}
        disabled={isGenerating || !canGenerateToken}
        aria-describedby={canGenerateToken ? undefined : "collector-auth-note"}
      >
        <KeyRound size={16} aria-hidden="true" />
        {isGenerating ? "Generating..." : "Generate token"}
      </button>
      {!canGenerateToken ? (
        <p id="collector-auth-note" className="muted-note">
          Sign in to generate a collector token.
        </p>
      ) : null}

      {command ? (
        <div className="command-block" role="status">
          <div className="command-label">
            <Terminal size={15} aria-hidden="true" />
            Login command
          </div>
          <code>{command}</code>
        </div>
      ) : null}

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

export default CollectorSetup;
