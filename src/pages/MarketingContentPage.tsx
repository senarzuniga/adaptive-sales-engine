import { useState, useEffect, useCallback, useMemo } from 'react';
import { useData } from '@/store/DataStore';
import { supabase } from '@/integrations/supabase/client';
import { VoiceTextInput } from '@/components/VoiceTextInput';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, isToday, isSameMonth } from 'date-fns';
import {
  Megaphone, Loader2, Copy, CheckCircle, FileText, Share2, Linkedin, Twitter, Instagram, Facebook,
  Globe, Mail, Plus, X, Upload, Link, Newspaper, Award, Calendar as CalendarIcon, Building2, Search,
  Sparkles, Tag, Save, Clock, Trash2, Eye, Edit2, Archive, Send, CalendarDays, Zap
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { isOpenOpportunityStatus } from '@/lib/salesData';
import { buildFallbackMarketingContent } from '@/lib/marketingContentFallback';

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

interface SavedContent {
  id: string;
  company_id: string;
  title: string;
  body: string;
  summary: string;
  content_type: string;
  platform: string;
  hashtags: string[];
  call_to_action: string;
  suggested_image_description: string;
  alternative_versions: any;
  intelligence_sources: any;
  status: string;
  scheduled_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

const PLATFORM_ICONS: Record<string, any> = {
  linkedin: Linkedin, twitter: Twitter, instagram: Instagram, facebook: Facebook, newsletter: Mail,
};

const STATUS_STYLES: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  draft: { label: 'Draft', variant: 'secondary' },
  scheduled: { label: 'Scheduled', variant: 'default' },
  published: { label: 'Published', variant: 'outline' },
  archived: { label: 'Archived', variant: 'destructive' },
};

const MarketingContentPage = () => {
  const { activeCompanyId, data } = useData();
  const [socialAccounts, setSocialAccounts] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('create');

  // Content generation
  const [contentType, setContentType] = useState('article');
  const [targetPlatform, setTargetPlatform] = useState('linkedin');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<ContentResponse | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Intelligence sources
  const [topic, setTopic] = useState('');
  const [competitorInfo, setCompetitorInfo] = useState('');
  const [sectorNews, setSectorNews] = useState('');
  const [eventInfo, setEventInfo] = useState('');
  const [awardInfo, setAwardInfo] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [referenceUrls, setReferenceUrls] = useState<string[]>([]);
  const [newUrl, setNewUrl] = useState('');
  const [uploadedText, setUploadedText] = useState('');
  const [brandGuidelines, setBrandGuidelines] = useState('');
  const [offerDetails, setOfferDetails] = useState('');

  // Scheduling
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>();

  // Saved content & calendar
  const [savedContents, setSavedContents] = useState<SavedContent[]>([]);
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | undefined>();
  const [viewingContent, setViewingContent] = useState<SavedContent | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const loadSocialAccounts = useCallback(async () => {
    if (!activeCompanyId) return;
    const { data: rows } = await supabase.from('social_media_accounts').select('*').eq('company_id', activeCompanyId);
    setSocialAccounts((rows as any[]) || []);
  }, [activeCompanyId]);

  const loadSavedContent = useCallback(async () => {
    if (!activeCompanyId) return;
    setIsLoadingSaved(true);
    const { data: rows, error } = await supabase
      .from('marketing_content')
      .select('*')
      .eq('company_id', activeCompanyId)
      .order('created_at', { ascending: false });
    if (!error) setSavedContents((rows as any[]) || []);
    setIsLoadingSaved(false);
  }, [activeCompanyId]);

  useEffect(() => { loadSocialAccounts(); loadSavedContent(); }, [loadSocialAccounts, loadSavedContent]);

  const addUrl = () => {
    if (newUrl.trim() && referenceUrls.length < 10) {
      setReferenceUrls(prev => [...prev, newUrl.trim()]);
      setNewUrl('');
    }
  };
  const removeUrl = (idx: number) => setReferenceUrls(prev => prev.filter((_, i) => i !== idx));

  const buildIntelligenceSources = () => ({
    topic, competitorInfo, sectorNews, eventInfo, awardInfo,
    websiteUrl, youtubeUrl, referenceUrls, offerDetails, uploadedText, brandGuidelines,
  });

  // Build rich context from available data
  const buildDataContext = () => {
    const productsInfo = data.products.length > 0
      ? data.products.map(p => `${p.name} (${p.type}) - Avg value: €${p.averageValue}`).join('\n') : '';

    const ordersCtx = data.orders.length > 0
      ? (() => {
          const customerRevenue: Record<string, number> = {};
          const productRevenue: Record<string, number> = {};
          const regionRevenue: Record<string, number> = {};
          data.orders.forEach(o => {
            customerRevenue[o.customerName] = (customerRevenue[o.customerName] || 0) + o.sellingPrice;
            productRevenue[o.productFamily] = (productRevenue[o.productFamily] || 0) + o.sellingPrice;
            if (o.region) regionRevenue[o.region] = (regionRevenue[o.region] || 0) + o.sellingPrice;
          });
          const topCustomers = Object.entries(customerRevenue).sort((a, b) => b[1] - a[1]).slice(0, 10)
            .map(([n, v]) => `${n}: €${v.toLocaleString()}`).join(', ');
          const topProducts = Object.entries(productRevenue).sort((a, b) => b[1] - a[1]).slice(0, 5)
            .map(([n, v]) => `${n}: €${v.toLocaleString()}`).join(', ');
          const regions = Object.entries(regionRevenue).sort((a, b) => b[1] - a[1])
            .map(([n, v]) => `${n}: €${v.toLocaleString()}`).join(', ');
          return `Total orders: ${data.orders.length}, Top customers: ${topCustomers}, Top product families: ${topProducts}, Active regions: ${regions}`;
        })()
      : '';

    const oppsCtx = data.opportunities.length > 0
      ? (() => {
          const active = data.opportunities.filter(o => isOpenOpportunityStatus(o.status));
          const totalPipeline = active.reduce((s, o) => s + o.estRevenue, 0);
          const families = [...new Set(active.map(o => o.productFamily).filter(Boolean))];
          const regions = [...new Set(active.map(o => o.region).filter(Boolean))];
          return `Active pipeline: €${totalPipeline.toLocaleString()}, ${active.length} opportunities, Product families: ${families.join(', ')}, Regions: ${regions.join(', ')}`;
        })()
      : '';

    const stratCtx = data.strategy.length > 0
      ? data.strategy.map(s => `${s.productFamily} in ${s.region}: target €${s.estRevenue.toLocaleString()}, margin=${s.margin}%`).join('; ')
      : '';

    return { productsInfo, ordersCtx, oppsCtx, stratCtx };
  };

  // Smart topic suggestions based on available data
  const smartTopicSuggestions = useMemo(() => {
    const suggestions: { label: string; topic: string; type: string; platform: string }[] = [];
    const cp = data.companyProfile;

    if (cp.main_products) {
      suggestions.push({
        label: '🏭 Product Capabilities',
        topic: `Showcase ${cp.company_name}'s key product capabilities and value proposition: ${cp.main_products}. Highlight what differentiates us in the ${cp.industry || 'industrial'} sector.`,
        type: 'article', platform: 'linkedin',
      });
    }
    if (data.orders.length > 0) {
      const regions = [...new Set(data.orders.map(o => o.region).filter(Boolean))];
      suggestions.push({
        label: '🌍 Market Presence',
        topic: `Highlight ${cp.company_name}'s growing presence across ${regions.length} regions (${regions.slice(0, 4).join(', ')}). Demonstrate our track record of successful project delivery and customer partnerships.`,
        type: 'update', platform: 'linkedin',
      });
    }
    if (cp.strategic_goals) {
      suggestions.push({
        label: '🎯 Strategic Vision',
        topic: `Share ${cp.company_name}'s strategic direction and industry leadership vision. Goals: ${cp.strategic_goals}. Position us as forward-thinking innovators in ${cp.industry || 'the industry'}.`,
        type: 'article', platform: 'linkedin',
      });
    }
    if (data.products.length > 0) {
      const topProduct = data.products.sort((a, b) => b.averageValue - a.averageValue)[0];
      suggestions.push({
        label: '📦 Product Spotlight',
        topic: `Deep dive into our ${topProduct.name} (${topProduct.type}) — its applications, benefits, and why customers choose it. Average project value: €${topProduct.averageValue.toLocaleString()}.`,
        type: 'product_news', platform: 'linkedin',
      });
    }
    if (cp.main_customer_segments) {
      suggestions.push({
        label: '🤝 Customer Success',
        topic: `How ${cp.company_name} delivers value to its key customer segments: ${cp.main_customer_segments}. Share insights on solving industry challenges and building lasting partnerships.`,
        type: 'case_study', platform: 'linkedin',
      });
    }
    if (cp.market_context) {
      suggestions.push({
        label: '📊 Industry Trends',
        topic: `Share expert perspective on current market trends in ${cp.industry || 'the industry'}. Context: ${cp.market_context}. Position ${cp.company_name} as a thought leader.`,
        type: 'industry_insight', platform: 'linkedin',
      });
    }
    if (data.opportunities.length > 0) {
      const families = [...new Set(data.opportunities.map(o => o.productFamily).filter(Boolean))];
      suggestions.push({
        label: '🚀 Solutions Portfolio',
        topic: `Showcase ${cp.company_name}'s comprehensive solutions portfolio across ${families.slice(0, 4).join(', ')}. Demonstrate breadth of expertise and ability to serve diverse customer needs.`,
        type: 'article', platform: 'linkedin',
      });
    }
    // Newsletter suggestion
    suggestions.push({
      label: '📰 Monthly Newsletter',
      topic: `Monthly newsletter for ${cp.company_name}: company updates, recent achievements, industry insights, and upcoming initiatives in the ${cp.industry || 'industrial'} sector. Include a section on our products: ${cp.main_products || 'our portfolio'}.`,
      type: 'newsletter', platform: 'newsletter',
    });

    return suggestions;
  }, [data]);

  const handleSmartGenerate = (suggestion: { topic: string; type: string; platform: string }) => {
    setTopic(suggestion.topic);
    setContentType(suggestion.type);
    setTargetPlatform(suggestion.platform);
    // Auto-trigger generation
    setTimeout(() => {
      document.getElementById('generate-btn')?.click();
    }, 100);
  };

  const handleGenerate = async () => {
    if (!activeCompanyId) { toast({ title: 'No company selected', variant: 'destructive' }); return; }
    if (!topic.trim()) { toast({ title: 'Topic is required', variant: 'destructive' }); return; }
    setIsGenerating(true);
    try {
      const { productsInfo, ordersCtx, oppsCtx, stratCtx } = buildDataContext();
      const platformAccount = socialAccounts.find(a => a.platform === targetPlatform);
      const marketIntelligence = [
        competitorInfo && `COMPETITOR INTELLIGENCE:\n${competitorInfo}`,
        sectorNews && `SECTOR NEWS & TRENDS:\n${sectorNews}`,
        eventInfo && `SECTOR EVENTS & SHOWS:\n${eventInfo}`,
        awardInfo && `SECTOR AWARDS & RECOGNITION:\n${awardInfo}`,
        websiteUrl && `COMPANY WEBSITE: ${websiteUrl}`,
        youtubeUrl && `COMPANY YOUTUBE: ${youtubeUrl}`,
        referenceUrls.length > 0 && `REFERENCE URLS:\n${referenceUrls.join('\n')}`,
        offerDetails && `OFFER / PROMOTION DETAILS:\n${offerDetails}`,
        uploadedText && `ADDITIONAL CONTENT / DOCUMENTS:\n${uploadedText}`,
      ].filter(Boolean).join('\n\n');

      const { data: result, error } = await supabase.functions.invoke('generate-content', {
        body: {
          contentType, topic, targetPlatform,
          companyProfile: data.companyProfile,
          productsData: productsInfo,
          brandGuidelines: brandGuidelines || platformAccount?.notes || '',
          additionalContext: marketIntelligence,
          ordersContext: ordersCtx,
          opportunitiesContext: oppsCtx,
          strategyContext: stratCtx,
        },
      });
      if (error) throw error;
      if (result?.error) throw new Error(result.error);
      setGeneratedContent(result);
      toast({ title: '✅ Content generated', description: `${result.contentType} for ${result.platform}` });
    } catch (e: any) {
      const { productsInfo, ordersCtx, oppsCtx, stratCtx } = buildDataContext();
      const fallback = buildFallbackMarketingContent({
        contentType,
        topic,
        targetPlatform,
        companyProfile: data.companyProfile,
        context: { productsInfo, ordersCtx, oppsCtx, stratCtx },
      });
      setGeneratedContent(fallback);
      toast({
        title: 'Content generated',
        description: 'Local fallback created a publish-ready draft because the remote AI service was unavailable.',
      });
    } finally { setIsGenerating(false); }
  };

  const handleSave = async (status: 'draft' | 'scheduled') => {
    if (!activeCompanyId || !generatedContent) return;
    if (status === 'scheduled' && !scheduleDate) { toast({ title: 'Select a schedule date', variant: 'destructive' }); return; }
    setIsSaving(true);
    try {
      const { error } = await supabase.from('marketing_content').insert({
        company_id: activeCompanyId,
        title: generatedContent.title,
        body: generatedContent.body,
        summary: generatedContent.summary || '',
        content_type: generatedContent.contentType,
        platform: generatedContent.platform,
        hashtags: generatedContent.hashtags,
        call_to_action: generatedContent.callToAction || '',
        suggested_image_description: generatedContent.suggestedImageDescription || '',
        alternative_versions: generatedContent.alternativeVersions || [],
        intelligence_sources: buildIntelligenceSources(),
        status,
        scheduled_at: status === 'scheduled' && scheduleDate ? scheduleDate.toISOString() : null,
      } as any);
      if (error) throw error;
      toast({ title: status === 'draft' ? '💾 Saved as draft' : '📅 Scheduled', description: generatedContent.title });
      await loadSavedContent();
    } catch (e: any) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    } finally { setIsSaving(false); }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('marketing_content').update({
      status, ...(status === 'published' ? { published_at: new Date().toISOString() } : {}),
    } as any).eq('id', id);
    if (error) { toast({ title: 'Update failed', variant: 'destructive' }); return; }
    toast({ title: `Status updated to ${status}` });
    await loadSavedContent();
    if (viewingContent?.id === id) setViewingContent(prev => prev ? { ...prev, status } : null);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('marketing_content').delete().eq('id', id);
    if (error) { toast({ title: 'Delete failed', variant: 'destructive' }); return; }
    toast({ title: 'Content deleted' });
    if (viewingContent?.id === id) setViewingContent(null);
    await loadSavedContent();
  };

  const copyToClipboard = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
    toast({ title: `${label} copied` });
  };

  // Calendar helpers
  const contentByDay = useMemo(() => {
    const map: Record<string, SavedContent[]> = {};
    savedContents.forEach(c => {
      const dateStr = c.scheduled_at || c.created_at;
      const day = format(new Date(dateStr), 'yyyy-MM-dd');
      if (!map[day]) map[day] = [];
      map[day].push(c);
    });
    return map;
  }, [savedContents]);

  const selectedDayContents = useMemo(() => {
    if (!selectedDay) return [];
    const key = format(selectedDay, 'yyyy-MM-dd');
    return contentByDay[key] || [];
  }, [selectedDay, contentByDay]);

  const filteredContents = useMemo(() => {
    if (filterStatus === 'all') return savedContents;
    return savedContents.filter(c => c.status === filterStatus);
  }, [savedContents, filterStatus]);

  if (!activeCompanyId) {
    return (
      <div className="p-6 lg:p-8 max-w-4xl mx-auto text-center py-20">
        <Megaphone className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">No company selected</h2>
        <p className="text-muted-foreground">Select a company to use the Marketing Content Hub.</p>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
          <Megaphone className="h-6 w-6 text-primary" /> Marketing Content Hub
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Generate, save, schedule, and manage marketing content across platforms.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="create" className="gap-2"><Sparkles className="h-4 w-4" /> Create</TabsTrigger>
          <TabsTrigger value="library" className="gap-2"><FileText className="h-4 w-4" /> Library ({savedContents.length})</TabsTrigger>
          <TabsTrigger value="calendar" className="gap-2"><CalendarDays className="h-4 w-4" /> Calendar</TabsTrigger>
        </TabsList>

        {/* CREATE TAB */}
        <TabsContent value="create">
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
            <div className="xl:col-span-3 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Content Brief</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-xs">Main Topic / Subject *</Label>
                    <VoiceTextInput value={topic} onChange={setTopic} placeholder="e.g., New product launch, industry trend, customer success..." rows={3} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Content Type</Label>
                      <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={contentType} onChange={e => setContentType(e.target.value)}>
                        <option value="article">Article / Thought Leadership</option>
                        <option value="update">Company Update</option>
                        <option value="product_news">Product News</option>
                        <option value="case_study">Case Study</option>
                        <option value="industry_insight">Industry Insight</option>
                        <option value="event">Event / Trade Show</option>
                        <option value="newsletter">Newsletter</option>
                        <option value="offer_template">Offer / Promotion Template</option>
                        <option value="award_announcement">Award Announcement</option>
                        <option value="competitor_response">Competitive Positioning</option>
                        <option value="video_script">Video Script</option>
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
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2"><Search className="h-4 w-4 text-primary" /> Market Intelligence Sources</CardTitle>
                  <CardDescription className="text-xs">Provide context from multiple sources for richer content.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Accordion type="multiple" className="w-full">
                    <AccordionItem value="competitors">
                      <AccordionTrigger className="text-sm py-2"><span className="flex items-center gap-2"><Building2 className="h-3.5 w-3.5" /> Competitor Intelligence</span></AccordionTrigger>
                      <AccordionContent><VoiceTextInput value={competitorInfo} onChange={setCompetitorInfo} placeholder="Competitor activities, launches, pricing moves..." rows={3} /></AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="sector">
                      <AccordionTrigger className="text-sm py-2"><span className="flex items-center gap-2"><Newspaper className="h-3.5 w-3.5" /> Sector News & Trends</span></AccordionTrigger>
                      <AccordionContent><VoiceTextInput value={sectorNews} onChange={setSectorNews} placeholder="Industry trends, regulatory changes, market forecasts..." rows={3} /></AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="events">
                      <AccordionTrigger className="text-sm py-2"><span className="flex items-center gap-2"><CalendarIcon className="h-3.5 w-3.5" /> Events, Shows & Conferences</span></AccordionTrigger>
                      <AccordionContent><VoiceTextInput value={eventInfo} onChange={setEventInfo} placeholder="Trade shows, conferences, webinars..." rows={3} /></AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="awards">
                      <AccordionTrigger className="text-sm py-2"><span className="flex items-center gap-2"><Award className="h-3.5 w-3.5" /> Awards & Recognition</span></AccordionTrigger>
                      <AccordionContent><VoiceTextInput value={awardInfo} onChange={setAwardInfo} placeholder="Industry awards, certifications..." rows={2} /></AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="urls">
                      <AccordionTrigger className="text-sm py-2"><span className="flex items-center gap-2"><Link className="h-3.5 w-3.5" /> Web & Video References</span></AccordionTrigger>
                      <AccordionContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div><Label className="text-xs">Company Website</Label><Input value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} placeholder="https://company.com" /></div>
                          <div><Label className="text-xs">YouTube Channel</Label><Input value={youtubeUrl} onChange={e => setYoutubeUrl(e.target.value)} placeholder="https://youtube.com/@channel" /></div>
                        </div>
                        <div>
                          <Label className="text-xs">Additional URLs</Label>
                          <div className="flex gap-2">
                            <Input value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="https://..." onKeyDown={e => e.key === 'Enter' && addUrl()} />
                            <Button variant="outline" size="icon" onClick={addUrl} disabled={!newUrl.trim()}><Plus className="h-4 w-4" /></Button>
                          </div>
                          {referenceUrls.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {referenceUrls.map((url, i) => (
                                <Badge key={i} variant="secondary" className="gap-1 text-[10px] max-w-[200px]">
                                  <span className="truncate">{url}</span>
                                  <button onClick={() => removeUrl(i)}><X className="h-2.5 w-2.5" /></button>
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="offer">
                      <AccordionTrigger className="text-sm py-2"><span className="flex items-center gap-2"><Tag className="h-3.5 w-3.5" /> Offer / Promotion Details</span></AccordionTrigger>
                      <AccordionContent><VoiceTextInput value={offerDetails} onChange={setOfferDetails} placeholder="Pricing details, discount terms, bundle offers..." rows={3} /></AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="content">
                      <AccordionTrigger className="text-sm py-2"><span className="flex items-center gap-2"><Upload className="h-3.5 w-3.5" /> Loaded Content / Documents</span></AccordionTrigger>
                      <AccordionContent><VoiceTextInput value={uploadedText} onChange={setUploadedText} placeholder="Paste content from brochures, press releases, product descriptions..." rows={5} /></AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="brand">
                      <AccordionTrigger className="text-sm py-2"><span className="flex items-center gap-2"><Sparkles className="h-3.5 w-3.5" /> Brand Guidelines & Tone</span></AccordionTrigger>
                      <AccordionContent><VoiceTextInput value={brandGuidelines} onChange={setBrandGuidelines} placeholder="Tone of voice, key messages, brand values..." rows={3} /></AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardContent>
              </Card>

              <Button id="generate-btn" onClick={handleGenerate} disabled={isGenerating || !topic.trim()} className="w-full gap-2" size="lg">
                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {isGenerating ? 'Generating...' : 'Generate Marketing Content'}
              </Button>
            </div>

            {/* RIGHT: Smart Suggestions + Generated Content */}
            <div className="xl:col-span-2 space-y-4">
              {!generatedContent && !isGenerating && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Zap className="h-4 w-4 text-primary" /> Smart Content Ideas
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Based on your company data — click any to auto-generate content.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {smartTopicSuggestions.length > 0 ? (
                      smartTopicSuggestions.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => handleSmartGenerate(s)}
                          className="w-full text-left p-3 rounded-lg border border-border hover:bg-muted/50 hover:border-primary/30 transition-colors group"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-foreground">{s.label}</span>
                            <div className="flex items-center gap-1.5">
                              <Badge variant="outline" className="text-[9px]">{s.type.replace('_', ' ')}</Badge>
                              {(() => { const Icon = PLATFORM_ICONS[s.platform] || Globe; return <Icon className="h-3 w-3 text-muted-foreground" />; })()}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.topic}</p>
                          <span className="text-[10px] text-primary opacity-0 group-hover:opacity-100 transition-opacity mt-1 inline-block">Click to generate →</span>
                        </button>
                      ))
                    ) : (
                      <div className="text-center py-6">
                        <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                        <p className="text-sm text-muted-foreground">Add company data to get smart content suggestions.</p>
                        <div className="mt-4 text-xs text-muted-foreground space-y-1">
                          <p>📰 Newsletters & campaigns</p><p>📱 Social media posts</p><p>🏷️ Offer templates</p><p>🎥 Video scripts</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
              {isGenerating && (
                <Card className="min-h-[400px] flex items-center justify-center">
                  <CardContent className="text-center"><Loader2 className="h-12 w-12 text-primary mx-auto mb-3 animate-spin" /><p className="text-sm text-muted-foreground">Generating...</p></CardContent>
                </Card>
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
                      <CardDescription className="text-xs">{generatedContent.summary}</CardDescription>
                    </CardHeader>
                    <CardContent>
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

                  {/* Save Actions */}
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Save Content</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex gap-2">
                        <Button onClick={() => handleSave('draft')} disabled={isSaving} variant="outline" className="flex-1 gap-2">
                          <Save className="h-4 w-4" /> Save Draft
                        </Button>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="flex-1 gap-2"><Clock className="h-4 w-4" /> Schedule</Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="end">
                            <Calendar mode="single" selected={scheduleDate} onSelect={setScheduleDate} disabled={(d) => d < new Date()} initialFocus className={cn("p-3 pointer-events-auto")} />
                            {scheduleDate && (
                              <div className="p-3 pt-0">
                                <Button onClick={() => handleSave('scheduled')} disabled={isSaving} className="w-full gap-2" size="sm">
                                  {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <CalendarIcon className="h-3 w-3" />}
                                  Schedule for {format(scheduleDate, 'MMM d, yyyy')}
                                </Button>
                              </div>
                            )}
                          </PopoverContent>
                        </Popover>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </div>
        </TabsContent>

        {/* LIBRARY TAB */}
        <TabsContent value="library">
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              {['all', 'draft', 'scheduled', 'published', 'archived'].map(s => (
                <Button key={s} variant={filterStatus === s ? 'default' : 'outline'} size="sm" onClick={() => setFilterStatus(s)} className="capitalize">
                  {s} {s !== 'all' && `(${savedContents.filter(c => c.status === s).length})`}
                </Button>
              ))}
            </div>

            {isLoadingSaved ? (
              <Card><CardContent className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></CardContent></Card>
            ) : filteredContents.length === 0 ? (
              <Card><CardContent className="py-12 text-center"><FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" /><p className="text-sm text-muted-foreground">No content saved yet. Generate and save content from the Create tab.</p></CardContent></Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* List */}
                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                  {filteredContents.map(c => {
                    const Icon = PLATFORM_ICONS[c.platform] || Globe;
                    const st = STATUS_STYLES[c.status] || STATUS_STYLES.draft;
                    return (
                      <div key={c.id} className={cn("p-3 rounded-lg border cursor-pointer transition-colors hover:bg-muted/30",
                        viewingContent?.id === c.id && "ring-2 ring-primary/50 bg-muted/20")}
                        onClick={() => setViewingContent(c)}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Icon className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                              <span className="text-sm font-medium text-foreground truncate">{c.title}</span>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{c.summary}</p>
                          </div>
                          <Badge variant={st.variant} className="text-[10px] flex-shrink-0">{st.label}</Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                          <span>{c.content_type}</span>
                          <span>·</span>
                          <span>{format(new Date(c.created_at), 'MMM d, yyyy')}</span>
                          {c.scheduled_at && <><span>·</span><span>📅 {format(new Date(c.scheduled_at), 'MMM d')}</span></>}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Detail View */}
                <div>
                  {viewingContent ? (
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">{viewingContent.title}</CardTitle>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(viewingContent.body, 'Content')}>
                              {copied === 'Content' ? <CheckCircle className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(viewingContent.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        <CardDescription className="text-xs">{viewingContent.summary}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {viewingContent.platform === 'newsletter' ? (
                          <div className="prose prose-sm max-w-none text-sm bg-muted/30 rounded-lg p-4 border" dangerouslySetInnerHTML={{ __html: viewingContent.body }} />
                        ) : (
                          <div className="text-sm bg-muted/30 rounded-lg p-4 border whitespace-pre-wrap">{viewingContent.body}</div>
                        )}
                        {viewingContent.hashtags?.length > 0 && (
                          <div className="flex flex-wrap gap-1">{viewingContent.hashtags.map(h => <Badge key={h} variant="outline" className="text-[10px]">#{h}</Badge>)}</div>
                        )}
                        <Separator />
                        <div className="flex gap-2 flex-wrap">
                          {viewingContent.status === 'draft' && (
                            <>
                              <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => handleUpdateStatus(viewingContent.id, 'scheduled')}><Clock className="h-3 w-3" /> Schedule</Button>
                              <Button size="sm" className="gap-1 text-xs" onClick={() => handleUpdateStatus(viewingContent.id, 'published')}><Send className="h-3 w-3" /> Publish</Button>
                            </>
                          )}
                          {viewingContent.status === 'scheduled' && (
                            <Button size="sm" className="gap-1 text-xs" onClick={() => handleUpdateStatus(viewingContent.id, 'published')}><Send className="h-3 w-3" /> Mark Published</Button>
                          )}
                          {viewingContent.status !== 'archived' && (
                            <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => handleUpdateStatus(viewingContent.id, 'archived')}><Archive className="h-3 w-3" /> Archive</Button>
                          )}
                          {viewingContent.status === 'archived' && (
                            <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => handleUpdateStatus(viewingContent.id, 'draft')}><Edit2 className="h-3 w-3" /> Restore to Draft</Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card className="flex items-center justify-center min-h-[300px]">
                      <CardContent className="text-center"><Eye className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" /><p className="text-xs text-muted-foreground">Select content to preview</p></CardContent>
                    </Card>
                  )}
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* CALENDAR TAB */}
        <TabsContent value="calendar">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" /> Content Calendar</CardTitle></CardHeader>
                <CardContent>
                  <Calendar
                    mode="single"
                    selected={selectedDay}
                    onSelect={setSelectedDay}
                    month={calendarMonth}
                    onMonthChange={setCalendarMonth}
                    className={cn("p-3 pointer-events-auto w-full")}
                    modifiers={{
                      hasContent: (day) => {
                        const key = format(day, 'yyyy-MM-dd');
                        return !!contentByDay[key];
                      },
                    }}
                    modifiersStyles={{
                      hasContent: { fontWeight: 'bold', textDecoration: 'underline', color: 'hsl(var(--primary))' },
                    }}
                  />
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">
                    {selectedDay ? format(selectedDay, 'MMMM d, yyyy') : 'Select a day'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!selectedDay && <p className="text-xs text-muted-foreground">Click a date to see scheduled content.</p>}
                  {selectedDay && selectedDayContents.length === 0 && <p className="text-xs text-muted-foreground">No content for this day.</p>}
                  {selectedDayContents.length > 0 && (
                    <div className="space-y-2">
                      {selectedDayContents.map(c => {
                        const Icon = PLATFORM_ICONS[c.platform] || Globe;
                        const st = STATUS_STYLES[c.status] || STATUS_STYLES.draft;
                        return (
                          <div key={c.id} className="p-2 rounded border text-xs space-y-1 hover:bg-muted/30 cursor-pointer"
                            onClick={() => { setViewingContent(c); setActiveTab('library'); }}>
                            <div className="flex items-center gap-2">
                              <Icon className="h-3 w-3 text-primary" />
                              <span className="font-medium truncate flex-1">{c.title}</span>
                              <Badge variant={st.variant} className="text-[9px]">{st.label}</Badge>
                            </div>
                            <p className="text-muted-foreground truncate">{c.summary}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Upcoming scheduled */}
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">Upcoming Scheduled</CardTitle></CardHeader>
                <CardContent>
                  {(() => {
                    const upcoming = savedContents.filter(c => c.status === 'scheduled' && c.scheduled_at && new Date(c.scheduled_at) >= new Date()).sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime()).slice(0, 5);
                    if (upcoming.length === 0) return <p className="text-xs text-muted-foreground">No upcoming scheduled posts.</p>;
                    return (
                      <div className="space-y-2">
                        {upcoming.map(c => {
                          const Icon = PLATFORM_ICONS[c.platform] || Globe;
                          return (
                            <div key={c.id} className="flex items-center gap-2 text-xs">
                              <Icon className="h-3 w-3 text-primary flex-shrink-0" />
                              <span className="truncate flex-1">{c.title}</span>
                              <span className="text-muted-foreground flex-shrink-0">{format(new Date(c.scheduled_at!), 'MMM d')}</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MarketingContentPage;
