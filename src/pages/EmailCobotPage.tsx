import { useState, useEffect, useCallback } from 'react';
import { useData } from '@/store/DataStore';
import { supabase } from '@/integrations/supabase/client';
import { VoiceTextInput } from '@/components/VoiceTextInput';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Bot, Send, Loader2, Mail, User, ArrowRight, Copy, CheckCircle, AlertCircle,
  MessageSquare, Clock, Tag, UserPlus
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface CobotResponse {
  canAnswer: boolean;
  confidence: number;
  responseSubject: string;
  responseBody: string;
  internalNote: string;
  suggestedCcName: string;
  suggestedCcEmail: string;
  suggestedCcReason: string;
  category: string;
  urgency: string;
  suggestedFollowUp: string;
}

interface EmailHistoryEntry {
  id: string;
  customerEmail: string;
  customerName: string;
  subject: string;
  body: string;
  response: CobotResponse;
  timestamp: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  product_inquiry: 'Product Inquiry',
  pricing_request: 'Pricing Request',
  technical_support: 'Technical Support',
  complaint: 'Complaint',
  general_info: 'General Info',
  partnership: 'Partnership',
  other: 'Other',
};

const URGENCY_COLORS: Record<string, string> = {
  low: 'secondary',
  medium: 'default',
  high: 'destructive',
};

