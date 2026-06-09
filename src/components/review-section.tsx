"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { StarRating } from "@/components/star-rating";
import {
  EXPERIENCE_TAGS,
  formatAverageRating,
  getExperienceTagLabel,
  ratingLabel,
  type ExperienceTagId,
} from "@/lib/reviews";
import type { ClinicReview, ReviewSummary } from "@/types/database";
import { toast } from "sonner";
import { MessageSquareQuote } from "lucide-react";

interface ReviewSectionProps {
  clinicId: string;
  initialReviews: ClinicReview[];
  initialSummary: ReviewSummary;
  initialDistribution: number[];
}

export function ReviewSection({
  clinicId,
  initialReviews,
  initialSummary,
  initialDistribution,
}: ReviewSectionProps) {
  const [reviews, setReviews] = useState(initialReviews);
  const [summary, setSummary] = useState(initialSummary);
  const [distribution, setDistribution] = useState(initialDistribution);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [reviewerName, setReviewerName] = useState("");
  const [tags, setTags] = useState<ExperienceTagId[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function toggleTag(tag: ExperienceTagId) {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  async function submitReview(e: React.FormEvent) {
    e.preventDefault();

    if (rating < 1) {
      toast.error("Please select a star rating");
      return;
    }

    if (body.trim().length < 20) {
      toast.error("Review must be at least 20 characters");
      return;
    }

    setSubmitting(true);

    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clinicId,
        rating,
        body: body.trim(),
        reviewerName: reviewerName.trim() || undefined,
        experienceTags: tags,
      }),
    });

    const json = await res.json();

    if (!res.ok) {
      toast.error("Could not submit review", {
        description: json.error ?? "Please try again",
      });
    } else if (json.review) {
      const newReview = json.review as ClinicReview;
      setReviews((prev) => [newReview, ...prev]);
      setSummary(json.summary as ReviewSummary);
      setDistribution((prev) => {
        const next = [...prev];
        next[newReview.rating - 1] += 1;
        return next;
      });
      setRating(0);
      setBody("");
      setReviewerName("");
      setTags([]);
      toast.success("Thank you — your review was published");
    }

    setSubmitting(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-lg font-bold">Community reviews</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Share your emergency visit experience to help other pet owners choose
          confidently.
        </p>
      </div>

      {summary.review_count > 0 && (
        <div className="grid gap-4 rounded-xl border bg-muted/20 p-4 sm:grid-cols-[auto_1fr]">
          <div className="text-center sm:text-left">
            <p className="font-display text-3xl font-extrabold tabular-nums">
              {formatAverageRating(summary.average_rating)}
            </p>
            <StarRating value={summary.average_rating ?? 0} size="sm" />
            <p className="mt-1 text-xs text-muted-foreground">
              {ratingLabel(summary.review_count)}
            </p>
          </div>
          <div className="space-y-1.5">
            {[5, 4, 3, 2, 1].map((stars) => {
              const count = distribution[stars - 1];
              const pct =
                summary.review_count > 0
                  ? Math.round((count / summary.review_count) * 100)
                  : 0;
              return (
                <div key={stars} className="flex items-center gap-2 text-xs">
                  <span className="w-3 tabular-nums text-muted-foreground">
                    {stars}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-chart-3 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-6 text-right tabular-nums text-muted-foreground">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <form onSubmit={submitReview} className="space-y-4 rounded-xl border p-4">
        <div>
          <Label className="mb-2 block">Your rating</Label>
          <StarRating
            value={rating}
            interactive
            size="lg"
            onChange={setRating}
          />
        </div>

        <div>
          <Label htmlFor="review-body">Your experience</Label>
          <Textarea
            id="review-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What happened during your emergency visit? Wait time, staff care, whether they accepted your pet…"
            rows={4}
            maxLength={2000}
            required
            className="mt-1.5"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {body.length}/2000 · minimum 20 characters
          </p>
        </div>

        <div>
          <Label className="mb-2 block">Experience tags (optional)</Label>
          <div className="flex flex-wrap gap-2">
            {EXPERIENCE_TAGS.map((tag) => {
              const selected = tags.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    selected
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {tag.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <Label htmlFor="reviewer-name">Display name (optional)</Label>
          <Input
            id="reviewer-name"
            value={reviewerName}
            onChange={(e) => setReviewerName(e.target.value)}
            placeholder="Pet owner"
            maxLength={40}
            className="mt-1.5"
          />
        </div>

        <Button type="submit" disabled={submitting || rating < 1}>
          {submitting ? "Publishing…" : "Publish review"}
        </Button>
      </form>

      {reviews.length > 0 ? (
        <ul className="space-y-3">
          {reviews.map((review) => (
            <li
              key={review.id}
              className="rounded-xl border bg-muted/15 px-4 py-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{review.reviewer_name}</p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <StarRating value={review.rating} size="sm" />
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(review.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                </div>
              </div>
              <p className="mt-2 text-sm leading-relaxed">{review.body}</p>
              {review.experience_tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {review.experience_tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {getExperienceTagLabel(tag)}
                    </Badge>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
          <MessageSquareQuote className="size-8 opacity-40" />
          <p>No reviews yet — be the first to share your experience.</p>
        </div>
      )}
    </div>
  );
}
