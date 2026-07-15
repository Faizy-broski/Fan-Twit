"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const AVATAR_MAX_SIZE = 2 * 1024 * 1024;
const COVER_MAX_SIZE = 5 * 1024 * 1024;

export default function MePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [favTeam, setFavTeam] = useState("");
  const [username, setUsername] = useState("");

  const [profileLoading, setProfileLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/auth");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const currentUser = user;
    let cancelled = false;

    async function loadProfile() {
      setProfileLoading(true);

      const { data, error } = await supabase
        .from("profiles")
        .select(
          `
            username,
            display_name,
            bio,
            avatar_url,
            cover_url,
            favorite_team
          `,
        )
        .eq("id", currentUser.id)
        .maybeSingle();

      if (cancelled) {
        return;
      }

      if (error) {
        toast.error(error.message);
        setProfileLoading(false);
        return;
      }

      if (data) {
        setUsername(data.username ?? "");
        setDisplayName(data.display_name ?? "");
        setBio(data.bio ?? "");
        setAvatarUrl(data.avatar_url ?? "");
        setCoverUrl(data.cover_url ?? "");
        setFavTeam(data.favorite_team ?? "");
      }

      setProfileLoading(false);
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [user]);

  async function uploadImage({
    file,
    bucket,
    column,
    maxSize,
    setUploading,
    setUrl,
    successMessage,
  }: {
    file: File;
    bucket: "avatars" | "covers";
    column: "avatar_url" | "cover_url";
    maxSize: number;
    setUploading: (value: boolean) => void;
    setUrl: (value: string) => void;
    successMessage: string;
  }) {
    if (!user) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }

    if (file.size > maxSize) {
      toast.error(
        `Image must be under ${Math.round(maxSize / 1024 / 1024)} MB.`,
      );
      return;
    }

    setUploading(true);

    try {
      const extension =
        file.name.split(".").pop()?.toLowerCase() || "jpg";

      const filePath = `${user.id}/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          upsert: false,
          contentType: file.type,
          cacheControl: "3600",
        });

      if (uploadError) {
        throw uploadError;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from(bucket).getPublicUrl(filePath);

      // Persist immediately — don't leave the uploaded file's URL sitting
      // only in local state until the user separately hits "Save profile".
      const update =
        column === "avatar_url"
          ? { avatar_url: publicUrl }
          : { cover_url: publicUrl };

      const { error: updateError } = await supabase
        .from("profiles")
        .update(update)
        .eq("id", user.id);

      if (updateError) {
        throw updateError;
      }

      setUrl(publicUrl);
      toast.success(successMessage);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Upload failed.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleAvatarChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    await uploadImage({
      file,
      bucket: "avatars",
      column: "avatar_url",
      maxSize: AVATAR_MAX_SIZE,
      setUploading: setUploadingAvatar,
      setUrl: setAvatarUrl,
      successMessage: "Profile photo updated.",
    });
  }

  async function handleCoverChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    await uploadImage({
      file,
      bucket: "covers",
      column: "cover_url",
      maxSize: COVER_MAX_SIZE,
      setUploading: setUploadingCover,
      setUrl: setCoverUrl,
      successMessage: "Cover photo updated.",
    });
  }

  async function handleSave() {
    if (!user || saving) {
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: displayName.trim() || null,
          bio: bio.trim() || null,
          avatar_url: avatarUrl.trim() || null,
          cover_url: coverUrl.trim() || null,
          favorite_team: favTeam.trim().toUpperCase() || null,
        })
        .eq("id", user.id);

      if (error) {
        throw error;
      }

      toast.success("Profile saved.");

      router.push(`/user/${encodeURIComponent(username)}`);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save profile.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || profileLoading || !user) {
    return (
      <AppShell>
        <main className="mx-auto max-w-md space-y-3 px-4 py-6">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-32 w-full" />
          <div className="flex items-center gap-4 pt-2">
            <Skeleton className="size-20 shrink-0 rounded-full" />
            <Skeleton className="h-9 w-32 rounded-full" />
          </div>
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-20 w-full" />
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-md space-y-3 px-4 py-6">
        <div>
          <h1 className="text-xl font-black tracking-tight">
            Edit profile
          </h1>

          <p className="text-xs text-muted-foreground">
            @{username}
          </p>
        </div>

        <div className="pt-2">
          <label className="mb-1 block text-xs font-semibold text-muted-foreground">
            Cover image
          </label>

          <div className="relative h-32 w-full overflow-hidden rounded-xl border border-border bg-gradient-to-br from-primary/20 to-accent/40">
            {coverUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverUrl}
                alt="Profile cover"
                className="size-full object-cover"
              />
            )}

            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleCoverChange}
            />

            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              disabled={uploadingCover}
              className="absolute bottom-2 right-2 rounded-full bg-background/90 px-3 py-1 text-xs font-semibold shadow transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploadingCover
                ? "Uploading…"
                : coverUrl
                  ? "Change cover"
                  : "Add cover"}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4 pt-2">
          <div className="size-20 shrink-0 overflow-hidden rounded-full border border-border bg-gradient-to-br from-primary to-accent-foreground">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt="Profile avatar"
                className="size-full object-cover"
              />
            ) : (
              <div className="flex size-full items-center justify-center text-2xl font-bold text-primary-foreground">
                {(displayName || username || "?").slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>

          <div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />

            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploadingAvatar
                ? "Uploading…"
                : "Upload photo"}
            </button>

            <p className="mt-1 text-xs text-muted-foreground">
              JPG, PNG or WebP, up to 2 MB.
            </p>
          </div>
        </div>

        <label
          htmlFor="display-name"
          className="block text-xs font-semibold text-muted-foreground"
        >
          Display name
        </label>

        <input
          id="display-name"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          maxLength={40}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />

        <label
          htmlFor="avatar-url"
          className="block text-xs font-semibold text-muted-foreground"
        >
          Or paste an avatar URL
        </label>

        <input
          id="avatar-url"
          type="url"
          value={avatarUrl}
          onChange={(event) => setAvatarUrl(event.target.value)}
          placeholder="https://…"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />

        <label
          htmlFor="bio"
          className="block text-xs font-semibold text-muted-foreground"
        >
          Bio
        </label>

        <textarea
          id="bio"
          value={bio}
          onChange={(event) => setBio(event.target.value)}
          rows={3}
          maxLength={200}
          className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />

        <div className="text-right text-xs text-muted-foreground">
          {bio.length}/200
        </div>

        <label
          htmlFor="favorite-team"
          className="block text-xs font-semibold text-muted-foreground"
        >
          Favorite team symbol, for example ARS
        </label>

        <input
          id="favorite-team"
          value={favTeam}
          onChange={(event) =>
            setFavTeam(
              event.target.value
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, ""),
            )
          }
          maxLength={6}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm uppercase outline-none focus:ring-2 focus:ring-ring"
        />

        <button
          type="button"
          onClick={handleSave}
          disabled={
            saving || uploadingAvatar || uploadingCover
          }
          className="mt-2 w-full rounded-full bg-primary py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save profile"}
        </button>
      </main>
    </AppShell>
  );
}