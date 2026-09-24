import { TableRowSkeleton } from "@/components/ui/Skeleton";

export default function AuditLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-40 bg-gray-200 dark:bg-zinc-800 rounded-xl animate-pulse" />
      <div className="bg-white dark:bg-[#131823] rounded-2xl border border-gray-200/80 dark:border-zinc-800 divide-y divide-gray-100 dark:divide-zinc-800">
        <TableRowSkeleton />
        <TableRowSkeleton />
        <TableRowSkeleton />
      </div>
    </div>
  );
}
