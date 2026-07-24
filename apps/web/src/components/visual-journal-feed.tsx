import { useCallback, useEffect, useRef, useState } from "react";
import { Bookmark, CheckCircle2, Heart, ImageOff, Leaf } from "lucide-react";
import { parseVisualJournalPage } from "../context.js";
import type { GroceryVisualItem, RecipeVisualItem, VisualJournalItem, VisualJournalPage } from "../types.js";
import { Button } from "./ui.js";

const BATCH_SIZE = 12;

export function VisualJournalFeed({ initialPage, pageNumber }: { initialPage: VisualJournalPage; pageNumber: number }) {
  const [items, setItems] = useState<readonly VisualJournalItem[]>(initialPage.items);
  const [nextCursor, setNextCursor] = useState(initialPage.nextCursor);
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (loading || nextCursor === null) return;
    setLoading(true);
    setFailure(false);
    try {
      const query = new URLSearchParams({ section: initialPage.section, cursor: nextCursor });
      const response = await fetch(`/households/${encodeURIComponent(initialPage.householdId)}/journal-items?${query}`, {
        headers: { accept: "application/json" },
      });
      if (!response.ok) throw new Error(`Journal page returned ${response.status}`);
      const page = parseVisualJournalPage(await response.json());
      if (page === null || page.householdId !== initialPage.householdId || page.section !== initialPage.section) {
        throw new Error("Journal page did not match the requested household section");
      }
      setItems((current) => {
        const known = new Set(current.map((item) => item.id));
        return [...current, ...page.items.filter((item) => !known.has(item.id))];
      });
      setNextCursor(page.nextCursor);
    } catch {
      setFailure(true);
    } finally {
      setLoading(false);
    }
  }, [initialPage.householdId, initialPage.section, loading, nextCursor]);

  useEffect(() => {
    const target = sentinel.current;
    if (target === null || nextCursor === null || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadMore();
    }, { rootMargin: "320px 0px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [loadMore, nextCursor]);

  const fallbackPage = Math.max(pageNumber, Math.ceil(items.length / BATCH_SIZE)) + 1;
  const noun = initialPage.section === "recipes" ? "recipes" : "groceries";
  return (
    <>
      <div className={`visual-journal-grid visual-journal-grid--${initialPage.section}`}>
        {items.map((item) => item.kind === "recipe"
          ? <RecipeCard item={item} key={item.id} />
          : <GroceryCard item={item} key={item.id} />)}
      </div>
      <div className="journal-loader" ref={sentinel}>
        <p>Showing {items.length} of {initialPage.total} {noun}</p>
        {failure ? (
          <div className="journal-loader__failure" role="alert">
            <span>More {noun} could not be loaded.</span>
            <Button type="button" variant="secondary" onClick={() => void loadMore()}>Try again</Button>
          </div>
        ) : nextCursor === null ? (
          <p className="journal-loader__complete" role="status">You have reached the end of this household’s {noun}.</p>
        ) : (
          <a
            className={`button button--secondary${loading ? " is-loading" : ""}`}
            href={`?page=${fallbackPage}`}
            aria-disabled={loading || undefined}
            onClick={(event) => {
              event.preventDefault();
              void loadMore();
            }}
          >
            {loading ? `Loading more ${noun}…` : `Load more ${noun}`}
          </a>
        )}
      </div>
    </>
  );
}

function RecipeCard({ item }: { item: RecipeVisualItem }) {
  const title = item.canonicalUrl === null
    ? <h2>{item.title}</h2>
    : <h2><a href={item.canonicalUrl} rel="noreferrer">{item.title}</a></h2>;
  return (
    <article className="visual-journal-card">
      <JournalImage item={item} />
      <div className="visual-journal-card__body">
        {title}
        {item.source === null ? null : <p className="visual-journal-card__source">{item.source}</p>}
        <dl className="recipe-states">
          <RecipeState icon={<Bookmark aria-hidden="true" size={15} />} label="Saved" value={item.saved} />
          <RecipeState icon={<CheckCircle2 aria-hidden="true" size={15} />} label="Cooked" value={item.cooked} />
          <RecipeState icon={<Heart aria-hidden="true" size={15} />} label="Liked" value={item.liked} />
        </dl>
        {item.lastCookedLabel === null ? null : <p className="visual-journal-card__date">Last cooked {item.lastCookedLabel}</p>}
      </div>
    </article>
  );
}

function RecipeState({ icon, label, value }: { icon: React.ReactNode; label: string; value: RecipeVisualItem["saved"] }) {
  return <div className={`recipe-state recipe-state--${value}`}>{icon}<dt>{label}</dt><dd>{value}</dd></div>;
}

function GroceryCard({ item }: { item: GroceryVisualItem }) {
  return (
    <article className="visual-journal-card">
      <JournalImage item={item} />
      <div className="visual-journal-card__body">
        <h2>{item.title}</h2>
        {item.brand === null ? null : <p className="visual-journal-card__source">{item.brand}</p>}
        {item.detail === "" ? null : <p className="visual-journal-card__detail">{item.detail}</p>}
        <p className="grocery-kind"><Leaf aria-hidden="true" size={15} /> {groceryKindLabel(item.journalKind)}</p>
      </div>
    </article>
  );
}

function JournalImage({ item }: { item: VisualJournalItem }) {
  const [failed, setFailed] = useState(false);
  if (item.imageUrl === null || failed) {
    return <div className="visual-journal-card__fallback"><ImageOff aria-hidden="true" /><span>No image recorded</span></div>;
  }
  const image = (
    <img
      src={item.imageUrl}
      alt={`${item.title} reference image`}
      width="640"
      height="480"
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
  return item.imagePageUrl === null
    ? <div className="visual-journal-card__media">{image}</div>
    : <a className="visual-journal-card__media" href={item.imagePageUrl} rel="noreferrer" aria-label={`Open image source for ${item.title}`}>{image}</a>;
}

function groceryKindLabel(kind: GroceryVisualItem["journalKind"]): string {
  if (kind === "other_grocery") return "Other grocery";
  return kind[0]?.toUpperCase() + kind.slice(1);
}
