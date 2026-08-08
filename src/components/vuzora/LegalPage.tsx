/**
 * Renderer for a {@link LegalDocument}.
 *
 * The offer and the privacy policy share one layout, so the routes carry only
 * their metadata and the prose lives in `src/content/legal.ts`. That module is
 * also what `/legal/terms.md` and `/legal/privacy.md` are generated from.
 *
 * @module components/vuzora/LegalPage
 */

import { Link } from "@tanstack/react-router";
import type { LegalDocument } from "@/content/legal";
import { renderRichText } from "@/lib/rich-text";

const LINK_CLASS = "underline hover:text-white";

/** Render one legal document as a standalone page body. */
export function LegalPage({ document }: { document: LegalDocument }) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20 text-white/85 md:px-10 md:py-28">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/55">
        <Link to="/" className="hover:text-white">
          ← На главную
        </Link>
      </p>
      <h1 className="mt-4 font-display text-3xl font-semibold text-white md:text-4xl">
        {document.heading}
      </h1>
      <p className="mt-2 font-mono text-xs text-white/55">Редакция от {document.revision}</p>

      {document.sections.map((section) => (
        <section key={section.title} className="mt-10">
          <h2 className="font-display text-xl font-semibold text-white">{section.title}</h2>
          <div className="mt-3 space-y-3 text-sm leading-relaxed">
            {section.blocks.map((block, index) =>
              block.kind === "p" ? (
                <p key={index}>{renderRichText(block.text, LINK_CLASS)}</p>
              ) : (
                <ul key={index} className="list-disc space-y-1 pl-5">
                  {block.items.map((item) => (
                    <li key={item}>{renderRichText(item, LINK_CLASS)}</li>
                  ))}
                </ul>
              ),
            )}
          </div>
        </section>
      ))}
    </main>
  );
}
