import { TemplateEditor } from "../template-editor";

export default function NewTemplatePage() {
  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">New template</h1>
      <div className="mt-8">
        <TemplateEditor initial={{ name: "", subject: "", bodyText: "" }} />
      </div>
    </div>
  );
}
