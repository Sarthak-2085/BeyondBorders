"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Globe2, Menu, X, Compass } from "lucide-react";
import { nav } from "@/lib/routes";
export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="Beyond Borders home">
      <span className="brand-symbol">
        <Globe2 />
      </span>
      <span>
        BEYOND BORDERS<span className="brand-dot">.</span>
      </span>
    </Link>
  );
}
export function Header() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="mast">
        <Brand />
        <button
          className="mobile-menu iconbtn"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label={open ? "Close navigation" : "Open navigation"}
        >
          {open ? <X /> : <Menu />}
        </button>
        <nav aria-label="Primary" className={open ? "mainnav open" : "mainnav"}>
          {nav.map(([s, h]) => (
            <Link
              key={s}
              href={h}
              className={
                (
                  path === "/"
                    ? h === "/"
                    : h !== "/" && path.startsWith(h.replace(/\/$/, ""))
                )
                  ? "active"
                  : ""
              }
            >
              {s}
            </Link>
          ))}
        </nav>
        <Link className="atlas-link" href="/explore/">
          <Compass size={16} />
          Open atlas
        </Link>
      </header>
    </>
  );
}
export function Footer() {
  return (
    <footer>
      <Brand />
      <span>Global education intelligence</span>
      <div>
        <Link href="/reports/">Sources & reports</Link>
        <Link href="/import/">Data import</Link>
        <Link href="/shortlist/">Shortlist</Link>
      </div>
    </footer>
  );
}
