import { prisma } from "@dispatch/db";
import { requireUser } from "@/lib/require-user";
import { ensureSeedTemplates } from "@/lib/templates";
import { TemplateList } from "./template-list";

export default async function TemplatesPage() {
  const user = await requireUser();
  await ensureSeedTemplates(user.id);

  const templates = await prisma.template.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">Templates</h1>
          <p className="mt-2 text-sm text-muted">
            Every campaign needs at least one recipient-side variable — a template with none
            can be saved, but can&apos;t start a campaign.
          </p>
        </div>
      </div>

      <div className="mt-8">
        <TemplateList templates={templates} />
      </div>
    </div>
  );
}
