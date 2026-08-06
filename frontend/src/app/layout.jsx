import { IBM_Plex_Mono, Inter } from "next/font/google";
import { Sidebar } from "@/components/Sidebar";
import "./globals.css";

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata = {
  title: "Agent Tasks",
  description: "Isolated agent tasks, reviewed before merge.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${plexMono.variable} ${inter.variable}`}>
      <body className="bg-[#0B0E14] font-sans text-[#E6E8EB] antialiased">
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </body>
    </html>
  );
}