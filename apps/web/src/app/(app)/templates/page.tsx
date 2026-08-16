import { prisma } from "@dispatch/db";
import { requireUser } from "@/lib/require-user";
import { ensureSeedTemplates } from "@/lib/templates";
import { PageHeader } from "@/components/ui/page-header";
import { LinkButton } from "@/components/ui/button";
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
      <PageHeader
        title="Templates"
        description="Every campaign needs at least one recipient-side variable — a template with none can be saved, but can't start a campaign."
        actions={<LinkButton href="/templates/new">New template</LinkButton>}
      />
      <TemplateList templates={templates} />
    </div>
  );
}
