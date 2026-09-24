"use client";

import { useState, useEffect, useTransition } from "react";
import { ClipboardList } from "lucide-react";
import { formatDateShort } from "@/lib/format";
import { getAuditLogs } from "@/app/actions/audit";
import { useLanguage } from "@/lib/i18n/context";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table, TableRow } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { TableRowSkeleton } from "@/components/ui/Skeleton";

type AuditEntry = Awaited<ReturnType<typeof getAuditLogs>>[number];

const actionColors: Record<string, string> = {
  CREATE: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/40",
  UPDATE: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-900/40",
  DELETE: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200/50 dark:border-rose-900/40",
  PRODUCE: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 border border-purple-200/50 dark:border-purple-900/40",
  RESTOCK: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/40",
  WRITE_OFF: "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400 border border-orange-200/50 dark:border-orange-900/40",
};

export default function AuditPage() {
  const { language, t } = useLanguage();
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    startTransition(async () => {
      const data = await getAuditLogs(200);
      setLogs(data);
      setLoading(false);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      <PageHeader title={t("audit.title")} />

      {loading ? (
        <div className="bg-white dark:bg-[#131823] rounded-2xl border border-gray-200/80 dark:border-zinc-800 divide-y divide-gray-100 dark:divide-zinc-800">
          <TableRowSkeleton />
          <TableRowSkeleton />
          <TableRowSkeleton />
        </div>
      ) : logs.length === 0 ? (
        <EmptyState
          icon={<ClipboardList size={28} />}
          title={t("common.noData")}
        />
      ) : (
        <Table
          headers={[t("audit.time"), t("audit.action"), t("audit.entity"), t("common.description")]}
          alignments={["left", "left", "left", "left"]}
        >
          {logs.map((log) => {
            const time = new Date(log.createdAt);
            const timeStr = `${time.getHours().toString().padStart(2, "0")}:${time.getMinutes().toString().padStart(2, "0")}`;
            return (
              <TableRow key={log.id}>
                <td className="p-3.5 whitespace-nowrap text-gray-700 dark:text-zinc-300 font-medium">
                  <div className="text-sm font-semibold">{formatDateShort(log.createdAt, language)}</div>
                  <div className="text-xs text-gray-400 font-normal tabular-nums">{timeStr}</div>
                </td>
                <td className="p-3.5 whitespace-nowrap">
                  <span
                    className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold tracking-tight ${
                      actionColors[log.action] ||
                      "bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-zinc-300"
                    }`}
                  >
                    {log.action}
                  </span>
                </td>
                <td className="p-3.5 whitespace-nowrap text-gray-700 dark:text-zinc-300 font-bold">
                  {log.entity}
                  {log.entityId && (
                    <span className="text-xs font-normal text-gray-400 ml-1 font-mono">
                      #{log.entityId.slice(-6)}
                    </span>
                  )}
                </td>
                <td className="p-3.5 text-gray-900 dark:text-white font-medium">
                  {log.description}
                </td>
              </TableRow>
            );
          })}
        </Table>
      )}
    </div>
  );
}
