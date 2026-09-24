import { CardSkeleton } from "@/components/ui/Skeleton";

export default function ReportLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-40 bg-gray-200 dark:bg-zinc-800 rounded-xl animate-pulse" />
      <div className="h-10 w-48 bg-gray-200 dark:bg-zinc-800 rounded-xl animate-pulse" />
      <CardSkeleton />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}
