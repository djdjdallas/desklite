import "./globals.css";

export const metadata = {
  title: "DeskLite — Startup Inspiration Dashboard",
  description: "Browse startups from TrustMRR for inspiration. See MRR, growth, and more.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
