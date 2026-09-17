import assert from "node:assert/strict";
import test from "node:test";
import {
  applyTablePipeline,
  compareSortValues,
  nextSortState,
  rowMatchesFilters,
  rowMatchesQuery,
} from "./data-table";

type Row = {
  name: string;
  branch: string;
  batch: number;
  cgpa: number | null;
  offered: boolean;
  appliedAt: Date;
  tags: string[];
};

const rows: Row[] = [
  {
    name: "Isha Verma",
    branch: "CSE",
    batch: 2027,
    cgpa: 9.2,
    offered: true,
    appliedAt: new Date("2026-02-01"),
    tags: ["Internship"],
  },
  {
    name: "Rohan Gupta",
    branch: "IT",
    batch: 2026,
    cgpa: 10,
    offered: false,
    appliedAt: new Date("2026-01-15"),
    tags: ["Internship", "PPO"],
  },
  {
    name: "Jatin Solanki",
    branch: "CSAI",
    batch: 2027,
    cgpa: 8.5,
    offered: true,
    appliedAt: new Date("2026-03-10"),
    tags: ["FTE"],
  },
  {
    name: "Meera Nair",
    branch: "ECE",
    batch: 2028,
    cgpa: null,
    offered: false,
    appliedAt: new Date("2026-02-20"),
    tags: [],
  },
];

const searchText = (row: Row) => `${row.name} ${row.branch} ${row.batch}`;
const sortValue = (row: Row, columnId: string) =>
  ({
    name: row.name,
    batch: row.batch,
    cgpa: row.cgpa,
    offered: row.offered,
    appliedAt: row.appliedAt,
  })[columnId];

test("a numeric column sorts by value, not by how it reads", () => {
  // The bug this guards: "10" sorting above "9.2" as text.
  const ascending = applyTablePipeline({
    rows,
    sort: { columnId: "cgpa", direction: "asc" },
    sortValue,
  });
  assert.deepEqual(
    ascending.rows.map((row) => row.cgpa),
    [8.5, 9.2, 10, null],
  );

  const descending = applyTablePipeline({
    rows,
    sort: { columnId: "cgpa", direction: "desc" },
    sortValue,
  });
  // An unknown CGPA is not the lowest value; it stays last either way.
  assert.deepEqual(
    descending.rows.map((row) => row.cgpa),
    [10, 9.2, 8.5, null],
  );
});

test("dates sort by instant and booleans put false first", () => {
  const byDate = applyTablePipeline({
    rows,
    sort: { columnId: "appliedAt", direction: "asc" },
    sortValue,
  });
  assert.deepEqual(
    byDate.rows.map((row) => row.appliedAt.toISOString().slice(0, 10)),
    ["2026-01-15", "2026-02-01", "2026-02-20", "2026-03-10"],
  );

  const byFlag = applyTablePipeline({
    rows,
    sort: { columnId: "offered", direction: "asc" },
    sortValue,
  });
  assert.deepEqual(
    byFlag.rows.map((row) => row.offered),
    [false, false, true, true],
  );
});

test("sorting is stable, so tied rows keep their original order", () => {
  const sorted = applyTablePipeline({
    rows,
    sort: { columnId: "batch", direction: "asc" },
    sortValue,
  });
  assert.deepEqual(
    sorted.rows.map((row) => row.name),
    ["Rohan Gupta", "Isha Verma", "Jatin Solanki", "Meera Nair"],
  );
});

test("strings compare case-insensitively and in human number order", () => {
  assert.equal(compareSortValues("apple", "Banana") < 0, true);
  assert.equal(compareSortValues("Sem 2", "Sem 10") < 0, true);
  assert.equal(compareSortValues(null, "anything") > 0, true);
  assert.equal(compareSortValues("", 5) > 0, true);
  assert.equal(compareSortValues(null, undefined), 0);
});

