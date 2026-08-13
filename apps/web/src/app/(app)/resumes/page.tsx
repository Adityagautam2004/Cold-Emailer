import { prisma } from "@dispatch/db";
import { requireUser } from "@/lib/require-user";
import { ResumeManager } from "./resume-manager";

export default async function ResumesPage() {
  const user = await requireUser();

  const resumes = await prisma.resume.findMany({
    where: { userId: user.id },
    orderBy: { version: "desc" },
    select: {
      id: true,
      filename: true,
      sizeBytes: true,
      version: true,
      isActive: true,
      isArchived: true,
      createdAt: true,
    },
  });

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">Resumes</h1>
      <p className="mt-2 text-sm text-muted">
        The active resume is what gets attached to every campaign send. Upload a new
        version any time — old ones stay archived, never deleted, so campaigns that
        already reference them keep working.
      </p>

      <div className="mt-8">
        <ResumeManager initialResumes={resumes} />
      </div>
    </div>
  );
}
