"use client";

import { useState, useEffect, useTransition } from "react";
import { Plus, ShoppingCart, RotateCcw, Trash2, Download } from "lucide-react";
import { formatUZS, formatDateShort, formatDateInput } from "@/lib/format";
import { ModalSheet } from "@/components/ui/ModalSheet";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { getSales, getProducts, createSale, deleteSale } from "@/app/actions/sales";
import { getClients, createClient } from "@/app/actions/clients";
import { useLanguage } from "@/lib/i18n/context";
import { exportToExcel } from "@/lib/exportExcel";
import type { SaleType } from "@prisma/client";

type SaleWithRelations = Awaited<ReturnType<typeof getSales>>[number];
type Product = Awaited<ReturnType<typeof getProducts>>[number];
type Client = Awaited<ReturnType<typeof getClients>>[number];

interface LineItem {
  id: string;
  productId: string;
  quantity: string;
  unitPrice: string;
  isFreebie: boolean;
  freebieFor: string;
}

function emptyLine(): LineItem {
  return {
    id: Math.random().toString(36).slice(2),
    productId: "",
    quantity: "1",
    unitPrice: "",
    isFreebie: false,
    freebieFor: "",
  };
}

export default function SalesPage() {
  const { language, t } = useLanguage();
  const [sales, setSales] = useState<SaleWithRelations[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  // Form state
  const [formType, setFormType] = useState<SaleType>("SALE");
  const [formClientId, setFormClientId] = useState("");
  const [formDate, setFormDate] = useState(formatDateInput(new Date()));
  const [formPayment, setFormPayment] = useState("");
  const [formItems, setFormItems] = useState<LineItem[]>([emptyLine()]);
  const [formErrors, setFormErrors] = useState<string[]>([]);

  // New client inline
  const [newClientSheet, setNewClientSheet] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientDistrict, setNewClientDistrict] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientAddress, setNewClientAddress] = useState("");
  const [newClientVisitFreq, setNewClientVisitFreq] = useState("");

  const loadData = () => {
    startTransition(async () => {
      const [s, p, c] = await Promise.all([getSales(), getProducts(), getClients()]);
      setSales(s);
      setProducts(p);
      setClients(c);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const resetForm = () => {
    setFormType("SALE");
    setFormClientId("");
    setFormDate(formatDateInput(new Date()));
    setFormPayment("");
    setFormItems([emptyLine()]);
    setFormErrors([]);
  };

  const openNewSale = () => {
    resetForm();
    setSheetOpen(true);
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: string | boolean) => {
    setFormItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        if (field === "productId" && typeof value === "string") {
          const product = products.find((p) => p.id === value);
          if (product?.salePrice) {
            updated.unitPrice = String(Number(product.salePrice));
          }
        }
        if (field === "isFreebie" && value === true) {
          updated.unitPrice = "0";
        }
        return updated;
      })
    );
  };

  const removeLineItem = (id: string) => {
    if (formItems.length <= 1) return;
    setFormItems((prev) => prev.filter((item) => item.id !== id));
  };

  const addLineItem = () => {
    setFormItems((prev) => [...prev, emptyLine()]);
  };

  const saleTotal = formItems.reduce((sum, item) => {
    if (item.isFreebie) return sum;
    return sum + Number(item.quantity || 0) * Number(item.unitPrice || 0);
  }, 0);

  const handleSubmit = () => {
    const errors: string[] = [];
    if (!formClientId) errors.push(t("sales.selectClient"));
    if (formItems.some((i) => !i.productId)) errors.push(t("sales.product"));
    if (formItems.some((i) => Number(i.quantity) <= 0)) errors.push(t("sales.quantity"));

    if (errors.length > 0) {
      setFormErrors(errors);
      return;
    }

    startTransition(async () => {
      try {
        await createSale({
          clientId: formClientId,
          type: formType,
          date: formDate,
          payment: formPayment || "0",
          items: formItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.isFreebie ? "0" : item.unitPrice,
            isFreebie: item.isFreebie,
            freebieFor: item.freebieFor,
          })),
        });

        showToast(formType === "SALE" ? t("sales.newSale") : t("sales.returnType"));
        setSheetOpen(false);
        resetForm();
        loadData();
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Error", "error");
      }
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      try {
        await deleteSale(id);
        showToast(t("common.delete"));
        setDeleteConfirm(null);
        loadData();
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Error", "error");
      }
    });
  };

  const handleAddClient = () => {
    if (!newClientName.trim()) return;
    startTransition(async () => {
      try {
        const client = await createClient({
          name: newClientName.trim(),
          district: newClientDistrict.trim(),
          phone: newClientPhone.trim(),
          address: newClientAddress.trim(),
          visitFrequency: newClientVisitFreq,
        });
        setFormClientId(client.id);
        setClients((prev) => [...prev, client].sort((a, b) => a.name.localeCompare(b.name)));
        setNewClientSheet(false);
        setNewClientName("");
        setNewClientDistrict("");
        setNewClientPhone("");
        setNewClientAddress("");
        setNewClientVisitFreq("");
        showToast(t("common.add"));
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Error", "error");
      }
    });
  };
  // Date range state for sales summary (Task 2)
  const [salesDatePreset, setSalesDatePreset] = useState<"ALL" | "TODAY" | "7D" | "30D" | "MONTH" | "CUSTOM">("ALL");
  const [salesCustomFrom, setSalesCustomFrom] = useState("");
  const [salesCustomTo, setSalesCustomTo] = useState("");

  const getSalesDateRange = () => {
    const now = new Date();
    const today = formatDateInput(now);
    switch (salesDatePreset) {
      case "TODAY": return { from: today, to: today };
      case "7D": { const d = new Date(now); d.setDate(d.getDate() - 7); return { from: formatDateInput(d), to: today }; }
      case "30D": { const d = new Date(now); d.setDate(d.getDate() - 30); return { from: formatDateInput(d), to: today }; }
      case "MONTH": { const d = new Date(now.getFullYear(), now.getMonth(), 1); return { from: formatDateInput(d), to: today }; }
      case "CUSTOM": return { from: salesCustomFrom || undefined, to: salesCustomTo || undefined };
      default: return {};
    }
  };

  const salesDateRange = getSalesDateRange();

  const filteredSales = sales.filter((sale) => {
    if (!salesDateRange.from && !salesDateRange.to) return true;
    const saleDate = formatDateInput(new Date(sale.date));
    if (salesDateRange.from && saleDate < salesDateRange.from) return false;
    if (salesDateRange.to && saleDate > salesDateRange.to) return false;
    return true;
  });

  const totalSalesSum = filteredSales
    .filter(s => s.type === "SALE")
    .reduce((sum, s) => sum + s.items.reduce((a, i) => a + Number(i.lineTotal), 0), 0);

  const totalReturnsSum = filteredSales
    .filter(s => s.type === "RETURN")
    .reduce((sum, s) => sum + s.items.reduce((a, i) => a + Number(i.lineTotal), 0), 0);

  const handleExportExcel = () => {
    const headers = [
      t("common.date"),
      t("common.type"),
      t("sales.client"),
      t("sales.items"),
      `${t("sales.salesSum")} (${t("common.sum")})`,
      `${t("sales.paidAmount")} (${t("common.sum")})`,
      `${t("sales.debtRemaining")} (${t("common.sum")})`,
    ];

    const rows = filteredSales.map((sale) => {
      const total = sale.items.reduce((s, i) => s + Number(i.lineTotal), 0);
      const paid = Number(sale.payment);
      const debt = Math.max(0, total - paid);
      const itemsStr = sale.items
        .map((i) => {
          if (i.product.name === "__OPENING_BALANCE__" || i.freebieFor === "Начальный долг") {
            return `${t("common.openingDebt")}: ${formatUZS(i.lineTotal)}`;
          }
          return (
            `${i.product.name} × ${Number(i.quantity)} ${i.product.unit}` +
            (i.isFreebie ? ` (${t("sales.freebie")}: ${i.freebieFor || ""})` : "")
          );
        })
        .join("; ");

      return [
        formatDateShort(sale.date, language),
        sale.type === "SALE" ? t("sales.saleType") : t("sales.returnType"),
        sale.client.name,
        itemsStr,
        sale.type === "SALE" ? total : -total,
        paid,
        debt,
      ];
    });

    const summaryRows = [
      [],
      [t("common.total"), "", "", "", "", "", ""],
      [t("sales.salesSum"), totalSalesSum],
      [t("sales.returnsSum"), totalReturnsSum],
      [language === "ru" ? "Чистая сумма" : "Net Total", totalSalesSum - totalReturnsSum],
    ];

    exportToExcel(`Продажи_${formatDateInput(new Date())}`, [
      {
        name: "Продажи",
        data: [headers, ...rows, ...summaryRows],
      },
    ]);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("sales.title")}
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="md"
              onClick={handleExportExcel}
              disabled={filteredSales.length === 0}
              className="min-h-[44px] gap-2 px-3.5 bg-white dark:bg-[#131823] border-gray-200/80 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/60 shadow-xs"
            >
              <Download size={16} className="text-gray-500 dark:text-zinc-400" />
              <span className="text-xs sm:text-sm font-bold">{t("common.exportExcel")}</span>
            </Button>
            <Button onClick={openNewSale} size="md">
              <Plus size={18} /> {t("sales.newSale")}
            </Button>
          </div>
        }
      />

      {/* Sales Summary Row (Task 2) */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {(["ALL", "TODAY", "7D", "30D", "MONTH", "CUSTOM"] as const).map((preset) => {
            const labels: Record<string, string> = {
              ALL: t("common.all"),
              TODAY: t("common.today"),
              "7D": t("common.days7"),
              "30D": t("common.days30"),
              MONTH: t("common.thisMonth"),
              CUSTOM: t("common.custom"),
            };
            return (
              <button
                key={preset}
                onClick={() => setSalesDatePreset(preset)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  salesDatePreset === preset
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-700"
                }`}
              >
                {labels[preset]}
              </button>
            );
          })}
        </div>

        {salesDatePreset === "CUSTOM" && (
          <div className="grid grid-cols-2 gap-3 max-w-md">
            <Input label={t("common.from")} type="date" value={salesCustomFrom} onChange={(e) => setSalesCustomFrom(e.target.value)} />
            <Input label={t("common.to")} type="date" value={salesCustomTo} onChange={(e) => setSalesCustomTo(e.target.value)} />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3.5 max-w-lg">
          <Card className="p-4 text-center">
            <div className="text-xs font-bold uppercase text-gray-500 dark:text-zinc-400 mb-1">{t("sales.salesSum")}</div>
            <div className="text-lg sm:text-xl font-extrabold text-indigo-600 dark:text-indigo-400 tabular-nums">{formatUZS(totalSalesSum)}</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-xs font-bold uppercase text-gray-500 dark:text-zinc-400 mb-1">{t("sales.returnsSum")}</div>
            <div className="text-lg sm:text-xl font-extrabold text-rose-600 dark:text-rose-400 tabular-nums">{formatUZS(totalReturnsSum)}</div>
          </Card>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-200/80 dark:border-zinc-800/60" />

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : filteredSales.length === 0 ? (
        <EmptyState
          icon={<ShoppingCart size={28} />}
          title={t("common.noData")}
          description={t("sales.newSale")}
          actionLabel={t("sales.newSale")}
          onAction={openNewSale}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSales.map((sale) => {
            const total = sale.items.reduce((s, i) => s + Number(i.lineTotal), 0);
            return (
              <Card
                key={sale.id}
                hoverable
                onClick={() => setDeleteConfirm(sale.id)}
                className="flex flex-col justify-between gap-3 p-5"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-extrabold text-base text-gray-900 dark:text-white truncate">
                      {sale.client.name}
                    </span>
                    <Badge variant={sale.type === "SALE" ? "sale" : "return"}>
                      {sale.type === "SALE" ? t("sales.saleType") : t("sales.returnType")}
                    </Badge>
                  </div>
                  <div className="text-xs font-medium text-gray-500 dark:text-zinc-400">
                    {formatDateShort(sale.date, language)}
                    {sale.items.length > 0 && ` · ${sale.items.length} ${t("sales.lineItems")}`}
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-100 dark:border-zinc-800/80 flex items-baseline justify-between">
                  <div>
                    {Number(sale.payment) > 0 && (
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {t("sales.paidAmount")}: {formatUZS(sale.payment)}
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-extrabold text-gray-900 dark:text-white tracking-tight tabular-nums">
                      {formatUZS(total)}
                    </span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Floating Action Button (Mobile) */}
      <button
        onClick={openNewSale}
        className="md:hidden fixed bottom-20 right-4 z-40 w-14 h-14 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        <Plus size={26} />
      </button>

      {/* New Sale ModalSheet */}
      <ModalSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={formType === "SALE" ? t("sales.newSale") : t("sales.returnType")}
      >
        <div className="flex flex-col gap-4">
          <SegmentedControl
            value={formType}
            onChange={setFormType}
            options={[
              { value: "SALE", label: t("sales.saleType") },
              { value: "RETURN", label: t("sales.returnType") },
            ]}
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
              {t("sales.client")}
            </label>
            <SearchableSelect
              options={clients.map((c) => ({ id: c.id, label: c.name, subtitle: c.phone || undefined }))}
              value={formClientId}
              onChange={setFormClientId}
              onAddNew={() => setNewClientSheet(true)}
              placeholder={t("sales.selectClient")}
            />
          </div>

          <Input
            type="date"
            label={t("common.date")}
            value={formDate}
            onChange={(e) => setFormDate(e.target.value)}
          />

          {/* Line items section */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                {t("sales.items")}
              </label>
              <button
                type="button"
                onClick={addLineItem}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                <Plus size={14} /> {t("common.add")}
              </button>
            </div>

            {formItems.map((item, index) => (
              <div
                key={item.id}
                className="p-3 bg-gray-50 dark:bg-[#1A202C] rounded-xl border border-gray-200/60 dark:border-zinc-800 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-gray-400">#{index + 1}</span>
                  {formItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLineItem(item.id)}
                      className="text-xs text-rose-500 hover:text-rose-700"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>

                <SearchableSelect
                  options={products.map((p) => ({
                    id: p.id,
                    label: p.name,
                    subtitle: p.salePrice ? formatUZS(p.salePrice) : undefined,
                  }))}
                  value={item.productId}
                  onChange={(val) => updateLineItem(item.id, "productId", val)}
                  placeholder={t("sales.product")}
                />

                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    placeholder={t("sales.quantity")}
                    value={item.quantity}
                    onChange={(e) => updateLineItem(item.id, "quantity", e.target.value)}
                  />
                  <Input
                    type="number"
                    placeholder={t("sales.price")}
                    value={item.unitPrice}
                    onChange={(e) => updateLineItem(item.id, "unitPrice", e.target.value)}
                    disabled={item.isFreebie}
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id={`freebie-${item.id}`}
                    checked={item.isFreebie}
                    onChange={(e) => updateLineItem(item.id, "isFreebie", e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor={`freebie-${item.id}`} className="text-xs font-semibold text-gray-700 dark:text-zinc-300">
                    {t("sales.freebie")}
                  </label>
                </div>

                {item.isFreebie && (
                  <Input
                    placeholder={t("sales.freebieFor")}
                    value={item.freebieFor}
                    onChange={(e) => updateLineItem(item.id, "freebieFor", e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>

          <Input
            type="number"
            label={t("sales.paidAmount")}
            value={formPayment}
            onChange={(e) => setFormPayment(e.target.value)}
            placeholder="0"
          />

          {formErrors.length > 0 && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-600 dark:text-rose-400 rounded-xl text-xs space-y-1">
              {formErrors.map((err, idx) => (
                <div key={idx}>{err}</div>
              ))}
            </div>
          )}

          {/* Form summary */}
          <div className="p-4 bg-indigo-50/60 dark:bg-indigo-950/30 rounded-xl border border-indigo-100 dark:border-indigo-900/40 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-zinc-400">
              {t("common.total")}
            </span>
            <span className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400 tabular-nums">
              {formatUZS(saleTotal)}
            </span>
          </div>

          <Button onClick={handleSubmit} loading={isPending} size="lg">
            {t("common.save")}
          </Button>
        </div>
      </ModalSheet>

      {/* Inline New Client ModalSheet */}
      <ModalSheet
        open={newClientSheet}
        onClose={() => setNewClientSheet(false)}
        title={t("sales.addNewClient")}
      >
        <div className="flex flex-col gap-4">
          <Input
            label={t("common.name")}
            value={newClientName}
            onChange={(e) => setNewClientName(e.target.value)}
            placeholder="ООО Азия Трейд"
            autoFocus
          />
          <Input
            label={t("common.district")}
            value={newClientDistrict}
            onChange={(e) => setNewClientDistrict(e.target.value)}
            placeholder="Чиланзар"
          />
          <Input
            label={t("common.phone")}
            value={newClientPhone}
            onChange={(e) => setNewClientPhone(e.target.value)}
            placeholder="+998 90 123 45 67"
          />
          <Input
            label={t("common.address")}
            value={newClientAddress}
            onChange={(e) => setNewClientAddress(e.target.value)}
            placeholder="ул. Амира Темура 1"
          />
          <Input
            label={t("common.visitFrequency")}
            type="number"
            min="1"
            value={newClientVisitFreq}
            onChange={(e) => setNewClientVisitFreq(e.target.value)}
            placeholder="7"
          />
          <Button onClick={handleAddClient} loading={isPending} size="lg">
            {t("common.save")}
          </Button>
        </div>
      </ModalSheet>

      {/* Confirm Delete */}
      <ConfirmDialog
        open={!!deleteConfirm}
        title={t("sales.deleteSale")}
        message={t("common.confirmDelete")}
        destructive
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}
