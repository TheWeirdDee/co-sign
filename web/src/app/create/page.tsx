import { redirect } from "next/navigation";

// Drafting happens on the board now (panel over the grid), not a separate page.
export default function Create() {
  redirect("/board");
}
