"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import LandingCta from "@/components/LandingCta";
import LoadingScreen from "@/components/LoadingScreen";
import { supabase } from "@/lib/supabase/client";

type FeatureKey = "ats" | "jd" | "roast" | "skills" | "optimize";
type BenefitKey = "students" | "jobseekers" | "switchers";

const asset = (path: string) => `/assets/${path}`;

const featureContent: Record<
  FeatureKey,
  {
    theme: string;
    title: string;
    copy: string;
    score: string;
    scoreLabel: string;
    insight: string;
    panelTitle: string;
    good: string;
    warn: string;
    listTitle: string;
    points: string[];
  }
> = {
  ats: {
    theme: "ats",
    title: "Anonymous Resume Lint",
    copy:
      "Post a resume without exposing personal details and let reviewers catch the bugs recruiters will reject.",
    score: "42",
    scoreLabel: "lint passes",
    insight: "New resume failed the clarity check",
    panelTitle: "Career Lint Report",
    good: "Identity hidden",
    warn: "Impact bug found",
    listTitle: "Static checks",
    points: [
      "Hide personal details before the resume goes public.",
      "Flag vague bullets, weak proof, and recruiter red flags.",
      "Keep the best fixes attached to each resume version.",
    ],
  },
  jd: {
    theme: "jd",
    title: "Human Reviewers, Compiler Mindset",
    copy:
      "Recruiters behave like strict compilers. Linted lets peers, recruiters, and engineers catch errors before the first screen.",
    score: "18",
    scoreLabel: "helpful votes",
    insight: "Top check points out a missing project outcome",
    panelTitle: "Best Fix",
    good: "Specific fix suggested",
    warn: "Generic summary called out",
    listTitle: "Why it helps",
    points: [
      "Feedback is public, so weak advice gets ignored fast.",
      "Helpful feedback rises through votes instead of authority.",
      "Real applicants explain what worked for them.",
    ],
  },
  roast: {
    theme: "roast",
    title: "Vote the Sharpest Fixes",
    copy:
      "Every comment can be voted helpful, so the sharpest fixes rise above noise, jokes, and lazy one-liners.",
    score: "7",
    scoreLabel: "top fixes",
    insight: "Most-voted comment explains exactly what to rewrite",
    panelTitle: "Fix Ranking",
    good: "Actionable comment",
    warn: "Low-effort take buried",
    listTitle: "Voting rules",
    points: [
      "Upvote feedback that names the problem and gives a fix.",
      "Feature comments that improve the resume, not just insult it.",
      "Let the community decide which feedback deserves attention.",
    ],
  },
  skills: {
    theme: "skills",
    title: "Reviewer Reputation",
    copy:
      "People who consistently give useful lint passes build visible reputation and become trusted resume reviewers.",
    score: "#12",
    scoreLabel: "reviewer rank",
    insight: "Placement mentor earned 31 helpful votes this week",
    panelTitle: "Reviewer Profile",
    good: "Hired-at proof visible",
    warn: "Unhelpful comments lose reach",
    listTitle: "Reputation signals",
    points: [
      "Reward people whose feedback gets marked helpful.",
      "Show reviewer roles, expertise, and strong feedback history.",
      "Turn good reviewers into the reason people return.",
    ],
  },
  optimize: {
    theme: "optimize",
    title: "Career Lint Score",
    copy:
      "Before-and-after resumes show who cleaned up the most career bugs this week, making progress visible and easy to follow.",
    score: "+64%",
    scoreLabel: "improvement",
    insight: "Resume climbed after 9 community fixes",
    panelTitle: "Most Improved",
    good: "Before and after visible",
    warn: "Still needs stronger metrics",
    listTitle: "Leaderboard logic",
    points: [
      "Track resume versions after public feedback.",
      "Highlight the biggest week-over-week improvements.",
      "Make great transformations shareable.",
    ],
  },
};

const featureTabs: Array<{ key: FeatureKey; label: string }> = [
  { key: "ats", label: "Resume Lint" },
  { key: "jd", label: "Reviewer Checks" },
  { key: "roast", label: "Useful Fixes" },
  { key: "skills", label: "Reviewer Trust" },
  { key: "optimize", label: "Improvement" },
];

