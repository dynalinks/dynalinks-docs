import type { Metadata } from "next";
import { Open_Sans } from "next/font/google";
import { Provider } from "@/components/provider";
import "./global.css";

const openSans = Open_Sans({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://docs.dynalinks.app"),
  title: {
    default: "Dynalinks documentation",
    template: "%s | Dynalinks documentation",
  },
};

export default function Layout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={openSans.className} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
