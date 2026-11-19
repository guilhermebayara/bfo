import { useState } from 'react';
import type { Category } from '../../shared/types';
import { CategoryOptions } from './index';
export function CategoryPicker({
  categories,
  value,
  onChange,
  label = 'Categoria',
  disabled = false,
}: {
  categories: Category[];
  value: string;
  onChange: (v: string) => void;
  label?: string;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState('');
  return (
    <label>
      {label}
      <input
        aria-label={`Buscar ${label.toLocaleLowerCase('pt-BR')}`}
        placeholder="Buscar categoria ou grupo"
        value={search}
        disabled={disabled}
        onChange={(e) => setSearch(e.target.value)}
      />
      <select
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Sem categoria</option>
        <CategoryOptions
          categories={categories.filter(
            (c) =>
              c.id === value ||
              `${c.group_name} ${c.name}`
                .toLocaleLowerCase('pt-BR')
                .includes(search.toLocaleLowerCase('pt-BR')),
          )}
        />
      </select>
    </label>
  );
}
