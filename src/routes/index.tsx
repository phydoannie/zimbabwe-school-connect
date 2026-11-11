import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Receipt, Users, Wallet, CalendarCheck, ShieldCheck, Smartphone } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SchoolSys Pro — Fees, receipts & records for Zimbabwean schools" },
      { name: "description", content: "Collect fees in USD or ZiG via EcoCash, cash or bank, issue receipts, track debtors and staff attendance." },
      { property: "og:title", content: "SchoolSys Pro — School management for Zimbabwe" },
      { property: "og:description", content: "Multi-school fees, receipts, debtors, expenses and attendance — built for Zimbabwean schools." },
    ],
  }),
  component: Index,
});

const features = [
  { icon: Wallet, t: "Multi-fee collection", d: "Tuition, levies and ZIMSEC fees on one receipt — USD, ZiG, EcoCash, InnBucks." },
  { icon: Receipt, t: "Official receipts", d: "Numbered PDF receipts with your school logo. Voids are audited, never deleted." },
  { icon: Users, t: "Students & debtors", d: "ECD A to Form 6. See who owes what, call guardians straight from the list." },
  { icon: CalendarCheck, t: "Staff attendance", d: "Daily teacher register with EC numbers, check-in and check-out." },
  { icon: ShieldCheck, t: "Head & bursar roles", d: "Each role sees only what it should. Schools are fully separated." },
  { icon: Smartphone, t: "Works on any phone", d: "Designed for the bursar's laptop and the head's smartphone." },
];

function Index() {
  return (
    <div className="min-h-screen">
      <div className="zim-stripe h-1.5" />
      <header className="bg-hero text-primary-foreground">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <span className="font-display text-lg font-bold">SchoolSys<span className="text-gold"> Pro</span></span>
          <Button asChild variant="gold" size="sm"><Link to="/auth">Sign in</Link></Button>
        </nav>
        <section className="mx-auto max-w-6xl px-5 pb-20 pt-10 md:pt-20">
          <p className="text-sm font-semibold uppercase tracking-widest text-gold">Made for Zimbabwean schools</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-tight md:text-6xl">
            Every fee, receipt and register — in one place.
          </h1>
          <p className="mt-5 max-w-xl text-base opacity-80 md:text-lg">
            From ECD to A-Level. Collect in USD or ZiG, issue receipts instantly, and know your debtors before the term ends.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild variant="gold" size="lg"><Link to="/register">Register your school</Link></Button>
          </div>
        </section>
      </header>
      <main className="mx-auto grid max-w-6xl gap-4 px-5 py-16 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <div key={f.t} className="rounded-xl border bg-card p-6 shadow-card">
            <f.icon className="h-6 w-6 text-primary" />
            <h3 className="mt-4 text-lg font-semibold">{f.t}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{f.d}</p>
          </div>
        ))}
      </main>
      <footer className="border-t py-8 text-center text-sm text-muted-foreground">© {new Date().getFullYear()} SchoolSys Pro</footer>
    </div>
  );
}
