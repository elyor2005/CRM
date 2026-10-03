"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Users, Search, Plus, ArrowUpDown, ArrowUp, ArrowDown, Download, Edit, Trash2, Archive, RotateCcw } from "lucide-react";
import { formatUZS, formatDateShort } from "@/lib/format";
import {
  getClientsWithDebt,
  createClient,
  updateClient,
  deleteClient,
  checkClientDeletionStatus,
  archiveClient,
  unarchiveClient,
} from "@/app/actions/clients";
import { undoAction } from "@/app/actions/audit";
import { useLanguage } from "@/lib/i18n/context";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Table, TableRow } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { TableRowSkeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { ModalSheet } from "@/components/ui/ModalSheet";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { formatDateInput } from "@/lib/format";
import { exportToExcel } from "@/lib/exportExcel";

type ClientWithDebt = Awaited<ReturnType<typeof getClientsWithDebt>>[number];

type SortField = "name" | "district" | "totalSalesValue" | "totalPaid" | "debt" | "lastSaleDate" | "status";
type SortDir = "asc" | "desc";
type ClientTab = "ACTIVE" | "ARCHIVED" | "ALL";

export default function DebtsPage() {
  const { language, t } = useLanguage();
  const [clients, setClients] = useState<ClientWithDebt[]>([]);
  const [clientTab, setClientTab] = useState<ClientTab>("ACTIVE");
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { showToast, dismissToast } = useToast();

  // Sort state (Task 3b)
  const [sortField, setSortField] = useState<SortField>("debt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // New client form state (Task 3c / Task 6)
  const [newClientSheet, setNewClientSheet] = useState(false);
  const [formName, setFormName] = useState("");
  const [formDistrict, setFormDistrict] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formVisitFrequency, setFormVisitFrequency] = useState("");
  const [formOpeningDebt, setFormOpeningDebt] = useState("");

  const loadData = (tab: ClientTab = clientTab) => {
    startTransition(async () => {
      const data = await getClientsWithDebt({ tab });
      setClients(data);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadData(clientTab);
  }, [clientTab]); // eslint-disable-line react-hooks/exhaustive-deps


  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.district && c.district.toLowerCase().includes(search.toLowerCase()))
  );

  // Sorting (Task 3b)
  const sorted = [...filtered].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortField) {
      case "name":
        return dir * a.name.localeCompare(b.name);
      case "district":
        return dir * ((a.district || "").localeCompare(b.district || ""));
      case "totalSalesValue":
        return dir * (a.totalSalesValue - b.totalSalesValue);
      case "totalPaid":
        return dir * (a.totalPaid - b.totalPaid);
      case "debt":
        return dir * (a.debt - b.debt);
      case "lastSaleDate":
        return dir * ((a.lastSaleDate?.getTime() || 0) - (b.lastSaleDate?.getTime() || 0));
      case "status": {
        const statusA = a.debt > 0 ? 2 : a.debt < 0 ? 0 : 1;
        const statusB = b.debt > 0 ? 2 : b.debt < 0 ? 0 : 1;
        return dir * (statusA - statusB);
      }
      default:
        return 0;
    }
  });

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir(field === "name" || field === "district" ? "asc" : "desc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown size={12} className="opacity-30" />;
    return sortDir === "asc"
      ? <ArrowUp size={12} className="text-indigo-600 dark:text-indigo-400" />
      : <ArrowDown size={12} className="text-indigo-600 dark:text-indigo-400" />;
  };

  const totalDebt = clients.reduce((sum, c) => sum + (c.debt > 0 ? c.debt : 0), 0);

  const getDebtBadge = (debt: number) => {
    if (debt > 0) return { label: t("debts.debtor"), variant: "debt" as const };
    if (debt < 0) return { label: t("debts.overpaid"), variant: "overpaid" as const };
    return { label: t("debts.settled"), variant: "settled" as const };
  };

  const handleAddClient = () => {
    if (!formName.trim()) return;
    startTransition(async () => {
      try {
        await createClient({
          name: formName.trim(),
          district: formDistrict.trim(),
          phone: formPhone.trim(),
          address: formAddress.trim(),
          visitFrequency: formVisitFrequency,
          openingDebt: formOpeningDebt,
        });
        showToast(t("common.add"));
        setNewClientSheet(false);
        setFormName("");
        setFormDistrict("");
        setFormPhone("");
        setFormAddress("");
        setFormVisitFrequency("");
        setFormOpeningDebt("");
        loadData();
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Error", "error");
      }
    });
  };

  // Edit client state (Part 1 Item 2)
  const [editClientSheet, setEditClientSheet] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientWithDebt | null>(null);
  const [editName, setEditName] = useState("");
  const [editDistrict, setEditDistrict] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editVisitFrequency, setEditVisitFrequency] = useState("");

  const startEditClient = (c: ClientWithDebt) => {
    setEditingClient(c);
    setEditName(c.name);
    setEditDistrict(c.district || "");
    setEditPhone(c.phone || "");
    setEditAddress(c.address || "");
    setEditVisitFrequency(c.visitFrequency ? String(c.visitFrequency) : "");
    setEditClientSheet(true);
  };

  const handleUpdateClient = () => {
    if (!editingClient || !editName.trim()) return;
    startTransition(async () => {
      try {
        await updateClient(editingClient.id, {
          name: editName.trim(),
          district: editDistrict.trim(),
          phone: editPhone.trim(),
          address: editAddress.trim(),
          visitFrequency: editVisitFrequency,
        });
        showToast("Данные клиента сохранены");
        setEditClientSheet(false);
        setEditingClient(null);
        loadData();
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Ошибка", "error");
      }
    });
  };

  // Delete confirm dialog state
  const [deleteConfirmState, setDeleteConfirmState] = useState<{
    open: boolean;
    client: ClientWithDebt | null;
    canDelete: boolean;
    message: string;
  }>({
    open: false,
    client: null,
    canDelete: false,
    message: "",
  });

  const handleDeleteClick = async (c: ClientWithDebt) => {
    const status = await checkClientDeletionStatus(c.id);
    if (!status.canDelete) {
      setDeleteConfirmState({
        open: true,
        client: c,
        canDelete: false,
        message:
          status.reason ||
          `У клиента "${c.name}" есть история операций (продажи, оплаты или финансы). Удаление невозможно.`,
      });
    } else {
      setDeleteConfirmState({
        open: true,
        client: c,
        canDelete: true,
        message: `Вы уверены, что хотите удалить клиента "${c.name}"? Это действие нельзя отменить.`,
      });
    }
  };

  const handleConfirmDelete = (c: ClientWithDebt) => {
    startTransition(async () => {
      try {
        const res = await deleteClient(c.id);
        if (res.error) {
          showToast(res.error, "error");
          return;
        }
        loadData();

        const msg = language === "ru" ? `Клиент "${c.name}" удален` : language === "uz" ? `"${c.name}" mijozi o'chirildi` : `Client "${c.name}" deleted`;
        const undoLabel = language === "ru" ? "Отменить" : language === "uz" ? "Bekor qilish" : "Undo";

        if (res?.logId) {
          showToast(msg, {
            type: "info",
            duration: 5000,
            action: {
              label: undoLabel,
              onClick: async () => {
                await undoAction(res.logId!);
                loadData();
                showToast(
                  language === "ru" ? "Действие отменено" : language === "uz" ? "Bekor qilindi" : "Action undone",
                  "success"
                );
              },
            },
          });
        } else {
          showToast(msg, "success");
        }
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Ошибка удаления", "error");
      }
    });
  };


  // Archive confirm dialog state
  const [archiveConfirmState, setArchiveConfirmState] = useState<{
    open: boolean;
    client: ClientWithDebt | null;
  }>({
    open: false,
    client: null,
  });

  const handleArchiveClick = (c: ClientWithDebt) => {
    setArchiveConfirmState({
      open: true,
      client: c,
    });
  };

  const handleConfirmArchive = (c: ClientWithDebt) => {
    startTransition(async () => {
      try {
        await archiveClient(c.id);
        showToast("Клиент перемещён в архив");
        loadData(clientTab);
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Ошибка архивации", "error");
      }
    });
  };

  const handleUnarchive = (c: ClientWithDebt) => {
    startTransition(async () => {
      try {
        await unarchiveClient(c.id);
        showToast("Клиент возвращён из архива");
        loadData(clientTab);
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Ошибка", "error");
      }
    });
  };

  const sortableHeader = (label: string, field: SortField) => (
    <button
      onClick={() => toggleSort(field)}
      className="flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer w-full"
    >
      <span>{label}</span>
      <SortIcon field={field} />
    </button>
  );

  const handleExportExcel = () => {
    const headers = [
      t("common.name"),
      t("common.district"),
      `${t("debts.totalSales")} (${t("common.sum")})`,
      `${t("debts.totalPaid")} (${t("common.sum")})`,
      `${t("debts.currentDebt")} (${t("common.sum")})`,
      t("debts.lastSale"),
      t("common.status"),
    ];

    const rows = sorted.map((client) => [
      client.name,
      client.district || "—",
      client.totalSalesValue,
      client.totalPaid,
      client.debt,
      client.lastSaleDate ? formatDateShort(client.lastSaleDate, language) : "—",
      client.debt > 0 ? t("debts.debtor") : client.debt < 0 ? t("debts.overpaid") : t("debts.settled"),
    ]);

    const summaryRows = [
      [],
      [t("common.total"), "", "", "", totalDebt, "", ""],
    ];

    exportToExcel(`Клиенты_${formatDateInput(new Date())}`, [
      {
        name: "Клиенты",
        data: [headers, ...rows, ...summaryRows],
      },
    ]);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("clients.title")}
        subtitle={
          totalDebt > 0 ? (
            <span>
              {t("debts.totalDebt")}:{" "}
              <strong className="text-orange-600 dark:text-orange-400 font-extrabold tabular-nums">
                {formatUZS(totalDebt)} {t("common.sum")}
              </strong>
            </span>
          ) : undefined
        }
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="md"
              onClick={handleExportExcel}
              disabled={sorted.length === 0}
              className="min-h-[44px] gap-2 px-3.5 bg-white dark:bg-[#131823] border-gray-200/80 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/60 shadow-xs"
            >
              <Download size={16} className="text-gray-500 dark:text-zinc-400" />
              <span className="text-xs sm:text-sm font-bold">{t("common.exportExcel")}</span>
            </Button>
            <Button onClick={() => setNewClientSheet(true)} size="md">
              <Plus size={18} /> {t("clients.addClient")}
            </Button>
          </div>
        }
      />

      {/* Tabs & Search Input */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="w-full sm:w-auto max-w-xs">
          <SegmentedControl
            value={clientTab}
            onChange={(v) => setClientTab(v as ClientTab)}
            options={[
              { value: "ACTIVE", label: "Активные" },
              { value: "ARCHIVED", label: "В архиве" },
              { value: "ALL", label: "Все" },
            ]}
          />
        </div>
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#1E2638] border border-gray-200/80 dark:border-zinc-800 rounded-xl text-base sm:text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/80 text-gray-900 dark:text-white"
            placeholder={`${t("clients.title")}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Client List */}
      {loading ? (
        <div className="bg-white dark:bg-[#131823] rounded-2xl border border-gray-200/80 dark:border-zinc-800 divide-y divide-gray-100 dark:divide-zinc-800">
          <TableRowSkeleton />
          <TableRowSkeleton />
          <TableRowSkeleton />
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={<Users size={28} />}
          title={t("common.noData")}
        />
      ) : (
        <Table
          headers={[
            sortableHeader(t("common.name"), "name"),
            sortableHeader(t("common.district"), "district"),
            sortableHeader(t("debts.totalSales"), "totalSalesValue"),
            sortableHeader(t("debts.totalPaid"), "totalPaid"),
            sortableHeader(t("debts.currentDebt"), "debt"),
            sortableHeader(t("debts.lastSale"), "lastSaleDate"),
            sortableHeader(t("common.status"), "status"),
            "Действия",
          ]}
          alignments={["left", "left", "right", "right", "right", "right", "center", "center"]}
        >
          {sorted.map((client) => {
            const badge = getDebtBadge(client.debt);
            return (
              <TableRow
                key={client.id}
                onClick={() => router.push(`/debts/${client.id}`)}
              >
                <td className="p-3.5 sm:p-4">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-gray-900 dark:text-white">{client.name}</span>
                    {client.isArchived && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-900/40">
                        Архив
                      </span>
                    )}
                  </div>
                  {client.last30DaysSalesSum > 0 && (
                    <div className="text-xs text-gray-500 dark:text-zinc-400 tabular-nums">
                      30d: {formatUZS(client.last30DaysSalesSum)}
                    </div>
                  )}
                </td>
                <td className="p-3.5 sm:p-4 text-gray-600 dark:text-zinc-400 font-medium">
                  {client.district || "—"}
                </td>
                <td className="p-3.5 sm:p-4 text-right whitespace-nowrap text-gray-700 dark:text-zinc-300 font-semibold tabular-nums">
                  {formatUZS(client.totalSalesValue)}
                </td>
                <td className="p-3.5 sm:p-4 text-right whitespace-nowrap text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">
                  {formatUZS(client.totalPaid)}
                </td>
                <td
                  className={`p-3.5 sm:p-4 text-right whitespace-nowrap font-extrabold tabular-nums ${
                    client.debt > 0
                      ? "text-orange-600 dark:text-orange-400"
                      : client.debt < 0
                      ? "text-indigo-600 dark:text-indigo-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {formatUZS(client.debt)}
                </td>
                <td className="p-3.5 sm:p-4 text-right whitespace-nowrap text-xs text-gray-500 dark:text-zinc-400 font-medium">
                  {client.lastSaleDate ? formatDateShort(client.lastSaleDate, language) : "—"}
                </td>
                <td className="p-3.5 sm:p-4 text-center">
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                </td>
                <td className="p-3.5 sm:p-4 text-center" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-center gap-1.5">
                    <button
                      onClick={() => startEditClient(client)}
                      className="p-1.5 rounded-lg bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
                      title="Редактировать"
                    >
                      <Edit size={14} />
                    </button>
                    {client.isArchived ? (
                      <button
                        onClick={() => handleUnarchive(client)}
                        className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-900/60 transition-colors"
                        title="Вернуть из архива"
                      >
                        <RotateCcw size={14} />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleArchiveClick(client)}
                        className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-colors"
                        title="Архивировать"
                      >
                        <Archive size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteClick(client)}
                      className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors"
                      title="Удалить"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </TableRow>
            );
          })}
        </Table>
      )}

      {/* New Client ModalSheet */}
      <ModalSheet
        open={newClientSheet}
        onClose={() => setNewClientSheet(false)}
        title={t("clients.addClient")}
      >
        <div className="flex flex-col gap-4">
          <Input
            label={t("common.name")}
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="ООО Азия Трейд"
            autoFocus
          />
          <Input
            label={t("common.district")}
            value={formDistrict}
            onChange={(e) => setFormDistrict(e.target.value)}
            placeholder="Чиланзар"
          />
          <Input
            label={t("common.phone")}
            value={formPhone}
            onChange={(e) => setFormPhone(e.target.value)}
            placeholder="+998 90 123 45 67"
          />
          <Input
            label={t("common.address")}
            value={formAddress}
            onChange={(e) => setFormAddress(e.target.value)}
            placeholder="ул. Амира Темура 1"
          />
          <Input
            label={t("common.visitFrequency")}
            type="number"
            min="1"
            value={formVisitFrequency}
            onChange={(e) => setFormVisitFrequency(e.target.value)}
            placeholder="7"
          />
          <Input
            label={t("common.openingDebt")}
            type="number"
            min="0"
            value={formOpeningDebt}
            onChange={(e) => setFormOpeningDebt(e.target.value)}
            placeholder="0"
          />
          <Button onClick={handleAddClient} loading={isPending} size="lg">
            {t("common.save")}
          </Button>
        </div>
      </ModalSheet>

      {/* Edit Client ModalSheet (Part 1 Item 2) */}
      <ModalSheet
        open={editClientSheet}
        onClose={() => setEditClientSheet(false)}
        title="Редактировать клиента"
      >
        <div className="flex flex-col gap-4">
          <Input
            label={t("common.name")}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="Имя клиента"
            autoFocus
          />
          <Input
            label={t("common.district")}
            value={editDistrict}
            onChange={(e) => setEditDistrict(e.target.value)}
            placeholder="Район"
          />
          <Input
            label={t("common.phone")}
            value={editPhone}
            onChange={(e) => setEditPhone(e.target.value)}
            placeholder="+998 90 123 45 67"
          />
          <Input
            label={t("common.address")}
            value={editAddress}
            onChange={(e) => setEditAddress(e.target.value)}
            placeholder="Адрес"
          />
          <Input
            label={t("common.visitFrequency")}
            type="number"
            min="1"
            value={editVisitFrequency}
            onChange={(e) => setEditVisitFrequency(e.target.value)}
            placeholder="7"
          />
          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={handleUpdateClient}
            disabled={!editName.trim()}
            loading={isPending}
          >
            {t("common.save")}
          </Button>
        </div>
      </ModalSheet>

      <ConfirmDialog
        open={deleteConfirmState.open}
        title={deleteConfirmState.canDelete ? "Удаление клиента" : "Невозможно удалить клиента"}
        message={deleteConfirmState.message}
        confirmLabel={deleteConfirmState.canDelete ? "Удалить" : "Понятно"}
        cancelLabel="Отмена"
        destructive={deleteConfirmState.canDelete}
        hideCancel={!deleteConfirmState.canDelete}
        extraAction={
          !deleteConfirmState.canDelete && !deleteConfirmState.client?.isArchived
            ? {
                label: "Архивировать вместо удаления",
                variant: "primary",
                onClick: () => {
                  const clientToArchive = deleteConfirmState.client;
                  setDeleteConfirmState((prev) => ({ ...prev, open: false }));
                  if (clientToArchive) {
                    setArchiveConfirmState({ open: true, client: clientToArchive });
                  }
                },
              }
            : undefined
        }
        onConfirm={() => {
          const clientToDelete = deleteConfirmState.client;
          const shouldDelete = deleteConfirmState.canDelete;
          setDeleteConfirmState((prev) => ({ ...prev, open: false }));
          if (shouldDelete && clientToDelete) {
            handleConfirmDelete(clientToDelete);
          }
        }}
        onCancel={() => setDeleteConfirmState((prev) => ({ ...prev, open: false }))}
      />

      <ConfirmDialog
        open={archiveConfirmState.open}
        title="Архивация клиента"
        message={`Переместить клиента "${archiveConfirmState.client?.name}" в архив? Его долг перестанет учитываться в общих отчётах, но вся история сохранится.`}
        confirmLabel="Архивировать"
        cancelLabel="Отмена"
        onConfirm={() => {
          const clientToArchive = archiveConfirmState.client;
          setArchiveConfirmState({ open: false, client: null });
          if (clientToArchive) {
            handleConfirmArchive(clientToArchive);
          }
        }}
        onCancel={() => setArchiveConfirmState({ open: false, client: null })}
      />
    </div>
  );
}

