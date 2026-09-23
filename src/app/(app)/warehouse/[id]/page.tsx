"use client";

import { useState, useEffect, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Plus, Minus, RotateCcw, Settings } from "lucide-react";
import { formatUZS, formatDateShort } from "@/lib/format";
import { BottomSheet } from "@/components/ui/BottomSheet";
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
      <div style={{ padding: 32, textAlign: "center", color: "var(--text-secondary)" }}>
        Загрузка...
      </div>
    );
  }

  const ingredients = allItems.filter(
    (i) => i.category === "RAW_MATERIAL" || i.category === "PACKAGING"
  );

  return (
    <>
      <div className="page-header">
        <button
          onClick={() => router.back()}
          style={{
            display: "flex", alignItems: "center", gap: 4,
            background: "none", border: "none", color: "var(--accent-blue)",
            fontSize: 17, cursor: "pointer", padding: 0, marginBottom: 8,
            fontFamily: "var(--font-system)",
          }}
        >
          <ArrowLeft size={20} /> Назад
        </button>
        <h1 className="page-title" style={{ fontSize: 28 }}>{item.name}</h1>
        <div className="page-subtitle">
          {item.category === "FINISHED_GOOD" ? "Готовая продукция" :
           item.category === "RAW_MATERIAL" ? "Сырьё" : "Упаковка"}
        </div>
      </div>

      {/* Stats */}
      <div className="stat-row" style={{ marginBottom: 16 }}>
        <div className="stat-card">
          <div className="stat-label">Остаток</div>
          <div className="stat-value">{Number(item.quantity)} {item.unit}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Стоимость</div>
          <div className="stat-value" style={{ fontSize: 18 }}>
            {formatUZS(Number(item.quantity) * Number(item.costPrice))}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
        {item.category === "FINISHED_GOOD" && (
          <button
            type="button"
            className="ios-btn ios-btn-primary"
            onClick={() => { setQty(""); setProductionOpen(true); }}
          >
            <Plus size={20} /> Производство
          </button>
        )}
        <button
          type="button"
          className="ios-btn ios-btn-secondary"
          onClick={() => { setQty(""); setRestockOpen(true); }}
        >
          <Plus size={20} /> Приход
        </button>
        <button
          type="button"
          className="ios-btn ios-btn-destructive"
          onClick={() => { setQty(""); setWriteOffNote(""); setWriteOffOpen(true); }}
        >
          <Minus size={20} /> Списание
        </button>
        {item.category === "FINISHED_GOOD" && (
          <button
            type="button"
            className="ios-btn ios-btn-secondary"
            onClick={() => setRecipeOpen(true)}
          >
            <Settings size={20} /> Рецепт
          </button>
        )}
      </div>

      {/* Recipe display */}
      {item.category === "FINISHED_GOOD" && item.recipeLines.length > 0 && (
        <div style={{ padding: "0 16px", marginBottom: 24 }}>
          <div className="ios-list-group-title" style={{ paddingLeft: 0 }}>Рецепт (на 1 {item.unit})</div>
          <div className="ios-list-group" style={{ margin: 0 }}>
            {item.recipeLines.map((line, idx) => (
              <div key={`${line.productId}-${line.ingredientId}`}>
                {idx > 0 && <div className="divider" />}
                <div style={{ padding: "10px 16px", display: "flex", justifyContent: "space-between" }}>
                  <span>{line.ingredient.name}</span>
                  <span style={{ color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
                    {Number(line.qtyPerUnit)} {line.ingredient.unit}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stock movement history */}
      <div style={{ padding: "0 16px" }}>
        <div className="ios-list-group-title" style={{ paddingLeft: 0 }}>Движение склада</div>
        {item.stockMovements.length === 0 ? (
          <div style={{ color: "var(--text-tertiary)", fontSize: 15, padding: "16px 0" }}>
            Нет записей
          </div>
        ) : (
          <div className="ios-list-group" style={{ margin: 0 }}>
            {item.stockMovements.map((mv, idx) => (
              <div key={mv.id}>
                {idx > 0 && <div className="divider" />}
                <div style={{ padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 500 }}>
                      {movementTypeLabels[mv.type] || mv.type}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      {formatDateShort(mv.date)}
                      {mv.note && ` · ${mv.note}`}
                    </div>
                  </div>
                  <span style={{
                    fontWeight: 600,
                    fontVariantNumeric: "tabular-nums",
                    color: Number(mv.quantity) > 0 ? "var(--accent-green)" : "var(--accent-red)",
                  }}>
                    {Number(mv.quantity) > 0 ? "+" : ""}{Number(mv.quantity)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Production sheet */}
      <BottomSheet open={productionOpen} onClose={() => setProductionOpen(false)} title="Производство">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {item.recipeLines.length > 0 && (
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              Будет автоматически списано сырьё по рецепту.
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Количество ({item.unit})</label>
            <input
              className="ios-input"
              type="number"
              step="any"
              min="0"
              placeholder="0"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              autoFocus
            />
          </div>
          {/* Preview consumption */}
          {item.recipeLines.length > 0 && Number(qty) > 0 && (
            <div className="ios-card" style={{ padding: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>
                Будет списано:
              </div>
              {item.recipeLines.map((line) => {
                const need = Number(line.qtyPerUnit) * Number(qty);
                const available = Number(line.ingredient.quantity);
                const insufficient = available < need;
                return (
                  <div key={line.ingredientId} style={{
                    display: "flex", justifyContent: "space-between", fontSize: 14, padding: "2px 0",
                    color: insufficient ? "var(--accent-red)" : "var(--text-primary)",
                  }}>
                    <span>{line.ingredient.name}</span>
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>
                      {need} / {available} {line.ingredient.unit}
                      {insufficient && " ⚠️"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          <button
            type="button"
            className="ios-btn ios-btn-primary"
            onClick={handleProduce}
            disabled={!qty || Number(qty) <= 0 || isPending}
          >
            {isPending ? <span className="login-spinner" /> : "Произвести"}
          </button>
        </div>
      </BottomSheet>

      {/* Restock sheet */}
      <BottomSheet open={restockOpen} onClose={() => setRestockOpen(false)} title="Приход">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Количество ({item.unit})</label>
            <input
              className="ios-input"
              type="number"
              step="any"
              min="0"
              placeholder="0"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              autoFocus
            />
          </div>
          <button
            type="button"
            className="ios-btn ios-btn-primary"
            onClick={handleRestock}
            disabled={!qty || Number(qty) <= 0 || isPending}
          >
            {isPending ? <span className="login-spinner" /> : "Оприходовать"}
          </button>
        </div>
      </BottomSheet>

      {/* Write-off sheet */}
      <BottomSheet open={writeOffOpen} onClose={() => setWriteOffOpen(false)} title="Списание">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Причина</label>
            <select
              className="ios-input"
              value={writeOffReason}
              onChange={(e) => setWriteOffReason(e.target.value as "DEFECT" | "ADJUSTMENT")}
            >
              <option value="DEFECT">Брак</option>
              <option value="ADJUSTMENT">Корректировка</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Количество ({item.unit})</label>
            <input
              className="ios-input"
              type="number"
              step="any"
              min="0"
              placeholder="0"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Примечание</label>
            <input
              className="ios-input"
              placeholder="Необязательно..."
              value={writeOffNote}
              onChange={(e) => setWriteOffNote(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="ios-btn ios-btn-destructive"
            onClick={handleWriteOff}
            disabled={!qty || Number(qty) <= 0 || isPending}
          >
            {isPending ? <span className="login-spinner" /> : "Списать"}
          </button>
        </div>
      </BottomSheet>

      {/* Recipe editor sheet */}
      <BottomSheet open={recipeOpen} onClose={() => setRecipeOpen(false)} title="Рецепт">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            Укажите ингредиенты и количество на 1 {item.unit} готовой продукции.
          </div>

          {recipeLines.map((line, idx) => (
            <div key={idx} className="line-item">
              <div className="line-item-header">
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>
                  Ингредиент #{idx + 1}
                </span>
                <button
                  type="button"
                  style={{
                    fontSize: 13, color: "var(--accent-red)", background: "none",
                    border: "none", cursor: "pointer", fontFamily: "var(--font-system)",
                  }}
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
              <div className="form-group">
                <label className="form-label" style={{ fontSize: 11 }}>Кол-во на 1 {item.unit}</label>
                <input
                  className="ios-input"
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
            </div>
          ))}

          <button
            type="button"
            className="ios-btn ios-btn-secondary ios-btn-small"
            onClick={() => setRecipeLines((prev) => [...prev, { ingredientId: "", qtyPerUnit: "" }])}
          >
            <Plus size={16} /> Добавить ингредиент
          </button>

          <button
            type="button"
            className="ios-btn ios-btn-primary"
            onClick={handleSaveRecipe}
            disabled={isPending}
          >
            {isPending ? <span className="login-spinner" /> : "Сохранить рецепт"}
          </button>
        </div>
      </BottomSheet>
    </>
  );
}
