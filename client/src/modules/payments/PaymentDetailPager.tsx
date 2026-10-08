import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import PagePagination from '../../components/PagePagination';

/** Répartit les éléments selon leur hauteur réelle, sans défilement ni copie du contenu. */
export default function PaymentDetailPager({ items }: { items: ReactNode[] }) {
  const body = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<number[][]>([items.map((_, index) => index)]);
  const [page, setPage] = useState(0);
  useLayoutEffect(() => {
    const element = body.current;
    if (!element) return;
    const measure = () => {
      if (!element.clientHeight) {
        setPages(previous => {
          const next = [Array.from(element.children, (_, index) => index)];
          return JSON.stringify(previous) === JSON.stringify(next) ? previous : next;
        });
        return;
      }
      const next: number[][] = [[]];
      let used = 0;
      Array.from(element.children).forEach((row, index) => {
        const height = Math.ceil(row.getBoundingClientRect().height);
        if (used + height > element.clientHeight && next[next.length - 1].length) {
          next.push([]);
          used = 0;
        }
        next[next.length - 1].push(index);
        used += height;
      });
      setPages(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
      setPage(previous => Math.min(previous, next.length - 1));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    Array.from(element.children).forEach(row => observer.observe(row));
    return () => observer.disconnect();
  }, [items.length]);
  const activePage = Math.min(page, pages.length - 1);
  return <div className="payment-detail-pager">
    <div className="payment-detail-pager__body" ref={body}>
      {items.map((item, index) => {
        const visible = pages[activePage]?.includes(index) ?? false;
        return <div key={index} className="payment-detail-pager__item" data-visible={visible}
          aria-hidden={!visible || undefined} ref={element => { if (element) element.inert = !visible; }}>{item}</div>;
      })}
    </div>
    <PagePagination page={activePage} onPageChange={setPage} totalPages={pages.length} hideTotal hideOnSinglePage={false} compact />
  </div>;
}
