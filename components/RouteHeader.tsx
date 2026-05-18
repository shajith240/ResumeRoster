import Link from "next/link";
import AuthButton from "./AuthButton";

export default function RouteHeader() {
  return (
    <header className="app-header">
      <Link href="/feed" className="app-logo">
        ResumeRoster
      </Link>
      <nav className="app-nav" aria-label="App routes">
        <Link href="/feed">Feed</Link>
        <Link href="/submit">Submit</Link>
        <Link href="/leaderboard">Leaderboard</Link>
      </nav>
      <AuthButton />
    </header>
  );
}
