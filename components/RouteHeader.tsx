import Link from "next/link";
import AuthButton from "./AuthButton";

export default function RouteHeader() {
  return (
    <header className="app-header">
      <Link href="/feed" className="app-logo">
        ResumeRoster
      </Link>
      <div className="app-header-spacer" aria-hidden="true" />
      <AuthButton />
    </header>
  );
}
