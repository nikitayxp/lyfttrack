type PageQuery<Row> = PromiseLike<{
  data: Row[] | null;
  count?: number | null;
  error: { message: string } | null;
}> & {
  order(column: string, options: { ascending: boolean }): PageQuery<Row>;
  range(from: number, to: number): PageQuery<Row>;
  gt(column: string, value: string): PageQuery<Row>;
};

const PAGE_SIZE = 1000;

export async function loadAllRows<Row>(
  buildQuery: (count?: 'exact') => PageQuery<Row>,
  context: string,
  { countFirstPage = false } = {},
): Promise<Row[]> {
  const rows: Row[] = [];
  let cursor: string | undefined;

  while (true) {
    const exactCount = countFirstPage && cursor === undefined;
    let query = buildQuery(exactCount ? 'exact' : undefined).order('id', { ascending: true }).range(0, PAGE_SIZE - 1);
    if (cursor) query = query.gt('id', cursor);
    const { data, count, error } = await query;
    if (error) throw new Error(`${context}: ${error.message}`);
    const page = data ?? [];
    rows.push(...page);
    if (page.length === 0) return rows;
    const last = page[page.length - 1] as { id?: unknown };
    if (typeof last.id !== 'string' || (cursor && last.id <= cursor)) {
      throw new Error(`${context}: invalid page boundary`);
    }
    if (exactCount && count === page.length) return rows;
    cursor = last.id;
  }
}
