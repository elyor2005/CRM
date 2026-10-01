"use client";

import { useState, useEffect, useTransition } from "react";
import { Settings, Save, Users, Tag, Plus, Edit, Trash2, Search } from "lucide-react";
import { formatUZS } from "@/lib/format";
import { isRealItem } from "@/lib/constants";
import { useToast } from "@/components/ui/Toast";
import { getAllItems, updateInventoryItem } from "@/app/actions/inventory";
import { getClients, createClient, updateClient, deleteClient } from "@/app/actions/clients";
import {
  getExpenseCategories,
  createExpenseCategory,
  updateExpenseCategory,
  deleteExpenseCategory,
} from "@/app/actions/finance";
import { useLanguage } from "@/lib/i18n/context";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ModalSheet } from "@/components/ui/ModalSheet";

type InventoryItem = Awaited<ReturnType<typeof getAllItems>>[number];
type Client = Awaited<ReturnType<typeof getClients>>[number];
type ExpenseCategoryItem = Awaited<ReturnType<typeof getExpenseCategories>>[number];

type TabType = "ITEMS" | "CLIENTS" | "EXPENSES";

export default function SettingsPage() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<TabType>("ITEMS");
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  // Data states
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [categories, setCategories] = useState<ExpenseCategoryItem[]>([]);

  // Item editing state
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemName, setEditItemName] = useState("");
  const [editItemUnit, setEditItemUnit] = useState("");
  const [editItemCostPrice, setEditItemCostPrice] = useState("");
  const [editItemSalePrice, setEditItemSalePrice] = useState("");
  const [editItemMinStock, setEditItemMinStock] = useState("");

  // Client search and modals
  const [clientSearch, setClientSearch] = useState("");
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [editClientOpen, setEditClientOpen] = useState(false);
  const [activeClient, setActiveClient] = useState<Client | null>(null);
  const [clientFormName, setClientFormName] = useState("");
  const [clientFormDistrict, setClientFormDistrict] = useState("");
  const [clientFormPhone, setClientFormPhone] = useState("");
  const [clientFormAddress, setClientFormAddress] = useState("");
  const [clientFormVisitFreq, setClientFormVisitFreq] = useState("");
  const [clientFormOpeningDebt, setClientFormOpeningDebt] = useState("");

  // Category modals
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [editCategoryOpen, setEditCategoryOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<ExpenseCategoryItem | null>(null);
  const [categoryName, setCategoryName] = useState("");

  const loadData = () => {
    startTransition(async () => {
      const [itemsData, clientsData, catsData] = await Promise.all([
        getAllItems(),
        getClients(),
        getExpenseCategories(),
      ]);
      setItems(itemsData);
      setClients(clientsData);
      setCategories(catsData);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Item handlers
  const startEditingItem = (item: InventoryItem) => {
    setEditingItemId(item.id);
    setEditItemName(item.name);
    setEditItemUnit(item.unit);
    setEditItemCostPrice(String(Number(item.costPrice)));
    setEditItemSalePrice(item.salePrice ? String(Number(item.salePrice)) : "");
    setEditItemMinStock(String(Number(item.minStock)));
  };

  const cancelEditingItem = () => {
    setEditingItemId(null);
  };

  const handleSaveItem = (item: InventoryItem) => {
    if (!editItemName.trim()) return;
    startTransition(async () => {
      try {
        await updateInventoryItem(item.id, {
          name: editItemName.trim(),
          category: item.category,
          unit: editItemUnit || "шт",
          costPrice: editItemCostPrice || "0",
          salePrice: editItemSalePrice || "",
          minStock: editItemMinStock || "",
        });
        showToast(t("common.save"));
        setEditingItemId(null);
        loadData();
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Error", "error");
      }
    });
  };

  // Client handlers
  const handleCreateClient = () => {
    if (!clientFormName.trim()) return;
    startTransition(async () => {
      try {
        await createClient({
          name: clientFormName.trim(),
          district: clientFormDistrict.trim(),
          phone: clientFormPhone.trim(),
          address: clientFormAddress.trim(),
          visitFrequency: clientFormVisitFreq,
          openingDebt: clientFormOpeningDebt,
        });
        showToast("Клиент успешно добавлен");
        setAddClientOpen(false);
        setClientFormName("");
        setClientFormDistrict("");
        setClientFormPhone("");
        setClientFormAddress("");
        setClientFormVisitFreq("");
        setClientFormOpeningDebt("");
        loadData();
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Ошибка", "error");
      }
    });
  };

  const startEditClient = (c: Client) => {
    setActiveClient(c);
    setClientFormName(c.name);
    setClientFormDistrict(c.district || "");
    setClientFormPhone(c.phone || "");
    setClientFormAddress(c.address || "");
    setClientFormVisitFreq(c.visitFrequency ? String(c.visitFrequency) : "");
    setEditClientOpen(true);
  };

  const handleUpdateClient = () => {
    if (!activeClient || !clientFormName.trim()) return;
    startTransition(async () => {
      try {
        await updateClient(activeClient.id, {
          name: clientFormName.trim(),
          district: clientFormDistrict.trim(),
          phone: clientFormPhone.trim(),
          address: clientFormAddress.trim(),
          visitFrequency: clientFormVisitFreq,
        });
        showToast("Данные клиента обновлены");
        setEditClientOpen(false);
        setActiveClient(null);
        loadData();
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Ошибка", "error");
      }
    });
  };

  const handleDeleteClient = (c: Client) => {
    if (!confirm(`Вы действительно хотите удалить клиента "${c.name}"?`)) return;
    startTransition(async () => {
      try {
        await deleteClient(c.id);
        showToast("Клиент удалён");
        loadData();
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Ошибка удаления", "error");
      }
    });
  };

  // Category handlers
  const handleCreateCategory = () => {
    if (!categoryName.trim()) return;
    startTransition(async () => {
      try {
        await createExpenseCategory(categoryName.trim());
        showToast("Категория добавлена");
        setAddCategoryOpen(false);
        setCategoryName("");
        loadData();
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Ошибка", "error");
      }
    });
  };

  const startEditCategory = (cat: ExpenseCategoryItem) => {
    setActiveCategory(cat);
    setCategoryName(cat.name);
    setEditCategoryOpen(true);
  };

  const handleUpdateCategory = () => {
    if (!activeCategory || !categoryName.trim()) return;
    startTransition(async () => {
      try {
        await updateExpenseCategory(activeCategory.id, categoryName.trim());
        showToast("Категория обновлена");
        setEditCategoryOpen(false);
        setActiveCategory(null);
        setCategoryName("");
        loadData();
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Ошибка", "error");
      }
    });
  };

  const handleDeleteCategory = (cat: ExpenseCategoryItem) => {
    if (!confirm(`Удалить категорию "${cat.name}"?`)) return;
    startTransition(async () => {
      try {
        await deleteExpenseCategory(cat.id);
        showToast("Категория удалена");
        loadData();
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Ошибка удаления", "error");
      }
    });
  };

  const categoryLabels: Record<string, string> = {
    FINISHED_GOOD: t("warehouse.finishedGoods"),
    RAW_MATERIAL: t("warehouse.rawMaterials"),
    PACKAGING: t("warehouse.packaging"),
  };

  const filteredClients = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
      (c.district && c.district.toLowerCase().includes(clientSearch.toLowerCase())) ||
      (c.phone && c.phone.includes(clientSearch))
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Справочник"
        subtitle="Единый центр управления мастер-данными: товарами, клиентами и статьями расходов"
      />

      {/* Navigation Tabs */}
      <div className="w-full sm:w-auto max-w-lg">
        <SegmentedControl
          value={activeTab}
          onChange={(v) => setActiveTab(v as TabType)}
          options={[
            { value: "ITEMS", label: "Товары и цены" },
            { value: "CLIENTS", label: `Клиенты (${clients.length})` },
            { value: "EXPENSES", label: `Статьи расходов (${categories.length})` },
          ]}
        />
      </div>

      {loading ? (
        <CardSkeleton />
      ) : (
        <>
          {/* TAB 1: ITEMS */}
          {activeTab === "ITEMS" && (
            <section className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                  {t("settings.productsAndMaterials")}
                </h3>
              </div>

              {items.length === 0 ? (
                <EmptyState icon={<Settings size={28} />} title={t("common.noData")} />
              ) : (
                <Card className="p-0 overflow-hidden">
                  <div className="w-full overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse min-w-[800px]">
                      <thead>
                        <tr className="border-b border-gray-100 dark:border-zinc-800/80 bg-gray-50/70 dark:bg-[#182030]/60 text-xs uppercase font-bold text-gray-500 dark:text-zinc-400 tracking-wider">
                          <th className="px-4 py-3">{t("common.name")}</th>
                          <th className="px-4 py-3">{t("common.category")}</th>
                          <th className="px-4 py-3">{t("common.unit")}</th>
                          <th className="px-4 py-3 text-right">{t("warehouse.costPrice")}</th>
                          <th className="px-4 py-3 text-right">{t("warehouse.salePrice")}</th>
                          <th className="px-4 py-3 text-right">{t("warehouse.minStock")}</th>
                          <th className="px-4 py-3 text-center">{t("common.actions")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-zinc-800/60">
                        {items.filter(isRealItem).map((item) => (
                          <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                            {editingItemId === item.id ? (
                              <>
                                <td className="px-3 py-2">
                                  <input
                                    className="w-full px-2 py-1.5 rounded-lg bg-gray-100 dark:bg-zinc-800 text-sm border border-gray-200/60 dark:border-zinc-700 text-gray-900 dark:text-white"
                                    value={editItemName}
                                    onChange={(e) => setEditItemName(e.target.value)}
                                  />
                                </td>
                                <td className="px-3 py-2 text-gray-500 dark:text-zinc-400 text-xs font-semibold">
                                  {categoryLabels[item.category] || item.category}
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    className="w-20 px-2 py-1.5 rounded-lg bg-gray-100 dark:bg-zinc-800 text-sm border border-gray-200/60 dark:border-zinc-700 text-gray-900 dark:text-white"
                                    value={editItemUnit}
                                    onChange={(e) => setEditItemUnit(e.target.value)}
                                  />
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <input
                                    type="number"
                                    className="w-28 px-2 py-1.5 rounded-lg bg-gray-100 dark:bg-zinc-800 text-sm border border-gray-200/60 dark:border-zinc-700 text-gray-900 dark:text-white text-right"
                                    value={editItemCostPrice}
                                    onChange={(e) => setEditItemCostPrice(e.target.value)}
                                  />
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <input
                                    type="number"
                                    className="w-28 px-2 py-1.5 rounded-lg bg-gray-100 dark:bg-zinc-800 text-sm border border-gray-200/60 dark:border-zinc-700 text-gray-900 dark:text-white text-right"
                                    value={editItemSalePrice}
                                    onChange={(e) => setEditItemSalePrice(e.target.value)}
                                  />
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <input
                                    type="number"
                                    className="w-24 px-2 py-1.5 rounded-lg bg-gray-100 dark:bg-zinc-800 text-sm border border-gray-200/60 dark:border-zinc-700 text-gray-900 dark:text-white text-right"
                                    value={editItemMinStock}
                                    onChange={(e) => setEditItemMinStock(e.target.value)}
                                  />
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      onClick={() => handleSaveItem(item)}
                                      className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors"
                                    >
                                      <Save size={14} />
                                    </button>
                                    <button
                                      onClick={cancelEditingItem}
                                      className="px-2.5 py-1 rounded-lg bg-gray-200 dark:bg-zinc-700 text-gray-600 dark:text-zinc-300 text-xs font-bold hover:bg-gray-300 dark:hover:bg-zinc-600 transition-colors"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{item.name}</td>
                                <td className="px-4 py-3 text-gray-500 dark:text-zinc-400 text-xs font-semibold">
                                  {categoryLabels[item.category] || item.category}
                                </td>
                                <td className="px-4 py-3 text-gray-600 dark:text-zinc-400">{item.unit}</td>
                                <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-zinc-300">{formatUZS(item.costPrice)}</td>
                                <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-zinc-300">
                                  {item.salePrice ? formatUZS(item.salePrice) : "—"}
                                </td>
                                <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-zinc-300">{Number(item.minStock)}</td>
                                <td className="px-4 py-3 text-center">
                                  <button
                                    onClick={() => startEditingItem(item)}
                                    className="px-3 py-1 rounded-lg bg-gray-100 dark:bg-zinc-800 text-xs font-bold text-gray-600 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
                                  >
                                    {t("common.edit")}
                                  </button>
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </section>
          )}

          {/* TAB 2: CLIENTS */}
          {activeTab === "CLIENTS" && (
            <section className="space-y-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    placeholder="Поиск по имени, району, телефону..."
                    className="w-full pl-10 pr-4 py-2 bg-white dark:bg-[#131823] border border-gray-200 dark:border-zinc-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/80"
                  />
                </div>
                <Button onClick={() => setAddClientOpen(true)} className="gap-1.5 self-end sm:self-auto">
                  <Plus size={16} /> Добавить клиента
                </Button>
              </div>

              {filteredClients.length === 0 ? (
                <EmptyState icon={<Users size={28} />} title="Клиенты не найдены" />
              ) : (
                <Card className="p-0 overflow-hidden">
                  <div className="w-full overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse min-w-[700px]">
                      <thead>
                        <tr className="border-b border-gray-100 dark:border-zinc-800/80 bg-gray-50/70 dark:bg-[#182030]/60 text-xs uppercase font-bold text-gray-500 dark:text-zinc-400 tracking-wider">
                          <th className="px-4 py-3">Клиент</th>
                          <th className="px-4 py-3">Район</th>
                          <th className="px-4 py-3">Телефон</th>
                          <th className="px-4 py-3">Адрес</th>
                          <th className="px-4 py-3 text-center">Визиты (дней)</th>
                          <th className="px-4 py-3 text-center">Действия</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-zinc-800/60">
                        {filteredClients.map((client) => (
                          <tr key={client.id} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                            <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">
                              {client.name}
                            </td>
                            <td className="px-4 py-3 text-gray-600 dark:text-zinc-400">
                              {client.district || "—"}
                            </td>
                            <td className="px-4 py-3 text-gray-600 dark:text-zinc-400 font-mono text-xs">
                              {client.phone || "—"}
                            </td>
                            <td className="px-4 py-3 text-gray-600 dark:text-zinc-400 text-xs">
                              {client.address || "—"}
                            </td>
                            <td className="px-4 py-3 text-center tabular-nums text-gray-700 dark:text-zinc-300">
                              {client.visitFrequency ? `${client.visitFrequency} дн.` : "—"}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => startEditClient(client)}
                                  className="p-1.5 rounded-lg bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
                                  title="Редактировать"
                                >
                                  <Edit size={14} />
                                </button>
                                <button
                                  onClick={() => handleDeleteClient(client)}
                                  className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors"
                                  title="Удалить"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </section>
          )}

          {/* TAB 3: EXPENSE CATEGORIES */}
          {activeTab === "EXPENSES" && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                    Управление статьями расходов
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                    Категории используются в модуле «Финансы» и финансовых отчётах.
                  </p>
                </div>
                <Button onClick={() => setAddCategoryOpen(true)} className="gap-1.5">
                  <Plus size={16} /> Добавить статью
                </Button>
              </div>

              {categories.length === 0 ? (
                <EmptyState icon={<Tag size={28} />} title="Нет статей расходов" />
              ) : (
                <Card className="p-0 overflow-hidden divide-y divide-gray-100 dark:divide-zinc-800/80">
                  {categories.map((cat) => (
                    <div
                      key={cat.id}
                      className="flex items-center justify-between p-4 hover:bg-gray-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                          <Tag size={16} />
                        </div>
                        <div>
                          <div className="font-bold text-gray-900 dark:text-white text-sm">
                            {cat.name}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-zinc-400">
                            {cat._count?.financeEntries || 0} связанных операций
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEditCategory(cat)}
                          className="h-8 px-2.5 gap-1 text-xs"
                        >
                          <Edit size={14} /> Переименовать
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteCategory(cat)}
                          className="h-8 px-2.5 gap-1 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                        >
                          <Trash2 size={14} /> Удалить
                        </Button>
                      </div>
                    </div>
                  ))}
                </Card>
              )}
            </section>
          )}
        </>
      )}

      {/* Modal: Add Client */}
      <ModalSheet
        open={addClientOpen}
        onClose={() => setAddClientOpen(false)}
        title="Добавить клиента"
      >
        <div className="flex flex-col gap-4">
          <Input
            label={t("common.name")}
            value={clientFormName}
            onChange={(e) => setClientFormName(e.target.value)}
            placeholder="ООО Азия Трейд"
            autoFocus
          />
          <Input
            label={t("common.district")}
            value={clientFormDistrict}
            onChange={(e) => setClientFormDistrict(e.target.value)}
            placeholder="Чиланзар"
          />
          <Input
            label={t("common.phone")}
            value={clientFormPhone}
            onChange={(e) => setClientFormPhone(e.target.value)}
            placeholder="+998 90 123 45 67"
          />
          <Input
            label={t("common.address")}
            value={clientFormAddress}
            onChange={(e) => setClientFormAddress(e.target.value)}
            placeholder="ул. Амира Темура 1"
          />
          <Input
            label={t("common.visitFrequency")}
            type="number"
            min="1"
            value={clientFormVisitFreq}
            onChange={(e) => setClientFormVisitFreq(e.target.value)}
            placeholder="7"
          />
          <Input
            label={t("common.openingDebt")}
            type="number"
            min="0"
            value={clientFormOpeningDebt}
            onChange={(e) => setClientFormOpeningDebt(e.target.value)}
            placeholder="0"
          />
          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={handleCreateClient}
            disabled={!clientFormName.trim()}
            loading={isPending}
          >
            {t("common.save")}
          </Button>
        </div>
      </ModalSheet>

      {/* Modal: Edit Client */}
      <ModalSheet
        open={editClientOpen}
        onClose={() => setEditClientOpen(false)}
        title="Редактировать клиента"
      >
        <div className="flex flex-col gap-4">
          <Input
            label={t("common.name")}
            value={clientFormName}
            onChange={(e) => setClientFormName(e.target.value)}
            placeholder="Имя клиента"
            autoFocus
          />
          <Input
            label={t("common.district")}
            value={clientFormDistrict}
            onChange={(e) => setClientFormDistrict(e.target.value)}
            placeholder="Район"
          />
          <Input
            label={t("common.phone")}
            value={clientFormPhone}
            onChange={(e) => setClientFormPhone(e.target.value)}
            placeholder="+998 90 123 45 67"
          />
          <Input
            label={t("common.address")}
            value={clientFormAddress}
            onChange={(e) => setClientFormAddress(e.target.value)}
            placeholder="Адрес"
          />
          <Input
            label={t("common.visitFrequency")}
            type="number"
            min="1"
            value={clientFormVisitFreq}
            onChange={(e) => setClientFormVisitFreq(e.target.value)}
            placeholder="7"
          />
          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={handleUpdateClient}
            disabled={!clientFormName.trim()}
            loading={isPending}
          >
            {t("common.save")}
          </Button>
        </div>
      </ModalSheet>

      {/* Modal: Add Expense Category */}
      <ModalSheet
        open={addCategoryOpen}
        onClose={() => setAddCategoryOpen(false)}
        title="Новая статья расходов"
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Название статьи"
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            placeholder="Например: Логистика, Аренда..."
            autoFocus
          />
          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={handleCreateCategory}
            disabled={!categoryName.trim()}
            loading={isPending}
          >
            {t("common.add")}
          </Button>
        </div>
      </ModalSheet>

      {/* Modal: Edit Expense Category */}
      <ModalSheet
        open={editCategoryOpen}
        onClose={() => setEditCategoryOpen(false)}
        title="Переименовать статью расходов"
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Название статьи"
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            placeholder="Новое название..."
            autoFocus
          />
          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={handleUpdateCategory}
            disabled={!categoryName.trim()}
            loading={isPending}
          >
            {t("common.save")}
          </Button>
        </div>
      </ModalSheet>
    </div>
  );
}
