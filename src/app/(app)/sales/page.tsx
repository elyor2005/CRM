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
    <>
      <PageHeader
        title={t("sales.title")}
        action={
          <Button onClick={openNewSale} size="md">
            <Plus size={18} /> {t("sales.newSale")}
          </Button>
        }
      />

      {/* Sales grid */}
      {sales.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-gray-400 mb-3">
            <ShoppingCart size={28} />
          </div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            {t("common.noData")}
          </h3>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1 mb-4">
            {t("sales.newSale")}
          </p>
          <Button onClick={openNewSale} size="sm">
            <Plus size={16} /> {t("sales.newSale")}
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sales.map((sale) => {
            const total = sale.items.reduce((s, i) => s + Number(i.lineTotal), 0);
            return (
              <Card
                key={sale.id}
                hoverable
                onClick={() => setDeleteConfirm(sale.id)}
                className="flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-base text-gray-900 dark:text-white truncate">
                      {sale.client.name}
                    </span>
                    <Badge variant={sale.type === "SALE" ? "sale" : "return"}>
                      {sale.type === "SALE" ? t("sales.saleType") : t("sales.returnType")}
                    </Badge>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
                    {formatDateShort(sale.date, language)}
                    {sale.items.length > 0 && ` · ${sale.items.length} ${t("sales.lineItems")}`}
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-100 dark:border-zinc-800 flex items-baseline justify-between">
                  <div>
                    {Number(sale.payment) > 0 && (
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        {t("sales.paidAmount")}: {formatUZS(sale.payment)}
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-extrabold text-gray-900 dark:text-white tracking-tight">
                      {formatUZS(total)}{" "}
                      <span className="text-xs font-normal text-gray-500">{t("common.sum")}</span>
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
        className="md:hidden fixed bottom-20 right-4 z-40 w-14 h-14 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform"
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
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
              {t("sales.client")}
            </label>
            <SearchableSelect
              options={clients.map((c) => ({ id: c.id, label: c.name, subtitle: c.phone || undefined }))}
              value={formClientId}
              onChange={setFormClientId}
              onAddNew={() => setNewClientSheet(true)}
              placeholder={t("sales.selectClient")}
              addNewLabel={t("sales.addNewClient")}
            />
          </div>

          <Input
            label={t("common.date")}
            type="date"
            value={formDate}
            onChange={(e) => setFormDate(e.target.value)}
          />

          {/* Line items list */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
              {t("sales.items")}
            </label>

            <div className="flex flex-col gap-3">
              {formItems.map((item, idx) => (
                <div
                  key={item.id}
                  className="p-3 bg-gray-50 dark:bg-zinc-800/60 rounded-xl border border-gray-100 dark:border-zinc-800 flex flex-col gap-2.5"
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-gray-500">
                    <span>#{idx + 1}</span>
                    {formItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeLineItem(item.id)}
                        className="text-red-500 hover:text-red-600 font-medium"
                      >
                        {t("common.delete")}
                      </button>
                    )}
                  </div>

                  <SearchableSelect
                    options={products.map((p) => ({
                      id: p.id,
                      label: p.name,
                      subtitle: p.salePrice ? `${formatUZS(p.salePrice)} ${t("common.sum")}/${p.unit}` : undefined,
                    }))}
                    value={item.productId}
                    onChange={(id) => updateLineItem(item.id, "productId", id)}
                    placeholder={`${t("sales.product")}...`}
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      label={t("sales.quantity")}
                      type="number"
                      step="any"
                      min="0"
                      value={item.quantity}
                      onChange={(e) => updateLineItem(item.id, "quantity", e.target.value)}
                    />
                    <Input
                      label={t("sales.price")}
                      type="number"
                      step="any"
                      min="0"
                      value={item.unitPrice}
                      onChange={(e) => updateLineItem(item.id, "unitPrice", e.target.value)}
                      disabled={item.isFreebie}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {t("sales.freebie")}
                    </span>
                    <input
                      type="checkbox"
                      checked={item.isFreebie}
                      onChange={(e) => updateLineItem(item.id, "isFreebie", e.target.checked)}
                      className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                    />
                  </div>

                  {item.isFreebie && (
                    <Input
                      placeholder={`${t("sales.freebieFor")}...`}
                      value={item.freebieFor}
                      onChange={(e) => updateLineItem(item.id, "freebieFor", e.target.value)}
                    />
                  )}

                  {!item.isFreebie && Number(item.quantity) > 0 && Number(item.unitPrice) > 0 && (
                    <div className="text-right text-xs font-bold text-gray-600 dark:text-zinc-400">
                      = {formatUZS(Number(item.quantity) * Number(item.unitPrice))} {t("common.sum")}
                    </div>
                  )}
                </div>
              ))}

              <Button type="button" variant="secondary" size="sm" onClick={addLineItem}>
                <Plus size={16} /> {t("common.add")} {t("sales.product")}
              </Button>
            </div>
          </div>

          <div className="flex justify-between items-center py-3 border-t border-gray-100 dark:border-zinc-800">
            <span className="text-base font-bold text-gray-900 dark:text-white">
              {t("common.total")}
            </span>
            <span className="text-xl font-extrabold text-blue-600 dark:text-blue-400">
              {formatUZS(saleTotal)} {t("common.sum")}
            </span>
          </div>

          <Input
            label={t("sales.paidAmount")}
            type="number"
            step="any"
            min="0"
            placeholder="0"
            value={formPayment}
            onChange={(e) => setFormPayment(e.target.value)}
          />

          {formErrors.length > 0 && (
            <div className="flex flex-col gap-1">
              {formErrors.map((err, i) => (
                <div key={i} className="text-xs text-red-500 font-medium">
                  {err}
                </div>
              ))}
            </div>
          )}

          <Button type="button" variant="primary" size="lg" onClick={handleSubmit} loading={isPending}>
            {formType === "SALE" ? (
              <>
                <ShoppingCart size={18} /> {t("sales.newSale")}
              </>
            ) : (
              <>
                <RotateCcw size={18} /> {t("sales.returnType")}
              </>
            )}
          </Button>
        </div>
      </ModalSheet>

      {/* Add Client mini-modal */}
      <ModalSheet open={newClientSheet} onClose={() => setNewClientSheet(false)} title={t("sales.addNewClient")}>
        <div className="flex flex-col gap-4">
          <Input
            label={t("common.name")}
            placeholder={`${t("common.name")}...`}
            value={newClientName}
            onChange={(e) => setNewClientName(e.target.value)}
            autoFocus
          />
          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={handleAddClient}
            disabled={!newClientName.trim()}
            loading={isPending}
          >
            {t("common.add")}
          </Button>
        </div>
      </ModalSheet>

      {/* Delete confirm dialog */}
      <ConfirmDialog
        open={!!deleteConfirm}
        title={t("sales.deleteSale")}
        message={t("common.confirmDelete")}
        confirmLabel={t("common.delete")}
        destructive
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
        onCancel={() => setDeleteConfirm(null)}
      />
    </>
  );
}
