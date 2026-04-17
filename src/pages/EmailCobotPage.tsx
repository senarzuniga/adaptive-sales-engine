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
  MessageSquare, Clock, Tag, UserPlus, FileText, Share2, Linkedin, Twitter, Instagram, Facebook, Globe
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { buildFallbackEmailResponse, buildFallbackGeneratedContent, classifyEdgeRuntimeError, invokeEdgeWithRetry } from '@/lib/edgeStability';

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

interface ContentResponse {
  title: string;
  body: string;
  summary: string;
  hashtags: string[];
  callToAction: string;
  suggestedImageDescription?: string;
  platform: string;
  contentType: string;
  alternativeVersions?: { platform: string; body: string }[];
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

const PLATFORM_ICONS: Record<string, any> = {
  linkedin: Linkedin,
  twitter: Twitter,
  instagram: Instagram,
  facebook: Facebook,
  newsletter: Mail,
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

  // Content Studio state
  const [contentTopic, setContentTopic] = useState('');
  const [contentType, setContentType] = useState('update');
  const [targetPlatform, setTargetPlatform] = useState('linkedin');
  const [additionalContext, setAdditionalContext] = useState('');
  const [isGeneratingContent, setIsGeneratingContent] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<ContentResponse | null>(null);
  const [socialAccounts, setSocialAccounts] = useState<any[]>([]);

  const loadContacts = useCallback(async () => {
    if (!activeCompanyId) return;
    const { data: rows } = await supabase.from('company_contacts').select('*').eq('company_id', activeCompanyId);
    setContacts(rows || []);
  }, [activeCompanyId]);

  const loadSocialAccounts = useCallback(async () => {
    if (!activeCompanyId) return;
    const { data: rows } = await supabase.from('social_media_accounts').select('*').eq('company_id', activeCompanyId);
    setSocialAccounts((rows as any[]) || []);
  }, [activeCompanyId]);

  useEffect(() => { loadContacts(); loadSocialAccounts(); }, [loadContacts, loadSocialAccounts]);

  const handleProcess = async () => {
    if (!activeCompanyId) { toast({ title: 'No company selected', variant: 'destructive' }); return; }
    if (!emailBody.trim()) { toast({ title: 'Email body is required', variant: 'destructive' }); return; }

    setIsProcessing(true);
    try {
      const productsInfo = data.products.length > 0
        ? data.products.map(p => `${p.name} (${p.type}) - Avg value: €${p.averageValue}`).join('\n')
        : 'No product data';

      const result = await invokeEdgeWithRetry<any>('email-cobot', {
        customerEmail, customerName, emailSubject, emailBody,
        companyProfile: data.companyProfile, companyContacts: contacts, productsData: productsInfo,
      }, { fallbackLabel: 'local email draft' });

      setResponse(result);
      setHistory(prev => [{
        id: Date.now().toString(), customerEmail, customerName, subject: emailSubject, body: emailBody,
        response: result, timestamp: new Date().toISOString(),
      }, ...prev].slice(0, 20));
      toast({ title: result.canAnswer ? '✅ Response drafted' : '📨 Escalation drafted', description: `Confidence: ${result.confidence}%` });
    } catch (e: any) {
      console.error('Email cobot error:', e);
      const details = classifyEdgeRuntimeError(e, 'local email draft');
      const fallback = buildFallbackEmailResponse({ customerName, emailSubject, emailBody, companyProfile: data.companyProfile });
      setResponse(fallback);
      toast({ title: details.title, description: details.description });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerateContent = async () => {
    if (!activeCompanyId) { toast({ title: 'No company selected', variant: 'destructive' }); return; }
    if (!contentTopic.trim()) { toast({ title: 'Topic is required', variant: 'destructive' }); return; }

    setIsGeneratingContent(true);
    try {
      const productsInfo = data.products.length > 0
        ? data.products.map(p => `${p.name} (${p.type}) - Avg value: €${p.averageValue}`).join('\n')
        : '';

      const platformAccount = socialAccounts.find(a => a.platform === targetPlatform);

      const result = await invokeEdgeWithRetry<any>('generate-content', {
        contentType, topic: contentTopic, targetPlatform,
        companyProfile: data.companyProfile, productsData: productsInfo,
        brandGuidelines: platformAccount?.notes || '',
        additionalContext,
      }, { fallbackLabel: 'local content draft' });

      setGeneratedContent(result);
      toast({ title: '✅ Content generated', description: `${result.contentType} for ${result.platform}` });
    } catch (e: any) {
      console.error('Content generation error:', e);
      const details = classifyEdgeRuntimeError(e, 'local content draft');
      const fallback = buildFallbackGeneratedContent({
        topic: contentTopic,
        targetPlatform,
        contentType,
        companyProfile: data.companyProfile,
        additionalContext,
      });
      setGeneratedContent(fallback);
      toast({ title: details.title, description: details.description });
    } finally {
      setIsGeneratingContent(false);
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
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-foreground flex items-center gap-2">
          <Bot className="h-6 w-6 text-primary" /> Commercial Cobot
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          Email response assistant + content studio for newsletters and social media posts.
        </p>
      </div>

      <Tabs defaultValue="email" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="email" className="gap-2"><Mail className="h-4 w-4" /> Email Cobot</TabsTrigger>
          <TabsTrigger value="content" className="gap-2"><Share2 className="h-4 w-4" /> Content Studio</TabsTrigger>
        </TabsList>

        {/* EMAIL COBOT TAB */}
        <TabsContent value="email">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2"><Mail className="h-4 w-4 text-primary" /> Incoming Email</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs">Customer Name</Label><Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="John Smith" /></div>
                    <div><Label className="text-xs">Customer Email</Label><Input value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="john@customer.com" type="email" /></div>
                  </div>
                  <div><Label className="text-xs">Subject</Label><Input value={emailSubject} onChange={e => setEmailSubject(e.target.value)} placeholder="Request for product information" /></div>
                  <div><Label className="text-xs">Email Body</Label><VoiceTextInput value={emailBody} onChange={setEmailBody} placeholder="Paste the customer's email content here..." rows={8} /></div>
                  <div className="flex gap-2">
                    <Button onClick={handleProcess} disabled={isProcessing || !emailBody.trim()} className="flex-1 gap-2">
                      {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      {isProcessing ? 'Processing...' : 'Process Email'}
                    </Button>
                    <Button variant="outline" onClick={clearForm}>Clear</Button>
                  </div>
                </CardContent>
              </Card>

              {contacts.length > 0 && (
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><UserPlus className="h-3 w-3" /> Available Team ({contacts.length})</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1.5">
                      {contacts.map(c => (<Badge key={c.id} variant={c.is_default_handler ? 'default' : 'outline'} className="text-[10px]">{c.name} · {c.department}</Badge>))}
                    </div>
                  </CardContent>
                </Card>
              )}
              {contacts.length === 0 && (
                <Card><CardContent className="py-4 text-center"><p className="text-xs text-muted-foreground">⚠️ No team contacts configured. Go to Team Directory.</p></CardContent></Card>
              )}
            </div>

            <div className="space-y-4">
              {!response && !isProcessing && (
                <Card><CardContent className="py-16 text-center"><Bot className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" /><p className="text-sm text-muted-foreground">Paste a customer email and click "Process" to generate a response.</p></CardContent></Card>
              )}
              {isProcessing && (
                <Card><CardContent className="py-16 text-center"><Loader2 className="h-10 w-10 text-primary mx-auto mb-3 animate-spin" /><p className="text-sm text-muted-foreground">Analyzing email...</p></CardContent></Card>
              )}
              {response && (
                <>
                  <Card><CardContent className="py-3"><div className="flex items-center justify-between flex-wrap gap-2"><div className="flex items-center gap-2">
                    {response.canAnswer ? <Badge variant="default" className="gap-1"><CheckCircle className="h-3 w-3" /> Direct Answer</Badge> : <Badge variant="secondary" className="gap-1"><AlertCircle className="h-3 w-3" /> Escalated</Badge>}
                    <Badge variant={URGENCY_COLORS[response.urgency] as any} className="text-[10px]">{response.urgency} urgency</Badge>
                    <Badge variant="outline" className="text-[10px]"><Tag className="h-2.5 w-2.5 mr-1" /> {CATEGORY_LABELS[response.category] || response.category}</Badge>
                  </div><span className="text-xs text-muted-foreground">Confidence: {response.confidence}%</span></div></CardContent></Card>

                  <Card><CardContent className="py-3">
                    <div className="flex items-center gap-2 text-sm"><ArrowRight className="h-4 w-4 text-primary flex-shrink-0" /><span className="text-muted-foreground">CC:</span><span className="font-medium text-foreground">{response.suggestedCcName}</span><span className="text-muted-foreground">({response.suggestedCcEmail})</span></div>
                    <p className="text-xs text-muted-foreground mt-1 ml-6">{response.suggestedCcReason}</p>
                  </CardContent></Card>

                  <Card>
                    <CardHeader className="pb-3"><div className="flex items-center justify-between"><CardTitle className="text-base flex items-center gap-2"><MessageSquare className="h-4 w-4 text-primary" /> Drafted Response</CardTitle>
                    <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => copyToClipboard(response.responseBody.replace(/<[^>]*>/g, ''), 'Response')}>{copied === 'Response' ? <CheckCircle className="h-3 w-3" /> : <Copy className="h-3 w-3" />} Copy</Button></div></CardHeader>
                    <CardContent>
                      <div className="text-xs text-muted-foreground mb-2"><strong>Subject:</strong> {response.responseSubject}</div>
                      <Separator className="mb-3" />
                      <div className="prose prose-sm max-w-none text-sm text-foreground bg-muted/30 rounded-lg p-4 border" dangerouslySetInnerHTML={{ __html: response.responseBody }} />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><User className="h-3.5 w-3.5 text-primary" /> Internal Note</CardTitle></CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{response.internalNote}</p>
                      <Separator className="my-3" />
                      <div className="flex items-start gap-2"><Clock className="h-3.5 w-3.5 text-primary mt-0.5" /><div><span className="text-xs font-medium text-foreground">Suggested Follow-up:</span><p className="text-xs text-muted-foreground">{response.suggestedFollowUp}</p></div></div>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </div>

          {history.length > 0 && (
            <Card className="mt-6">
              <CardHeader className="pb-3"><CardTitle className="text-base">Recent Email History ({history.length})</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {history.map(entry => (
                    <div key={entry.id} className="flex items-center justify-between p-3 rounded-lg border border-border text-sm hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => { setCustomerEmail(entry.customerEmail); setCustomerName(entry.customerName); setEmailSubject(entry.subject); setEmailBody(entry.body); setResponse(entry.response); }}>
                      <div className="flex items-center gap-3 min-w-0">
                        {entry.response.canAnswer ? <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" /> : <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />}
                        <div className="min-w-0"><p className="font-medium text-foreground truncate">{entry.subject || 'No subject'}</p><p className="text-xs text-muted-foreground">{entry.customerName || entry.customerEmail} · {CATEGORY_LABELS[entry.response.category]}</p></div>
                      </div>
                      <span className="text-xs text-muted-foreground flex-shrink-0">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* CONTENT STUDIO TAB */}
        <TabsContent value="content">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Content Brief</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-xs">Topic / Subject</Label>
                    <VoiceTextInput value={contentTopic} onChange={setContentTopic} placeholder="e.g., New product launch, industry trends, customer success story..." rows={3} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Content Type</Label>
                      <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={contentType} onChange={e => setContentType(e.target.value)}>
                        <option value="update">Company Update</option>
                        <option value="article">Article / Thought Leadership</option>
                        <option value="case_study">Case Study</option>
                        <option value="product_news">Product News</option>
                        <option value="industry_insight">Industry Insight</option>
                        <option value="event">Event Announcement</option>
                        <option value="newsletter">Newsletter</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs">Target Platform</Label>
                      <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={targetPlatform} onChange={e => setTargetPlatform(e.target.value)}>
                        <option value="linkedin">LinkedIn</option>
                        <option value="twitter">Twitter / X</option>
                        <option value="instagram">Instagram</option>
                        <option value="facebook">Facebook</option>
                        <option value="newsletter">Newsletter (Email)</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Additional Context (optional)</Label>
                    <VoiceTextInput value={additionalContext} onChange={setAdditionalContext} placeholder="Any specific angle, data points, or tone preferences..." rows={2} />
                  </div>
                  <Button onClick={handleGenerateContent} disabled={isGeneratingContent || !contentTopic.trim()} className="w-full gap-2">
                    {isGeneratingContent ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
                    {isGeneratingContent ? 'Generating...' : 'Generate Content'}
                  </Button>
                </CardContent>
              </Card>

              {/* Connected Platforms */}
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-xs text-muted-foreground">Connected Platforms</CardTitle></CardHeader>
                <CardContent>
                  {socialAccounts.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {socialAccounts.map(a => {
                        const Icon = PLATFORM_ICONS[a.platform] || Globe;
                        return (
                          <Badge key={a.id} variant={a.is_enabled ? 'default' : 'outline'} className="gap-1 text-[10px]">
                            <Icon className="h-3 w-3" /> {a.platform} {a.is_enabled ? '✓' : '○'}
                          </Badge>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No platforms configured. Go to Social Media settings to add platforms.</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Generated Content */}
            <div className="space-y-4">
              {!generatedContent && !isGeneratingContent && (
                <Card><CardContent className="py-16 text-center"><FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" /><p className="text-sm text-muted-foreground">Describe a topic and generate content for any platform or newsletter.</p></CardContent></Card>
              )}
              {isGeneratingContent && (
                <Card><CardContent className="py-16 text-center"><Loader2 className="h-10 w-10 text-primary mx-auto mb-3 animate-spin" /><p className="text-sm text-muted-foreground">Generating content...</p></CardContent></Card>
              )}
              {generatedContent && (
                <>
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          {(() => { const Icon = PLATFORM_ICONS[generatedContent.platform] || Share2; return <Icon className="h-4 w-4 text-primary" />; })()}
                          {generatedContent.title}
                        </CardTitle>
                        <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => copyToClipboard(generatedContent.body, 'Content')}>
                          {copied === 'Content' ? <CheckCircle className="h-3 w-3" /> : <Copy className="h-3 w-3" />} Copy
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground mb-2">{generatedContent.summary}</p>
                      <Separator className="mb-3" />
                      {generatedContent.platform === 'newsletter' ? (
                        <div className="prose prose-sm max-w-none text-sm text-foreground bg-muted/30 rounded-lg p-4 border" dangerouslySetInnerHTML={{ __html: generatedContent.body }} />
                      ) : (
                        <div className="text-sm text-foreground bg-muted/30 rounded-lg p-4 border whitespace-pre-wrap">{generatedContent.body}</div>
                      )}
                      {generatedContent.hashtags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-3">
                          {generatedContent.hashtags.map(h => <Badge key={h} variant="outline" className="text-[10px]">#{h}</Badge>)}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {generatedContent.callToAction && (
                    <Card><CardContent className="py-3"><p className="text-xs"><span className="font-medium text-foreground">CTA:</span> <span className="text-muted-foreground">{generatedContent.callToAction}</span></p></CardContent></Card>
                  )}

                  {generatedContent.suggestedImageDescription && (
                    <Card><CardContent className="py-3"><p className="text-xs"><span className="font-medium text-foreground">Suggested Image:</span> <span className="text-muted-foreground">{generatedContent.suggestedImageDescription}</span></p></CardContent></Card>
                  )}

                  {generatedContent.alternativeVersions && generatedContent.alternativeVersions.length > 0 && (
                    <Card>
                      <CardHeader className="pb-3"><CardTitle className="text-sm">Adapted for Other Platforms</CardTitle></CardHeader>
                      <CardContent className="space-y-3">
                        {generatedContent.alternativeVersions.map((v, i) => {
                          const Icon = PLATFORM_ICONS[v.platform] || Share2;
                          return (
                            <div key={i}>
                              <div className="flex items-center justify-between mb-1">
                                <Badge variant="outline" className="gap-1 text-[10px]"><Icon className="h-3 w-3" /> {v.platform}</Badge>
                                <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={() => copyToClipboard(v.body, v.platform)}>
                                  {copied === v.platform ? <CheckCircle className="h-2.5 w-2.5" /> : <Copy className="h-2.5 w-2.5" />} Copy
                                </Button>
                              </div>
                              <div className="text-xs text-foreground bg-muted/30 rounded p-2 border whitespace-pre-wrap">{v.body}</div>
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EmailCobotPage;
