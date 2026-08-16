import { PageHeader } from "@/components/ui/page-header";
import { ImportWizard } from "./import-wizard";

export default function ImportListPage() {
  return (
    <div>
      <PageHeader
        title="Import a list"
        description="Upload an .xlsx or .csv file, up to 5 MB and 2,000 rows, one HR contact per row."
        backHref="/lists"
        backLabel="Back to lists"
      />
      <ImportWizard />
    </div>
  );
}
