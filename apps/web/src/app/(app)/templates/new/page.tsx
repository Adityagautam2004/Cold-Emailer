import { PageHeader } from "@/components/ui/page-header";
import { TemplateEditor } from "../template-editor";

export default function NewTemplatePage() {
  return (
    <div>
      <PageHeader title="New template" backHref="/templates" backLabel="Back to templates" />
      <TemplateEditor initial={{ name: "", subject: "", bodyText: "" }} />
    </div>
  );
}
