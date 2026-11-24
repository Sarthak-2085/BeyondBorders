import type { Metadata } from "next";
import "./fonts.css";
import "./globals.css";
import { Header, Footer } from "@/components/Shell";
export const metadata: Metadata = {
  title: {
    default: "Beyond Borders — Global Education Atlas",
    template: "%s · Beyond Borders",
  },
  description:
    "Explore international student movement, compare education destinations and plan a study journey using sourced education data.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script src="/atlas-runtime.js" />
      </head>
      <body>
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}