const tagAssets = [
  ["campus placement tag.png", "Campus Placements"],
  ["internship application tag.png", "Internship Applications"],
  ["firstjob hunt tag.png", "First Job Hunt"],
  ["career Switches tag.png", "Career Switches"],
  ["ats updates tag.png", "ATS Uploads"],
  ["jd matching tag.png", "JD Matching"],
  ["recruter screenig tag.png", "Recruiter Screening"],
  ["linkedin easy apply tag.png", "LinkedIn Easy Apply"],
];

const benefitImages: Record<BenefitKey, { src: string; alt: string }> = {
  students: {
    src: asset("students.png"),
    alt: "Student public resume feedback illustration",
  },
  jobseekers: {
    src: asset("job_seekers.png"),
    alt: "Job seeker community resume feedback illustration",
  },
  switchers: {
    src: asset("job_seekers.png"),
    alt: "Career switcher community resume feedback illustration",
  },
};

const benefits: Array<{ key: BenefitKey; label: string; copy: string }> = [
  {
    key: "students",
    label: "For students",
    copy: "Run your resume through the crowd before placement season treats it like a compile step.",
  },
  {
    key: "jobseekers",
    label: "For job seekers",
    copy: "Catch unclear proof, weak metrics, and JD mismatch before recruiter screens.",
  },
  {
    key: "switchers",
    label: "For career switchers",
    copy: "Make your career story parse cleanly before a stranger has to infer it.",
  },
];

const stackCards = [
  {
    className: "notes-card",
    image: "Resume_upload.png",
    title: "Upload the Source",
    copy: "Remove personal details when needed and post your resume to the public lint feed.",
  },
  {
    className: "chat-card",
    image: "JD match.png",
    title: "Run the Lint Pass",
    copy: "Your resume appears beside other submissions waiting for precise feedback.",
  },
  {
    className: "recorder-card",
    image: "Recruter_roast.png",
    title: "Catch Recruiter Errors",
    copy: "Reviewers call out weak, generic, or confusing parts before they reach the first screen.",
  },
  {
    className: "tutorials-card",
    image: "fix_plan.png",
    title: "Apply Useful Fixes",
    copy: "The strongest comments rise through votes so you know which fixes matter.",
  },
  {
    className: "tools-card",
    image: "ats.png",
    title: "Build Reviewer Trust",
    copy: "Improved resumes and trusted reviewers get featured every week.",
  },
];

function isSmallScreen() {
  return typeof window.matchMedia === "function"
    ? window.matchMedia("(max-width: 760px)").matches
    : window.innerWidth <= 760;
}

