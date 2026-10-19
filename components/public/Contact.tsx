import { ContactForm } from "./ContactForm";

/** Always shown: collab inquiries are the business end of the site. */
export function Contact() {
  return (
    <section id="contact" aria-labelledby="contact-heading" className="scroll-mt-16 border-t border-[var(--line)]">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-16 md:grid-cols-[12rem_minmax(0,1fr)] md:py-24">
        <div>
          <h2 id="contact-heading" className="section-label text-xs font-medium uppercase tracking-[0.25em] text-[var(--muted)]">
            Contact &amp; collabs
          </h2>
        </div>
        <div className="max-w-2xl">
          <p className="arcade-display">
            Let&apos;s work together.
          </p>
          <p className="mt-3 mb-8 text-lg text-[var(--muted)]">
            Brand partnerships, event appearances, cosplay collabs or just saying hi.
          </p>
          <ContactForm />
        </div>
      </div>
    </section>
  );
}
