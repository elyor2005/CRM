import { CardSkeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      <div className="h-8 w-48 bg-gray-200 dark:bg-zinc-800 rounded-xl animate-pulse" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}
