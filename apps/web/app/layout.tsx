import type { Metadata } from "next";
import "./globals.css";
import ThemeProvider from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: "TCC — Trader's Command Center",
  description: "The world's first platform where trading is a sport",
};

// Sets data-theme on <html> before first paint, so the persisted theme
// applies immediately instead of flashing dark (the default) then
// switching to light after React hydrates. Reads the same
// tcc:{userId}:theme key ThemeProvider/themeStore.ts use — kept in sync
// with lib/persistence/storage.ts's key format by hand, since this has to
// run before any app code loads. Fails silently (stays on the dark
// default) if storage is unavailable or the value is malformed.
const NO_FLASH_THEME_SCRIPT = `
(function () {
  try {
    var authRaw = localStorage.getItem("tcc:auth");
    var userId = "guest";
    if (authRaw) {
      var userIdParsed = JSON.parse(authRaw)?.state?.user?.id;
      if (userIdParsed) userId = userIdParsed;
    }
    var themeRaw = localStorage.getItem("tcc:" + userId + ":theme");
    var theme = themeRaw ? JSON.parse(themeRaw)?.state?.theme : null;
    if (theme === "light") document.documentElement.setAttribute("data-theme", "light");
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_THEME_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}