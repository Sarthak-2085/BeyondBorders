"use client";
import { useId } from "react";
import { Bookmark, Check, ExternalLink, Search } from "lucide-react";
import Link from "next/link";
import { Atlas, Source, flag, getName, Saved, useSaved } from "@/lib/data";
export function Select({
  label,
  value,
  onChange,
  options,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  options: (string | [string, string])[];
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <label className="form-field" htmlFor={id}>
      <span>{label}</span>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {options.map((o) => {
          const [v, n] = typeof o === "string" ? [o, o] : o;
          return (
            <option key={v} value={v}>
              {n}
            </option>
          );
        })}
      </select>
    </label>
  );
}
export function CountrySelect({
  a,
  label,
  value,
  onChange,
  choices,
  all,
}: {
  a: Atlas;
  label: string;
  value: string;
  onChange: (s: string) => void;
  choices?: string[];
  all?: string;
}) {
  const values = Array.from(new Set(choices || Object.keys(a.places)))
    .filter((x) => x !== "WLD" && x !== "")
    .sort((x, y) => getName(a, x).localeCompare(getName(a, y)));
  return (
    <Select
      label={label}
      value={value}
      onChange={onChange}
      options={[
        ...(all ? [["", all] as [string, string]] : []),
        ...values.map((x) => [x, getName(a, x)] as [string, string]),
      ]}
    />
  );
}
export function SourceNote({ s, period }: { s?: Source; period?: string }) {
  if (!s) return null;
  return (
    <div className="source-note">
      {s.classification && <b>{s.classification} · </b>}
      <a href={s.url} target="_blank" rel="noreferrer">
        {s.publisher}
        <ExternalLink size={12} />
      </a>{" "}
      · {period || s.period}{" "}
      <Link href={"/reports/?dataset=" + s.id}>Dataset notes</Link>
    </div>
  );
}
export function SearchBox({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="search-field">
      <Search size={18} />
      <input
        aria-label={label}
        placeholder={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
export function Save({ item }: { item: Saved }) {
  const { saved, toggle, error } = useSaved();
  const hit = saved.some((s) => s.kind === item.kind && s.id === item.id);
  return (
    <span>
      <button
        className="button small"
        aria-pressed={hit}
        onClick={() => toggle(item)}
      >
        {hit ? <Check size={15} /> : <Bookmark size={15} />}{" "}
        {hit ? "Saved" : "Save"}
      </button>
      {error && <small role="alert">{error}</small>}
    </span>
  );
}
export function Official({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a className="external" href={href} target="_blank" rel="noreferrer">
      {children}
      <ExternalLink size={13} />
    </a>
  );
}
export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="empty" role="status">
      {children}
    </p>
  );
}
