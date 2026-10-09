import BaitlyMarkLogo from '../../src/components/BaitlyMarkLogo';

/** Symbole statique du site, issu du logo Baitly partagé. */
export default function BaitlyMark({ size = 30 }: { size?: number }) {
  return <BaitlyMarkLogo variant="mark" size={size} colorMode="inherit" disableAnimation />;
}
