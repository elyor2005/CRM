"use client";

import { useState, useEffect, useTransition } from "react";
import { Plus, ShoppingCart, RotateCcw, Trash2 } from "lucide-react";
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
        const client = await createClient({ name: newClientName.trim() });
        setFormClientId(client.id);
        setClients((prev) => [...prev, client].sort((a, b) => a.name.localeCompare(b.name)));
        setNewClientSheet(false);
        setNewClientName("");
        showToast(t("common.add"));
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Error", "error");
      }
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("sales.title")}
        action={
          <Button onClick={openNewSale} size="md">
            <Plus size={18} /> {t("sales.newSale")}
          </Button>
        }
      />

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : sales.length === 0 ? (
        <EmptyState
          icon={<ShoppingCart size={28} />}
          title={t("common.noData")}
          description={t("sales.newSale")}
          actionLabel={t("sales.newSale")}
          onAction={openNewSale}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sales.map((sale) => {
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
