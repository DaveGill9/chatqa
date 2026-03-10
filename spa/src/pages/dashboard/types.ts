export type TestSet = {
  _id: string;
  name: string;
  filename: string;
  sizeBytes?: number | null;
  project?: string | null;
  createdAt: string;
  updatedAt: string;
  testCaseCount?: number;
};

export type TestCase = {
  _id: string;
  id: string;
  input: string;
  expected: string;
  additionalContext?: Record<string, unknown>;
};

export type TestSetDetail = TestSet & {
  testCaseCount: number;
  cases: TestCase[];
};

export type ResultSet = {
  _id: string;
  testSetId: string;
  name: string;
  status?: string;
  createdAt: string;
  filename: string;
  format: 'csv' | 'xlsx';
  sizeBytes?: number | null;
  testCaseCount?: number;
  testSetName?: string | null;
  testSetFilename?: string | null;
};

export type SortKey = 'updatedAt' | 'name' | 'testCaseCount';
export type SortDirection = 'asc' | 'desc';
