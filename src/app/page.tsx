import { redirect } from "next/navigation";

/** The daily habit is logging, so that's the landing page. */
export default function Home() {
  redirect("/entry");
}
