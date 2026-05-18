"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { signInWithGoogle, supabase } from "@/lib/supabase/client";
import type { ResumeSummary, Roast } from "@/lib/supabase/types";

type ResumeDetailProps = {
  resumeId: string;
};

export default function ResumeDetail({ resumeId }: ResumeDetailProps) {
  const router = useRouter();
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

      setLoading(false);
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
    return <p className="muted-text">Loading resume thread...</p>;
  }

  if (!resume) {
    return <p className="form-message">{message || "Resume not found."}</p>;
  }

  return (
    <section className="detail-layout">
      <div className="resume-viewer">
        <div className="thread-post-shell">
          <div className="vote-rail" aria-hidden="true">
            <span>▲</span>
            <strong>{resume.roast_count}</strong>
            <span>▼</span>
          </div>
          <div className="post-content">
            <div className="post-meta">
              <span>r/resumeroast</span>
              <span>posted anonymously</span>
              <time dateTime={resume.created_at}>
                {new Intl.DateTimeFormat("en", {
                  month: "short",
                  day: "numeric",
                }).format(new Date(resume.created_at))}
              </time>
            </div>
            <span className={`resume-status ${isClosed ? "closed" : ""}`}>
              {isClosed ? "Closed roast" : "Anonymous resume"}
            </span>
            <h1>{resume.title}</h1>
          </div>
        </div>

        {isOwner ? (
          <div className="owner-actions">
            <button
              className="app-button ghost"
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
          <iframe title={resume.title} src={signedUrl} />
        ) : user ? (
          <div className="locked-file">
            <p>
              {signedUrlError
                ? "We could not open this private resume file yet. If this is a different account, update the Supabase Storage read policy and retry."
                : "Opening the private resume PDF for your signed-in account."}
            </p>
            <button className="app-button" onClick={() => void openResumeFile()}>
              Retry opening PDF
            </button>
            {signedUrlError ? <p className="form-message">{signedUrlError}</p> : null}
          </div>
        ) : (
          <div className="locked-file">
            <p>Sign in to open the private resume PDF.</p>
            <button className="app-button" onClick={() => void signInWithGoogle()}>
              Sign in with Google
            </button>
          </div>
        )}
      </div>

      <aside className="roast-panel">
        <div className="comment-sortbar">
          <span>Best roasts</span>
          <span>{roasts.length} comments</span>
        </div>
        {isClosed || isOwner ? (
          <div className="closed-note">
            <h2>{isOwner ? "Owner view" : "Roasts closed"}</h2>
            <p>
              {isOwner
                ? "You can read feedback here, but the owner cannot roast or vote on this thread."
                : "This thread is visible for learning, but no new roasts can be added."}
            </p>
            {message ? <p className="form-message">{message}</p> : null}
          </div>
        ) : (
          <form className="roast-form" onSubmit={handleRoastSubmit}>
            <label>
              Leave a roast
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="Be specific. What should they cut, rewrite, reorder, or prove better?"
                rows={7}
              />
            </label>
            <button className="app-button" disabled={submitting}>
              {submitting ? "Posting..." : user ? "Post roast" : "Sign in to roast"}
            </button>
            {message ? <p className="form-message">{message}</p> : null}
          </form>
        )}

        <div className="roast-list">
          {sortedRoasts.map((roast) => (
            <article className="comment-card" key={roast.id}>
              <div className="comment-line" aria-hidden="true" />
              <div className="comment-body">
                <div className="post-meta">
                  <span>anonymous roaster</span>
                  <time dateTime={roast.created_at}>
                    {new Intl.DateTimeFormat("en", {
                      month: "short",
                      day: "numeric",
                    }).format(new Date(roast.created_at))}
                  </time>
                </div>
                <p>{roast.content}</p>
                <div className="comment-actions">
                  <button
                    className="helpful-button"
                    disabled={votedRoastIds.has(roast.id) || roast.author_id === user?.id || isOwner}
                    onClick={() => void voteHelpful(roast)}
                  >
                    ▲ Helpful - {roast.helpful_votes}
                  </button>
                  <span>Reply later</span>
                </div>
              </div>
            </article>
          ))}
          {!sortedRoasts.length ? (
            <p className="muted-text">No roasts yet. First useful feedback wins the room.</p>
          ) : null}
        </div>
      </aside>
    </section>
  );
}
