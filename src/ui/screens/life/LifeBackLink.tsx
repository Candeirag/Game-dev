/** Caminho de volta para a tela Vida, no cabeçalho das telas a que se chega por ela (Finanças, Família). */
import { ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export function LifeBackLink() {
  return (
    <Link
      to="/life"
      className="chamfer-br inline-flex min-h-11 min-w-11 items-center gap-1 bg-ink-800 pl-2 pr-4 text-sm font-semibold text-ink-100 shadow-ring transition-colors hover:bg-ink-700"
    >
      <ChevronLeft size={16} aria-hidden />
      Vida
    </Link>
  );
}
