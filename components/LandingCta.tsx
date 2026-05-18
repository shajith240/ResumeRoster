"use client";

import Link from "next/link";
import { signInWithGoogle } from "@/lib/supabase/client";

type LandingCtaProps = {
  children: React.ReactNode;
  className: string;
  href: string;
  isSignedIn: boolean;
};

export default function LandingCta({
  children,
  className,
  href,
  isSignedIn,
}: LandingCtaProps) {
  if (isSignedIn) {
    return (
      <Link className={className} href={href}>
        {children}
      </Link>
    );
  }

  return (
    <button className={className} type="button" onClick={() => void signInWithGoogle(href)}>
      {children}
    </button>
  );
}
