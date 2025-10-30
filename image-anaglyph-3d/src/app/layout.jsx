export const metadata = {
  title: "Image Anaglyph 3D Creator",
  description: "Create red-cyan anaglyph images for 3D glasses.",
};

import "./globals.css";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-grey text-ink">
        <header className="container flex justify-between items-center py-16">
          <h1 className="text-2xl font-semibold">Image Anaglyph 3D Creator</h1>
          <a href="/" className="btn">Home</a>
        </header>
        <main className="container py-16">
          {children}
        </main>
        <footer className="container py-16 text-sm text-muted">
          Client-side only • No external services • Canvas-based processing
        </footer>
      </body>
    </html>
  );
}