"use client";

import { useState, useRef, useEffect } from "react";
import { Search, Plus } from "lucide-react";

interface SearchableSelectProps {
  options: { id: string; label: string; subtitle?: string }[];
  value: string;
  onChange: (id: string) => void;
  onAddNew?: () => void;
  placeholder?: string;
  addNewLabel?: string;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  onAddNew,
  placeholder = "Поиск...",
  addNewLabel = "+ Добавить",
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.id === value);

  const filtered = options.filter(
    (o) =>
      o.label.toLowerCase().includes(query.toLowerCase()) ||
      o.subtitle?.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <Search
          size={18}
          style={{
            position: "absolute",
            left: 12,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--text-tertiary)",
            pointerEvents: "none",
          }}
        />
        <input
          ref={inputRef}
          className="ios-input"
          style={{ paddingLeft: 40 }}
          placeholder={selected ? selected.label : placeholder}
          value={open ? query : selected ? selected.label : ""}
          onFocus={() => {
            setOpen(true);
            setQuery("");
          }}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {open && (
        <div className="picker-dropdown">
          {filtered.map((opt) => (
            <div
              key={opt.id}
              className="picker-option"
              onClick={() => {
                onChange(opt.id);
                setOpen(false);
                setQuery("");
                inputRef.current?.blur();
              }}
            >
              <div>
                <div style={{ fontWeight: value === opt.id ? 600 : 400 }}>{opt.label}</div>
                {opt.subtitle && (
                  <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                    {opt.subtitle}
                  </div>
                )}
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="picker-option" style={{ color: "var(--text-secondary)" }}>
              Ничего не найдено
            </div>
          )}

          {onAddNew && (
            <div
              className="picker-option picker-option-add"
              onClick={() => {
                onAddNew();
                setOpen(false);
                setQuery("");
              }}
            >
              <Plus size={18} style={{ marginRight: 8 }} />
              {addNewLabel}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
