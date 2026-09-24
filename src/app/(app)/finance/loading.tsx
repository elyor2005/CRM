import { CardSkeleton, TableRowSkeleton } from "@/components/ui/Skeleton";

export default function FinanceLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-8 w-36 bg-gray-200 dark:bg-zinc-800 rounded-xl animate-pulse" />
        <div className="h-10 w-36 bg-gray-200 dark:bg-zinc-800 rounded-xl animate-pulse" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
      <div className="bg-white dark:bg-[#131823] rounded-2xl border border-gray-200/80 dark:border-zinc-800 divide-y divide-gray-100 dark:divide-zinc-800">
        <TableRowSkeleton />
        <TableRowSkeleton />
        <TableRowSkeleton />
      </div>
    </div>
  );
}
