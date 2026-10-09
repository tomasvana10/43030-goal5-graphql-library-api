import type { Metadata } from "next";

import { ApolloProvider } from "@/ApolloProvider";
import "./globals.css";

export const metadata: Metadata = { title: "Library" };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ApolloProvider>{children}</ApolloProvider>
      </body>
    </html>
  );
}
