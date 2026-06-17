import type { ReactNode } from "react";

export const metadata = {
  title: "turkce",
  description: "Personal AI Turkish tutor",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
