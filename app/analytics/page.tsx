import { env } from "cloudflare:workers";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { chatGPTSignOutPath, requireChatGPTUser } from "../chatgpt-auth";
import { getDashboardData, type DashboardPeriod } from "../../db/dashboard";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const periods: DashboardPeriod[] = [7, 30, 90];

function number(value: number | null | undefined) {
  return new Intl.NumberFormat("ru-RU").format(value ?? 0);
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(new Date(`${value}T12:00:00Z`));
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireChatGPTUser("/analytics");
  const ownerEmail = env.DASHBOARD_OWNER_EMAIL?.trim().toLocaleLowerCase("ru");
  if (!ownerEmail || user.email.trim().toLocaleLowerCase("ru") !== ownerEmail) notFound();

  const rawPeriod = (await searchParams).period;
  const parsedPeriod = Number(Array.isArray(rawPeriod) ? rawPeriod[0] : rawPeriod);
  const period: DashboardPeriod = periods.includes(parsedPeriod as DashboardPeriod) ? (parsedPeriod as DashboardPeriod) : 30;
  const data = await getDashboardData(period);
  const totalSearches = data.summary.searches || 0;
  const zeroRate = totalSearches ? Math.round((data.summary.zero_results / totalSearches) * 100) : 0;
  const maxDaily = Math.max(1, ...data.daily.map((row) => row.searches + row.opens + row.actions));

  const metrics = [
    { label: "Всего событий", value: number(data.summary.total_events), note: `за ${period} дней` },
    { label: "Поиски", value: number(totalSearches), note: `${zeroRate}% без результата` },
    { label: "Открытия", value: number(data.summary.opens), note: "иконки и логотипы" },
    { label: "Использования", value: number(data.summary.downloads + data.summary.copies), note: "скачивания и копирования" },
  ];

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/icons.html">
          <Image src="/assets/directum-site-mark.svg" alt="" width={34} height={34} unoptimized />
          <span><b>Directum</b><small>Analytics</small></span>
        </Link>
        <div className={styles.account}>
          <span>{user.displayName}</span>
          <a href={chatGPTSignOutPath("/icons.html")} target="_top">Выйти</a>
        </div>
      </header>

      <div className={styles.shell}>
        <section className={styles.intro}>
          <div>
            <p className={styles.eyebrow}>Приватный дашборд</p>
            <h1>Как используют библиотеку</h1>
            <p>Спрос, востребованные материалы и запросы, для которых пока нет результата.</p>
          </div>
          <nav className={styles.periods} aria-label="Период отчёта">
            {periods.map((item) => (
              <Link key={item} className={item === period ? styles.activePeriod : ""} href={`/analytics?period=${item}`}>{item} дней</Link>
            ))}
          </nav>
        </section>

        <section className={styles.metrics} aria-label="Ключевые показатели">
          {metrics.map((metric) => (
            <article className={styles.metric} key={metric.label}>
              <span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.note}</small>
            </article>
          ))}
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <div><p className={styles.eyebrow}>Динамика</p><h2>Активность по дням</h2></div>
            <div className={styles.legend}><span><i className={styles.searchDot} />Поиски</span><span><i className={styles.openDot} />Открытия</span><span><i className={styles.actionDot} />Использования</span></div>
          </div>
          {data.daily.length ? (
            <div className={styles.chart}>
              {data.daily.map((row) => {
                const total = row.searches + row.opens + row.actions;
                return (
                  <div className={styles.chartColumn} key={row.day} title={`${shortDate(row.day)}: ${total}`}>
                    <div className={styles.bar} style={{ height: `${Math.max(8, (total / maxDaily) * 100)}%` }}>
                      <span className={styles.actionSegment} style={{ flexGrow: row.actions }} />
                      <span className={styles.openSegment} style={{ flexGrow: row.opens }} />
                      <span className={styles.searchSegment} style={{ flexGrow: row.searches }} />
                    </div>
                    <small>{shortDate(row.day)}</small>
                  </div>
                );
              })}
            </div>
          ) : <div className={styles.empty}>Данные появятся после первых действий в каталоге.</div>}
        </section>

        <div className={styles.columns}>
          <section className={styles.panel}>
            <div className={styles.panelHead}><div><p className={styles.eyebrow}>Спрос</p><h2>Популярные материалы</h2></div></div>
            {data.topAssets.length ? (
              <ol className={styles.ranking}>
                {data.topAssets.map((asset, index) => (
                  <li key={asset.asset_id}>
                    <span className={styles.rank}>{String(index + 1).padStart(2, "0")}</span>
                    <span className={styles.itemName}><b>{asset.asset_name || asset.asset_id}</b><small>{asset.section === "logos" ? "Логотип" : "Иконка"}</small></span>
                    <span className={styles.itemValue}>{number(asset.interactions)}<small>{number(asset.downloads)} скач.</small></span>
                  </li>
                ))}
              </ol>
            ) : <div className={styles.empty}>Пока нет открытий или скачиваний.</div>}
          </section>

          <section className={`${styles.panel} ${styles.zeroPanel}`}>
            <div className={styles.panelHead}><div><p className={styles.eyebrow}>Возможности</p><h2>Не нашли в поиске</h2></div><span className={styles.zeroRate}>{zeroRate}%</span></div>
            {data.zeroQueries.length ? (
              <ol className={styles.queries}>
                {data.zeroQueries.map((item) => <li key={item.query}><span>{item.query}</span><b>{number(item.attempts)}</b></li>)}
              </ol>
            ) : <div className={styles.empty}>За период нет запросов без результата.</div>}
          </section>
        </div>

        <footer className={styles.footer}>
          <span>Только агрегированные действия. Текст сохраняется лишь для запросов без результата.</span>
          <Link href="/icons.html">Открыть библиотеку</Link>
        </footer>
      </div>
    </main>
  );
}
