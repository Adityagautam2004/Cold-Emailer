"use client";

import { useEffect, useState } from "react";
import { Input } from "./input";

/**
 * Plain <input type="number"> clamps on every keystroke (Math.max(min, Number(e.target.value))),
 * which snaps back to `min` the instant the field is cleared — making it impossible to select-all
 * and type a fresh multi-digit value. This mirrors the field as free-typed text, propagates valid
 * in-range numbers up as the user types, and only clamps out-of-range/empty input on blur.
 */
export function NumberField({
  value,
  onChange,
  min,
  max,
  className,
  id,
}: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max?: number;
  className?: string;
  id?: string;
}) {
  const [raw, setRaw] = useState(String(value));

  useEffect(() => {
    setRaw(String(value));
  }, [value]);

  function commit(next: string) {
    const parsed = Number(next);
    const clamped = Math.min(max ?? Infinity, Math.max(min, Number.isFinite(parsed) && next !== "" ? parsed : min));
    setRaw(String(clamped));
    if (clamped !== value) onChange(clamped);
  }

  return (
    <Input
      id={id}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      className={className}
      value={raw}
      onChange={(e) => {
        const next = e.target.value;
        if (!/^\d*$/.test(next)) return; // digits only; empty allowed mid-edit
        setRaw(next);
        if (next !== "") {
          const parsed = Number(next);
          if (parsed >= min && parsed <= (max ?? Infinity)) onChange(parsed);
        }
      }}
      onBlur={() => commit(raw)}
    />
  );
}
