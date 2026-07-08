import type { Metadata } from "next";
import { Spectral, Hanken_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import "./cosign.css";

// The three faces mandated by the design brief: Spectral (display),
// Hanken Grotesk (body), IBM Plex Mono (every money figure).
const spectral = Spectral({
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-spectral",
});

const hanken = Hanken_Grotesk({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-hanken",
});

const plexMono = IBM_Plex_Mono({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://co-sign-eight.vercel.app"),
  title: {
    default: "Co-Sign — Stake on the people you trust",
    template: "%s · Co-Sign",
  },
  description:
    "Put your money where your trust is. A reputation-staking primitive on Stacks, built on FlowVault: backers lock real capital on a newcomer's outcome — restitution built in, no judge anywhere.",
  keywords: ["Stacks", "FlowVault", "reputation", "staking", "escrow", "Bitcoin", "USDCx"],
  openGraph: {
    title: "Co-Sign — Stake on the people you trust",
    description:
      "On-chain reputation is a scoreboard. Co-Sign makes it a market — trust as a real, staked position, enforced by FlowVault on Stacks.",
    url: "https://co-sign-eight.vercel.app",
    siteName: "Co-Sign",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Co-Sign — Stake on the people you trust",
    description:
      "Trust as a staked position on Stacks: back a newcomer with real capital, earn 2% when they deliver — or your stake pays the person they let down.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spectral.variable} ${hanken.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
