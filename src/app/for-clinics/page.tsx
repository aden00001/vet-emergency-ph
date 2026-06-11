import { redirect } from "next/navigation";

/** Legacy route — clinic self-service was removed; directory is maintained directly. */
export default function ForClinicsPage() {
  redirect("/");
}
