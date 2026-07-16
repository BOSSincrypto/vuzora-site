/**
 * Compare — objection-handling table.
 *
 * Положение Vuzora против привычных альтернатив: «зайти на сайт вуза»,
 * «скрин от старосты в чате», «приложение вуза». Сравнение по сценарию
 * утра — что реально болит у студента.
 *
 * @module components/vuzora/Compare
 */
import { memo } from "react";
import { SectionHeader } from "./ui/SectionHeader";
import { useReveal } from "@/hooks/use-reveal";

type Row = {
  label: string;
  vuzora: string;
  bookmark: string;
  chat: string;
  app: string;
};

const ROWS: Row[] = [
  { label: "Доставка",       vuzora: "сама, в твой слот",   bookmark: "ты идёшь сам",     chat: "когда староста встанет", app: "ты идёшь сам" },
  { label: "Реклама и баннеры", vuzora: "нет",         bookmark: "есть",             chat: "стикеры, мемы, флуд",    app: "есть" },
  { label: "Поиск своей группы", vuzora: "один раз при настройке", bookmark: "каждое утро", chat: "листать чат",   app: "каждое утро" },
  { label: "Изменения за ночь",  vuzora: "уже в сообщении",    bookmark: "узнаёшь на паре", chat: "если кто-то заметил", app: "если откроешь" },
  { label: "Работает офлайн",    vuzora: "сообщение остаётся", bookmark: "нет",        chat: "да, если скрин",         app: "иногда" },
];

export const Compare = memo(function Compare() {
  const ref = useReveal<HTMLDivElement>();

  return (
    <section
      id="compare"
      className="reveal border-t border-white/5 px-6 py-24 md:px-12 md:py-32"
      ref={ref}
    >
      <div className="mx-auto max-w-6xl">
        <SectionHeader
          kicker="Честно"
          kickerDot
          title={<>А чем это <span className="text-white/55">лучше</span> закладки?</>}
          lede={<>Сравнили по тому, что реально происходит утром — когда ты ещё не проснулся, а первая пара уже на горизонте.</>}
          titleMaxCh={18}
        />

        {/* Desktop / tablet: table */}
        <div className="hidden overflow-hidden rounded-2xl border border-white/10 bg-ink-soft/40 md:block">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-ink-soft/60 text-left">
                <th className="px-5 py-4 font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">Сценарий</th>
                <Th highlight>Vuzora</Th>
                <Th>Сайт вуза</Th>
                <Th>Чат группы</Th>
                <Th>Прил. вуза</Th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r, i) => (
                <tr
                  key={r.label}
                  className={i % 2 === 0 ? "bg-transparent" : "bg-white/[0.015]"}
                >
                  <td className="border-t border-white/5 px-5 py-4 text-white/70">{r.label}</td>
                  <Td highlight>{r.vuzora}</Td>
                  <Td muted>{r.bookmark}</Td>
                  <Td muted>{r.chat}</Td>
                  <Td muted>{r.app}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile: stacked cards */}
        <div className="grid gap-3 md:hidden">
          {ROWS.map((r) => (
            <div key={r.label} className="rounded-2xl border border-white/10 bg-ink-soft/40 p-5">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">
                {r.label}
              </div>
              <ul className="mt-3 space-y-2 text-sm">
                <MobileRow label="Vuzora" value={r.vuzora} highlight />
                <MobileRow label="Сайт вуза" value={r.bookmark} />
                <MobileRow label="Чат группы" value={r.chat} />
                <MobileRow label="Прил. вуза" value={r.app} />
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
});

function Th({ children, highlight = false }: { children: React.ReactNode; highlight?: boolean }) {
  return (
    <th
      className={`px-5 py-4 font-mono text-[10px] uppercase tracking-[0.2em] ${
        highlight ? "text-amber" : "text-white/45"
      }`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  highlight = false,
  muted = false,
}: {
  children: React.ReactNode;
  highlight?: boolean;
  muted?: boolean;
}) {
  return (
    <td
      className={`border-t border-white/5 px-5 py-4 ${
        highlight ? "text-white" : muted ? "text-white/50" : "text-white/70"
      }`}
    >
      {children}
    </td>
  );
}

function MobileRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <li className="flex items-baseline justify-between gap-4">
      <span className={`text-xs ${highlight ? "text-amber" : "text-white/45"}`}>{label}</span>
      <span className={`text-right ${highlight ? "text-white" : "text-white/55"}`}>{value}</span>
    </li>
  );
}
