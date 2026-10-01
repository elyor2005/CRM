"use client";

import React from "react";
import { ModalSheet } from "@/components/ui/ModalSheet";
import { Button } from "@/components/ui/Button";
import { formatUZS, formatDateShort } from "@/lib/format";
import { useLanguage } from "@/lib/i18n/context";
import { Printer, X, Building2, CheckCircle2 } from "lucide-react";
import { SaleDetailData } from "./SaleDetailModal";

interface SaleReceiptModalProps {
  sale: SaleDetailData | null;
  open: boolean;
  onClose: () => void;
}

export function SaleReceiptModal({ sale, open, onClose }: SaleReceiptModalProps) {
  const { language, t } = useLanguage();

  if (!sale) return null;

  const total = sale.items.reduce((s, i) => s + Number(i.lineTotal), 0);
  const paid = Number(sale.payment);
  const debt = Math.max(0, total - paid);
  const isSale = sale.type === "SALE";

  const handlePrint = () => {
    window.print();
  };

  return (
    <ModalSheet
      open={open}
      onClose={onClose}
      title={language === "ru" ? "Товарный чек" : language === "uz" ? "Tovar cheki" : "Sales Receipt"}
    >
      <div className="flex flex-col gap-5">
        {/* Printable Receipt Container */}
        <div
          id="printable-receipt"
          className="bg-white text-gray-950 p-6 rounded-2xl border border-gray-200 shadow-sm print:p-0 print:border-none print:shadow-none print:w-full print:max-w-none print:m-0 font-mono text-xs"
        >
          {/* Header */}
          <div className="text-center pb-4 border-b border-dashed border-gray-300">
            <div className="flex items-center justify-center gap-1.5 font-sans font-extrabold text-base tracking-tight text-gray-900">
              <Building2 size={18} className="print:hidden" />
              <span>CRM Cloud</span>
            </div>
            <div className="text-xs uppercase tracking-widest font-extrabold text-gray-700 mt-1">
              {isSale
                ? language === "ru"
                  ? "ТОВАРНЫЙ ЧЕК"
                  : language === "uz"
                  ? "TOVAR CHEKI"
                  : "SALES RECEIPT"
                : language === "ru"
                ? "ЧЕК ВОЗВРАТА"
                : language === "uz"
                ? "QAYTARISH CHEKI"
                : "RETURN RECEIPT"}
            </div>
            <div className="text-[11px] text-gray-500 mt-1">
              № {sale.id.slice(-6).toUpperCase()} · {formatDateShort(sale.date, language)}
            </div>
          </div>

          {/* Client info */}
          <div className="py-3 border-b border-dashed border-gray-300 space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-500">
                {language === "ru" ? "Клиент:" : language === "uz" ? "Mijoz:" : "Client:"}
              </span>
              <span className="font-bold text-gray-900">{sale.client.name}</span>
            </div>
            <div className="flex justify-between text-[11px] text-gray-500">
              <span>{language === "ru" ? "Тип:" : language === "uz" ? "Turi:" : "Type:"}</span>
              <span>{isSale ? t("sales.saleType") : t("sales.returnType")}</span>
            </div>
          </div>

          {/* Items Table */}
          <div className="py-3 border-b border-dashed border-gray-300">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[11px] text-gray-500 border-b border-gray-200">
                  <th className="pb-1.5 font-semibold">
                    {language === "ru" ? "Товар" : language === "uz" ? "Mahsulot" : "Item"}
                  </th>
                  <th className="pb-1.5 text-center font-semibold">
                    {language === "ru" ? "Кол-во" : language === "uz" ? "Soni" : "Qty"}
                  </th>
                  <th className="pb-1.5 text-right font-semibold">
                    {language === "ru" ? "Цена" : language === "uz" ? "Narx" : "Price"}
                  </th>
                  <th className="pb-1.5 text-right font-semibold">
                    {language === "ru" ? "Сумма" : language === "uz" ? "Summa" : "Total"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sale.items.map((item, idx) => (
                  <tr key={item.id || idx} className="text-xs">
                    <td className="py-2 pr-1 font-sans font-bold text-gray-900 leading-tight">
                      {item.product.name}
                      {item.isFreebie && (
                        <span className="block text-[10px] font-normal text-orange-600">
                          ({t("sales.freebie")})
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-center text-gray-600 whitespace-nowrap">
                      {Number(item.quantity)} {item.product.unit}
                    </td>
                    <td className="py-2 text-right text-gray-600 whitespace-nowrap tabular-nums">
                      {formatUZS(item.unitPrice)}
                    </td>
                    <td className="py-2 text-right font-bold text-gray-900 whitespace-nowrap tabular-nums">
                      {formatUZS(item.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals Breakdown */}
          <div className="py-3 space-y-1.5 border-b border-dashed border-gray-300">
            <div className="flex justify-between font-bold text-sm">
              <span>{language === "ru" ? "ИТОГО:" : language === "uz" ? "JAMI:" : "TOTAL:"}</span>
              <span className="tabular-nums">{formatUZS(total)} UZS</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>{language === "ru" ? "Оплачено сразу:" : language === "uz" ? "Darhol to'langan:" : "Paid upfront:"}</span>
              <span className="tabular-nums font-semibold text-emerald-700">{formatUZS(paid)} UZS</span>
            </div>
            {isSale && debt > 0 && (
              <div className="flex justify-between font-bold text-orange-700">
                <span>{language === "ru" ? "Остаток в долг:" : language === "uz" ? "Qarzga qolgani:" : "Remaining debt:"}</span>
                <span className="tabular-nums">{formatUZS(debt)} UZS</span>
              </div>
            )}
          </div>

          {/* Footer note */}
          <div className="text-center pt-4 text-[11px] text-gray-500">
            <div>{language === "ru" ? "Спасибо за покупку!" : language === "uz" ? "Xaridingiz uchun rahmat!" : "Thank you for your business!"}</div>
          </div>
        </div>

        {/* Action buttons (hidden on print) */}
        <div className="flex items-center justify-between gap-3 print:hidden pt-2">
          <Button variant="outline" onClick={handlePrint} size="md" className="gap-2 flex-1">
            <Printer size={16} />
            <span>{language === "ru" ? "Печать чека" : language === "uz" ? "Chekni chop etish" : "Print Receipt"}</span>
          </Button>
          <Button variant="secondary" onClick={onClose} size="md">
            {t("common.close")}
          </Button>
        </div>
      </div>
    </ModalSheet>
  );
}
