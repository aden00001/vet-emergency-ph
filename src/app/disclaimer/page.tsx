import { SiteHeader } from "@/components/site-header";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Disclaimer | VetEmergency.ph",
  description: "Important legal disclaimer for VetEmergency.ph users.",
};

export default function DisclaimerPage() {
  return (
    <div className="min-h-full flex flex-col">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-10 prose prose-neutral dark:prose-invert">
        <h1>Disclaimer</h1>
        <p>
          VetEmergency.ph is an informational directory service designed to help
          pet owners locate veterinary clinics that may provide emergency care.
        </p>
        <h2>Not medical advice</h2>
        <p>
          This platform does not provide veterinary diagnosis, treatment
          recommendations, or medical advice. Emergency decisions remain the
          responsibility of pet owners and licensed veterinary professionals.
        </p>
        <h2>No guarantee of availability</h2>
        <p>
          Clinic hours, emergency capacity, and contact information may change
          without notice. Community verifications and clinic-supplied updates
          improve accuracy but do not guarantee that a clinic is open or
          accepting emergencies at any given moment.
        </p>
        <h2>Always call first</h2>
        <p>
          You should always contact a clinic directly by phone before traveling,
          especially during an emergency. VetEmergency.ph is not liable for
          outcomes resulting from reliance on directory information.
        </p>
      </main>
    </div>
  );
}
