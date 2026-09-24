import { CardSkeleton } from "@/components/ui/Skeleton";

export default function WarehouseLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-8 w-36 bg-gray-200 dark:bg-zinc-800 rounded-xl animate-pulse" />
        <div className="h-10 w-32 bg-gray-200 dark:bg-zinc-800 rounded-xl animate-pulse" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}
