import React from 'react';
import { Alert as UiAlert, AlertDescription } from '../../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Button, Checkbox, Separator, Spinner } from '../../../components/ui';
import {
  ShoppingCart,
  Payment,
  CheckCircle,
} from '../../../icons';
import type { UsePanelPaymentReturn } from './usePanelPayment';
import { Money } from '../../../components/Money';

interface PanelPaymentCartProps {
  payment: UsePanelPaymentReturn;
}

const PanelPaymentCart: React.FC<PanelPaymentCartProps> = ({ payment }) => {
  const {
    cartItems,
    toggleCartItem,
    selectAll,
    deselectAll,
    selectedTotal,
    selectedIds,
    paying,
    paymentError,
    paymentSuccess,
    initiatePayment,
  } = payment;

  if (cartItems.length === 0) {
    return (
      <div className="py-1.5">
        <p className="cn-text-body1 text-[0.6875rem] text-muted-foreground italic">
          Aucune intervention en attente de paiement
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-0.5">
          <span className="inline-flex text-primary"><ShoppingCart size={16} strokeWidth={1.75} /></span>
          <p className="cn-text-body1 text-[0.6875rem] font-bold uppercase tracking-[0.05em] text-muted-foreground">
            Panier ({cartItems.length})
          </p>
        </div>
        <div className="flex gap-0.5">
          {/* Raccourcis de selection repetes dans un en-tete : registre tertiaire. */}
          <Button variant="ghost" size="xs" onClick={selectAll}>
            Tout
          </Button>
          <Button variant="ghost" size="xs" onClick={deselectAll}>
            Aucun
          </Button>
        </div>
      </div>

      {/* Cart items */}
      <div className="flex flex-col gap-0.5 mb-2">
        {cartItems.map((item) => (
          // action.selected de MUI = l'encre a 8 % (soit deux fois action.hover) :
          // c'est cette valeur qui est reecrite ici, la bordure portant deja la selection.
          <div
            key={item.interventionId}
            onClick={() => toggleCartItem(item.interventionId)}
            className={
              'flex items-center gap-1 p-1 rounded-lg border border-solid cursor-pointer hover:bg-[var(--hover)] '
              + (item.selected
                ? 'border-[var(--mui-primary)] bg-[color-mix(in_srgb,var(--ink)_8%,transparent)]'
                : 'border-[var(--line)] bg-transparent')
            }
          >
            <Checkbox
              checked={item.selected}
              onClick={(e) => e.stopPropagation()}
              onCheckedChange={() => toggleCartItem(item.interventionId)}
            />
            <div className="flex-1 min-w-0">
              <p className="cn-text-body1 text-[0.6875rem] font-medium overflow-hidden text-ellipsis whitespace-nowrap">
                {item.title}
              </p>
            </div>
            <p className="cn-text-body1 text-[0.75rem] font-bold">
              <Money value={item.cost} decimals={0} />
            </p>
          </div>
        ))}
      </div>

      <Separator className="mb-2.5" />

      {/* Total */}
      <div className="flex justify-between items-center mb-2">
        <p className="cn-text-body1 text-[0.75rem] font-semibold">Total sélectionné</p>
        <p className="cn-text-body1 text-[1rem] font-bold text-primary">
          <Money value={selectedTotal} />
        </p>
      </div>

      {/* Errors / Success */}
      {paymentError && (
        <UiAlert variant="destructive" className="text-[0.6875rem] mb-1.5">
          <TriangleAlert />
          <AlertDescription>{paymentError}</AlertDescription>
        </UiAlert>
      )}
      {paymentSuccess && (
        <UiAlert variant="success" className="text-[0.6875rem] mb-1.5">
          <CheckCircle size={18} strokeWidth={1.75} />
          <AlertDescription>Paiement effectué avec succès !</AlertDescription>
        </UiAlert>
      )}

      {/* Pay button */}
      <Button
        variant="default"
        size="sm"
        className="w-full shrink"
        onClick={initiatePayment}
        disabled={paying || selectedIds.length === 0}
      >
        {paying ? <Spinner className="size-3.5" /> : <Payment size={16} strokeWidth={1.75} />}
        {paying ? 'Paiement en cours...' : <>Payer <Money value={selectedTotal} /></>}
      </Button>
    </div>
  );
};

export default PanelPaymentCart;