export default function Home() {
  const router = useRouter();
  const [activeFeature, setActiveFeature] = useState<FeatureKey>("ats");
  const [activeBenefit, setActiveBenefit] = useState<BenefitKey>("students");
  const [navHidden, setNavHidden] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const pinSectionRef = useRef<HTMLElement | null>(null);
  const pinTrackRef = useRef<HTMLDivElement | null>(null);
  const pinHeadingRef = useRef<HTMLDivElement | null>(null);
  const lastScrollY = useRef(0);

  const feature = featureContent[activeFeature];
  const benefitImage = benefitImages[activeBenefit];

  const repeatedTags = useMemo(() => [tagAssets, tagAssets], []);
  const isSignedIn = Boolean(user);

  useEffect(() => {
    let active = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setUser(data.user);
      setAuthReady(true);
      if (data.user) {
        router.replace("/feed");
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthReady(true);
      if (session?.user) {
        router.replace("/feed");
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    function updateNavbarVisibility() {
      const currentScrollY = window.scrollY;
      const scrollingDown = currentScrollY > lastScrollY.current;
      const pastHeroStart = currentScrollY > 120;

      setNavHidden(scrollingDown && pastHeroStart);
      lastScrollY.current = currentScrollY;
    }

    updateNavbarVisibility();
    window.addEventListener("scroll", updateNavbarVisibility, { passive: true });
    return () => window.removeEventListener("scroll", updateNavbarVisibility);
  }, []);

  useEffect(() => {
    function updatePinnedFeature() {
      const pinSection = pinSectionRef.current;
      const pinTrack = pinTrackRef.current;
      const pinHeading = pinHeadingRef.current;

      if (!pinSection || !pinTrack) return;

      if (isSmallScreen()) {
        pinSection.style.removeProperty("height");
        pinTrack.style.removeProperty("--pin-y");
        if (pinHeading) {
          pinHeading.style.removeProperty("--heading-y");
          pinHeading.style.removeProperty("--heading-opacity");
        }
        return;
      }

      const viewportHeight = window.innerHeight;
      const releaseDistance = Math.max(
        pinTrack.scrollHeight - viewportHeight * 0.48,
        0,
      );
      const rect = pinSection.getBoundingClientRect();
      const scrollable = pinSection.offsetHeight - viewportHeight;
      const progress = Math.min(Math.max(-rect.top / scrollable, 0), 1);
      const headingPhase = 0.18;
      const headingProgress = Math.min(progress / headingPhase, 1);
      const contentProgress = Math.min(
        Math.max((progress - headingPhase) / (1 - headingPhase), 0),
        1,
      );
      const y = -contentProgress * releaseDistance;

      if (pinHeading) {
        pinHeading.style.setProperty("--heading-y", `${-headingProgress * 150}px`);
        pinHeading.style.setProperty(
          "--heading-opacity",
          String(1 - headingProgress),
        );
      }

      pinTrack.style.setProperty("--pin-y", `${y}px`);
    }

    updatePinnedFeature();
    window.addEventListener("scroll", updatePinnedFeature, { passive: true });
    window.addEventListener("resize", updatePinnedFeature);
    return () => {
      window.removeEventListener("scroll", updatePinnedFeature);
      window.removeEventListener("resize", updatePinnedFeature);
    };
  }, []);

  if (authReady && isSignedIn) {
    return (
      <main className="full-page-loader">
        <LoadingScreen variant="plain" />
      </main>
    );
  }

  return (
    <>
      <nav className={`navbar${navHidden ? " nav-hidden" : ""}`}>
        <div className="container nav-content">
          <Link className="landing-wordmark" href="/" aria-label="Linted home">
            Linted
          </Link>

          <div className="nav-links">
            {isSignedIn ? (
              <>
                <Link href="/feed">Feed</Link>
                <Link href="/submit">Post resume</Link>
                <Link href="/leaderboard">Leaderboard</Link>
                <Link href="/profile/me">My profile</Link>
              </>
            ) : (
              <>
                <a href="#how-it-works">How it works</a>
                <a href="#features">Features</a>
                <a href="#use-cases">Use cases</a>
                <a href="#proof">Proof</a>
              </>
            )}
          </div>

          <LandingCta className="nav-button" href={isSignedIn ? "/feed" : "/submit"} isSignedIn={isSignedIn}>
            {authReady && isSignedIn ? "Enter app" : "Post your resume"}
          </LandingCta>
        </div>
      </nav>

      <main>
        <section className="hero">
          <div className="container hero-content">
            <div className="hero-visual">
              <video
                className="hero-illustration"
                autoPlay
                muted
                loop
                playsInline
                aria-label="Linted preview"
              >
                <source src={asset("Hero_section_animation.webm")} type="video/webm" />
              </video>
            </div>

            <h1>Lint your resume before recruiters compile it</h1>

            <p className="hero-subtext">
              Post anonymously. Get reviewers to catch weak bullets and recruiter
              red flags before you apply.
            </p>

            <LandingCta className="hero-btn" href={isSignedIn ? "/feed" : "/submit"} isSignedIn={isSignedIn}>
              {authReady && isSignedIn ? "Go to lint feed" : "Lint my resume"}
            </LandingCta>
          </div>
        </section>

        <section className="trust-section" aria-label="Linted use cases">
          <div className="logos-track">
            {repeatedTags.map((group, groupIndex) => (
              <div
                className="logos-group"
                aria-hidden={groupIndex === 1 ? "true" : undefined}
                key={groupIndex}
              >
                {group.map(([filename, label]) => (
                  <img
                    src={asset(filename)}
                    alt={groupIndex === 0 ? label : ""}
                    key={`${groupIndex}-${filename}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </section>

        <section className="feature-header" id="how-it-works">
          <h2>A static analysis pass for your career</h2>

          <div
            className="feature-tabs"
            role="tablist"
            aria-label="Linted community features"
          >
            {featureTabs.map((tab) => {
              const isActive = activeFeature === tab.key;
              return (
                <button
                  className={`feature-tab${isActive ? " active" : ""}`}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  data-feature={tab.key}
                  onClick={() => setActiveFeature(tab.key)}
                  key={tab.key}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </section>

        <section
          className="feature-showcase"
          data-feature-section
          data-theme={feature.theme}
        >
          <div className="showcase-wrapper">
            <div className="showcase-info">
              <h3>{feature.title}</h3>
              <p>{feature.copy}</p>
              <Link className="showcase-link" href="/feed">Open the lint feed</Link>
            </div>

            <div className="showcase-video">
              <div className="resume-window">
                <div className="window-top">
                  <span />
                  <span />
                  <span />
                </div>
                <div className="score-strip">
                  <div>
                    <strong>{feature.score}</strong>
                    <span>{feature.scoreLabel}</span>
                  </div>
                  <p>{feature.insight}</p>
                </div>
                <div className="resume-grid">
                  <div className="resume-page">
                    <h4>{feature.panelTitle}</h4>
                    <p className="line wide" />
                    <p className="line" />
                    <p className="line short" />
                    <div className="note good">{feature.good}</div>
                    <div className="note warn">{feature.warn}</div>
                    <p className="line wide" />
                    <p className="line" />
                    <p className="line short" />
                  </div>
                  <div className="insight-panel">
                    <h4>{feature.listTitle}</h4>
                    <ul>
                      {feature.points.map((point) => (
                        <li key={point}>{point}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="sticky-feature-section" id="features" data-pin-section ref={pinSectionRef}>
          <div className="sticky-content">
            <div className="stack-doodle-layer" aria-hidden="true">
              <img className="stack-doodle doodle-trash" src={asset("trashcan_doodle.png")} alt="" />
              <img className="stack-doodle doodle-clock" src={asset("clock_doodle.png")} alt="" />
              <img className="stack-doodle doodle-rejected" src={asset("rejected_doodle.png")} alt="" />
              <img className="stack-doodle doodle-checklist" src={asset("checklist_doodle.png")} alt="" />
              <img className="stack-doodle doodle-riphope" src={asset("riphope_doodle.png")} alt="" />
              <img className="stack-doodle doodle-tryharder" src={asset("tryharder_doodle.png")} alt="" />
            </div>
            <div className="sticky-heading" ref={pinHeadingRef}>
              <h2>
                Human reviewers catch
                <br />
                what automated scans miss
              </h2>
            </div>

            <div className="feature-cards" data-pin-track ref={pinTrackRef}>
              <div className="feature-card">
                <div className="sketch-icon magnifier" />
                <h3>Post without exposing yourself</h3>
                <p>
                  Upload a redacted resume to the public feed so the work gets judged,
                  not your name, college, or phone number.
                </p>
              </div>

              <div className="feature-card">
                <div className="sketch-icon compass" />
                <h3>Catch bugs before the compiler</h3>
                <p>
                  Students, job seekers, and trusted reviewers point out vague
                  bullets, missing proof, and recruiter red flags.
                </p>
              </div>

              <div className="feature-card">
                <div className="sketch-icon flag" />
                <h3>Promote the fix, not the noise</h3>
                <p>
                  Votes push the most useful fixes upward, while trusted reviewers
                  build reputation for feedback that actually helps.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="quote-section" id="proof">
          <div className="stars">*****</div>
          <blockquote>
            &quot;The best comment read like a lint error: exact line, exact problem,
            exact fix.&quot;
          </blockquote>
          <p>Anonymous final-year student</p>
        </section>

        <section className="benefits" id="use-cases">
          <div className="benefits-copy">
            <h2>Built for career linting in public</h2>
            {benefits.map((benefit) => {
              const isActive = activeBenefit === benefit.key;
              return (
                <div
                  className={`benefit-item${isActive ? " active" : ""}`}
                  data-benefit={benefit.key}
                  key={benefit.key}
                >
                  <button
                    className="benefit-toggle"
                    type="button"
                    aria-expanded={isActive}
                    onClick={() => setActiveBenefit(benefit.key)}
                  >
                    <span>{benefit.label}</span>
                  </button>
                  <p>{benefit.copy}</p>
                </div>
              );
            })}
          </div>
          <figure className="benefit-image-card">
            <img src={benefitImage.src} alt={benefitImage.alt} />
          </figure>
        </section>

        <section className="cards-stack">
          <h2>From resume source to cleaner application</h2>
          <div className="stack-list">
            {stackCards.map((card) => (
              <article className={`stack-card ${card.className}`} key={card.title}>
                <img className="stack-art" src={asset(card.image)} alt="" aria-hidden="true" />
                <h3>{card.title}</h3>
                <p>{card.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="quote-section second-quote">
          <div className="stars">*****</div>
          <blockquote>
            &quot;My resume did not need a generic score. It needed someone to point at
            the bug and tell me the fix.&quot;
          </blockquote>
          <p>Anonymous software job seeker</p>
        </section>

        <section className="cta-banner">
          <div>
            <h2>Your resume should pass the first scan</h2>
            <p>
              Run it through Linted before the recruiter/compiler rejects it. Post
              anonymously, collect fixes, and ship a cleaner version.
            </p>
            <LandingCta className="cta-link" href="/submit" isSignedIn={isSignedIn}>Run a lint pass</LandingCta>
          </div>
          <video className="cta-video" autoPlay muted loop playsInline aria-label="Resume first scan preview">
            <source src={asset("Your resume should survive the first scan.webm")} type="video/webm" />
          </video>
        </section>
      </main>

      <Footer />
    </>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-doodles" aria-hidden="true">
        <img className="footer-doodle footer-doodle-left" src={asset("trashcan_doodle.png")} alt="" />
        <img className="footer-doodle footer-doodle-center" src={asset("riphope_doodle.png")} alt="" />
        <img className="footer-doodle footer-doodle-right" src={asset("tryharder_doodle.png")} alt="" />
      </div>
      <div className="footer-columns">
        <div className="footer-links">
          <Link href="/">Our Mission</Link>
          <Link href="/feed">Lint Feed</Link>
          <Link href="/leaderboard">Leaderboard</Link>
          <Link href="/leaderboard">Top Reviewers</Link>
          <Link href="/submit">Invite Reviewers!</Link>
        </div>
        <div className="footer-links">
          <Link href="/feed">Blog</Link>
          <Link href="/submit">Privacy Policy</Link>
          <Link href="/submit">Terms of Usage</Link>
          <Link href="/feed">Cookie Policy</Link>
          <Link href="/submit">Contact Us</Link>
        </div>
        <div className="socials" aria-label="Social links">
          <div className="social-links">
            <a href="#" aria-label="Instagram">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4c0 3.2-2.6 5.8-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8C2 4.6 4.6 2 7.8 2Zm-.2 2A3.6 3.6 0 0 0 4 7.6v8.8A3.6 3.6 0 0 0 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6A3.6 3.6 0 0 0 16.4 4H7.6Zm9.65 1.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />
              </svg>
            </a>
            <a href="#" aria-label="YouTube">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M21.6 7.2a3 3 0 0 0-2.1-2.1C17.7 4.6 12 4.6 12 4.6s-5.7 0-7.5.5a3 3 0 0 0-2.1 2.1C2 9 2 12 2 12s0 3 .4 4.8a3 3 0 0 0 2.1 2.1c1.8.5 7.5.5 7.5.5s5.7 0 7.5-.5a3 3 0 0 0 2.1-2.1c.4-1.8.4-4.8.4-4.8s0-3-.4-4.8ZM10 15.3V8.7l5.75 3.3L10 15.3Z" />
              </svg>
            </a>
            <a href="#" aria-label="X">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M13.8 10.5 21 2h-1.7l-6.2 7.3L8.1 2H2.3l7.6 11.1L2.3 22H4l6.7-7.8 5.3 7.8h5.8l-8-11.5Zm-2.4 2.8-.8-1.1L4.5 3.3h2.8l4.9 7 .8 1.1 6.4 9.2h-2.8l-5.2-7.3Z" />
              </svg>
            </a>
            <a href="#" aria-label="LinkedIn">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5.001 2.5 2.5 0 0 1 0-5ZM3 9.75h4v11H3v-11Zm6.25 0h3.82v1.5h.05c.53-1 1.84-1.72 3.78-1.72 4.04 0 4.79 2.66 4.79 6.12v5.1h-4v-4.52c0-1.08-.02-2.47-1.5-2.47-1.51 0-1.74 1.18-1.74 2.39v4.6h-4v-11Z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
      <p>&copy; 2026 Linted. All rights reserved.</p>
    </footer>
  );
}
