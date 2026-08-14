import { ImportWizard } from "./import-wizard";

export default function ImportListPage() {
  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">Import a list</h1>
      <p className="mt-2 text-sm text-muted">
        Upload an .xlsx or .csv file, up to 5 MB and 2,000 rows, one HR contact per row.
      </p>
      <div className="mt-8">
        <ImportWizard />
      </div>
    </div>
  );
}
