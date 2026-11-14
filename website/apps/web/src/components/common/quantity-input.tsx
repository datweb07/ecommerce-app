'use client';
import { Minus, Plus } from 'lucide-react';
import { useId } from 'react';
import { Button } from '../ui/button';
import { Input, Label } from '../ui/fields';

export function QuantityInput({
  value,
  onChange,
  min = 1,
  max = 25,
  label = 'Số lượng',
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label?: string;
}) {
  const id = useId();
  return (
    <div className="grid justify-items-start gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          aria-label="Giảm số lượng"
          disabled={value <= min}
          onClick={() => onChange(value - 1)}
        >
          <Minus size={16} />
        </Button>
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={1}
          value={value}
          className="w-18 text-center"
          onChange={(event) => {
            const next = event.currentTarget.valueAsNumber;
            if (Number.isInteger(next) && next >= min && next <= max)
              onChange(next);
          }}
        />
        <Button
          variant="outline"
          size="icon"
          aria-label="Tăng số lượng"
          disabled={value >= max}
          onClick={() => onChange(value + 1)}
        >
          <Plus size={16} />
        </Button>
      </div>
    </div>
  );
}
