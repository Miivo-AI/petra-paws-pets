import type { ReactNode } from "react";
import Link from "next/link";
import Navbar from "@/components/public/Navbar";
import Footer from "@/components/public/Footer";

export type LegalSection = { title: string; body: ReactNode };

type LegalPageProps = {
  title: string;
  lastUpdated: string;
  intro: ReactNode;
  sections: LegalSection[];
};

export default function LegalPage({
  title,
  lastUpdated,
  intro,
  sections,
}: LegalPageProps) {
  return (
    <div className="min-h-screen bg-petra-sand">
      <Navbar />
      <main className="container-petra pb-14 pt-24 md:pb-20 md:pt-28">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm font-medium text-petra-gold">Legal</p>
          <h1 className="mt-2 font-serif text-3xl font-semibold text-petra-green md:text-4xl">
            {title}
          </h1>
          <p className="mt-3 text-sm text-petra-green/70">
            Last updated: {lastUpdated}
          </p>
          <div className="mt-6 text-base leading-relaxed text-petra-green/85">
            {intro}
          </div>

          <div className="mt-10 space-y-10">
            {sections.map((section, i) => (
              <section key={section.title}>
                <h2 className="font-serif text-xl font-semibold text-petra-green">
                  {i + 1}. {section.title}
                </h2>
                <div className="mt-3 text-sm leading-relaxed text-petra-green/80 md:text-base">
                  {section.body}
                </div>
              </section>
            ))}
          </div>

          <p className="mt-12 text-sm text-petra-green/60">
            Questions?{" "}
            <a
              href="mailto:petrapawspet@gmail.com"
              className="text-petra-green underline underline-offset-2 hover:text-petra-green-light"
            >
              Email us
            </a>{" "}
            or return to the{" "}
            <Link
              href="/"
              className="text-petra-green underline underline-offset-2 hover:text-petra-green-light"
            >
              home page
            </Link>
            .
          </p>

          <nav className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-t border-petra-green/10 pt-6 text-sm text-petra-green/70">
            <Link href="/privacy" className="hover:text-petra-green">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-petra-green">
              Terms of Service
            </Link>
            <Link href="/data-deletion" className="hover:text-petra-green">
              Data Deletion &amp; Retention
            </Link>
          </nav>
        </div>
      </main>
      <Footer />
    </div>
  );
}
