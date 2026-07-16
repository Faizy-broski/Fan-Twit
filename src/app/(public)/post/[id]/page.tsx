import type { Metadata } from "next";

import { PostDetail } from "./post-detail";

type PostPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export const metadata: Metadata = {
  title: "Post — FanSport",
  description: "View a FanSport post and its replies.",
};

export default async function PostPage({
  params,
}: PostPageProps) {
  const { id } = await params;

  return <PostDetail postId={decodeURIComponent(id)} />;
}