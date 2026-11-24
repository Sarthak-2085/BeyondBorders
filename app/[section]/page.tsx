import { notFound } from "next/navigation";
import { pages } from "@/lib/pages";
import Product from "@/components/Product";
export const dynamicParams = false;
export function generateStaticParams() {
  return Object.keys(pages).map((section) => ({ section }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  return { title: pages[section]?.[1] || "Atlas" };
}
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!pages[section]) notFound();
  return <Product key={section} section={section} />;
}
