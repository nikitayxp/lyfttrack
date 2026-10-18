type PageQuery<Row> = PromiseLike<{
  data: Row[] | null;
  error: { message: string } | null;
}> & {
  order(column: string, options: { ascending: boolean }): PageQuery<Row>;
  range(from: number, to: number): PageQuery<Row>;
  gt(column: string, value: string): PageQuery<Row>;
};

const PAGE_SIZE = 1000;

export async function loadAllRows<Row>(buildQuery: () => PageQuery<Row>, context: string): Promise<Row[]> {
  const rows: Row[] = [];
  let cursor: string | undefined;

  while (true) {
    let query = buildQuery().order('id', { ascending: true }).range(0, PAGE_SIZE - 1);
    if (cursor) query = query.gt('id', cursor);
    const { data, error } = await query;
    if (error) throw new Error(`${context}: ${error.message}`);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
    const last = page[page.length - 1] as { id?: unknown };
    if (typeof last.id !== 'string' || (cursor && last.id <= cursor)) {
      throw new Error(`${context}: invalid page boundary`);
    }
    cursor = last.id;
  }
}
