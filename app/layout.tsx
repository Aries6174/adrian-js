import type { Metadata, Viewport } from "next";
import { Barlow, Cormorant_Garamond, Rajdhani } from "next/font/google";
import { Suspense } from "react";
import { ContentBridge } from "@/components/ContentBridge";
import { SiteShell } from "@/components/SiteShell";
import { newestFirst } from "@/lib/content";
import { loadContent } from "@/lib/store";
import "./globals.css";

const display = Rajdhani({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const body = Barlow({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const quote = Cormorant_Garamond({
  variable: "--font-quote",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: {
    default: "ADRIAN.JS_ | The Cosmic Archive",
    template: "%s | ADRIAN.JS_",
  },
  description:
    "Portfolio of Adrian Jaspa, a developer who turns ideas into interactive experiences. A collection of projects, code and worlds rendered in real time.",
};

export const viewport: Viewport = {
  themeColor: "#050403",
};

async function ContentLoader() {
  const { projects } = await loadContent();
  return <ContentBridge projects={newestFirst(projects)} />;
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${quote.variable} antialiased`}
    >
      <body>
        <SiteShell>
          <Suspense fallback={null}>
            <ContentLoader />
          </Suspense>
          {children}
        </SiteShell>
      </body>
    </html>
  );
}
