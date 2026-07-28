"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState, FixedActionBar } from "@/components/ui/page-chrome";
import { useToast } from "@/components/ui/toast";
import {
  createComandaAction,
  addComandaItemAction,
  recordComandaPaymentsAction,
  cancelComandaAction,
  getComandaDetail,
} from "@/lib/finance-actions";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ShoppingCart,
  Plus,
  Search,
  ChevronRight,
  User,
  Scissors,
  Package,
  CreditCard,
  Banknote,
  QrCode,
  X,
  Trash2,
} from "lucide-react";
import type { PaymentMethod, SaleStatus } from "@prisma/client";

type ComandasData = {
  sales: {
    id: string;
    status: SaleStatus;
    clientName: string | null;
    operatorName: string;
    total: number;
    itemCount: number;
    createdAt: string;
  }[];
  services: { id: string; name: string; price: number }[];
  products: { id: string; name: string; price: number; stockQty: number }[];
  clients: { id: string; name: string }[];
  barbers: { id: string; name: string }[];
  openCashSessionId: string | null;
  canDiscount: boolean;
};

type ComandaDetail = Awaited<ReturnType<typeof getComandaDetail>>;

type PendingPayment = {
  method: PaymentMethod;
  amount: number;
};

type NewComandaDraft = {
  clientId: string;
  barberId: string;
};

type AddItemDraft = {
  kind: "SERVICE" | "PRODUCT";
  catalogId: string;
  name: string;
  price: number;
  quantity: number;
  discount: string;
};

const STATUS_LABELS: Record<SaleStatus, string> = {
  DRAFT: "Rascunho",
  OPEN: "Aberta",
  CLOSED: "Fechada",
  CANCELLED: "Cancelada",
};

const STATUS_COLORS: Record<SaleStatus, string> = {
  DRAFT: "bg-zinc-500/20 text-zinc-400",
  OPEN: "bg-amber-500/20 text-amber-400",
  CLOSED: "bg-green-500/20 text-green-400",
  CANCELLED: "bg-red-500/20 text-red-400",
};

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  PIX: "PIX",
  CASH: "Dinheiro",
  CARD: "Cartão",
};

const PAYMENT_ICONS: Record<PaymentMethod, typeof QrCode> = {
  PIX: QrCode,
  CASH: Banknote,
  CARD: CreditCard,
};

function isOpenStatus(status: SaleStatus) {
  return status === "OPEN" || status === "DRAFT";
}

function paidTotal(payments: NonNullable<ComandaDetail>["payments"]) {
  return payments
    .filter((p) => p.status === "COMPLETED")
    .reduce((sum, p) => sum + p.amount, 0);
}

