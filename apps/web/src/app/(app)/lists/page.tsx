import Link from "next/link";
import { prisma } from "@dispatch/db";
import { requireUser } from "@/lib/require-user";
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
      <div className="flex items-center justify-between">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">Lists</h1>
        <Link
          href="/lists/import"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-text transition-standard hover:opacity-90"
        >
          Import a list
        </Link>
      </div>

      <ListTable lists={lists} />
    </div>
  );
}
