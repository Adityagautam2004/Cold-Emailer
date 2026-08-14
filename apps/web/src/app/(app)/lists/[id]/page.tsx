import { redirect } from "next/navigation";
import { prisma } from "@dispatch/db";
import { NotFoundError } from "@/lib/api-errors";
import { getOwnedList } from "@/lib/lists";
import { requireUser } from "@/lib/require-user";
import { ContactTable } from "./contact-table";

export default async function ListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  let list;
  try {
    list = await getOwnedList(user.id, id);
  } catch (err) {
    if (err instanceof NotFoundError) redirect("/lists");
    throw err;
  }

  const contacts = await prisma.contact.findMany({
    where: { listId: list.id },
    orderBy: { rowNumber: "asc" },
    select: { id: true, email: true, hrName: true, company: true, title: true, status: true, rowNumber: true },
  });

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">{list.name}</h1>
      <p className="mt-2 font-mono text-sm text-muted">
        {list.sourceFilename} · {list.rowCount} contacts
      </p>

      <div className="mt-8">
        <ContactTable contacts={contacts} />
      </div>
    </div>
  );
}