function SaleRow({
  sale,
  onClick,
}: {
  sale: ComandasData["sales"][number];
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-accent/50 min-h-[72px]"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-foreground">
            {sale.clientName ?? "Avulso"}
          </p>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_COLORS[sale.status]}`}
          >
            {STATUS_LABELS[sale.status]}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {sale.itemCount} item(ns) ·{" "}
          {format(new Date(sale.createdAt), "dd/MM HH:mm", { locale: ptBR })}
        </p>
        <p className="mt-1 text-sm font-semibold text-amber-400">
          {formatCurrency(sale.total)}
        </p>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
    </button>
  );
}

export function ComandasPanel({ data }: { data: ComandasData }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const [search, setSearch] = useState("");
  const [closedExpanded, setClosedExpanded] = useState(false);

  const [newOpen, setNewOpen] = useState(false);
  const [newStep, setNewStep] = useState<1 | 2 | 3>(1);
  const [newDraft, setNewDraft] = useState<NewComandaDraft>({
    clientId: "",
    barberId: "",
  });
  const [clientSearch, setClientSearch] = useState("");

  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ComandaDetail>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [defaultBarberBySale, setDefaultBarberBySale] = useState<
    Record<string, string>
  >({});

  const [addItemOpen, setAddItemOpen] = useState(false);
  const [catalogTab, setCatalogTab] = useState<"SERVICE" | "PRODUCT">("SERVICE");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [addItemDraft, setAddItemDraft] = useState<AddItemDraft | null>(null);

  const [chargeOpen, setChargeOpen] = useState(false);
  const [chargeMethod, setChargeMethod] = useState<PaymentMethod>("PIX");
  const [chargeAmount, setChargeAmount] = useState("");
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);

  const [cancelOpen, setCancelOpen] = useState(false);

  const filteredSales = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data.sales;
    return data.sales.filter((s) =>
      (s.clientName ?? "avulso").toLowerCase().includes(q)
    );
  }, [data.sales, search]);

  const openSales = useMemo(
    () => filteredSales.filter((s) => isOpenStatus(s.status)),
    [filteredSales]
  );

  const closedSales = useMemo(
    () => filteredSales.filter((s) => !isOpenStatus(s.status)),
    [filteredSales]
  );

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return data.clients;
    return data.clients.filter((c) => c.name.toLowerCase().includes(q));
  }, [data.clients, clientSearch]);

  const loadDetail = useCallback(async (saleId: string) => {
    setDetailLoading(true);
    try {
      const result = await getComandaDetail(saleId);
      setDetail(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao carregar comanda");
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (detailOpen && selectedId) {
      void loadDetail(selectedId);
    }
  }, [detailOpen, selectedId, loadDetail]);

  function openDetail(saleId: string) {
    setSelectedId(saleId);
    setDetailOpen(true);
    setPendingPayments([]);
  }

  function closeDetail() {
    setDetailOpen(false);
    setSelectedId(null);
    setDetail(null);
    setAddItemOpen(false);
    setAddItemDraft(null);
    setChargeOpen(false);
    setPendingPayments([]);
  }

  function resetNewComanda() {
    setNewStep(1);
    setNewDraft({ clientId: "", barberId: "" });
    setClientSearch("");
  }

  function openNewComanda() {
    resetNewComanda();
    setNewOpen(true);
  }

  function refreshAfterAction(message?: string) {
    router.refresh();
    if (selectedId) void loadDetail(selectedId);
    if (message) toast.success(message);
  }

  function confirmNewComanda() {
    startTransition(async () => {
      try {
        const result = await createComandaAction({
          clientId: newDraft.clientId || undefined,
          defaultBarberId: newDraft.barberId || undefined,
        });
        if (newDraft.barberId) {
          setDefaultBarberBySale((prev) => ({
            ...prev,
            [result.id]: newDraft.barberId,
          }));
        }
        setNewOpen(false);
        resetNewComanda();
        router.refresh();
        toast.success("Comanda aberta");
        openDetail(result.id);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao criar comanda");
      }
    });
  }

  function submitAddItem() {
    if (!selectedId || !addItemDraft) return;
    const discount = data.canDiscount ? Number(addItemDraft.discount || 0) : 0;
    const barberId =
      addItemDraft.kind === "SERVICE"
        ? defaultBarberBySale[selectedId] || undefined
        : undefined;

    startTransition(async () => {
      try {
        await addComandaItemAction(selectedId, {
          kind: addItemDraft.kind,
          ...(addItemDraft.kind === "SERVICE"
            ? { serviceId: addItemDraft.catalogId, barberId }
            : { productId: addItemDraft.catalogId }),
          quantity: addItemDraft.quantity,
          ...(discount > 0 ? { discount } : {}),
        });
        setAddItemOpen(false);
        setAddItemDraft(null);
        setCatalogSearch("");
        refreshAfterAction("Item adicionado");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao adicionar item");
      }
    });
  }

  function addPendingPayment() {
    const amount = Number(chargeAmount);
    if (!amount || amount <= 0) {
      toast.error("Informe um valor válido");
      return;
    }
    setPendingPayments((prev) => [...prev, { method: chargeMethod, amount }]);
    setChargeAmount("");
  }

  function removePendingPayment(index: number) {
    setPendingPayments((prev) => prev.filter((_, i) => i !== index));
  }

  function confirmCharge() {
    if (!selectedId || !detail) return;

    const toSubmit = [...pendingPayments];
    const amount = Number(chargeAmount);
    if (amount > 0) {
      toSubmit.push({ method: chargeMethod, amount });
    }

    if (toSubmit.length === 0) {
      toast.error("Adicione ao menos um pagamento");
      return;
    }

    const totalPaying = toSubmit.reduce((s, p) => s + p.amount, 0);
    const alreadyPaid = paidTotal(detail.payments);
    const remaining = detail.total - alreadyPaid;
    if (totalPaying < remaining) {
      toast.error(`Faltam ${formatCurrency(remaining - totalPaying)} para fechar`);
      return;
    }
    if (totalPaying > remaining) {
      toast.error(`Valor excede o saldo restante em ${formatCurrency(totalPaying - remaining)}`);
      return;
    }

    startTransition(async () => {
      try {
        await recordComandaPaymentsAction({
          saleId: selectedId,
          payments: toSubmit,
          idempotencyKey: crypto.randomUUID(),
        });
        setChargeOpen(false);
        setPendingPayments([]);
        setChargeAmount("");
        refreshAfterAction("Pagamento registrado");
        router.refresh();
        const updated = await getComandaDetail(selectedId);
        setDetail(updated);
        if (updated?.status === "CLOSED") {
          toast.success("Comanda fechada");
          closeDetail();
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao registrar pagamento");
        void loadDetail(selectedId);
      }
    });
  }

  function confirmCancel() {
    if (!selectedId) return;
    startTransition(async () => {
      try {
        await cancelComandaAction(selectedId);
        setCancelOpen(false);
        closeDetail();
        router.refresh();
        toast.success("Comanda cancelada");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao cancelar");
      }
    });
  }

  const catalogItems = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    if (catalogTab === "SERVICE") {
      return data.services.filter((s) => s.name.toLowerCase().includes(q));
    }
    return data.products.filter((p) => p.name.toLowerCase().includes(q));
  }, [catalogTab, catalogSearch, data.services, data.products]);

  const detailRemaining = detail
    ? detail.total - paidTotal(detail.payments)
    : 0;

  const chargeRemaining = detail
    ? Math.max(
        0,
        detail.total -
          paidTotal(detail.payments) -
          pendingPayments.reduce((s, p) => s + p.amount, 0)
      )
    : 0;

  return (
    <div className="space-y-6">
      {!data.openCashSessionId && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-300">
          Caixa fechado — abra o caixa antes de receber pagamentos em dinheiro.
        </p>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por cliente..."
          className="pl-9 min-h-[44px]"
        />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Abertas ({openSales.length})
        </h2>
        {openSales.length === 0 ? (
          <EmptyState
            icon={<ShoppingCart className="h-8 w-8" />}
            title="Nenhuma comanda aberta"
            description={
              search
                ? "Nenhum resultado para esta busca."
                : "Abra uma nova comanda para registrar vendas."
            }
          />
        ) : (
          <div className="space-y-2">
            {openSales.map((sale) => (
              <SaleRow key={sale.id} sale={sale} onClick={() => openDetail(sale.id)} />
            ))}
          </div>
        )}
      </section>

      {closedSales.length > 0 && (
        <section className="space-y-3">
          <button
            type="button"
            onClick={() => setClosedExpanded((v) => !v)}
            className="flex w-full items-center justify-between text-sm font-semibold uppercase tracking-wide text-muted-foreground min-h-[44px]"
          >
            <span>Fechadas / canceladas ({closedSales.length})</span>
            <ChevronRight
              className={`h-4 w-4 transition-transform ${closedExpanded ? "rotate-90" : ""}`}
            />
          </button>
          {closedExpanded && (
            <div className="space-y-2">
              {closedSales.map((sale) => (
                <SaleRow key={sale.id} sale={sale} onClick={() => openDetail(sale.id)} />
              ))}
            </div>
          )}
        </section>
      )}

      <FixedActionBar>
        <Button
          type="button"
          className="w-full min-h-[48px] gap-2"
          onClick={openNewComanda}
        >
          <Plus className="h-5 w-5" />
          Nova comanda
        </Button>
      </FixedActionBar>

      {/* Nova comanda wizard */}
      <ResponsiveDialog
        open={newOpen}
        onOpenChange={(open) => {
          setNewOpen(open);
          if (!open) resetNewComanda();
        }}
        title={
          newStep === 1
            ? "Cliente"
            : newStep === 2
              ? "Profissional"
              : "Confirmar"
        }
        description={
          newStep === 1
            ? "Passo 1 de 3 — escolha o cliente ou avulso"
            : newStep === 2
              ? "Passo 2 de 3 — profissional responsável"
              : "Passo 3 de 3 — revisar e abrir comanda"
        }
        mobileVariant="full"
        dirty={Boolean(newDraft.clientId || newDraft.barberId)}
        footer={
          <div className="flex gap-2">
            {newStep > 1 ? (
              <Button
                type="button"
                variant="secondary"
                className="flex-1 min-h-[44px]"
                onClick={() => setNewStep((s) => (s - 1) as 1 | 2 | 3)}
              >
                Voltar
              </Button>
            ) : (
              <Button
                type="button"
                variant="secondary"
                className="flex-1 min-h-[44px]"
                onClick={() => setNewOpen(false)}
              >
                Cancelar
              </Button>
            )}
            {newStep < 3 ? (
              <Button
                type="button"
                className="flex-1 min-h-[44px]"
                onClick={() => setNewStep((s) => (s + 1) as 1 | 2 | 3)}
              >
                Continuar
              </Button>
            ) : (
              <Button
                type="button"
                className="flex-1 min-h-[44px]"
                disabled={pending}
                onClick={confirmNewComanda}
              >
                {pending ? "Abrindo..." : "Abrir comanda"}
              </Button>
            )}
          </div>
        }
      >
        {newStep === 1 && (
          <div className="space-y-3">
            <Input
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              placeholder="Buscar cliente..."
              className="min-h-[44px]"
            />
            <button
              type="button"
              onClick={() => setNewDraft((d) => ({ ...d, clientId: "" }))}
              className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left min-h-[52px] ${
                !newDraft.clientId
                  ? "border-amber-500/50 bg-amber-500/10"
                  : "border-border bg-card"
              }`}
            >
              <User className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-medium">Cliente avulso</span>
            </button>
            <div className="max-h-[50vh] space-y-2 overflow-y-auto">
              {filteredClients.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setNewDraft((d) => ({ ...d, clientId: c.id }))}
                  className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left min-h-[52px] ${
                    newDraft.clientId === c.id
                      ? "border-amber-500/50 bg-amber-500/10"
                      : "border-border bg-card"
                  }`}
                >
                  <User className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm font-medium">{c.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {newStep === 2 && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setNewDraft((d) => ({ ...d, barberId: "" }))}
              className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left min-h-[52px] ${
                !newDraft.barberId
                  ? "border-amber-500/50 bg-amber-500/10"
                  : "border-border bg-card"
              }`}
            >
              <Scissors className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-medium">Definir depois</span>
            </button>
            {data.barbers.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setNewDraft((d) => ({ ...d, barberId: b.id }))}
                className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left min-h-[52px] ${
                  newDraft.barberId === b.id
                    ? "border-amber-500/50 bg-amber-500/10"
                    : "border-border bg-card"
                }`}
              >
                <Scissors className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium">{b.name}</span>
              </button>
            ))}
          </div>
        )}

        {newStep === 3 && (
          <div className="space-y-4 rounded-xl border border-border bg-card p-4">
            <div>
              <p className="text-xs text-muted-foreground">Cliente</p>
              <p className="text-sm font-medium">
                {newDraft.clientId
                  ? data.clients.find((c) => c.id === newDraft.clientId)?.name
                  : "Avulso"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Profissional</p>
              <p className="text-sm font-medium">
                {newDraft.barberId
                  ? data.barbers.find((b) => b.id === newDraft.barberId)?.name
                  : "A definir nos itens"}
              </p>
            </div>
          </div>
        )}
      </ResponsiveDialog>

      {/* Detalhe da comanda */}
      <ResponsiveDialog
        open={detailOpen}
        onOpenChange={(open) => {
          if (!open) closeDetail();
        }}
        title={detail?.clientName ?? "Comanda"}
        description={
          detail
            ? `${STATUS_LABELS[detail.status]} · ${detail.operatorName}`
            : undefined
        }
        mobileVariant="full"
        footer={
          detail && isOpenStatus(detail.status) ? (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                className="min-h-[44px] text-red-400"
                onClick={() => setCancelOpen(true)}
              >
                <X className="h-4 w-4" />
                Cancelar
              </Button>
              <Button
                type="button"
                className="flex-1 min-h-[44px]"
                onClick={() => {
                  setChargeAmount(chargeRemaining > 0 ? chargeRemaining.toFixed(2) : "");
                  setChargeOpen(true);
                }}
                disabled={!detail.items.length}
              >
                Cobrar {detailRemaining > 0 ? formatCurrency(detailRemaining) : ""}
              </Button>
            </div>
          ) : undefined
        }
      >
        {detailLoading && (
          <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
        )}

        {!detailLoading && detail && (
          <div className="space-y-6 pb-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground">Cliente</p>
                <p className="font-medium">{detail.clientName ?? "Avulso"}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground">Operador</p>
                <p className="font-medium">{detail.operatorName}</p>
              </div>
            </div>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Itens</h3>
                {isOpenStatus(detail.status) && (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="gap-1"
                    onClick={() => {
                      setCatalogTab("SERVICE");
                      setCatalogSearch("");
                      setAddItemDraft(null);
                      setAddItemOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    Adicionar
                  </Button>
                )}
              </div>

              {detail.items.length === 0 ? (
                <EmptyState
                  title="Sem itens"
                  description="Adicione serviços ou produtos à comanda."
                />
              ) : (
                <div className="space-y-2">
                  {detail.items.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-border bg-card px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{item.name}</p>
                          {item.barberName && (
                            <p className="text-xs text-muted-foreground">{item.barberName}</p>
                          )}
                        </div>
                        <p className="shrink-0 text-sm font-semibold text-amber-400">
                          {formatCurrency(item.total)}
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.quantity}x {formatCurrency(item.unitPrice)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {detail.payments.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Pagamentos</h3>
                {detail.payments.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-2 text-sm"
                  >
                    <span>{PAYMENT_LABELS[p.method]}</span>
                    <span className="font-medium">{formatCurrency(p.amount)}</span>
                  </div>
                ))}
              </section>
            )}

            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(detail.subtotal)}</span>
              </div>
              {paidTotal(detail.payments) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Pago</span>
                  <span className="text-green-400">
                    -{formatCurrency(paidTotal(detail.payments))}
                  </span>
                </div>
              )}
              {isOpenStatus(detail.status) && detailRemaining > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Restante</span>
                  <span className="text-amber-400">{formatCurrency(detailRemaining)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                <span>Total</span>
                <span className="text-amber-400">{formatCurrency(detail.total)}</span>
              </div>
            </div>
          </div>
        )}
      </ResponsiveDialog>

      {/* Adicionar item */}
      <ResponsiveDialog
        open={addItemOpen}
        onOpenChange={(open) => {
          setAddItemOpen(open);
          if (!open) {
            setAddItemDraft(null);
            setCatalogSearch("");
          }
        }}
        title={addItemDraft ? addItemDraft.name : "Adicionar item"}
        description={
          addItemDraft
            ? `${formatCurrency(addItemDraft.price)} · ajuste quantidade`
            : "Busque serviços ou produtos"
        }
        mobileVariant="full"
        footer={
          addItemDraft ? (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                className="flex-1 min-h-[44px]"
                onClick={() => setAddItemDraft(null)}
              >
                Voltar
              </Button>
              <Button
                type="button"
                className="flex-1 min-h-[44px]"
                disabled={pending}
                onClick={submitAddItem}
              >
                {pending ? "Adicionando..." : "Confirmar"}
              </Button>
            </div>
          ) : undefined
        }
      >
        {!addItemDraft ? (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={catalogTab === "SERVICE" ? "primary" : "secondary"}
                className="flex-1 min-h-[40px]"
                onClick={() => setCatalogTab("SERVICE")}
              >
                <Scissors className="h-4 w-4" />
                Serviços
              </Button>
              <Button
                type="button"
                size="sm"
                variant={catalogTab === "PRODUCT" ? "primary" : "secondary"}
                className="flex-1 min-h-[40px]"
                onClick={() => setCatalogTab("PRODUCT")}
                disabled={data.products.length === 0}
              >
                <Package className="h-4 w-4" />
                Produtos
              </Button>
            </div>
            <Input
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
              placeholder={`Buscar ${catalogTab === "SERVICE" ? "serviço" : "produto"}...`}
              className="min-h-[44px]"
            />
            <div className="max-h-[55vh] space-y-2 overflow-y-auto">
              {catalogItems.length === 0 && (
                <EmptyState title="Nenhum resultado" />
              )}
              {catalogTab === "SERVICE" &&
                catalogItems.map((s) => {
                  const svc = s as ComandasData["services"][number];
                  return (
                    <button
                      key={svc.id}
                      type="button"
                      onClick={() =>
                        setAddItemDraft({
                          kind: "SERVICE",
                          catalogId: svc.id,
                          name: svc.name,
                          price: svc.price,
                          quantity: 1,
                          discount: "",
                        })
                      }
                      className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-left min-h-[52px]"
                    >
                      <span className="text-sm font-medium">{svc.name}</span>
                      <span className="text-sm text-amber-400">
                        {formatCurrency(svc.price)}
                      </span>
                    </button>
                  );
                })}
              {catalogTab === "PRODUCT" &&
                catalogItems.map((p) => {
                  const prod = p as ComandasData["products"][number];
                  return (
                    <button
                      key={prod.id}
                      type="button"
                      disabled={prod.stockQty <= 0}
                      onClick={() =>
                        setAddItemDraft({
                          kind: "PRODUCT",
                          catalogId: prod.id,
                          name: prod.name,
                          price: prod.price,
                          quantity: 1,
                          discount: "",
                        })
                      }
                      className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-left min-h-[52px] disabled:opacity-40"
                    >
                      <div>
                        <span className="text-sm font-medium">{prod.name}</span>
                        <p className="text-xs text-muted-foreground">
                          Estoque: {prod.stockQty}
                        </p>
                      </div>
                      <span className="text-sm text-amber-400">
                        {formatCurrency(prod.price)}
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground">Quantidade</label>
              <Input
                type="number"
                min={1}
                value={addItemDraft.quantity}
                onChange={(e) =>
                  setAddItemDraft((d) =>
                    d ? { ...d, quantity: Math.max(1, Number(e.target.value) || 1) } : d
                  )
                }
                className="mt-1 min-h-[44px]"
              />
            </div>
            {data.canDiscount && (
              <div>
                <label className="text-sm text-muted-foreground">
                  Desconto (R$)
                </label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={addItemDraft.discount}
                  onChange={(e) =>
                    setAddItemDraft((d) => (d ? { ...d, discount: e.target.value } : d))
                  }
                  placeholder="0,00"
                  className="mt-1 min-h-[44px]"
                />
              </div>
            )}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-semibold text-amber-400">
                  {formatCurrency(
                    addItemDraft.price * addItemDraft.quantity -
                      (data.canDiscount ? Number(addItemDraft.discount || 0) : 0)
                  )}
                </span>
              </div>
            </div>
          </div>
        )}
      </ResponsiveDialog>

      {/* Cobrança */}
      <ResponsiveDialog
        open={chargeOpen}
        onOpenChange={setChargeOpen}
        title="Cobrar"
        description="Registre pagamentos e feche a comanda"
        mobileVariant="sheet"
        footer={
          <Button
            type="button"
            className="w-full min-h-[48px]"
            disabled={pending}
            onClick={confirmCharge}
          >
            {pending ? "Processando..." : "Confirmar pagamento"}
          </Button>
        }
      >
        {detail && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <p className="text-xs text-muted-foreground">Saldo restante</p>
              <p className="text-2xl font-bold text-amber-400">
                {formatCurrency(chargeRemaining)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Total: {formatCurrency(detail.total)}
              </p>
            </div>

            <div className="flex gap-2">
              {(["PIX", "CASH", "CARD"] as PaymentMethod[]).map((method) => {
                const Icon = PAYMENT_ICONS[method];
                return (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setChargeMethod(method)}
                    className={`flex flex-1 flex-col items-center gap-1 rounded-xl border px-2 py-3 min-h-[64px] ${
                      chargeMethod === method
                        ? "border-amber-500/50 bg-amber-500/10"
                        : "border-border bg-card"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-xs font-medium">{PAYMENT_LABELS[method]}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex gap-2">
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={chargeAmount}
                onChange={(e) => setChargeAmount(e.target.value)}
                placeholder="Valor"
                className="min-h-[44px]"
              />
              <Button
                type="button"
                variant="secondary"
                className="shrink-0 min-h-[44px]"
                onClick={addPendingPayment}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {pendingPayments.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase">
                  Pagamentos divididos
                </p>
                {pendingPayments.map((p, i) => (
                  <div
                    key={`${p.method}-${i}`}
                    className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2 text-sm"
                  >
                    <span>
                      {PAYMENT_LABELS[p.method]} · {formatCurrency(p.amount)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removePendingPayment(i)}
                      className="rounded-lg p-2 text-red-400 min-h-[36px] min-w-[36px]"
                      aria-label="Remover pagamento"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </ResponsiveDialog>

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancelar comanda"
        description="Esta ação não pode ser desfeita. Deseja cancelar esta comanda?"
        confirmLabel="Cancelar comanda"
        tone="danger"
        loading={pending}
        onConfirm={confirmCancel}
      />

      <Link
        href="/financeiro"
        className="inline-block text-sm text-amber-400 hover:text-amber-300"
      >
        ← Voltar ao financeiro
      </Link>
    </div>
  );
}
