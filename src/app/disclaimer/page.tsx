import { ContactEmail } from "@/components/contact-email";
import { SiteHeader } from "@/components/site-header";
import { SITE_NAME } from "@/lib/brand";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Disclaimer",
  description: `Important legal disclaimer for ${SITE_NAME} users.`,
  path: "/disclaimer",
});

export default function DisclaimerPage() {
  return (
    <div className="min-h-full flex flex-col">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-10 prose prose-neutral dark:prose-invert">
        <h1>Disclaimer</h1>
        <p>
          {SITE_NAME} is an informational directory service designed to help
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
          especially during an emergency. {SITE_NAME} is not liable for
          outcomes resulting from reliance on directory information.
        </p>
        <h2>Contact</h2>
        <p>
          For listing corrections or general feedback, email{" "}
          <ContactEmail />.
        </p>
      </main>
    </div>
  );
}
