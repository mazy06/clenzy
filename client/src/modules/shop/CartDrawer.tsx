import React from 'react';
import {
  Button,
  Separator,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '../../components/ui';
import {
  Close,
  Add,
  Remove,
  Delete,
  ShoppingCartOutlined,
  CheckCircleOutline,
} from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { Money } from '../../components/Money';
import { SHOP_PRODUCTS } from './shopProducts';
import ProductHero from './ProductHero';

const formatPrice = (cents: number) => <Money value={cents / 100} from="EUR" />;

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  cart: Map<string, number>;
  onUpdateQuantity: (productId: string, delta: number) => void;
  onRemoveItem: (productId: string) => void;
  onCheckout: () => void;
}

const CartDrawer: React.FC<CartDrawerProps> = ({
  open,
  onClose,
  cart,
  onUpdateQuantity,
  onRemoveItem,
  onCheckout,
}) => {
  const { t } = useTranslation();

  const cartItems = Array.from(cart.entries())
    .flatMap(([id, qty]) => {
      const product = SHOP_PRODUCTS.find((p) => p.id === id);
      return product ? [{ product, quantity: qty }] : [];
    });

  const subtotal = cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const isEmpty = cartItems.length === 0;

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      {/* Le panneau porte deja son propre bouton Fermer dans l'en-tete. */}
      <SheetContent side="right" showCloseButton={false} className="w-full min-[600px]:w-[420px] max-w-[100vw] p-0 gap-0">
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-3.5 py-3 border-b border-solid border-[var(--line)]">
          <div className="flex items-center gap-1.5">
            <SheetTitle className="cn-text-h6 font-semibold font-[family-name:var(--font-display)] text-[1.05rem] tracking-[-0.01em] text-[var(--ink)]">
              {t('shop.cart')}
            </SheetTitle>
            <SheetDescription className="sr-only">{t('shop.cart')}</SheetDescription>
            {totalItems > 0 && (
              <div className="text-[0.6875rem] font-bold px-1.5 py-0 rounded-[5px] bg-[var(--accent-soft)] text-[var(--accent)] tabular-nums tracking-[0.02em]">
                {totalItems}
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Fermer"
            className="text-[var(--muted)] hover:text-[var(--ink)]"
          >
            <Close size={18} strokeWidth={1.75} />
          </Button>
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto px-3.5 py-3">
          {isEmpty ? (
            <div className="text-center py-9">
              <div className="w-[64px] h-[64px] mx-auto mb-3 rounded-[14px] inline-flex items-center justify-center bg-[var(--accent-soft)] text-[var(--accent)]">
                <ShoppingCartOutlined size={28} strokeWidth={1.5} />
              </div>
              <p className="cn-text-body1 font-semibold text-[0.95rem] mb-0.5">
                {t('shop.cartEmpty')}
              </p>
              <p className="cn-text-body1 text-[0.78rem] text-muted-foreground leading-[1.5] max-w-[240px] mx-auto">
                {t('shop.cartEmptyDesc')}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {cartItems.map(({ product, quantity }) => (
                <div
                  key={product.id}
                  className="flex gap-[7.5px] p-1.5 rounded-[10px] border border-solid border-[var(--line)] hover:border-[var(--line-2)]"
                  style={{ transition: 'border-color 0.18s cubic-bezier(.16,1,.3,1)' }}
                >
                  {/* Thumbnail */}
                  <div className="w-[64px] h-[64px] rounded-[8px] overflow-hidden shrink-0 border border-[var(--line)]">
                    <ProductHero product={product} height={62} />
                  </div>

                  {/* Info + controls */}
                  <div className="flex-1 min-w-0 flex flex-col">
                    <div className="flex items-start gap-0.5">
                      <div className="flex-1 min-w-0">
                        <p className="cn-text-body1 font-semibold text-[0.82rem] leading-[1.25] text-foreground overflow-hidden text-ellipsis whitespace-nowrap" title={product.name}>
                          {product.name}
                        </p>
                        <p className="cn-text-body1 text-[0.6875rem] text-muted-foreground opacity-60 tracking-[0.04em] tabular-nums uppercase">
                          {product.sku}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => onRemoveItem(product.id)}
                        aria-label="Retirer du panier"
                        className="text-[var(--faint)] hover:text-[var(--err)] hover:bg-[var(--err-soft)]"
                      >
                        <Delete size={14} strokeWidth={1.75} />
                      </Button>
                    </div>

                    <div className="flex items-center justify-between mt-auto pt-0.5">
                      {/* Quantity controls */}
                      <div className="flex items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => onUpdateQuantity(product.id, -1)}
                          aria-label="Diminuer"
                          className="size-6 rounded-[6px] border border-solid border-[var(--line)] text-[var(--ink)] hover:border-[var(--faint)] hover:bg-[var(--hover)]"
                        >
                          <Remove size={12} strokeWidth={2} />
                        </Button>
                        <p className="cn-text-body1 font-bold min-w-[22px] text-center text-[0.78rem] text-foreground tabular-nums">
                          {quantity}
                        </p>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => onUpdateQuantity(product.id, 1)}
                          aria-label="Augmenter"
                          className="size-6 rounded-[6px] border border-solid border-[var(--line)] text-[var(--ink)] hover:border-[var(--faint)] hover:bg-[var(--hover)]"
                        >
                          <Add size={12} strokeWidth={2} />
                        </Button>
                      </div>

                      {/* Line total */}
                      <p className="cn-text-body1 font-bold text-[0.85rem] text-foreground tabular-nums tracking-[-0.01em]">
                        {formatPrice(product.price * quantity)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {!isEmpty && (
          <div className="border-t border-[var(--line)] px-3.5 py-3 bg-[var(--card)]">
            <div className="flex justify-between mb-0.5">
              <p className="cn-text-body1 text-[0.8rem] text-muted-foreground">
                {t('shop.subtotal')}
              </p>
              <p className="cn-text-body1 text-[0.85rem] font-semibold text-foreground tabular-nums">
                {formatPrice(subtotal)}
              </p>
            </div>

            <div className="flex items-center gap-0.5 mb-2">
              <div className="text-[var(--ok)] inline-flex">
                <CheckCircleOutline size={12} strokeWidth={2} />
              </div>
              <p className="cn-text-body1 text-[0.7rem] text-muted-foreground">
                {t('shop.shipping')}
              </p>
            </div>
            <p className="cn-text-body1 text-[0.66rem] text-muted-foreground opacity-60 block mb-2 ms-3.5">
              {t('shop.shippingIntl')}
            </p>

            <Separator className="mb-[7.5px]" />

            <div className="flex justify-between items-baseline mb-3">
              <p className="cn-text-body1 font-bold text-[0.95rem]">
                {t('shop.total')}
              </p>
              <p className="cn-text-body1 font-semibold font-[family-name:var(--font-display)] text-[1.15rem] text-[var(--ink)] tabular-nums tracking-[-0.01em]">
                {formatPrice(subtotal)}
              </p>
            </div>

            <Button
              className="w-full shrink"
              size="lg"
              onClick={onCheckout}
            >
              {t('shop.checkout')}
            </Button>
          </div>
        )}
      </div>
      </SheetContent>
    </Sheet>
  );
};

export default CartDrawer;
