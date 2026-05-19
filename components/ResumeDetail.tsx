"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { useToast } from "@/components/ToastProvider";
import { signInWithGoogle, supabase } from "@/lib/supabase/client";
import type { ResumeSummary, Roast } from "@/lib/supabase/types";

type ResumeDetailProps = {
  resumeId: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export default function ResumeDetail({ resumeId }: ResumeDetailProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [resume, setResume] = useState<ResumeSummary | null>(null);
  const [roasts, setRoasts] = useState<Roast[]>([]);
  const [votedRoastIds, setVotedRoastIds] = useState<Set<string>>(new Set());
  const [signedUrl, setSignedUrl] = useState("");
  const [signedUrlError, setSignedUrlError] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const sortedRoasts = useMemo(
    () => [...roasts].sort((a, b) => b.helpful_votes - a.helpful_votes),
    [roasts],
  );
  const isOwner = Boolean(user && resume?.user_id === user.id);
  const isClosed = resume?.status === "closed";

  async function openResumeFile(activeResume = resume) {
    setSignedUrlError("");

    const { data: userData } = await supabase.auth.getUser();
    const activeUser = userData.user;
    setUser(activeUser);

    if (!activeUser || !activeResume) {
      return;
    }

    const signed = await supabase.storage
      .from("resumes")
      .createSignedUrl(activeResume.file_path, 60 * 20);

    if (signed.error) {
      setSignedUrl("");
      setSignedUrlError(signed.error.message);
      return;
    }

    setSignedUrl(signed.data.signedUrl);
  }

  useEffect(() => {
    async function load() {
      const started = Date.now();
      const { data: userData } = await supabase.auth.getUser();
      const activeUser = userData.user;
      setUser(activeUser);

      const resumeResult = await supabase
        .from("resumes")
        .select("id,user_id,title,file_path,is_anonymous,status,roast_count,created_at")
        .eq("id", resumeId)
        .single();

      if (resumeResult.error) {
        setMessage(resumeResult.error.message);
        setLoading(false);
        return;
      }

      setResume(resumeResult.data);

      if (activeUser) {
        await openResumeFile(resumeResult.data);
      }

      const roastResult = await supabase
        .from("roasts")
        .select("id,resume_id,author_id,content,helpful_votes,created_at")
        .eq("resume_id", resumeId)
        .order("created_at", { ascending: false });

      if (!roastResult.error) {
        setRoasts(roastResult.data ?? []);

        const roastIds = roastResult.data?.map((roast) => roast.id) ?? [];
        if (activeUser && roastIds.length) {
          const voteResult = await supabase
            .from("votes")
            .select("roast_id")
            .eq("voter_id", activeUser.id)
            .in("roast_id", roastIds);

          if (!voteResult.error) {
            setVotedRoastIds(new Set(voteResult.data.map((vote) => vote.roast_id)));
          }
        }
      }

      const elapsed = Date.now() - started;
      window.setTimeout(() => setLoading(false), Math.max(0, 300 - elapsed));
    }

    void load();
  }, [resumeId]);

  async function handleRoastSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!user) {
      await signInWithGoogle();
      return;
    }

    if (isOwner) {
      setMessage("You cannot roast your own resume. Let the community cook.");
      return;
    }

    if (isClosed) {
      setMessage("This resume is closed for new roasts.");
      return;
    }

    const roastContent = content.trim();
    if (roastContent.length < 10) {
      setMessage("Give at least 10 characters of useful feedback.");
      return;
    }

    setSubmitting(true);

    const { data, error } = await supabase
      .from("roasts")
      .insert({
        resume_id: resumeId,
        author_id: user.id,
        content: roastContent,
      })
      .select("id,resume_id,author_id,content,helpful_votes,created_at")
      .single();

    setSubmitting(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setRoasts((current) => [data, ...current]);
    setResume((current) =>
      current ? { ...current, roast_count: current.roast_count + 1 } : current,
    );
    setContent("");
    showToast("Roast submitted.");
  }

  async function voteHelpful(targetRoast: Roast) {
    setMessage("");

    if (!user) {
      await signInWithGoogle();
      return;
    }

    if (targetRoast.author_id === user.id) {
      setMessage("You cannot mark your own roast as helpful.");
      return;
    }

    if (isOwner) {
      setMessage("Resume owners cannot vote on roasts for their own resume.");
      return;
    }

    if (votedRoastIds.has(targetRoast.id)) {
      setMessage("You already marked that roast as helpful.");
      return;
    }

    const { error } = await supabase.from("votes").insert({
      roast_id: targetRoast.id,
      voter_id: user.id,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setVotedRoastIds((current) => new Set(current).add(targetRoast.id));
    setRoasts((current) =>
      current.map((roast) =>
        roast.id === targetRoast.id
          ? { ...roast, helpful_votes: roast.helpful_votes + 1 }
          : roast,
      ),
    );
    showToast("Vote registered.");
  }

  async function closeResume() {
    setMessage("");

    if (!resume || !isOwner) {
      setMessage("Only the resume owner can close this thread.");
      return;
    }

    const { error } = await supabase
      .from("resumes")
      .update({ status: "closed" })
      .eq("id", resume.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setResume({ ...resume, status: "closed" });
    setMessage("This resume is now closed for new roasts.");
  }

  async function deleteResume() {
    setMessage("");

    if (!resume || !isOwner) {
      setMessage("Only the resume owner can delete this submission.");
      return;
    }

    const removeFile = await supabase.storage.from("resumes").remove([resume.file_path]);
    if (removeFile.error) {
      setMessage(removeFile.error.message);
      return;
    }

    const { error } = await supabase.from("resumes").delete().eq("id", resume.id);
    if (error) {
      setMessage(error.message);
      return;
    }

    router.push("/feed");
  }

  if (loading) {
    return (
      <section className="resume-thread">
        <div className="thread-viewer-card">
          <span className="skeleton skeleton-line title" />
          <span className="skeleton skeleton-line copy" />
          <span className="skeleton skeleton-line actions" />
        </div>
      </section>
    );
  }

  if (!resume) {
    return <p className="form-message">{message || "Resume not found."}</p>;
  }

  return (
    <section className="resume-thread">
      <article className="thread-viewer-card">
        <header className="thread-header">
          <div className="post-meta">
            <span>posted anonymously</span>
            <time dateTime={resume.created_at}>{formatDate(resume.created_at)}</time>
          </div>
          <span className={`badge ${isClosed ? "badge-closed" : "badge-open"}`}>
            {isClosed ? "Closed" : "Open for roasting"}
          </span>
        </header>

        <h1>{resume.title}</h1>
        <div className="post-tags">
          <span className="badge role-badge">Resume thread</span>
          <span className="badge neutral-badge">Anonymous upload</span>
        </div>

        {isOwner ? (
          <div className="owner-actions">
            <button
              className="btn-primary btn-ghost"
              disabled={isClosed}
              onClick={() => void closeResume()}
            >
              {isClosed ? "Closed" : "Close roasts"}
            </button>
            <button className="danger-button" onClick={() => void deleteResume()}>
              Delete submission
            </button>
          </div>
        ) : null}

        {signedUrl ? (
          <iframe className="resume-pdf-frame" title={resume.title} src={signedUrl} />
        ) : user ? (
          <div className="locked-file">
            <p>
              {signedUrlError
                ? "We could not open this private resume file yet. If this is a different account, update the Supabase Storage read policy and retry."
                : "Opening the private resume PDF for your signed-in account."}
            </p>
            <button className="btn-primary" onClick={() => void openResumeFile()}>
              Retry opening PDF
            </button>
            {signedUrlError ? <p className="form-message">{signedUrlError}</p> : null}
          </div>
        ) : (
          <div className="locked-file">
            <p>Sign in to open the private resume PDF.</p>
            <button className="btn-primary" onClick={() => void signInWithGoogle()}>
              Sign in with Google
            </button>
          </div>
        )}
      </article>

      {isClosed || isOwner ? (
        <div className="closed-note">
          <h2>{isOwner ? "Owner view" : "Roasts closed"}</h2>
          <p>
            {isOwner
              ? "You own this resume, so you can read feedback here but cannot mark roasts helpful."
              : "This thread is visible for learning, but no new roasts can be added."}
          </p>
          {message ? <p className="form-message">{message}</p> : null}
        </div>
      ) : (
        <form className="roast-form thread-roast-form" onSubmit={handleRoastSubmit}>
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Be specific. What should they rewrite, reorder, quantify, or remove?"
            rows={7}
          />
          <div className="roast-form-footer">
            <span>Roast the resume, not the person</span>
            <button className="btn-primary btn-brand" disabled={submitting}>
              {submitting ? "Posting..." : user ? "Submit roast" : "Sign in to roast"}
            </button>
          </div>
          {message ? <p className="form-message">{message}</p> : null}
        </form>
      )}

      <div className="thread-list-header">
        <h2>Roast thread</h2>
        <span>{roasts.length} comments</span>
      </div>

      <div className="roast-list">
        {sortedRoasts.map((roast, index) => {
          const voted = votedRoastIds.has(roast.id);

          return (
            <article className="thread-roast" style={{ animationDelay: `${index * 40}ms` }} key={roast.id}>
              <div className="vote-strip compact">
                <button
                  className={voted ? "voted" : ""}
                  disabled={voted}
                  onClick={() => void voteHelpful(roast)}
                  type="button"
                  aria-label="Mark roast helpful"
                >
                  ▲
                </button>
                <strong className={voted ? "voted bump" : ""}>{roast.helpful_votes}</strong>
                <button type="button" aria-label="Downvote roast">▼</button>
              </div>

              <div className="thread-roast-body">
                <header>
                  <span className="mini-avatar">A</span>
                  <a href={`/profile/${roast.author_id}`}>anonymous roaster</a>
                  <time dateTime={roast.created_at}>· {formatDate(roast.created_at)}</time>
                  {roast.helpful_votes > 5 ? <span className="badge badge-open">Verified helpful</span> : null}
                </header>
                <p>{roast.content}</p>
                <footer>
                  <button type="button">Reply</button>
                  <button type="button">Report</button>
                </footer>
              </div>
            </article>
          );
        })}
        {!sortedRoasts.length ? (
          <p className="muted-text">No roasts yet. First useful feedback wins the room.</p>
        ) : null}
      </div>
    </section>
  );
}
