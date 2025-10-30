"use client";
import React from "react";

const themes = [
  "emerald",
  "cupcake",
  "bumblebee",
  "corporate",
  "synthwave",
  "valentine",
  "garden",
  "lofi",
  "pastel",
  "dracula",
];

export default function ThemeSwitcher() {
  const [theme, setTheme] = React.useState<string>("corporate");
  const storageKey = "ifc-theme-v2";

  React.useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    const currentAttr = document.documentElement.getAttribute("data-theme");
    const t = saved || currentAttr || theme;
    // Sync state to the applied theme
    setTheme(t);
    document.documentElement.setAttribute("data-theme", t);
    if (!saved) localStorage.setItem(storageKey, t);
  }, []);

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const t = e.target.value;
    setTheme(t);
    document.documentElement.setAttribute("data-theme", t);
    localStorage.setItem(storageKey, t);
  };

  return (
    <select className="select select-ghost select-sm" value={theme} onChange={onChange}>
      {themes.map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </select>
  );
}