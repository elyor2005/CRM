"use client";

import { useState, useEffect, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { formatUZS, formatDateShort } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { getSale, deleteSale } from "@/app/actions/sales";

type SaleDetail = NonNullable<Awaited<ReturnType<typeof getSale>>>;

export default function SaleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [sale, setSale] = useState<SaleDetail | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();

  useEffect(() => {
    startTransition(async () => {
      const s = await getSale(params.id as string);
      setSale(s as SaleDetail);
    });
  }, [params.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = () => {
    startTransition(async () => {
      try {
        await deleteSale(params.id as string);
        showToast("Продажа удалена");
        router.push("/sales");
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Ошибка", "error");
      }
    });
  };

  if (!sale) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: "var(--text-secondary)" }}>
        Загрузка...
      </div>
    );
  }

  const total = sale.items.reduce((s, i) => s + Number(i.lineTotal), 0);

  return (
    <>
      <div className="page-header">
        <button
          onClick={() => router.back()}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            background: "none",
            border: "none",
            color: "var(--accent-blue)",
            fontSize: 17,
            cursor: "pointer",
            padding: 0,
            marginBottom: 8,
            fontFamily: "var(--font-system)",
          }}
        >
          <ArrowLeft size={20} /> Назад
        </button>
        <h1 className="page-title" style={{ fontSize: 28 }}>
          {sale.type === "SALE" ? "Продажа" : "Возврат"}
        </h1>
        <div className="page-subtitle">
          {formatDateShort(sale.date)} · {sale.client.name}
        </div>
      </div>

      <div style={{ padding: "0 16px" }}>
        {/* Line items */}
        <div className="ios-list-group" style={{ margin: "16px 0" }}>
          {sale.items.map((item, idx) => (
            <div key={item.id}>
              {idx > 0 && <div className="divider" />}
              <div style={{ padding: "12px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 17 }}>
                      {item.product.name}
                      {item.isFreebie && (
                        <span className="badge badge-sale" style={{ marginLeft: 8 }}>
                          Подарок
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
                      {Number(item.quantity)} × {formatUZS(item.unitPrice)} сум
                      {item.isFreebie && item.freebieFor && ` · для ${item.freebieFor}`}
                    </div>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 17, fontVariantNumeric: "tabular-nums" }}>
                    {formatUZS(item.lineTotal)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="ios-card" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ color: "var(--text-secondary)" }}>Итого</span>
            <span style={{ fontWeight: 700, fontSize: 20 }}>{formatUZS(total)} сум</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ color: "var(--text-secondary)" }}>Оплата</span>
            <span style={{ fontWeight: 600, color: "var(--accent-green)" }}>
              {formatUZS(sale.payment)} сум
            </span>
          </div>
          <div className="divider" style={{ margin: "8px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--text-secondary)" }}>Долг</span>
            <span style={{
              fontWeight: 600,
              color: total - Number(sale.payment) > 0 ? "var(--accent-red)" : "var(--accent-green)"
            }}>
              {formatUZS(total - Number(sale.payment))} сум
            </span>
          </div>
        </div>

        {/* Delete button */}
        <button
          type="button"
          className="ios-btn ios-btn-destructive"
          onClick={() => setDeleteOpen(true)}
          disabled={isPending}
        >
          <Trash2 size={18} /> Удалить продажу
        </button>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="Удалить продажу?"
        message="Все связанные записи (склад, финансы) будут отменены."
        confirmLabel="Удалить"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </>
  );
}
