import { useState } from "react";
import { ModalSheet } from "@/components/ui/ModalSheet";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatUZS, formatDateShort } from "@/lib/format";
import { useLanguage } from "@/lib/i18n/context";
import { User, Calendar, Trash2, Edit2, Printer } from "lucide-react";
import { SaleReceiptModal } from "./SaleReceiptModal";

export interface SaleDetailData {
  id: string;
  date: string | Date;
  type: "SALE" | "RETURN" | string;
  payment: any;
  client: { id: string; name: string };
  items: Array<{
    id: string;
    productId: string;
    quantity: any;
    unitPrice: any;
    lineTotal: any;
    isFreebie?: boolean;
    freebieFor?: string | null;
    product: {
      name: string;
      unit: string;
    };
  }>;
}

interface SaleDetailModalProps {
  sale: SaleDetailData | null;
  open: boolean;
  onClose: () => void;
  onDelete?: (saleId: string) => void;
  onEdit?: (sale: SaleDetailData) => void;
}

export function SaleDetailModal({
  sale,
  open,
  onClose,
  onDelete,
  onEdit,
}: SaleDetailModalProps) {
  const { language, t } = useLanguage();
  const [receiptOpen, setReceiptOpen] = useState(false);

  if (!sale) return null;

  const total = sale.items.reduce((s, i) => s + Number(i.lineTotal), 0);
  const paid = Number(sale.payment);
  const debt = Math.max(0, total - paid);
  const isSale = sale.type === "SALE";

  return (
    <ModalSheet
      open={open}
      onClose={onClose}
      title={`${isSale ? t("sales.saleType") : t("sales.returnType")} #${sale.id.slice(-6)}`}
    >
      <div className="flex flex-col gap-4">
        {/* Header summary info */}
        <div className="flex items-center justify-between p-3.5 bg-gray-50/80 dark:bg-zinc-800/40 rounded-xl border border-gray-100 dark:border-zinc-800/60 text-sm">
          <div className="flex items-center gap-2">
            <User size={16} className="text-gray-400" />
            <span className="font-extrabold text-gray-900 dark:text-white">
              {sale.client.name}
            </span>
          </div>
          <Badge variant={isSale ? "sale" : "return"}>
            {isSale ? t("sales.saleType") : t("sales.returnType")}
          </Badge>
        </div>

        <div className="flex items-center gap-2 px-1 text-xs text-gray-500 dark:text-zinc-400">
          <Calendar size={14} />
          <span>{formatDateShort(sale.date, language)}</span>
        </div>

        {/* Line Items Table */}
        <div className="space-y-2">
          <div className="text-xs font-extrabold uppercase tracking-wider text-gray-500 dark:text-zinc-400 px-1">
            {t("sales.lineItems")} ({sale.items.length})
          </div>

          <div className="rounded-xl border border-gray-200/80 dark:border-zinc-800 overflow-hidden divide-y divide-gray-100 dark:divide-zinc-800/60 bg-white dark:bg-[#131823]">
            {sale.items.map((item) => (
              <div
                key={item.id}
                className="p-3.5 flex items-center justify-between gap-3 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-gray-900 dark:text-white truncate">
                    {item.product.name}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                    {Number(item.quantity)} {item.product.unit} × {formatUZS(item.unitPrice)}{" "}
                    {t("common.sum")}
                    {item.isFreebie && (
                      <span className="ml-1.5 inline-flex text-[11px] font-semibold text-orange-600 dark:text-orange-400">
                        ({t("sales.freebie")}{item.freebieFor ? `: ${item.freebieFor}` : ""})
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-extrabold text-gray-900 dark:text-white tabular-nums">
                    {formatUZS(item.lineTotal)}
                  </span>{" "}
                  <span className="text-xs text-gray-400 font-normal">{t("common.sum")}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Totals Breakdown */}
        <div className="p-3.5 bg-gray-50/80 dark:bg-zinc-800/40 rounded-xl border border-gray-100 dark:border-zinc-800/60 space-y-2 text-sm">
          <div className="flex items-center justify-between text-gray-600 dark:text-zinc-300">
            <span>{t("sales.salesSum")}</span>
            <span className="font-extrabold text-gray-900 dark:text-white tabular-nums">
              {formatUZS(total)} {t("common.sum")}
            </span>
          </div>

          <div className="flex items-center justify-between text-gray-600 dark:text-zinc-300">
            <span>{t("sales.paidAmount")}</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
              {formatUZS(paid)} {t("common.sum")}
            </span>
          </div>

          {isSale && (
            <div className="flex items-center justify-between pt-2 border-t border-gray-200/60 dark:border-zinc-700/60 font-extrabold">
              <span className={debt > 0 ? "text-orange-600 dark:text-orange-400" : "text-gray-700 dark:text-zinc-300"}>
                {t("sales.debtRemaining")}
              </span>
              <span className={`tabular-nums ${debt > 0 ? "text-orange-600 dark:text-orange-400" : "text-gray-900 dark:text-white"}`}>
                {formatUZS(debt)} {t("common.sum")}
              </span>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-between gap-3 pt-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReceiptOpen(true)}
              className="gap-1.5"
            >
              <Printer size={15} /> {language === "ru" ? "Чек" : language === "uz" ? "Chek" : "Receipt"}
            </Button>
            {onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onEdit(sale);
                  onClose();
                }}
                className="gap-1.5"
              >
                <Edit2 size={15} /> {t("common.edit")}
              </Button>
            )}
            {onDelete && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  onDelete(sale.id);
                  onClose();
                }}
                className="gap-1.5"
              >
                <Trash2 size={15} /> {t("common.delete")}
              </Button>
            )}
          </div>
          <Button variant="secondary" onClick={onClose}>
            {t("common.close")}
          </Button>
        </div>

        {/* Printable Receipt Modal */}
        <SaleReceiptModal
          sale={sale}
          open={receiptOpen}
          onClose={() => setReceiptOpen(false)}
        />
      </div>
    </ModalSheet>
  );
}
