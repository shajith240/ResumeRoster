"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";

function cleanFileName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/-+/g, "-");
}

export default function SubmitResumeForm() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!user) {
      setMessage("Your session expired. Sign in again from the landing page.");
      return;
    }

    if (!file || file.type !== "application/pdf") {
      setMessage("Upload a PDF resume for the MVP.");
      return;
    }

    setSubmitting(true);

    const filePath = `${user.id}/${Date.now()}-${cleanFileName(file.name)}`;
    const upload = await supabase.storage.from("resumes").upload(filePath, file, {
      contentType: "application/pdf",
      upsert: false,
    });

    if (upload.error) {
      setSubmitting(false);
      setMessage(upload.error.message);
      return;
    }

    const insert = await supabase
      .from("resumes")
      .insert({
        user_id: user.id,
        title: title.trim(),
        file_path: filePath,
        is_anonymous: isAnonymous,
      })
      .select("id")
      .single();

    setSubmitting(false);

    if (insert.error) {
      setMessage(insert.error.message);
      return;
    }

    router.push(`/resume/${insert.data.id}`);
  }

  return (
    <form className="app-form" onSubmit={handleSubmit}>
      <label>
        Resume title
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          maxLength={120}
          placeholder="Fresh grad applying for SDE roles"
        />
      </label>

      <label>
        Resume PDF
        <input
          accept="application/pdf"
          required
          type="file"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
      </label>

      <label className="checkbox-line">
        <input
          checked={isAnonymous}
          type="checkbox"
          onChange={(event) => setIsAnonymous(event.target.checked)}
        />
        Post anonymously
      </label>

      <button className="app-button" disabled={submitting || !title.trim()}>
        {submitting ? "Uploading..." : "Submit for roasting"}
      </button>

      {message ? <p className="form-message">{message}</p> : null}
    </form>
  );
}
