import ThemeSwitcher from "./components/ThemeSwitcher";
import "./globals.css";
export const metadata = {
  title: 'Image Format Converter',
  description: 'Convert images between formats locally in your browser',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <div className="min-h-screen bg-base-200 text-base-content">
          <div className="navbar bg-base-100 border-b border-base-300">
            <div className="container mx-auto">
              <div className="flex-1">
                <a className="btn btn-ghost normal-case text-xl font-semibold">Image Format Converter • Pro</a>
              </div>
              <div className="flex-none flex items-center gap-3">
                <span className="badge badge-outline">Local & Fast</span>
                <ThemeSwitcher />
              </div>
            </div>
          </div>
          <main className="container mx-auto max-w-5xl p-4">{children}</main>
          <footer className="border-t bg-base-200">
            <div className="container mx-auto p-4 text-sm">
              © {new Date().getFullYear()} Image Format Converter
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}