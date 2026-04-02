// src/app/layout.tsx
import { LanguageProvider } from "@/context/LanguageContext";
import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {/* 这里是关键！必须用 Provider 包裹住 children */}
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}