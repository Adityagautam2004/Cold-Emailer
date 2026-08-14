import Link from "next/link";
import { prisma } from "@dispatch/db";
import { requireUser } from "@/lib/require-user";

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

      {lists.length === 0 ? (
        <p className="mt-8 text-sm text-muted">
          No lists yet. Upload an Excel sheet with one HR contact per row.
        </p>
      ) : (
        <table className="mt-8 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Source file</th>
              <th className="py-2 pr-4">Contacts</th>
              <th className="py-2 pr-4">Imported</th>
            </tr>
          </thead>
          <tbody>
            {lists.map((l) => (
              <tr key={l.id} className="border-b border-line">
                <td className="py-2.5 pr-4">
                  <Link href={`/lists/${l.id}`} className="text-accent hover:underline">
                    {l.name}
                  </Link>
                </td>
                <td className="py-2.5 pr-4 font-mono text-muted">{l.sourceFilename}</td>
                <td className="py-2.5 pr-4 font-mono">{l.rowCount}</td>
                <td className="py-2.5 pr-4 font-mono text-muted">{new Date(l.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
