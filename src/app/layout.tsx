import type { Metadata } from "next";
import type { ReactNode } from "react";

import { SessionControls } from "@/components/SessionControls";

import "./globals.css";

export const metadata: Metadata = {
  title: "Script Speech",
  description:
    "Script Speech is a voice-forward story studio with a reimagined canvas for writers and directors to think out loud.",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <SessionControls />
        {children}
      </body>
    </html>
  );
}
