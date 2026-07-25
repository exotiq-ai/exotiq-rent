import type { Metadata } from "next";
import "./globals.css";

// Booking deploys (book./demo.exotiq.rent) are Drive Exotiq; the marketplace
// deploy (exotiq.rent) keeps the Exotiq Rent marketing identity. Without this
// split, every booking page that doesn't set its own metadata inherits
// marketplace branding — including the 404s renters actually land on.
const isMarketplace = process.env.NEXT_PUBLIC_SITE_MODE === "marketplace";

const BRAND = isMarketplace
  ? {
      siteName: "Exotiq Rent",
      title: "Exotiq Rent | The Marketplace for Extraordinary Driving Experiences",
      description:
        "Access curated exotic fleets in 25+ cities. AI-powered pricing. White-glove service. The definitive luxury car rental marketplace.",
      ogDescription:
        "Access curated exotic fleets in 25+ cities. AI-powered pricing. White-glove service.",
    }
  : {
      siteName: "Drive Exotiq",
      title: "Drive Exotiq | Curated Exotic & Luxury Rentals",
      description:
        "Reserve a curated exotic or luxury car with Drive Exotiq. Verified drivers, transparent pricing, concierge handoff.",
      ogDescription:
        "Reserve a curated exotic or luxury car with Drive Exotiq. Verified drivers, transparent pricing.",
    };

export const metadata: Metadata = {
  // Absolute base for OG/twitter image URLs. Netlify sets URL per site
  // (exotiq.rent / book.exotiq.rent / demo.exotiq.rent); without this,
  // generated opengraph-image URLs resolve to localhost in production.
  metadataBase: new URL(process.env.URL || "http://localhost:3000"),
  title: BRAND.title,
  description: BRAND.description,
  openGraph: {
    title: BRAND.title,
    description: BRAND.ogDescription,
    siteName: BRAND.siteName,
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
