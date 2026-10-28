import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Empty, selectCls } from "@/components/page";
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentSchool } from '@/lib/school-context';
import { ACCOUNTS, EXPENSE_CATEGORIES, PAYMENT_METHODS, money } from '@/lib/constants';
import { validExpenseAmount } from '@/lib/accounts';
import { pageHead } from '@/lib/metadata';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export const Route = createFileRoute("/_authenticated/app/expenses")({
  head: () => pageHead('Expenses', 'School expense register with accounts, vouchers and payment methods.'),
  component: Expenses,
});

function Expenses() {
  const { school, can, userId } = useCurrentSchool(); const qc = useQueryClient();
  const [open,setOpen] = useState(false); const [busy,setBusy] = useState(false);
  const [search,setSearch] = useState(''); const [account,setAccount] = useState(''); const [category,setCategory] = useState('');
  const [from,setFrom] = useState(`${school.current_year}-01-01`); const [to,setTo] = useState('');
  const { data = [], error, isLoading } = useQuery({ queryKey: ['expenses',school.id,from,to,account,category], enabled: can('finance') || can('reports'), queryFn: async () => {
    let query = supabase.from('expenses').select('*').eq('school_id',school.id).order('spent_on',{ascending:false});
    if(from) query=query.gte('spent_on',from); if(to) query=query.lte('spent_on',to); if(account) query=query.eq('account',account); if(category) query=query.eq('category',category);
    const r=await query; if(r.error)throw r.error; return r.data??[];
  } });
  const rows=data.filter(r => `${r.description} ${r.voucher_reference??''} ${r.method}`.toLowerCase().includes(search.toLowerCase()));
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if(!can('finance'))return; const f=new FormData(e.currentTarget); const amount=Number(f.get('amount'));
    if(!validExpenseAmount(amount)){toast.error('Enter an amount greater than zero');return;}
    setBusy(true); try { const r=await supabase.from('expenses').insert({ school_id:school.id,recorded_by:userId,amount,spent_on:String(f.get('spent_on')),description:String(f.get('description')).trim(),account:String(f.get('account')),category:String(f.get('category')),method:String(f.get('method')),voucher_reference:String(f.get('voucher_reference'))||null });if(r.error)throw r.error; await qc.invalidateQueries();setOpen(false);toast.success('Expense recorded'); }catch(e){toast.error(e instanceof Error?e.message:'Expense could not be recorded');}finally{setBusy(false);}
  }
  function csv(){
    const cells=(v:unknown)=>`"${String(v??'').replace(/^[=+@-]/,"'$&").replace(/"/g,'""')}"`;
    const content=[['Date','Category','Account','Description','Voucher','Method','Amount','Currency'],...rows.map(r=>[r.spent_on,r.category,r.account,r.description,r.voucher_reference,r.method,r.amount,school.currency])].map(r=>r.map(cells).join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8;'})); const a=document.createElement('a');a.href=url;a.download='expenses.csv';a.click();URL.revokeObjectURL(url);
  }
  if(!can('reports')&&!can('finance'))return <Empty>You do not have access to expenses.</Empty>;
  return <><PageHeader title="Expenses" sub={`${rows.length} entries · ${money(rows.reduce((s,r)=>s+Number(r.amount),0),school.currency)}`} action={<div className="flex gap-2"><Button variant="outline" onClick={csv} disabled={!rows.length}><Download className="h-4 w-4"/>CSV</Button>{can('finance')&&<Button onClick={()=>setOpen(true)}><Plus className="h-4 w-4"/>Add expense</Button>}</div>} />
    <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <Input aria-label="Search expenses" placeholder="Description or voucher" value={search} onChange={e=>setSearch(e.target.value)}/>
      <select aria-label="Filter account" className={selectCls} value={account} onChange={e=>setAccount(e.target.value)}><option value="">All accounts</option>{ACCOUNTS.map(a=><option key={a}>{a}</option>)}</select>
      <select aria-label="Filter category" className={selectCls} value={category} onChange={e=>setCategory(e.target.value)}><option value="">All categories</option>{EXPENSE_CATEGORIES.map(c=><option key={c}>{c}</option>)}</select>
      <div><Label htmlFor="dateFrom">From</Label><Input id="dateFrom" type="date" value={from} onChange={e=>setFrom(e.target.value)}/></div>
      <div><Label htmlFor="dateTo">To</Label><Input id="dateTo" type="date" value={to} onChange={e=>setTo(e.target.value)}/></div>
    </div>
    {error?<Empty>Expenses could not be loaded.</Empty>:isLoading?<Empty>Loading expenses…</Empty>:!rows.length?<Empty>No expenses match these filters.</Empty>:<div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b text-muted-foreground"><tr>{['Date','Description','Category / Account','Voucher / Method','Amount'].map(h=><th key={h} className="px-3 py-3">{h}</th>)}</tr></thead><tbody className="divide-y">{rows.map(r=><tr key={r.id}><td className="whitespace-nowrap px-3 py-4">{r.spent_on}</td><td className="min-w-40 px-3 py-4">{r.description}</td><td className="px-3 py-4">{r.category}<div className="text-muted-foreground">{r.account}</div></td><td className="px-3 py-4">{r.voucher_reference??'—'}<div className="text-muted-foreground">{r.method}</div></td><td className="whitespace-nowrap px-3 py-4 font-semibold">{money(r.amount,school.currency)}</td></tr>)}</tbody></table></div>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Add expense</DialogTitle></DialogHeader><form onSubmit={save} className="space-y-3">
      <div><Label htmlFor="spentOn">Date</Label><Input id="spentOn" name="spent_on" type="date" required defaultValue={new Date().toISOString().slice(0,10)}/></div>
      <div><Label htmlFor="expenseDescription">Description</Label><Input id="expenseDescription" name="description" required/></div>
      <div><Label htmlFor="expenseAmount">Amount ({school.currency})</Label><Input id="expenseAmount" name="amount" type="number" min="0.01" step="0.01" required/></div>
      <div><Label htmlFor="expenseAccount">Account</Label><select id="expenseAccount" name="account" className={selectCls}>{ACCOUNTS.map(a=><option key={a}>{a}</option>)}</select></div>
      <div><Label htmlFor="expenseCategory">Category</Label><select id="expenseCategory" name="category" className={selectCls}>{EXPENSE_CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></div>
      <div><Label htmlFor="expenseMethod">Payment method</Label><select id="expenseMethod" name="method" className={selectCls}>{PAYMENT_METHODS.map(m=><option key={m}>{m}</option>)}</select></div>
      <div><Label htmlFor="voucher">Voucher reference</Label><Input id="voucher" name="voucher_reference"/></div>
      <Button disabled={busy} type="submit">Record expense</Button>
    </form></DialogContent></Dialog>
  </>;
}