const EmailCobotPage = () => {
  const { activeCompanyId, data } = useData();
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [response, setResponse] = useState<CobotResponse | null>(null);
  const [history, setHistory] = useState<EmailHistoryEntry[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  const loadContacts = useCallback(async () => {
    if (!activeCompanyId) return;
    const { data: rows } = await supabase.from('company_contacts').select('*').eq('company_id', activeCompanyId);
    setContacts(rows || []);
  }, [activeCompanyId]);

  useEffect(() => { loadContacts(); }, [loadContacts]);

  const handleProcess = async () => {
    if (!activeCompanyId) {
      toast({ title: 'No company selected', variant: 'destructive' });
      return;
    }
    if (!emailBody.trim()) {
      toast({ title: 'Email body is required', variant: 'destructive' });
      return;
    }

    setIsProcessing(true);
    try {
      const productsInfo = data.products.length > 0
        ? data.products.map(p => `${p.name} (${p.type}) - Avg value: €${p.averageValue}`).join('\n')
        : 'No product data';

      const { data: result, error } = await supabase.functions.invoke('email-cobot', {
        body: {
          customerEmail, customerName, emailSubject, emailBody,
          companyProfile: data.companyProfile,
          companyContacts: contacts,
          productsData: productsInfo,
        },
      });

      if (error) throw error;
      if (result?.error) throw new Error(result.error);

      setResponse(result);
      setHistory(prev => [{
        id: Date.now().toString(),
        customerEmail, customerName, subject: emailSubject, body: emailBody,
        response: result, timestamp: new Date().toISOString(),
      }, ...prev].slice(0, 20));

      toast({ title: result.canAnswer ? '✅ Response drafted' : '📨 Escalation drafted', description: `Confidence: ${result.confidence}%` });
    } catch (e: any) {
      console.error('Email cobot error:', e);
      toast({ title: 'Processing failed', description: e.message, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
    toast({ title: `${label} copied to clipboard` });
  };

  const clearForm = () => {
    setCustomerEmail(''); setCustomerName(''); setEmailSubject(''); setEmailBody(''); setResponse(null);
  };

  if (!activeCompanyId) {
    return (
      <div className="p-6 lg:p-8 max-w-4xl mx-auto text-center py-20">
        <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">No company selected</h2>
        <p className="text-muted-foreground">Select a company to use the Email Cobot.</p>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-foreground flex items-center gap-2">
          <Bot className="h-6 w-6 text-primary" /> Email Cobot
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          Paste or forward customer emails here. The AI cobot will draft the best response, route to the right team member, and keep you informed.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Panel */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" /> Incoming Email
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Customer Name</Label>
                  <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="John Smith" />
                </div>
                <div>
                  <Label className="text-xs">Customer Email</Label>
                  <Input value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="john@customer.com" type="email" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Subject</Label>
                <Input value={emailSubject} onChange={e => setEmailSubject(e.target.value)} placeholder="Request for product information" />
              </div>
              <div>
                <Label className="text-xs">Email Body</Label>
                <VoiceTextInput
                  value={emailBody}
                  onChange={setEmailBody}
                  placeholder="Paste the customer's email content here or use voice input..."
                  rows={8}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleProcess} disabled={isProcessing || !emailBody.trim()} className="flex-1 gap-2">
                  {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {isProcessing ? 'Processing...' : 'Process Email'}
                </Button>
                <Button variant="outline" onClick={clearForm}>Clear</Button>
              </div>
            </CardContent>
          </Card>

          {/* Team Status */}
          {contacts.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
                  <UserPlus className="h-3 w-3" /> Available Team ({contacts.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {contacts.map(c => (
                    <Badge key={c.id} variant={c.is_default_handler ? 'default' : 'outline'} className="text-[10px]">
                      {c.name} · {c.department}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          {contacts.length === 0 && (
            <Card>
              <CardContent className="py-4 text-center">
                <p className="text-xs text-muted-foreground">⚠️ No team contacts configured. Go to Team Directory to add contacts for proper email routing.</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Response Panel */}
        <div className="space-y-4">
          {!response && !isProcessing && (
            <Card>
              <CardContent className="py-16 text-center">
                <Bot className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-sm text-muted-foreground">Paste a customer email and click "Process" to generate an AI-powered response.</p>
              </CardContent>
            </Card>
          )}

          {isProcessing && (
            <Card>
              <CardContent className="py-16 text-center">
                <Loader2 className="h-10 w-10 text-primary mx-auto mb-3 animate-spin" />
                <p className="text-sm text-muted-foreground">Analyzing email and drafting response...</p>
              </CardContent>
            </Card>
          )}

          {response && (
            <>
              {/* Status Bar */}
              <Card>
                <CardContent className="py-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      {response.canAnswer ? (
                        <Badge variant="default" className="gap-1"><CheckCircle className="h-3 w-3" /> Direct Answer</Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1"><AlertCircle className="h-3 w-3" /> Escalated</Badge>
                      )}
                      <Badge variant={URGENCY_COLORS[response.urgency] as any} className="text-[10px]">
                        {response.urgency} urgency
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        <Tag className="h-2.5 w-2.5 mr-1" /> {CATEGORY_LABELS[response.category] || response.category}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">Confidence: {response.confidence}%</span>
                  </div>
                </CardContent>
              </Card>

              {/* CC Routing */}
              <Card>
                <CardContent className="py-3">
                  <div className="flex items-center gap-2 text-sm">
                    <ArrowRight className="h-4 w-4 text-primary flex-shrink-0" />
                    <span className="text-muted-foreground">CC:</span>
                    <span className="font-medium text-foreground">{response.suggestedCcName}</span>
                    <span className="text-muted-foreground">({response.suggestedCcEmail})</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 ml-6">{response.suggestedCcReason}</p>
                </CardContent>
              </Card>

              {/* Drafted Response */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-primary" /> Drafted Response
                    </CardTitle>
                    <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => copyToClipboard(response.responseBody.replace(/<[^>]*>/g, ''), 'Response')}>
                      {copied === 'Response' ? <CheckCircle className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      Copy
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-xs text-muted-foreground mb-2">
                    <strong>Subject:</strong> {response.responseSubject}
                  </div>
                  <Separator className="mb-3" />
                  <div className="prose prose-sm max-w-none text-sm text-foreground bg-muted/30 rounded-lg p-4 border" dangerouslySetInnerHTML={{ __html: response.responseBody }} />
                </CardContent>
              </Card>

              {/* Internal Notes */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-primary" /> Internal Note (for Sales Rep)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{response.internalNote}</p>
                  <Separator className="my-3" />
                  <div className="flex items-start gap-2">
                    <Clock className="h-3.5 w-3.5 text-primary mt-0.5" />
                    <div>
                      <span className="text-xs font-medium text-foreground">Suggested Follow-up:</span>
                      <p className="text-xs text-muted-foreground">{response.suggestedFollowUp}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <Card className="mt-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent Email History ({history.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {history.map(entry => (
                <div key={entry.id} className="flex items-center justify-between p-3 rounded-lg border border-border text-sm hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => {
                    setCustomerEmail(entry.customerEmail);
                    setCustomerName(entry.customerName);
                    setEmailSubject(entry.subject);
                    setEmailBody(entry.body);
                    setResponse(entry.response);
                  }}>
                  <div className="flex items-center gap-3 min-w-0">
                    {entry.response.canAnswer ? <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" /> : <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />}
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{entry.subject || 'No subject'}</p>
                      <p className="text-xs text-muted-foreground">{entry.customerName || entry.customerEmail} · {CATEGORY_LABELS[entry.response.category]}</p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground flex-shrink-0">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default EmailCobotPage;
