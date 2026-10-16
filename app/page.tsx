import { redirect } from "next/navigation";
import styles from "./home.module.css";
import ShaderLoader from "./shader-loader";

type SearchParams = Record<string, string | string[] | undefined>;

export const dynamic = "force-dynamic";

const catalogParams = new Set(["q", "category", "style", "icon", "variant", "color"]);

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h13M13 7l5 5-5 5" />
    </svg>
  );
}

export default async function Home({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const incoming = await searchParams;
  const shouldOpenCatalog = Object.keys(incoming).some((key) => catalogParams.has(key));

  if (shouldOpenCatalog) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(incoming)) {
      if (Array.isArray(value)) value.forEach((item) => params.append(key, item));
      else if (value !== undefined) params.set(key, value);
    }
    redirect(`/icons.html${params.size ? `?${params}` : ""}`);
  }

  return (
    <main className={styles.home}>
      <canvas id="home-scene" className={styles.scene} aria-hidden="true" />
      <div className={styles.fallback} aria-hidden="true">
        <div className={styles.fallbackTitle}>DIRECTUM<br /><span>DESIGN</span></div>
        <div className={styles.fallbackSphere} />
      </div>
      <div className={styles.noise} aria-hidden="true" />

      <div className={styles.shell}>
        <header className={styles.topbar}>
          <a className={styles.brand} href="/" aria-label="Directum Design — главная">
            <span className={styles.brandMark}><img src="/assets/directum-site-mark.svg" alt="" /></span>
            <span><b>Directum</b><small>Design system</small></span>
          </a>

          <nav className={styles.primaryNav} aria-label="Разделы библиотеки">
            <a href="/icons.html">Иконки</a>
            <a href="/logos.html">Логотипы</a>
            <a href="/logobook.html">Логобук</a>
          </nav>

        </header>

        <section className={styles.hero} aria-labelledby="home-title">
          <h1 id="home-title" className={styles.srOnly}>DIRECTUM DESIGN</h1>
          <p className={styles.intro}><strong>Дизайн-материалы Directum</strong><br />Иконки, логотипы и правила бренда<br />в одном месте.</p>

          <nav className={styles.sectionLinks} aria-label="Материалы Directum">
            <a href="/icons.html"><span className={styles.linkIndex}>01</span><span>Иконки</span><ArrowIcon /></a>
            <a href="/logos.html"><span className={styles.linkIndex}>02</span><span>Логотипы</span><ArrowIcon /></a>
            <a href="/logobook.html"><span className={styles.linkIndex}>03</span><span>Логобук</span><ArrowIcon /></a>
          </nav>
        </section>

        <footer className={styles.footer}>
          <div className={styles.tools}>
            <span className={styles.hint}><i /> двигайте курсор</span>
          </div>
        </footer>
      </div>
      <ShaderLoader />
    </main>
  );
}
