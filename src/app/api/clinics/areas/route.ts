import { NextResponse } from "next/server";
import { fetchAreaGroups } from "@/lib/clinic-areas";

export async function GET() {
  try {
    const groups = await fetchAreaGroups();
    return NextResponse.json({ groups, cached: true }, {
      headers: { "X-Robots-Tag": "noindex" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load areas";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: { "X-Robots-Tag": "noindex" } }
    );
  }
}
