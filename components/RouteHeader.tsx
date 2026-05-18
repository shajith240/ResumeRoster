import Link from "next/link";
import AuthButton from "./AuthButton";

export default function RouteHeader() {
  return (
    <header className="app-header">
      <Link href="/" className="app-logo">
        ResumeRoster
      </Link>
      <nav className="app-nav" aria-label="App routes">
        <Link href="/feed">Feed</Link>
        <Link href="/submit">Submit</Link>
        <Link href="/leaderboard">Leaderboard</Link>
        <Link href="/profile/me">My profile</Link>
      </nav>
      <AuthButton />
    </header>
  );
}
