import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { money } from "./constants";
import type { School } from "./school-context";

export type ReceiptData = {
  receipt_number: string;
  paid_on: string;
  method: string;
  reference: string | null;
  total: number;
  notes: string | null;
  received_by_name: string | null;
  voided: boolean;
  year: number;
  term: number;
  student: { first_name: string; last_name: string; reg_number: string; grade: string };
  items: { name: string; amount: number; balance?: number }[];
};

export function receiptPdf(school: School, r: ReceiptData) {
  const doc = new jsPDF({ unit: "mm", format: "a5" });
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(28, 40, 92);
  doc.rect(0, 0, w, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text(doc.splitTextToSize(school.name, w - 20), 10, 11);
  doc.setFontSize(8);
  doc.text([school.address, school.phone, school.email].filter(Boolean).join("  •  "), 10, 22);
  doc.setTextColor(20, 20, 40);
  doc.setFontSize(12);
  doc.text("OFFICIAL RECEIPT", 10, 38);
  doc.setFontSize(9);
  doc.text(`No: ${r.receipt_number}`, w - 10, 38, { align: "right" });
  doc.text(`Date: ${r.paid_on}   Term ${r.term}, ${r.year}`, w - 10, 43, { align: "right" });
  const name = `${r.student.first_name} ${r.student.last_name}`;
  doc.text(doc.splitTextToSize(`Student: ${name}`, w - 20), 10, 50);
  doc.text(`Reg No: ${r.student.reg_number}    Class: ${r.student.grade}`, 10, 56);

  autoTable(doc, {
    startY: 61,
    head: [["Fee", "Paid", "Balance"]],
    body: r.items.map((i) => [i.name, money(i.amount, school.currency), i.balance != null ? money(i.balance, school.currency) : "—"]),
    foot: [["TOTAL", money(r.total, school.currency), ""]],
    theme: "grid",
    headStyles: { fillColor: [28, 40, 92] },
    footStyles: { fillColor: [240, 200, 60], textColor: [40, 30, 0] },
    styles: { fontSize: 9 },
    margin: { left: 10, right: 10 },
  });
  // @ts-expect-error lastAutoTable added by plugin
  let y = doc.lastAutoTable.finalY + 8;
  doc.text(`Payment method: ${r.method}${r.reference ? ` (Ref ${r.reference})` : ""}`, 10, y);
  y += 5;
  if (r.notes) { doc.text(doc.splitTextToSize(`Notes: ${r.notes}`, w - 20), 10, y); y += 5; }
  doc.text(`Received by: ${r.received_by_name ?? "—"}`, 10, y);
  if (r.voided) {
    doc.setTextColor(200, 30, 30);
    doc.setFontSize(40);
    doc.text("VOID", w / 2, 110, { align: "center", angle: 30 });
  }
  return doc;
}
