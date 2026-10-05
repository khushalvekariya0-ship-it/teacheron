import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { PreviewBanner } from "@/components/layout/PreviewBanner";
import { CompareTray } from "@/components/layout/CompareTray";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { ScrollProgress } from "@/components/motion/Scroll";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ScrollProgress />
      <PreviewBanner />
      <Navbar />
      <main id="main" className="min-h-[60vh]">
        {children}
      </main>
      <Footer />
      <MobileTabBar />
      <CompareTray />
    </>
  );
}
