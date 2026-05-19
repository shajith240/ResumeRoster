"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AuthButton from "./AuthButton";

const navLinks = [
  { href: "/feed", label: "Home", icon: "H" },
  { href: "/feed?sort=new", label: "New", icon: "N" },
  { href: "/feed?sort=top", label: "Top Roasted", icon: "T" },
  { href: "/leaderboard", label: "Leaderboard", icon: "L" },
];

export default function RouteHeader() {
  const pathname = usePathname();

  return (
    <>
      <header className="app-header">
        <Link href="/feed" className="app-logo" aria-label="ResumeRoster home">
          <span className="brand-flame" aria-hidden="true" />
          ResumeRoster
        </Link>

        <label className="app-search">
          <span className="sr-only">Search</span>
          <input placeholder="Search resumes, roles, colleges..." type="search" />
        </label>

        <AuthButton />
      </header>

      <nav className="secondary-nav" aria-label="ResumeRoster sections">
        <div className="secondary-nav-inner">
          {navLinks.map((link) => {
            const isActive = link.href === pathname;

            return (
              <Link className={isActive ? "active" : ""} href={link.href} key={link.label}>
                {link.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <nav className="bottom-nav" aria-label="Mobile navigation">
        {navLinks.map((link) => (
          <Link className={pathname === link.href ? "active" : ""} href={link.href} key={link.label}>
            <span>{link.icon}</span>
            {link.label === "Top Roasted" ? "Top" : link.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
