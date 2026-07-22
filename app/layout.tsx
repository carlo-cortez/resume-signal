import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const baseUrl = new URL(`${protocol}://${host}`);
  const description = "Compare your resume with a job description, review credible gaps, and build a clean ATS-safe resume.";

  return {
    metadataBase: baseUrl,
    title: "Resume Signal — ATS Resume Builder",
    description,
    openGraph: {
      title: "Resume Signal",
      description,
      type: "website",
      images: [{ url: new URL("/og.png", baseUrl), width: 1536, height: 1024, alt: "Resume Signal — Build the version of your resume this role needs." }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Resume Signal",
      description,
      images: [new URL("/og.png", baseUrl)],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
