import { useState, useEffect, useCallback } from 'react';
import { useData } from '@/store/DataStore';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Users, Plus, Trash2, Edit, Mail, Shield, Building2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface CompanyContact {
  id: string;
  company_id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  is_default_handler: boolean;
  notes: string;
}

const DEPARTMENTS = ['Sales', 'Engineering', 'Support', 'Marketing', 'Management', 'Finance', 'Operations', 'HR', 'Legal', 'Other'];

const CompanyContactsPage = () => {
  const { activeCompanyId, data } = useData();
  const [contacts, setContacts] = useState<CompanyContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<CompanyContact | null>(null);
  const [form, setForm] = useState({ name: '', email: '', role: '', department: 'Sales', is_default_handler: false, notes: '' });

  const loadContacts = useCallback(async () => {
    if (!activeCompanyId) return;
    setLoading(true);
    const { data: rows } = await supabase.from('company_contacts').select('*').eq('company_id', activeCompanyId).order('department', { ascending: true });
    setContacts((rows || []) as CompanyContact[]);
    setLoading(false);
  }, [activeCompanyId]);

  useEffect(() => { loadContacts(); }, [loadContacts]);

  const resetForm = () => {
    setForm({ name: '', email: '', role: '', department: 'Sales', is_default_handler: false, notes: '' });
    setEditingContact(null);
  };

  const handleSave = async () => {
    if (!activeCompanyId || !form.name.trim() || !form.email.trim()) {
      toast({ title: 'Name and email are required', variant: 'destructive' });
      return;
    }

    if (editingContact) {
      await supabase.from('company_contacts').update({
        name: form.name, email: form.email, role: form.role,
        department: form.department, is_default_handler: form.is_default_handler, notes: form.notes,
      }).eq('id', editingContact.id);
      toast({ title: 'Contact updated' });
    } else {
      await supabase.from('company_contacts').insert({
        company_id: activeCompanyId, name: form.name, email: form.email, role: form.role,
        department: form.department, is_default_handler: form.is_default_handler, notes: form.notes,
      });
      toast({ title: 'Contact added' });
    }

    resetForm();
    setDialogOpen(false);
    loadContacts();
  };

  const handleEdit = (contact: CompanyContact) => {
    setEditingContact(contact);
    setForm({ name: contact.name, email: contact.email, role: contact.role, department: contact.department, is_default_handler: contact.is_default_handler, notes: contact.notes || '' });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('company_contacts').delete().eq('id', id);
    toast({ title: 'Contact removed' });
    loadContacts();
  };

  const grouped = contacts.reduce((acc, c) => {
    acc[c.department] = acc[c.department] || [];
    acc[c.department].push(c);
    return acc;
  }, {} as Record<string, CompanyContact[]>);

  if (!activeCompanyId) {
    return (
      <div className="p-6 lg:p-8 max-w-4xl mx-auto text-center py-20">
        <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">No company selected</h2>
        <p className="text-muted-foreground">Select a company from the top bar to manage contacts.</p>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> Team Directory
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Manage team members, roles, and departments for {data.companyProfile.company_name || 'this company'}. The email cobot uses this directory to route customer requests.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Add Contact</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingContact ? 'Edit Contact' : 'Add New Contact'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Name *</Label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="John Doe" />
                </div>
                <div>
                  <Label>Email *</Label>
                  <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="john@company.com" type="email" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Role / Title</Label>
                  <Input value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} placeholder="Sales Manager" />
                </div>
                <div>
                  <Label>Department</Label>
                  <select
                    value={form.department}
                    onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  >
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <Label>Notes</Label>
                <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Specializes in EMEA region..." />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_default_handler} onCheckedChange={v => setForm(f => ({ ...f, is_default_handler: v }))} />
                <Label>Default email handler (receives unroutable queries)</Label>
              </div>
              <Button onClick={handleSave} className="w-full">{editingContact ? 'Update Contact' : 'Add Contact'}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {contacts.length === 0 && !loading && (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No team members added yet. Add contacts to enable the email cobot to route customer requests properly.</p>
          </CardContent>
        </Card>
      )}

      {Object.entries(grouped).map(([dept, members]) => (
        <Card key={dept} className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" /> {dept}
              <Badge variant="secondary" className="text-xs">{members.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {members.map(contact => (
                <div key={contact.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-background hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                      {contact.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{contact.name}</span>
                        {contact.is_default_handler && (
                          <Badge variant="default" className="text-[10px] gap-1"><Shield className="h-2.5 w-2.5" /> Default</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{contact.role}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {contact.email}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(contact)}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(contact.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default CompanyContactsPage;
