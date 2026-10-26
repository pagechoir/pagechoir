import type { Metadata } from "next";
import { Cormorant_Garamond, Libre_Baskerville, Source_Sans_3, Source_Serif_4 } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const sans = Source_Sans_3({ subsets: ["latin"], variable: "--font-sans-text" });
const serif = Source_Serif_4({ subsets: ["latin"], variable: "--font-serif-text" });
const classic = Libre_Baskerville({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-classic" });
const ornament = Cormorant_Garamond({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-ornament" });

export const metadata: Metadata = {
  title: "Pagechoir",
  description: "A free book studio for drafting, planning, and typesetting.",
};

const themeScript = `(function(){try{var t=localStorage.getItem("pagechoir-theme");var d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${sans.variable} ${serif.variable} ${classic.variable} ${ornament.variable} antialiased`}>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