test("search is case-insensitive and every term has to match", () => {
  assert.equal(rowMatchesQuery("JATIN SOLANKI CSAI", "jatin"), true);
  assert.equal(rowMatchesQuery("JATIN SOLANKI CSAI", "csai"), true);
  assert.equal(rowMatchesQuery("JATIN SOLANKI CSAI", "jatin csai"), true);
  assert.equal(rowMatchesQuery("JATIN SOLANKI CSAI", "jatin cse"), false);
  assert.equal(rowMatchesQuery("anything", "   "), true);
});

test("filters combine with AND across fields and OR inside one field", () => {
  const filters = [
    { id: "branch", value: (row: Row) => row.branch },
    { id: "tags", value: (row: Row) => row.tags },
  ];

  assert.equal(
    rowMatchesFilters(rows[0], filters, { branch: ["CSE", "IT"] }),
    true,
  );
  assert.equal(
    rowMatchesFilters(rows[0], filters, { branch: ["CSE"], tags: ["FTE"] }),
    false,
  );
  assert.equal(
    rowMatchesFilters(rows[1], filters, { tags: ["PPO"] }),
    true,
  );
  // An empty selection is not a filter at all.
  assert.equal(rowMatchesFilters(rows[3], filters, { branch: [] }), true);
  // A row with no value for a filter cannot satisfy it.
  assert.equal(rowMatchesFilters(rows[3], filters, { tags: ["FTE"] }), false);
});

test("pagination is applied after search and filters", () => {
  // The case from the brief: 100 rows, a search that leaves 12, page 1 of 1.
  const many = Array.from({ length: 100 }, (_, index) => ({
    ...rows[0],
    name: index < 12 ? `Match ${index}` : `Other ${index}`,
  }));

  const result = applyTablePipeline({
    rows: many,
    query: "match",
    searchText: (row) => row.name,
    page: 1,
    pageSize: 20,
  });

  assert.equal(result.filteredCount, 12);
  assert.equal(result.pageCount, 1);
  assert.equal(result.rows.length, 12);
});

test("a page beyond the end is clamped instead of blanking the table", () => {
  const result = applyTablePipeline({ rows, page: 9, pageSize: 2 });
  assert.equal(result.page, 2);
  assert.equal(result.pageCount, 2);
  assert.deepEqual(
    result.rows.map((row) => row.name),
    ["Jatin Solanki", "Meera Nair"],
  );
});

test("a short list still reports one page and keeps every row", () => {
  const result = applyTablePipeline({ rows, page: 1, pageSize: 20 });
  assert.equal(result.pageCount, 1);
  assert.equal(result.filteredCount, 4);
  assert.equal(result.rows.length, 4);
});

test("page size zero turns pagination off", () => {
  const result = applyTablePipeline({ rows, pageSize: 0 });
  assert.equal(result.rows.length, 4);
  assert.equal(result.pageCount, 1);
});

test("the whole pipeline runs in order: search, filter, sort, paginate", () => {
  const result = applyTablePipeline({
    rows,
    query: "2027",
    searchText,
    filters: [{ id: "branch", value: (row: Row) => row.branch }],
    filterState: { branch: ["CSE", "CSAI"] },
    sort: { columnId: "cgpa", direction: "desc" },
    sortValue,
    page: 1,
    pageSize: 1,
  });

  // Two rows survive search and filters, sorted 9.2 then 8.5, one per page.
  assert.equal(result.filteredCount, 2);
  assert.equal(result.pageCount, 2);
  assert.deepEqual(
    result.rows.map((row) => row.name),
    ["Isha Verma"],
  );
});

test("a header click cycles unsorted, ascending, descending, unsorted", () => {
  const first = nextSortState(null, "name");
  assert.deepEqual(first, { columnId: "name", direction: "asc" });

  const second = nextSortState(first, "name");
  assert.deepEqual(second, { columnId: "name", direction: "desc" });

  assert.equal(nextSortState(second, "name"), null);

  // Moving to another column starts that column's own cycle.
  assert.deepEqual(nextSortState(second, "batch"), { columnId: "batch", direction: "asc" });
});
