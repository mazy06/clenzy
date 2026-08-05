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
import NavCountBadge from '../../components/NavCountBadge';
import EmptyState from '../../components/EmptyState';
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
        <div className="flex items-center justify-between px-3.5 py-3 border-b border-solid border-border">
          <div className="flex items-center gap-1.5">
            <SheetTitle className="font-[family-name:var(--font-display)] text-[1.05rem] font-semibold tracking-tight text-foreground">
              {t('shop.cart')}
            </SheetTitle>
            <SheetDescription className="sr-only">{t('shop.cart')}</SheetDescription>
            {/* Pastille de compteur : primitive partagee avec la sidebar. */}
            <NavCountBadge count={totalItems} />
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Fermer"
            className="text-muted-foreground hover:text-foreground"
          >
            <Close size={18} strokeWidth={1.75} />
          </Button>
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto px-3.5 py-3">
          {isEmpty ? (
            <EmptyState
              icon={<ShoppingCartOutlined />}
              title={t('shop.cartEmpty')}
              description={t('shop.cartEmptyDesc')}
              variant="transparent"
            />
          ) : (
            <div className="flex flex-col gap-2">
              {cartItems.map(({ product, quantity }) => (
                <div
                  key={product.id}
                  className="flex gap-[7.5px] p-1.5 rounded-lg border border-solid border-border transition-colors duration-150 hover:border-primary/40 motion-reduce:transition-none"
                >
                  {/* Thumbnail */}
                  <div className="w-[64px] h-[64px] rounded-md overflow-hidden shrink-0 border border-solid border-border">
                    <ProductHero product={product} height={62} />
                  </div>

                  {/* Info + controls */}
                  <div className="flex-1 min-w-0 flex flex-col">
                    <div className="flex items-start gap-0.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-[0.82rem] font-semibold leading-[1.25] text-foreground overflow-hidden text-ellipsis whitespace-nowrap" title={product.name}>
                          {product.name}
                        </p>
                        <p className="text-2xs font-medium uppercase tracking-wide tabular-nums text-faint">
                          {product.sku}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => onRemoveItem(product.id)}
                        aria-label="Retirer du panier"
                        className="text-faint hover:text-destructive-ink hover:bg-destructive-soft"
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
                          className="size-6 rounded-md border border-solid border-border text-foreground hover:border-faint hover:bg-muted"
                        >
                          <Remove size={12} strokeWidth={2} />
                        </Button>
                        <p className="min-w-[22px] text-center text-[0.78rem] font-bold tabular-nums text-foreground">
                          {quantity}
                        </p>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => onUpdateQuantity(product.id, 1)}
                          aria-label="Augmenter"
                          className="size-6 rounded-md border border-solid border-border text-foreground hover:border-faint hover:bg-muted"
                        >
                          <Add size={12} strokeWidth={2} />
                        </Button>
                      </div>

                      {/* Line total */}
                      <p className="text-[0.85rem] font-bold tabular-nums tracking-tight text-foreground">
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
          <div className="border-t border-solid border-border px-3.5 py-3 bg-card">
            <div className="flex justify-between mb-0.5">
              <p className="text-xs text-muted-foreground">
                {t('shop.subtotal')}
              </p>
              <p className="text-[0.85rem] font-semibold tabular-nums text-foreground">
                {formatPrice(subtotal)}
              </p>
            </div>

            <div className="flex items-center gap-0.5 mb-2">
              <span className="inline-flex text-success">
                <CheckCircleOutline size={12} strokeWidth={2} />
              </span>
              <p className="text-2xs text-muted-foreground">
                {t('shop.shipping')}
              </p>
            </div>
            <p className="block mb-2 ms-3.5 text-2xs text-faint">
              {t('shop.shippingIntl')}
            </p>

            <Separator className="mb-[7.5px]" />

            <div className="flex justify-between items-baseline mb-3">
              <p className="text-[0.95rem] font-bold text-foreground">
                {t('shop.total')}
              </p>
              <p className="font-[family-name:var(--font-display)] text-[1.15rem] font-semibold tabular-nums tracking-tight text-foreground">
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
