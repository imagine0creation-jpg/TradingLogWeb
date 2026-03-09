import RiskCalculatorEntryForm from "./components/RiskCalculatorEntryForm";

export default function App() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-10 sm:px-8">
      <section className="animate-rise-in rounded-2xl border border-white/10 bg-panel/85 p-6 shadow-card backdrop-blur md:p-8">
        <h1 className="font-display text-3xl uppercase tracking-wide text-lime sm:text-4xl">
          All-around Trading Log
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-ink/80 sm:text-base">
          Risk-first entry planning with live price feed, trade details, and psychology diary.
        </p>
        <div className="mt-8">
          <RiskCalculatorEntryForm />
        </div>
      </section>
    </main>
  );
}
