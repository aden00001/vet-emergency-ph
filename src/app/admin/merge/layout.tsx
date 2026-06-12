import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Merge clinic data",
  robots: { index: false, follow: false },
};

export default function MergeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
