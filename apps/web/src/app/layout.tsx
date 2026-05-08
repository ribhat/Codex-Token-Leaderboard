import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Codex Token Leaderboard",
  description: "Privacy-first friend leaderboard for Codex token usage"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
