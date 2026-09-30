import type { Metadata } from "next";
import { FavoritesView } from "@/components/dashboard/learner/FavoritesView";

export const metadata: Metadata = { title: "Favorites" };

export default function FavoritesPage() {
  return <FavoritesView />;
}
