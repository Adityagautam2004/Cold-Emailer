import { redirect } from "next/navigation";
import { requireUser } from "@/lib/require-user";
import { getOwnedTemplate } from "@/lib/templates";
import { NotFoundError } from "@/lib/api-errors";
import { TemplateEditor } from "../template-editor";

export default async function EditTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  let template;
  try {
    template = await getOwnedTemplate(user.id, id);
  } catch (err) {
    if (err instanceof NotFoundError) redirect("/templates");
    throw err;
  }

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">{template.name}</h1>
      <div className="mt-8">
        <TemplateEditor
          initial={{ id: template.id, name: template.name, subject: template.subject, bodyText: template.bodyText }}
        />
      </div>
    </div>
  );
}
