"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import type { PublicProfile, PublicProfileRoast } from "@/lib/supabase/types";

type ProfileDetailProps = {
  profileId: string;
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export default function ProfileDetail({ profileId }: ProfileDetailProps) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [roasts, setRoasts] = useState<PublicProfileRoast[]>([]);
  const [username, setUsername] = useState("");
  const [college, setCollege] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  const isOwnProfile = user?.id === profileId;

  useEffect(() => {
    async function loadProfile() {
      if (!isUuid(profileId)) {
        setMessage("Open a real roaster profile from the leaderboard.");
        setLoading(false);
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      setUser(userData.user);

      const [profileResult, roastsResult] = await Promise.all([
        supabase.rpc("get_public_profile", { profile_id: profileId }),
        supabase.rpc("get_public_profile_roasts", {
          profile_id: profileId,
          limit_count: 12,
        }),
      ]);

      if (profileResult.error) {
        setMessage("Run supabase/profile.sql once in Supabase, then refresh this page.");
      } else {
        const loadedProfile = profileResult.data?.[0] ?? null;
        setProfile(loadedProfile);
        setUsername(loadedProfile?.username ?? "");
        setCollege(loadedProfile?.college ?? "");
        setTargetRole(loadedProfile?.target_role ?? "");
      }

      if (!roastsResult.error) {
        setRoasts(roastsResult.data ?? []);
      }

      setLoading(false);
    }

    void loadProfile();
  }, [profileId]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveMessage("");

    if (!user || !isOwnProfile) {
      setSaveMessage("You can only edit your own profile.");
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        username: username.trim() || null,
        college: college.trim() || null,
        target_role: targetRole.trim() || null,
      })
      .eq("id", user.id);

    setSaving(false);

    if (error) {
      setSaveMessage(error.message);
      return;
    }

    setProfile((current) =>
      current
        ? {
            ...current,
            username: username.trim() || null,
            college: college.trim() || null,
            target_role: targetRole.trim() || null,
          }
        : current,
    );
    setSaveMessage("Profile updated.");
  }

  if (loading) {
    return <p className="muted-text">Loading roaster profile...</p>;
  }

  if (message) {
    return (
      <div className="empty-state">
        <h2>Profile unavailable</h2>
        <p>{message}</p>
        <Link className="app-button" href="/leaderboard">
          View leaderboard
        </Link>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="empty-state">
        <h2>Profile not found</h2>
        <p>This roaster does not have public reputation yet.</p>
        <Link className="app-button" href="/leaderboard">
          View leaderboard
        </Link>
      </div>
    );
  }

  return (
    <section className="profile-layout">
      <aside className="profile-card">
        <span className="resume-status">Roaster profile</span>
        <h1>{profile.username || "Anonymous roaster"}</h1>
        <p>
          {[profile.target_role, profile.college].filter(Boolean).join(" - ") ||
            "Community reviewer"}
        </p>

        <div className="profile-stats">
          <div>
            <strong>{profile.helpful_votes}</strong>
            <span>Helpful votes</span>
          </div>
          <div>
            <strong>{profile.roast_count}</strong>
            <span>Roasts written</span>
          </div>
        </div>

        {isOwnProfile ? (
          <form className="profile-edit-form" onSubmit={saveProfile}>
            <label>
              Username
              <input
                value={username}
                maxLength={32}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="resumecritic"
              />
            </label>
            <label>
              College
              <input
                value={college}
                maxLength={80}
                onChange={(event) => setCollege(event.target.value)}
                placeholder="Your college"
              />
            </label>
            <label>
              Target role
              <input
                value={targetRole}
                maxLength={80}
                onChange={(event) => setTargetRole(event.target.value)}
                placeholder="SDE intern"
              />
            </label>
            <button className="app-button" disabled={saving}>
              {saving ? "Saving..." : "Save profile"}
            </button>
            {saveMessage ? <p className="form-message">{saveMessage}</p> : null}
          </form>
        ) : null}
      </aside>

      <div className="profile-activity">
        <div className="leaderboard-panel-header">
          <span>Recent roasts</span>
          <p>Feedback this roaster has contributed</p>
        </div>

        <div className="profile-roast-list">
          {roasts.map((roast) => (
            <Link className="profile-roast-card" href={`/resume/${roast.resume_id}`} key={roast.id}>
              <div>
                <span className={`resume-status ${roast.resume_status === "closed" ? "closed" : ""}`}>
                  {roast.resume_status === "closed" ? "Closed roast" : "Open roast"}
                </span>
                <h2>{roast.resume_title}</h2>
              </div>
              <p>{roast.content}</p>
              <strong>{roast.helpful_votes} helpful</strong>
            </Link>
          ))}
          {!roasts.length ? (
            <p className="muted-text">No public roasts from this profile yet.</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
