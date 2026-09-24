"use client";

import { useState, useEffect, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Plus, Minus, Settings } from "lucide-react";
import { formatUZS, formatDateShort } from "@/lib/format";
import { ModalSheet } from "@/components/ui/ModalSheet";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { useToast } from "@/components/ui/Toast";
import {
  getInventoryItem,
  produceItem,
  restockItem,
  writeOffItem,
  updateRecipe,
  getAllItems,
} from "@/app/actions/inventory";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Table, TableRow } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/Skeleton";

type ItemDetail = NonNullable<Awaited<ReturnType<typeof getInventoryItem>>>;
type AllItems = Awaited<ReturnType<typeof getAllItems>>;

const movementTypeLabels: Record<string, string> = {
  PRODUCTION_IN: "Производство",
  PRODUCTION_CONSUME: "Расход на произв.",
  SALE_OUT: "Продажа",
  RETURN_IN: "Возврат",
  DEFECT: "Брак",
  BONUS: "Бонус",
  ADJUSTMENT: "Корректировка",
};

export default function WarehouseItemPage() {
  const params = useParams();
  const router = useRouter();
  const itemId = params.id as string;
  const [item, setItem] = useState<ItemDetail | null>(null);
  const [allItems, setAllItems] = useState<AllItems>([]);
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();

  // Sheets
  const [productionOpen, setProductionOpen] = useState(false);
  const [restockOpen, setRestockOpen] = useState(false);
  const [writeOffOpen, setWriteOffOpen] = useState(false);
  const [recipeOpen, setRecipeOpen] = useState(false);

  // Form state
  const [qty, setQty] = useState("");
  const [writeOffReason, setWriteOffReason] = useState<"DEFECT" | "ADJUSTMENT">("DEFECT");
  const [writeOffNote, setWriteOffNote] = useState("");

  // Recipe editor
  const [recipeLines, setRecipeLines] = useState<{ ingredientId: string; qtyPerUnit: string }[]>([]);

  const loadData = () => {
    startTransition(async () => {
      const [i, all] = await Promise.all([getInventoryItem(itemId), getAllItems()]);
      setItem(i as ItemDetail);
      setAllItems(all);
      if (i) {
        setRecipeLines(
          i.recipeLines.map((l) => ({
            ingredientId: l.ingredientId,
            qtyPerUnit: String(Number(l.qtyPerUnit)),
          }))
        );
      }
    });
  };

  useEffect(() => { loadData(); }, [itemId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleProduce = () => {
    if (!qty || Number(qty) <= 0) return;
    startTransition(async () => {
      try {
        await produceItem({ itemId, quantity: qty });
        showToast(`Произведено ${qty} ${item?.unit || "шт"}`);
        setProductionOpen(false);
        setQty("");
        loadData();
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Ошибка", "error");
      }
    });
  };

  const handleRestock = () => {
    if (!qty || Number(qty) <= 0) return;
    startTransition(async () => {
      try {
        await restockItem({ itemId, quantity: qty });
        showToast(`Приход: ${qty} ${item?.unit || "шт"}`);
        setRestockOpen(false);
        setQty("");
        loadData();
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Ошибка", "error");
      }
    });
  };

  const handleWriteOff = () => {
    if (!qty || Number(qty) <= 0) return;
    startTransition(async () => {
      try {
        await writeOffItem({ itemId, quantity: qty, reason: writeOffReason, note: writeOffNote });
        showToast("Списание оформлено");
        setWriteOffOpen(false);
        setQty("");
        setWriteOffNote("");
        loadData();
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Ошибка", "error");
      }
    });
  };

  const handleSaveRecipe = () => {
    startTransition(async () => {
      try {
        await updateRecipe({
          productId: itemId,
          lines: recipeLines.filter((l) => l.ingredientId && Number(l.qtyPerUnit) > 0),
        });
        showToast("Рецепт сохранён");
        setRecipeOpen(false);
        loadData();
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Ошибка", "error");
      }
    });
  };

  if (!item) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  const ingredients = allItems.filter(
    (i) => i.category === "RAW_MATERIAL" || i.category === "PACKAGING"
  );

  return (
    <div className="space-y-6">
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-1 text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-lg"
      >
        <ArrowLeft size={18} /> Назад
      </button>

      <PageHeader
        title={item.name}
        subtitle={
          item.category === "FINISHED_GOOD"
            ? "Готовая продукция"
            : item.category === "RAW_MATERIAL"
            ? "Сырьё"
            : "Упаковка"
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4 text-center">
          <div className="text-xs font-bold uppercase text-gray-500 dark:text-zinc-400 mb-1">Остаток</div>
          <div className="text-2xl font-extrabold text-gray-900 dark:text-white tabular-nums">
            {Number(item.quantity)} {item.unit}
          </div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-xs font-bold uppercase text-gray-500 dark:text-zinc-400 mb-1">Стоимость остатка</div>
          <div className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 tabular-nums">
            {formatUZS(Number(item.quantity) * Number(item.costPrice))}
          </div>
        </Card>
      </div>

      {/* Action Buttons Toolbar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {item.category === "FINISHED_GOOD" && (
          <Button
            onClick={() => { setQty(""); setProductionOpen(true); }}
            variant="primary"
          >
            <Plus size={18} /> Производство
          </Button>
        )}
        <Button
          onClick={() => { setQty(""); setRestockOpen(true); }}
          variant="secondary"
        >
          <Plus size={18} /> Приход
        </Button>
        <Button
          onClick={() => { setQty(""); setWriteOffNote(""); setWriteOffOpen(true); }}
          variant="destructive"
        >
          <Minus size={18} /> Списание
        </Button>
        {item.category === "FINISHED_GOOD" && (
          <Button
            onClick={() => setRecipeOpen(true)}
            variant="secondary"
          >
            <Settings size={18} /> Рецепт
          </Button>
        )}
      </div>

      {/* Recipe Display */}
      {item.category === "FINISHED_GOOD" && item.recipeLines.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-500 dark:text-zinc-400 px-1">
            Рецепт (на 1 {item.unit})
          </h3>
          <Card className="p-0 overflow-hidden divide-y divide-gray-100 dark:divide-zinc-800">
            {item.recipeLines.map((line) => (
              <div key={`${line.productId}-${line.ingredientId}`} className="flex items-center justify-between p-3.5 text-sm">
                <span className="font-semibold text-gray-900 dark:text-white">{line.ingredient.name}</span>
                <span className="font-bold text-gray-600 dark:text-zinc-400 tabular-nums">
                  {Number(line.qtyPerUnit)} {line.ingredient.unit}
                </span>
              </div>
            ))}
          </Card>
        </section>
      )}

      {/* Stock Movement History */}
      <section className="space-y-3">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-500 dark:text-zinc-400 px-1">
          Движение склада
        </h3>
        {item.stockMovements.length === 0 ? (
          <EmptyState title="Нет записей движения склада" />
        ) : (
          <Table
            headers={["Дата", "Операция", "Примечание", "Количество"]}
            alignments={["left", "left", "left", "right"]}
          >
            {item.stockMovements.map((mv) => (
              <TableRow key={mv.id}>
                <td className="p-3.5 whitespace-nowrap text-gray-700 dark:text-zinc-300 font-medium text-xs">
                  {formatDateShort(mv.date)}
                </td>
                <td className="p-3.5 font-bold text-gray-900 dark:text-white">
                  {movementTypeLabels[mv.type] || mv.type}
                </td>
                <td className="p-3.5 text-gray-500 dark:text-zinc-400 text-xs font-medium">
                  {mv.note || "—"}
                </td>
                <td className={`p-3.5 text-right whitespace-nowrap font-extrabold tabular-nums ${Number(mv.quantity) > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                  {Number(mv.quantity) > 0 ? "+" : ""}{Number(mv.quantity)} {item.unit}
                </td>
              </TableRow>
            ))}
          </Table>
        )}
      </section>

      {/* Production Modal Sheet */}
      <ModalSheet open={productionOpen} onClose={() => setProductionOpen(false)} title="Производство">
        <div className="flex flex-col gap-4">
          {item.recipeLines.length > 0 && (
            <p className="text-xs text-gray-500 dark:text-zinc-400 font-medium">
              Сырьё будет автоматически списано со склада по рецепту.
            </p>
          )}
          <Input
            label={`Количество (${item.unit})`}
            type="number"
            step="any"
            min="0"
            placeholder="0"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            autoFocus
          />
          {/* Preview consumption */}
          {item.recipeLines.length > 0 && Number(qty) > 0 && (
            <div className="p-3.5 bg-indigo-50/60 dark:bg-indigo-950/30 rounded-xl border border-indigo-100 dark:border-indigo-900/40 space-y-2">
              <div className="text-xs font-bold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider">
                Расчёт списания:
              </div>
              {item.recipeLines.map((line) => {
                const need = Number(line.qtyPerUnit) * Number(qty);
                const available = Number(line.ingredient.quantity);
                const insufficient = available < need;
                return (
                  <div
                    key={line.ingredientId}
                    className={`flex items-center justify-between text-xs font-bold ${
                      insufficient ? "text-rose-600 dark:text-rose-400" : "text-gray-700 dark:text-zinc-300"
                    }`}
                  >
                    <span>{line.ingredient.name}</span>
                    <span className="tabular-nums">
                      {need} / {available} {line.ingredient.unit}
                      {insufficient && " ⚠️ Недостаточно"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={handleProduce}
            disabled={!qty || Number(qty) <= 0 || isPending}
            loading={isPending}
          >
            Произвести
          </Button>
        </div>
      </ModalSheet>

      {/* Restock Modal Sheet */}
      <ModalSheet open={restockOpen} onClose={() => setRestockOpen(false)} title="Приход">
        <div className="flex flex-col gap-4">
          <Input
            label={`Количество (${item.unit})`}
            type="number"
            step="any"
            min="0"
            placeholder="0"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            autoFocus
          />
          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={handleRestock}
            disabled={!qty || Number(qty) <= 0 || isPending}
            loading={isPending}
          >
            Оприходовать
          </Button>
        </div>
      </ModalSheet>

      {/* Write-off Modal Sheet */}
      <ModalSheet open={writeOffOpen} onClose={() => setWriteOffOpen(false)} title="Списание">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400 pl-0.5">
              Причина
            </label>
            <select
              className="w-full px-4 py-2.5 bg-gray-100 dark:bg-[#1E2638] text-gray-900 dark:text-white rounded-xl text-base border border-gray-200/60 dark:border-zinc-800 outline-none transition-all focus:ring-2 focus:ring-indigo-500/80 min-h-[44px]"
              value={writeOffReason}
              onChange={(e) => setWriteOffReason(e.target.value as "DEFECT" | "ADJUSTMENT")}
            >
              <option value="DEFECT">Брак</option>
              <option value="ADJUSTMENT">Корректировка</option>
            </select>
          </div>
          <Input
            label={`Количество (${item.unit})`}
            type="number"
            step="any"
            min="0"
            placeholder="0"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
          <Input
            label="Примечание"
            placeholder="Необязательно..."
            value={writeOffNote}
            onChange={(e) => setWriteOffNote(e.target.value)}
          />
          <Button
            type="button"
            variant="destructive"
            size="lg"
            onClick={handleWriteOff}
            disabled={!qty || Number(qty) <= 0 || isPending}
            loading={isPending}
          >
            Списать
          </Button>
        </div>
      </ModalSheet>

      {/* Recipe Editor Modal Sheet */}
      <ModalSheet open={recipeOpen} onClose={() => setRecipeOpen(false)} title="Рецепт">
        <div className="flex flex-col gap-4">
          <p className="text-xs text-gray-500 dark:text-zinc-400 font-medium">
            Укажите ингредиенты и расход на 1 {item.unit} готовой продукции.
          </p>

          {recipeLines.map((line, idx) => (
            <div
              key={idx}
              className="p-3 bg-gray-50 dark:bg-[#1A202C] rounded-xl border border-gray-200/60 dark:border-zinc-800 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-500 dark:text-zinc-400">
                  Ингредиент #{idx + 1}
                </span>
                <button
                  type="button"
                  className="text-xs font-bold text-rose-500 hover:text-rose-700"
                  onClick={() => setRecipeLines((prev) => prev.filter((_, i) => i !== idx))}
                >
                  Удалить
                </button>
              </div>
              <SearchableSelect
                options={ingredients.map((i) => ({
                  id: i.id,
                  label: i.name,
                  subtitle: `${i.category === "RAW_MATERIAL" ? "Сырьё" : "Упаковка"} · ${Number(i.quantity)} ${i.unit}`,
                }))}
                value={line.ingredientId}
                onChange={(id) =>
                  setRecipeLines((prev) =>
                    prev.map((l, i) => (i === idx ? { ...l, ingredientId: id } : l))
                  )
                }
                placeholder="Выберите ингредиент..."
              />
              <Input
                label={`Кол-во на 1 ${item.unit}`}
                type="number"
                step="any"
                min="0"
                placeholder="0"
                value={line.qtyPerUnit}
                onChange={(e) =>
                  setRecipeLines((prev) =>
                    prev.map((l, i) => (i === idx ? { ...l, qtyPerUnit: e.target.value } : l))
                  )
                }
              />
            </div>
          ))}

          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={() => setRecipeLines((prev) => [...prev, { ingredientId: "", qtyPerUnit: "" }])}
          >
            <Plus size={16} /> Добавить ингредиент
          </Button>

          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={handleSaveRecipe}
            loading={isPending}
          >
            Сохранить рецепт
          </Button>
        </div>
      </ModalSheet>
    </div>
  );
}
