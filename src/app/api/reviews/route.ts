import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { EXPERIENCE_TAGS } from "@/lib/reviews";
import type { ClinicReview, ReviewSummary } from "@/types/database";

const tagIds = EXPERIENCE_TAGS.map((t) => t.id) as [string, ...string[]];

const postSchema = z.object({
  clinicId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().min(20).max(2000),
  reviewerName: z.string().trim().min(1).max(40).optional(),
  experienceTags: z.array(z.enum(tagIds)).max(6).default([]),
});

const querySchema = z.object({
  clinicId: z.string().uuid(),
  limit: z.coerce.number().min(1).max(50).default(20),
});

async function getReviewSummary(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  clinicId: string
): Promise<ReviewSummary> {
  const { data } = await supabase
    .from("clinic_reviews")
    .select("rating")
    .eq("clinic_id", clinicId)
    .eq("status", "published");

  const ratings = data ?? [];
  const review_count = ratings.length;
  const average_rating =
    review_count > 0
      ? Math.round(
          (ratings.reduce((sum, r) => sum + r.rating, 0) / review_count) * 10
        ) / 10
      : null;

  return { review_count, average_rating };
}

export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = querySchema.safeParse(params);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: reviews, error } = await supabase
    .from("clinic_reviews")
    .select("*")
    .eq("clinic_id", parsed.data.clinicId)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(parsed.data.limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const summary = await getReviewSummary(
    await createServiceClient(),
    parsed.data.clinicId
  );

  return NextResponse.json({ reviews: reviews ?? [], summary });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = postSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const supabase = await createServiceClient();

  const { data: clinic } = await supabase
    .from("clinics")
    .select("id")
    .eq("id", parsed.data.clinicId)
    .single();

  if (!clinic) {
    return NextResponse.json({ error: "Clinic not found" }, { status: 404 });
  }

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: recentCount } = await supabase
    .from("clinic_reviews")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", parsed.data.clinicId)
    .gte("created_at", oneDayAgo);

  if ((recentCount ?? 0) >= 10) {
    return NextResponse.json(
      { error: "This clinic has received many reviews today. Try again later." },
      { status: 429 }
    );
  }

  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  const { data, error } = await supabase
    .from("clinic_reviews")
    .insert({
      clinic_id: parsed.data.clinicId,
      user_id: user?.id ?? null,
      rating: parsed.data.rating,
      body: parsed.data.body,
      reviewer_name: parsed.data.reviewerName ?? "Pet owner",
      experience_tags: parsed.data.experienceTags,
      status: "published",
    })
    .select()
    .single();

  if (error) {
    if (error.message.includes("already reviewed")) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const summary = await getReviewSummary(supabase, parsed.data.clinicId);

  return NextResponse.json({
    review: data as ClinicReview,
    summary,
  });
}
