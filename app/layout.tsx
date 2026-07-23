import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  // Absolute base for OG/twitter image URLs. Netlify sets URL per site
  // (exotiq.rent / book.exotiq.rent / demo.exotiq.rent); without this,
  // generated opengraph-image URLs resolve to localhost in production.
  metadataBase: new URL(process.env.URL || "http://localhost:3000"),
  title: "Exotiq Rent | The Marketplace for Extraordinary Driving Experiences",
  description: "Access curated exotic fleets in 25+ cities. AI-powered pricing. White-glove service. The definitive luxury car rental marketplace.",
  openGraph: {
    title: "Exotiq Rent | The Marketplace for Extraordinary Driving Experiences",
    description: "Access curated exotic fleets in 25+ cities. AI-powered pricing. White-glove service.",
    siteName: "Exotiq Rent",
    locale: "en_US",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans">
        {children}
      </body>
    </html>
  );
}
