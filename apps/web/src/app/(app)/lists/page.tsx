import { prisma } from "@dispatch/db";
import { requireUser } from "@/lib/require-user";
import { PageHeader } from "@/components/ui/page-header";
import { LinkButton } from "@/components/ui/button";
import { ListTable } from "./list-table";

export default async function ListsPage() {
  const user = await requireUser();
  const lists = await prisma.contactList.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, sourceFilename: true, rowCount: true, createdAt: true },
  });

  return (
    <div>
      <PageHeader title="Lists" actions={<LinkButton href="/lists/import">Import a list</LinkButton>} />
      <ListTable lists={lists} />
    </div>
  );
}
