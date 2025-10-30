import "./globals.css";
export const metadata = {
  title: "Image Hidden Message",
  description: "Hide and reveal text in images via LSB steganography",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <header className="border-b bg-white">
          <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
            <h1 className="text-lg font-bold">Image Hidden Message</h1>
            <nav className="text-sm text-slate-600">No external services. Local-only.</nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
        <footer className="border-t bg-white mt-8">
          <div className="mx-auto max-w-5xl px-6 py-4 text-sm text-slate-600">
            © {new Date().getFullYear()} Image Hidden Message
          </div>
        </footer>
      </body>
    </html>
  );
}